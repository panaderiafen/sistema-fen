// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas: datos (F1 pasos 1, 2 y 3: maestro con costos, precio desde el SII, costo directo por producto)  v0.58.0
//  Todo vive en fen-gastos (solo administración; las reglas v0.1.0 ya cubren colecciones nuevas):
//   · costos_mp/{mpId}        (mismo id que fen-produccion mps / MP_maestro ID_MP): nombre, tipo (mp|insumo|sub_receta),
//                             unidadCompra, contenido { cantidad, unidad: g|ml|un }, precioNeto (por unidad de compra),
//                             impAdicionalPct, ivaPct, precioPorBase (neto por g/ml/un), pesoPorUnidad (g, opcional),
//                             origen (planilla|manual|sii), fecha, por, estado (activa|archivada), anterior, updatedAt.
//   · costos_mp_hist/{autoId}  cada cambio de precio o contenido: { mp, precioNeto, contenido, precioPorBase, origen, motivo,
//                             fecha, por, anterior, en }. Nunca se edita ni se borra.
//   · costos_revision/{id}     "revisado" de la Revisión de datos: { clave, huella, revisado { por, fecha } | null, historial }.
//   · costos_cargas/{autoId}   cada "Traer precios desde la planilla": cuántas nuevas, cambiadas y respetadas.
//  v0.57.0 (F1 paso 2, precio desde la última compra del SII; reglas en finanzas-sii.js):
//   · costos_asoc/{rut__nombre[__c-código]}  producto de factura → materia prima (o "no es materia prima"), con lo que trae
//                             una unidad facturada: { rut, rutKey, proveedor, nombreItem, nombreNorm, codigo, mp, mpNombre, ignorar,
//                             contenidoPorUnidad { cantidad, unidad g|ml|un }, creada, actualizada, version }.
//   · costos_asoc_hist/{autoId}  cada cambio de una asociación { asoc, accion, antes, despues, nota, por, fecha, en } (solo agregar).
//   · costos_sii_procesadas/{línea}  cada línea de factura ya revisada { linea, asoc, mp, huella, resultado, motivo, fecha, en }:
//                             revisar de nuevo no repite nada (salvo que cambie su asociación).
//   · costos_por_confirmar/{línea}  cambios de más de ±40 %: { mp, mpNombre, estado pendiente|confirmada|descartada|reemplazada,
//                             actual, nuevo, pct, sii, creada, resuelta { por, fecha, motivo } }. Nunca se borran.
//   · costos_sii_revisiones/{autoId}  cada revisión (al importar del SII o con el botón): cuántas aplicadas, por confirmar…
//  v0.58.0 (F1 paso 3, costo directo por producto; motor en finanzas-motor.js):
//   · costos_recetas/{recetaId}  el último cálculo: { area, nombre, tipo, aprobada, costoUnit (neto por unidad, o por gramo si rinde g),
//                             costoTotal (lote), unidad un|g, porciones, incompleto [motivos], sinCosto, precios { mpId: precio por base },
//                             preciosUsados (hash), recetaHash, ultimoHist { costoUnit, fecha, anterior, pct }, preciosHist, calculadoEn, fecha }.
//   · costos_recetas_hist/{autoId}  solo agregar: { receta, nombre, area, anterior, nuevo, pct, unidad, causa [{ mp, nombre, antes, despues, pct }],
//                             recetaCambio, primero, incompleto, fecha, cuando, en } cuando el costo por unidad cambia más de 0,5 % (y el primer cálculo).
//   · costos_config/finanzas  { alzaAviso (%, por defecto 5), historial }.
//   · costos_alzas_vistas/{recetaId}  "visto" de un aviso de alza en Hoy: { costoUnit, fecha, por, historial }.
//  Se recalcula al abrir Finanzas → Costos y justo después de un cambio de precio (a mano, del SII o confirmado).
//  Nada de esto va a fen-produccion ni a Cocina: las jefas no ven costos.
// ═══════════════════════════════════════════════
import { auth as authSF } from './firebase.js?v=0.58.0';
import * as FB from './firebase-gastos.js?v=0.58.0';
import * as GB from './gastos-base.js?v=0.58.0';
import * as P from './produccion.js?v=0.58.0';
import * as FC from './finanzas-costos.js?v=0.58.0';
import * as FS from './finanzas-sii.js?v=0.58.0';
import * as FM from './finanzas-motor.js?v=0.58.0';

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
  const [c, r, k, pc] = await Promise.all([FB.getDocs(FB.collection(db, 'costos_mp')), FB.getDocs(FB.collection(db, 'costos_revision')), FB.getDocs(FB.collection(db, 'costos_cargas')),
    FB.getDocs(FB.query(FB.collection(db, 'costos_por_confirmar'), FB.where('estado', '==', 'pendiente')))]);
  const costos = {}; c.docs.forEach(d => { costos[d.id] = { id: d.id, ...d.data() }; });
  const marcas = {}; r.docs.forEach(d => { marcas[d.id] = d.data(); });
  const cargas = k.docs.map(d => d.data()).sort((a, b) => String(b.cuando || '').localeCompare(String(a.cuando || '')));
  const porConfirmar = pc.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.mpNombre || '').localeCompare(String(b.mpNombre || ''), 'es'));
  return { costos, marcas, ultimaCarga: cargas[0] || null, porConfirmar };
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
  }).then(async r => { await recalcularTrasPrecio(); return r; });
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

// ═══════════════ v0.57.0 · Precio desde la última compra del SII ═══════════════
const lista = sn => sn.docs.map(d => ({ id: d.id, d: d.data() }));
const mapa = sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = { id: d.id, ...d.data() }; }); return m; };
// Todo lo que necesita "Compras del SII": líneas de los últimos 90 días, asociaciones, maestro, revisadas y por confirmar
export async function leerCompras() {
  const db = await dbG();
  const [docs, as, c, pr, pc, rv] = await Promise.all(['sii_docs', 'costos_asoc', 'costos_mp', 'costos_sii_procesadas', 'costos_por_confirmar', 'costos_sii_revisiones'].map(n => FB.getDocs(FB.collection(db, n))));
  const { lineas, sinDetalle, desde } = FS.lineasCompras(lista(docs), { hoy: hoyTxt() });
  const revisiones = rv.docs.map(d => d.data()).sort((a, b) => String(b.cuando || '').localeCompare(String(a.cuando || '')));
  const porConfirmar = Object.values(mapa(pc));
  return { lineas, sinDetalle, desde, asocs: mapa(as), costos: mapa(c), procesadas: mapa(pr), porConfirmar, pendientes: porConfirmar.filter(p => p.estado === 'pendiente'), ultimaRevision: revisiones[0] || null };
}

// Revisa las compras de los últimos 90 días y aplica los precios (idempotente). origen: 'importacion' | 'boton' | 'asociacion'
export async function preciosDesdeSii({ origen = 'boton' } = {}) {
  const db = await dbG(), por = yo(), hoy = hoyTxt(), ahora = FB.serverTimestamp();
  const x = await leerCompras();
  const plan = FS.planPrecios({ lineas: x.lineas, asocs: x.asocs, costos: x.costos, procesadas: x.procesadas, pendientes: x.pendientes });
  const ops = [], aplicadas = [];
  plan.aplicar.forEach(({ mp, cand, d }) => {
    const m = x.costos[mp], { doc, hist } = FS.docAplicar(m, cand, d, { por });
    ops.push(['set', FB.doc(db, 'costos_mp', mp), { ...doc, updatedAt: ahora }, true]);
    ops.push(['set', FB.doc(db, 'costos_mp_hist', idNuevo('h-')), { ...hist, mp, en: ahora }]);
    aplicadas.push({ mp, nombre: m.nombre || mp, antes: m.precioPorBase ?? null, despues: d.nuevo.precioPorBase, unidad: d.nuevo.contenido.unidad, pct: d.pct });
  });
  plan.confirmar.forEach(({ mp, cand, d }) => {
    const m = x.costos[mp];
    ops.push(['set', FB.doc(db, 'costos_por_confirmar', idNuevo('pc-')), { mp, mpNombre: m.nombre || mp, estado: 'pendiente', pct: d.pct, motivo: d.motivo,
      actual: { precioNeto: m.precioNeto ?? null, precioPorBase: m.precioPorBase ?? null, contenido: m.contenido || null, origen: m.origen || '', fecha: m.fecha || '' },
      nuevo: d.nuevo, cand: { ...cand }, sii: { rut: cand.rut, proveedor: cand.proveedor, folio: cand.folio, fecha: cand.fecha, linea: cand.linea, nombreItem: cand.nombreItem },
      creada: { fecha: hoy, por, origen }, resuelta: null, en: ahora }]);
  });
  plan.reemplazar.forEach(id => ops.push(['set', FB.doc(db, 'costos_por_confirmar', id), { estado: 'reemplazada', resuelta: { por, fecha: hoy, motivo: 'Llegó una compra más nueva' }, updatedAt: ahora }, true]));
  plan.marcar.forEach(m => ops.push(['set', FB.doc(db, 'costos_sii_procesadas', FS.idLinea(m.linea.id)), { linea: m.linea.id, asoc: m.asoc, mp: m.mp, huella: m.huella, resultado: m.resultado, motivo: m.motivo,
    folio: m.linea.folio, rut: m.linea.rut, fechaFactura: m.linea.fecha, fecha: hoy, por, en: ahora }]));
  for (let i = 0; i < ops.length; i += LOTE) {
    const b = FB.writeBatch(db);
    ops.slice(i, i + LOTE).forEach(([, ref, d, merge]) => (merge ? b.set(ref, d, { merge: true }) : b.set(ref, d)));
    await b.commit();
  }
  const sinAsociar = FS.agrupar(x.lineas, x.asocs).filter(g => g.estado === 'sin_asociar' && g.ultima).length;
  const r = { aplicadas, porConfirmar: plan.confirmar.length, omitidas: plan.marcar.filter(m => m.resultado === 'omitida').length, revisadas: plan.marcar.length, sinAsociar, sinDetalle: x.sinDetalle.length };
  if (aplicadas.length) await recalcularTrasPrecio();
  if (ops.length || origen === 'boton') await FB.setDoc(FB.doc(db, 'costos_sii_revisiones', idNuevo('r-')), { cuando: new Date().toISOString(), fecha: hoy, por, origen, aplicadas: aplicadas.length, porConfirmar: r.porConfirmar, omitidas: r.omitidas, revisadas: r.revisadas, en: ahora });
  return r;
}
// Después de importar del SII en Gastos: nunca falla hacia afuera (solo devuelve el aviso)
export async function preciosTrasImportar() {
  try { const cx = await GB.conexion(); if (cx.estado !== 'ok') return null; return await preciosDesdeSii({ origen: 'importacion' }); }
  catch (e) { console.warn('Finanzas: no se pudieron revisar los precios del SII', e); return { error: e.message || String(e) }; }
}

// Guardar (o cambiar) una asociación; queda su historial
export async function guardarAsociacion(clave, datos) {
  const db = await dbG(), ref = FB.doc(db, 'costos_asoc', clave), hoy = hoyTxt(), por = yo();
  const mpDoc = datos.mp ? await FB.getDoc(FB.doc(db, 'costos_mp', datos.mp)) : null;
  if (datos.mp && !datos.ignorar && !(mpDoc && mpDoc.exists())) throw new Error('Esa materia prima no está en el maestro de costos.');
  return FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref), prev = sn.exists() ? sn.data() : null;
    const { doc, hist } = FS.armarAsociacion(prev, datos, { hoy, por, mpDoc: mpDoc && mpDoc.exists() ? { id: datos.mp, ...mpDoc.data() } : null });
    tx.set(ref, { ...doc, updatedAt: FB.serverTimestamp() });
    if (hist) tx.set(FB.doc(db, 'costos_asoc_hist', idNuevo('a-')), { ...hist, asoc: clave, en: FB.serverTimestamp() });
    return doc;
  });
}
export async function historialAsoc(clave) {
  const db = await dbG();
  const sn = await FB.getDocs(FB.query(FB.collection(db, 'costos_asoc_hist'), FB.where('asoc', '==', clave)));
  const t = x => (x && typeof x.toMillis === 'function' ? x.toMillis() : 0);
  return sn.docs.map(d => d.data()).sort((a, b) => t(b.en) - t(a.en));
}

// Confirmar o descartar un cambio de más de ±40 %
export async function resolverPorConfirmar(id, confirmar, motivo) {
  const db = await dbG(), ref = FB.doc(db, 'costos_por_confirmar', id), hoy = hoyTxt(), por = yo(), mot = String(motivo || '').trim().slice(0, 300);
  if (!confirmar && !mot) throw new Error('Escribe por qué lo descartas.');
  return FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('Ese cambio ya no está.');
    const p = sn.data();
    if (p.estado !== 'pendiente') throw new Error('Ese cambio ya se resolvió.');
    if (!confirmar) { tx.set(ref, { estado: 'descartada', resuelta: { por, fecha: hoy, motivo: mot }, updatedAt: FB.serverTimestamp() }, { merge: true }); return { descartada: true }; }
    const refM = FB.doc(db, 'costos_mp', p.mp), sm = await tx.get(refM);
    const m = sm.exists() ? { id: p.mp, ...sm.data() } : null;
    const d = FS.decidir(m, p.cand, { forzar: true });
    if (d.accion !== 'aplicar') throw new Error(`No se puede aplicar: ${d.motivo}. Descártalo con su motivo.`);
    const { doc, hist } = FS.docAplicar(m, p.cand, d, { por, motivo: `Compra del SII confirmada (${d.pct > 0 ? '+' : ''}${Math.round(d.pct)} %): ${p.sii.proveedor} F.${p.sii.folio} (${p.sii.nombreItem})${mot ? ' · ' + mot : ''}` });
    tx.set(refM, { ...doc, updatedAt: FB.serverTimestamp() }, { merge: true });
    tx.set(FB.doc(db, 'costos_mp_hist', idNuevo('h-')), { ...hist, mp: p.mp, en: FB.serverTimestamp() });
    tx.set(ref, { estado: 'confirmada', resuelta: { por, fecha: hoy, motivo: mot }, updatedAt: FB.serverTimestamp() }, { merge: true });
    return { confirmada: true, nombre: m.nombre };
  }).then(async r => { if (r && r.confirmada) await recalcularTrasPrecio(); return r; });
}

// Hoy: cuántos precios hay por confirmar (null si fen-gastos no está conectada)
export async function porConfirmarParaHoy() {
  const cx = await GB.conexion().catch(() => null);
  if (!cx || cx.estado !== 'ok') return null;
  const sn = await FB.getDocs(FB.query(FB.collection(cx.db, 'costos_por_confirmar'), FB.where('estado', '==', 'pendiente')));
  return sn.docs.map(d => d.data().mpNombre || d.data().mp);
}

// ═══════════════ v0.58.0 · Costo directo por producto (motor de costeo) ═══════════════
// Recetas, materias primas y configuración de fen-produccion (sin costos) + el maestro de costos de fen-gastos
export async function datosMotor({ costos } = {}) {
  const [prod, cfg, c] = await Promise.all([P.mpsYRecetas(), P.leerConfigs().catch(() => ({})), costos ? Promise.resolve(costos) : leerColeccion('costos_mp')]);
  return { recetas: prod.recetas || [], mps: prod.mps || [], config: cfg || {}, costos: c };
}
async function leerColeccion(nombre) { const db = await dbG(); return mapa(await FB.getDocs(FB.collection(db, nombre))); }
let ultimoCalculo = 0, ultimoRes = null;
export const ultimoResultado = () => ultimoRes;
// Calcula todas las recetas aprobadas y guarda lo que cambió (costos_recetas) y el historial (más de 0,5 %).
// → { resultados, docs (costos_recetas actualizados), cambios (entradas nuevas del historial), escritos }
export async function recalcularRecetas({ costos } = {}) {
  const db = await dbG(), hoy = hoyTxt(), cuando = new Date().toISOString();
  const [ctx, act] = await Promise.all([datosMotor({ costos }), leerColeccion('costos_recetas')]);
  const resultados = FM.costearTodo(ctx);
  const nombres = {}; Object.entries(ctx.costos).forEach(([id, m]) => { nombres[id] = m.nombre || id; });
  const plan = FM.planGuardar(resultados, act, { hoy, cuando, nombres });
  const ops = [];
  plan.docs.forEach(x => ops.push(['set', FB.doc(db, 'costos_recetas', x.id), { ...x.doc, updatedAt: FB.serverTimestamp() }]));
  plan.hist.forEach(h => ops.push(['set', FB.doc(db, 'costos_recetas_hist', idNuevo('rh-')), { ...h, por: yo(), en: FB.serverTimestamp() }]));
  for (let i = 0; i < ops.length; i += LOTE) {
    const b = FB.writeBatch(db);
    ops.slice(i, i + LOTE).forEach(([, ref, d]) => b.set(ref, d));
    await b.commit();
  }
  ultimoCalculo = Date.now();
  const docs = { ...act }; plan.docs.forEach(x => { docs[x.id] = { id: x.id, ...x.doc }; });
  ultimoRes = { resultados, docs, cambios: plan.hist, escritos: ops.length, ctx, cuando };
  return ultimoRes;
}
// Después de cambiar un precio: recalcula (si fen-produccion no está conectada, no hace nada; nunca falla hacia afuera)
export async function recalcularTrasPrecio() {
  try { const cx = await P.conexion(); if (cx.estado !== 'ok') return null; return await recalcularRecetas(); }
  catch (e) { console.warn('Finanzas: no se pudo recalcular el costo de los productos', e); return null; }
}
export const calculadoHace = () => (ultimoCalculo ? Date.now() - ultimoCalculo : Infinity);

// Lo que muestra Productos: costos_recetas, su historial, el % de aviso y los "visto"
export async function leerProductos() {
  const db = await dbG();
  const [r, h, c, v] = await Promise.all([FB.getDocs(FB.collection(db, 'costos_recetas')), FB.getDocs(FB.collection(db, 'costos_recetas_hist')),
    FB.getDoc(FB.doc(db, 'costos_config', 'finanzas')), FB.getDocs(FB.collection(db, 'costos_alzas_vistas'))]);
  const cfg = c.exists() ? c.data() : {};
  return { docs: mapa(r), hist: h.docs.map(d => ({ id: d.id, ...d.data() })), alzaAviso: Number(cfg.alzaAviso) > 0 ? Number(cfg.alzaAviso) : FM.ALZA_DEFECTO, config: cfg, vistas: mapa(v) };
}
export async function guardarAjustes({ alzaAviso }) {
  const x = Number(String(alzaAviso).replace(',', '.'));
  if (!(x > 0 && x <= 100)) throw new Error('Escribe un porcentaje entre 0,1 y 100.');
  const db = await dbG(), ref = FB.doc(db, 'costos_config', 'finanzas'), fecha = hoyTxt(), por = yo();
  await FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref), prev = sn.exists() ? sn.data() : {};
    const historial = [...(Array.isArray(prev.historial) ? prev.historial : []), { alzaAviso: x, antes: prev.alzaAviso ?? FM.ALZA_DEFECTO, por, fecha }].slice(-50);
    tx.set(ref, { ...prev, alzaAviso: x, historial, updatedAt: FB.serverTimestamp() });
  });
  return x;
}
// "Visto" de un aviso de alza: no vuelve a avisar con este costo (si sube otra vez, avisa de nuevo)
export async function marcarAlzaVista(recetaId, costoUnit, pct) {
  const db = await dbG(), ref = FB.doc(db, 'costos_alzas_vistas', recetaId), fecha = hoyTxt(), por = yo();
  await FB.runTransaction(db, async tx => {
    const sn = await tx.get(ref), prev = sn.exists() ? sn.data() : {};
    const historial = [...(Array.isArray(prev.historial) ? prev.historial : []), { costoUnit, pct: pct ?? null, por, fecha }].slice(-50);
    tx.set(ref, { costoUnit, pct: pct ?? null, fecha, por, historial, updatedAt: FB.serverTimestamp() });
  });
}
// Hoy: productos cuyo costo subió más del % de aviso contra el mes anterior (null si fen-gastos no está conectada)
export async function alzasParaHoy() {
  const cx = await GB.conexion().catch(() => null);
  if (!cx || cx.estado !== 'ok') return null;
  const x = await leerProductos();
  return { lista: FM.alzas(FM.filasProductos(x.docs, x.hist, hoyTxt()), x.vistas, x.alzaAviso), umbral: x.alzaAviso };
}
// Merma: costo neto por unidad de cada ítem con este motor. items: [{ tipo: 'receta'|'mp', id, unidad }]
// → { 'tipo:id:unidad': { neto, incompleto } } (lo que no se pudo costear no viene). null si fen-gastos no está conectada.
export async function costosMerma(items) {
  const cx = await GB.conexion().catch(() => null);
  if (!cx || cx.estado !== 'ok') return null;
  const ctx = await datosMotor();
  const motor = FM.crearMotor(ctx), out = {};
  (items || []).forEach(it => { const c = FM.costoUnitario(motor, ctx.costos, it); if (c) out[`${it.tipo}:${it.id}:${it.unidad}`] = c; });
  return out;
}
