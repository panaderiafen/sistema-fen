// ═══════════════════════════════════════════════
//  Sistema Fën · pagos-mixtos.js · v0.69.2 (reglas puras, sin red)
//  Un documento (factura del SII o gasto registrado, al contado o a crédito) pagado en partes:
//  · un cargo del banco paga una parte y el resto se pagó en efectivo, con tarjeta, o todavía se debe;
//  · varios cargos del banco para el mismo documento (el siguiente se propone por el saldo exacto).
//  Lo acordado:
//  · El gasto nunca se duplica: su monto sigue siendo el total del documento. Cada pago es una PARTE.
//  · Las partes viven en el vencimiento del documento (abonos), como los pagos parciales de la v0.64.0. Un documento al contado
//    que recibe su primer pago parcial pasa a tener su vencimiento "en partes" (nunca se borra nada: lo de antes queda guardado).
//  · Cada parte: medio (banco, efectivo o tarjeta), fecha, monto y el cargo o de dónde salió el efectivo.
//  · Lo pagado en efectivo o con tarjeta queda además en sii_pagos (lo mismo que "Pagos sin banco"): así baja el "Efectivo en
//    mano estimado" (si salió de los cobros B2B) y llega al flujo de caja (F4).
//  · Cuando las partes suman el total (±$1), el documento queda pagado y su fecha de pago es la de la última parte.
//  Fechas aaaa-mm-dd (hora de Chile). Montos en pesos, brutos.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v);
const t = v => s(v).trim();
const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
const dma = f => (esIso(s(f).slice(0, 10)) ? s(f).slice(0, 10).split('-').reverse().join('-') : '');
const dm = f => dma(f).slice(0, 5);
export const pesos = v => { const x = Math.round(n(v)); return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('es-CL'); };
const sumarDias = (f, k) => { if (!esIso(f)) return ''; const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
const quitarEmoji = x => s(x).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '').replace(/\s{2,}/g, ' ').trim();

export const TOL = 1;                                   // ±$1: las partes suman el total
export const MEDIOS = ['banco', 'efectivo', 'tarjeta'];
export const NOMBRE_MEDIO = { banco: 'banco', efectivo: 'efectivo', tarjeta: 'tarjeta', mano: 'a mano' };
export const RESTOS = ['efectivo', 'tarjeta', 'debo'];
export const TXT_RESTO = { efectivo: 'Lo pagué en efectivo', tarjeta: 'Lo pagué con tarjeta', debo: 'Todavía lo debo' };
export const ORIGEN_B2B = 'cobros_b2b';
export const ORIGENES = [[ORIGEN_B2B, 'Efectivo de cobros B2B'], ['otro', 'Otro']];
export const DIAS_DEBO = 7;                             // "Todavía lo debo" (al contado): la fecha esperada por defecto, hoy + 7

// ── Las partes de un documento (los abonos de su vencimiento) ──
// El medio de un abono: el que se guardó; los de antes: del banco si vinieron de la cartola, "a mano" si no.
export const medioDe = a => (MEDIOS.includes(s(a && a.medio)) ? s(a.medio) : (a && (s(a.origen) === 'cartola' || s(a.cargoId))) ? 'banco' : 'mano');
export const origenTxt = a => (s(a && a.origenEfectivo) === 'otro' ? (t(a.origenTexto) || 'otro') : 'cobros B2B');
// v: el vencimiento (sus abonos). → [{ n, monto, medio, fecha, cargoId, conCargo, origenEfectivo, origenTexto, pagoId }]
export function partesDe(v) {
  return (Array.isArray(v && v.abonos) ? v.abonos : []).map((a, i) => ({ n: i + 1, monto: Math.round(n(a.monto)), medio: medioDe(a), fecha: s(a.fecha).slice(0, 10), cargoId: s(a.cargoId), conCargo: s(a.conCargo),
    origenEfectivo: s(a.origenEfectivo), origenTexto: s(a.origenTexto), pagoId: s(a.pagoId), clave: s(a.clave) }));
}
// "$113.780 banco (cargo 14-10)" · "$11.220 efectivo (15-10, cobros B2B)" · "$11.220 tarjeta (15-10)"
export function textoParte(p, cargoFecha) {
  const f = dm(p.fecha), m = pesos(p.monto);
  if (p.medio === 'banco') return `${m} banco (${p.cargoId ? 'cargo ' + (dm(cargoFecha ? cargoFecha(p.cargoId) || p.fecha : p.fecha) || f) : f || 'sin fecha'})`;
  if (p.medio === 'efectivo') return `${m} efectivo (${[f, origenTxt(p)].filter(Boolean).join(', ')})`;
  if (p.medio === 'tarjeta') return `${m} tarjeta (${f})`;
  return `${m} a mano (${f})`;
}
// "Pagado: $113.780 banco (cargo 14-10) + $11.220 efectivo (15-10, cobros B2B)"; con saldo: "Pagado hasta ahora: … · falta $Z"
export function textoPagado(partes, total, cargoFecha) {
  const l = (partes || []).filter(p => p && p.monto > 0);
  if (!l.length) return '';
  const suma = l.reduce((a, p) => a + p.monto, 0), falta = Math.max(0, Math.round(n(total) - suma));
  const txt = l.map(p => textoParte(p, cargoFecha)).join(' + ');
  return n(total) > 0 && falta > TOL ? `Pagado hasta ahora: ${txt} · falta ${pesos(falta)}` : `Pagado: ${txt}`;
}
// "Pago parcial: $113.780 de $125.000 · falta $11.220"
export const textoParcial = (monto, total, falta) => `Pago parcial: ${pesos(monto)} de ${pesos(total)} · falta ${pesos(falta === undefined ? n(total) - n(monto) : falta)}`;
// "Este cargo paga $113.780 de $125.000. ¿Y el resto ($11.220)?"
export const preguntaResto = (monto, pendiente) => `Este cargo paga ${pesos(monto)} de ${pesos(pendiente)}. ¿Y el resto (${pesos(n(pendiente) - n(monto))})?`;
// Lo que dice el botón de confirmar
export function textoConfirmar(monto, resto, falta) {
  if (!resto || resto.medio === 'debo') return `Registrar pago parcial de ${pesos(monto)} · queda ${pesos(falta)} por pagar`;
  return `Confirmar: ${pesos(monto)} banco + ${pesos(falta)} ${resto.medio === 'tarjeta' ? 'con tarjeta' : 'en efectivo'}`;
}

// ── El resto: revisar lo que se eligió ──
// r = { medio: 'efectivo'|'tarjeta'|'debo', fecha, origen, origenTexto }; falta = lo que queda después del cargo (> 0)
// → { error } | { limpio: { medio, fecha, monto, origenEfectivo?, origenTexto? } }
export function revisarResto(r, falta) {
  const medio = s(r && r.medio);
  if (!RESTOS.includes(medio)) return { error: 'Elige qué pasó con el resto' };
  if (!(Math.round(n(falta)) > 0)) return { error: 'No queda resto: el cargo paga todo' };
  if (!esIso(s(r.fecha))) return { error: medio === 'debo' ? 'Elige la fecha en que esperas pagar el resto' : 'Elige la fecha del pago del resto' };
  const out = { medio, fecha: s(r.fecha), monto: Math.round(n(falta)) };
  if (medio === 'efectivo') {
    const o = s(r.origen) || ORIGEN_B2B, tx = t(r.origenTexto).slice(0, 120);
    if (!ORIGENES.some(([k]) => k === o)) return { error: 'Elige de dónde salió el efectivo' };
    if (o === 'otro' && tx.length < 3) return { error: 'Escribe de dónde salió el efectivo' };
    out.origenEfectivo = o; if (o === 'otro') out.origenTexto = tx;
  }
  return { limpio: out };
}
// Un pago en efectivo o con tarjeta como lo guarda sii_pagos (para Efectivo disponible y el flujo de caja)
// doc = { docId (sii_docs), vencimientoId, rut, folio, razonSocial, fechaFactura, gastos }; parte = { medio, fecha, monto, origenEfectivo, origenTexto }
export function registroPago(doc, parte, { por = '', en = '', cargoId = '', clave = '' } = {}) {
  const org = parte.medio === 'efectivo' ? { origen: s(parte.origenEfectivo) || ORIGEN_B2B, ...(s(parte.origenEfectivo) === 'otro' ? { origenTexto: t(parte.origenTexto) } : {}) } : {};
  return { docId: s(doc.docId), vencimientoId: s(doc.vencimientoId), rut: s(doc.rut), folio: s(doc.folio), razonSocial: s(doc.razonSocial), monto: Math.round(n(parte.monto)), fecha: parte.fecha, mes: s(parte.fecha).slice(0, 7),
    medio: parte.medio, ...org, gastos: (doc.gastos || []).slice(0, 40), fechaFactura: s(doc.fechaFactura), parcial: true, ...(cargoId ? { cargoId } : {}), ...(clave ? { abonoClave: clave } : {}), por, en,
    historial: [{ que: parte.medio === 'efectivo' ? `parte pagada en efectivo (${org.origen === 'otro' ? 'Otro: ' + t(org.origenTexto) : 'Efectivo de cobros B2B'})` : 'parte pagada con tarjeta de crédito', por, en }] };
}
export const idPago = (vencId, clave) => ('sp-' + s(vencId) + '-' + s(clave)).replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 140);

// ── Un documento al contado que recibe su primer pago parcial: su vencimiento "en partes" ──
// gs: los gastos del documento [{ id, d }]; o = { id, fecha (vence), porPagar (todavía se debe), cargoId, por, en }
// → los campos del vencimiento (sin estado: lo ponen los abonos) y lo de antes de cada gasto (para deshacer)
export function vencimientoEnPartes(gs, o) {
  const L = (gs || []).filter(x => x && x.d), d0 = (L[0] || {}).d || {};
  const total = Math.round(L.reduce((a, x) => a + n(x.d.montoFinal), 0));
  const porArea = {}; L.forEach(x => { const a = s(x.d.area) || 'ADMIN'; porArea[a] = (porArea[a] || 0) + Math.round(n(x.d.montoFinal)); });
  const areas = Object.entries(porArea).map(([area, monto]) => ({ area, monto }));
  const items = [...new Set(L.map(x => s(x.d.itemGasto)).filter(Boolean))];
  const folio = s(d0.folio) || s(d0.siiDoc && d0.siiDoc.folio) || ((/^(?:F)\.\s*(\d+)/.exec(s(d0.observacion)) || [])[1] || '');
  const razon = t(d0.razonSocial);
  const nombre = folio ? `${razon || 'Proveedor'} F.${folio}` : `Pago en partes: ${items.join(' + ') || 'gasto'} ${dma(d0.fecha)}`.trim();
  return {
    venc: { id: o.id, plantillaID: '', nombre: quitarEmoji(nombre).slice(0, 120), item: items.length === 1 ? items[0] : '', periodoKey: s(o.fecha).slice(0, 7), fechaVencimiento: s(o.fecha), montoEstimado: total,
      obs: folio ? 'F.' + folio : '', area: areas.length === 1 ? areas[0].area : 'MULTI', categoria: s(d0.categoria), tipo: s(d0.tipo), subTipo: s(d0.subTipo), multiArea: areas.length > 1 ? JSON.stringify(areas) : '',
      estado: 'por_pagar', fechaCompra: dma(d0.fecha), tipoMonto: 'bruto', folio, razonSocial: razon, rutProveedor: t(d0.rutProveedor), ...(d0.siiDoc && d0.siiDoc.id ? { siiDocId: s(d0.siiDoc.id) } : {}),
      gastosDoc: L.map(x => x.id), ...(o.porPagar ? { porPagarSinBanco: true } : {}),
      pagoEnPartes: { creadoPor: s(o.cargoId), por: s(o.por), en: s(o.en), antes: L.map(x => ({ id: x.id, formaPago: s(x.d.formaPago || 'contado'), esperaPago: x.d.esperaPago === true, esperaCargo: x.d.esperaCargo === true, medioPago: s(x.d.medioPago), fechaPago: s(x.d.fechaPago) })) } },
    total
  };
}
// Lo que cambia en cada gasto del documento cuando pasa a pagarse en partes
export const camposGastoEnPartes = vid => ({ formaPago: 'proveedor', esperaPago: false, esperaCargo: false, fechaPago: '', vencimientoId: vid, enPartes: true });
// Lo que vuelve a tener cada gasto si se deshace todo (lo guardado en pagoEnPartes.antes)
export const camposGastoAntes = a => ({ formaPago: s(a.formaPago) || 'contado', esperaPago: a.esperaPago === true, esperaCargo: a.esperaCargo === true, medioPago: s(a.medioPago), fechaPago: s(a.fechaPago), vencimientoId: '', enPartes: false, pagoMixto: null });
// Lo que queda en los gastos del documento cuando las partes completan el total
export function pagoMixtoDe(v) {
  const l = partesDe(v);
  return { total: Math.round(totalDe(v)), partes: l.map(p => ({ monto: p.monto, medio: p.medio, fecha: p.fecha, ...(p.cargoId ? { cargoId: p.cargoId } : {}), ...(p.medio === 'efectivo' ? { origen: p.origenEfectivo || ORIGEN_B2B, ...(p.origenTexto ? { origenTexto: p.origenTexto } : {}) } : {}) })).slice(0, 30) };
}
export const ultimaFecha = v => partesDe(v).map(p => p.fecha).filter(Boolean).sort().pop() || '';
function totalDe(v) {
  if (n(v && v.montoDocumento) > 0) return n(v.montoDocumento);
  let ma = v && v.multiArea; if (typeof ma === 'string') { try { ma = JSON.parse(ma); } catch (e) { ma = null; } }
  if (Array.isArray(ma) && ma.length) return ma.reduce((a, x) => a + n(x.monto), 0);
  return n(v && v.montoEstimado);
}
// ¿Es el vencimiento de un documento (factura o compra), no de una obligación ni suelto? Solo esos aceptan "el resto".
export const esDeDocumento = v => !!v && !s(v.plantillaID || v.plantillaId) && v.suelto !== true && s(v.tipoObligacion) !== 'libre' && !(v.documento && v.documento.tipo === 'previred');

// ── Deshacer: qué partes salen ──
// d: el vencimiento; cargoId: el cargo que se deshace; conResto: también lo registrado junto con él (efectivo o tarjeta)
// → { error } | { campos, quitadas, quedan, cerraba, vacio }
export function quitarPartes(d, cargoId, conResto, quitado) {
  const l = Array.isArray(d && d.abonos) ? d.abonos : [];
  const sale = a => s(a.cargoId) === s(cargoId) || (conResto && s(a.conCargo) === s(cargoId));
  const fuera = l.filter(sale), quedan0 = l.filter(a => !sale(a));
  if (!fuera.length) return { error: 'El abono ya no estaba' };
  // Lo que se queda y venía con este cargo: ya no va con él (un deshacer siguiente no lo toca)
  const quedan = quedan0.map(a => (s(a.conCargo) === s(cargoId) ? { ...a, conCargo: '', seQuedo: { ...quitado } } : a));
  const cerraba = s(d.estado) === 'pagado';
  return { quitadas: fuera, quedan, cerraba, vacio: !quedan.length,
    campos: { abonos: quedan, estado: quedan.length ? 'con_abonos' : 'por_pagar', fechaPago: '', montoPago: '', abonosQuitados: (Array.isArray(d.abonosQuitados) ? d.abonosQuitados : []).concat(fuera.map(a => ({ ...a, quitado }))) } };
}
// El resto registrado junto con un cargo (para preguntar al deshacer): { monto, medio, fecha } o null
export function restoDelCargo(v, cargoId) {
  const a = (Array.isArray(v && v.abonos) ? v.abonos : []).find(x => s(x.conCargo) === s(cargoId));
  return a ? { monto: Math.round(n(a.monto)), medio: medioDe(a), fecha: s(a.fecha), origenEfectivo: s(a.origenEfectivo), origenTexto: s(a.origenTexto), pagoId: s(a.pagoId) } : null;
}
// "¿Quitar también el pago en efectivo de $11.220?"
export const preguntaQuitar = r => `¿Quitar también el pago ${r.medio === 'tarjeta' ? 'con tarjeta' : 'en efectivo'} de ${pesos(r.monto)}?`;

// ── Pagos sin banco: los documentos con saldo cuya fecha ya pasó ──
// vencs: [{ id, d }]. Los de un documento (no obligaciones) con abonos y saldo > $1, cuya fecha (la del saldo reagendado o la del
// vencimiento) ya pasó. → [{ saldo: true, vencId, docId, nombre, fecha, total, pagado, monto (el saldo), partes, ... }]
export function saldosSinBanco(vencs, hoy) {
  const out = [];
  (vencs || []).forEach(({ id, d }) => {
    if (!d || d.quitadoEnPlanilla || !esDeDocumento(d)) return;
    const e = s(d.estado);
    if (e === 'pagado' || e === 'anulado' || e.toUpperCase() === 'PAGADO' || e.toUpperCase() === 'ANULADO') return;
    const ab = Array.isArray(d.abonos) ? d.abonos : []; if (!ab.length) return;
    const total = Math.round(totalDe(d)), pagado = Math.round(ab.reduce((a, x) => a + n(x.monto), 0)), saldo = total - pagado;
    if (!(saldo > TOL)) return;
    const f = (s(d.fechaSaldo).slice(0, 10)) || s(d.fechaVencimiento).slice(0, 10);
    if (!esIso(f) || !(f < hoy)) return;
    const m = /^\s*\S*\s*(.*?)\s+F\.(\d+)\s*$/.exec(quitarEmoji(d.nombre));
    out.push({ saldo: true, vencId: id, docId: 'v:' + id, siiDocId: s(d.siiDocId), nombre: quitarEmoji(d.nombre), razonSocial: t(d.razonSocial) || (m ? m[1] : ''), folio: s(d.folio) || (m ? m[2] : ''), rut: t(d.rutProveedor),
      fecha: f, fechaFactura: s(d.fechaCompra).split('-').reverse().join('-'), total, pagado, monto: saldo, partes: partesDe(d), gastos: Array.isArray(d.gastosDoc) ? d.gastosDoc : [] });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.vencId.localeCompare(b.vencId));
}

// ── El flujo de caja (F4): cada parte pagada, una sola vez, con su medio ──
// vencs: [{ id, d }]; pagos: sii_pagos [{ id, ... }] (sin los quitados). Las partes del banco salen de los abonos con cargo; lo
// pagado en efectivo o con tarjeta, de sii_pagos (también lo de "Pagos sin banco" sin vencimiento).
// → [{ fecha, monto, medio, cargoId?, origen?, vencimientoId, docId, folio, razonSocial, de: 'cartola'|'sii_pagos' }]
export function pagosDeCaja(vencs, pagos) {
  const out = [], conPago = new Set();
  (pagos || []).forEach(p => { if (!p || p.quitado || !(n(p.monto) > 0)) return; conPago.add(s(p.id));
    out.push({ fecha: s(p.fecha), monto: Math.round(n(p.monto)), medio: s(p.medio), origen: s(p.medio) === 'efectivo' ? s(p.origen) || ORIGEN_B2B : '', vencimientoId: s(p.vencimientoId), docId: s(p.docId), folio: s(p.folio), razonSocial: s(p.razonSocial), de: 'sii_pagos', ...(p.cargoId ? { conCargo: s(p.cargoId) } : {}) }); });
  (vencs || []).forEach(({ id, d }) => {
    if (!d || d.quitadoEnPlanilla || s(d.estado).toLowerCase() === 'anulado') return;
    (Array.isArray(d.abonos) ? d.abonos : []).forEach(a => {
      const medio = medioDe(a);
      if (medio === 'efectivo' || medio === 'tarjeta') { if (a.pagoId && conPago.has(s(a.pagoId))) return; }
      else if (medio !== 'banco') return;
      const m = /^\s*\S*\s*(.*?)\s+F\.(\d+)\s*$/.exec(quitarEmoji(d.nombre));
      out.push({ fecha: s(a.fecha), monto: Math.round(n(a.monto)), medio, ...(a.cargoId ? { cargoId: s(a.cargoId) } : {}), vencimientoId: id, docId: s(d.siiDocId), folio: s(d.folio) || (m ? m[2] : ''), razonSocial: s(d.razonSocial) || (m ? m[1] : ''), de: a.cargoId ? 'cartola' : 'abono' });
    });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.monto - b.monto);
}

// ── Propuestas: el siguiente cargo de un documento con partes, y el pago parcial ──
// Un vencimiento de documento con partes y saldo exacto = el cargo. prov: el proveedor del cargo (gastos-banco.js proveedorDelCargo)
// → la del saldo es "seguro" solo si el proveedor del cargo es el del documento (RUT o nombre).
export function calzaProveedor(c, v, prov, B) {
  const rc = s(c && c.rut), rv = s(v && v.rut);
  if (rc && rv) return rc === rv ? 'rut' : '';
  if (prov && !prov.ambiguo && B && B.esDelProveedor(prov, { rut: rv, razon: s(v && v.razon) })) return prov.por === 'rut' ? 'rut' : 'proveedor';
  if (c && c.proveedor && B && B.proveedorCalza(c, { rut: rv, razon: s(v && v.razon) })) return 'proveedor';
  return '';
}
// El documento que un cargo MENOR paga en parte: de un proveedor reconocido, un solo documento abierto mayor que el cargo
// (gasto sin cargo o vencimiento de documento). grupos: candidatosGastos; vencs: vencimientosAbiertos.
// → { tipo: 'pago_parcial', seguro: false, doc, monto, total, falta, texto, por } o null. Nunca va a Listos.
export function propuestaParcial(c, grupos, vencs, prov, B, hoy) {
  if (!c || !(c.monto > 0) || !prov || prov.ambiguo) return null;
  const VS = (B && B.VENTANAS_EXACTAS) || { sii: [-5, 45], otros: [-10, 10] };
  const dif = (a, b) => (B && B.diasEntre ? B.diasEntre(a, b) : 0);
  const docs = [];
  (grupos || []).forEach(g => {
    if (!g || !(g.monto > c.monto + TOL) || g.nc || g.clase === 'efectivo' || !B.esDelProveedor(prov, g)) return;
    const d = dif(g.fecha, c.fecha), v = g.clase === 'sii' ? VS.sii : [-10, 60];
    if (!(d >= v[0] && d <= v[1])) return;
    docs.push({ tipo: 'gasto', clave: [g.fecha, g.hora, g.monto, g.filas[0].fila].join('|'), total: g.monto, pendiente: g.monto, fecha: g.fecha, nombre: `${g.razon || (g.items || []).join(' + ')}${g.folio ? ' F.' + g.folio : ''}`, dist: Math.abs(d) });
  });
  (vencs || []).forEach(v => {
    if (!v || !esDeDocumento({ plantillaID: v.plantillaId, suelto: v.suelto, tipoObligacion: v.tipoObligacion, documento: v.previred ? { tipo: 'previred' } : null }) || !['por_pagar', 'con_abonos'].includes(v.estadoBase)) return;
    const pend = v.estadoBase === 'con_abonos' ? v.saldo : v.monto;
    if (!(pend > c.monto + TOL) || !calzaProveedor(c, v, prov, B)) return;
    docs.push({ tipo: 'venc', vencId: v.id, total: v.total || v.monto, pendiente: pend, fecha: v.fecha, nombre: quitarEmoji(v.nombre), dist: Math.abs(dif(v.fecha, c.fecha)), conPartes: v.estadoBase === 'con_abonos' });
  });
  if (!docs.length) return null;
  docs.sort((a, b) => a.dist - b.dist || a.pendiente - b.pendiente);
  const d = docs[0], falta = Math.round(d.pendiente - c.monto);
  return { tipo: 'pago_parcial', seguro: false, doc: d, monto: c.monto, total: d.total, pendiente: d.pendiente, falta, texto: `${textoParcial(c.monto, d.pendiente, falta)} · ${d.nombre}`, por: prov.por === 'rut' ? 'rut' : 'proveedor',
    ...(docs.length > 1 ? { duda: `Hay ${docs.length} documentos de este proveedor con más de ${pesos(c.monto)} por pagar: revisa cuál es.` } : {}) };
}
// "Todavía lo debo" (al contado): la fecha esperada por defecto
export const fechaDebo = hoy => sumarDias(hoy, DIAS_DEBO);
