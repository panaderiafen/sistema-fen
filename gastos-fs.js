// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos con la base nueva (fen-gastos), etapa G2  v0.47.0 · v0.49.0
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
//  · v0.48.0 (etapa G3): las Cargas del SII usan estas mismas marcas (gastos-sii-fs.js: exportadas abajo).
//  · v0.49.0 (etapa G3, segunda parte; reglas en gastos-g3.js): estado nuevo de los vencimientos (esperando_documento,
//    por_pagar, con_abonos, pagado, anulado; lo copiado de la planilla se lee igual), tipo e identificador de la obligación,
//    subir la boleta del mes (completa su vencimiento o va a la bandeja "documentos_pendientes"), abonos y cerrar
//    (tipo libre), vencimiento suelto. Los de tipo documento se crean 20 días antes (para esperar la boleta).
//  · v0.51.0: pagar un vencimiento con el certificado de Previred crea un gasto por trabajador (gastos-g3d.js: lineasDelPago).
//  · v0.63.1 (gastos-banco.js): lo que se paga por banco llega con la cartola. Cada vencimiento lleva "sePagaPor" (el de su
//    obligación; sin el campo = banco). Un gasto registrado a mano por transferencia o banco, o el pago a mano de un vencimiento
//    de banco, queda con esperaCargo = true (se apaga al vincularlo con su cargo). Lo nuevo guarda "origenDetalle" (de dónde
//    salió: tipo, quién, cuándo y lo propio de cada origen); "origen" sigue siendo el texto de siempre (el script lo usa).
//    Hoy: "Esperan cartola". detalleGasto(ids): las líneas y su origen, para el detalle del gasto.
// ═══════════════════════════════════════════════
import { auth as authSF } from './firebase.js?v=0.63.3';
import * as FB from './fs-gastos.js?v=0.63.3';
import * as GB from './gastos-base.js?v=0.63.3';
import * as GP from './gastos-planilla.js?v=0.63.3';
import * as M from './gastos-g2.js?v=0.63.3';
import * as G3 from './gastos-g3.js?v=0.63.3';
import * as G3D from './gastos-g3d.js?v=0.63.3';
import * as B from './gastos-banco.js?v=0.63.3';
import { dia } from './gastos-modelo.js?v=0.63.3';
import * as AB from './gastos-abono.js?v=0.63.3';

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
// v0.48.0 · para las Cargas del SII (gastos-sii-fs.js)
// v0.49.0 · Vencimiento nuevo con el estado nuevo (por_pagar; esperando_documento si su obligación es de tipo documento)
const nuevoVenc = (d, origen, por, obligacion) => nuevo(G3.alCrear(d, obligacion || null), origen, por);
export { db as dbBase, todos, catalogo, nuevo, cambio, despues, limpio, correo, nuevoVenc };

// ── Vencimientos que se generan solos (3 días antes) y estados al día ──
// Al leer, como getVencimientos del script. Ids fijos; la transacción crea solo los que no están (dos pestañas no duplican).
const AUTO = 'Sistema Fën (automático)';
async function alDia(plantillas, vencs) {
  const hoy = M.ahoraChile().dia, d = await db();
  const g = M.generarVencimientos(plantillas, vencs, hoy, { antelacion: p => (G3.tipoDe(p) === 'documento' ? G3.ANTELACION_DOCUMENTO : 0) }), est = M.cambiosDeEstado(vencs, hoy);
  const oblDe = x => { const p = plantillas.find(y => y.id === x.plantillaDocId); return p ? p.d : null; };
  if (!g.nuevos.length && !est.length && !g.archivar.length) return false;
  const escritos = await FB.runTransaction(d, async tx => {
    const refsN = g.nuevos.map(x => FB.doc(d, 'vencimientos', x.id)), refsE = est.map(x => FB.doc(d, 'vencimientos', x.id)), refsA = g.archivar.map(id => FB.doc(d, 'obligaciones', id));
    const sN = [], sE = [], sA = [];
    for (const r of refsN) sN.push(await tx.get(r));
    for (const r of refsE) sE.push(await tx.get(r));
    for (const r of refsA) sA.push(await tx.get(r));
    let k = 0;
    g.nuevos.forEach((x, i) => { if (!sN[i].exists()) { tx.set(refsN[i], nuevoVenc(x.d, 'obligacion', AUTO, oblDe(x))); k++; } });
    est.forEach((x, i) => { const a = sE[i].exists() ? sE[i].data() : null; if (a && a.estado !== x.estado && (a.estado === 'PENDIENTE' || a.estado === 'VENCIDA')) { tx.update(refsE[i], cambio(a, 'estado al día', { estado: x.estado }, null, AUTO)); k++; } });
    g.archivar.forEach((id, i) => { const a = sA[i].exists() ? sA[i].data() : null; if (a && a.estado === 'ACTIVA') { tx.update(refsA[i], cambio(a, 'archivada al generar su vencimiento', { estado: 'ARCHIVADA' }, null, AUTO)); k++; } });
    return k;
  });
  await despues(escritos);
  return true;   // había algo por hacer (aunque lo haya hecho otra pestaña): se vuelve a leer
}
export async function vencimientosAlDia() {
  let [vencs, cat] = await Promise.all([todos('vencimientos'), catalogo()]);
  if (await alDia(cat.plantillas, vencs)) { [vencs, cat] = await Promise.all([todos('vencimientos'), catalogo()]); }
  return { vencs, cat };
}

// ── datos: vencimientos al día e ítems para registrar (como sfGastosDatos) ──
export async function datos() {
  const { vencs, cat } = await vencimientosAlDia();
  const activos = cat.lista.filter(i => !i.archivado);
  const sp = B.mapaSePaga(cat.plantillas);   // v0.63.1: cómo se paga cada vencimiento (el de su obligación)
  const vencimientos = M.vencimientosVisibles(vencs, M.ahoraChile().dia).map(v => ({ ...v, sePagaPor: B.sePagaVenc(v, sp) }));
  return { ok: true, vencimientos, items: activos.filter(i => !i.esObligacionRecurrente), itemsSii: activos, areas: M.AREAS.slice(), fuente: 'base' };
}
// Para Hoy: atrasados y próximos 7 días (como sfPendientes del script), con los vencimientos al día
// v0.63.1: más "Esperan cartola" (vencimientos de banco atrasados sin cargo y gastos que esperan su cargo). Los de banco que ya
// esperan la cartola no se repiten en "Pagos atrasados".
export async function pendientesHoy() {
  const { vencs, cat } = await vencimientosAlDia(), hoy = M.ahoraChile().dia;
  let espera = [];
  try { espera = await todos('gastos', FB.where('esperaCargo', '==', true)); } catch (e) { espera = []; }
  const ec = B.esperanCartola({ vencs, plantillas: cat.plantillas, gastos: espera, hoy });
  const ya = new Set(ec.vencimientos.map(v => v.id));
  const l = M.pendientesHoy(vencs.filter(x => !ya.has(x.id)), hoy);
  return ec.total ? l.concat([{ clave: 'esperan_cartola', cantidad: ec.total, vencimientos: ec.vencimientos, gastos: ec.gastos, lineas: B.lineasEsperan(ec) }]) : l;
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
  // v0.49.0: desde la bandeja, la boleta ya está en Drive (urlArchivo); se registra con ese enlace
  const yaEnDrive = /^https:\/\/drive\.google\.com\//.test(String(p.urlArchivo || ''));
  if (!p.imageData && !yaEnDrive) throw error('Falta la foto o el archivo de la boleta', 'datos');
  if (!/^\d{2}-\d{2}-\d{4}$/.test(String(p.fecha || ''))) throw error('Falta la fecha de compra', 'datos');
  const fecha = dia(p.fecha);
  const forma = ['contado', 'tarjeta', 'proveedor'].includes(p.formaPago) ? p.formaPago : 'contado';
  if (forma !== 'contado' && !M.esIso(p.fechaPago)) throw error('Falta la fecha de pago del crédito', 'datos');
  // v0.63.1: al contado, en efectivo o por banco (transferencia): lo de banco espera su cargo en la cartola
  const medio = forma === 'contado' ? (p.medioPago === 'banco' ? 'banco' : 'efectivo') : '';
  const cat = await catalogo(), li = M.limpiarItems(items, cat.lista.filter(i => !i.archivado));
  if (li.error) throw error(li.error, 'datos');
  const d = await db(), hoy = M.ahoraChile().dia;
  // ¿Ya quedó (un reintento del mismo envío)? Entonces no se sube la boleta otra vez
  const ids0 = M.idsLineas('g', marca, 1);
  if ((await FB.getDoc(FB.doc(d, 'gastos', ids0[0]))).exists()) return { ok: true, items: li.limpios.length, repetido: true };
  const nombre = String(p.fileName || 'boleta.jpg').slice(0, 120);
  const arch = yaEnDrive && !p.imageData ? { url: String(p.urlArchivo) } : await subir({ tipo: 'boleta', fecha: p.fecha, imageData: p.imageData, mimeType: p.mimeType || 'image/jpeg', fileName: nombre });
  const refP = p.pendienteId ? FB.doc(d, 'documentos_pendientes', String(p.pendienteId)) : null;
  const e = { fecha, hora: String(p.hora || '').slice(0, 5), tipoMonto: M.tipoMontoOk(p.tipoMonto), formaPago: forma, fechaPago: forma === 'contado' ? '' : p.fechaPago,
    observacion: p.observacion || '', archivo: nombre, urlFoto: arch.url || '' };
  const lineas = M.lineasCompra(e, li.limpios), venc = M.vencimientoCredito(e, li.limpios, hoy);
  const ids = M.idsLineas('g', marca, lineas.length), idV = M.idVencCredito(marca);
  const refs = ids.map(id => FB.doc(d, 'gastos', id)), refV = FB.doc(d, 'vencimientos', idV);
  const r = await FB.runTransaction(d, async tx => {
    if ((await tx.get(refs[0])).exists()) return { repetido: true };
    const snP = refP ? await tx.get(refP) : null, pend = snP && snP.exists() && snP.data().estado === 'pendiente' ? snP.data() : null;
    const od = { tipo: 'mano', medio: medio || forma, por: correo(), en: M.ahoraChile().texto, ...(pend ? { pendienteId: refP.id } : {}) };
    lineas.forEach((l, k) => tx.set(refs[k], nuevo({ ...l, ...(venc ? { vencimientoId: idV } : {}), ...(medio ? { medioPago: medio } : {}), ...(medio === 'banco' ? { esperaCargo: true } : {}), origenDetalle: od }, 'mano')));
    if (venc) tx.set(refV, nuevoVenc({ ...venc, id: idV }, 'credito'));
    if (pend) tx.update(refP, cambio(pend, 'registró como gasto', { estado: 'gasto', resultado: { gastoIds: ids, por: correo(), en: M.ahoraChile().texto } }));
    return { repetido: false };
  });
  if (!r.repetido) await despues(lineas.length + (venc ? 1 : 0) + (refP ? 1 : 0));
  return { ok: true, items: li.limpios.length, lineas: lineas.length, ids, vencimiento: venc ? idV : '', repetido: r.repetido, esperaCargo: medio === 'banco' };
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
const conLineas0 = v => !!(v.plantillaId || v.suelto);
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
  // v0.63.1: pagar a mano un vencimiento que se paga por banco: sus gastos esperan el cargo de la cartola (y lo dicen)
  const esperaCargo = p.esperaCargo === true;
  if (v0.estado === 'PAGADO') {
    // Un reintento del mismo envío (ya quedó): responde como si recién se hubiera hecho
    if (conLineas0(v0) && (await FB.getDoc(FB.doc(d, 'gastos', M.idsLineas('gp', marca, 1)[0]))).exists()) return { ok: true, repetido: true };
    if (!conLineas0(v0) && (sn0.data().pago || {}).clave === marca.t + marca.r) return { ok: true, repetido: true };
    throw error(`Ese vencimiento ya estaba pagado (${v0.fechaPago || ''})`, 'pagado');
  }
  if (v0.estado === 'ANULADO') throw error('Ese vencimiento fue anulado. Recarga para ver el estado actual.', 'anulado');
  if (G3.estadoBase(sn0.data()) === 'con_abonos') throw error('Este vencimiento tiene abonos: agrega otro abono o ciérralo.', 'abonos');
  const conLineas = !!(v0.plantillaId || v0.suelto);   // v0.49.0: un vencimiento suelto se paga como una obligación
  // Comprobante a Drive ("Comprobantes de pago / <año del pago>"), privado
  let url = '';
  if (p.imageData) url = (await subir({ tipo: 'comprobante', fecha: p.fechaPago, imageData: p.imageData, mimeType: p.mimeType || 'image/jpeg', fileName: String(p.fileName || 'comprobante.jpg').slice(0, 120) })).url || '';
  // Compra a crédito: el gasto ya existe (se creó al comprar); se le completa la fecha de pago y el comprobante
  let credito = [];
  if (!conLineas && v0.item) {
    const delItem = (await todos('gastos', FB.where('itemGasto', '==', v0.item)))
      .sort((a, b) => (b.d.fecha || '').localeCompare(a.d.fecha || '') || (b.d.hora || '').localeCompare(a.d.hora || '') || b.id.localeCompare(a.id));
    credito = M.gastosDelCredito(v0, delItem);
  }
  const hora = M.ahoraChile().hora;
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(refV), refsC = credito.map(x => FB.doc(d, 'gastos', x.id)), snC = [];
    for (const rf of refsC) snC.push(await tx.get(rf));
    const a = sn.data();
    const ea = G3.estadoBase(a);
    if (ea === 'pagado') throw error(`Ese vencimiento ya estaba pagado (${dia(a.fechaPago) || ''})`, 'pagado');
    if (ea === 'anulado') throw error('Ese vencimiento fue anulado. Recarga para ver el estado actual.', 'anulado');
    if (ea === 'con_abonos') throw error('Este vencimiento tiene abonos: agrega otro abono o ciérralo.', 'abonos');
    const v = M.vistaVencimiento(id, a), extra = {};
    // Si en el pago se cambió el reparto por área, esos son los montos reales de este período
    if (areas.length) { extra.multiArea = JSON.stringify(areas); v.multiArea = areas; }
    let lineas = [], tocados = 0;
    if (conLineas) {
      // v0.50.0: factura del SII → con su RUT y folio. v0.51.0: certificado de Previred → un gasto por trabajador
      const lp = G3D.lineasDelPago(v, a, monto, p.fechaPago, obsPago, url, tipoMonto, hora);
      if (lp.error) throw error(lp.error, 'datos');
      lineas = lp.lineas;
      const ids = M.idsLineas('gp', marca, lineas.length);
      const od = { tipo: 'vencimiento', vencimientoId: id, obligacion: s(a.nombre), periodo: dia(a.fechaVencimiento) || '', aMano: true, por: correo(), en: M.ahoraChile().texto };
      lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, ...(esperaCargo ? { esperaCargo: true, medioPago: 'banco' } : {}), origenDetalle: od }, 'obligacion')));
    } else snC.forEach((s2, i) => {
      if (!s2.exists()) return; const g = s2.data(); if (g.fechaPago || g.estado !== 'vigente') return;
      tx.update(refsC[i], cambio(g, 'pagó', { fechaPago: p.fechaPago, ...(url ? { urlFoto: url } : {}) }, { vencimiento: id })); tocados++;
    });
    tx.update(refV, cambio(a, 'pagó', { ...extra, estado: 'pagado', fechaPago: p.fechaPago, montoPago: String(monto), obsPago, ...(url ? { urlComprobante: url } : {}), pago: { clave: marca.t + marca.r, ...(esperaCargo ? { aMano: true, esperaCargo: true } : {}) } }));
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
    const a = sn.data(), ea = G3.estadoBase(a);
    if (ea === 'anulado') return { ok: true, yaEstaba: true };
    if (ea === 'pagado') throw error('Ese vencimiento ya está pagado: no se puede anular. Si el pago fue un error, anula en Registrados el gasto que creó: ahí te ofrece dejar el vencimiento por pagar de nuevo.', 'pagado');
    tx.update(ref, cambio(a, 'anuló', { estado: 'anulado', obsPago: ('Anulado ' + M.ahoraChile().dia + ' · ' + (correo() || 'Sistema Fën') + ' · ' + m).slice(0, 500) }, { motivo: m }));
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
    const a = sn.data(); if (G3.estadoBase(a) !== 'pagado') return { ok: true, yaEstaba: true };
    const antes = 'antes: pagado el ' + dia(a.fechaPago) + ' por $' + M.n(a.montoPago) + (a.urlComprobante ? ' · ' + a.urlComprobante : '');
    // v0.49.0: vuelve por pagar (con sus abonos, si los tenía: se puede agregar otro o cerrarlo de nuevo)
    tx.update(ref, cambio(a, 'reabrió', { estado: Array.isArray(a.abonos) && a.abonos.length ? 'con_abonos' : 'por_pagar', fechaPago: '', montoPago: '', urlComprobante: '', ...(a.cerrado ? { cerrado: null } : {}),
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
  // v0.49.0: tipo (fijo, documento, libre), identificador y aviso, si el formulario los trae
  const clasif = p && p.tipoObligacion !== undefined ? G3.clasificacionDesdeForm(p) : null;
  if (clasif && clasif.error) throw error(clasif.error, 'datos');
  // v0.63.1: "Se paga por" también sin tipo (una obligación sin clasificar)
  const sp = B.sePagaPorOk(p && p.sePagaPor), extraSp = sp && !(clasif && clasif.campos.sePagaPor) ? { sePagaPor: sp } : {};
  if (ex) {
    const ref = FB.doc(d, 'obligaciones', ex.id), pid = s(ex.d.id) || ex.id;
    // Al cambiar el tipo, sus vencimientos abiertos sin documento ni abonos toman el tipo nuevo (los demás no se tocan)
    const recl = clasif && clasif.campos.tipoObligacion !== s(ex.d.tipoObligacion) || (clasif && clasif.campos.tipoObligacion === 'documento' && String(clasif.campos.diasAviso) !== String(ex.d.diasAviso))
      ? G3.reclasificar(await todos('vencimientos'), pid, clasif.campos) : [];
    const n = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref); if (!sn.exists()) throw error('Esa obligación ya no existe', 'datos');
      const refsV = recl.map(x => FB.doc(d, 'vencimientos', x.id)), snV = [];
      for (const rv of refsV) snV.push(await tx.get(rv));
      const a = sn.data(), campos = { ...M.camposPlantilla(r.d), ...(clasif ? clasif.campos : {}), ...extraSp };
      let k = 0;
      if (Object.keys(M.diferencias(a, campos)).length) { tx.update(ref, cambio(a, clasif && clasif.campos.tipoObligacion !== s(a.tipoObligacion) ? 'clasificó' : 'editó', campos)); k++; }
      recl.forEach((x, i) => { if (snV[i].exists() && !snV[i].data().documento) { tx.update(refsV[i], cambio(snV[i].data(), 'tomó el tipo de su obligación', x.campos)); k++; } });
      return k;
    });
    await despues(n);
    return { ok: true, id: pid };
  }
  const id = M.idPlantilla(marca), ref = FB.doc(d, 'obligaciones', id), clave = marca.t + marca.r;
  const docNuevo = { ...M.docPlantillaNueva(id, r.d, hoy), clave, ...(clasif ? clasif.campos : {}), ...extraSp };
  const cuotas = r.d.frecuencia === 'cuponera' ? M.vencimientosCuponera(id, r.d, hoy) : [];
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref);
    if (sn.exists()) { if (sn.data().clave === clave) return 0; throw error('Se cruzó con otra obligación creada en el mismo instante: vuelve a guardar.', 'datos'); }
    const refsV = cuotas.map(x => FB.doc(d, 'vencimientos', x.id)), snV = [];
    for (const rv of refsV) snV.push(await tx.get(rv));
    tx.set(ref, nuevo(docNuevo, 'mano'));
    let k = 1;
    cuotas.forEach((x, i) => { if (!snV[i].exists()) { tx.set(refsV[i], nuevoVenc(x.d, 'obligacion', null, docNuevo)); k++; } });
    return k;
  });
  await despues(n);
  // Su primer vencimiento de inmediato, sin esperar (como savePlantilla → generarVencimientos)
  if (r.d.frecuencia !== 'cuponera') { try { await vencimientosAlDia(); } catch (e) {} }
  // v0.49.0: creada desde un documento de la bandeja: el documento completa su primer vencimiento
  if (p && p.pendienteId) { try { await resolverPendiente(String(p.pendienteId), 'asignar', { obligacionId: id }); } catch (e) { return { ok: true, id, repetido: !n, avisoPendiente: e.message || String(e) }; } }
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

// ═══════════════════════════════════════════════
//  v0.49.0 · Etapa G3 (segunda parte): boletas del mes, bandeja, abonos y vencimientos sueltos (reglas en gastos-g3.js)
// ═══════════════════════════════════════════════
const dma = iso => String(iso || '').split('-').reverse().join('-');
// Completa (o crea) el vencimiento de la obligación con el documento, dentro de una transacción ya abierta.
// obl: { id, d } de la obligación; doc: datos del documento. Devuelve el id del vencimiento.
async function planCompletar(obl, doc, vencs, hoy, vencIdPedido) {
  const pid = s(obl.d.id) || obl.id;
  if (vencIdPedido) {
    const x = vencs.find(y => y.id === vencIdPedido && !y.d.quitadoEnPlanilla);
    if (!x) throw error('Ese vencimiento ya no existe', 'datos');
    return { id: x.id, crear: null };
  }
  const x = G3.elegirVencimiento(vencs, pid, doc.fechaVencimiento);
  if (x) return { id: x.id, crear: null };
  // No está generado todavía: el del período que viene (como lo generaría la obligación), o con la fecha del documento
  const vp = M.vistaPlantilla(obl.id, obl.d, vencs, hoy);
  const ids = new Set(vencs.map(y => y.id));
  let fecha = M.esIso(vp.proximaFecha) ? vp.proximaFecha : doc.fechaVencimiento, nv = M.docVencDeObligacion(pid, obl.d, fecha, 'PENDIENTE');
  if (ids.has(nv.id)) { fecha = doc.fechaVencimiento; nv = M.docVencDeObligacion(pid, obl.d, fecha, 'PENDIENTE'); }
  if (ids.has(nv.id)) throw error('No se encontró un vencimiento por completar de esa obligación', 'datos');
  return { id: nv.id, crear: G3.alCrear(nv.d, { ...obl.d, tipoObligacion: 'documento' }) };
}
function aplicarCompletar(tx, d, plan, snV, doc, obl, snO) {
  const ref = FB.doc(d, 'vencimientos', plan.id), quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto;
  let k = 0;
  if (plan.crear) {
    if (snV.exists()) throw error('Se cruzó con otra pestaña: vuelve a intentarlo', 'cambio');
    const c = G3.completarDocumento(plan.crear, doc, quien, en); if (c.error) throw error(c.error, 'datos');
    tx.set(ref, nuevo({ ...plan.crear, ...c.campos }, 'obligacion')); k++;
  } else {
    if (!snV.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const a = snV.data(), c = G3.completarDocumento(a, doc, quien, en); if (c.error) throw error(c.error + ' (' + s(a.nombre) + ')', 'datos');
    if (a.documento) throw error('Ese vencimiento ya tiene su documento', 'datos');
    tx.update(ref, cambio(a, 'recibió su documento', c.campos)); k++;
  }
  // El N° de cliente queda guardado en la obligación si no lo tenía (así la próxima boleta se reconoce sola)
  if (obl && snO && snO.exists() && doc.cliente && !s(snO.data().identificador).trim()) {
    const o = snO.data(), campos = { identificador: s(doc.cliente).slice(0, 40), ...(G3.sinClasificar(o) ? { tipoObligacion: 'documento', diasAviso: G3.diasAvisoDe(o) } : {}) };
    tx.update(FB.doc(d, 'obligaciones', obl.id), cambio(o, 'guardó el N° de cliente de su boleta', campos)); k++;
  }
  return k;
}

// Subir la boleta del mes (luz, agua): a Drive "Boletas y facturas / año" (privada) y a su vencimiento, o a la bandeja.
// p = { imageData, mimeType, fileName, cliente, monto, fechaVencimiento (aaaa-mm-dd), empresa, vencId? }
export async function subirBoleta(p, marca, subir) {
  const doc = { tipo: 'boleta', cliente: G3.normIdent(p.cliente) ? s(p.cliente).trim().slice(0, 40) : '', monto: Math.round(M.n(p.monto)), fechaVencimiento: s(p.fechaVencimiento), empresa: M.texto(p.empresa, 80), numero: M.texto(p.numero, 40) };
  if (!p.imageData) throw error('Falta el PDF o la foto de la boleta', 'datos');
  if (!(doc.monto > 0)) throw error('Escribe el total a pagar', 'datos');
  if (!M.esIso(doc.fechaVencimiento)) throw error('Escribe la fecha de vencimiento', 'datos');
  const d = await db(), hoy = M.ahoraChile().dia, clave = marca.t + marca.r, idP = 'dp-' + marca.t + '-' + marca.r;
  let [vencs, ps] = await Promise.all([todos('vencimientos'), todos('obligaciones')]);
  // ¿Ya quedó (un reintento del mismo envío)?
  const ya = vencs.find(x => x.d.documento && x.d.documento.clave === clave);
  if (ya) return { ok: true, repetido: true, destino: 'vencimiento', vencimientoId: ya.id };
  if ((await FB.getDoc(FB.doc(d, 'documentos_pendientes', idP))).exists()) return { ok: true, repetido: true, destino: 'bandeja', pendienteId: idP };
  const nombre = String(p.fileName || 'boleta.pdf').slice(0, 120);
  const arch = await subir({ tipo: 'boleta', fecha: dma(doc.fechaVencimiento), imageData: p.imageData, mimeType: p.mimeType || 'application/pdf', fileName: nombre });
  Object.assign(doc, { url: arch.url || '', nombreArchivo: nombre, clave });
  // ¿De qué obligación es? La del vencimiento elegido, o la única con ese N° de cliente
  let obl = null, vencId = '', motivo = '';
  if (p.vencId) {
    const v = vencs.find(x => x.id === String(p.vencId));
    if (!v) throw error('Ese vencimiento ya no existe', 'datos');
    vencId = v.id;
    obl = ps.find(x => (s(x.d.id) || x.id) === s(v.d.plantillaID)) || null;
  } else {
    const l = G3.obligacionesDe(ps, doc.cliente);
    if (l.length === 1) obl = l[0];
    else motivo = !doc.cliente ? 'Sin N° de cliente' : l.length ? 'Hay ' + l.length + ' obligaciones con ese N° de cliente' : 'Ninguna obligación tiene ese N° de cliente';
  }
  if (!obl && !vencId) {
    const ref = FB.doc(d, 'documentos_pendientes', idP);
    await FB.runTransaction(d, async tx => {
      if ((await tx.get(ref)).exists()) return;
      tx.set(ref, nuevo({ id: idP, tipo: 'boleta', estado: 'pendiente', motivo, cliente: doc.cliente, monto: doc.monto, fechaVencimiento: doc.fechaVencimiento, empresa: doc.empresa, numero: doc.numero,
        archivo: { url: doc.url, nombre }, clave }, 'boleta'));
    });
    await despues(1);
    return { ok: true, destino: 'bandeja', pendienteId: idP, motivo };
  }
  const r = await completarCon(obl, doc, vencId);
  return { ok: true, destino: 'vencimiento', ...r };
}
// Completa el vencimiento (transacción) y devuelve { vencimientoId, obligacion }. v0.50.0: también para la factura del SII
export async function completarCon(obl, doc, vencId, extra) {
  const d = await db(), hoy = M.ahoraChile().dia, vencs = await todos('vencimientos');
  const plan = obl ? await planCompletar(obl, doc, vencs, hoy, vencId) : { id: vencId, crear: null };
  const refV = FB.doc(d, 'vencimientos', plan.id), refO = obl ? FB.doc(d, 'obligaciones', obl.id) : null;
  const n = await FB.runTransaction(d, async tx => {
    const snV = await tx.get(refV), snO = refO ? await tx.get(refO) : null;
    const snE = extra ? await tx.get(extra.ref) : null;
    let k = aplicarCompletar(tx, d, plan, snV, doc, obl, snO);
    if (extra) { if (!snE.exists() || snE.data().estado !== 'pendiente') throw error('Ese documento ya no está en la bandeja', 'cambio'); tx.update(extra.ref, cambio(snE.data(), extra.que, extra.campos(plan.id))); k++; }
    return k;
  });
  await despues(n);
  return { vencimientoId: plan.id, obligacion: obl ? s(obl.d.nombre) : '' };
}

// ── Bandeja "Documentos sin obligación" (documentos_pendientes). Nada se borra: descartar deja quién y cuándo ──
export async function documentosPendientes() {
  const l = (await todos('documentos_pendientes')).map(x => ({ id: x.id, ...x.d, creado: x.d.creado ? { por: s(x.d.creado.por) } : null, historial: undefined, editado: undefined }));
  l.sort((a, b) => s(b.id).localeCompare(s(a.id)));
  return { ok: true, documentos: l };
}
// accion: 'asignar' ({ obligacionId }) | 'descartar' ({ motivo })
export async function resolverPendiente(id, accion, datos = {}) {
  const d = await db(), ref = FB.doc(d, 'documentos_pendientes', String(id || ''));
  const sn = await FB.getDoc(ref);
  if (!sn.exists()) throw error('Ese documento ya no está en la bandeja', 'datos');
  const x = sn.data(), quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto;
  if (x.estado !== 'pendiente') throw error('Ese documento ya se resolvió', 'cambio');
  if (accion === 'descartar') {
    const m = M.texto(datos.motivo, 300);
    await FB.runTransaction(d, async tx => { const s2 = await tx.get(ref); if (s2.data().estado !== 'pendiente') throw error('Ese documento ya se resolvió', 'cambio');
      tx.update(ref, cambio(s2.data(), 'descartó', { estado: 'descartado', descartado: { por: quien, en, motivo: m } })); });
    await despues(1);
    return { ok: true };
  }
  if (accion !== 'asignar') throw error('Acción no válida', 'datos');
  const ps = await todos('obligaciones'), obl = ps.find(o => (s(o.d.id) || o.id) === String(datos.obligacionId || '') && !o.d.quitadoEnPlanilla);
  if (!obl) throw error('Elige la obligación', 'datos');
  const doc = { tipo: x.tipo || 'boleta', cliente: s(x.cliente), monto: x.monto, fechaVencimiento: s(x.fechaVencimiento), url: (x.archivo || {}).url || '', nombreArchivo: (x.archivo || {}).nombre || '', numero: s(x.numero), clave: s(x.clave), pendienteId: String(id),
    rut: s(x.rut), razonSocial: s(x.razonSocial), siiDocId: s(x.siiDocId), ...(x.montosSii && typeof x.montosSii === 'object' ? x.montosSii : {}) };   // v0.50.0: una factura del SII trae su RUT y razón social (v0.53.0: y sus montos)
  const r = await completarCon(obl, doc, '', { ref, que: 'asignó a una obligación', campos: vid => ({ estado: 'asignado', resultado: { obligacionId: s(obl.d.id) || obl.id, vencimientoId: vid, por: quien, en } }) });
  return { ok: true, ...r };
}

// ── Abonos (obligación de tipo libre: sueldos líquidos). Cada abono crea su gasto con el ítem de la obligación ──
// a = { monto, fecha (aaaa-mm-dd), origen ('mano' | 'cartola'), cargoId, obs, imageData… (comprobante, opcional),
//       v0.63.1: areas [{ area, pct }] (opcional), fuenteArea, destinatario { rut, descripcion, nombre } (opcional) }.
// La etapa G3 (cartola) puede llamarla con { origen: 'cartola', cargoId }: el mismo cargo no se agrega dos veces.
// v0.63.1 · El área es la de ESTE abono (una o un reparto en %), no la de la obligación: sin "areas", la propuesta
// (lo recordado para el destinatario → el área de Previred del trabajador → la de la obligación). Lo elegido queda
// recordado en abono_destinatarios/{id} (con su historial; no pasa a la planilla: los gastos sí, con su área).
export async function agregarAbono(vencId, a, marca, subir) {
  const d = await db(), ref = FB.doc(d, 'vencimientos', String(vencId || '')), sn0 = await FB.getDoc(ref);
  if (!sn0.exists() || sn0.data().quitadoEnPlanilla) throw error('Ese vencimiento ya no existe', 'datos');
  const v0 = sn0.data(), clave = marca.t + marca.r;
  if (s(v0.tipoObligacion) !== 'libre') throw error('Solo los vencimientos de tipo libre reciben abonos', 'datos');
  const pre = G3.agregarAbono(v0, { ...a, clave });
  if (pre.repetido) return { ok: true, repetido: true };
  if (pre.error) throw error(pre.error, 'datos');
  const dest = AB.claveDestinatario(a.destinatario), refD = dest ? FB.doc(d, 'abono_destinatarios', dest.id) : null;
  let areas = [], fuenteArea = '';
  if (Array.isArray(a.areas) && a.areas.length) {
    const x = AB.validarAreas(a.areas, M.AREAS); if (x.error) throw error(x.error, 'datos');
    areas = x.areas; fuenteArea = Object.keys(AB.FUENTES).includes(s(a.fuenteArea)) ? s(a.fuenteArea) : 'elegido';
  } else {
    const [ds, trab] = await Promise.all([dest ? todos('abono_destinatarios') : [], todos('cotiz_trabajadores')]);
    const t = AB.trabajadorDe(vivos(trab).map(x => x.d), dest ? (dest.nombre || s((a.destinatario || {}).descripcion)) : '', (a.destinatario || {}).rut);
    const x = AB.areasPorDefecto({ recordado: AB.recordadoDe(ds.map(y => y.d), dest, dest && dest.nombre), trabajador: t, v: M.vistaVencimiento(ref.id, v0), areas: M.AREAS });
    areas = x.areas; fuenteArea = x.fuente;
  }
  let url = '';
  if (a.imageData && subir) url = (await subir({ tipo: 'comprobante', fecha: dma(a.fecha), imageData: a.imageData, mimeType: a.mimeType || 'image/jpeg', fileName: String(a.fileName || 'comprobante.jpg').slice(0, 120) })).url || '';
  const hora = M.ahoraChile().hora, quien = correo() || 'Sistema Fën';
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), v = sn.data();
    const snD = refD ? await tx.get(refD) : null;
    const n0 = (Array.isArray(v.abonos) ? v.abonos.length : 0) + 1;
    const vista0 = M.vistaVencimiento(ref.id, v), vista = areas.length ? AB.vistaConAreas(vista0, areas, pre.abono.monto) : vista0;
    const obs0 = `Abono ${n0} · ${s(v.nombre)}${dest && dest.nombre ? ' · ' + dest.nombre : ''}`;
    const lineas = M.lineasPago(vista, pre.abono.monto, a.fecha, M.obsLibre(a.obs) || obs0, url, M.tipoMontoOk(v.tipoMonto), hora);
    const ids = M.idsLineas('gp', marca, lineas.length);
    const x = G3.agregarAbono(v, { ...a, clave, url, gastoIds: ids, por: quien, en: M.ahoraChile().texto, areas, fuenteArea, destinatario: dest });
    if (x.repetido) return { repetido: true };
    if (x.error) throw error(x.error, 'datos');
    // v0.50.0: un abono desde la cartola queda con su traza (columna Cartola) y el id del cargo
    // v0.63.0: un abono a mano de una obligación que se paga por banco espera su cargo; todos guardan de dónde salieron
    const od = { tipo: 'vencimiento', vencimientoId: ref.id, obligacion: s(v.nombre), periodo: dia(v.fechaVencimiento) || '', abono: n0, ...(a.cartola ? { cartola: true, cargoId: s(a.cargoId) } : { aMano: true }),
      ...(dest ? { destinatario: dest.nombre || dest.clave } : {}), ...(areas.length ? { areasAbono: AB.textoAreas(areas) } : {}), por: quien, en: M.ahoraChile().texto };
    lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, abono: n0, ...(a.cartola ? { cartola: s(a.cartola), cartolaCargo: s(a.cargoId) } : a.esperaCargo === true ? { esperaCargo: true, medioPago: 'banco' } : {}), origenDetalle: od }, 'obligacion')));
    tx.update(ref, cambio(v, 'abono', x.campos, { monto: x.abono.monto }));
    // v0.63.1 · lo elegido queda recordado para este destinatario (se propone la próxima vez, sin marcarlo seguro)
    // (si quedó el área de la obligación sin tocarla, no se recuerda: así Previred puede proponer después)
    if (refD && areas.length && fuenteArea !== 'obligacion') {
      const prev = snD && snD.exists() ? snD.data() : null, en = M.ahoraChile().texto;
      const campos = { clave: dest.clave, nombre: dest.nombre || s(prev && prev.nombre), areas, fuente: fuenteArea, veces: (Number(prev && prev.veces) || 0) + 1,
        ultimo: { vencimientoId: ref.id, obligacion: s(v.nombre), monto: x.abono.monto, fecha: a.fecha, origen: x.abono.origen, cargoId: s(a.cargoId), por: quien, en } };
      const h = M.conHistorial(prev && prev.historial, { que: prev ? 'abono' : 'recordó', por: quien, en, cambios: M.diferencias(prev, { areas: campos.areas, nombre: campos.nombre }) });
      if (prev) tx.update(refD, limpio({ ...campos, version: (Number(prev.version) || 0) + 1, historial: h }));
      else tx.set(refD, limpio({ ...campos, creado: { por: quien, en: FB.serverTimestamp() }, version: 0, historial: h }));
    }
    return { lineas: lineas.length, n: n0, total: G3.totalAbonos({ abonos: x.campos.abonos }), areas, fuenteArea };
  });
  if (!r.repetido) await despues(1 + r.lineas);
  return { ok: true, ...r };
}
// v0.63.1 · Para "Área de este abono": lo recordado por destinatario y los trabajadores de Previred (con su área)
export async function datosAbono() {
  const [ds, trab] = await Promise.all([todos('abono_destinatarios'), todos('cotiz_trabajadores')]);
  return { ok: true, destinatarios: ds.map(x => ({ id: x.id, clave: s(x.d.clave), nombre: s(x.d.nombre), areas: Array.isArray(x.d.areas) ? x.d.areas : [], veces: Number(x.d.veces) || 0 })),
    trabajadores: vivos(trab).map(x => ({ rut: s(x.d.rut), nombre: s(x.d.nombre), area: s(x.d.area) })).filter(x => x.nombre && x.area) };
}
export async function cerrarVencimiento(id) {
  const d = await db(), ref = FB.doc(d, 'vencimientos', String(id || ''));
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const x = G3.cerrar(sn.data(), correo() || 'Sistema Fën', M.ahoraChile().texto);
    if (x.yaEstaba) return { yaEstaba: true };
    if (x.error) throw error(x.error, 'datos');
    tx.update(ref, cambio(sn.data(), 'cerró', x.campos));
    return { total: Number(x.campos.montoPago) };
  });
  if (!r.yaEstaba) await despues(1);
  return { ok: true, ...r };
}

// ── Vencimiento suelto (un pago de una vez, sin obligación: una patente). Id "vl-<marca>" ──
export async function crearSuelto(p, marca) {
  const cat = await catalogo(), hoy = M.ahoraChile().dia;
  const r = G3.vencimientoSuelto(p || {}, cat.lista.filter(i => !i.archivado), hoy);
  if (r.error) throw error(r.error, 'datos');
  const d = await db(), id = 'vl-' + marca.t + '-' + marca.r, ref = FB.doc(d, 'vencimientos', id);
  const n = await FB.runTransaction(d, async tx => {
    if ((await tx.get(ref)).exists()) return 0;
    tx.set(ref, nuevo({ ...M.docVencimiento({ ...r.d, id }), suelto: true, estado: 'por_pagar' }, 'suelto'));
    return 1;
  });
  await despues(n);
  return { ok: true, id, repetido: !n };
}

// ═══════════════════════════════════════════════
//  v0.63.1 · Detalle de un gasto con su origen (Conciliación → "Ya está en Gastos" y Registrados → Ver origen)
//  ids: las líneas del registro. Lee lo que haga falta para decir de dónde salió: su vencimiento, el documento y las
//  cargas del SII, o el cargo de la cartola. Devuelve { lineas: [{ id, d }], resumen, origen }.
// ═══════════════════════════════════════════════
export async function detalleGasto(ids) {
  const l = [...new Set((Array.isArray(ids) ? ids : [ids]).map(x => s(x)).filter(Boolean))].slice(0, 40);
  if (!l.length) throw error('Falta el gasto', 'datos');
  const d = await db();
  const sns = await Promise.all(l.map(id => FB.getDoc(FB.doc(d, 'gastos', id))));
  const lineas = sns.filter(x => x.exists()).map(x => ({ id: x.id, d: x.data() }));
  if (!lineas.length) throw error('Ese gasto ya no está', 'datos');
  const g = lineas[0].d, ctx = {};
  const tareas = [];
  if (s(g.vencimientoId)) tareas.push(FB.getDoc(FB.doc(d, 'vencimientos', s(g.vencimientoId))).then(x => { if (x.exists()) ctx.vencimiento = x.data(); }).catch(() => {}));
  const docId = s(g.siiDoc && g.siiDoc.id);
  if (docId || s(g.origen) === 'sii') {
    if (docId) tareas.push(FB.getDoc(FB.doc(d, 'sii_docs', docId)).then(x => { if (x.exists()) ctx.siiDoc = x.data(); }).catch(() => {}));
    tareas.push(todos('sii_cargas').then(c => { ctx.cargas = c; }).catch(() => {}));
  }
  if (s(g.cartolaCargo)) tareas.push(FB.getDoc(FB.doc(d, 'cartola_cargos', s(g.cartolaCargo))).then(x => { if (x.exists()) ctx.cargo = x.data(); }).catch(() => {}));
  await Promise.all(tareas);
  return { ok: true, lineas, resumen: B.resumenLineas(lineas), origen: B.resolverOrigen(lineas, ctx), cargo: ctx.cargo ? { fecha: dia(ctx.cargo.fecha), monto: Number(ctx.cargo.monto) || 0, descripcion: s(ctx.cargo.descripcion) } : null };
}
