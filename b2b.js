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
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction } from './firebase.js?v=0.11.0';
import * as FB from './firebase-b2b.js?v=0.11.0';
import * as Apps from './apps.js?v=0.11.0';
import { armar, cambios, COLECCIONES } from './b2b-modelo.js?v=0.11.0';

export const VERSION_MINIMA = '2.3.0';   // script de B2B con la copia (SistemaFen.gs v1.1.0)
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
export async function preparar() {
  const cx = await conexion();
  if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva.');
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
  const ops = [];
  COLECCIONES.forEach(col => {
    const c = prep.cambios[col];
    [...c.nuevos, ...c.cambiados].forEach(id => ops.push({ t: 'set', col, id, datos: prep.docs[col][id], bytes: JSON.stringify(prep.docs[col][id]).length + 200 }));
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
  const db = cx.db, vig = col => FB.query(FB.collection(db, col), FB.where('quitadoEnPlanilla', '==', false));
  const agg = async (col, campos) => { const r = await FB.getAggregateFromServer(vig(col), campos); return r.data(); };
  const [o, a, c, p, e, ult] = await Promise.all([
    agg('ordenes', { n: FB.count(), total: FB.sum('total'), neto: FB.sum('neto') }),
    agg('abonos', { n: FB.count(), monto: FB.sum('monto') }),
    agg('clientes', { n: FB.count() }), agg('productos', { n: FB.count() }), agg('ediciones', { n: FB.count() }),
    FB.getDoc(FB.doc(db, 'config', 'migracion'))
  ]);
  uso.lecturas += Math.ceil((o.n + 1) / 1000) + Math.ceil((a.n + 1) / 1000) + 4;
  return {
    base: { ordenes: o.n, total: o.total, neto: o.neto, abonos: a.n, abonosMonto: a.monto, clientes: c.n, productos: p.n, ediciones: e.n },
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
