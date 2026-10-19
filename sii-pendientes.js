// ═══════════════════════════════════════════════
//  Sistema Fën — Documentos del SII por clasificar y pagos sin banco  v0.66.0 (reglas puras, sin red)
//  Lo acordado (15-oct):
//  · Subir el SII solo guarda los documentos (sii_docs). Los de proveedores conocidos (clasificación aprendida segura: el mismo
//    ítem y área al menos 2 veces, sin repartir) se clasifican solos al subir: su gasto nace al tiro con la FECHA DE LA FACTURA
//    (lo devengado), marcado clasificacionAutomatica (chip "automático", se revisa y corrige como cualquier gasto).
//    Lo nuevo o dudoso queda "por clasificar" (sin gasto todavía).
//  · Clasificar al conciliar: un cargo de la cartola que calza EXACTO (±$1, de 5 días antes a 45 después de la factura) con
//    un documento por clasificar lo muestra "Por clasificar"; al confirmar se elige ítem y área (y se reparte), el gasto
//    nace con la fecha de la factura y el pago queda con la fecha del banco. Un abono también sirve: se clasifica con el
//    primero y el gasto es el documento completo.
//  · Pagos sin banco: facturas del SII sin pago del banco después de N días de la factura (10) o pasado su vencimiento (las a
//    crédito que no vencen no entran) → pagada en efectivo (origen: efectivo de cobros B2B u otro), con tarjeta de crédito, o
//    todavía por pagar (a crédito con su vencimiento). Nunca se da por pagada en efectivo sola.
//  · Efectivo disponible: lo cobrado en efectivo a clientes B2B en el mes menos lo pagado con ese efectivo.
//  Fechas aaaa-mm-dd (hora de Chile). Montos en pesos, brutos.
//  v0.67.2: un documento cuyos gastos fueron todos anulados vuelve a "Por clasificar" (revisarVuelta, camposVuelta) y
//  "Volver a clasificar" (bloqueosVolver).
// ═══════════════════════════════════════════════

export const DIAS_SIN_PAGO = 10;      // días desde la factura para preguntar cómo se pagó
export const VENTANA_CARGO = [-5, 45]; // días de la factura al cargo (como las facturas del SII en "Ya está en Gastos")
export const MIN_VECES_AUTO = 2;      // lo aprendido debe repetirse al menos 2 veces para clasificar solo

const s = v => String(v == null ? '' : v);
const t = v => s(v).trim();
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const dia = v => { const x = t(v); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(x); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const utc = f => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diasEntre = (a, b) => (dia(a) && dia(b) ? Math.round((utc(dia(b)) - utc(dia(a))) / 864e5) : NaN);
export const sumarDias = (f, n) => { const x = dia(f); if (!x) return ''; return new Date(utc(x) + n * 864e5).toISOString().slice(0, 10); };
const dma = iso => (dia(iso) ? dia(iso).split('-').reverse().join('-') : '');
export const rutNorm = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = m => (/^\d{4}-\d{2}/.test(s(m)) ? `${MESES[Number(s(m).slice(5, 7)) - 1]} ${s(m).slice(0, 4)}` : '');
const necesitaAreas = it => !!it && (it.area === 'SELECCIONAR' || it.area === 'PRORRATEADO');

// ── Lo que se guarda del documento al subirlo (sii_docs/{id}.porClasificar) ──
// f: documento leído del archivo (sii.js: fecha dd/mm/aaaa, montos con signo, detalle neto)
export function datosPendiente(f, origen = {}, ahora = '', por = '') {
  const det = Array.isArray(f.detalle) ? f.detalle.slice(0, 300) : [];
  return {
    tipoDoc: s(f.tipoDoc) || (num(f.total) < 0 ? '61' : '33'), fecha: dia(f.fecha), total: Math.round(num(f.total)), neto: Math.round(num(f.neto)), iva: Math.round(num(f.iva)),
    exento: Math.round(num(f.exento)), otroImpuesto: Math.round(num(f.otroImpuesto)), esHarina: !!f.esHarina, fechaVenc: dia(f.fechaVencISO), formaPagoSII: s(f.formaPagoSII).slice(0, 2),
    termPago: s(f.termPago).slice(0, 80), descuadre: s(f.descuadre).slice(0, 200),
    detalle: det.map(d => ({ descripcion: s(d.descripcion).slice(0, 300), codigo: s(d.codigo).slice(0, 60), unidad: s(d.unidad).slice(0, 20), cantidad: num(d.cantidad) || '', precioUnitario: num(d.precioUnitario) || '',
      precioLista: num(d.precioLista) || '', descuento: num(d.descuento) || '', monto: Math.round(num(d.monto)) })),
    cargaId: s(origen.cargaId).slice(0, 80), formato: s(origen.formato).slice(0, 12), archivo: s(origen.archivo).slice(0, 120), subido: s(ahora), por: s(por), motivo: s(origen.motivo).slice(0, 200),
    // v0.67.4 · Lo que cita el documento (una nota de crédito: su factura), para proponerlas juntas en la cartola
    ...(Array.isArray(f.referencias) && f.referencias.length ? { referencias: f.referencias.slice(0, 5).map(r => ({ tipo: s(r.tipo).slice(0, 3), folio: s(r.folio).slice(0, 20), fecha: dia(r.fecha) })) } : {})
  };
}
// v0.67.1: un documento unido a un gasto ya registrado (registrado.gastos) tampoco está por clasificar
export const estaRegistrado = d => !!(d && d.registrado && Array.isArray(d.registrado.gastos) && d.registrado.gastos.length && !d.registrado.quitado);
export const esPendiente = d => !!(d && d.porClasificar && !d.importado && !estaRegistrado(d) && !d.quitadoEnPlanilla && !d.descartado);
const esCredito = p => !!(p && ((p.fechaVenc && p.fecha && p.fechaVenc > p.fecha) || s(p.formaPagoSII) === '2'));
const esContado = p => !!(p && s(p.formaPagoSII) === '1');
// La vista de un documento por clasificar
export function vistaPendiente(id, d) {
  const p = d.porClasificar || {};
  return { id: s(id), rut: t(d.rut), folio: t(d.folio), tipo: s(d.tipo) === '61' ? '61' : '', tipoDoc: s(p.tipoDoc) || '33', razonSocial: t(d.razonSocial), fecha: dia(p.fecha), total: num(p.total), neto: num(p.neto), iva: num(p.iva),
    exento: num(p.exento), otroImpuesto: num(p.otroImpuesto), esHarina: !!p.esHarina, fechaVenc: dia(p.fechaVenc), formaPagoSII: s(p.formaPagoSII), credito: esCredito(p), contado: esContado(p),
    detalle: Array.isArray(p.detalle) ? p.detalle : [], cargaId: s(p.cargaId), formato: s(p.formato), archivo: s(p.archivo), motivo: s(p.motivo), esNC: s(d.tipo) === '61' || num(p.total) < 0,
    vuelta: !!d.vueltaPorClasificar, reconstruido: !!p.reconstruido };   // v0.67.2: volvió a por clasificar (sus gastos se anularon)
}
export const pendientesDe = docs => (docs || []).filter(x => x && esPendiente(x.d)).map(x => vistaPendiente(x.id, x.d));

// ═══ v0.67.1 · ¿El documento ya tiene su gasto registrado? (antes de v0.66 se registraba a mano o se importaba de otra forma) ═══
// Se busca en los gastos vigentes (de la memoria), agrupados como una compra (misma fecha, hora, observación, foto, RUT y
// vencimiento, o el mismo documento del SII):
//  · Fuerte: el mismo RUT (sin puntos ni guion) y el mismo folio (folio del gasto, su documento del SII o "F.<folio>" en la
//    observación). Se une sola.
//  · Débil: el mismo RUT, total ±$10 y fecha de la factura ±3 días (y sin otro folio), o sin RUT pero con "F.<folio>" en la
//    observación y total ±$10. Solo si es UNA compra; se une sola.
//  · Ambiguo (más de una) o posible (sin RUT, mismo total ±$10 y fecha ±5 días, como "¿Ya lo registraste a mano?"): queda
//    por clasificar con el aviso "Puede estar ya registrado" y "Unir a un gasto ya registrado" (eliges tú).
// Nunca se crea un gasto: unir es anotar en el documento cuáles son sus gastos (registrado.gastos).
export const TOL_TOTAL = 10, TOL_DIAS_DEBIL = 3, TOL_DIAS_POSIBLE = 5;
const RE_F = /(?:^|[^A-Za-z])F\.\s*(\d+)/g;
const foliosObs = o => { const out = []; let m; const re = new RegExp(RE_F.source, 'g'); while ((m = re.exec(s(o)))) out.push(m[1]); return out; };
// Compras (registros) a partir de los gastos [{ id, d }]. tomados: ids de gastos ya unidos a otro documento
export function comprasDe(gastos, tomados) {
  const T = tomados instanceof Set ? tomados : new Set(tomados || []), por = {}, out = [];
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.estado !== 'vigente' || d.quitadoEnPlanilla || !(num(d.montoFinal) > 0) || T.has(id)) return;
    const sd = d.siiDoc && d.siiDoc.id ? s(d.siiDoc.id) : '';
    const k = sd ? 'sd|' + sd : ['g', dia(d.fecha), s(d.hora).slice(0, 5), s(d.observacion), s(d.urlFoto), rutNorm(d.rutProveedor), s(d.vencimientoId)].join('|');
    let x = por[k];
    if (!x) { x = por[k] = { clave: k, ids: [], total: 0, fecha: dia(d.fecha), rut: rutNorm(d.rutProveedor), razon: t(d.razonSocial), folios: [], items: [], obs: t(d.observacion), siiDocId: sd, vencimientoId: s(d.vencimientoId),
      formaPago: s(d.formaPago), fechaPago: dia(d.fechaPago), cartolaCargo: s(d.cartolaCargo), esperaPago: d.esperaPago === true, esperaCargo: d.esperaCargo === true }; out.push(x); }
    x.ids.push(id); x.total += num(d.montoFinal);
    [s(d.folio), s(d.siiDoc && d.siiDoc.folio)].concat(foliosObs(d.observacion)).filter(Boolean).forEach(f => { if (!x.folios.includes(f)) x.folios.push(f); });
    if (d.itemGasto && !x.items.includes(s(d.itemGasto))) x.items.push(s(d.itemGasto));
    if (!x.fechaPago && dia(d.fechaPago)) x.fechaPago = dia(d.fechaPago);
    if (!x.cartolaCargo && s(d.cartolaCargo)) x.cartolaCargo = s(d.cartolaCargo);
  });
  out.forEach(x => { x.total = Math.round(x.total); x.credito = !!(x.vencimientoId || ((x.formaPago === 'proveedor' || x.formaPago === 'tarjeta') && !x.fechaPago)); });
  return out;
}
// v: vista del documento (vistaPendiente); compras: comprasDe(...). → { tipo: 'fuerte'|'debil'|'ambiguo'|'posible'|'', por, compras: [...], gastos: [ids], motivo }
export function registroDe(v, compras) {
  const vacio = { tipo: '', por: '', compras: [], gastos: [], motivo: '' };
  if (!v || v.esNC || !(num(v.total) > 0)) return vacio;
  const rut = rutNorm(v.rut), folio = t(v.folio), total = Math.round(num(v.total)), dd = c => Math.abs(diasEntre(c.fecha, v.fecha));
  const otroFolio = c => c.folios.length > 0 && !c.folios.includes(folio);
  const deOtroDoc = c => !!c.siiDocId && c.siiDocId !== s(v.id) && otroFolio(c);
  const l = (compras || []).filter(c => !deOtroDoc(c));
  const uno = (tipo, por, cs, motivo) => ({ tipo, por, compras: cs, gastos: cs.flatMap(c => c.ids), motivo });
  // Fuerte: RUT + folio (todas las compras de ese documento)
  const f1 = rut && folio ? l.filter(c => c.rut === rut && c.folios.includes(folio)) : [];
  if (f1.length) return uno('fuerte', 'rut_folio', f1, 'Ya registrada: mismo RUT y folio');
  // Débil: una sola compra
  const cerca = c => Math.abs(c.total - total) <= TOL_TOTAL;
  const d1 = l.filter(c => cerca(c) && ((rut && c.rut === rut && dd(c) <= TOL_DIAS_DEBIL && !otroFolio(c)) || (!c.rut && folio && c.folios.includes(folio))));
  if (d1.length === 1) return uno('debil', d1[0].rut ? 'rut_total_fecha' : 'folio_total', d1, d1[0].rut ? 'Ya registrada: mismo RUT, total y fecha' : 'Ya registrada: mismo folio y total');
  if (d1.length > 1) return { ...uno('ambiguo', '', d1, `Puede estar ya registrada: hay ${d1.length} gastos que calzan, elige cuál`), gastos: [] };
  // Posible: sin RUT, mismo total y fecha cercana (lo que antes decía "¿Ya lo registraste a mano?")
  const p1 = l.filter(c => !c.rut && cerca(c) && dd(c) <= TOL_DIAS_POSIBLE && !otroFolio(c));
  if (p1.length) return { ...uno('posible', '', p1.slice(0, 4), 'Puede estar ya registrado a mano: revísalo (Unir a un gasto ya registrado)'), gastos: [] };
  return vacio;
}
export const seUneSola = r => !!r && (r.tipo === 'fuerte' || r.tipo === 'debil') && r.gastos.length > 0;
// Para elegir a mano ("Unir a un gasto ya registrado"): las compras de ese total (±$10) de 10 días antes a 45 después de la
// factura, sin otro folio (primero las del mismo RUT y la fecha más cercana)
export function comprasParaUnir(v, compras, max = 8) {
  const rut = rutNorm(v.rut), folio = t(v.folio), total = Math.round(num(v.total));
  return (compras || []).filter(c => Math.abs(c.total - total) <= TOL_TOTAL && !(c.folios.length && !c.folios.includes(folio)) && !(c.siiDocId && c.siiDocId !== s(v.id)) && (() => { const x = diasEntre(v.fecha, c.fecha); return x >= -10 && x <= 45; })())
    .sort((a, b) => ((b.rut === rut) - (a.rut === rut)) || Math.abs(diasEntre(a.fecha, v.fecha)) - Math.abs(diasEntre(b.fecha, v.fecha))).slice(0, max);
}
// El vencimiento de la compra a crédito (si lo tiene): el del gasto (vencimientoId), el de una compra a crédito a mano (mismo ítem
// y fecha de compra, como al pagarla) o el de la factura ("F.<folio>" en su nombre u observación). vencs: [{ id, d }]
export function vencimientoDeCompras(compras, vencs, v) {
  const folio = t(v && v.folio), cs = compras || [];
  for (const c of cs) if (c.vencimientoId && (vencs || []).some(x => x.id === c.vencimientoId)) return c.vencimientoId;
  const l = (vencs || []).filter(x => x && x.d && !x.d.quitadoEnPlanilla && !s(x.d.plantillaID) && !['PAGADO', 'ANULADO'].includes(s(x.d.estado).toUpperCase()));
  const porCompra = l.find(x => cs.some(c => c.credito && c.items.some(i => i.toLowerCase() === s(x.d.item).toLowerCase()) && dia(x.d.fechaCompra) === c.fecha));
  if (porCompra) return porCompra.id;
  const porFolio = folio ? l.find(x => foliosObs(`${s(x.d.nombre)} ${s(x.d.obs)}`).includes(folio) && cs.some(c => c.credito)) : null;
  return porFolio ? porFolio.id : '';
}
// Lo que se guarda en el documento al unirlo (sii_docs/{id}.registrado). Nunca crea un gasto.
export function datosRegistrado(v, r, extra = {}) {
  const cs = r.compras || [];
  return { gastos: r.gastos.slice(0, 60), por: s(r.por) || 'manual', clave: `${t(v.rut)}|${t(v.folio)}`, total: Math.round(num(v.total)), fecha: dia(v.fecha), credito: cs.some(c => c.credito),
    vencimiento: (cs.find(c => c.vencimientoId) || {}).vencimientoId || '', motivo: s(r.motivo).slice(0, 200), ...extra };
}
// La vista de un documento ya registrado (para la cartola: proponer el pago o "Ya está en Gastos")
export function vistaRegistrado(id, d) {
  const v = vistaPendiente(id, d), r = d.registrado || {};
  return { ...v, registrado: { gastos: Array.isArray(r.gastos) ? r.gastos.map(s) : [], por: s(r.por), vencimiento: s(r.vencimiento), credito: !!r.credito, en: s(r.en) } };
}
export const registradosDe = docs => (docs || []).filter(x => x && x.d && x.d.porClasificar && estaRegistrado(x.d) && !x.d.quitadoEnPlanilla).map(x => vistaRegistrado(x.id, x.d));
// ¿Qué hacer con un cargo que calza con un documento ya registrado? (monto ±$1, de 5 días antes a 45 después de la factura —o
// hasta 45 días después de su vencimiento si es a crédito—). vencs: vencimientos abiertos de la cartola; grupos: candidatosGastos.
// → { tipo: 'vencimientos', pagos, texto, seguro } (paga la compra a crédito con la fecha del banco) o { tipo: 'gasto', gasto, texto } o null
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fCorta = f => (dia(f) ? `${Number(dia(f).slice(8, 10))} ${MESES_CORTOS[Number(dia(f).slice(5, 7)) - 1]}` : '');
const normT = x => s(x).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function propuestaRegistrado(c, registrados, vencs, grupos) {
  const rutC = rutNorm(c.rut || (c.proveedor && c.proveedor.rut) || '');
  for (const v of registrados || []) {
    if (Math.abs(Math.round(v.total) - Math.round(num(c.monto))) > 1) continue;
    const dd = diasEntre(v.fecha, c.fecha), ddv = v.fechaVenc ? diasEntre(v.fechaVenc, c.fecha) : NaN;
    if (!((dd >= VENTANA_CARGO[0] && dd <= VENTANA_CARGO[1]) || (ddv >= -5 && ddv <= 45))) continue;
    const seguro = !!rutC && rutNorm(v.rut) === rutC, ids = new Set(v.registrado.gastos);
    const ven = (vencs || []).find(x => !x.plantillaId && x.estadoBase !== 'con_abonos' && (x.id === v.registrado.vencimiento || (s(x.folio) === s(v.folio) && (x.rut ? x.rut === rutNorm(v.rut) : normT(x.razon) === normT(v.razonSocial)))));
    if (ven) return { tipo: 'vencimientos', seguro, pagos: [{ id: ven.id, monto: Math.round(num(c.monto)) }], docId: v.id, registrado: true,
      texto: `Paga la compra a crédito F.${v.folio}${ven.fecha ? ` (${ven.fecha < dia(c.fecha) ? 'vencía' : 'vence'} el ${fCorta(ven.fecha)})` : ''} · ${v.razonSocial}`, por: seguro ? 'rut' : 'sii' };
    const g = (grupos || []).find(x => (x.filas || []).some(f => ids.has(s(f.id || f.fila))));
    if (g) return { tipo: 'gasto', seguro, gasto: g, chip: g.chip, docId: v.id, registrado: true, texto: `Ya está en Gastos: ${v.razonSocial} F.${v.folio} · del ${fCorta(g.fecha)}`, por: seguro ? 'rut' : 'sii', otros: [] };
  }
  return null;
}

// El documento como lo trabaja la pantalla de Cargas del SII (sii.js), para sugerir y armar la importación
export function aFactura(v) {
  return { rut: v.rut, folio: v.folio, tipoDoc: v.tipoDoc, esNotaCredito: v.esNC, razonSocial: v.razonSocial, fecha: dma(v.fecha).replace(/-/g, '/'), total: v.total, neto: v.neto, iva: v.iva,
    exento: v.exento, otroImpuesto: v.otroImpuesto, esHarina: v.esHarina, fechaVencISO: v.fechaVenc, formaPagoSII: v.formaPagoSII, detalle: v.detalle.map(d => ({ ...d })) };
}

// ── ¿Se clasifica solo al subir? ──  (v0.66.0, acordado con Emmanuel)
// Solo si el proveedor tiene una clasificación aprendida SEGURA (proveedores/{rut}, sii_clasif): el MISMO ítem y área usado
// al menos 2 veces, sin repartir (una sola línea y una sola área) y sin otra forma que compita (la más usada, al menos el doble
// que la segunda). La ficha a mano y lo aprendido por producto solo PROPONEN (no clasifican solos).
// f: el documento leído; clasif: { porRut } (lo aprendido); ITEMS: ítems vigentes; AREAS: áreas válidas.
// → { auto: true, por: 'proveedor', item, area } o { auto: false, motivo }
export function decidirAuto(f, clasif, ficha, ITEMS, AREAS) {
  const activo = item => (ITEMS || []).find(x => x.item === item), areaOk = a => (AREAS || []).includes(a);
  if (!f) return { auto: false, motivo: 'sin documento' };
  if (f.esNotaCredito || s(f.tipoDoc) === '61' || num(f.total) < 0) return { auto: false, motivo: 'Nota de crédito: revísala tú' };
  if (f.descuadre) return { auto: false, motivo: 'Los montos del documento no cuadran' };
  if (!(num(f.total) > 0)) return { auto: false, motivo: 'Sin monto' };
  const prov = clasif && (clasif.porRut || {})[rutNorm(f.rut)];
  const pats = prov && Array.isArray(prov.patrones) ? prov.patrones : [];
  if (!pats.length) return { auto: false, motivo: 'Proveedor nuevo (sin clasificación aprendida)' };
  const top = pats[0];
  if (!(num(top.n) >= MIN_VECES_AUTO)) return { auto: false, motivo: 'Clasificado menos de 2 veces' };
  if (pats.length > 1 && !(num(top.n) >= 2 * num(pats[1].n))) return { auto: false, motivo: 'El proveedor tiene varias formas de clasificar: elige tú' };
  const ls = Array.isArray(top.lineas) ? top.lineas : [];
  if (ls.length !== 1 || (ls[0].areas || []).length > 1) return { auto: false, motivo: 'Se reparte en varios ítems o áreas: elige tú' };
  const it = activo(ls[0].item);
  if (!it) return { auto: false, motivo: 'El ítem aprendido ya no existe' };
  if (it.area === 'PRORRATEADO') return { auto: false, motivo: 'El ítem se reparte entre áreas: elige tú' };
  const areaAp = s(((ls[0].areas || [])[0] || {}).area);
  const area = it.area === 'SELECCIONAR' ? areaAp : it.area;
  if (it.area === 'SELECCIONAR' && !areaOk(area)) return { auto: false, motivo: 'Falta el área' };
  return { auto: true, por: 'proveedor', item: it.item, area };
}
// Estado con que se importa lo clasificado solo: a crédito (vencimiento del XML, o 30 días) o pagada esperando su pago
export function estadoAuto(v) {
  if (v.credito) return { estado: 'pendiente', fechaEstado: v.fechaVenc && v.fechaVenc > v.fecha ? v.fechaVenc : sumarDias(v.fecha, 30), esperaPago: false };
  return { estado: 'pagada', fechaEstado: v.fecha, esperaPago: true };
}

// ── Clasificar a mano (al conciliar o en Pagos sin banco): líneas { item, area, monto } ──
// Propuesta: lo sugerido (productos o proveedor), la ficha a mano, o una línea vacía con el total
export function lineasPropuestas(f, ITEMS, ficha) {
  const total = Math.abs(Math.round(num(f.total))), activo = item => (ITEMS || []).find(x => x.item === item);
  const out = [];
  if (f.detalle && f.detalle.some(d => d.item)) {
    const factor = (() => { const sm = f.detalle.reduce((a, d) => a + Math.abs(num(d.monto)), 0); return sm > 0 ? total / sm : 1; })(), g = {};
    f.detalle.forEach(d => { if (!d.item) return; const k = d.item + '|' + (d.area || ''); g[k] = (g[k] || 0) + Math.abs(num(d.monto)) * factor; });
    Object.keys(g).forEach(k => { const [item, area] = k.split('|'); out.push({ item, area, monto: Math.round(g[k]) }); });
  } else if ((f.lineas || []).some(l => l.item)) {
    const ls = f.lineas.filter(l => l.item);
    ls.forEach(l => {
      const base = ls.length > 1 ? Math.round(num(l.monto)) : total, it = activo(l.item);
      const ar = (l.areas || []).filter(a => a.area && num(a.valor) > 0);
      if (necesitaAreas(it) && ar.length) {
        const pct = (l.modoArea || 'monto') === 'pct';
        ar.forEach(a => out.push({ item: l.item, area: a.area, monto: pct ? Math.round(base * num(a.valor) / 100) : Math.round(num(a.valor)) }));
      } else out.push({ item: l.item, area: it && !necesitaAreas(it) ? it.area : '', monto: base });
    });
  } else if (ficha && ficha.item && activo(ficha.item)) {
    const it = activo(ficha.item);
    out.push({ item: it.item, area: necesitaAreas(it) ? s(ficha.area) : it.area, monto: total });
  }
  if (!out.length) out.push({ item: '', area: '', monto: total });
  const suma = out.reduce((a, l) => a + l.monto, 0);
  if (suma !== total) out[out.length - 1].monto += total - suma;   // los redondeos, en la última
  return out;
}
// v0.67.1 · El ítem y el área elegidos para cada línea del documento (en su orden). Un ítem que ya no existe queda vacío; el área
// solo se guarda en los ítems que se eligen por área.
export function conDetalleClasificado(detalle, elegido, ITEMS) {
  const activo = item => (ITEMS || []).find(x => x.item === item);
  return (detalle || []).map((d, i) => { const e = (elegido || [])[i] || {}, it = activo(s(e.item)); return { ...d, item: it ? it.item : '', area: it && it.area === 'SELECCIONAR' ? s(e.area) : '' }; });
}
// '' si está bien; si no, qué falta
export function revisarLineas(lineas, total, ITEMS, AREAS) {
  const activo = item => (ITEMS || []).find(x => x.item === item), areaOk = a => (AREAS || []).includes(a);
  const l = (lineas || []).filter(x => x && (x.item || num(x.monto)));
  if (!l.length) return 'Elige el ítem';
  for (const x of l) {
    const it = activo(x.item);
    if (!it) return 'Elige el ítem de cada línea';
    if (necesitaAreas(it) && !areaOk(x.area)) return `Elige el área de ${it.item}`;
    if (!(Math.round(num(x.monto)) > 0)) return 'Cada línea con su monto';
  }
  const vistas = new Set(); for (const x of l) { const k = x.item + '|' + (necesitaAreas(activo(x.item)) ? x.area : ''); if (vistas.has(k)) return `${x.item}: cada área una sola vez`; vistas.add(k); }
  const suma = l.reduce((a, x) => a + Math.round(num(x.monto)), 0), tot = Math.abs(Math.round(num(total)));
  if (Math.abs(suma - tot) > l.length) return `Las líneas suman $${suma.toLocaleString('es-CL')} y la factura es de $${tot.toLocaleString('es-CL')}`;
  return '';
}
// La factura lista para importar (lo que recibe gastos-sii.js: limpiarFacturas), con lo clasificado y cómo se pagó.
// pago: { estado: 'pagada' | 'pendiente', fechaEstado, esperaPago?, formaPago? ('tarjeta'), pagoSinBanco? { medio, fecha } }
export function facturaClasificada(v, lineas, ITEMS, pago, auto = false) {
  const activo = item => (ITEMS || []).find(x => x.item === item);
  const tot = Math.abs(Math.round(v.total)), signo = v.total < 0 ? -1 : 1, porItem = {};
  const l = (lineas || []).filter(x => x && x.item);
  l.forEach(x => { const it = activo(x.item) || {}; const area = necesitaAreas(it) ? s(x.area) : s(it.area); (porItem[x.item] = porItem[x.item] || []).push({ area, monto: Math.round(num(x.monto)) * signo }); });
  // los redondeos (±$1 por línea) se absorben en la última área
  const suma = Object.values(porItem).flat().reduce((a, x) => a + x.monto, 0), dif = Math.round(v.total) - suma;
  const ult = Object.values(porItem).flat().pop(); if (ult && dif && Math.abs(dif) <= l.length) ult.monto += dif;
  const items = Object.keys(porItem);
  const unico = items.length === 1 ? { item: items[0], area: porItem[items[0]].length === 1 ? porItem[items[0]][0].area : '' } : null;
  return {
    rut: v.rut, razonSocial: v.razonSocial, folio: v.folio, tipoDoc: v.tipoDoc || (v.total < 0 ? '61' : '33'), fechaDocto: dma(v.fecha), total: v.total, neto: v.neto, iva: v.iva, esHarina: !!v.esHarina,
    estado: pago.estado, fechaEstado: pago.fechaEstado, ...(pago.esperaPago ? { esperaPago: true } : {}), ...(pago.formaPago === 'tarjeta' ? { formaPago: 'tarjeta' } : {}), ...(pago.pagoSinBanco ? { pagoSinBanco: pago.pagoSinBanco } : {}), ...(auto ? { auto: true } : {}),
    lineas: items.map(item => { const it = activo(item) || {}; return { item, categoria: it.categoria || '', tipo: it.tipo || '', subTipo: it.subTipo || '', areas: porItem[item] }; }),
    detalle: v.detalle.map(d => ({ ...d, monto: Math.round(num(d.monto)) * signo, item: d.item || (unico ? unico.item : ''), area: d.area || (unico ? unico.area : '') }))
  };
}

// ── Conciliación: documentos por clasificar que calzan EXACTO con un cargo ──
// c: cargo (monto, fecha, rut, proveedor). Seguro = mismo RUT (glosa, transferencia enviada o ficha del proveedor).
// Con el mismo proveedor (seguro) y el cargo menor que la factura, también como abono (pago parcial).
export function candidatosCargo(c, pendientes) {
  const rutC = rutNorm(c.rut || (c.proveedor && c.proveedor.rut) || ''), out = [];
  (pendientes || []).forEach(v => {
    if (v.esNC || !(v.total > 0)) return;
    const dd = diasEntre(v.fecha, c.fecha);
    if (!(dd >= VENTANA_CARGO[0] && dd <= VENTANA_CARGO[1])) return;
    const seguro = !!rutC && rutNorm(v.rut) === rutC;
    if (Math.abs(Math.round(v.total) - Math.round(c.monto)) <= 1) out.push({ v, dias: dd, seguro, parcial: false });
    else if (seguro && c.monto > 0 && c.monto < v.total) out.push({ v, dias: dd, seguro, parcial: true });
  });
  return out.sort((a, b) => (a.parcial - b.parcial) || (b.seguro - a.seguro) || Math.abs(a.dias) - Math.abs(b.dias));
}

// ── Pagos sin banco ──  (v0.66.0: lo prioritario es pagar por banco; esto es para las excepciones)
// Entra una factura del SII (clasificada o no) sin pago del banco unido:
//  · al contado (o sin plazo): desde N días después de la fecha de la factura (N = 10 si no se cambia);
//  · a crédito (el XML trae un vencimiento después de la factura, o dice crédito: 30 días): solo cuando ya pasó su vencimiento.
//    La clasificada a crédito tiene su vencimiento en Gastos → Vencimientos (se paga ahí o con la cartola): no entra aquí.
// pendientes: vistas (por clasificar); gastos: [{ id, d }] (los que esperan su pago: esperaPago); pagos: sii_pagos (ya marcados)
// → [{ docId, rut, folio, razonSocial, fecha, total, porClasificar, credito, fechaVenc, dias, gastos }] (lo más antiguo primero)
export const vencimientoDe = v => (v && v.credito ? (v.fechaVenc && v.fechaVenc > v.fecha ? v.fechaVenc : sumarDias(v.fecha, 30)) : '');
export function entraSinBanco(v, hoy, dias = DIAS_SIN_PAGO) {
  if (!v || !dia(v.fecha) || !dia(hoy)) return false;
  if (v.credito) return diasEntre(vencimientoDe(v), hoy) > 0;   // crédito: todavía no vence → no entra
  return diasEntre(v.fecha, hoy) >= dias;
}
export function pagosSinBanco({ pendientes = [], gastos = [], pagos = [], hoy, dias = DIAS_SIN_PAGO } = {}) {
  const ya = new Set((pagos || []).map(p => s(p.docId))), out = [];
  pendientes.forEach(v => {
    if (v.esNC || !(v.total > 0) || ya.has(v.id) || !entraSinBanco(v, hoy, dias)) return;
    out.push({ docId: v.id, rut: v.rut, folio: v.folio, razonSocial: v.razonSocial, fecha: v.fecha, total: v.total, porClasificar: true, contado: v.contado, credito: v.credito,
      fechaVenc: v.credito ? vencimientoDe(v) : v.fechaVenc, dias: diasEntre(v.fecha, hoy), gastos: [], v });
  });
  const porDoc = {};
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.estado !== 'vigente' || d.quitadoEnPlanilla || d.esperaPago !== true || s(d.cartolaCargo) || s(d.fechaPago)) return;
    const k = s(d.siiDoc && d.siiDoc.id) || ('f:' + rutNorm(d.rutProveedor) + '|' + s(d.folio));
    const x = porDoc[k] || (porDoc[k] = { docId: k, rut: t(d.rutProveedor), folio: s(d.folio), razonSocial: t(d.razonSocial), fecha: dia(d.fecha), total: 0, porClasificar: false, automatico: false, gastos: [], items: [] });
    x.total += num(d.montoFinal); x.gastos.push(id);
    if (d.clasificacionAutomatica === true) x.automatico = true;
    if (d.itemGasto && !x.items.includes(s(d.itemGasto))) x.items.push(s(d.itemGasto));
  });
  Object.values(porDoc).forEach(x => {
    if (ya.has(x.docId) || !entraSinBanco(x, hoy, dias)) return;
    out.push({ ...x, total: Math.round(x.total), dias: diasEntre(x.fecha, hoy) });
  });
  return out.sort((a, b) => s(a.fecha).localeCompare(s(b.fecha)) || s(a.folio).localeCompare(s(b.folio)));
}
// De dónde salió el efectivo: por defecto, de lo cobrado en efectivo a clientes B2B (nunca pasa por el banco)
export const ORIGEN_B2B = 'cobros_b2b';
export const ORIGENES_EFECTIVO = [[ORIGEN_B2B, 'Efectivo de cobros B2B'], ['otro', 'Otro']];
// '' si está bien; si no, qué falta. → { origen, origenTexto } limpio en o.limpio
export function revisarOrigen(o) {
  const tipo = s(o && o.origen) || ORIGEN_B2B, tx = t(o && o.origenTexto).slice(0, 120);
  if (!ORIGENES_EFECTIVO.some(([k]) => k === tipo)) return { error: 'Elige de dónde salió el efectivo' };
  if (tipo === 'otro' && tx.length < 3) return { error: 'Escribe de dónde salió el efectivo' };
  return { error: '', limpio: { origen: tipo, ...(tipo === 'otro' ? { origenTexto: tx } : {}) } };
}
export const textoOrigen = p => (s(p && p.origen) === 'otro' ? `Otro: ${t(p.origenTexto)}` : 'Efectivo de cobros B2B');

// ── Revisar automáticas: los gastos que se clasificaron solos al subir y todavía no revisas ──
// gastos: [{ id, d }] → [{ docId, rut, folio, razonSocial, fecha, total, gastos: [{ id, item, area, monto, version, d }] }]
export function automaticasDe(gastos) {
  const porDoc = {};
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.clasificacionAutomatica !== true || d.autoRevisada === true || d.estado !== 'vigente' || d.quitadoEnPlanilla) return;
    const k = s(d.siiDoc && d.siiDoc.id) || ('f:' + rutNorm(d.rutProveedor) + '|' + s(d.folio));
    const x = porDoc[k] || (porDoc[k] = { docId: k, rut: t(d.rutProveedor), folio: s(d.folio) || s((d.siiDoc || {}).folio), razonSocial: t(d.razonSocial), fecha: dia(d.fecha), total: 0, gastos: [] });
    x.total += num(d.montoFinal);
    x.gastos.push({ id, item: s(d.itemGasto), area: s(d.area), monto: Math.round(num(d.montoFinal)), version: Number(d.version) || 0, d });
  });
  return Object.values(porDoc).map(x => ({ ...x, total: Math.round(x.total) })).sort((a, b) => s(b.fecha).localeCompare(s(a.fecha)) || s(a.folio).localeCompare(s(b.folio)));
}
// Meses (aaaa-mm) presentes en una lista de documentos, del más nuevo al más antiguo
export const mesesDe = l => [...new Set((l || []).map(x => s(x.fecha).slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();

// ── Efectivo disponible ──
const esEfectivo = m => /^\s*efectivo/i.test(s(m));
const mesDe = f => dia(f).slice(0, 7);
// Lo cobrado en efectivo a clientes B2B en el mes: abonos con medio "Efectivo" y folios pagados en efectivo (el total del
// folio menos sus abonos). ordenes: [{ folio, total, totalFactura, estadoPago, fechaPago, medioPago, cliente }]; abonos: [{ folio, fecha, monto, referencia }]
export function efectivoB2b(ordenes, abonos, mes) {
  const detalle = [];
  (abonos || []).forEach(a => { if (!a || a.quitadoEnPlanilla || !esEfectivo(a.referencia) || mesDe(a.fecha) !== mes) return; detalle.push({ tipo: 'abono', folio: s(a.folio), fecha: dia(a.fecha), monto: Math.round(num(a.monto)) }); });
  const folios = {};
  (ordenes || []).forEach(o => { if (!o || !o.folio || o.estado === 'anulada' || o.quitadoEnPlanilla) return; (folios[s(o.folio)] = folios[s(o.folio)] || []).push(o); });
  Object.entries(folios).forEach(([f, os]) => {
    const pag = os.find(o => /PAGADO/.test(s(o.estadoPago)) && esEfectivo(o.medioPago) && mesDe(o.fechaPago) === mes);
    if (!pag) return;
    const tf = os.map(o => num(o.totalFactura)).find(x => x > 0), total = tf || os.reduce((a, o) => a + num(o.total), 0);
    const abonado = (abonos || []).filter(a => a && !a.quitadoEnPlanilla && s(a.folio) === f).reduce((a, x) => a + num(x.monto), 0);
    const monto = Math.max(0, Math.round(total - abonado));
    if (monto) detalle.push({ tipo: 'folio', folio: f, fecha: dia(pag.fechaPago), monto, cliente: s(pag.cliente) });
  });
  detalle.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { total: detalle.reduce((a, x) => a + x.monto, 0), detalle };
}
// pagos: sii_pagos del mes (medio efectivo, origen cobros B2B; lo de "Otro" no descuenta) → saldo estimado
export function balanceEfectivo(cobrado, pagos, mes) {
  const l = (pagos || []).filter(p => p && p.medio === 'efectivo' && s(p.origen || ORIGEN_B2B) === ORIGEN_B2B && mesDe(p.fecha) === mes && !p.quitado);
  const pagado = l.reduce((a, p) => a + num(p.monto), 0), c = num(cobrado && cobrado.total !== undefined ? cobrado.total : cobrado);
  return { cobrado: c, pagado, saldo: c - pagado, negativo: c - pagado < 0, pagos: l };
}
// Meses para el selector: el actual y los 5 anteriores
export function mesesEfectivo(hoy, n = 6) { const out = []; let m = dia(hoy).slice(0, 7); for (let i = 0; i < n; i++) { out.push(m); const [y, mm] = m.split('-').map(Number); m = mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; } return out; }

// ── Cierre de mes y estado de resultados: documentos por clasificar de un mes (por la fecha de la factura) ──
export function pendientesDelMes(pendientes, mes) {
  const l = (pendientes || []).filter(v => s(v.fecha).slice(0, 7) === mes);
  return { n: l.length, monto: l.reduce((a, v) => a + Math.round(v.total), 0), docs: l };
}
// Hoy: cuántos por clasificar y cuántas facturas sin pago registrado (más de N días)
export function conteosHoy(pendientes, sinPago) {
  return { porClasificar: (pendientes || []).filter(v => !v.esNC).length, sinPago: (sinPago || []).length, montoSinPago: (sinPago || []).reduce((a, x) => a + num(x.total), 0) };
}
export const fmt = m => '$' + Math.round(num(m)).toLocaleString('es-CL');
export const textoDoc = x => `${x.razonSocial || 'Proveedor'} F.${x.folio}`;

// ═══ v0.67.2 · Un documento cuyos gastos fueron TODOS anulados vuelve a "Por clasificar" ═══
// Los gastos de un documento se buscan por todos los vínculos que existen (de la memoria, sin lecturas):
//  · registrado.gastos (v0.67.1: unido a un gasto ya registrado), si no está quitado;
//  · importado.gastos (v0.66 al clasificar, o la importación de antes en la base nueva);
//  · siiDoc.id del gasto = id del documento (lo pone cada importación y "vincular");
//  · RUT (sin puntos ni guion) + folio: el folio del gasto, el de su siiDoc o "F.<folio>" en la observación (la planilla antigua y
//    lo importado por el script antes de la base nueva; también un gasto a mano con RUT y "F.<folio>").
// Las líneas de Detalle Compras no dicen nada de los gastos: un documento que solo tiene líneas (copiado de la planilla) se decide
// por los gastos que se encuentren con lo de arriba. Si no se encuentra ningún gasto, queda como estaba.
// Vuelve a por clasificar solo si se encontró al menos uno y TODOS están anulados (con uno vigente, sigue importado). Las notas de
// crédito y las facturas que fueron al vencimiento de una obligación "según documento" no cambian.
export const MOTIVO_VUELTA = 'sus gastos fueron anulados: vuelve a por clasificar';
const foliosGasto = d => [s(d.folio), s(d.siiDoc && d.siiDoc.folio)].concat(foliosObs(d.observacion)).map(t).filter(Boolean);
const esNCGasto = d => d.esNC === true || num(d.montoFinal) < 0 || /(?:^|[^A-Za-z])NC\./.test(s(d.observacion)) || s(d.siiDoc && d.siiDoc.tipo) === '61';
// Índice de los gastos (una pasada): por id, por documento del SII y por RUT|folio. gastos: [{ id, d }]
export function indiceGastos(gastos) {
  const porId = new Map(), porDoc = new Map(), porRutFolio = new Map();
  const add = (m, k, x) => { const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); };
  (gastos || []).forEach(x => {
    if (!x || !x.d || x.d.quitadoEnPlanilla) return;
    porId.set(s(x.id), x);
    const sd = x.d.siiDoc && x.d.siiDoc.id ? s(x.d.siiDoc.id) : '';
    if (sd) add(porDoc, sd, x);
    const r = rutNorm(x.d.rutProveedor);
    if (r && !esNCGasto(x.d)) [...new Set(foliosGasto(x.d))].forEach(f => add(porRutFolio, r + '|' + f, x));
  });
  return { porId, porDoc, porRutFolio };
}
// ¿El documento está tomado por gastos? (importado con gastos, unido, o con líneas de Detalle Compras). Sin pendiente.
const conLineas = d => Array.isArray(d.lineas) && d.lineas.length > 0;
const importadoConGastos = d => !!(d.importado && !d.importado.aVencimiento && !d.importado.pendienteId);
export const tomadoPorGastos = d => !!(d && !d.quitadoEnPlanilla && (importadoConGastos(d) || estaRegistrado(d) || conLineas(d)));
// Los gastos de un documento: [{ id, d, por: ['registrado', 'importado', 'siiDoc', 'rut_folio'] }]
export function gastosDelDoc(id, d, idx) {
  const out = new Map(), I = idx || indiceGastos([]);
  const add = (x, por) => { if (!x) return; const k = s(x.id), y = out.get(k) || { id: k, d: x.d, por: [] }; if (!y.por.includes(por)) y.por.push(por); out.set(k, y); };
  if (!d || s(d.tipo) === '61') return [];
  if (estaRegistrado(d)) d.registrado.gastos.forEach(g => add(I.porId.get(s(g)), 'registrado'));
  if (d.importado && Array.isArray(d.importado.gastos)) d.importado.gastos.forEach(g => add(I.porId.get(s(g)), 'importado'));
  (I.porDoc.get(s(id)) || []).forEach(x => add(x, 'siiDoc'));
  const r = rutNorm(d.rut), f = t(d.folio);
  if (r && f) (I.porRutFolio.get(r + '|' + f) || []).forEach(x => { if (!(x.d.siiDoc && x.d.siiDoc.id && s(x.d.siiDoc.id) !== s(id))) add(x, 'rut_folio'); });
  return [...out.values()];
}
const anulado = g => s(g && g.d && g.d.estado) === 'anulado';
// ¿Vuelve a por clasificar? → { vuelve, gastos, anulados, vigentes, por }
export function revisarVuelta(id, d, idx) {
  const no = { vuelve: false, gastos: [], anulados: [], vigentes: [], por: [] };
  if (!d || s(d.tipo) === '61' || !tomadoPorGastos(d) || esPendiente(d)) return no;
  if (d.importado && (d.importado.aVencimiento || d.importado.pendienteId)) return no;
  const gs = gastosDelDoc(id, d, idx);
  if (!gs.length) return no;
  const an = gs.filter(anulado), vi = gs.filter(g => !anulado(g));
  return { vuelve: !vi.length, gastos: gs, anulados: an, vigentes: vi, por: [...new Set(gs.flatMap(g => g.por))] };
}
// Lo que tenía el documento, reconstruido de su importación y sus gastos, cuando no tiene "porClasificar" (lo de antes de la v0.66
// o copiado de la planilla). Al volver a subir el XML se reemplaza por lo del archivo.
export function porClasificarReconstruido(d, gastos, en, por) {
  const im = d.importado || {}, gs = (gastos || []).map(g => g.d || g), ls = Array.isArray(d.lineas) ? d.lineas : [];
  const total = Math.round(num(im.total) || gs.reduce((a, g) => a + num(g.montoFinal), 0));
  const neto = Math.round(num(im.neto) || gs.reduce((a, g) => a + num(g.montoNeto), 0) || ls.reduce((a, l) => a + num(l.montoNeto), 0));
  const esHarina = gs.some(g => s(g.esHarina) === 'Sí' || g.esHarina === true);
  const iva = Math.round(num(im.iva) || (neto ? neto * 0.19 : 0)), otro = Math.max(0, total - neto - iva);
  const fecha = dia(im.fechaDocto) || gs.map(g => dia(g.fecha)).filter(Boolean).sort()[0] || dia(d.fecha) || ls.map(l => dia(l.fecha)).filter(Boolean).sort()[0] || '';
  const credito = s(im.estado) === 'pendiente' || gs.some(g => s(g.formaPago) === 'proveedor');
  return { tipoDoc: '33', fecha, total, neto, iva, exento: 0, otroImpuesto: otro > 2 ? otro : 0, esHarina, fechaVenc: credito ? dia(im.fechaEstado) : '', formaPagoSII: credito ? '2' : '',
    termPago: '', descuadre: '',
    detalle: ls.slice(0, 300).map(l => ({ descripcion: s(l.descripcion).slice(0, 300), codigo: s(l.codigo).slice(0, 60), unidad: s(l.unidad).slice(0, 20), cantidad: num(l.cantidad) || '', precioUnitario: num(l.precioUnitario) || '',
      precioLista: num(l.precioLista) || '', descuento: num(l.descuento) || '', monto: Math.round(num(l.montoNeto)) })),
    cargaId: '', formato: 'reconstruido', archivo: '', subido: s(en), por: s(por), motivo: 'Vuelve a por clasificar (sus gastos fueron anulados). Si subes otra vez el XML, queda con lo del archivo.', reconstruido: true };
}
// Lo que se escribe en el documento al volver a por clasificar. Nada se borra:
//  · importado → importadosAnulados (con quién, cuándo y por qué) e importado: null;
//  · registrado → queda con quitado { en, por, motivo };
//  · las líneas de Detalle Compras pasan a lineasAnuladas (cada una con anulada { en, por, motivo, k }) y lineas queda vacía: ya no
//    cuentan en Compras del SII, precios ni productos aprendidos; al clasificar de nuevo entran las del documento, una sola vez.
//  · porClasificar: el que tenía, o reconstruido.
// → { chicos (van al historial con cambio()), listas (lineas, lineasAnuladas, importadosAnulados, porClasificar: fuera del
//    historial, son largas) }
export function camposVuelta(d, r, { en = '', por = '', motivo = MOTIVO_VUELTA, porClasificar = null } = {}) {
  const marca = { en: s(en), por: s(por), motivo: s(motivo).slice(0, 300) };
  const chicos = { vueltaPorClasificar: { ...marca, gastos: r.gastos.map(g => g.id).slice(0, 60), via: r.por } }, listas = {};
  if (d.importado) { chicos.importado = null; listas.importadosAnulados = (Array.isArray(d.importadosAnulados) ? d.importadosAnulados : []).slice(-9).concat([{ ...d.importado, anulado: marca }]); }
  if (d.registrado) chicos.registrado = { ...d.registrado, quitado: marca };
  const pc = porClasificar || (d.porClasificar && !d.porClasificar.reconstruido ? d.porClasificar : null) || porClasificarReconstruido(d, r.gastos, en, por);
  if (pc !== d.porClasificar) listas.porClasificar = pc;
  if (conLineas(d)) {
    listas.lineas = [];
    listas.lineasAnuladas = (Array.isArray(d.lineasAnuladas) ? d.lineasAnuladas : []).concat(d.lineas.map((l, k) => ({ ...l, anulada: { ...marca, k } })));
    chicos.totalNeto = 0;
  }
  return { chicos, listas };
}
// El documento como queda (para trabajar en memoria antes de que se guarde)
export const conVuelta = (d, c) => ({ ...d, ...c.chicos, ...c.listas });
// Ficha del proveedor sin lo del documento devuelto (gastos anulados y sus productos): no enseña a clasificar con lo anulado.
// → { filas, prods, documentos, productos } o null si no cambia
export function fichaSinDoc(ficha, gastoIds, docId) {
  if (!ficha) return null;
  const G = new Set((gastoIds || []).map(s)), pre = s(docId) + '#';
  const F = (ficha.filas || []).filter(x => !G.has(s(x.g))), P = (ficha.prods || []).filter(x => !s(x.l).startsWith(pre));
  if (F.length === (ficha.filas || []).length && P.length === (ficha.prods || []).length) return null;
  return { filas: F, prods: P, documentos: new Set(F.map(x => x.fo || x.f)).size, productos: new Set(P.map(x => x.d)).size };
}

// ── v0.67.2 · "Volver a clasificar": anula todos los gastos del documento y lo deja por clasificar ──
// Se bloquea si un gasto del documento ya está conciliado con un cargo, tiene un pago (efectivo o tarjeta en Pagos sin banco, o es
// el pago de un vencimiento) o tiene un vencimiento que no está anulado. Dice qué deshacer primero.
// vencs: [{ id, d }]; cargos: [{ id, d }] (cartola_cargos)
export function bloqueosVolver(r, vencs, cargos, d) {
  const out = [], vistos = new Set(), V = new Map((vencs || []).map(x => [s(x.id), x.d])), C = new Map((cargos || []).map(x => [s(x.id), x.d]));
  const estadoV = v => { const e = s(v && v.estado), u = e.toUpperCase(); return u === 'PAGADO' ? 'pagado' : u === 'ANULADO' ? 'anulado' : e === 'con_abonos' || (Array.isArray(v && v.abonos) && v.abonos.length) ? 'con_abonos' : 'por_pagar'; };
  const una = (k, txt) => { if (vistos.has(k)) return; vistos.add(k); out.push(txt); };
  const ccTxt = (id, fb) => { const c = C.get(s(id)); return `Primero deshaz la conciliación del cargo del ${fCorta((c && c.fecha) || fb) || 'banco'}${c && c.monto ? ` (${fmt(c.monto)})` : ''}: Conciliación → Cartola → Ya revisados → Deshacer.`; };
  (r.vigentes || []).forEach(({ id, d: g }) => {
    if (s(g.cartolaCargo)) una('cc|' + g.cartolaCargo, ccTxt(g.cartolaCargo, g.fechaPago));
    if (g.pagoSinBanco && g.pagoSinBanco.medio) una('sb|' + id, `Tiene su pago ${g.pagoSinBanco.medio === 'tarjeta' ? 'con tarjeta' : 'en efectivo'} del ${fCorta(g.pagoSinBanco.fecha) || fCorta(g.fechaPago)} (Pagos sin banco): anula sus gastos en Gastos → Registrados; la factura vuelve sola a Por clasificar.`);
    if (/^gp-/.test(s(id)) || s(g.origen) === 'obligacion') una('gp|' + id, `Es el pago de un vencimiento: deshazlo primero (el cargo en la cartola o el pago en Gastos → Por pagar).`);
  });
  const vids = new Set((r.vigentes || []).map(x => s(x.d.vencimientoId)).filter(Boolean));
  if (d && d.importado && s(d.importado.vencimiento)) vids.add(s(d.importado.vencimiento));
  if (d && estaRegistrado(d) && s(d.registrado.vencimiento)) vids.add(s(d.registrado.vencimiento));
  vids.forEach(vid => {
    const v = V.get(vid); if (!v || v.quitadoEnPlanilla) return;
    const e = estadoV(v), nom = s(v.nombre).replace(/^\S*📋\s*/u, '').trim() || 'de la compra';
    if (e === 'anulado') return;
    if (e === 'pagado') una('v|' + vid, s(v.cartolaCargo) ? ccTxt(v.cartolaCargo, v.fechaPago) : `Primero deshaz el pago del vencimiento ${nom} (pagado el ${fCorta(v.fechaPago) || '—'}) en Gastos → Por pagar.`);
    else if (e === 'con_abonos') una('v|' + vid, `Primero deshaz los abonos del vencimiento ${nom} en Gastos → Por pagar.`);
    else una('v|' + vid, `Primero anula su vencimiento ${nom} (vence el ${fCorta(v.fechaVencimiento) || '—'}) en Gastos → Por pagar.`);
  });
  return out;
}
