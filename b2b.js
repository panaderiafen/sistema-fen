// ═══════════════════════════════════════════════
//  Sistema Fën — Ventas B2B: base nueva (fen-b2b)  v0.11.0
//  · Conexión: la configuración web de fen-b2b se guarda en Firestore de Sistema Fën
//    (config/sistemaFen → b2bFirebase) y una copia en este navegador (para cerrar sesión).
//    No es secreta: solo identifica el proyecto. Lo que protege los datos son las reglas
//    de fen-b2b y la cuenta de administración (admins/{uid} en fen-b2b).
//  · Copia desde la planilla: el script de B2B (v2.3.0) entrega las hojas y aquí se
//    arman los documentos (b2b-modelo.js). Se escribe solo lo que cambió desde la
//    última copia (migracion/{coleccion} guarda una huella por documento).
// ═══════════════════════════════════════════════
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction } from './firebase.js?v=0.14.2';
import * as FB from './firebase-b2b.js?v=0.14.2';
import * as Apps from './apps.js?v=0.14.2';
import { armar, cambios, COLECCIONES } from './b2b-modelo.js?v=0.14.2';

export const VERSION_MINIMA = '2.3.0';   // script de B2B con la copia (SistemaFen.gs v1.1.0)
export const VERSION_BASE_NUEVA = '2.5.0';   // script que pasa la base nueva a la planilla (SistemaFen.gs v1.3.0: también clientes y productos)
const K_CFG = 'fen_sistema_b2b_cfg';
const LOTE = 400;                        // escrituras por lote (Firestore acepta hasta 500)
const LOTE_BYTES = 4e6;                  // y como máximo ~4 MB por lote (el límite de Firestore es 10 MB)
const PARTE = 15000;                     // huellas por documento de migracion (cada uno queda bajo 1 MB)

// Contador de esta sesión (para mostrar cuánto gasta cada cosa)
export const uso = { lecturas: 0, escrituras: 0 };

// ── Configuración ──────────────────────────────────
// Acepta lo que muestra la consola de Firebase (const firebaseConfig = { apiKey: "…", … }) o JSON.
export function parsearConfig(txt) {
  const cfg = {};
  String(txt || '').replace(/["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)["']?\s*:\s*["']([^"']+)["']/g, (m, k, v) => { cfg[k] = v.trim(); return m; });
  if (!cfg.projectId || !cfg.apiKey || !cfg.appId || !cfg.authDomain) throw new Error('No se encontró la configuración completa. Copia todo el bloque "const firebaseConfig = { … }" de la consola de Firebase.');
  if (!/^[a-z0-9-]{4,40}$/.test(cfg.projectId)) throw new Error('El projectId no se ve bien: ' + cfg.projectId);
  if (cfg.projectId === (window.FEN_SIS.firebase || {}).projectId) throw new Error('Esa es la configuración de la caja (fen-ventas). Copia la del proyecto nuevo de B2B.');
  if (!/^AIza[\w-]{30,}$/.test(cfg.apiKey)) throw new Error('El apiKey no se ve bien.');
  if (!/\.firebaseapp\.com$|\.web\.app$/.test(cfg.authDomain)) throw new Error('El authDomain no se ve bien: ' + cfg.authDomain);
  return cfg;
}
const cfgLocal = () => { try { return JSON.parse(localStorage.getItem(K_CFG) || 'null'); } catch (e) { return null; } };
export async function leerConfig() {
  let cfg = null;
  try { const sn = await getDocSF(docSF(dbSF, 'config', 'sistemaFen')); if (sn.exists()) cfg = sn.data().b2bFirebase || null; } catch (e) { cfg = cfgLocal(); }
  cfg = cfg || window.FEN_SIS.firebaseB2B || null;
  try { if (cfg) localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch (e) {}
  return cfg;
}
export async function guardarConfig(cfg) {
  const ref = docSF(dbSF, 'config', 'sistemaFen');
  await runTransaction(dbSF, async tx => {
    const sn = await tx.get(ref);
    tx.set(ref, { ...(sn.exists() ? sn.data() : {}), b2bFirebase: cfg });
  });
  try { localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch (e) {}
}

// ── Sesión en fen-b2b ──────────────────────────────
// estado: sin_config | sin_sesion | sin_admin | ok
export async function conexion() {
  const cfg = await leerConfig();
  if (!cfg) return { estado: 'sin_config' };
  const cx = await FB.conectar(cfg);
  const u = cx.auth.currentUser, yo = (authSF.currentUser && authSF.currentUser.email || '').toLowerCase();
  if (!u) return { estado: 'sin_sesion', cfg, correo: yo };
  // Tiene que ser la misma cuenta que está en Sistema Fën
  if ((u.email || '').toLowerCase() !== yo) { await FB.salir(); return { estado: 'sin_sesion', cfg, correo: yo }; }
  let admin = false;
  try { admin = (await FB.getDoc(FB.doc(cx.db, 'admins', u.uid))).exists(); uso.lecturas++; }
  catch (e) { if (!/permission/i.test(e.code || e.message || '')) throw e; }
  if (!admin) return { estado: 'sin_admin', cfg, uid: u.uid, correo: u.email };
  return { estado: 'ok', cfg, uid: u.uid, correo: u.email, db: cx.db };
}
export async function entrar(clave, soloSesion) {
  const cfg = await leerConfig();
  await FB.conectar(cfg);
  await FB.entrar(authSF.currentUser.email, clave, soloSesion);
  return conexion();
}
// Cierra la sesión de fen-b2b (al salir de Sistema Fën o si se revoca el equipo)
export async function salir() {
  try {
    if (!FB.conectado()) { const cfg = cfgLocal(); if (!cfg) return; await FB.conectar(cfg); }
    await FB.salir();
  } catch (e) {}
}

// ── Leer la planilla (script de B2B) ───────────────
export async function leerPlanilla() {
  const url = (await Apps.leerConexiones()).b2b;
  if (!url) { const e = new Error('Falta la dirección del script de B2B (Configuración → Conexiones).'); e.code = 'sin_url'; throw e; }
  const v = await Apps.probar('b2b', url, VERSION_MINIMA);
  if (!v.ok) { const e = new Error(v.version ? `El script de B2B está en v${v.version}: para copiar necesita v${VERSION_MINIMA} (ver README).` : v.texto); e.code = 'actualizar'; throw e; }
  const cuerpo = JSON.stringify({ action: 'sistema_fen_b2b', accion: 'sistema_fen_b2b', op: 'exportar', idToken: await authSF.currentUser.getIdToken() });
  const pedir = (u, o) => Promise.race([fetch(u, o).then(x => x.json()), new Promise((_, no) => setTimeout(() => no(new Error('El script no respondió en 3 minutos. Prueba de nuevo.')), 180000))]);
  let r = await pedir(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo });
  if (r && r.code === 'version') r = await pedir(url + '?p=' + encodeURIComponent(cuerpo), {});
  if (!r || !r.ok || !r.hojas) throw new Error((r && (r.error || r.msg)) || 'Respuesta inesperada del script de B2B.');
  return r;
}

// Lo que quedó anotado en la última copia: migracion/{coleccion} dice en cuántas partes está;
// cada parte (migracion/{coleccion}-{i}) guarda las huellas como un solo texto JSON
// (un texto no tiene el límite de 20.000 campos de un documento y no se indexa).
async function leerHuellas(db) {
  const previas = {};
  await Promise.all(COLECCIONES.map(async col => {
    const sn = await FB.getDoc(FB.doc(db, 'migracion', col)); uso.lecturas++;
    const d = sn.exists() ? sn.data() : {};
    previas[col] = {};
    for (let i = 0; i < (d.partes || 0); i++) {
      const p = await FB.getDoc(FB.doc(db, 'migracion', `${col}-${i}`)); uso.lecturas++;
      if (p.exists()) Object.assign(previas[col], JSON.parse(p.data().hj || '{}'));
    }
  }));
  return previas;
}
async function guardarHuellas(db, col, mapa) {
  const ids = Object.keys(mapa), partes = Math.max(1, Math.ceil(ids.length / PARTE));
  const b = FB.writeBatch(db);
  for (let i = 0; i < partes; i++) {
    const trozo = {}; ids.slice(i * PARTE, (i + 1) * PARTE).forEach(id => { trozo[id] = mapa[id]; });
    b.set(FB.doc(db, 'migracion', `${col}-${i}`), { hj: JSON.stringify(trozo) });
  }
  b.set(FB.doc(db, 'migracion', col), { partes, total: ids.length, en: FB.serverTimestamp() });
  await b.commit(); uso.escrituras += partes + 1;
}

// Lee la planilla, arma los documentos y compara con la última copia. No escribe nada.
export async function preparar(desdeCambio) {
  const cx = await conexion();
  if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  if (!desdeCambio) { const m = await FB.getDoc(FB.doc(cx.db, 'config', 'b2b')); uso.lecturas++; if (m.exists() && m.data().activa) throw new Error('La base nueva ya está en uso: ahora la planilla es la copia, así que ya no se copia desde ella.'); }
  const r = await leerPlanilla();
  const armado = armar(r.hojas);
  const previas = await leerHuellas(cx.db);
  const cmb = cambios(armado.docs, previas);
  const porEscribir = COLECCIONES.reduce((s, c) => s + cmb[c].nuevos.length + cmb[c].cambiados.length + cmb[c].quitar.length, 0);
  return { ...armado, cambios: cmb, previas, porEscribir, siguienteOrden: Number(r.siguienteOrden) || 0, leido: r.leido, msScript: r.ms };
}

// Escribe lo que cambió, en lotes. avance(hechos, total) para la barra.
// Después de cada lote se anotan sus huellas: si algo se corta a medias, la próxima copia
// sabe exactamente qué quedó escrito (y puede marcar como quitado lo que salga de la planilla).
export async function copiar(prep, avance) {
  const cx = await conexion();
  if (cx.estado !== 'ok') throw new Error('Se perdió la conexión con la base nueva. Vuelve a entrar.');
  const db = cx.db;
  // Lo que solo existe en la base nueva (quién la creó o editó en la app de logística, anulación) no se pierde
  // si se vuelve a copiar después de "Volver a la app antigua"
  const propios = {};
  for (const [campo, op, val] of [['origen.app', '==', 'logistica'], ['editada.veces', '>=', 1], ['estado', '==', 'anulada']]) {
    const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where(campo, op, val)));
    uso.lecturas += Math.max(1, sn.size);
    sn.docs.forEach(d => { const x = d.data(), k = {}; ['creada', 'editada', 'anulada', 'origen'].forEach(c => { if (x[c] !== undefined) k[c] = x[c]; }); if (x.estado === 'anulada') k.estado = 'anulada'; propios[d.id] = k; });
  }
  // v0.13: lo mismo para clientes y productos (historial de precios, quién lo creó o cambió en Sistema Fën)
  const propiosCat = { clientes: {}, productos: {} };
  for (const col of ['clientes', 'productos']) {
    if (!prep.cambios[col] || !prep.cambios[col].cambiados.length) continue;
    const sn = await FB.getDocs(FB.collection(db, col));
    uso.lecturas += Math.max(1, sn.size);
    sn.docs.forEach(d => { const x = d.data(), k = {}; ['historialPrecios', 'creadoEn', 'creadoPor', 'cambiadoEn', 'cambiadoPor'].forEach(c => { if (x[c] !== undefined) k[c] = x[c]; }); if (x.origen && x.origen.app) k.origen = x.origen; if (Object.keys(k).length) propiosCat[col][d.id] = k; });
  }
  const ops = [];
  COLECCIONES.forEach(col => {
    const c = prep.cambios[col];
    [...c.nuevos, ...c.cambiados].forEach(id => { const extra = col === 'ordenes' ? propios[id] : propiosCat[col] && propiosCat[col][id]; const datos = extra ? { ...prep.docs[col][id], ...extra } : prep.docs[col][id]; ops.push({ t: 'set', col, id, datos, bytes: JSON.stringify(datos).length + 200 }); });
    c.quitar.forEach(id => ops.push({ t: 'quitar', col, id, bytes: 200 }));
  });
  // Lotes de hasta 400 escrituras y ~4 MB
  const lotes = [];
  let actual = [], bytes = 0;
  ops.forEach(o => {
    if (actual.length && (actual.length >= LOTE || bytes + o.bytes > LOTE_BYTES)) { lotes.push(actual); actual = []; bytes = 0; }
    actual.push(o); bytes += o.bytes;
  });
  if (actual.length) lotes.push(actual);
  const vivo = {};
  const previas = prep.previas || {};
  COLECCIONES.forEach(col => { vivo[col] = { ...(previas[col] || {}) }; });
  let hechos = 0;
  for (const lote of lotes) {
    await escribir(db, lote);
    const tocadas = new Set();
    lote.forEach(o => { vivo[o.col][o.id] = o.t === 'set' ? prep.cambios[o.col].huellas[o.id] : 'quitado'; tocadas.add(o.col); });
    for (const col of tocadas) await guardarHuellas(db, col, vivo[col]);
    hechos += lote.length;
    if (avance) avance(hechos, ops.length);
  }
  // Al final, las huellas completas (incluye lo que ya estaba marcado como quitado)
  for (const col of COLECCIONES) await guardarHuellas(db, col, prep.cambios[col].huellas);
  const b = FB.writeBatch(db);
  // El contador del N° de orden nunca retrocede
  const cont = await FB.getDoc(FB.doc(db, 'contadores', 'ordenes')); uso.lecturas++;
  const sig = Math.max(prep.siguienteOrden || 0, cont.exists() ? Number(cont.data().siguiente) || 0 : 0);
  b.set(FB.doc(db, 'contadores', 'ordenes'), { siguiente: sig, desde: 'planilla', en: FB.serverTimestamp() });
  b.set(FB.doc(db, 'config', 'migracion'), {
    ultima: FB.serverTimestamp(), por: authSF.currentUser.email, planilla: prep.planilla,
    escritos: ops.length, avisos: prep.avisos.slice(0, 300), totalAvisos: prep.avisos.length
  });
  await b.commit(); uso.escrituras += 2;
  return { escritos: ops.length };
}
// Un lote. Si Firestore lo rechaza por las reglas (límite de revisiones por lote) se reintenta
// de a 10; si un documento por marcar como quitado ya no existe (lo borraron en la consola), se salta.
async function escribir(db, lote) {
  const b = FB.writeBatch(db);
  lote.forEach(o => o.t === 'set'
    ? b.set(FB.doc(db, o.col, o.id), { ...o.datos, copiadoEn: FB.serverTimestamp() })
    : b.update(FB.doc(db, o.col, o.id), { quitadoEnPlanilla: true, quitadoEn: FB.serverTimestamp() }));
  try { await b.commit(); uso.escrituras += lote.length; }
  catch (e) {
    const c = String(e.code || '');
    if (/permission-denied/.test(c) && lote.length > 10) { for (let i = 0; i < lote.length; i += 10) await escribir(db, lote.slice(i, i + 10)); return; }
    if (/not-found/.test(c) && lote.some(o => o.t === 'quitar')) {
      const sets = lote.filter(o => o.t === 'set');
      if (sets.length) await escribir(db, sets);
      for (const o of lote.filter(x => x.t === 'quitar')) {
        try { await FB.updateDoc(FB.doc(db, o.col, o.id), { quitadoEnPlanilla: true, quitadoEn: FB.serverTimestamp() }); uso.escrituras++; }
        catch (e2) { if (!/not-found/.test(String(e2.code || ''))) throw e2; }
      }
      return;
    }
    throw e;
  }
}

// Totales de la base nueva calculados por Firestore (cuestan 1 lectura por cada 1.000 documentos)
export async function totales() {
  const cx = await conexion();
  if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  // Firestore suma toda la colección (sin filtro: un filtro + una suma necesitaría un índice compuesto);
  // después se restan los pocos documentos marcados como quitados de la planilla.
  const db = cx.db;
  // Una agregación por consulta: Firestore pide un índice compuesto si se suman dos campos juntos
  const agg = async (col, campos) => {
    const partes = await Promise.all(Object.entries(campos).map(async ([k, c]) => (await FB.getAggregateFromServer(FB.collection(db, col), { [k]: c })).data()));
    return Object.assign({}, ...partes);
  };
  const quitados = async col => { const sn = await FB.getDocs(FB.query(FB.collection(db, col), FB.where('quitadoEnPlanilla', '==', true))); uso.lecturas += Math.max(1, sn.size); return sn.docs.map(d => d.data()); };
  const menos = (r, qs, campos) => { const o = { n: r.n - qs.length }; campos.forEach(c => { o[c] = (Number(r[c]) || 0) - qs.reduce((s, d) => s + (Number(d[c]) || 0), 0); }); return o; };
  const [o, a, c, p, e, qo, qa, qc, qp, qe, ult] = await Promise.all([
    agg('ordenes', { n: FB.count(), total: FB.sum('total'), neto: FB.sum('neto') }),
    agg('abonos', { n: FB.count(), monto: FB.sum('monto') }),
    agg('clientes', { n: FB.count() }), agg('productos', { n: FB.count() }), agg('ediciones', { n: FB.count() }),
    quitados('ordenes'), quitados('abonos'), quitados('clientes'), quitados('productos'), quitados('ediciones'),
    FB.getDoc(FB.doc(db, 'config', 'migracion'))
  ]);
  uso.lecturas += Math.ceil((o.n + 1) / 1000) + Math.ceil((a.n + 1) / 1000) + 4;
  const O = menos(o, qo, ['total', 'neto']), A = menos(a, qa, ['monto']);
  return {
    base: { ordenes: O.n, total: O.total, neto: O.neto, abonos: A.n, abonosMonto: A.monto, clientes: c.n - qc.length, productos: p.n - qp.length, ediciones: e.n - qe.length },
    ultima: ult.exists() ? ult.data() : null
  };
}

// ── Mirar órdenes en la base nueva (para revisar la copia) ─
const conId = s => ({ id: s.id, ...s.data() });
// Más recientes primero por fecha de la orden (una orden editada no cambia de lugar)
const porFechaDesc = (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.n - a.n;
export async function ultimasOrdenes(n = 30) {
  const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'ordenes'), FB.orderBy('n', 'desc'), FB.limit(n)));
  uso.lecturas += Math.max(1, sn.size);
  return sn.docs.map(conId).sort(porFechaDesc);
}
export async function buscarOrdenes(q) {
  const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  const t = String(q || '').trim();
  let docs = [];
  if (/^\d{4}-\d{2}$/.test(t)) {
    const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'ordenes'), FB.where('mes', '==', t))); docs = sn.docs.map(conId);
  } else if (/^\d+$/.test(t)) {
    const [o, f] = await Promise.all([FB.getDoc(FB.doc(cx.db, 'ordenes', String(Number(t)))), FB.getDocs(FB.query(FB.collection(cx.db, 'ordenes'), FB.where('folio', '==', t), FB.limit(50)))]);
    if (o.exists()) docs.push(conId(o));
    f.docs.forEach(d => { if (d.id !== o.id) docs.push(conId(d)); });
  } else throw new Error('Escribe un N° de orden, un folio o un mes (AAAA-MM).');
  uso.lecturas += Math.max(1, docs.length);
  return docs.sort(porFechaDesc);
}

// ═══════════════════════════════════════════════
//  v0.12.0 · Base nueva en uso: administración de B2B en Sistema Fën
// ═══════════════════════════════════════════════
const hoyTxt = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ahoraTxt = (d = new Date()) => `${hoyTxt(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
async function dbOk() { const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva (Ventas B2B → Base nueva).'); return cx.db; }

// config/b2b: { activa, scriptUrl, desde, por }
export async function modo() {
  const db = await dbOk();
  const sn = await FB.getDoc(FB.doc(db, 'config', 'b2b')); uso.lecturas++;
  return sn.exists() ? sn.data() : { activa: false };
}
async function llamarScript(url, cuerpo) {
  const pedir = (u, o) => Promise.race([fetch(u, o).then(x => x.json()), new Promise((_, no) => setTimeout(() => no(new Error('El script de B2B no respondió a tiempo.')), 120000))]);
  const txt = JSON.stringify(cuerpo);
  let r = await pedir(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: txt });
  if (r && r.code === 'version') r = await pedir(url + '?p=' + encodeURIComponent(txt), {});
  return r;
}
async function scriptListo() {
  const url = (await Apps.leerConexiones()).b2b;
  if (!url) throw new Error('Falta la dirección del script de B2B (Configuración → Conexiones).');
  const v = await Apps.probar('b2b', url, VERSION_BASE_NUEVA);
  if (!v.ok) throw new Error(v.version ? `El script de B2B está en v${v.version}: necesita v${VERSION_BASE_NUEVA} (ver README).` : v.texto);
  return url;
}
async function scriptModo(url, activo) {
  const r = await llamarScript(url, { action: 'sistema_fen_b2b', accion: 'sistema_fen_b2b', op: 'modo', activo, idToken: await authSF.currentUser.getIdToken() });
  if (!r || !r.ok) throw new Error((r && (r.error || r.msg)) || 'El script no respondió bien.');
  return r;
}

// Cambiar a la base nueva: 1) la app antigua queda solo para mirar, 2) última copia de la planilla,
// 3) el N° de orden sigue desde el último, 4) se activa para la app de logística.
export async function cambiarABaseNueva(avance) {
  const db = await dbOk();
  const paso = t => avance && avance(t);
  paso('Revisando el script de B2B…');
  const ya = await FB.getDoc(FB.doc(db, 'config', 'b2b')); uso.lecturas++;
  if (ya.exists() && ya.data().activa) throw new Error('La base nueva ya está en uso (se cambió desde otro equipo). Recarga la página.');
  const url = await scriptListo();
  try {
    paso('Dejando la app antigua solo para mirar…');
    const m = await scriptModo(url, true);
    paso('Leyendo la planilla por última vez…');
    const prep = await preparar(true);
    if (prep.porEscribir) { paso(`Copiando ${prep.porEscribir} cambios…`); await copiar(prep, (h, n) => paso(`Copiando… ${h} de ${n}`)); }
    const cont = await FB.getDoc(FB.doc(db, 'contadores', 'ordenes')); uso.lecturas++;
    const sig = Math.max(Number(m.siguienteOrden) || 0, prep.siguienteOrden || 0, cont.exists() ? Number(cont.data().siguiente) || 0 : 0);
    const b = FB.writeBatch(db);
    b.set(FB.doc(db, 'contadores', 'ordenes'), { siguiente: sig, desde: 'cambio', en: FB.serverTimestamp() });
    b.set(FB.doc(db, 'config', 'b2b'), { activa: true, scriptUrl: url, desde: FB.serverTimestamp(), por: authSF.currentUser.email });
    await b.commit(); uso.escrituras += 2;
    return { siguiente: sig, copiados: prep.porEscribir };
  } catch (e) {
    try { await scriptModo(url, false); } catch (e2) {}
    throw new Error('No se pudo cambiar (la app antigua sigue como siempre): ' + (e.message || e));
  }
}
// Volver a la app antigua: solo si todo lo de la base nueva ya pasó a la planilla
export async function volverAPlanilla() {
  const db = await dbOk();
  const url = await scriptListo();
  await pasarAPlanilla();
  let pend = 0;
  for (const col of ['ordenes', 'abonos', 'ediciones', 'clientes', 'productos', 'movimientos']) {
    const sn = await FB.getDocs(FB.query(FB.collection(db, col), FB.where('planillaPendiente', '==', true)));
    uso.lecturas += Math.max(1, sn.size); pend += sn.size;
  }
  if (pend) throw new Error(`Hay ${pend} cambios que todavía no pasan a la planilla. Presiona "Pasar ahora" (en Órdenes) y vuelve a intentar.`);
  await FB.setDoc(FB.doc(db, 'config', 'b2b'), { activa: false, scriptUrl: url, hasta: FB.serverTimestamp(), por: authSF.currentUser.email }); uso.escrituras++;
  await scriptModo(url, false);
}

// Pasa a la planilla lo pendiente (el script lee la base nueva con esta sesión de fen-b2b)
export async function pasarAPlanilla() {
  const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  const m = await modo();
  const url = m.scriptUrl || (await Apps.leerConexiones()).b2b;
  if (!url) throw new Error('Falta la dirección del script de B2B.');
  const r = await llamarScript(url, { action: 'b2b_planilla', accion: 'b2b_planilla', idToken: await FB.conectado().auth.currentUser.getIdToken() });
  if (!r || !r.ok) throw new Error((r && (r.error || r.msg)) || 'El script no respondió bien.');
  return r;
}

// ── Escuchas en vivo (órdenes por facturar y por cobrar, abonos, solicitudes) ──
export async function escuchar(cb) {
  const db = await dbOk();
  const datos = { ordenes: new Map(), abonos: [], solicitudes: [], config: null, clientes: [], productos: [], movimientos: [], conciliacion: null, conciliacionLeida: false, listo: { a: 0 } };
  const avisar = () => cb(datos);
  const desde = hoyTxt(new Date(Date.now() - 7 * 864e5));   // v0.14.1: 7 días (antes 30): lo pendiente llega por sus propias consultas; así lee mucho menos
  const juntar = clave => sn => {
    uso.lecturas += sn.docChanges().length || 1;
    sn.docChanges().forEach(c => {
      if (c.type === 'removed') { const o = datos.ordenes.get(c.doc.id); if (o) { o._de.delete(clave); if (!o._de.size) datos.ordenes.delete(c.doc.id); } }
      else { const prev = datos.ordenes.get(c.doc.id); datos.ordenes.set(c.doc.id, { id: c.doc.id, ...c.doc.data(), _de: new Set([...(prev ? prev._de : []), clave]) }); }
    });
    avisar();
  };
  const err = e => cb(datos, e);
  const fin = [
    FB.onSnapshot(FB.query(FB.collection(db, 'ordenes'), FB.where('sinFolio', '==', true)), juntar('sinFolio'), err),
    FB.onSnapshot(FB.query(FB.collection(db, 'ordenes'), FB.where('estadoPago', 'in', ['PENDIENTE', 'PARCIAL'])), juntar('porCobrar'), err),
    FB.onSnapshot(FB.query(FB.collection(db, 'ordenes'), FB.where('fecha', '>=', desde)), juntar('recientes'), err),
    FB.onSnapshot(FB.collection(db, 'abonos'), sn => { uso.lecturas += sn.docChanges().length || 1; datos.abonos = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !a.quitadoEnPlanilla); avisar(); }, err),
    FB.onSnapshot(FB.query(FB.collection(db, 'solicitudes'), FB.where('estado', '==', 'pendiente')), sn => { uso.lecturas += sn.docChanges().length || 1; datos.solicitudes = sn.docs.map(d => ({ id: d.id, ...d.data() })); avisar(); }, err),
    FB.onSnapshot(FB.doc(db, 'config', 'b2b'), sn => { datos.config = sn.exists() ? sn.data() : { activa: false }; avisar(); }, err),
    // v0.13: catálogo en vivo (clientes con sus precios especiales, y productos)
    FB.onSnapshot(FB.collection(db, 'clientes'), sn => { uso.lecturas += sn.docChanges().length || 1; datos.clientes = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.quitadoEnPlanilla).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')); avisar(); }, err),
    // v0.14: movimientos de la cartola por revisar y la configuración de la conciliación
    FB.onSnapshot(FB.query(FB.collection(db, 'movimientos'), FB.where('estado', '==', 'pendiente')), sn => { uso.lecturas += sn.docChanges().length || 1; datos.movimientos = sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || (a.orden || 0) - (b.orden || 0)); avisar(); }, err),
    FB.onSnapshot(FB.doc(db, 'config', 'conciliacion'), sn => { datos.conciliacion = sn.exists() ? sn.data() : null; datos.conciliacionLeida = true; avisar(); }, err),
    FB.onSnapshot(FB.collection(db, 'productos'), sn => { uso.lecturas += sn.docChanges().length || 1; datos.productos = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.quitadoEnPlanilla).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')); avisar(); }, err)
  ];
  return () => fin.forEach(f => { try { f(); } catch (e) {} });
}

const marcaCambio = extra => ({ ...extra, planillaPendiente: true, cambiadaEn: FB.serverTimestamp(), cambiadaPor: authSF.currentUser.email });
// Asignar un folio a varias órdenes (sin folio) de una vez
export async function asignarFolio(ns, folio, fechaFolio) {
  const db = await dbOk();
  const f = String(folio || '').trim();
  if (!/^\d{1,12}$/.test(f)) throw new Error('El folio debe ser un número.');
  if (!ns.length) throw new Error('Marca al menos una orden.');
  // Regla: un folio (una factura) es de un solo cliente
  const cliDe = o => o.clienteId || String(o.cliente || '').trim().toLowerCase();
  const yaEnFolio = await ordenesDelFolio(db, f);
  await FB.runTransaction(db, async tx => {
    const refs = ns.map(n => FB.doc(db, 'ordenes', String(n)));
    const sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    sns.forEach(sn => { if (!sn.exists()) throw new Error('Una de las órdenes ya no existe.'); const o = sn.data(); if (o.folio) throw new Error(`La orden N° ${o.n} ya tiene el folio ${o.folio}.`); if (o.estado === 'anulada') throw new Error(`La orden N° ${o.n} está anulada.`); });
    const todas = sns.map(sn => sn.data()).concat(yaEnFolio);
    if (new Set(todas.map(cliDe)).size > 1) throw new Error(yaEnFolio.length ? `El folio ${f} ya es de ${yaEnFolio[0].cliente} (N° ${yaEnFolio.map(o => o.n).join(', ')}). Un folio es de un solo cliente: revisa el número.` : 'Un folio es de un solo cliente: marca solo órdenes del mismo cliente.');
    refs.forEach(r => tx.update(r, marcaCambio({ folio: f, sinFolio: false, fechaFolio: fechaFolio || hoyTxt() })));
  });
  uso.escrituras += ns.length;
}
// Órdenes de un folio (todas, también fuera de la ventana de 30 días)
async function ordenesDelFolio(db, folio) {
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where('folio', '==', String(folio))));
  uso.lecturas += Math.max(1, sn.size);
  return sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.quitadoEnPlanilla && o.estado !== 'anulada');
}
export async function folioUsado(folio) { const db = await dbOk(); return (await ordenesDelFolio(db, folio)).map(o => ({ n: o.n, cliente: o.cliente, clienteId: o.clienteId || null })); }
// Pago completo de un folio: todas sus órdenes quedan PAGADO con esa fecha
export async function registrarPago(folio, fechaPago) {
  const db = await dbOk();
  const os = (await ordenesDelFolio(db, folio)).filter(o => !/PAGADO/.test(o.estadoPago || ''));   // las ya pagadas (o archivadas) no se tocan
  if (!os.length) throw new Error('Ese folio no tiene órdenes por pagar.');
  const b = FB.writeBatch(db);
  os.forEach(o => b.update(FB.doc(db, 'ordenes', o.id), marcaCambio({ estadoPago: 'PAGADO', fechaPago: fechaPago || hoyTxt() })));
  await b.commit(); uso.escrituras += os.length;
  return os.length;
}
// Abono a un folio: queda en abonos; si con esto se completa el total, el folio queda PAGADO; si no, PARCIAL
export async function registrarAbono(folio, monto, fecha, referencia) {
  const db = await dbOk();
  const m = Math.round(Number(monto) || 0);
  if (!(m > 0)) throw new Error('Escribe el monto del abono.');
  const os = await ordenesDelFolio(db, folio);
  if (!os.length) throw new Error('No hay órdenes con ese folio.');
  const prev = await FB.getDocs(FB.query(FB.collection(db, 'abonos'), FB.where('folio', '==', String(folio))));
  uso.lecturas += Math.max(1, prev.size);
  const abonado = prev.docs.map(d => d.data()).filter(a => !a.quitadoEnPlanilla).reduce((s, a) => s + (Number(a.monto) || 0), 0) + m;
  const total = os.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const pagado = abonado >= total;
  const b = FB.writeBatch(db);
  b.set(FB.doc(FB.collection(db, 'abonos')), { folio: String(folio), fecha: fecha || hoyTxt(), monto: m, referencia: String(referencia || '').trim(), extra: {}, quitadoEnPlanilla: false, planillaPendiente: true, por: authSF.currentUser.email, en: FB.serverTimestamp() });
  os.filter(o => !/PAGADO/.test(o.estadoPago || '')).forEach(o => b.update(FB.doc(db, 'ordenes', o.id), marcaCambio(pagado ? { estadoPago: 'PAGADO', fechaPago: fecha || hoyTxt() } : { estadoPago: 'PARCIAL' })));
  await b.commit(); uso.escrituras += os.length + 1;
  return { pagado, saldo: Math.max(0, total - abonado) };
}
// Anular: no se borra; queda "anulada" con quién, cuándo y por qué (en la planilla pasa a "Ordenes anuladas")
export async function anularOrden(n, motivo) {
  const db = await dbOk();
  const mt = String(motivo || '').trim();
  if (mt.length < 3) throw new Error('Escribe el motivo.');
  await FB.runTransaction(db, async tx => {
    const ref = FB.doc(db, 'ordenes', String(n)), sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('La orden ya no existe.');
    if (sn.data().estado === 'anulada') throw new Error('Ya estaba anulada.');
    tx.update(ref, marcaCambio({ estado: 'anulada', anulada: { por: authSF.currentUser.email, en: ahoraTxt(), motivo: mt } }));
  });
  uso.escrituras++;
}

// ── Solicitudes de logística ───────────────────────
export async function aprobarSolicitud(s, precio, respuesta) {
  const db = await dbOk();
  const p = Math.round(Number(precio) || 0);
  if (!(p > 0) && s.tipo !== 'anulacion') throw new Error('Escribe el precio.');
  await FB.runTransaction(db, async tx => {
    const sref = FB.doc(db, 'solicitudes', s.id), ss = await tx.get(sref);
    if (!ss.exists() || ss.data().estado !== 'pendiente') throw new Error('Esa solicitud ya se resolvió.');
    if (s.tipo === 'anulacion') {
      const oref = FB.doc(db, 'ordenes', String(s.n)), os = await tx.get(oref);
      if (!os.exists()) throw new Error('La orden ya no existe.');
      if (os.data().estado !== 'anulada') tx.update(oref, marcaCambio({ estado: 'anulada', anulada: { por: authSF.currentUser.email, en: ahoraTxt(), motivo: `${s.nota || 'Sin motivo'} (pedido por ${s.por})`, solicitud: s.id } }));
    } else if (s.tipo === 'precio') {
      const cref = FB.doc(db, 'clientes', s.clienteId), cs = await tx.get(cref);
      if (!cs.exists()) throw new Error('El cliente ya no existe.');
      const lista = (cs.data().precios || []).filter(x => !((x.productoId && x.productoId === s.productoId) || String(x.producto).toLowerCase() === String(s.producto).toLowerCase()));
      lista.push({ producto: s.producto, productoId: s.productoId || null, precio: p });
      const previo = (cs.data().precios || []).find(x => (x.productoId && x.productoId === s.productoId) || String(x.producto).toLowerCase() === String(s.producto).toLowerCase());
      tx.update(cref, { precios: lista, historialPrecios: [...(cs.data().historialPrecios || []), { producto: s.producto, antes: previo ? previo.precio : null, despues: p, en: ahoraTxt(), por: authSF.currentUser.email, solicitud: s.id }].slice(-200), planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
    } else {
      // Producto nuevo: id a partir del nombre (sin pisar uno que exista)
      let id = slugB2B(s.producto), i = 2;
      while (true) {
        const ps = await tx.get(FB.doc(db, 'productos', id));
        if (!ps.exists()) break;
        if (String(ps.data().nombre || '').trim().toLowerCase() === String(s.producto || '').trim().toLowerCase()) throw new Error(`Ya existe el producto "${ps.data().nombre}". Si hay que cambiar su precio, hazlo en Productos y rechaza esta solicitud.`);
        id = slugB2B(s.producto) + '-' + i++;
      }
      tx.set(FB.doc(db, 'productos', id), { nombre: s.producto, precioBase: p, categoria: '', idReceta: s.idReceta || '', area: s.area || '', estado: 'activo', extra: {}, origen: { app: 'solicitud', solicitud: s.id }, quitadoEnPlanilla: false, planillaPendiente: true, creadoEn: FB.serverTimestamp(), creadoPor: authSF.currentUser.email });
    }
    tx.update(sref, { estado: 'aprobada', precioAprobado: s.tipo === 'anulacion' ? null : p, respuesta: String(respuesta || '').trim() || null, resuelta: { por: authSF.currentUser.email, en: FB.serverTimestamp() } });
  });
  uso.escrituras += 2;
}
export async function rechazarSolicitud(s, respuesta) {
  const db = await dbOk();
  await FB.updateDoc(FB.doc(db, 'solicitudes', s.id), { estado: 'rechazada', respuesta: String(respuesta || '').trim() || null, resuelta: { por: authSF.currentUser.email, en: FB.serverTimestamp() } });
  uso.escrituras++;
}
const slugB2B = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'producto';

// Cliente nuevo (mientras llega la administración completa del catálogo)
export async function nuevoCliente(c) {
  const db = await dbOk();
  const nombre = String(c.nombre || '').trim();
  if (nombre.length < 2) throw new Error('Escribe el nombre del cliente.');
  const base = slugB2B(nombre);
  return FB.runTransaction(db, async tx => {
    let id = base, i = 2;
    while (true) {
      const sn = await tx.get(FB.doc(db, 'clientes', id));
      if (!sn.exists()) break;
      if (String(sn.data().nombre || '').toLowerCase().trim() === nombre.toLowerCase()) throw new Error('Ya existe un cliente con ese nombre.');
      id = base + '-' + i++;
    }
    const t = k => String(c[k] || '').trim();
    tx.set(FB.doc(db, 'clientes', id), { nombre, rut: t('rut'), razonSocial: t('razonSocial'), giro: t('giro'), direccion: t('direccion'), correo: t('correo'), telefono: t('telefono'), contacto: t('contacto'),
      facturacion: c.facturacion || 'Diaria', frecuenciaPago: c.frecuenciaPago || 'Diaria', precios: [], estado: 'activo', extra: {}, origen: { app: 'sistema-fen' }, quitadoEnPlanilla: false, planillaPendiente: true, creadoEn: FB.serverTimestamp(), creadoPor: authSF.currentUser.email });
    return id;
  });
}

// Para el PDF de una orden: el cliente y el historial de ediciones
export async function datosPdf(o) {
  const db = await dbOk();
  let cliente = { nombre: o.cliente };
  if (o.clienteId) { const c = await FB.getDoc(FB.doc(db, 'clientes', o.clienteId)); uso.lecturas++; if (c.exists()) cliente = c.data(); }
  let ediciones = [];
  if (o.editada || o.revisar) {
    const sn = await FB.getDocs(FB.query(FB.collection(db, 'ediciones'), FB.where('n', '==', Number(o.n))));
    uso.lecturas += Math.max(1, sn.size);
    ediciones = sn.docs.map(d => d.data()).filter(e => !e.quitadoEnPlanilla).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }
  let originales = {};
  const e0 = ediciones.find(e => e.cambios && /"antes"/.test(e.cambios));
  if (e0) { try { (JSON.parse(e0.cambios).antes || []).forEach(l => { originales[l.producto] = (originales[l.producto] || 0) + l.cantidad; }); } catch (x) {} }
  return { cliente, ediciones, originales };
}

// ═══════════════════════════════════════════════
//  v0.13.0 · Catálogo (clientes, productos, precios especiales) y estado de cuenta
//  El nombre no se cambia: las órdenes y la planilla se ubican por nombre.
//  Nada se borra: clientes y productos se archivan (logística deja de verlos).
//  Cada cambio de precio queda en historialPrecios del cliente o del producto.
// ═══════════════════════════════════════════════
const TXT = ['rut', 'razonSocial', 'giro', 'direccion', 'correo', 'telefono', 'contacto'];
export const FACTURACION = ['Diaria', 'Semanal', 'Mensual'];
export const FRECUENCIA = ['Diaria', 'Semanal', 'Mensual', '30dias'];
export async function guardarCliente(id, datos) {
  const db = await dbOk();
  const cambios = {};
  TXT.forEach(k => { if (k in datos) cambios[k] = String(datos[k] || '').trim(); });
  if (datos.facturacion) { if (!FACTURACION.includes(datos.facturacion)) throw new Error('Facturación no válida.'); cambios.facturacion = datos.facturacion; }
  if (datos.frecuenciaPago) { if (!FRECUENCIA.includes(datos.frecuenciaPago)) throw new Error('Frecuencia no válida.'); cambios.frecuenciaPago = datos.frecuenciaPago; }
  await FB.updateDoc(FB.doc(db, 'clientes', id), { ...cambios, planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
  uso.escrituras++;
}
export async function archivarCliente(id, archivar) {
  const db = await dbOk();
  await FB.updateDoc(FB.doc(db, 'clientes', id), { estado: archivar ? 'archivado' : 'activo', planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
  uso.escrituras++;
}
// Precio especial: precio > 0 lo pone o lo cambia; precio 0 o vacío lo quita (vuelve al precio base)
export async function precioEspecial(clienteId, producto, precio) {
  const db = await dbOk();
  const p = Math.round(Number(precio) || 0);
  await FB.runTransaction(db, async tx => {
    const ref = FB.doc(db, 'clientes', clienteId), sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('El cliente ya no existe.');
    const c = sn.data(), igual = x => (x.productoId && x.productoId === producto.id) || String(x.producto).toLowerCase() === String(producto.nombre).toLowerCase();
    const previo = (c.precios || []).find(igual);
    if ((previo ? previo.precio : 0) === p) return;
    const lista = (c.precios || []).filter(x => !igual(x));
    if (p > 0) lista.push({ producto: producto.nombre, productoId: producto.id || null, precio: p });
    lista.sort((a, b) => String(a.producto).localeCompare(String(b.producto), 'es'));
    tx.update(ref, { precios: lista, historialPrecios: [...(c.historialPrecios || []), { producto: producto.nombre, antes: previo ? previo.precio : null, despues: p > 0 ? p : null, en: ahoraTxt(), por: authSF.currentUser.email }].slice(-200),
      planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
  });
  uso.escrituras++;
}
export async function guardarProducto(id, datos) {
  const db = await dbOk();
  if (!id) {
    const nombre = String(datos.nombre || '').trim();
    if (nombre.length < 2) throw new Error('Escribe el nombre del producto.');
    const p = Math.round(Number(datos.precioBase) || 0);
    if (!(p > 0)) throw new Error('Escribe el precio base.');
    return FB.runTransaction(db, async tx => {
      let nid = slugB2B(nombre), i = 2;
      while (true) {
        const sn = await tx.get(FB.doc(db, 'productos', nid));
        if (!sn.exists()) break;
        if (String(sn.data().nombre || '').toLowerCase().trim() === nombre.toLowerCase()) throw new Error('Ya existe un producto con ese nombre.');
        nid = slugB2B(nombre) + '-' + i++;
      }
      tx.set(FB.doc(db, 'productos', nid), { nombre, precioBase: p, categoria: String(datos.categoria || '').trim(), idReceta: String(datos.idReceta || '').trim(), area: String(datos.area || '').trim(), estado: 'activo', extra: {}, origen: { app: 'sistema-fen' },
        quitadoEnPlanilla: false, planillaPendiente: true, creadoEn: FB.serverTimestamp(), creadoPor: authSF.currentUser.email });
      return nid;
    });
  }
  await FB.runTransaction(db, async tx => {
    const ref = FB.doc(db, 'productos', id), sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('El producto ya no existe.');
    const a = sn.data(), cambios = {};
    ['categoria', 'idReceta', 'area'].forEach(k => { if (k in datos) cambios[k] = String(datos[k] || '').trim(); });
    if ('precioBase' in datos) {
      const p = Math.round(Number(datos.precioBase) || 0);
      if (!(p > 0)) throw new Error('El precio base debe ser mayor que 0.');
      if (p !== Number(a.precioBase)) { cambios.precioBase = p; cambios.historialPrecios = [...(a.historialPrecios || []), { antes: Number(a.precioBase) || null, despues: p, en: ahoraTxt(), por: authSF.currentUser.email }].slice(-200); }
    }
    tx.update(ref, { ...cambios, planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
  });
  uso.escrituras++;
}
export async function archivarProducto(id, archivar) {
  const db = await dbOk();
  await FB.updateDoc(FB.doc(db, 'productos', id), { estado: archivar ? 'archivado' : 'activo', planillaPendiente: true, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
  uso.escrituras++;
}

// ── Estado de cuenta ───────────────────────────────
// Todas las órdenes de un cliente (también archivadas), sin anuladas ni quitadas
export async function ordenesDeCliente(clienteId) {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where('clienteId', '==', clienteId)));
  uso.lecturas += Math.max(1, sn.size);
  const os = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.quitadoEnPlanilla && o.estado !== 'anulada');
  // Un folio con abonos que incluye órdenes de otro cliente: el saldo se reparte sobre el total de todo el folio
  const parciales = [...new Set(os.filter(o => o.folio && String(o.estadoPago || '').toUpperCase() === 'PARCIAL').map(o => String(o.folio)))];
  for (const f of parciales) {
    const t = (await ordenesDelFolio(db, f)).reduce((s, o) => s + (Number(o.total) || 0), 0);
    os.forEach(o => { if (String(o.folio) === f) o._totalFolio = t; });
  }
  return os;
}
// Saldo como la app B2B: pagado = 0; parcial = (total del folio − abonos) repartido por el peso de la orden
export function estadoDeCuenta(ordenes, abonos, desde, hasta, modo) {
  const os = ordenes.filter(o => (!desde || o.fecha >= desde) && (!hasta || o.fecha <= hasta)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.n - b.n);
  const porFolio = {};
  ordenes.forEach(o => { if (o.folio) (porFolio[o.folio] = porFolio[o.folio] || []).push(o); });
  const abonado = f => abonos.filter(a => String(a.folio) === String(f)).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const ultimoAbono = f => abonos.filter(a => String(a.folio) === String(f)).map(a => a.fecha).sort().pop() || null;
  const totalFolio = f => (porFolio[f] || []).reduce((s, o) => s + o.total, 0);
  const saldo = o => {
    const e = String(o.estadoPago || '').toUpperCase();
    if (e.includes('PAGADO')) return 0;
    if (!o.folio || e !== 'PARCIAL') return o.total;
    const t = o._totalFolio || totalFolio(o.folio); if (t <= 0) return 0;
    return Math.round(Math.max(0, t - abonado(o.folio)) * o.total / t);
  };
  let filas;
  if (modo === 'folio') {
    const grupos = {}, sueltas = [];
    os.forEach(o => { if (o.folio) (grupos[o.folio] = grupos[o.folio] || []).push(o); else sueltas.push(o); });
    filas = Object.keys(grupos).map(f => {
      const l = grupos[f], total = l.reduce((s, o) => s + o.total, 0), sal = l.reduce((s, o) => s + saldo(o), 0);
      const est = l.some(o => !/PAGADO|PARCIAL/.test(String(o.estadoPago || '').toUpperCase())) ? 'PENDIENTE' : l.some(o => String(o.estadoPago).toUpperCase() === 'PARCIAL') ? 'PARCIAL' : 'PAGADO';
      return { principal: f, secundaria: l.map(o => o.n).join(', '), fecha: l.map(o => o.fechaFolio).filter(Boolean).sort()[0] || l[0].fecha, neto: l.reduce((s, o) => s + o.neto, 0), total, saldo: sal, abonado: est === 'PARCIAL' ? total - sal : 0, ultimoAbono: est === 'PARCIAL' ? ultimoAbono(f) : null, estado: est, fechaPago: l.map(o => o.fechaPago).filter(Boolean).sort().pop() || null };
    }).concat(sueltas.map(o => { const e = String(o.estadoPago || 'PENDIENTE').toUpperCase(), pag = e.includes('PAGADO'); return { principal: 'Sin folio', secundaria: String(o.n), fecha: o.fecha, neto: o.neto, total: o.total, saldo: saldo(o), abonado: 0, estado: pag ? 'PAGADO' : 'PENDIENTE', fechaPago: pag ? o.fechaPago : null }; }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  } else {
    filas = os.map(o => { const e = String(o.estadoPago || 'PENDIENTE').toUpperCase(), sal = saldo(o); return { principal: String(o.n), secundaria: o.folio || 'Pendiente', fecha: o.fecha, neto: o.neto, total: o.total, saldo: sal, abonado: e === 'PARCIAL' ? o.total - sal : 0, ultimoAbono: e === 'PARCIAL' && o.folio ? ultimoAbono(o.folio) : null, estado: e.includes('PAGADO') ? 'PAGADO' : e, fechaPago: o.fechaPago }; });
  }
  const comprado = os.reduce((s, o) => s + o.total, 0), pendiente = os.reduce((s, o) => s + saldo(o), 0);
  return { filas, n: os.length, comprado, pagado: comprado - pendiente, pendiente };
}

// ── Para Hoy: solicitudes de logística sin responder (solo si la base nueva está conectada y en uso; no pide nada) ──
export async function solicitudesParaHoy() {
  let cx;
  try { cx = await conexion(); } catch (e) { return null; }
  if (cx.estado !== 'ok') return null;
  const cfg = await FB.getDoc(FB.doc(cx.db, 'config', 'b2b')); uso.lecturas++;
  if (!cfg.exists() || !cfg.data().activa) return null;
  const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'solicitudes'), FB.where('estado', '==', 'pendiente')));
  uso.lecturas += Math.max(1, sn.size);
  return sn.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Por facturar: lo que ya corresponde facturar según la modalidad del cliente ──
// Diaria: órdenes de días anteriores · Semanal: de semanas anteriores (lunes a domingo) · Mensual: de meses anteriores
export function correspondeFacturar(facturacion, fecha, hoy = hoyTxt()) {
  if (!fecha) return false;
  const f = String(facturacion || '').trim().toLowerCase();   // la planilla puede traer "semanal", "Mensual ", etc.
  if (/^seman/.test(f)) { const d = new Date(hoy + 'T12:00:00'), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return fecha < hoyTxt(d); }
  if (/^mensu/.test(f)) return fecha.slice(0, 7) < hoy.slice(0, 7);
  return fecha < hoy;
}

// ═══════════════════════════════════════════════
//  v0.13.2 · Cuánto aporta cada cliente y cómo paga
// ═══════════════════════════════════════════════
// Órdenes de los últimos 6 meses (para el análisis). Se guardan 6 horas en este equipo para no releer.
const K_ANALISIS = 'fen_b2b_analisis';
let cacheAnalisis = null;
export async function ordenesParaAnalisis(forzar) {
  const db = await dbOk();
  const ahora = Date.now();
  if (!forzar && !cacheAnalisis) { try { const c = JSON.parse(localStorage.getItem(K_ANALISIS) || 'null'); if (c && c.v === 1) cacheAnalisis = c; } catch (e) {} }
  if (!forzar && cacheAnalisis && ahora - cacheAnalisis.en < 6 * 3600e3) return cacheAnalisis;
  const h = new Date(), desde = hoyTxt(new Date(h.getFullYear(), h.getMonth() - 6, 1));
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where('fecha', '>=', desde)));
  uso.lecturas += Math.max(1, sn.size);
  const campos = ['n', 'fecha', 'cliente', 'clienteId', 'neto', 'total', 'folio', 'fechaFolio', 'estadoPago', 'fechaPago', 'estado', 'quitadoEnPlanilla'];
  const ordenes = sn.docs.map(d => { const x = d.data(), o = { id: d.id }; campos.forEach(k => { if (x[k] !== undefined) o[k] = x[k]; }); return o; })
    .filter(o => !o.quitadoEnPlanilla && o.estado !== 'anulada');
  cacheAnalisis = { v: 1, en: ahora, desde, ordenes };
  try { localStorage.setItem(K_ANALISIS, JSON.stringify(cacheAnalisis)); } catch (e) {}
  return cacheAnalisis;
}
export function olvidarAnalisis() { cacheAnalisis = null; try { localStorage.removeItem(K_ANALISIS); } catch (e) {} }

const fechaDe = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? m[0] : null; };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
export const CORTES_PAGO = { verde: 7, amarillo: 30 };   // días: hasta 7 al día, hasta 30 más tarde, más de 30 tarde
const ACORDADO = { diaria: 0, semanal: 7, mensual: 30, '30dias': 30 };
// ordenes: las de 6 meses (y además las pendientes de cualquier fecha); abonos: todos. Montos de compra en NETO.
export function analisisClientes(ordenes, abonos, clientes, hoy = hoyTxt()) {
  const mesDe = (k) => { const [y, m] = hoy.split('-').map(Number), d = new Date(y, m - 1 - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const m1 = mesDe(1), m3 = [mesDe(1), mesDe(2), mesDe(3)], mPrev = [mesDe(2), mesDe(3), mesDe(4)];
  const norm = t => String(t || '').trim().toLowerCase();
  const porNombre = {}; clientes.forEach(c => { porNombre[norm(c.nombre)] = c.id; });
  const idDe = o => o.clienteId || porNombre[norm(o.cliente)] || 'nombre:' + norm(o.cliente);
  const abonadoFolio = {}, ultAbono = {};
  abonos.forEach(a => { const f = String(a.folio); abonadoFolio[f] = (abonadoFolio[f] || 0) + (Number(a.monto) || 0); const fa = fechaDe(a.fecha); if (fa && (!ultAbono[f] || fa > ultAbono[f])) ultAbono[f] = fa; });
  const R = {};
  const r = id => R[id] || (R[id] = { meses: {}, dias: new Set(), pagos: [], pendientes: {}, ultimaCompra: null });
  const vistos = new Set();
  ordenes.forEach(o => {
    if (vistos.has(String(o.n))) return; vistos.add(String(o.n));
    const x = r(idDe(o)), f = fechaDe(o.fecha), neto = Number(o.neto) || 0;
    if (f) { x.meses[f.slice(0, 7)] = (x.meses[f.slice(0, 7)] || 0) + neto; x.dias.add(f); if (!x.ultimaCompra || f > x.ultimaCompra) x.ultimaCompra = f; }
    const ff = fechaDe(o.fechaFolio), e = String(o.estadoPago || '').toUpperCase();
    if (o.folio && !e.includes('PAGADO')) { const k = String(o.folio), p = x.pendientes[k] || (x.pendientes[k] = { folio: k, total: 0, desde: ff || f }); p.total += Number(o.total) || 0; if ((ff || f) && (ff || f) < p.desde) p.desde = ff || f; }
    if (o.folio && e.includes('PAGADO') && ff) { const fp = fechaDe(o.fechaPago); if (fp && diasEntre(ff, hoy) <= 190) x.pagos.push({ folio: String(o.folio), dias: Math.max(0, diasEntre(ff, fp)), peso: Number(o.total) || 0 }); }
  });
  const totalProm = Object.values(R).reduce((s, x) => s + m3.reduce((t, m) => t + (x.meses[m] || 0), 0) / 3, 0);
  const color = d => d == null ? null : d <= CORTES_PAGO.verde ? 'verde' : d <= CORTES_PAGO.amarillo ? 'amarillo' : 'rojo';
  const peor = (a, b) => ['rojo', 'amarillo', 'verde'].find(c => c === a || c === b) || null;
  const out = {};
  Object.entries(R).forEach(([id, x]) => {
    const mesAnt = x.meses[m1] || 0, prom3 = m3.reduce((s, m) => s + (x.meses[m] || 0), 0) / 3, previo = mPrev.reduce((s, m) => s + (x.meses[m] || 0), 0) / 3;
    const tend = previo > 0 && mesAnt > previo * 1.2 ? 'sube' : previo > 0 && mesAnt < previo * 0.8 ? 'baja' : null;
    // Cómo paga: promedio de días folio → pago, ponderado por monto (un folio cuenta una vez)
    const porFolio = {}; x.pagos.forEach(p => { const q = porFolio[p.folio] || (porFolio[p.folio] = { dias: p.dias, peso: 0 }); q.peso += p.peso; q.dias = Math.max(q.dias, p.dias); });
    const fs = Object.values(porFolio), pesoT = fs.reduce((s, p) => s + (p.peso || 1), 0);
    const diasPago = fs.length ? Math.round(fs.reduce((s, p) => s + p.dias * (p.peso || 1), 0) / pesoT) : null;
    // Cómo está hoy: lo que debe y el folio pendiente más antiguo
    const pend = Object.values(x.pendientes).map(p => ({ ...p, saldo: Math.max(0, p.total - (abonadoFolio[p.folio] || 0)), dias: p.desde ? Math.max(0, diasEntre(p.desde, hoy)) : 0 })).filter(p => p.saldo > 0);
    const deuda = pend.reduce((s, p) => s + p.saldo, 0), masAntiguo = pend.sort((a, b) => b.dias - a.dias)[0] || null;
    const cHist = color(diasPago), cHoy = masAntiguo ? color(masAntiguo.dias) : null;
    const semaforo = peor(cHist, cHoy) || (diasPago == null && !masAntiguo ? 'gris' : 'verde');
    // Dejó de comprar: intervalo típico (mediana entre días de compra) y días sin comprar
    const dias = [...x.dias].sort(), gaps = dias.slice(1).map((d, i) => diasEntre(dias[i], d)).sort((a, b) => a - b);
    const intervalo = gaps.length >= 3 ? gaps[Math.floor(gaps.length / 2)] : null;
    const diasSin = x.ultimaCompra ? diasEntre(x.ultimaCompra, hoy) : null;
    const dejo = intervalo != null && diasSin != null && diasSin > Math.max(intervalo * 2, intervalo + 7);
    const cl = clientes.find(c => c.id === id);
    const acordado = cl ? ACORDADO[norm(cl.frecuenciaPago)] : undefined;
    out[id] = { mesAnt, prom3, tend, peso: totalProm > 0 ? prom3 / totalProm : 0, diasPago, nFolios: fs.length, deuda, masAntiguo, nPendientes: pend.length, semaforo, cHist, cHoy, acordado, ultimaCompra: x.ultimaCompra, intervalo, diasSin, dejo };
  });
  return { porCliente: out, meses: { m1, m3 } };
}
// "Ya lo revisé": el aviso de Dejó de comprar se calla hasta que el cliente vuelva a comprar
export async function revisarDejoDeComprar(clienteId, ultimaCompra, nota) {
  const db = await dbOk();
  await FB.updateDoc(FB.doc(db, 'clientes', clienteId), { avisoCompra: { revisado: ahoraTxt(), ultimaCompra: ultimaCompra || null, nota: String(nota || '').trim().slice(0, 200) || null, por: authSF.currentUser.email } });
  uso.escrituras++;
}
export const dejoVigente = (cliente, a) => !!(a && a.dejo && cliente && cliente.estado !== 'archivado' && !(cliente.avisoCompra && cliente.avisoCompra.ultimaCompra === a.ultimaCompra));
// Para Hoy: clientes que dejaron de comprar (sin "Ya lo revisé"). Solo con la base nueva en uso; no pide nada.
export async function dejoDeComprarParaHoy() {
  let cx;
  try { cx = await conexion(); } catch (e) { return null; }
  if (cx.estado !== 'ok') return null;
  const cfg = await FB.getDoc(FB.doc(cx.db, 'config', 'b2b')); uso.lecturas++;
  if (!cfg.exists() || !cfg.data().activa) return null;
  const [an, cs] = await Promise.all([ordenesParaAnalisis(false), FB.getDocs(FB.collection(cx.db, 'clientes'))]);
  uso.lecturas += Math.max(1, cs.size);
  const clientes = cs.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.quitadoEnPlanilla);
  const r = analisisClientes(an.ordenes, [], clientes);
  return clientes.filter(c => dejoVigente(c, r.porCliente[c.id])).map(c => ({ id: c.id, nombre: c.nombre, diasSin: r.porCliente[c.id].diasSin, intervalo: r.porCliente[c.id].intervalo }))
    .sort((a, b) => b.diasSin - a.diasSin);
}

// ═══════════════════════════════════════════════
//  v0.14.0 · Conciliación bancaria con la cartola (BancoEstado, Chequera Electrónica)
// ═══════════════════════════════════════════════
// Lo mismo que hacía la app B2B, ahora con la base nueva:
//  · cada abono de la cartola se identifica por su "huella" (fecha|saldo|monto|descripción), igual que antes,
//    así lo ya conciliado en la app antigua no se vuelve a mostrar.
//  · el cliente se reconoce por lo aprendido, por el RUT de la descripción o por su nombre/razón social.
//  · la propuesta se calcula cada vez con los folios por cobrar de ese momento (nunca queda vieja).
export const normCartola = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const normRut = s => String(s || '').toUpperCase().replace(/[^0-9K]/g, '');
export function montoCartola(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const n = parseFloat(String(v).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n);
}
function fechaCartolaISO(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  const t = String(v).trim(), m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : t;
}
// Histórica: la hoja Movimientos trae "DD/MM"; el año sale de "Fecha Inicio" (si cruza de diciembre a enero, suma 1)
function fechaConAnio(ddmm, inicio) {
  const d = String(ddmm || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/), i = String(inicio || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!d || !i) return '';
  const anio = Number(d[2]) < Number(i[2]) ? Number(i[3]) + 1 : Number(i[3]);
  return `${anio}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
}
function campoResumen(filas, etiqueta) {
  for (const f of filas) if (String(f[0] || '').trim().toLowerCase() === etiqueta.toLowerCase()) { const v = f.find((c, i) => i > 0 && String(c || '').trim()); if (v) return String(v).trim(); }
  return null;
}
// wb: libro leído con SheetJS (XLSX.read(buf, { type: 'array', cellDates: true }))
export function leerCartola(wb, XLSX) {
  const resumen = wb.SheetNames.includes('Resumen') ? XLSX.utils.sheet_to_json(wb.Sheets['Resumen'], { header: 1, defval: '' }) : [];
  const desc = r => String(r['Descripción'] || r['Descripcion'] || '').trim();
  let filas, identificador, tipo;
  if (wb.SheetNames.includes('Movimientos')) {
    tipo = 'historica';
    const inicio = campoResumen(resumen, 'Fecha Inicio');
    filas = XLSX.utils.sheet_to_json(wb.Sheets['Movimientos'], { defval: '' }).map(r => ({ fecha: fechaConAnio(r['Fecha'], inicio), descripcion: desc(r), cargos: montoCartola(r['Cheques / Cargos']), abonos: montoCartola(r['Depósitos / Abonos']), saldo: montoCartola(r['Saldo']) })).filter(f => f.descripcion);
    if (filas.some(f => f.abonos > 0 && !f.fecha)) throw new Error('No se pudo saber el año de las fechas (falta "Fecha Inicio" en la hoja Resumen).');
    identificador = `Histórica N°${campoResumen(resumen, 'N° Cartola') || '?'} (${inicio || '?'} a ${campoResumen(resumen, 'Fecha Final') || '?'})`;
  } else {
    tipo = 'enlinea';
    const hoja = wb.SheetNames.includes('Registros') ? 'Registros' : wb.SheetNames[0];
    filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '' }).map(r => ({ fecha: fechaCartolaISO(r['Fecha']), descripcion: desc(r), cargos: montoCartola(r['Cargos']), abonos: montoCartola(r['Abonos']), saldo: montoCartola(r['Saldo']) })).filter(f => f.descripcion && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha));
    let gen = null;
    resumen.forEach(f => f.forEach(c => { const m = String(c || '').match(/Fecha\s*-\s*Hora\s+(\d{2}\/\d{2}\/\d{4})-(\d{2}:\d{2})/); if (m) gen = m[1] + ' ' + m[2]; }));
    const fs = filas.map(f => f.fecha).sort();
    identificador = gen ? 'En línea generada ' + gen : `En línea (${fs[0] || '?'} a ${fs[fs.length - 1] || '?'})`;
  }
  if (!filas.length) throw new Error('El archivo no tiene movimientos. ¿Es la cartola de BancoEstado (histórica o en línea)?');
  return { tipo, identificador, filas };
}
export const huellaMovimiento = f => `${f.fecha}|${f.saldo}|${f.abonos}|${normCartola(f.descripcion)}`;
export async function idMovimiento(huella) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(huella));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
const CONC_DEF = { ignorar: ['TRANSBANK'], equivalencias: [] };
export const configConciliacion = c => ({ ...CONC_DEF, ...(c || {}), ignorar: (c && c.ignorar) || CONC_DEF.ignorar, equivalencias: (c && c.equivalencias) || [] });

// Guarda los abonos nuevos de la cartola como "pendientes" (los ya vistos no se repiten)
export async function cargarCartola(cartola, conf) {
  const db = await dbOk();
  const c = configConciliacion(conf), ign = c.ignorar.map(normCartola).filter(Boolean);
  const r = { abonos: 0, nuevos: 0, yaVistos: 0, ignorados: 0, cargos: 0, identificador: cartola.identificador };
  const cand = [];
  cartola.filas.forEach((f, i) => {
    if (!(f.abonos > 0)) { r.cargos++; return; }
    r.abonos++;
    const dn = normCartola(f.descripcion);
    if (ign.some(p => dn.includes(p))) { r.ignorados++; return; }
    cand.push({ f, i, huella: huellaMovimiento(f) });
  });
  const ids = await Promise.all(cand.map(x => idMovimiento(x.huella)));
  const sns = await Promise.all(ids.map(id => FB.getDoc(FB.doc(db, 'movimientos', id))));
  uso.lecturas += ids.length;
  const porEscribir = [];
  cand.forEach((x, k) => {
    if (sns[k].exists()) { r.yaVistos++; return; }
    r.nuevos++;
    porEscribir.push([ids[k],  { huella: x.huella, fecha: x.f.fecha, descripcion: x.f.descripcion, descNorm: normCartola(x.f.descripcion), monto: x.f.abonos, saldo: x.f.saldo, orden: x.i,
      cartola: cartola.identificador, estado: 'pendiente', origen: 'sistema-fen', cargado: { por: authSF.currentUser.email, en: FB.serverTimestamp() }, planillaPendiente: false }]);
  });
  for (let i = 0; i < porEscribir.length; i += 400) { const b = FB.writeBatch(db); porEscribir.slice(i, i + 400).forEach(([id, d]) => b.set(FB.doc(db, 'movimientos', id), d)); await b.commit(); uso.escrituras += Math.min(400, porEscribir.length - i); }
  return r;
}

// ── A quién corresponde y cómo repartir cada abono ──
const fechaDMY = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : (f || ''); };
const PREFIJOS = /^(TEF( BANCOESTADO)?( DE)+|TRANSF(ERENCIA)?( DE)+|TRASPASO( DE)+|DEP(OSITO)?( DE)?|ABONO( DE)?)\s*/;
export function identificarCliente(mov, clientes, equivalencias) {
  const dn = mov.descNorm || normCartola(mov.descripcion);
  const eq = (equivalencias || []).find(e => e.desc === dn);
  if (eq) { const c = clientes.find(x => x.id === eq.clienteId); if (c) return { cliente: c, por: 'aprendido' }; }
  const m = String(mov.descripcion || '').toUpperCase().match(/(?<!\d)(\d{7,8})-?([0-9K])\b/);
  if (m && dvRut(m[1]) === m[2]) { const rut = m[1] + m[2], c = clientes.find(x => normRut(x.rut) === rut); if (c) return { cliente: c, por: 'rut' }; }
  // Por nombre o razón social, con palabras completas. Si el banco cortó la descripción (35 letras),
  // basta que el pagador sea el comienzo del nombre, pero eso nunca se confirma solo (queda para revisar).
  const pagador = dn.replace(PREFIJOS, '').trim(), cortada = String(mov.descripcion || '').trim().length >= 34;
  const conPalabras = (txt, n) => (' ' + txt + ' ').includes(' ' + n + ' ');
  let mejor = null, largo = 0, empate = false, seguro = false;
  clientes.forEach(c => [normCartola(c.nombre), normCartola(c.razonSocial)].forEach(n => {
    if (!n || n.length < 4) return;
    const entero = conPalabras(dn, n), prefijo = cortada && pagador.length >= 10 && n.startsWith(pagador) && (n.length === pagador.length || n[pagador.length] === ' ' || conPalabras(n, pagador.split(' ').slice(0, -1).join(' ')));
    if (!entero && !prefijo) return;
    const l = entero ? n.length : pagador.length;
    if (l > largo) { mejor = c; largo = l; empate = false; seguro = entero && n.length >= 8; } else if (l === largo && mejor && mejor.id !== c.id) empate = true;
  }));
  return mejor && !empate ? { cliente: mejor, por: seguro ? 'nombre' : 'nombre-parcial' } : null;
}
// Dígito verificador de un RUT chileno
function dvRut(num) { let s = 0, m = 2; for (let i = String(num).length - 1; i >= 0; i--) { s += Number(String(num)[i]) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); }
// Folios por cobrar de cada cliente, con su saldo (total − abonos), del más antiguo al más nuevo
export function foliosPorCobrar(ordenes, abonos, clientes) {
  const norm = t => String(t || '').trim().toLowerCase(), porNombre = {};
  clientes.forEach(c => { porNombre[norm(c.nombre)] = c.id; });
  const ab = {}; abonos.forEach(a => { ab[String(a.folio)] = (ab[String(a.folio)] || 0) + (Number(a.monto) || 0); });
  const F = {}, vistos = new Set();
  ordenes.forEach(o => {
    if (vistos.has(String(o.n))) return; vistos.add(String(o.n));
    if (!o.folio || o.estado === 'anulada' || o.quitadoEnPlanilla || /PAGADO/.test(String(o.estadoPago || '').toUpperCase())) return;
    const k = String(o.folio), f = F[k] || (F[k] = { folio: k, total: 0, ordenes: [], clienteId: o.clienteId || porNombre[norm(o.cliente)] || null, cliente: o.cliente, fecha: fechaDe(o.fechaFolio) || fechaDe(o.fecha) || '' });
    f.total += Number(o.total) || 0; f.ordenes.push(o.n);
  });
  const out = {};
  Object.values(F).forEach(f => { f.abonado = ab[f.folio] || 0; f.saldo = Math.max(0, Math.round(f.total - f.abonado)); if (f.saldo > 0 && f.clienteId) (out[f.clienteId] = out[f.clienteId] || []).push(f); });
  Object.values(out).forEach(l => l.sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(a.folio) - Number(b.folio)));
  return out;
}
// Reparto sugerido: primero los folios más antiguos completos; lo que sobra, como abono al siguiente
export function repartoFIFO(folios, monto) {
  let resto = monto; const a = [];
  for (const f of folios) { if (resto <= 0) break; const m = Math.min(resto, f.saldo); a.push({ folio: f.folio, monto: m }); resto -= m; }
  return { asignaciones: a, sobra: Math.max(0, resto) };
}
// Todas las combinaciones de folios que suman exacto (hasta 16 folios)
function combinacionesExactas(folios, monto) {
  if (folios.length > 12) return [];   // con muchos folios no se busca: se propone por antigüedad y se revisa
  const n = folios.length, out = [];
  for (let m = 1; m < (1 << n) && out.length < 50; m++) { let s = 0, edad = 0; for (let i = 0; i < n; i++) if (m & (1 << i)) { s += folios[i].saldo; edad += i; } if (s === monto) out.push({ edad, l: folios.filter((_, i) => m & (1 << i)) }); }
  return out.sort((a, b) => a.edad - b.edad).map(x => x.l);   // primero la de los folios más antiguos
}
// mov: movimientos pendientes (en orden); ctx: { clientes, ordenes, abonos, equivalencias, pagados: [{clienteId, total, fechaPago, folio}] }
export function proponer(movs, ctx) {
  const porCobrar = foliosPorCobrar(ctx.ordenes, ctx.abonos, ctx.clientes), reservados = new Set(), out = {};
  movs.forEach(mv => {
    const forz = ctx.forzados && ctx.forzados[mv.id] && ctx.clientes.find(c => c.id === ctx.forzados[mv.id]);
    const id = forz ? { cliente: forz, por: 'manual' } : identificarCliente(mv, ctx.clientes, ctx.equivalencias);
    if (!id) { out[mv.id] = { tipo: 'sinCliente' }; return; }
    const c = id.cliente, folios = (porCobrar[c.id] || []).filter(f => !reservados.has(f.folio));
    const base = { clienteId: c.id, cliente: c.nombre, por: id.por, folios };
    // ¿Ya se registró a mano un pago del mismo monto, cerca de esa fecha?
    // (igual que antes: un pago registrado con el mismo monto hace dudar, aunque se haya anotado días después)
    const yaPagado = (ctx.pagados || []).filter(p => p.clienteId === c.id && Math.round(p.total) === mv.monto && p.fechaPago && Math.abs(diasEntre(p.fechaPago, mv.fecha)) <= 60).sort((a, b) => Math.abs(diasEntre(a.fechaPago, mv.fecha)) - Math.abs(diasEntre(b.fechaPago, mv.fecha)))[0] || null;
    if (!folios.length) { out[mv.id] = { ...base, tipo: 'revisar', motivo: yaPagado ? `Parece el pago del folio ${yaPagado.folio}, que ya está registrado (pagado el ${fechaDMY(yaPagado.fechaPago)}).` : 'No tiene folios por cobrar.', yaPagado, asignaciones: [], sobra: mv.monto }; return; }
    const exactos = folios.filter(f => f.saldo === mv.monto), comb = exactos.length ? [] : combinacionesExactas(folios, mv.monto);
    let asign = null, motivo = '';
    if (exactos.length) { asign = [exactos[0]]; motivo = exactos.length > 1 ? `Hay ${exactos.length} folios con ese mismo saldo: se propone el más antiguo.` : 'Calza exacto con un folio.'; }
    else if (comb.length) { asign = comb[0]; motivo = comb.length > 1 ? 'Más de una combinación de folios suma ese monto: se propone la de los más antiguos.' : `Paga ${asign.length} folios juntos.`; }
    // Se confirma sola solo si no hay ninguna duda: una sola forma de calzar exacto y ningún pago igual ya registrado
    const unica = exactos.length === 1 || (!exactos.length && comb.length === 1);
    const seguro = id.por !== 'nombre-parcial';
    if (!seguro && !motivo) motivo = 'El nombre se reconoció solo en parte (el banco corta la descripción): confirma que es este cliente.';
    else if (!seguro) motivo = 'El nombre se reconoció solo en parte: confirma que es este cliente. ' + motivo;
    if (asign && unica && !yaPagado && seguro) {
      asign.forEach(f => reservados.add(f.folio));
      out[mv.id] = { ...base, tipo: 'auto', motivo, asignaciones: asign.map(f => ({ folio: f.folio, monto: f.saldo })), sobra: 0 };
      return;
    }
    const sug = asign ? { asignaciones: asign.map(f => ({ folio: f.folio, monto: f.saldo })), sobra: 0 } : repartoFIFO(folios, mv.monto);
    out[mv.id] = { ...base, tipo: 'revisar', motivo: yaPagado ? `Ojo: el folio ${yaPagado.folio} ya se registró pagado el ${fechaDMY(yaPagado.fechaPago)} con este mismo monto. Si es el mismo pago, marca "Ya estaba registrado".` : motivo || 'No calza exacto: se propone pagar primero los folios más antiguos.', yaPagado, ...sug };
  });
  return out;
}

// Aplica un abono de la cartola: todo junto o nada (pagos/abonos de cada folio + el movimiento queda conciliado)
export async function aplicarMovimiento(movId, clienteId, asignaciones, aprender) {
  const db = await dbOk();
  const asig = (asignaciones || []).map(a => ({ folio: String(a.folio), monto: Math.round(Number(a.monto) || 0) })).filter(a => a.monto > 0);
  if (!asig.length) throw new Error('Asigna el monto a al menos un folio.');
  const cliente = (await FB.getDoc(FB.doc(db, 'clientes', clienteId))).data() || {};
  await FB.runTransaction(db, async tx => {
    // Las consultas (órdenes y abonos de cada folio) se repiten en cada intento: si otro equipo cambió algo, se ve
    const info = {};
    for (const a of asig) {
      const os = await ordenesDelFolio(db, a.folio);
      if (!os.length) throw new Error(`No hay órdenes con el folio ${a.folio}.`);
      const prev = await FB.getDocs(FB.query(FB.collection(db, 'abonos'), FB.where('folio', '==', a.folio)));
      uso.lecturas += Math.max(1, prev.size);
      info[a.folio] = { ids: os.map(o => o.id), abonado: prev.docs.map(d => d.data()).filter(x => !x.quitadoEnPlanilla).reduce((s, x) => s + (Number(x.monto) || 0), 0) };
    }
    const mref = FB.doc(db, 'movimientos', movId), ms = await tx.get(mref);
    if (!ms.exists()) throw new Error('Ese movimiento ya no está.');
    const mv = ms.data();
    if (mv.estado !== 'pendiente') throw new Error('Ese movimiento ya se registró.');
    const total = asig.reduce((s, a) => s + a.monto, 0);
    if (total > mv.monto) throw new Error(`Asignaste ${total.toLocaleString('es-CL')}, más que el abono del banco (${mv.monto.toLocaleString('es-CL')}).`);
    const cref = FB.doc(db, 'config', 'conciliacion'), cs = aprender ? await tx.get(cref) : null;
    const leidas = {};
    for (const a of asig) { leidas[a.folio] = []; for (const id of info[a.folio].ids) { const s = await tx.get(FB.doc(db, 'ordenes', id)); if (s.exists()) leidas[a.folio].push({ id, ...s.data() }); } }
    const hechas = [];
    for (const a of asig) {
      const os = leidas[a.folio].filter(o => o.estado !== 'anulada' && !o.quitadoEnPlanilla);
      if (os.some(o => o.clienteId && o.clienteId !== clienteId)) throw new Error(`El folio ${a.folio} es de otro cliente.`);
      const tot = os.reduce((s, o) => s + (Number(o.total) || 0), 0), saldo = Math.round(tot - info[a.folio].abonado);
      if (os.every(o => /PAGADO/.test(o.estadoPago || '')) || saldo <= 0) throw new Error(`El folio ${a.folio} ya está pagado.`);
      if (a.monto > saldo) throw new Error(`Al folio ${a.folio} le quedan ${saldo.toLocaleString('es-CL')}: no se le puede asignar ${a.monto.toLocaleString('es-CL')}.`);
      const completo = a.monto === saldo, tipo = completo && !info[a.folio].abonado ? 'pago' : 'abono';
      // Pago del saldo completo de un folio sin abonos: queda PAGADO (igual que antes, sin fila en Abonos). Si no, es un abono.
      if (tipo === 'abono') tx.set(FB.doc(FB.collection(db, 'abonos')), { folio: a.folio, fecha: mv.fecha, monto: a.monto, referencia: 'Cartola: ' + mv.descripcion, movimiento: movId, extra: {}, quitadoEnPlanilla: false, planillaPendiente: true, por: authSF.currentUser.email, en: FB.serverTimestamp() });
      os.filter(o => !/PAGADO/.test(o.estadoPago || '')).forEach(o => tx.update(FB.doc(db, 'ordenes', o.id), marcaCambio(completo ? { estadoPago: 'PAGADO', fechaPago: mv.fecha } : { estadoPago: 'PARCIAL' })));
      hechas.push({ folio: a.folio, monto: a.monto, tipo: completo ? (tipo === 'pago' ? 'pago' : 'abono final') : 'abono' });
    }
    if (aprender && mv.descNorm) {
      const c = configConciliacion(cs.exists() ? cs.data() : null), eq = c.equivalencias.filter(e => e.desc !== mv.descNorm).concat([{ desc: mv.descNorm, clienteId, nombre: cliente.nombre || '' }]);
      tx.set(cref, { ...(cs.exists() ? cs.data() : {}), ignorar: c.ignorar, equivalencias: eq.slice(-500) });
    }
    tx.update(mref, { estado: 'conciliado', clienteId, cliente: cliente.nombre || '', asignaciones: hechas, sobra: mv.monto - total, aprendido: !!aprender, resuelto: { por: authSF.currentUser.email, en: FB.serverTimestamp() }, planillaPendiente: true });
  });
  uso.escrituras += asig.length * 2 + 1;
}
// "Ya estaba registrado" (revisado) o "No es de B2B" (ignorado); con patrón, se ignoran siempre los que lo digan
export async function marcarMovimiento(movId, estado, nota, patron) {
  const db = await dbOk();
  if (!['revisado', 'ignorado'].includes(estado)) throw new Error('Estado no válido.');
  await FB.runTransaction(db, async tx => {
    const mref = FB.doc(db, 'movimientos', movId), ms = await tx.get(mref);
    if (!ms.exists() || ms.data().estado !== 'pendiente') throw new Error('Ese movimiento ya se resolvió.');
    const cref = FB.doc(db, 'config', 'conciliacion'), cs = patron ? await tx.get(cref) : null;
    if (patron) { const c = configConciliacion(cs.exists() ? cs.data() : null), p = normCartola(patron); if (p.length < 4) throw new Error('El texto a ignorar es muy corto.'); tx.set(cref, { ...(cs.exists() ? cs.data() : {}), equivalencias: c.equivalencias, ignorar: [...new Set(c.ignorar.concat([p]))] }); }
    tx.update(mref, { estado, nota: String(nota || '').trim().slice(0, 200) || null, resuelto: { por: authSF.currentUser.email, en: FB.serverTimestamp() }, planillaPendiente: estado === 'revisado' });
  });
  uso.escrituras += patron ? 2 : 1;
}

// ── Una sola vez: traer lo ya conciliado en la app antigua (historial, lo aprendido, lo ignorado y lo pendiente) ──
export const VERSION_CONCILIACION = '2.6.0';   // script que entrega las hojas de conciliación (SistemaFen.gs v1.4.0)
export async function importarConciliacionAntigua() {
  const db = await dbOk();
  const url = (await Apps.leerConexiones()).b2b;
  if (!url) throw new Error('Falta la dirección del script de B2B (Configuración → Conexiones).');
  const v = await Apps.probar('b2b', url, VERSION_CONCILIACION);
  if (!v.ok) throw new Error(v.version ? `El script de B2B está en v${v.version}: necesita v${VERSION_CONCILIACION} (ver README).` : v.texto);
  const r = await llamarScript(url, { action: 'sistema_fen_b2b', accion: 'sistema_fen_b2b', op: 'conciliacion', idToken: await authSF.currentUser.getIdToken() });
  if (!r || !r.ok) throw new Error((r && (r.error || r.msg)) || 'El script no respondió bien.');
  const H = r.hojas || {}, filasDe = (h, ...cols) => { const t = H[h]; if (!t) return []; const ix = cols.map(c => t.c.findIndex(x => normCartola(x) === normCartola(c))); return t.f.map(f => ix.map(i => (i < 0 ? '' : f[i + 1]))); };
  const clientes = (await FB.getDocs(FB.collection(db, 'clientes'))).docs.map(d => ({ id: d.id, ...d.data() }));
  const cliPorNombre = n => clientes.find(c => normCartola(c.nombre) === normCartola(n));
  const snExist = await FB.getDocs(FB.collection(db, 'movimientos'));
  const existentes = new Set(snExist.docs.map(d => d.id)), pendientesYa = new Set(snExist.docs.filter(d => d.data().estado === 'pendiente').map(d => d.id));
  uso.lecturas += clientes.length + existentes.size + 2;
  const docs = [];
  const parteHuella = h => { const p = String(h).split('|'); return { fecha: p[0] || '', saldo: Number(p[1]) || 0, monto: Number(p[2]) || 0, descNorm: p.slice(3).join('|') }; };
  for (const [huella, fecha, descripcion, monto, cliente, folios] of filasDe('ConciliacionBancaria_Historial', 'Fingerprint', 'Fecha', 'Descripcion', 'Monto', 'Cliente', 'Folios')) {
    if (!huella) continue;
    const ph = parteHuella(huella), c = cliPorNombre(cliente);
    docs.push([await idMovimiento(String(huella)), { huella: String(huella), fecha: fechaDe(fecha) || ph.fecha, descripcion: String(descripcion || ph.descNorm), descNorm: ph.descNorm, monto: Number(monto) || ph.monto, saldo: ph.saldo,
      cartola: 'App antigua', estado: /revisado/i.test(String(folios)) ? 'revisado' : 'conciliado', cliente: String(cliente || ''), clienteId: c ? c.id : null, folios: String(folios || ''), origen: 'app antigua', planillaPendiente: false }]);
  }
  for (const [huella, , fecha, descripcion, monto, , , , , ident] of filasDe('ConciliacionBancaria_Pendientes', 'Huella', 'Tipo', 'Fecha', 'Descripcion', 'Monto', 'Cliente', 'Asignaciones', 'FoliosPendientes', 'FolioYaPagado', 'Identificador')) {
    if (!huella) continue;
    const ph = parteHuella(huella);
    docs.push([await idMovimiento(String(huella)), { huella: String(huella), fecha: fechaDe(fecha) || ph.fecha, descripcion: String(descripcion || ph.descNorm), descNorm: ph.descNorm, monto: Number(monto) || ph.monto, saldo: ph.saldo,
      cartola: String(ident || 'App antigua'), estado: 'pendiente', origen: 'app antigua', planillaPendiente: false }]);
  }
  const vistos = new Set(), nuevos = docs.filter(([id]) => !existentes.has(id) && !vistos.has(id) && vistos.add(id));
  // Lo que aquí seguía pendiente pero en la app antigua ya se concilió (por ejemplo, después de volver a ella un tiempo)
  const aCerrar = docs.filter(([id, d]) => pendientesYa.has(id) && d.estado !== 'pendiente');
  for (const [id, d] of aCerrar) { await FB.updateDoc(FB.doc(db, 'movimientos', id), { estado: d.estado, cliente: d.cliente, clienteId: d.clienteId, folios: d.folios, origen: 'app antigua', planillaPendiente: false }); uso.escrituras++; }
  for (let i = 0; i < nuevos.length; i += 400) { const b = FB.writeBatch(db); nuevos.slice(i, i + 400).forEach(([id, d]) => b.set(FB.doc(db, 'movimientos', id), d)); await b.commit(); uso.escrituras += Math.min(400, nuevos.length - i); }
  const equivalencias = filasDe('Equivalencias_Cartola', 'Descripcion_Normalizada', 'Cliente').map(([desc, n]) => { const c = cliPorNombre(n); return c && desc ? { desc: normCartola(desc), clienteId: c.id, nombre: c.nombre } : null; }).filter(Boolean);
  const ignorar = [...new Set(['TRANSBANK'].concat(filasDe('ConciliacionIgnorados', 'Patron').map(([p]) => normCartola(p)).filter(p => p.length >= 4)))];
  const cref = FB.doc(db, 'config', 'conciliacion'), cs = await FB.getDoc(cref), c = configConciliacion(cs.exists() ? cs.data() : null);
  const eqFinal = c.equivalencias.concat(equivalencias.filter(e => !c.equivalencias.some(x => x.desc === e.desc)));
  await FB.setDoc(cref, { ignorar: [...new Set(c.ignorar.concat(ignorar))], equivalencias: eqFinal.slice(-500), importado: { en: FB.serverTimestamp(), por: authSF.currentUser.email, historial: docs.length, nuevos: nuevos.length } });
  uso.escrituras++;
  return { cerrados: aCerrar.length, historial: docs.filter(([, d]) => d.estado !== 'pendiente').length, pendientes: docs.filter(([, d]) => d.estado === 'pendiente').length, nuevos: nuevos.length, equivalencias: equivalencias.length, ignorar: ignorar.length };
}
// Empezar sin traer nada (por ejemplo, si nunca se usó la conciliación en la app antigua)
export async function empezarConciliacionSinHistorial() {
  const db = await dbOk();
  await FB.setDoc(FB.doc(db, 'config', 'conciliacion'), { ...CONC_DEF, importado: { en: FB.serverTimestamp(), por: authSF.currentUser.email, historial: 0, nuevos: 0, sinHistorial: true } }, { merge: true });
}
// Pagos ya registrados (para avisar "ya estaba registrado"): de las órdenes de 6 meses
export function pagadosPorFolio(ordenes, clientes) {
  const norm = t => String(t || '').trim().toLowerCase(), porNombre = {}; clientes.forEach(c => { porNombre[norm(c.nombre)] = c.id; });
  const F = {}, vistos = new Set();
  ordenes.forEach(o => { if (vistos.has(String(o.n))) return; vistos.add(String(o.n)); if (!o.folio || !/PAGADO/.test(String(o.estadoPago || '').toUpperCase())) return; const k = String(o.folio), f = F[k] || (F[k] = { folio: k, total: 0, fechaPago: fechaDe(o.fechaPago), clienteId: o.clienteId || porNombre[norm(o.cliente)] || null }); f.total += Number(o.total) || 0; });
  return Object.values(F);
}
// Para Hoy: abonos de la cartola que faltan por revisar
export async function movimientosParaHoy() {
  let cx;
  try { cx = await conexion(); } catch (e) { return null; }
  if (cx.estado !== 'ok') return null;
  const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'movimientos'), FB.where('estado', '==', 'pendiente')));
  uso.lecturas += Math.max(1, sn.size);
  const l = sn.docs.map(d => d.data());
  return { n: l.length, monto: l.reduce((s, m) => s + (Number(m.monto) || 0), 0), desde: l.map(m => m.fecha).sort()[0] || null };
}

// ═══════════════════════════════════════════════
//  v0.14.1 · Análisis de B2B (resumen del período, caja real y productos)
// ═══════════════════════════════════════════════
const cacheRangos = new Map();   // las mismas fechas no se vuelven a leer en 5 minutos
async function consultaCacheada(clave, fn) {
  const c = cacheRangos.get(clave);
  if (c && Date.now() - c.en < 5 * 60e3) return c.v;
  const v = await fn(); cacheRangos.set(clave, { en: Date.now(), v }); return v;
}
export function olvidarAnalisisB2b() { cacheRangos.clear(); }
const limpias = sn => sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.quitadoEnPlanilla && o.estado !== 'anulada');
// Órdenes vendidas entre dos fechas (por fecha de la orden)
export async function ordenesEntre(desde, hasta) {
  return consultaCacheada('v|' + desde + '|' + hasta, async () => {
    const db = await dbOk();
    const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where('fecha', '>=', desde), FB.where('fecha', '<=', hasta)));
    uso.lecturas += Math.max(1, sn.size);
    return limpias(sn);
  });
}
// Órdenes pagadas entre dos fechas (por fecha de pago)
export async function pagadasEntre(desde, hasta) {
  return consultaCacheada('p|' + desde + '|' + hasta, async () => {
    const db = await dbOk();
    const sn = await FB.getDocs(FB.query(FB.collection(db, 'ordenes'), FB.where('fechaPago', '>=', desde), FB.where('fechaPago', '<=', hasta + '')));
    uso.lecturas += Math.max(1, sn.size);
    return limpias(sn);
  });
}
// Períodos: devuelve { desde, hasta, antes: { desde, hasta }, nombre }
export function periodoAnalisis(tipo, desdeP, hastaP, hoy = hoyTxt()) {
  const D = s => new Date(s + 'T12:00:00'), T = d => hoyTxt(d), mas = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return T(d); };
  const lunes = s => { const d = D(s), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return T(d); };
  const ini = s => s.slice(0, 8) + '01', fin = s => { const d = D(ini(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return T(d); };
  const mesAntes = s => { const d = D(ini(s)); d.setMonth(d.getMonth() - 1); return T(d); };
  const dias = (a, b) => Math.round((D(b) - D(a)) / 864e5) + 1;
  let desde, hasta, antes;
  if (tipo === 'hoy') { desde = hasta = hoy; antes = { desde: mas(hoy, -1), hasta: mas(hoy, -1) }; }
  else if (tipo === 'ayer') { desde = hasta = mas(hoy, -1); antes = { desde: mas(hoy, -2), hasta: mas(hoy, -2) }; }
  else if (tipo === 'semana') { desde = lunes(hoy); hasta = hoy; antes = { desde: mas(desde, -7), hasta: mas(hasta, -7) }; }
  else if (tipo === 'semanaAnterior') { desde = mas(lunes(hoy), -7); hasta = mas(desde, 6); antes = { desde: mas(desde, -7), hasta: mas(hasta, -7) }; }
  else if (tipo === 'mes') { desde = ini(hoy); hasta = hoy; const a = mesAntes(hoy), n = Math.min(Number(hoy.slice(8)), Number(fin(a).slice(8))); antes = { desde: a, hasta: a.slice(0, 8) + String(n).padStart(2, '0') }; }
  else if (tipo === 'mesAnterior') { desde = mesAntes(hoy); hasta = fin(desde); const a = mesAntes(desde); antes = { desde: a, hasta: fin(a) }; }
  else { desde = desdeP || hoy; hasta = hastaP || hoy; if (hasta < desde) [desde, hasta] = [hasta, desde]; const n = dias(desde, hasta); antes = { desde: mas(desde, -n), hasta: mas(desde, -1) }; }
  return { desde, hasta, antes, dias: dias(desde, hasta) };
}
const pct = (a, b) => (b > 0 ? (a - b) / b : null);
const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Lo que se compró: por producto (unidades y neto), por día de la semana y precio real
function porProducto(ordenes) {
  const P = {};
  ordenes.forEach(o => (o.lineas || []).forEach(l => {
    const k = String(l.producto || '').trim(); if (!k) return;
    const p = P[k] || (P[k] = { producto: k, productoId: l.productoId || null, unidades: 0, neto: 0, dias: [0, 0, 0, 0, 0, 0, 0], clientes: new Set() });
    const u = Number(l.cantidad) || 0, n = Number(l.neto) || Math.round(u * (Number(l.precio) || 0));
    p.unidades += u; p.neto += n; if (!p.productoId && l.productoId) p.productoId = l.productoId;
    const f = fechaDe(o.fecha); if (f) { const w = new Date(f + 'T12:00:00').getDay(); p.dias[w === 0 ? 6 : w - 1] += u; }
    p.clientes.add(o.clienteId || o.cliente);
  }));
  return P;
}
// ordenes / ordenesAntes: del período y del anterior; pagadas: con fecha de pago en el período; abonos: todos
export function analizarB2b(per, ordenes, ordenesAntes, pagadas, abonos, productos, clienteId, otras = []) {
  const delCli = o => !clienteId || o.clienteId === clienteId;
  const os = ordenes.filter(delCli), osA = ordenesAntes.filter(delCli);
  const neto = l => l.reduce((s, o) => s + (Number(o.neto) || 0), 0), total = l => l.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const ec = estadoDeCuenta(os, abonos, '', '', 'orden');
  const resumen = { n: os.length, neto: neto(os), iva: total(os) - neto(os), total: total(os), ticket: os.length ? Math.round(neto(os) / os.length) : 0,
    facturado: total(os.filter(o => o.folio)), pendiente: ec.pendiente, cobrado: ec.pagado,
    antes: { n: osA.length, neto: neto(osA), ticket: osA.length ? Math.round(neto(osA) / osA.length) : 0 },
    var: { neto: pct(neto(os), neto(osA)), n: pct(os.length, osA.length) } };
  // Caja real: lo que entró en el período. Un folio con abonos se cuenta por sus abonos (cada uno en su fecha); si no, por su fecha de pago.
  const foliosConAbono = new Set(abonos.map(a => String(a.folio)));
  const cliDeFolio = {}; otras.concat(ordenesAntes, ordenes, pagadas).forEach(o => { if (o.folio) cliDeFolio[String(o.folio)] = o.clienteId || o.cliente; });
  const pag = pagadas.filter(o => delCli(o) && !(o.folio && foliosConAbono.has(String(o.folio))) && (fechaDe(o.fechaPago) || '') >= per.desde && (fechaDe(o.fechaPago) || '') <= per.hasta);
  const delPeriodo = pag.filter(o => (o.fecha || '') >= per.desde), anteriores = pag.filter(o => (o.fecha || '') < per.desde);
  const abs = abonos.filter(a => { const f = fechaDe(a.fecha) || ''; return f >= per.desde && f <= per.hasta && (!clienteId || cliDeFolio[String(a.folio)] === clienteId); });
  const origen = {}; anteriores.forEach(o => { const m = String(o.fecha || '').slice(0, 7); (origen[m] = origen[m] || { mes: m, total: 0, n: 0 }); origen[m].total += Number(o.total) || 0; origen[m].n++; });
  const caja = { delPeriodo: total(delPeriodo), anteriores: total(anteriores), abonos: abs.reduce((s, a) => s + (Number(a.monto) || 0), 0), detalleAbonos: abs.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    origen: Object.values(origen).sort((a, b) => b.mes.localeCompare(a.mes)), nPagos: pag.length };
  caja.total = caja.delPeriodo + caja.anteriores + caja.abonos;
  // Productos
  const P = porProducto(os), PA = porProducto(osA), netoT = Object.values(P).reduce((s, p) => s + p.neto, 0);
  const nDia = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < per.dias; i++) { const d = new Date(per.desde + 'T12:00:00'); d.setDate(d.getDate() + i); const w = d.getDay(); nDia[w === 0 ? 6 : w - 1]++; }
  const base = p => { const x = (productos || []).find(y => (p.productoId && y.id === p.productoId) || String(y.nombre).trim().toLowerCase() === p.producto.toLowerCase()); return x ? Number(x.precioBase) || 0 : 0; };
  const ranking = Object.values(P).map(p => { const a = PA[p.producto], real = p.unidades ? Math.round(p.neto / p.unidades) : 0, b = base(p);
    return { producto: p.producto, unidades: p.unidades, neto: p.neto, parte: netoT ? p.neto / netoT : 0, varNeto: a ? pct(p.neto, a.neto) : null, nuevo: !a, clientes: p.clientes.size,
      porDia: p.dias.map((u, i) => (nDia[i] ? u / nDia[i] : null)), precioReal: real, precioBase: b, descuento: b && real ? 1 - real / b : null }; })
    .sort((a, b) => b.neto - a.neto);
  const dejados = clienteId ? Object.values(PA).filter(p => !P[p.producto]).map(p => ({ producto: p.producto, unidadesAntes: p.unidades, netoAntes: p.neto })).sort((a, b) => b.netoAntes - a.netoAntes) : [];
  return { resumen, caja, ranking, dejados, diasSemana: DIAS_SEM, nDia };
}
// v0.14.1 · Planilla: hojas para Producción y filas repetidas (script de B2B v2.7.0)
export const VERSION_PLANILLA = '2.7.0';
export async function opPlanilla(op, extra) {
  const url = (await Apps.leerConexiones()).b2b;
  if (!url) throw new Error('Falta la dirección del script de B2B (Configuración → Conexiones).');
  const v = await Apps.probar('b2b', url, VERSION_PLANILLA);
  if (!v.ok) throw new Error(v.version ? `El script de B2B está en v${v.version}: necesita v${VERSION_PLANILLA} (ver README).` : v.texto);
  const r = await llamarScript(url, { action: 'sistema_fen_b2b', accion: 'sistema_fen_b2b', op, ...(extra || {}), idToken: await authSF.currentUser.getIdToken() });
  if (!r || !r.ok) throw new Error((r && (r.error || r.msg)) || 'El script no respondió bien.');
  return r;
}
