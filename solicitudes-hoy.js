// ═══════════════════════════════════════════════════════════════════════
//  Sistema Fën — Hoy → Solicitudes (modelo)  v0.132.0 (pedido por Emmanuel el 17 nov: todas juntas en Hoy)
//  Junta lo que piden las otras apps y sigue esperando respuesta: la caja (anular una venta, pedir un producto), logística
//  (anular una orden, producto nuevo, agregar a B2B, precio especial) y Cocina (receta propuesta, materia prima nueva).
//  Cada una lleva a la pantalla donde se resuelve (esas pantallas siguen igual). Puro: sin red ni pantalla.
// ═══════════════════════════════════════════════════════════════════════
const s = v => (v == null ? '' : String(v));
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const SUC = { barros_arana: 'Barros Arana', ainavillo: 'Ainavillo' };
const AREA = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', panaderia: 'Panadería', bolleria: 'Bollería', pasteleria: 'Pastelería', cafeteria: 'Cafetería', cocina: 'Cocina' };
// Fecha de cualquier forma (Timestamp, {seconds}, ISO, texto "AAAA-MM-DD HH:MM", ms) → ms (0 si no se sabe)
export function ms(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v.__ts !== undefined) return Number(v.__ts) || 0;
  const t = Date.parse(String(v).replace(' ', 'T')); return Number.isFinite(t) ? t : 0;
}
// "hace 5 min", "hace 3 horas", "ayer", "hace 4 días"
export function hace(t, ahora = Date.now()) {
  if (!t) return '';
  const m = Math.max(0, Math.round((ahora - t) / 60000));
  if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : `hace ${d} días`;
}
export const ORIGENES = { caja: 'Caja', logistica: 'Logística', cocina: 'Cocina' };
// fuentes: { anul: [solicitudes_anulacion], caja: [solicitudes_producto], b2b: [solicitudes de fen-b2b], cocina: { recetas, mps } }
// (null = esa fuente no se pudo leer o no está conectada). → [{ id, origen, tipo, que, detalle, quien, en, url, chip }] (la más antigua primero)
export function armar({ anul = null, caja = null, b2b = null, cocina = null } = {}) {
  const out = [];
  (anul || []).forEach(x => out.push({ id: 'an:' + x.id, origen: 'caja', tipo: 'anular_venta', que: `Anular una venta de ${pesos(x.total)}`,
    detalle: [SUC[x.sucursal] || x.sucursal, x.medioPago, x.motivo ? `"${s(x.motivo).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), quien: s(x.solicitadoPor), en: ms(x.fechaSolicitud), url: '#caja/anulaciones', chip: 'Revisar' }));
  (caja || []).forEach(x => out.push({ id: 'cp:' + x.id, origen: 'caja', tipo: 'producto', que: `Producto nuevo: ${s(x.nombre)}`,
    detalle: [SUC[x.sucursal] || x.sucursal, x.precioSugerido ? `precio sugerido ${pesos(x.precioSugerido)}` : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), quien: s(x.por), en: ms(x.en), url: '#catalogo/productos', chip: 'Resolver' }));
  (b2b || []).forEach(x => {
    const t = x.tipo, base = { id: 'b2:' + x.id, origen: 'logistica', tipo: t, quien: s(x.por), en: ms(x.en) };
    if (t === 'anulacion') out.push({ ...base, que: `Anular la orden N° ${s(x.n)}`, detalle: [x.cliente, x.precio ? pesos(x.precio) : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), url: '#b2b/solicitudes', chip: 'Responder' });
    else if (t === 'producto') out.push({ ...base, que: `Producto nuevo: ${s(x.producto)}`, detalle: [x.cliente ? `para ${x.cliente}` : '', x.precio ? `precio ${pesos(x.precio)}` : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), url: '#catalogo/productos', chip: 'Resolver' });
    else if (t === 'precio') out.push({ ...base, que: `Precio especial: ${s(x.producto)}`, detalle: [x.cliente ? `para ${x.cliente}` : '', x.precio ? pesos(x.precio) : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), url: '#b2b/solicitudes', chip: 'Responder' });
    else out.push({ ...base, que: `Agregar a B2B: ${s(x.producto)}`, detalle: [x.precio ? `precio ${pesos(x.precio)}` : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), url: '#b2b/solicitudes', chip: 'Responder' });
  });
  if (cocina) {
    (cocina.recetas || []).forEach(x => out.push({ id: 'cr:' + x.docId, origen: 'cocina', tipo: 'receta', que: `${x.cambio ? 'Cambio en la receta' : 'Receta nueva'}: ${s(x.nombre) || 'sin nombre'}`,
      detalle: AREA[x.area] || s(x.area), quien: s(x.por), en: ms(x.en), url: '#produccion', chip: 'Revisar' }));
    (cocina.mps || []).forEach(x => out.push({ id: 'cm:' + x.docId, origen: 'cocina', tipo: 'materia_prima', que: `${x.tipo === 'nueva' || !x.tipo ? 'Materia prima nueva' : 'Habilitar materia prima'}: ${s(x.nombre) || 'sin nombre'}`,
      detalle: [AREA[x.area] || x.area, x.receta ? `para ${x.receta}` : '', x.nota ? `"${s(x.nota).slice(0, 80)}"` : ''].filter(Boolean).join(' · '), quien: s(x.por), en: ms(x.en), url: '#produccion', chip: 'Resolver' }));
  }
  return out.sort((a, b) => (a.en || Infinity) - (b.en || Infinity) || a.que.localeCompare(b.que, 'es'));
}
// "3 de la caja · 2 de logística"
export function resumen(items) {
  const n = {}; (items || []).forEach(x => { n[x.origen] = (n[x.origen] || 0) + 1; });
  const de = { caja: 'de la caja', logistica: 'de logística', cocina: 'de Cocina' };
  return Object.keys(ORIGENES).filter(k => n[k]).map(k => `${n[k]} ${de[k]}`).join(' · ');
}
