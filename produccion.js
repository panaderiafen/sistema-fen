// ═══════════════════════════════════════════════
//  Sistema Fën — Producción: base nueva (fen-produccion)  v0.31.0
//  · Conexión: la configuración web de fen-produccion se guarda en Firestore de Sistema Fën
//    (config/sistemaFen → produccionFirebase). No es secreta: solo identifica el proyecto.
//    Lo que protege los datos son las reglas de fen-produccion y tu cuenta (admins/{uid}).
//  · Cuentas de las áreas: cada tablet se autoriza con la cuenta de su área; aquí se dice
//    qué área es cada cuenta (cuentas/{uid} = { area }).
//  · Copia desde la planilla: el script de Producción (v2.3.0) entrega las hojas (sin costos)
//    y produccion-modelo.js arma los documentos. Recetas, materias primas, configuración y
//    personas se copian enteras. Un plan semanal que ya se cambió en la app Cocina NO se
//    pisa (la app nueva manda desde que se usa).
// ═══════════════════════════════════════════════
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction } from './firebase.js?v=0.31.0';
import * as FB from './firebase-produccion.js?v=0.31.0';
import * as Apps from './apps.js?v=0.31.0';
import { armar, AREAS } from './produccion-modelo.js?v=0.31.0';
import { parsearConfig as parsearB2b } from './b2b.js?v=0.31.0';

export { AREAS };
export const VERSION_MINIMA = '2.3.0';   // script de Producción con la copia (SistemaFen.gs v2)
const K_CFG = 'fen_sistema_prod_cfg';
const LOTE = 400;

export function parsearConfig(txt) {
  let cfg;
  try { cfg = parsearB2b(txt); } catch (e) { throw new Error(e.message.replace(/B2B/g, 'Producción')); }
  if (cfg.projectId === ((window.FEN_SIS.firebaseB2B || {}).projectId || 'fen-b2b') || /b2b/.test(cfg.projectId)) throw new Error('Esa es la configuración de fen-b2b. Copia la del proyecto fen-produccion.');
  return cfg;
}
const cfgLocal = () => { try { return JSON.parse(localStorage.getItem(K_CFG) || 'null'); } catch (e) { return null; } };
export async function leerConfig() {
  let cfg = null;
  try { const sn = await getDocSF(docSF(dbSF, 'config', 'sistemaFen')); if (sn.exists()) cfg = sn.data().produccionFirebase || null; } catch (e) { cfg = cfgLocal(); }
  try { if (cfg) localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch (e) {}
  return cfg;
}
export async function guardarConfig(cfg) {
  const ref = docSF(dbSF, 'config', 'sistemaFen');
  await runTransaction(dbSF, async tx => { const sn = await tx.get(ref); tx.set(ref, { ...(sn.exists() ? sn.data() : {}), produccionFirebase: cfg }); });
  try { localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch (e) {}
}

// estado: sin_config | sin_sesion | sin_admin | ok
export async function conexion() {
  const cfg = await leerConfig();
  if (!cfg) return { estado: 'sin_config' };
  const cx = await FB.conectar(cfg);
  const u = cx.auth.currentUser, yo = (authSF.currentUser && authSF.currentUser.email || '').toLowerCase();
  if (!u) return { estado: 'sin_sesion', cfg, correo: yo };
  if ((u.email || '').toLowerCase() !== yo) { await FB.salir(); return { estado: 'sin_sesion', cfg, correo: yo }; }
  let admin = false;
  try { admin = (await FB.getDoc(FB.doc(cx.db, 'admins', u.uid))).exists(); }
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
export async function salir() {
  try { if (!FB.conectado()) { const cfg = cfgLocal(); if (!cfg) return; await FB.conectar(cfg); } await FB.salir(); } catch (e) {}
}
async function dbOk() { const cx = await conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva de Producción.'); return cx.db; }

// ── Cuentas de las áreas ──
export async function cuentas() {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.collection(db, 'cuentas'));
  return sn.docs.map(d => ({ uid: d.id, ...d.data() }));
}
export async function asignarCuenta(uid, area) {
  const u = String(uid || '').trim();
  if (!/^[A-Za-z0-9]{20,40}$/.test(u)) throw new Error('El UID no se ve bien: cópialo de la consola de Firebase → Authentication → Usuarios (columna "UID de usuario").');
  if (!AREAS[area]) throw new Error('Área no válida.');
  const db = await dbOk();
  const yo = await conexion();
  if (u === yo.uid) throw new Error('Ese UID es el de tu cuenta de administración: usa el de la cuenta del área.');
  await FB.setDoc(FB.doc(db, 'cuentas', u), { area, asignadaPor: authSF.currentUser.email, en: FB.serverTimestamp() });
}

// ── Leer la planilla (script de Producción) ──
export async function leerPlanilla() {
  const url = (await Apps.leerConexiones()).produccion;
  if (!url) { const e = new Error('Falta la dirección del script de Producción (Configuración → Conexiones).'); e.code = 'sin_url'; throw e; }
  const v = await Apps.probar('produccion', url, VERSION_MINIMA);
  if (!v.ok) { const e = new Error(v.version ? `El script de Producción está en v${v.version}: para copiar necesita v${VERSION_MINIMA} (ver README).` : v.texto); e.code = 'actualizar'; throw e; }
  const cuerpo = JSON.stringify({ action: 'sistema_fen_produccion', accion: 'sistema_fen_produccion', op: 'exportar', idToken: await authSF.currentUser.getIdToken() });
  const pedir = (u, o) => Promise.race([fetch(u, o).then(x => x.json()), new Promise((_, no) => setTimeout(() => no(new Error('El script no respondió en 3 minutos. Prueba de nuevo.')), 180000))]);
  let r = await pedir(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo });
  if (r && r.code === 'version') r = await pedir(url + '?p=' + encodeURIComponent(cuerpo), {});
  if (!r || !r.ok || !r.hojas) throw new Error((r && (r.error || r.msg)) || 'Respuesta inesperada del script de Producción.');
  return r;
}

// Lee la planilla y arma los documentos; mira qué planes ya se cambiaron en Cocina. No escribe nada.
export async function preparar() {
  const db = await dbOk();
  const r = await leerPlanilla();
  const a = armar(r.hojas, r.personas);
  const sn = await FB.getDocs(FB.collection(db, 'planes'));
  const editados = new Set(sn.docs.filter(d => d.data().actualizado || d.data().origen !== 'planilla').map(d => d.id));
  const planesACopiar = Object.keys(a.docs.planes).filter(id => !editados.has(id));
  return { ...a, planesACopiar, planesRespetados: Object.keys(a.docs.planes).filter(id => editados.has(id)), leido: r.leido };
}

export async function copiar(prep, avance) {
  const db = await dbOk();
  // Justo antes de escribir se vuelve a mirar: un plan que una jefa cambió en Cocina mientras tanto no se pisa
  const ahora = await FB.getDocs(FB.collection(db, 'planes'));
  const editadosAhora = new Set(ahora.docs.filter(d => d.data().actualizado || d.data().origen !== 'planilla').map(d => d.id));
  const planes = prep.planesACopiar.filter(id => !editadosAhora.has(id));
  const ops = [];
  ['recetas', 'mps', 'config', 'personas'].forEach(col => Object.entries(prep.docs[col]).forEach(([id, d]) => ops.push([col, id, d])));
  planes.forEach(id => ops.push(['planes', id, prep.docs.planes[id]]));
  let hechos = 0;
  for (let i = 0; i < ops.length; i += LOTE) {
    const b = FB.writeBatch(db);
    ops.slice(i, i + LOTE).forEach(([col, id, d]) => b.set(FB.doc(db, col, id), { ...d, copiadoEn: FB.serverTimestamp() }));
    await b.commit();
    hechos += Math.min(LOTE, ops.length - i);
    if (avance) avance(hechos, ops.length);
  }
  await FB.setDoc(FB.doc(db, 'migracion', 'produccion'), {
    ultima: FB.serverTimestamp(), por: authSF.currentUser.email, resumen: prep.resumen,
    escritos: ops.length, planesRespetados: prep.planesRespetados.length, avisos: prep.avisos.slice(0, 200), totalAvisos: prep.avisos.length
  });
  return { escritos: ops.length };
}

// Control: lo que hay en la base nueva comparado con la planilla
export async function totales() {
  const db = await dbOk();
  const [r, m, p, pe, ult] = await Promise.all([FB.getDocs(FB.collection(db, 'recetas')), FB.getDocs(FB.collection(db, 'mps')), FB.getDocs(FB.collection(db, 'planes')), FB.getDocs(FB.collection(db, 'personas')), FB.getDoc(FB.doc(db, 'migracion', 'produccion'))]);
  const porArea = {}; Object.keys(AREAS).forEach(a => { porArea[a] = 0; });
  r.docs.forEach(d => { const a = d.data().area; if (a in porArea) porArea[a]++; });
  const unidades = { PAN: 0, BOL: 0, PAS: 0 }, planillaUn = { PAN: 0, BOL: 0, PAS: 0 };
  p.docs.forEach(d => { const x = d.data(); if (!(x.area in unidades)) return; Object.values(x.filas || {}).forEach(f => Object.values(f || {}).forEach(v => { unidades[x.area] += Number(v) || 0; if (x.origen === 'planilla' && !x.actualizado) planillaUn[x.area] += Number(v) || 0; })); });
  return { recetas: r.size, recetasPorArea: porArea, mps: m.size, planes: p.size, unidades, unidadesSinCambiar: planillaUn, personas: pe.size, ultima: ult.exists() ? ult.data() : null };
}
