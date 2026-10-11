// ═══════════════════════════════════════════════
//  Sistema Fën — Producción: base nueva (fen-produccion)  v0.38.0
//  · Conexión: la configuración web de fen-produccion se guarda en Firestore de Sistema Fën
//    (config/sistemaFen → produccionFirebase). No es secreta: solo identifica el proyecto.
//    Lo que protege los datos son las reglas de fen-produccion y tu cuenta (admins/{uid}).
//  · Cuentas de las áreas: cada tablet se autoriza con la cuenta de su área; aquí se dice
//    qué área es cada cuenta (cuentas/{uid} = { area, areas }: v0.35.0, una tablet puede entrar a varias áreas).
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
//  · v0.34.0 (P4): mover recetas entre áreas (Bollería → Pastelería) con el mismo ID (script v2.5.0).
//  · v0.38.0: consumo de Cafetería en la bodega: lo vendido en la caja (resúmenes de cada cierre y, en la caja
//    abierta, sus ventas) de productos vinculados a una receta de Cafetería, más el café de la bitácora de turno.
//  · v0.37.0 (P5): Bodega — stock de las materias primas críticas (bodega común), consumo por área con lo hecho
//    en Cocina, proyección con lo planificado y alerta en Hoy. El cálculo es el de Cocina (copia en cocina/).
//  · v0.36.0 (P4b): merma de las cuatro áreas (anotada en Cocina) valorizada con los costos de la planilla,
//    y la bitácora de turno de Cafetería (gramos de café); gramos por shot en la configuración de Cafetería.
//  · v0.35.0: una cuenta de área puede entrar a varias áreas (cuentas/{uid}.areas; reglas v1.4.0, script v2.6.0).
// ═══════════════════════════════════════════════
import { auth as authSF, db as dbSF, doc as docSF, getDoc as getDocSF, runTransaction, collection as colSF, getDocs as getDocsSF, query as querySF, where as whereSF } from './firebase.js?v=0.39.0';
import * as FB from './firebase-produccion.js?v=0.39.0';
import * as Apps from './apps.js?v=0.39.0';
import { armar, AREAS } from './produccion-modelo.js?v=0.39.0';
import { parsearConfig as parsearB2b } from './b2b.js?v=0.39.0';
import * as K from './cocina/consumo.js?v=0.8.0';      // el cálculo de la bodega es el de Cocina (copia exacta)
import * as CM from './cocina/modelo.js?v=0.8.0';

export { AREAS };
export const VERSION_MINIMA = '2.3.0';   // script de Producción con la copia (SistemaFen.gs v2)
export const VERSION_RECETAS = '2.4.0';  // script con costear / aprobar / materias primas (SistemaFen.gs v2.1)
export const VERSION_MOVER = '2.5.0';    // script que mueve recetas entre áreas (SistemaFen.gs v2.2)
export const VERSION_MERMA = '2.7.0';    // script con costos_merma (SistemaFen.gs v2.4)
export const VERSION_BODEGA = '2.8.0';   // script con bodega_adm (SistemaFen.gs v2.5)
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
// v0.35.0: una cuenta puede entrar a varias áreas. "area" = la principal (con la que abre la tablet la primera vez);
// "areas" = todas (la principal primero). Las reglas v1.4.0 y el script v2.6.0 leen las dos.
export const areasDeCuenta = c => [...new Set([c && c.area, ...((c && Array.isArray(c.areas)) ? c.areas : [])])].filter(a => AREAS[a]);
export async function asignarCuenta(uid, area, otras = []) {
  const u = String(uid || '').trim();
  if (!/^[A-Za-z0-9]{20,40}$/.test(u)) throw new Error('El UID no se ve bien: cópialo de la consola de Firebase → Authentication → Usuarios (columna "UID de usuario").');
  if (!AREAS[area]) throw new Error('Área no válida.');
  const areas = [area, ...[...new Set(otras || [])].filter(a => AREAS[a] && a !== area)];
  const db = await dbOk();
  const yo = await conexion();
  if (u === yo.uid) throw new Error('Ese UID es el de tu cuenta de administración: usa el de la cuenta del área.');
  await FB.setDoc(FB.doc(db, 'cuentas', u), { area, areas, asignadaPor: authSF.currentUser.email, en: FB.serverTimestamp() });
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
  ],
  CAF: [
    { k: 'gramos_por_shot', etiqueta: 'Gramos de café por shot', ayuda: 'Para las calibraciones de la bitácora de turno (Cocina). Vacío = 14 g, como la app actual.', def: 14 }
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
async function script(op, datos, minima = VERSION_RECETAS) {
  const url = (await Apps.leerConexiones()).produccion;
  if (!url) { const e = new Error('Falta la dirección del script de Producción (Configuración → Conexiones).'); e.code = 'sin_url'; throw e; }
  const v = await Apps.probar('produccion', url, minima);
  if (!v.ok) { const e = new Error(v.version ? `El script de Producción está en v${v.version}: para esto necesita v${minima} (ver README).` : v.texto); e.code = 'actualizar'; throw e; }
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

// ═══════════════ P4: mover recetas entre áreas ═══════════════
// Las que parecen de Pastelería vienen marcadas: sub recetas (preparaciones) clasificadas como relleno o con nombre
// de crema, ganache, glaseado… Un producto ("Croissant relleno") no se marca: es de Bollería. Tú eliges.
const PARECE_PAS = /relleno|crema|ganache|glase|glaseado|alm[ií]bar|pastelera|frangipane|caramelo|mermelada|dulce de leche|manjar|cobertura|merengue|chantilly|curd|coulis|ba[ñn]o/i;
export async function recetasDeArea(area) {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'recetas'), FB.where('area', '==', area)));
  return sn.docs.map(d => ({ id: d.id, ...d.data() })).map(r => ({ ...r, sugerida: r.tipo === 'sub_receta' && r.clasificacion !== 'masa_base' && (r.clasificacion === 'relleno' || PARECE_PAS.test(r.nombre || '')) }))
    .sort((a, b) => (b.sugerida - a.sugerida) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
export async function moverRecetas(ids, desde = 'BOL', hacia = 'PAS') {
  const db = await dbOk();
  const r = await script('mover_area', { desde, hacia, ids }, VERSION_MOVER);
  const a = armar(r.hojas, null);
  const b = FB.writeBatch(db);
  Object.entries(a.docs.recetas).forEach(([id, d]) => b.set(FB.doc(db, 'recetas', id), { ...d, movidaDesde: desde, copiadoEn: FB.serverTimestamp() }));
  Object.entries(a.docs.mps).forEach(([id, m]) => b.set(FB.doc(db, 'mps', id), { ...m, copiadoEn: FB.serverTimestamp() }));
  await b.commit();
  return { movidas: r.movidas, saltadas: r.saltadas };
}



// ═══════════════ P4b: merma valorizada (Cocina la anota sin precios) ═══════════════
export const MOTIVOS = {
  derrame_error: 'Derrame o error', quemado: 'Quemado o mal horneado', vencimiento: 'Vencimiento',
  devolucion_cliente: 'Devolución de cliente', prueba_receta: 'Prueba de receta', otro: 'Otro'
};
const txtF = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (t, n) => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + n); return txtF(d); };
const lunesDe = t => { const d = new Date(t + 'T12:00:00'); return masDias(t, -((d.getDay() + 6) % 7)); };
const finDeMes = p => { const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)); return masDias(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1); };
export const PERIODOS_MERMA = { semana: 'Esta semana', semana_ant: 'Semana pasada', mes: 'Este mes', mes_ant: 'Mes pasado' };
export function periodoMerma(clave, hoy = txtF(new Date())) {
  if (clave === 'semana_ant') { const l = masDias(lunesDe(hoy), -7); return { desde: l, hasta: masDias(l, 6) }; }
  if (clave === 'mes') { const p = hoy.slice(0, 8) + '01'; return { desde: p, hasta: finDeMes(p) }; }
  if (clave === 'mes_ant') { const p = masDias(hoy.slice(0, 8) + '01', -1).slice(0, 8) + '01'; return { desde: p, hasta: finDeMes(p) }; }
  const l = lunesDe(hoy); return { desde: l, hasta: masDias(l, 6) };
}
// Lo anotado en el período (sin anuladas) y su costo por unidad (script: Maestro_recetas y MP_maestro)
export async function mermaDelPeriodo({ desde, hasta }) {
  const db = await dbOk();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'dias'), FB.where('fecha', '>=', desde), FB.where('fecha', '<=', hasta)));
  const merma = [], cafe = [];
  sn.docs.forEach(d => {
    const x = d.data();
    Object.entries(x.merma || {}).forEach(([id, a]) => { if (a && !a.anulado) merma.push({ ...a, id, fecha: x.fecha, area: x.area }); });
    Object.entries(x.turno || {}).forEach(([id, a]) => { if (a && !a.anulado) cafe.push({ ...a, id, fecha: x.fecha, area: x.area }); });
  });
  const claves = [...new Set(merma.map(a => (a.tipo === 'mp' ? 'mp' : 'receta') + ':' + a.item))];
  let costos = {}, errorCostos = '';
  if (claves.length) {
    try { costos = (await script('costos_merma', { items: claves.map(k => { const [tipo, ...r] = k.split(':'); return { tipo, id: r.join(':') }; }) }, VERSION_MERMA)).costos || {}; }
    catch (e) { errorCostos = e.message || String(e); }
  }
  return { desde, hasta, merma, cafe, costos, errorCostos };
}
// Por área: ítems sumados con su costo neto (null si no hay precio), total, y por motivo
export function resumenMerma(datos) {
  const areas = {};
  (datos.merma || []).forEach(a => {
    const ar = areas[a.area] || (areas[a.area] = { area: a.area, items: {}, total: 0, sinCosto: 0, motivos: {} });
    const tipo = a.tipo === 'mp' ? 'mp' : 'receta', k = tipo + ':' + a.item + ':' + a.unidad;
    const c = (datos.costos || {})[tipo + ':' + a.item], neto = c && !c.falta ? Number(a.cantidad) * c.neto : null;
    const it = ar.items[k] || (ar.items[k] = { nombre: a.nombre, tipo, unidad: a.unidad, cantidad: 0, neto: 0, sinCosto: false, motivos: {} });
    it.cantidad += Number(a.cantidad) || 0;
    it.motivos[a.motivo] = (it.motivos[a.motivo] || 0) + 1;
    if (neto === null) { it.sinCosto = true; ar.sinCosto++; } else { it.neto += neto; ar.total += neto; ar.motivos[a.motivo] = (ar.motivos[a.motivo] || 0) + neto; }
  });
  const lista = Object.values(areas).map(a => ({ ...a, items: Object.values(a.items).sort((x, y) => (y.neto || 0) - (x.neto || 0) || x.nombre.localeCompare(y.nombre, 'es')) }))
    .sort((a, b) => Object.keys(AREAS).indexOf(a.area) - Object.keys(AREAS).indexOf(b.area));
  const cafe = { calibracion: 0, merma: 0, prueba_receta: 0, total: 0 };
  (datos.cafe || []).forEach(a => { const g = Number(a.gramos) || 0; if (a.tipo in cafe) cafe[a.tipo] += g; cafe.total += g; });
  return { areas: lista, total: lista.reduce((s, a) => s + a.total, 0), cafe };
}


// ═══════════════ P5: Bodega (materias primas críticas, bodega común) ═══════════════
// Lee lo necesario de la base nueva (120 días de Cocina, planes, metas, ajustes, recetas, materias primas), calcula
// con cocina/consumo.js (el mismo cálculo de Cocina) y deja en stockmp/{id}.estado lo que ven las jefas.
export const DIAS_BODEGA = 120;
export async function calcularBodega({ guardar = true, hoy = CM.hoyTxt() } = {}) {
  const db = await dbOk();
  const desde = CM.sumarDias(hoy, -DIAS_BODEGA), lunes = CM.lunesDe(hoy);
  const [rs, ms, cf, aj, sm, ds, pl, mt] = await Promise.all([
    FB.getDocs(FB.collection(db, 'recetas')), FB.getDocs(FB.collection(db, 'mps')), FB.getDocs(FB.collection(db, 'config')),
    FB.getDocs(FB.collection(db, 'ajustes')), FB.getDocs(FB.collection(db, 'stockmp')),
    FB.getDocs(FB.query(FB.collection(db, 'dias'), FB.where('fecha', '>=', desde))),
    FB.getDocs(FB.query(FB.collection(db, 'planes'), FB.where('lunes', '>=', CM.lunesDe(desde)))),   // Panadería toma del plan la cantidad de lo hecho
    FB.getDocs(FB.query(FB.collection(db, 'metas'), FB.where('lunes', '>=', lunes)))
  ]);
  const datos = { recetas: rs.docs.map(d => ({ id: d.id, ...d.data() })), mps: ms.docs.map(d => ({ id: d.id, ...d.data() })), config: {}, ajustes: {}, dias: {}, planes: {}, metas: {}, hoy };
  cf.docs.forEach(d => { datos.config[d.id] = d.data(); });
  aj.docs.forEach(d => { const a = d.data(); (datos.ajustes[a.area] || (datos.ajustes[a.area] = {}))[a.recetaId] = a; });
  ds.docs.forEach(d => { const x = d.data(); if (x.area && x.fecha) (datos.dias[x.area] || (datos.dias[x.area] = {}))[x.fecha] = x; });
  pl.docs.forEach(d => { datos.planes[d.id] = d.data(); });
  mt.docs.forEach(d => { datos.metas[d.id] = d.data(); });
  const control = {}; sm.docs.forEach(d => { control[d.id] = d.data(); });
  // Cafetería: lo vendido en la caja (fen-ventas)
  let cafe = { ventas: [], sinReceta: {}, error: '' };
  try { cafe = await ventasCafeteria(desde, datos.recetas); } catch (e) { cafe.error = e.message || String(e); }
  datos.ventas = cafe.ventas;
  const { eventos, sinId } = K.consumo(datos);
  const movs = K.movimientos(datos.dias);
  const proy = K.proyeccion(datos, CM.sumarDias(hoy, 1), 7, eventos);   // desde mañana: lo de hoy se descuenta al marcarlo hecho
  const criticas = datos.mps.filter(m => (m.estado || 'activa') === 'activa' && m.tipo !== 'sub_receta' && K.control(m, control[m.id]).critica)
    .map(m => { const cfg = K.control(m, control[m.id]); return K.estado(m, cfg, K.stock(m.id, movs, eventos), proy); })
    .sort((a, b) => (b.bajoAhora - a.bajoAhora) || ((a.bajoDesde || '9') < (b.bajoDesde || '9') ? -1 : (a.bajoDesde || '9') > (b.bajoDesde || '9') ? 1 : 0) || a.mp.nombre.localeCompare(b.mp.nombre, 'es'));
  const en = new Date().toISOString();
  if (guardar && criticas.length) {
    const b = FB.writeBatch(db);
    criticas.forEach(e => b.set(FB.doc(db, 'stockmp', e.mp.id), { estado: {
      contado: e.st.contado, stock: e.st.contado ? Math.round(e.st.stock) : null, alcanza: e.alcanza === null ? null : Math.round(e.alcanza * 10) / 10,
      bajoAhora: !!e.bajoAhora, bajoDesde: e.bajoDesde || null, en } }, { merge: true }));
    await b.commit();
  }
  // Llegadas anotadas aquí que todavía no pasan a la planilla (si el script falló al anotarlas)
  const pendientes = Object.entries((datos.dias.ADM) || {}).flatMap(([fecha, d]) => Object.entries(d.bodega || {}).filter(([, b]) => b && !b.planilla).map(([id, b]) => ({ ...b, id, fecha })));
  if (pendientes.length) pasarLlegadasAdm(db, pendientes).catch(() => {});
  return { hoy, desde, datos, control, eventos, movs, proy, criticas, sinId, en, cafe };
}
// Lo vendido desde "desde": los resúmenes de cada cierre (un día por caja) y, de las cajas abiertas, sus ventas
// (con su hora). Cada línea va con la receta vinculada al producto en la caja (idRecetaFen); las de Cafetería
// que no tienen receta se avisan (no descuentan).
const esCafeteriaCaja = a => /^(caf|cafeter)/i.test(String(a || ''));
async function ventasCafeteria(desde, recetas) {
  const [prods, res, abiertas] = await Promise.all([
    getDocsSF(colSF(dbSF, 'productos')),
    getDocsSF(querySF(colSF(dbSF, 'resumenes_caja'), whereSF('fecha', '>=', desde))),
    getDocsSF(querySF(colSF(dbSF, 'cajas'), whereSF('estado', '==', 'abierta')))
  ]);
  const prod = {}; prods.docs.forEach(d => { prod[d.id] = d.data(); });
  const deCaf = new Set((recetas || []).filter(r => r.area === 'CAF').map(r => r.id));
  const ventas = [], sinReceta = {}, conResumen = new Set();
  const linea = (fecha, en, pid, nombre, area, cantidad) => {
    const rid = (prod[pid] && prod[pid].idRecetaFen) || '';
    if (rid) { if (deCaf.has(rid)) ventas.push({ fecha, en, receta: rid, cantidad }); return; }
    if (esCafeteriaCaja(area || (prod[pid] && prod[pid].area))) sinReceta[nombre || pid] = (sinReceta[nombre || pid] || 0) + cantidad;
  };
  res.docs.forEach(d => {
    const r = d.data(); if (!r.fecha) return;
    conResumen.add(r.cajaId || d.id);
    const en = new Date(r.fecha + 'T23:59:00').toISOString();   // un cierre cuenta al final de su día
    Object.entries(r.porProducto || {}).forEach(([pid, pp]) => {
      const rid = pp.idRecetaFen || (prod[pid] && prod[pid].idRecetaFen) || '';
      if (rid) { if (deCaf.has(rid)) ventas.push({ fecha: r.fecha, en, receta: rid, cantidad: Number(pp.cantidad) || 0 }); }
      else if (esCafeteriaCaja(pp.area)) sinReceta[pp.nombre || pid] = (sinReceta[pp.nombre || pid] || 0) + (Number(pp.cantidad) || 0);
    });
  });
  for (const c of abiertas.docs) {
    if (conResumen.has(c.id)) continue;
    const vs = await getDocsSF(querySF(colSF(dbSF, 'ventas'), whereSF('cajaId', '==', c.id)));
    vs.docs.forEach(x => {
      const v = x.data(); if (v.anulada === true) return;
      const t = v.fecha && v.fecha.toDate ? v.fecha.toDate() : null; if (!t) return;
      const fecha = CM.hoyTxt(t); if (fecha < desde) return;
      (v.lineas || []).forEach(l => linea(fecha, t.toISOString(), l.id, l.nombre, null, parseFloat(l.cantidad) || 0));
    });
  }
  return { ventas, sinReceta, error: '' };
}
// De qué materia prima sale el café de la bitácora de turno de Cafetería (config/CAF.mp_cafe)
export async function guardarMpCafe(mpId) { await guardarConfigArea('CAF', { mp_cafe: mpId || null }); }
// Las llegadas de Sistema Fën pasan a MP_stock_movimientos con el script (sin duplicar); quedan marcadas al pasar
async function pasarLlegadasAdm(db, lista) {
  const r = await script('bodega_adm', { movimientos: lista.map(b => ({ id: b.id, fecha: b.fecha, mp: b.mp, nombre: b.nombre, tipo: b.tipo, cantidad: b.cantidad, unidad: b.unidad, nota: b.nota || '', por: b.por || '', anulado: !!b.anulado })) }, VERSION_BODEGA);
  const porDia = {}; lista.filter(b => (r.ids || []).includes(b.id)).forEach(b => { (porDia[b.fecha] || (porDia[b.fecha] = {}))[b.id] = { planilla: true }; });
  await Promise.all(Object.entries(porDia).map(([fecha, bod]) => FB.setDoc(FB.doc(db, 'dias', 'ADM_' + fecha), { bodega: bod }, { merge: true })));
}
// Consumo de un período por materia prima y área (todas las materias primas, no solo las críticas)
export function consumoPeriodo(calc, { desde, hasta }) {
  const t = K.porMp(calc.eventos.filter(e => e.fecha >= desde && e.fecha <= hasta));
  // Sin la materia prima en el maestro: el nombre con que aparece en las recetas
  const deReceta = id => { for (const r of calc.datos.recetas) { const i = [...(r.ingredientes || []), ...(r.insumos || [])].find(x => x.id === id); if (i && i.nombre) return i.nombre + ' (no está en el maestro)'; } return id; };
  return Object.entries(t).map(([id, x]) => { const m = calc.datos.mps.find(y => y.id === id); return { id, nombre: m ? m.nombre : deReceta(id), unidad: m ? K.unidadMp(m) : 'g', ...x }; })
    .sort((a, b) => b.total - a.total);
}
// Crítica y mínimo de una materia prima (seguridad en g, ml o un)
export async function guardarControl(mpId, { critica, seguridad }) {
  const db = await dbOk();
  await FB.setDoc(FB.doc(db, 'stockmp', mpId), { critica: !!critica, seguridad: Math.max(0, Number(seguridad) || 0), editado: { por: authSF.currentUser.email, en: FB.serverTimestamp() } }, { merge: true });
}
// Llegada desde Sistema Fën (va al día de Administración: dias/ADM_{fecha})
export async function registrarLlegada(mp, cantidadBase, nota) {
  const db = await dbOk(), hoy = CM.hoyTxt(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!(Number(cantidadBase) > 0)) throw new Error('La cantidad tiene que ser mayor que 0.');
  const b = { tipo: 'llegada', mp: mp.id, nombre: mp.nombre, cantidad: Math.round(Number(cantidadBase) * 100) / 100, unidad: K.unidadMp(mp), nota: String(nota || '').slice(0, 120), por: authSF.currentUser.email, en: new Date().toISOString() };
  await FB.setDoc(FB.doc(db, 'dias', 'ADM_' + hoy), { area: 'ADM', fecha: hoy, bodega: { [id]: b } }, { merge: true });
  try { await pasarLlegadasAdm(db, [{ ...b, id, fecha: hoy }]); } catch (e) {}   // si falla, se reintenta al calcular la bodega
}
// Para Hoy: lo que está o queda bajo el mínimo. Usa el último cálculo si es de las últimas 6 horas; si no, calcula.
export async function alertasBodega() {
  try {
    const cx = await conexion(); if (cx.estado !== 'ok') return null;
    const sn = await FB.getDocs(FB.collection(cx.db, 'stockmp'));
    const ultimo = sn.docs.map(d => (d.data().estado || {}).en).filter(Boolean).sort().pop();
    let lista;
    let fresco = !!ultimo && Date.now() - new Date(ultimo).getTime() < 6 * 3600000;
    if (fresco) {
      // Las críticas de hoy (activas): todas tienen que venir del último cálculo; si no, se calcula de nuevo
      const ms = await FB.getDocs(FB.collection(cx.db, 'mps')), sm = {}; sn.docs.forEach(d => { sm[d.id] = d.data(); });
      const crit = ms.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => (m.estado || 'activa') === 'activa' && m.tipo !== 'sub_receta' && K.control(m, sm[m.id]).critica);
      fresco = crit.every(m => sm[m.id] && sm[m.id].estado && sm[m.id].estado.en === ultimo);
      if (fresco) lista = crit.map(m => ({ nombre: m.nombre, ...sm[m.id].estado }));
    }
    if (!fresco) {
      const c = await calcularBodega();
      lista = c.criticas.map(e => ({ nombre: e.mp.nombre, contado: e.st.contado, bajoAhora: e.bajoAhora, bajoDesde: e.bajoDesde }));
    }
    return { bajos: lista.filter(x => x.contado && (x.bajoAhora || x.bajoDesde)), sinContar: lista.filter(x => !x.contado).length };
  } catch (e) { return null; }
}
