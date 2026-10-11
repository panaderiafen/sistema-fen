// ═══════════════════════════════════════════════
//  Sistema Fën — Producción: base nueva (fen-produccion)  v0.33.0
//  · Conexión: la configuración web de fen-produccion se guarda en Firestore de Sistema Fën
//    (config/sistemaFen → produccionFirebase). No es secreta: solo identifica el proyecto.
//    Lo que protege los datos son las reglas de fen-produccion y tu cuenta (admins/{uid}).
//  · Cuentas de las áreas: cada tablet se autoriza con la cuenta de su área; aquí se dice
//    qué área es cada cuenta (cuentas/{uid} = { area }).
//  · Copia desde la planilla: el script de Producción (v2.3.0) entrega las hojas (sin costos)
//    y produccion-modelo.js arma los documentos. Recetas, materias primas, configuración y
//    personas se copian enteras. Un plan semanal que ya se cambió en la app Cocina NO se
//    pisa (la app nueva manda desde que se usa).
//  · v0.32.0: Configuración de Producción por área (config/{AREA}) se edita aquí. Una configuración
//    editada en Sistema Fën tampoco se pisa al copiar desde la planilla.
//  · v0.33.0 (P3): las recetas que proponen las jefas en Cocina (propuestas/) se revisan aquí con su
//    costo (lo calcula el script con los precios de la planilla, en neto) y se aprueban o devuelven.
//    Al aprobar, el script escribe la receta en la planilla (costeo, catálogo, Looker siguen igual) y
//    aquí se actualiza la base nueva: recetas/{id}, la versión anterior queda en versiones/{id}_v{n}.
//    Las materias primas pedidas (solicitudes/) se crean con su precio o se habilitan para el área.
// ═══════════════════════════════════════════════
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction } from './firebase.js?v=0.33.0';
import * as FB from './firebase-produccion.js?v=0.33.0';
import * as Apps from './apps.js?v=0.33.0';
import { armar, AREAS } from './produccion-modelo.js?v=0.33.0';
import { parsearConfig as parsearB2b } from './b2b.js?v=0.33.0';

export { AREAS };
export const VERSION_MINIMA = '2.3.0';   // script de Producción con la copia (SistemaFen.gs v2)
export const VERSION_RECETAS = '2.4.0';  // script con costear / aprobar / materias primas (SistemaFen.gs v2.1)
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
  const cfgs = await FB.getDocs(FB.collection(db, 'config'));
  const cfgEditadas = new Set(cfgs.docs.filter(d => d.data().editado).map(d => d.id));
  const ops = [];
  ['recetas', 'mps', 'config', 'personas'].forEach(col => Object.entries(prep.docs[col]).forEach(([id, d]) => { if (!(col === 'config' && cfgEditadas.has(id))) ops.push([col, id, d]); }));
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

// ── Configuración de Producción por área (config/{AREA}); las jefas la leen en Cocina ──
export const CAMPOS_CONFIG = {
  PAN: [
    { k: 'pie_mm.dias_elaboracion', t: 'dias', etiqueta: 'Días del pie de masa madre', ayuda: 'Al terminar la jornada; cubre hasta el próximo día marcado.' },
    { k: 'pie_mm.reserva_pct', etiqueta: 'Reserva del pie (%)', ayuda: 'Del período siguiente.', def: 20 },
    { k: 'pie_mm.mm_madura_pct', etiqueta: 'Masa madre madura en el pie (%)', ayuda: 'Sobre la harina del pie.', def: 20 },
    { k: 'pie_mm.agua_pct', etiqueta: 'Agua del pie (%)', ayuda: 'Sobre la harina del pie.', def: 90 }
  ],
  BOL: [
    { k: 'amasadora_kg', etiqueta: 'Amasadora (kg de masa por tanda)', ayuda: 'Las tandas van siempre en masas enteras: con 10 kg y masas de 1,6 kg son 6 por tanda. Vacío = se usa "masas por tanda" de la app actual.' },
    { k: 'amasadora_tandas_dia', etiqueta: 'Tandas por día (normal)', ayuda: 'Cocina avisa cuando un día se pasa.', def: 2 },
    { k: 'merma_laminado_pct', etiqueta: 'Merma de laminado (%)', ayuda: 'Se suma a las masas necesarias. 0 si el rendimiento de la receta ya la considera.', def: 0 },
    { k: 'capacidad_congelacion_masas', etiqueta: 'Congelador de masas (espacios)', ayuda: 'Para el stock congelado (bitácora).', def: 40 },
    { k: 'capacidad_productos', etiqueta: 'Congelador de productos (cajas)', ayuda: 'Para el stock congelado (bitácora).', def: 25 }
  ]
};
export const valorEn = (o, k) => k.split('.').reduce((x, p) => (x && typeof x === 'object' ? x[p] : undefined), o);
export async function leerConfigs() {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.collection(db, 'config'));
  const r = {}; sn.docs.forEach(d => { r[d.id] = d.data(); });
  return r;
}
// cambios: { 'pie_mm.reserva_pct': 25, 'amasadora_kg': 10, … } → se mezcla con lo que hay (merge)
export async function guardarConfigArea(area, cambios) {
  if (!CAMPOS_CONFIG[area]) throw new Error('Área sin configuración.');
  const db = await dbOk(), datos = {};
  Object.entries(cambios).forEach(([k, v]) => {
    const partes = k.split('.'); let o = datos;
    partes.slice(0, -1).forEach(p => { o = o[p] = o[p] || {}; });
    o[partes[partes.length - 1]] = v;
  });
  await FB.setDoc(FB.doc(db, 'config', area), { ...datos, editado: { por: authSF.currentUser.email, en: FB.serverTimestamp() } }, { merge: true });
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

// ═══════════════ P3: recetas propuestas y materias primas pedidas ═══════════════
async function script(op, datos) {
  const url = (await Apps.leerConexiones()).produccion;
  if (!url) { const e = new Error('Falta la dirección del script de Producción (Configuración → Conexiones).'); e.code = 'sin_url'; throw e; }
  const v = await Apps.probar('produccion', url, VERSION_RECETAS);
  if (!v.ok) { const e = new Error(v.version ? `El script de Producción está en v${v.version}: para aprobar recetas necesita v${VERSION_RECETAS} (ver README).` : v.texto); e.code = 'actualizar'; throw e; }
  const cuerpo = JSON.stringify({ action: 'sistema_fen_produccion', accion: 'sistema_fen_produccion', op, ...datos, idToken: await authSF.currentUser.getIdToken() });
  const pedir = (u, o) => Promise.race([fetch(u, o).then(x => x.json()), new Promise((_, no) => setTimeout(() => no(new Error('El script no respondió en 2 minutos. Prueba de nuevo.')), 120000))]);
  let r = await pedir(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo });
  if (r && r.code === 'version') r = await pedir(url + '?p=' + encodeURIComponent(cuerpo), {});
  if (!r || r.ok !== true) { const e = new Error((r && (r.error || r.msg)) || 'Respuesta inesperada del script de Producción.'); e.code = r && r.code; e.datos = r; throw e; }
  return r;
}
// Lo que se costea de una receta de la base nueva (mismo formato que una propuesta)
export function datosDeReceta(r) {
  return {
    nombre: r.nombre, tipo: r.tipo, porciones: r.porciones, unidad: r.unidad, harinaTotal: r.harinaTotal,
    ingredientes: (r.ingredientes || []).map(i => ({ id: i.id, nombre: i.nombre, gramos: Number(i.gramos) || 0, unidades: i.unidades ?? null })),
    insumos: (r.insumos || []).map(i => ({ id: i.id, nombre: i.nombre, cantidad: Number(i.cantidad ?? i.unidades) || 0 })),
    pasos: r.pasos || [], notas: r.notas || '', clasificacion: r.clasificacion || '', pesoUnidad: r.pesoUnidad || 0,
    planificable: r.planificable !== false, seCongela: !!r.seCongela, unidadesPorCaja: r.unidadesPorCaja || 0
  };
}
export async function propuestasEnRevision() {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'propuestas'), FB.where('estado', 'in', ['en_revision', 'aprobando'])));
  const lista = sn.docs.map(d => ({ docId: d.id, ...d.data() }));
  const ids = [...new Set(lista.map(p => p.recetaId).filter(Boolean))];
  const vig = {}; await Promise.all(ids.map(async id => { const x = await FB.getDoc(FB.doc(db, 'recetas', id)); if (x.exists()) vig[id] = { id, ...x.data() }; }));
  return lista.map(p => ({ ...p, vigente: p.recetaId ? vig[p.recetaId] || null : null }))
    .sort((a, b) => String(((a.historial || []).slice(-1)[0] || {}).en || '').localeCompare(String(((b.historial || []).slice(-1)[0] || {}).en || '')));
}
export async function solicitudesPendientes() {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'solicitudes'), FB.where('estado', '==', 'pendiente')));
  return sn.docs.map(d => ({ docId: d.id, ...d.data() })).sort((a, b) => String(a.en || '').localeCompare(String(b.en || '')));
}
// Para Hoy: cuántas recetas y materias primas esperan (null si la base nueva no está conectada)
export async function pendientesCocina() {
  try {
    const cx = await conexion(); if (cx.estado !== 'ok') return null;
    const [p, s] = await Promise.all([propuestasEnRevision(), solicitudesPendientes()]);
    return { recetas: p.map(x => ({ nombre: (x.datos || {}).nombre, area: x.area })), mps: s.map(x => ({ nombre: x.nombre, area: x.area, tipo: x.tipo })) };
  } catch (e) { return null; }
}
// Costo por unidad de la propuesta y de la versión vigente (con los precios de la planilla)
export async function costear(prop) {
  const recetas = [{ clave: 'propuesta', datos: prop.datos }];
  if (prop.vigente) recetas.push({ clave: 'vigente', datos: datosDeReceta(prop.vigente) });
  const r = await script('costear', { recetas });
  return r.costos;
}
const paso = (prop, estado, comentario, extra = {}) => ({
  estado, ...extra,
  historial: [...(prop.historial || []), { estado, por: authSF.currentUser.email, en: new Date().toISOString(), comentario: comentario || '' }].slice(-40),
  actualizado: { por: authSF.currentUser.email, en: FB.serverTimestamp() }
});
// Cambia el estado de una propuesta solo si sigue en el estado esperado (transacción: el historial no se pisa)
async function pasar(db, docId, desde, estado, comentario, extra = {}) {
  const ref = FB.doc(db, 'propuestas', docId);
  return FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref);
    if (!sn.exists() || !desde.includes(sn.data().estado)) { const e = new Error('La propuesta cambió mientras la revisabas (la retiraron, la anularon o ya se resolvió). Vuelve a cargar la lista.'); e.code = 'cambio'; throw e; }
    const p = sn.data();
    tx.set(ref, paso(p, estado, comentario, extra), { merge: true });
    return p;
  });
}
export async function devolver(prop, comentario) {
  if (!String(comentario || '').trim()) throw new Error('Escribe qué hay que corregir: la jefa lo ve en Cocina.');
  const db = await dbOk();
  await pasar(db, prop.docId, ['en_revision'], 'devuelta', String(comentario).trim().slice(0, 500));
}
// Una aprobación que quedó a medias (se cortó internet o se cerró la página): vuelve a revisión para reintentar.
// Reintentar no duplica: la receta nueva usa el ID de la propuesta y el cambio a una vigente escribe la misma versión.
export async function destrabar(prop) {
  const db = await dbOk();
  await pasar(db, prop.docId, ['aprobando'], 'en_revision', 'La aprobación quedó a medias: vuelve a revisión');
}
export async function aprobar(prop, comentario) {
  const db = await dbOk();
  // 1) Se bloquea ("aprobando"): desde aquí la jefa no puede cambiarla ni retirarla (reglas v1.2.0)
  const p = { ...prop, ...(await pasar(db, prop.docId, ['en_revision'], 'aprobando', '')) };
  const volver = async msg => { try { await pasar(db, p.docId, ['aprobando'], 'en_revision', msg); } catch (e) {} };
  let r, vig = null, version;
  try {
    if (p.recetaId) { const x = await FB.getDoc(FB.doc(db, 'recetas', p.recetaId)); vig = x.exists() ? { id: p.recetaId, ...x.data() } : null; }
    // Una propuesta hecha sobre una versión anterior no pisa un cambio aprobado después
    if (vig && p.versionBase && Number(vig.version) !== Number(p.versionBase)) {
      const e = new Error(`La receta vigente cambió desde que se hizo esta propuesta (era v${p.versionBase}, ahora v${vig.version}). Devuélvela para que la rehagan sobre la vigente.`); e.code = 'version'; throw e;
    }
    version = (vig ? Number(vig.version) || 1 : 0) + 1;
    r = await script('aprobar', { area: p.area, recetaId: p.recetaId || '', idNuevo: p.recetaId ? '' : (p.area + String(p.pid)).toUpperCase(), datos: p.datos, version, creadaPor: p.creadaPor || '', aprobadaPor: authSF.currentUser.email });
  } catch (e) { await volver(''); throw e; }
  // 2) La planilla ya la tiene: se pasa a la base nueva
  const a = armar(r.hojas, null);
  const doc = a.docs.recetas[r.id];
  if (!doc) { await volver('La planilla la aprobó, pero no volvió la receta'); throw new Error('El script aprobó, pero no devolvió la receta. Usa "Leer la planilla" y "Copiar" para traerla.'); }
  const b = FB.writeBatch(db);
  if (vig) b.set(FB.doc(db, 'versiones', `${vig.id}_v${Number(vig.version) || 1}`), { ...vig, archivadaEn: FB.serverTimestamp(), reemplazadaPor: version });
  b.set(FB.doc(db, 'recetas', r.id), { ...doc, propuesta: p.pid, copiadoEn: FB.serverTimestamp() });
  Object.entries(a.docs.mps).forEach(([id, m]) => b.set(FB.doc(db, 'mps', id), { ...m, copiadoEn: FB.serverTimestamp() }));
  await b.commit();
  await pasar(db, p.docId, ['aprobando'], 'aprobada', comentario, { recetaId: r.id, versionAprobada: version });
  return { id: r.id, nueva: r.nueva, version, costo: r.costo };
}
// Materias primas pedidas: crear (con precio neto y unidad de compra) o habilitar una existente
export const UNIDAD_COMPRA = /^(\d+([.,]\d+)?)?\s*(kg|g|lt|l|ml|un|unidad|unidades)$/i;
export async function resolverSolicitud(sol, datos = {}) {
  if (!(sol.tipo === 'habilitar' || datos.habilitarId) && !UNIDAD_COMPRA.test(String(datos.unidad || '').trim())) throw new Error(`"${datos.unidad || ''}" no es una unidad de compra válida. Usa por ejemplo: kg, 25kg, g, lt, 500ml, un, 10un.`);
  const db = await dbOk();
  const r = sol.tipo === 'habilitar' || datos.habilitarId
    ? await script('mp_habilitar', { area: sol.area, mpId: datos.habilitarId || sol.mpId })
    : await script('mp_crear', { area: sol.area, nombre: datos.nombre || sol.nombre, tipo: datos.tipo || (sol.esInsumo ? 'insumo' : 'mp'), categoria: datos.categoria || '', unidad_compra: String(datos.unidad).trim().toLowerCase(), costo_neto: datos.costoNeto });
  const a = armar({ MP_maestro: r.hojas.MP_maestro }, null);
  const b = FB.writeBatch(db);
  Object.entries(a.docs.mps).forEach(([id, m]) => b.set(FB.doc(db, 'mps', id), { ...m, copiadoEn: FB.serverTimestamp() }));
  b.set(FB.doc(db, 'solicitudes', sol.docId), { estado: 'resuelta', mpId: r.id, resueltaPor: authSF.currentUser.email, resueltaEn: new Date().toISOString() }, { merge: true });
  await b.commit();
  return r.id;
}
export async function rechazarSolicitud(sol, motivo) {
  const db = await dbOk();
  await FB.setDoc(FB.doc(db, 'solicitudes', sol.docId), { estado: 'rechazada', motivo: String(motivo || '').slice(0, 300), resueltaPor: authSF.currentUser.email, resueltaEn: new Date().toISOString() }, { merge: true });
}

