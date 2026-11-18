// ═══════════════════════════════════════════════════════════════════════
//  Sistema Fën — Bodega: las facturas de compra suman al stock (modelo)  v0.133.0 (pedido por Emmanuel el 17 nov)
//  Cada línea de factura asociada (Finanzas → costos_asoc) a una materia prima crítica entra sola como llegada a su bodega:
//  cantidad facturada × lo que trae una unidad (saco 25 kg → 25.000 g). Va al día de Administración (dias/ADM_{fecha de la
//  factura}) con un id fijo (fac_…): leerla dos veces no la repite y, si alguien la anula, no vuelve a entrar.
//  La llegada vale desde la fecha de recepción (la de la factura si no se cambia): el stock se recalcula siempre como
//  último conteo + llegadas − consumo, así una factura cargada tarde descuenta hacia atrás sola. Las jefas ya no anotan
//  llegadas: solo cuentan cuando se les pide. Puro: sin red ni pantalla.
// ═══════════════════════════════════════════════════════════════════════
export const INICIO = '2026-10-01';   // las facturas desde aquí (antes, lo que había quedó en el conteo del 11 oct)
const s = v => (v == null ? '' : String(v));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sinTildes = t => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const idLlegada = lineaId => ('fac_' + s(lineaId).replace(/#/g, '_L').replace(/[^A-Za-z0-9_-]/g, '_')).slice(0, 120);
// La hora de una llegada de factura: mediodía del día de recepción (un conteo de ese día, hecho al cerrar, ya la incluye)
export const enDeRecepcion = fecha => `${fecha}T12:00:00.000Z`;
const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));

// Las compras de las críticas: líneas (Finanzas.leerCompras) asociadas a una materia prima que es crítica en alguna bodega.
// criticas: [{ mp: { id, nombre }, cfg: { unidad, envase }, bodega, docId }] (de calcularBodega). Las notas de crédito no suman.
// → [{ id (de la llegada), linea, docId, fecha, folio, proveedor, descripcion, cantidad, unidadFactura, contenido, total (g, ml o un),
//      mp, nombre, unidad, bodega, docStock, esNC }] (las más nuevas primero)
export function comprasCriticas(lineas, asocs, criticas, { inicio = INICIO } = {}) {
  const porMp = new Map();
  (criticas || []).forEach(c => { if (c && c.mp && !porMp.has(c.mp.id)) porMp.set(c.mp.id, c); });
  const out = [];
  (lineas || []).forEach(l => {
    const a = (asocs || {})[l.clave];
    if (!a || a.ignorar || !a.mp || !porMp.has(a.mp) || s(l.fecha) < inicio) return;
    const c = porMp.get(a.mp), cont = a.contenidoPorUnidad || null, q = num(l.cantidad);
    if (!cont || !(num(cont.cantidad) > 0)) return;
    out.push({ id: idLlegada(l.id), linea: l.id, docId: l.docId, fecha: s(l.fecha), folio: s(l.folio), proveedor: s(l.proveedor), descripcion: s(l.descripcion),
      cantidad: q, unidadFactura: s(l.unidad), contenido: cont, total: Math.round(q * num(cont.cantidad) * 100) / 100,
      mp: a.mp, nombre: s(c.mp.nombre), unidad: s((c.cfg && c.cfg.unidad) || cont.unidad), bodega: s(c.bodega), docStock: s(c.docId || a.mp), esNC: !!l.esNC });
  });
  return out.sort((x, y) => y.fecha.localeCompare(x.fecha) || num(y.folio) - num(x.folio));
}
// Las llegadas de factura que ya existen (anuladas o no) en los días de Administración: { id: { fecha, b } }
export function yaAnotadas(diasAdm) {
  const out = {};
  Object.entries(diasAdm || {}).forEach(([fecha, d]) => Object.entries((d && d.bodega) || {}).forEach(([id, b]) => { if (id.startsWith('fac_') && b) out[id] = { fecha, b }; }));
  return out;
}
// La llegada que se anota para una compra (recepción: la fecha en que llegó, si no es la de la factura)
export function llegadaDe(c, { recepcion = '', conStock = false } = {}) {
  const r = esFecha(recepcion) ? recepcion : c.fecha;
  return { tipo: 'llegada', mp: c.mp, nombre: c.nombre, bodega: c.bodega, ...(conStock ? { stock: c.docStock } : {}), cantidad: c.total, unidad: c.unidad,
    nota: `Factura F. ${c.folio} · ${c.proveedor}`.slice(0, 120), por: 'factura', en: enDeRecepcion(r), recepcion: r,
    factura: { docId: c.docId, linea: c.linea, folio: c.folio, proveedor: c.proveedor.slice(0, 120), fecha: c.fecha, descripcion: c.descripcion.slice(0, 120), cantidad: c.cantidad, unidad: c.unidadFactura, contenido: c.contenido } };
}
// Qué falta anotar: las compras (no notas de crédito) sin su llegada, dentro de los días que lee la bodega
export function porAnotar(compras, anotadas, { desde = '' } = {}) {
  return (compras || []).filter(c => !c.esNC && !(anotadas || {})[c.id] && (!desde || c.fecha >= desde));
}
// Para la pantalla: cada factura (un documento) con sus líneas de críticas y en qué quedó cada una
// → [{ docId, fecha, folio, proveedor, recepcion, lineas: [{ …compra, estado: 'entro'|'anulada'|'nc'|'falta', recepcion }] }]
export function porFactura(compras, anotadas) {
  const g = new Map();
  (compras || []).forEach(c => {
    const a = (anotadas || {})[c.id], b = a && a.b;
    const estado = c.esNC ? 'nc' : !b ? 'falta' : b.anulado ? 'anulada' : 'entro';
    if (!g.has(c.docId)) g.set(c.docId, { docId: c.docId, fecha: c.fecha, folio: c.folio, proveedor: c.proveedor, recepcion: '', lineas: [] });
    const f = g.get(c.docId); f.lineas.push({ ...c, estado, recepcion: (b && b.recepcion) || '' });
    if (b && b.recepcion && b.recepcion !== c.fecha) f.recepcion = b.recepcion;
  });
  return [...g.values()];
}
// Productos de factura todavía sin asociar que parecen de una crítica: el nombre comparte una palabra de 5+ letras con el de
// la crítica ("harina", "mantequilla"). Uno por producto (el más nuevo). Lo que no es, se marca "No es materia prima".
// → [{ clave, rut, proveedor, descripcion, codigo, unidad, fecha, folio, cantidad, sugerida (mp id) }]
export function sinAsociar(lineas, asocs, criticas, { inicio = INICIO } = {}) {
  const crit = (criticas || []).filter(c => c && c.mp), palabras = new Map();
  crit.forEach(c => sinTildes(c.mp.nombre).split(/[^a-z]+/).filter(w => w.length >= 5).forEach(w => { if (!palabras.has(w)) palabras.set(w, c.mp.id); }));
  const vistos = new Map();
  (lineas || []).forEach(l => {
    if (s(l.fecha) < inicio || l.esNC || (asocs || {})[l.clave]) return;
    const d = sinTildes(l.descripcion), w = [...palabras.keys()].find(p => d.includes(p));
    if (!w) return;
    const prev = vistos.get(l.clave);
    if (!prev || s(l.fecha) > prev.fecha) vistos.set(l.clave, { clave: l.clave, rut: s(l.rut), proveedor: s(l.proveedor), descripcion: s(l.descripcion), codigo: s(l.codigo), unidad: s(l.unidad), fecha: s(l.fecha), folio: s(l.folio), cantidad: num(l.cantidad), sugerida: palabras.get(w) });
  });
  return [...vistos.values()].sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es') || a.descripcion.localeCompare(b.descripcion, 'es'));
}
// Una llegada de factura con la fecha de recepción cambiada
export const conRecepcion = (b, fecha) => ({ ...b, en: enDeRecepcion(fecha), recepcion: fecha });
// Las llegadas anotadas a mano (por las jefas o en Bodega) de una crítica que ya recibe sus facturas: desde que entran las
// facturas, se repiten. movs: los de calcularBodega (sin anuladas). → [{ id, area, fecha, mp, nombre, cantidad, unidad, por }]
export function manualesRepetidas(movs, compras, { inicio = INICIO } = {}) {
  const conFactura = new Set((compras || []).filter(c => !c.esNC).map(c => c.mp));
  return (movs || []).filter(m => m.tipo === 'llegada' && !String(m.id).startsWith('fac_') && m.por !== 'factura' && conFactura.has(m.mp) && s(m.fecha) >= inicio)
    .map(m => ({ id: m.id, area: m.area, fecha: m.fecha, mp: m.mp, nombre: s(m.nombre), cantidad: num(m.cantidad), unidad: s(m.unidad), por: s(m.por) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
