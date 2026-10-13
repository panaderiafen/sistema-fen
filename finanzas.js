// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas: datos (F1 paso 1, maestro de materias primas con costos)  v0.56.0
//  Todo vive en fen-gastos (solo administración; las reglas v0.1.0 ya cubren colecciones nuevas):
//   · costos_mp/{mpId}        (mismo id que fen-produccion mps / MP_maestro ID_MP): nombre, tipo (mp|insumo|sub_receta),
//                             unidadCompra, contenido { cantidad, unidad: g|ml|un }, precioNeto (por unidad de compra),
//                             impAdicionalPct, ivaPct, precioPorBase (neto por g/ml/un), pesoPorUnidad (g, opcional),
//                             origen (planilla|manual|sii), fecha, por, estado (activa|archivada), anterior, updatedAt.
//   · costos_mp_hist/{autoId}  cada cambio de precio o contenido: { mp, precioNeto, contenido, precioPorBase, origen, motivo,
//                             fecha, por, anterior, en }. Nunca se edita ni se borra.
//   · costos_revision/{id}     "revisado" de la Revisión de datos: { clave, huella, revisado { por, fecha } | null, historial }.
//   · costos_cargas/{autoId}   cada "Traer precios desde la planilla": cuántas nuevas, cambiadas y respetadas.
//  Nada de esto va a fen-produccion ni a Cocina: las jefas no ven costos.
// ═══════════════════════════════════════════════
import { auth as authSF } from './firebase.js?v=0.56.0';
import * as FB from './firebase-gastos.js?v=0.56.0';
import * as GB from './gastos-base.js?v=0.56.0';
import * as P from './produccion.js?v=0.56.0';
import * as FC from './finanzas-costos.js?v=0.56.0';

const LOTE = 400;
const hoyTxt = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yo = () => (authSF.currentUser && authSF.currentUser.email) || '';
const idNuevo = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Conexiones: fen-gastos (donde se guarda) y fen-produccion (lista de materias primas y recetas)
export async function conexiones() {
  const [g, p] = await Promise.all([GB.conexion().catch(e => ({ estado: 'error', error: e })), P.conexion().catch(e => ({ estado: 'error', error: e }))]);
  return { gastos: g, prod: p };
}
async function dbG() { const cx = await GB.conexion(); if (cx.estado !== 'ok') throw new Error('Primero conecta la base nueva de Gastos (Gastos → Base nueva).'); return cx.db; }

// El maestro de costos, las marcas de revisión y la última carga
export async function leer() {
  const db = await dbG();
  const [c, r, k] = await Promise.all([FB.getDocs(FB.collection(db, 'costos_mp')), FB.getDocs(FB.collection(db, 'costos_revision')), FB.getDocs(FB.collection(db, 'costos_cargas'))]);
  const costos = {}; c.docs.forEach(d => { costos[d.id] = { id: d.id, ...d.data() }; });
  const marcas = {}; r.docs.forEach(d => { marcas[d.id] = d.data(); });
  const cargas = k.docs.map(d => d.data()).sort((a, b) => String(b.cuando || '').localeCompare(String(a.cuando || '')));
  return { costos, marcas, ultimaCarga: cargas[0] || null };
}
// Lista actual de fen-produccion (si no está conectada, sigue sin ella)
export async function produccion() {
  try { return await P.mpsYRecetas(); } catch (e) { return { mps: [], recetas: [], error: e.message || String(e) }; }
}

// ── Traer precios desde la planilla ──
// Lee MP_maestro con precios (script de Producción v2.10.0, op mp_costos) y la lista de fen-produccion; no escribe nada.
export async function prepararCarga() {
  const [filas, prod, act] = await Promise.all([P.mpCostos(), produccion(), leer()]);
  const plan = FC.prepararCarga(filas, prod.mps, act.costos, { hoy: hoyTxt(), por: yo() });
  return { plan, filas: filas.length, prodError: prod.error || '' };
}
export async function aplicarCarga(plan) {
  const db = await dbG(), ahora = FB.serverTimestamp(), hoy = hoyTxt(), por = yo();
  const ops = [];
  plan.nuevas.forEach(x => {
    ops.push(['set', FB.doc(db, 'costos_mp', x.id), { ...x.doc, updatedAt: ahora }]);
    ops.push(['set', FB.doc(db, 'costos_mp_hist', idNuevo('h-')), { mp: x.id, precioNeto: x.doc.precioNeto, contenido: x.doc.contenido, precioPorBase: x.doc.precioPorBase, origen: 'planilla', motivo: 'Carga inicial desde la planilla (MP_maestro)', fecha: hoy, por, anterior: null, en: ahora }]);
  });
  plan.cambian.forEach(x => {
    ops.push(['set', FB.doc(db, 'costos_mp', x.id), { ...x.doc, updatedAt: ahora }, true]);
    ops.push(['set', FB.doc(db, 'costos_mp_hist', idNuevo('h-')), { mp: x.id, precioNeto: x.doc.precioNeto, contenido: x.doc.contenido, precioPorBase: x.doc.precioPorBase, origen: 'planilla', motivo: `Cambió en la planilla: ${x.cambios.join(', ')}`, fecha: hoy, por, anterior: x.doc.anterior, en: ahora }]);
  });
  plan.metadatos.forEach(x => ops.push(['set', FB.doc(db, 'costos_mp', x.id), { ...x.campos, updatedAt: ahora }, true]));
  for (let i = 0; i < ops.length; i += LOTE) {
    const b = FB.writeBatch(db);
    ops.slice(i, i + LOTE).forEach(([, ref, d, merge]) => (merge ? b.set(ref, d, { merge: true }) : b.set(ref, d)));
    await b.commit();
  }
  await FB.setDoc(FB.doc(db, 'costos_cargas', idNuevo('c-')), { cuando: new Date().toISOString(), fecha: hoy, por, nuevas: plan.nuevas.length, cambian: plan.cambian.length, metadatos: plan.metadatos.length, respetadas: plan.respetadas.length, en: ahora });
  return { escritos: ops.length };
}

// ── Editar un precio a mano (con motivo) ──
export async function guardarPrecio(id, datos) {
  const db = await dbG(), ref = FB.doc(db, 'costos_mp', id), hoy = hoyTxt(), por = yo();
  return FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('Esa materia prima no está en el maestro de costos. Trae los precios desde la planilla primero.');
    const actual = { id, ...sn.data() };
    const { doc, hist } = FC.edicion(actual, datos, { hoy, por });
    tx.set(ref, { ...doc, updatedAt: FB.serverTimestamp() }, { merge: true });
    tx.set(FB.doc(db, 'costos_mp_hist', idNuevo('h-')), { ...hist, mp: id, en: FB.serverTimestamp() });
    return { ...actual, ...doc };
  });
}
export async function historial(id) {
  const db = await dbG();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'costos_mp_hist'), FB.where('mp', '==', id)));
  const t = x => (x && typeof x.toMillis === 'function' ? x.toMillis() : 0);
  return sn.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (t(b.en) - t(a.en)) || String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

// ── Revisión de datos: marcar revisado / volver a la lista (queda en su historial) ──
export async function marcarRevisado(item, revisado = true) {
  const db = await dbG(), ref = FB.doc(db, 'costos_revision', FC.idRevision(item.clave)), fecha = hoyTxt(), por = yo();
  await FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref), prev = sn.exists() ? sn.data() : {};
    const historial = [...(Array.isArray(prev.historial) ? prev.historial : []), { accion: revisado ? 'revisado' : 'devuelto a la lista', por, fecha, huella: item.huella }].slice(-30);
    tx.set(ref, { clave: item.clave, grupo: item.grupo, titulo: item.titulo, huella: item.huella, revisado: revisado ? { por, fecha } : null, historial, updatedAt: FB.serverTimestamp() });
  });
}
