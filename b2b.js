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
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction } from './firebase.js?v=0.12.1';
import * as FB from './firebase-b2b.js?v=0.12.1';
import * as Apps from './apps.js?v=0.12.1';
import { armar, cambios, COLECCIONES } from './b2b-modelo.js?v=0.12.1';

export const VERSION_MINIMA = '2.3.0';   // script de B2B con la copia (SistemaFen.gs v1.1.0)
export const VERSION_BASE_NUEVA = '2.4.0';   // script que pasa la base nueva a la planilla (SistemaFen.gs v1.2.0)
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
  const ops = [];
  COLECCIONES.forEach(col => {
    const c = prep.cambios[col];
    [...c.nuevos, ...c.cambiados].forEach(id => { const datos = col === 'ordenes' && propios[id] ? { ...prep.docs[col][id], ...propios[id] } : prep.docs[col][id]; ops.push({ t: 'set', col, id, datos, bytes: JSON.stringify(datos).length + 200 }); });
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
export async function ultimasOrdenes(n = 30) {
  const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
  const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'ordenes'), FB.orderBy('n', 'desc'), FB.limit(n)));
  uso.lecturas += Math.max(1, sn.size);
  return sn.docs.map(conId);
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
  return docs.sort((a, b) => b.n - a.n);
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
  for (const col of ['ordenes', 'abonos', 'ediciones']) {
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
  const datos = { ordenes: new Map(), abonos: [], solicitudes: [], config: null, listo: { a: 0 } };
  const avisar = () => cb(datos);
  const desde = hoyTxt(new Date(Date.now() - 30 * 864e5));
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
    FB.onSnapshot(FB.doc(db, 'config', 'b2b'), sn => { datos.config = sn.exists() ? sn.data() : { activa: false }; avisar(); }, err)
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
  await FB.runTransaction(db, async tx => {
    const refs = ns.map(n => FB.doc(db, 'ordenes', String(n)));
    const sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    sns.forEach(sn => { if (!sn.exists()) throw new Error('Una de las órdenes ya no existe.'); const o = sn.data(); if (o.folio) throw new Error(`La orden N° ${o.n} ya tiene el folio ${o.folio}.`); if (o.estado === 'anulada') throw new Error(`La orden N° ${o.n} está anulada.`); });
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
export async function folioUsado(folio) { const db = await dbOk(); return (await ordenesDelFolio(db, folio)).map(o => o.n); }
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
  if (!(p > 0)) throw new Error('Escribe el precio.');
  await FB.runTransaction(db, async tx => {
    const sref = FB.doc(db, 'solicitudes', s.id), ss = await tx.get(sref);
    if (!ss.exists() || ss.data().estado !== 'pendiente') throw new Error('Esa solicitud ya se resolvió.');
    if (s.tipo === 'precio') {
      const cref = FB.doc(db, 'clientes', s.clienteId), cs = await tx.get(cref);
      if (!cs.exists()) throw new Error('El cliente ya no existe.');
      const lista = (cs.data().precios || []).filter(x => !((x.productoId && x.productoId === s.productoId) || String(x.producto).toLowerCase() === String(s.producto).toLowerCase()));
      lista.push({ producto: s.producto, productoId: s.productoId || null, precio: p });
      tx.update(cref, { precios: lista, cambiadoEn: FB.serverTimestamp(), cambiadoPor: authSF.currentUser.email });
    } else {
      // Producto nuevo: id a partir del nombre (sin pisar uno que exista)
      let id = slugB2B(s.producto), i = 2;
      while ((await tx.get(FB.doc(db, 'productos', id))).exists()) id = slugB2B(s.producto) + '-' + i++;
      tx.set(FB.doc(db, 'productos', id), { nombre: s.producto, precioBase: p, categoria: '', idReceta: s.idReceta || '', area: s.area || '', estado: 'activo', extra: {}, origen: { app: 'solicitud', solicitud: s.id }, quitadoEnPlanilla: false, creadoEn: FB.serverTimestamp(), creadoPor: authSF.currentUser.email });
    }
    tx.update(sref, { estado: 'aprobada', precioAprobado: p, respuesta: String(respuesta || '').trim() || null, resuelta: { por: authSF.currentUser.email, en: FB.serverTimestamp() } });
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
      facturacion: c.facturacion || 'Diaria', frecuenciaPago: c.frecuenciaPago || 'Diaria', precios: [], estado: 'activo', extra: {}, origen: { app: 'sistema-fen' }, quitadoEnPlanilla: false, creadoEn: FB.serverTimestamp(), creadoPor: authSF.currentUser.email });
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
