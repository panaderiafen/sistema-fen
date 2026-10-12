// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos con la base nueva (fen-gastos), etapa G2  v0.47.0
//  Se usa solo cuando config/gastos dice fuente = "base" (después de "Pasar Gastos a la base nueva").
//  Mismas pantallas y mismas respuestas que el script de Gastos: gastos.js elige uno u otro.
//  · Cada escritura lleva marcaBase() (planillaPendiente = true): el script de Gastos la copia a la planilla
//    unos segundos después (gastos-planilla.programar). Después de escribir: notarEscritura().
//  · Nada se borra: anular deja estado "anulado" con quién, cuándo y por qué; cada cambio queda en "historial"
//    (quién, cuándo, antes y después de cada campo que cambió).
//  · Corregir y anular revisan en una transacción que el gasto no haya cambiado desde que se abrió (campo "version").
//  · Los vencimientos de las obligaciones se generan aquí al abrir Gastos u Hoy (el script ya no lo hace),
//    con id fijo "<obligación>_<aaaa-mm-dd>" y "crear si no está" en una transacción: dos pestañas no lo duplican.
//  · Fotos, PDF y comprobantes van a Drive (privados) con el script (op archivo_subir); aquí se guarda el enlace.
//  · v0.47.0: obligaciones (lista con la próxima fecha, historial de pagos, crear/editar, archivar, reactivar) e ítems
//    (lista, crear/editar, subir/bajar, archivar). Igual que el script: editar una obligación no toca sus vencimientos
//    ya creados; cambiar el nombre de un ítem no cambia los gastos ni las obligaciones que lo usan.
// ═══════════════════════════════════════════════
import { auth as authSF } from './firebase.js?v=0.47.0';
import * as FB from './firebase-gastos.js?v=0.47.0';
import * as GB from './gastos-base.js?v=0.47.0';
import * as GP from './gastos-planilla.js?v=0.47.0';
import * as M from './gastos-g2.js?v=0.47.0';
import { dia } from './gastos-modelo.js?v=0.47.0';

const s = v => String(v || '');
const correo = () => (authSF.currentUser && authSF.currentUser.email) || '';
const error = (msg, code) => Object.assign(new Error(msg), { code });
export const MSG_CAMBIO = 'Este gasto cambió en otro lado, vuelve a abrirlo.';

let cx = null;
async function db() {
  if (cx && FB.conectado() && FB.conectado().auth.currentUser) return cx.db;
  const c = await GB.conexion();
  if (c.estado !== 'ok') throw error('Gastos trabaja con la base nueva: conéctala en este equipo (Gastos → Base nueva) y entra con tu contraseña.', 'sin_base');
  cx = c; return c.db;
}

// ── Lecturas ──
const todos = async (col, ...w) => { const d = await db(); return (await FB.getDocs(w.length ? FB.query(FB.collection(d, col), ...w) : FB.collection(d, col))).docs.map(x => ({ id: x.id, d: x.data() })); };
const vivos = l => l.filter(x => !x.d.quitadoEnPlanilla);
async function catalogo() {
  const [items, plantillas] = await Promise.all([todos('items'), todos('obligaciones')]);
  return { items, plantillas, lista: M.itemsOrdenados(items, plantillas) };
}

// ── Escrituras: marcas comunes ──
// Sin "undefined" (Firestore no lo acepta); no toca los valores especiales (serverTimestamp)
function limpio(v) {
  if (Array.isArray(v)) return v.map(limpio);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { const o = {}; Object.entries(v).forEach(([k, x]) => { if (x !== undefined) o[k] = limpio(x); }); return o; }
  return v;
}
// Documento nuevo: origen, quién y cuándo, versión 0 y la marca para la planilla
const nuevo = (datos, origen, por) => limpio({ ...datos, origen, creado: { por: por || correo(), en: FB.serverTimestamp() }, version: 0, historial: [], ...GB.marcaBase(por) });
// Cambio: campos nuevos + versión siguiente + historial (quién, cuándo, antes y después de lo que cambió) + marca para la planilla
const cambio = (a, que, campos, extra, por) => limpio({ ...campos, version: (Number(a && a.version) || 0) + 1,
  historial: M.conHistorial(a && a.historial, { que, por: por || correo(), en: M.ahoraChile().texto, cambios: M.diferencias(a, campos), ...(extra || {}) }), ...GB.marcaBase(por) });
// Después de escribir: se anota en config/gastos y se programa la copia a la planilla
async function despues(n) {
  if (!n) return;
  try { await GB.notarEscritura(n); } catch (e) {}
  GP.programar();
}

// ── Vencimientos que se generan solos (3 días antes) y estados al día ──
// Al leer, como getVencimientos del script. Ids fijos; la transacción crea solo los que no están (dos pestañas no duplican).
const AUTO = 'Sistema Fën (automático)';
async function alDia(plantillas, vencs) {
  const hoy = M.ahoraChile().dia, d = await db();
  const g = M.generarVencimientos(plantillas, vencs, hoy), est = M.cambiosDeEstado(vencs, hoy);
  if (!g.nuevos.length && !est.length && !g.archivar.length) return false;
  const escritos = await FB.runTransaction(d, async tx => {
    const refsN = g.nuevos.map(x => FB.doc(d, 'vencimientos', x.id)), refsE = est.map(x => FB.doc(d, 'vencimientos', x.id)), refsA = g.archivar.map(id => FB.doc(d, 'obligaciones', id));
    const sN = [], sE = [], sA = [];
    for (const r of refsN) sN.push(await tx.get(r));
    for (const r of refsE) sE.push(await tx.get(r));
    for (const r of refsA) sA.push(await tx.get(r));
    let k = 0;
    g.nuevos.forEach((x, i) => { if (!sN[i].exists()) { tx.set(refsN[i], nuevo(x.d, 'obligacion', AUTO)); k++; } });
    est.forEach((x, i) => { const a = sE[i].exists() ? sE[i].data() : null; if (a && a.estado !== x.estado && (a.estado === 'PENDIENTE' || a.estado === 'VENCIDA')) { tx.update(refsE[i], cambio(a, 'estado al día', { estado: x.estado }, null, AUTO)); k++; } });
    g.archivar.forEach((id, i) => { const a = sA[i].exists() ? sA[i].data() : null; if (a && a.estado === 'ACTIVA') { tx.update(refsA[i], cambio(a, 'archivada al generar su vencimiento', { estado: 'ARCHIVADA' }, null, AUTO)); k++; } });
    return k;
  });
  await despues(escritos);
  return true;   // había algo por hacer (aunque lo haya hecho otra pestaña): se vuelve a leer
}
async function vencimientosAlDia() {
  let [vencs, cat] = await Promise.all([todos('vencimientos'), catalogo()]);
  if (await alDia(cat.plantillas, vencs)) { [vencs, cat] = await Promise.all([todos('vencimientos'), catalogo()]); }
  return { vencs, cat };
}

// ── datos: vencimientos al día e ítems para registrar (como sfGastosDatos) ──
export async function datos() {
  const { vencs, cat } = await vencimientosAlDia();
  const activos = cat.lista.filter(i => !i.archivado);
  return { ok: true, vencimientos: M.vencimientosVisibles(vencs, M.ahoraChile().dia), items: activos.filter(i => !i.esObligacionRecurrente), itemsSii: activos, areas: M.AREAS.slice(), fuente: 'base' };
}
// Para Hoy: atrasados y próximos 7 días (como sfPendientes del script), con los vencimientos al día
export async function pendientesHoy() {
  const { vencs } = await vencimientosAlDia();
  return M.pendientesHoy(vencs, M.ahoraChile().dia);
}

// ── Gastos registrados (g_lista): desde el 1 de enero del año pasado ──
// Una sola condición (fecha >= desde): usa el índice simple que Firestore crea solo (no pide índice compuesto).
export async function lista() {
  const desde = (Number(M.ahoraChile().dia.slice(0, 4)) - 1) + '-01-01';
  const [gs, vencs] = await Promise.all([todos('gastos', FB.where('fecha', '>=', desde)), todos('vencimientos')]);
  const cred = M.mapaCreditos(vencs);
  const l = vivos(gs).filter(x => x.d.estado === 'vigente' && dia(x.d.fecha))
    .sort((a, b) => (b.d.fecha || '').localeCompare(a.d.fecha || '') || (b.d.hora || '').localeCompare(a.d.hora || '') || b.id.localeCompare(a.id));
  return { ok: true, gastos: l.map((x, k) => M.vistaGasto(x.id, x.d, k + 2, cred)), desde };
}

// ── Registrar (sfGastosRegistrar + registrarGasto). p.fecha llega "dd-mm-aaaa", como al script ──
// marca: { t, r } fija por envío (un reintento usa los mismos ids). subir(archivo) → { url, id } (Drive, privado).
export async function registrar(p, marca, subir) {
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw error('Agrega al menos un ítem', 'datos');
  if (!p.imageData) throw error('Falta la foto o el archivo de la boleta', 'datos');
  if (!/^\d{2}-\d{2}-\d{4}$/.test(String(p.fecha || ''))) throw error('Falta la fecha de compra', 'datos');
  const fecha = dia(p.fecha);
  const forma = ['contado', 'tarjeta', 'proveedor'].includes(p.formaPago) ? p.formaPago : 'contado';
  if (forma !== 'contado' && !M.esIso(p.fechaPago)) throw error('Falta la fecha de pago del crédito', 'datos');
  const cat = await catalogo(), li = M.limpiarItems(items, cat.lista.filter(i => !i.archivado));
  if (li.error) throw error(li.error, 'datos');
  const d = await db(), hoy = M.ahoraChile().dia;
  // ¿Ya quedó (un reintento del mismo envío)? Entonces no se sube la boleta otra vez
  const ids0 = M.idsLineas('g', marca, 1);
  if ((await FB.getDoc(FB.doc(d, 'gastos', ids0[0]))).exists()) return { ok: true, items: li.limpios.length, repetido: true };
  const nombre = String(p.fileName || 'boleta.jpg').slice(0, 120);
  const arch = await subir({ tipo: 'boleta', fecha: p.fecha, imageData: p.imageData, mimeType: p.mimeType || 'image/jpeg', fileName: nombre });
  const e = { fecha, hora: String(p.hora || '').slice(0, 5), tipoMonto: M.tipoMontoOk(p.tipoMonto), formaPago: forma, fechaPago: forma === 'contado' ? '' : p.fechaPago,
    observacion: p.observacion || '', archivo: nombre, urlFoto: arch.url || '' };
  const lineas = M.lineasCompra(e, li.limpios), venc = M.vencimientoCredito(e, li.limpios, hoy);
  const ids = M.idsLineas('g', marca, lineas.length), idV = M.idVencCredito(marca);
  const refs = ids.map(id => FB.doc(d, 'gastos', id)), refV = FB.doc(d, 'vencimientos', idV);
  const r = await FB.runTransaction(d, async tx => {
    if ((await tx.get(refs[0])).exists()) return { repetido: true };
    lineas.forEach((l, k) => tx.set(refs[k], nuevo({ ...l, ...(venc ? { vencimientoId: idV } : {}) }, 'mano')));
    if (venc) tx.set(refV, nuevo({ ...venc, id: idV }, 'credito'));
    return { repetido: false };
  });
  if (!r.repetido) await despues(lineas.length + (venc ? 1 : 0));
  return { ok: true, items: li.limpios.length, lineas: lineas.length, ids, vencimiento: venc ? idV : '', repetido: r.repetido };
}

// ── Corregir (sfGEditar), revisando que nadie lo cambió desde que se abrió ──
export async function editar(g, c) {
  const d = await db(), ref = FB.doc(d, 'gastos', g.id), cat = await catalogo();
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref);
    if (!sn.exists()) throw error('Ese gasto ya no existe.', 'cambio');
    const a = sn.data();
    if ((Number(a.version) || 0) !== (Number(g.version) || 0) || a.estado !== 'vigente') throw error(MSG_CAMBIO, 'cambio');
    const x = M.corregirGasto(a, c, cat.lista.filter(i => !i.archivado));
    if (x.error) throw error(x.error, 'datos');
    if (!Object.keys(x.campos).length) return { ok: true, sinCambios: true, antes: x.antes, despues: x.despues };
    tx.update(ref, cambio(a, 'corrigió', x.campos));
    return { ok: true, antes: x.antes, despues: x.despues };
  });
  if (!r.sinCambios) await despues(1);
  return r;
}

// ── Anular (sfGAnular): estado "anulado" con quién, cuándo y por qué. Devuelve los vencimientos relacionados ──
export async function anular(filas, motivo) {
  const m = M.texto(motivo, 300);
  if (m.length < 3) throw error('Escribe el motivo', 'datos');
  if (!Array.isArray(filas) || !filas.length || filas.length > 40 || filas.some(g => !g || !g.id)) throw error('Faltan las líneas', 'datos');
  const d = await db(), refs = filas.map(g => FB.doc(d, 'gastos', g.id)), ahora = M.ahoraChile().texto, por = correo() || 'Sistema Fën';
  await FB.runTransaction(d, async tx => {
    const sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    sns.forEach((sn, i) => { if (!sn.exists() || sn.data().estado !== 'vigente' || (Number(sn.data().version) || 0) !== (Number(filas[i].version) || 0)) throw error(MSG_CAMBIO, 'cambio'); });
    sns.forEach((sn, i) => tx.update(refs[i], cambio(sn.data(), 'anuló', { estado: 'anulado', anulado: { el: ahora, en: ahora, por, motivo: m, filaOriginal: '' } }, { motivo: m })));
  });
  await despues(filas.length);
  const rel = M.relacionadosAnular(filas, await todos('vencimientos'));
  return { ok: true, anuladas: filas.length, ...rel };
}

// ── Pagar un vencimiento (sfGastosPagar + registrarPagoVencimiento), todo en una transacción ──
export async function pagar(p, marca, subir) {
  const id = String(p.id || ''), monto = M.n(p.montoPago);
  if (!id) throw error('Falta el vencimiento', 'datos');
  if (!(monto > 0)) throw error('El monto debe ser mayor que 0', 'datos');
  if (!M.esIso(p.fechaPago)) throw error('Falta la fecha de pago', 'datos');
  const d = await db(), refV = FB.doc(d, 'vencimientos', id), sn0 = await FB.getDoc(refV);
  if (!sn0.exists() || sn0.data().quitadoEnPlanilla) throw error('Ese vencimiento ya no existe', 'datos');
  const v0 = M.vistaVencimiento(id, sn0.data());
  const areas = Array.isArray(p.multiArea) ? p.multiArea.filter(a => a && a.area && M.n(a.monto) > 0).map(a => ({ area: String(a.area), monto: M.n(a.monto) })) : [];
  if (areas.some(a => !M.AREAS.includes(a.area))) throw error('Área no válida', 'datos');
  const tipoMonto = M.tipoMontoOk(p.tipoMonto), obsPago = M.obsLibre(p.obsPago);
  if (v0.estado === 'PAGADO') {
    // Un reintento del mismo envío (ya quedó): responde como si recién se hubiera hecho
    if (v0.plantillaId && (await FB.getDoc(FB.doc(d, 'gastos', M.idsLineas('gp', marca, 1)[0]))).exists()) return { ok: true, repetido: true };
    if (!v0.plantillaId && (sn0.data().pago || {}).clave === marca.t + marca.r) return { ok: true, repetido: true };
    throw error(`Ese vencimiento ya estaba pagado (${v0.fechaPago || ''})`, 'pagado');
  }
  if (v0.estado === 'ANULADO') throw error('Ese vencimiento fue anulado. Recarga para ver el estado actual.', 'anulado');
  // Comprobante a Drive ("Comprobantes de pago / <año del pago>"), privado
  let url = '';
  if (p.imageData) url = (await subir({ tipo: 'comprobante', fecha: p.fechaPago, imageData: p.imageData, mimeType: p.mimeType || 'image/jpeg', fileName: String(p.fileName || 'comprobante.jpg').slice(0, 120) })).url || '';
  // Compra a crédito: el gasto ya existe (se creó al comprar); se le completa la fecha de pago y el comprobante
  let credito = [];
  if (!v0.plantillaId && v0.item) {
    const delItem = (await todos('gastos', FB.where('itemGasto', '==', v0.item)))
      .sort((a, b) => (b.d.fecha || '').localeCompare(a.d.fecha || '') || (b.d.hora || '').localeCompare(a.d.hora || '') || b.id.localeCompare(a.id));
    credito = M.gastosDelCredito(v0, delItem);
  }
  const hora = M.ahoraChile().hora;
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(refV), refsC = credito.map(x => FB.doc(d, 'gastos', x.id)), snC = [];
    for (const rf of refsC) snC.push(await tx.get(rf));
    const a = sn.data();
    if (a.estado === 'PAGADO') throw error(`Ese vencimiento ya estaba pagado (${dia(a.fechaPago) || ''})`, 'pagado');
    if (a.estado === 'ANULADO') throw error('Ese vencimiento fue anulado. Recarga para ver el estado actual.', 'anulado');
    const v = M.vistaVencimiento(id, a), extra = {};
    // Si en el pago se cambió el reparto por área, esos son los montos reales de este período
    if (areas.length) { extra.multiArea = JSON.stringify(areas); v.multiArea = areas; }
    let lineas = [], tocados = 0;
    if (v.plantillaId) {
      lineas = M.lineasPago(v, monto, p.fechaPago, obsPago, url, tipoMonto, hora);
      const ids = M.idsLineas('gp', marca, lineas.length);
      lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo(l, 'obligacion')));
    } else snC.forEach((s2, i) => {
      if (!s2.exists()) return; const g = s2.data(); if (g.fechaPago || g.estado !== 'vigente') return;
      tx.update(refsC[i], cambio(g, 'pagó', { fechaPago: p.fechaPago, ...(url ? { urlFoto: url } : {}) }, { vencimiento: id })); tocados++;
    });
    tx.update(refV, cambio(a, 'pagó', { ...extra, estado: 'PAGADO', fechaPago: p.fechaPago, montoPago: String(monto), obsPago, ...(url ? { urlComprobante: url } : {}), pago: { clave: marca.t + marca.r } }));
    return { lineas: lineas.length, completados: tocados };
  });
  await despues(1 + r.lineas + r.completados);
  // El siguiente vencimiento de la obligación, de inmediato (como el script)
  try { await vencimientosAlDia(); } catch (e) {}
  return { ok: true, ...r };
}

// ── Vencimientos: anular y reabrir (sfOblAnularVenc / sfOblReabrirVenc) ──
export async function anularVencimiento(id, motivo) {
  const m = M.texto(motivo, 300); if (m.length < 3) throw error('Escribe el motivo', 'datos');
  const d = await db(), ref = FB.doc(d, 'vencimientos', String(id || ''));
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const a = sn.data();
    if (a.estado === 'ANULADO') return { ok: true, yaEstaba: true };
    if (a.estado === 'PAGADO') throw error('Ese vencimiento ya está pagado: no se puede anular. Si el pago fue un error, anula en Registrados el gasto que creó: ahí te ofrece dejar el vencimiento por pagar de nuevo.', 'pagado');
    tx.update(ref, cambio(a, 'anuló', { estado: 'ANULADO', obsPago: ('Anulado ' + M.ahoraChile().dia + ' · ' + (correo() || 'Sistema Fën') + ' · ' + m).slice(0, 500) }, { motivo: m }));
    return { ok: true };
  });
  if (!r.yaEstaba) await despues(1);
  return r;
}
// Un pago hecho por error: el vencimiento vuelve a quedar por pagar. Lo que decía el pago queda anotado en ObsPago.
export async function reabrirVencimiento(id, motivo) {
  const m = M.texto(motivo, 300); if (m.length < 3) throw error('Escribe el motivo', 'datos');
  const d = await db(), ref = FB.doc(d, 'vencimientos', String(id || '')), hoy = M.ahoraChile().dia;
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const a = sn.data(); if (a.estado !== 'PAGADO') return { ok: true, yaEstaba: true };
    const antes = 'antes: pagado el ' + dia(a.fechaPago) + ' por $' + M.n(a.montoPago) + (a.urlComprobante ? ' · ' + a.urlComprobante : '');
    tx.update(ref, cambio(a, 'reabrió', { estado: dia(a.fechaVencimiento) < hoy ? 'VENCIDA' : 'PENDIENTE', fechaPago: '', montoPago: '', urlComprobante: '',
      obsPago: ('Pago anulado ' + hoy + ' · ' + (correo() || 'Sistema Fën') + ' · ' + m + ' · ' + antes).slice(0, 500) }, { motivo: m }));
    return { ok: true };
  });
  if (!r.yaEstaba) await despues(1);
  return r;
}

// ═══════════════════════════════════════════════
//  v0.47.0 · Obligaciones (obl_plantillas, obl_historial, obl_guardar, obl_archivar, obl_activar)
// ═══════════════════════════════════════════════
export async function plantillas() {
  const [ps, vencs] = await Promise.all([todos('obligaciones'), todos('vencimientos')]);
  return { ok: true, plantillas: M.plantillasVista(ps, vencs, M.ahoraChile().dia) };
}
export async function historialPagos(filtro) {
  const r = M.historialPagos(await todos('vencimientos'), filtro || {});
  if (r.error) throw error(r.error, 'datos');
  return { ok: true, historial: r.historial };
}
// Crear o editar. marca: fija por envío (un reintento crea la misma obligación, no otra)
export async function guardarObligacion(p, marca) {
  const d = await db(), hoy = M.ahoraChile().dia, id0 = p && p.id ? String(p.id) : '';
  const cat = await catalogo();
  const ex = id0 ? cat.plantillas.find(x => (s(x.d.id) || x.id) === id0 && !x.d.quitadoEnPlanilla) : null;
  const r = M.obligacionDesdeForm(p || {}, ex ? M.vistaPlantilla(ex.id, ex.d, [], hoy) : null, cat.lista.filter(i => !i.archivado));
  if (r.error) throw error(r.error, 'datos');
  if (ex) {
    const ref = FB.doc(d, 'obligaciones', ex.id);
    const n = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref); if (!sn.exists()) throw error('Esa obligación ya no existe', 'datos');
      const a = sn.data(), campos = M.camposPlantilla(r.d);
      if (!Object.keys(M.diferencias(a, campos)).length) return 0;
      tx.update(ref, cambio(a, 'editó', campos));
      return 1;
    });
    await despues(n);
    return { ok: true };
  }
  const id = M.idPlantilla(marca), ref = FB.doc(d, 'obligaciones', id), clave = marca.t + marca.r;
  const cuotas = r.d.frecuencia === 'cuponera' ? M.vencimientosCuponera(id, r.d, hoy) : [];
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref);
    if (sn.exists()) { if (sn.data().clave === clave) return 0; throw error('Se cruzó con otra obligación creada en el mismo instante: vuelve a guardar.', 'datos'); }
    const refsV = cuotas.map(x => FB.doc(d, 'vencimientos', x.id)), snV = [];
    for (const rv of refsV) snV.push(await tx.get(rv));
    tx.set(ref, nuevo({ ...M.docPlantillaNueva(id, r.d, hoy), clave }, 'mano'));
    let k = 1;
    cuotas.forEach((x, i) => { if (!snV[i].exists()) { tx.set(refsV[i], nuevo(x.d, 'obligacion')); k++; } });
    return k;
  });
  await despues(n);
  // Su primer vencimiento de inmediato, sin esperar (como savePlantilla → generarVencimientos)
  if (r.d.frecuencia !== 'cuponera') { try { await vencimientosAlDia(); } catch (e) {} }
  return { ok: true, id, repetido: !n };
}
export async function archivarObligacion(id, archivar) {
  const hoy = M.ahoraChile().dia, e = M.estadoPlantilla(id, !archivar, hoy);
  if (e.error) throw error(e.error, 'datos');
  const d = await db(), ps = await todos('obligaciones');
  const x = ps.find(y => !y.d.quitadoEnPlanilla && (s(y.d.id) || y.id) === String(id));
  if (!x) throw error('No encontrado', 'datos');
  const ref = FB.doc(d, 'obligaciones', x.id);
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('No encontrado', 'datos');
    const a = sn.data();
    if (!Object.keys(M.diferencias(a, e.campos)).length) return 0;
    tx.update(ref, cambio(a, archivar ? 'archivó' : 'reactivó', e.campos));
    return 1;
  });
  await despues(n);
  // Reactivar: vuelve a generar sus vencimientos (como activarPlantilla → generarVencimientos)
  if (!archivar) { try { await vencimientosAlDia(); } catch (er) {} }
  return { ok: true };
}

// ═══════════════════════════════════════════════
//  v0.47.0 · Ítems (items_todos, item_guardar, item_mover, item_archivar). No se borran.
// ═══════════════════════════════════════════════
export async function itemsTodos() {
  const [items, ps] = await Promise.all([todos('items'), todos('obligaciones')]);
  return { ok: true, items: M.itemsTodos(items, ps) };
}
export async function guardarItem(p) {
  const f = M.itemDesdeForm(p || {});
  if (f.error) throw error(f.error, 'datos');
  const d = await db(), plan = M.planGuardarItem(await todos('items'), f.d);
  if (plan.error) throw error(plan.error, 'datos');
  if (plan.editar) {
    const ref = FB.doc(d, 'items', plan.editar.id);
    const n = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref); if (!sn.exists()) throw error('Ítem no encontrado', 'datos');
      const a = sn.data();
      if (!Object.keys(M.diferencias(a, plan.editar.campos)).length) return 0;
      tx.update(ref, cambio(a, 'editó', plan.editar.campos));
      return 1;
    });
    await despues(n);
    return { ok: true };
  }
  const ref = FB.doc(d, 'items', plan.crear.id);
  await FB.runTransaction(d, async tx => {
    if ((await tx.get(ref)).exists()) throw error('Ya existe un ítem con ese nombre', 'datos');
    tx.set(ref, nuevo(plan.crear.doc, 'mano'));
  });
  await despues(1);
  return { ok: true, id: plan.crear.id };
}
export async function moverItem(nombre, direccion) {
  const d = await db(), plan = M.planMoverItem(await todos('items'), nombre, direccion);
  if (plan.error) throw error(plan.error, 'datos');
  if (!plan.cambios.length) return { ok: true };
  const refs = plan.cambios.map(c => FB.doc(d, 'items', c.id));
  await FB.runTransaction(d, async tx => {
    const sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    sns.forEach((sn, i) => { if (!sn.exists()) throw error('Ítem no encontrado', 'datos'); });
    sns.forEach((sn, i) => tx.update(refs[i], cambio(sn.data(), 'movió', { orden: plan.cambios[i].orden })));
  });
  await despues(refs.length);
  return { ok: true };
}
export async function archivarItem(nombre, archivar) {
  const d = await db(), plan = M.planArchivarItem(await todos('items'), nombre, archivar);
  if (plan.error) throw error(plan.error, 'datos');
  const ref = FB.doc(d, 'items', plan.id);
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ítem no encontrado', 'datos');
    const a = sn.data();
    if (!Object.keys(M.diferencias(a, plan.campos)).length) return 0;
    tx.update(ref, cambio(a, archivar ? 'archivó' : 'reactivó', plan.campos));
    return 1;
  });
  await despues(n);
  return { ok: true };
}
