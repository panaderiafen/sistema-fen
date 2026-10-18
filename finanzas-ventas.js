// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas F2 paso 1: ventas por producto, área y canal (funciones puras)  v0.60.0 (costo extra por venta en el vínculo)
//  Sin Firebase ni pantalla: reciben los datos ya leídos (resúmenes de cierre de la caja, órdenes B2B,
//  catálogos y vínculos guardados) y devuelven líneas, tablas, totales y cobertura. Todo en neto.
//
//  Dos ejes: el ÁREA que produce (PAN · BOL · PAS · CAF, la de la receta del producto) y el CANAL donde se vende
//  (caja Barros Arana · caja Ainavillo · B2B).
//
//  Línea de venta (lo que se guarda por mes y canal): { suc: 'barros'|'ainavillo'|'b2b', productoId, nombre, cantidad, neto,
//    recetaCatalogo, areaCatalogo }. Una por producto y sucursal dentro del mes.
//  Vínculo (fin_productos/{canal}_{productoId}): { canal: 'caja'|'b2b', productoId, nombre, tipo: 'receta'|'reventa'|'ignorar',
//    receta (id) | null, recetaNombre, reventa (bool), costoReventaNeto, ignorar (bool), unidadesPorVenta, area, origen }.
//  v0.69.1: área REVENTA (solo de margen) para lo que se compra hecho. AREAS = las de margen (las 4 de producción + REVENTA);
//  AREAS_PRODUCCION = las que producen (la de una receta o del catálogo). Las listas salen de areas.js.
// ═══════════════════════════════════════════════
import * as AR from './areas.js?v=0.69.5';

export const AREAS = AR.MARGEN;
export const AREAS_PRODUCCION = AR.PRODUCCION;
export const REVENTA = AR.REVENTA;
export const NOMBRE_AREA = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', REVENTA: 'Reventa' };
export const SUCS = ['barros', 'ainavillo', 'b2b'];
export const NOMBRE_SUC = { barros: 'Caja Barros Arana', ainavillo: 'Caja Ainavillo', b2b: 'B2B' };
export const DIAS_GRACIA = 7;   // las ventas de un mes se guardan desde el día 8 del mes siguiente (el cierre de Finanzas, desde la v0.69.5, va después de cargar el Previred del mes, a más tardar el 13)

const s = v => (v === null || v === undefined ? '' : String(v));
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const red = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
export const normalizar = t => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const slug = t => normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sin-nombre';

// Neto desde un precio con IVA (19 %), redondeado al peso
export const netoDeBruto = b => Math.round(num(b) / 1.19);
// Sucursal de la caja: 'ainavillo' o (todo lo demás) 'barros'
export const sucursalCaja = x => (/ainavillo/i.test(s(x)) ? 'ainavillo' : 'barros');
export const canalDeSuc = suc => (suc === 'b2b' ? 'b2b' : 'caja');
// Id de documento seguro (Firestore no acepta "/")
export const idDoc = t => s(t).replace(/\//g, '_').replace(/^\.+$/, '_').slice(0, 300) || '_';
export const claveProducto = (canal, productoId) => `${canal}_${idDoc(productoId)}`;
// Área desde lo que traiga un catálogo: "PAN", "Panadería", "Sándwiches"…
const AREA_TXT = { pan: 'PAN', panaderia: 'PAN', sandwiches: 'PAN', bol: 'BOL', bolleria: 'BOL', pas: 'PAS', pasteleria: 'PAS', chocolateria: 'PAS', caf: 'CAF', cafeteria: 'CAF' };
// Solo las de producción: una receta o un catálogo nunca dicen REVENTA
export const areaDe = a => AREA_TXT[normalizar(a)] || (AREAS_PRODUCCION.includes(s(a).toUpperCase()) ? s(a).toUpperCase() : '');
// v0.69.1 · El área de margen de un vínculo (acepta REVENTA)
export const areaMargenDe = a => (normalizar(a) === 'reventa' ? REVENTA : areaDe(a));
// v0.69.1 · El área con que cuenta un vínculo: la elegida; una reventa sin área va a REVENTA (lo elegido antes se respeta)
export const areaVinculo = v => (!v ? '' : s(v.area) ? s(v.area) : v.tipo === 'reventa' ? REVENTA : '');
// v0.69.1 · Vínculos de reventa que todavía no están en el área REVENTA (para pasarlos de una vez, con su historial)
export const reventaFueraDeArea = vinculos => Object.entries(vinculos || {}).filter(([, v]) => v && v.tipo === 'reventa' && s(v.area) !== REVENTA)
  .map(([clave, v]) => ({ clave, ...v })).sort((a, b) => s(a.nombre).localeCompare(s(b.nombre), 'es'));

// ── Meses ──
export const mesDe = f => s(f).slice(0, 7);
export function mesesEntre(desde, hasta) {
  let [a, b] = [mesDe(desde), mesDe(hasta)]; if (b < a) [a, b] = [b, a];
  const out = []; let [y, m] = a.split('-').map(Number);
  while (out.length < 36) { const k = `${y}-${String(m).padStart(2, '0')}`; out.push(k); if (k >= b) break; m++; if (m > 12) { m = 1; y++; } }
  return out;
}
export const ultimoDia = mes => { const [y, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
export const mesMas = (mes, n) => { const [y, m] = mes.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
// ¿El mes ya se puede guardar como cerrado? Terminó y pasaron los días de gracia (hoy ≥ día 8 del mes siguiente)
export function mesCerrado(mes, hoy, gracia = DIAS_GRACIA) {
  const sig = mesMas(mes, 1);
  return s(hoy) >= `${sig}-${String(gracia + 1).padStart(2, '0')}`;
}
// Período: 'mes' (este mes hasta hoy) · 'mesAnterior' · 'rango' (desdeMes, hastaMes; hasta 12 meses)
export function periodo(tipo, hoy, desdeMes, hastaMes) {
  const esteMes = mesDe(hoy);
  if (tipo === 'mesAnterior') { const m = mesMas(esteMes, -1); return { desde: `${m}-01`, hasta: ultimoDia(m), meses: [m] }; }
  if (tipo === 'rango' && desdeMes && hastaMes) {
    let meses = mesesEntre(desdeMes, hastaMes).filter(m => m <= esteMes);
    if (!meses.length) meses = [esteMes];
    meses = meses.slice(-12);
    const ult = meses[meses.length - 1];
    return { desde: `${meses[0]}-01`, hasta: ult === esteMes ? s(hoy) : ultimoDia(ult), meses };
  }
  return { desde: `${esteMes}-01`, hasta: s(hoy), meses: [esteMes] };
}

// ── Líneas desde las fuentes ──
// Resúmenes de cierre (resumenes_caja, uno por cierre) → líneas por sucursal y producto. prods: catálogo de la caja { id: producto }.
export function lineasDeResumenes(resumenes, prods = {}) {
  const L = {};
  (resumenes || []).forEach(r => {
    const suc = sucursalCaja(r.sucursal);
    Object.entries(r.porProducto || {}).forEach(([pid, pp]) => {
      if (!pp) return;
      const k = suc + '|' + pid, p = prods[pid] || {};
      const neto = pp.neto !== undefined && pp.neto !== null ? num(pp.neto) : netoDeBruto(pp.bruto);
      const x = L[k] || (L[k] = { suc, productoId: pid, nombre: s(p.nombre || pp.nombre) || pid, cantidad: 0, neto: 0, recetaCatalogo: s(p.idRecetaFen || pp.idRecetaFen), areaCatalogo: areaDe(p.area || pp.area) });
      x.cantidad += num(pp.cantidad); x.neto += neto;
    });
  });
  return Object.values(L).map(x => ({ ...x, cantidad: red(x.cantidad), neto: Math.round(x.neto) }));
}
// Órdenes B2B (sin anuladas ni quitadas) → líneas por producto. Los precios de B2B son netos.
export function idProductoB2b(l) { return s(l.productoId) || 'n-' + slug(l.producto); }
export function lineasDeOrdenes(ordenes, prods = {}) {
  const L = {};
  (ordenes || []).filter(o => o && o.estado !== 'anulada' && !o.quitadoEnPlanilla).forEach(o => (o.lineas || []).forEach(l => {
    const pid = idProductoB2b(l), p = prods[pid] || {};
    const cant = num(l.cantidad), neto = l.neto !== undefined && l.neto !== null && l.neto !== '' ? num(l.neto) : Math.round(cant * num(l.precio));
    const x = L[pid] || (L[pid] = { suc: 'b2b', productoId: pid, nombre: s(p.nombre || l.producto) || pid, cantidad: 0, neto: 0, recetaCatalogo: s(p.idReceta), areaCatalogo: areaDe(p.area || p.categoria) });
    x.cantidad += cant; x.neto += neto;
  }));
  return Object.values(L).map(x => ({ ...x, cantidad: red(x.cantidad), neto: Math.round(x.neto) }));
}
// Junta las líneas de varios meses (misma sucursal y producto se suman)
export function juntar(...listas) {
  const L = {};
  listas.flat().forEach(l => {
    if (!l) return;
    const k = l.suc + '|' + l.productoId;
    const x = L[k] || (L[k] = { ...l, cantidad: 0, neto: 0 });
    x.cantidad += num(l.cantidad); x.neto += num(l.neto);
    if (!x.recetaCatalogo && l.recetaCatalogo) x.recetaCatalogo = l.recetaCatalogo;
  });
  return Object.values(L).map(x => ({ ...x, cantidad: red(x.cantidad) }));
}

// Pone el nombre y el id de receta del catálogo de hoy (las líneas guardadas de meses pasados traen los de ese mes)
export function conCatalogo(lineas, prodsCaja = {}, prodsB2b = {}) {
  return (lineas || []).map(l => {
    const p = (l.suc === 'b2b' ? prodsB2b : prodsCaja)[l.productoId];
    if (!p) return l;
    const rec = l.suc === 'b2b' ? s(p.idReceta) : s(p.idRecetaFen);
    return { ...l, nombre: s(p.nombre) || l.nombre, recetaCatalogo: rec || l.recetaCatalogo || '', areaCatalogo: areaDe(p.area) || l.areaCatalogo || '' };
  });
}

// ── Sugerencias por nombre ──
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'en', 'al', 'por', 'un', 'una', 'x', 'c', 'u', 'gr', 'grs', 'kg', 'cc', 'ml', 'lt', 'unidad', 'unid', 'und', 'un']);
const palabras = t => normalizar(t).split(' ').filter(w => w.length >= 2 && !/^\d+$/.test(w) && !VACIAS.has(w));
const parecidas = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
// Recetas de nombre parecido: [{ id, nombre, area, puntaje }] (las sub recetas no se sugieren)
export function sugerirRecetas(nombre, recetas, max = 5) {
  const pi = palabras(nombre);
  if (!pi.length) return [];
  return (recetas || []).filter(r => r && r.tipo !== 'sub_receta' && !/borrador/i.test(s(r.estado))).map(r => {
    const pr = palabras(r.nombre);
    if (!pr.length) return null;
    const a = pi.filter(w => pr.some(v => parecidas(w, v))).length, b = pr.filter(v => pi.some(w => parecidas(w, v))).length;
    if (!a) return null;
    return { id: r.id, nombre: s(r.nombre) || r.id, area: areaDe(r.area), puntaje: red((a / pi.length + b / pr.length) / 2, 3) };
  }).filter(Boolean).sort((x, y) => y.puntaje - x.puntaje || x.nombre.localeCompare(y.nombre, 'es')).slice(0, max);
}
// Propuesta para un producto sin vínculo: primero el id de receta del catálogo (ID_receta de la caja o de B2B), si existe;
// si no, la receta de nombre más parecido (puntaje ≥ 0,5). → { receta, recetaNombre, area, origen: 'catalogo'|'nombre', puntaje, aviso }
export function proponer(item, recetas) {
  const porId = {}; (recetas || []).forEach(r => { porId[r.id] = r; });
  const cat = s(item.recetaCatalogo);
  if (cat && porId[cat]) return { receta: cat, recetaNombre: s(porId[cat].nombre) || cat, area: areaDe(porId[cat].area), origen: 'catalogo', puntaje: 1 };
  const sug = sugerirRecetas(item.nombre, recetas, 1)[0];
  const aviso = cat ? `El catálogo dice ${cat}, pero esa receta no está en Producción.` : '';
  if (sug && sug.puntaje >= 0.5) return { receta: sug.id, recetaNombre: sug.nombre, area: sug.area, origen: 'nombre', puntaje: sug.puntaje, aviso };
  return aviso ? { receta: null, origen: 'ninguna', aviso } : null;
}

// ── Vínculos ──
export const decidido = v => !!(v && (v.tipo === 'receta' || v.tipo === 'reventa' || v.tipo === 'ignorar'));
export const upv = v => (v && num(v.unidadesPorVenta) > 0 ? num(v.unidadesPorVenta) : 1);
// datos: { canal, productoId, nombre, tipo, receta, unidadesPorVenta, costoReventaNeto, area, conIva, nota } → { doc, hist }
export function armarVinculo(prev, datos, { recetas = [], hoy = '', por = '' } = {}) {
  const canal = datos.canal === 'b2b' ? 'b2b' : 'caja', tipo = s(datos.tipo);
  if (!['receta', 'reventa', 'ignorar'].includes(tipo)) throw new Error('Elige qué es: receta, reventa o no es un producto.');
  if (!s(datos.productoId)) throw new Error('Falta el producto.');
  const u = s(datos.unidadesPorVenta) === '' ? 1 : Number(String(datos.unidadesPorVenta).replace(',', '.'));
  if (tipo !== 'ignorar' && !(u > 0 && u <= 1000)) throw new Error('Unidades por venta: un número mayor que 0 (por ejemplo 6 para una caja de 6).');
  const doc = { canal, productoId: s(datos.productoId), nombre: s(datos.nombre).slice(0, 200), tipo, receta: null, recetaNombre: '', reventa: false, costoReventaNeto: null, ignorar: false,
    unidadesPorVenta: tipo === 'ignorar' ? 1 : red(u, 3), area: '', origen: s(datos.origen) || 'manual', nota: s(datos.nota).trim().slice(0, 200), fecha: hoy, por };
  if (tipo === 'receta') {
    const r = (recetas || []).find(x => x.id === s(datos.receta));
    if (!r) throw new Error('Elige la receta.');
    Object.assign(doc, { receta: r.id, recetaNombre: s(r.nombre) || r.id, area: areaDe(r.area) });
  } else if (tipo === 'reventa') {
    const a = areaMargenDe(datos.area);
    if (!a) throw new Error('Elige el área a la que va la reventa (lo normal: Reventa).');
    let c = s(datos.costoReventaNeto).trim() === '' ? null : Number(String(datos.costoReventaNeto).replace(',', '.'));
    if (c !== null && !(c >= 0)) throw new Error('El costo de compra debe ser un número (o déjalo vacío).');
    if (c !== null && datos.conIva) c = red(c / 1.19, 2);
    Object.assign(doc, { reventa: true, area: a, costoReventaNeto: c });
  } else doc.ignorar = true;
  // v0.60.0: costo extra por venta, neto (envases que no están en la receta: caja, bolsa, vaso)
  const ex = s(datos.costoExtraNeto).trim();
  if (tipo !== 'ignorar' && ex !== '') {
    const e = Number(ex.replace(',', '.'));
    if (!(e >= 0)) throw new Error('Costo extra por venta: un número (o déjalo vacío).');
    doc.costoExtraNeto = red(e, 2);
  } else doc.costoExtraNeto = null;
  const corto = x => x ? { tipo: x.tipo, receta: x.receta || null, recetaNombre: x.recetaNombre || '', unidadesPorVenta: x.unidadesPorVenta ?? 1, area: x.area || '', costoReventaNeto: x.costoReventaNeto ?? null, ...(x.costoExtraNeto !== null && x.costoExtraNeto !== undefined ? { costoExtraNeto: x.costoExtraNeto } : {}) } : null;
  const a = corto(prev), b = corto(doc);
  const igual = JSON.stringify(a) === JSON.stringify(b);
  return { doc, hist: igual ? null : { clave: claveProducto(canal, doc.productoId), nombre: doc.nombre, accion: prev ? 'cambio' : 'nuevo', antes: a, despues: b, origen: doc.origen, nota: doc.nota, fecha: hoy, por } };
}
export function textoVinculo(v) {
  if (!v) return 'Sin asociar';
  if (v.tipo === 'ignorar') return 'No es un producto (no suma)';
  const u = upv(v) !== 1 ? ` × ${String(upv(v)).replace('.', ',')} un` : '';
  if (v.tipo === 'reventa') return `Reventa${areaVinculo(v) === REVENTA ? '' : ' · ' + (NOMBRE_AREA[v.area] || v.area)}${v.costoReventaNeto !== null && v.costoReventaNeto !== undefined ? ` · costo $${Math.round(v.costoReventaNeto).toLocaleString('es-CL')} neto` : ''}${u}`;
  const ex = v.costoExtraNeto > 0 ? ` · envase $${Math.round(v.costoExtraNeto).toLocaleString('es-CL')}` : '';
  return `${v.recetaNombre || v.receta}${u}${ex}`;
}

// ── Productos vendidos (uno por canal y producto del catálogo) con su venta y vínculo ──
// → [{ clave, canal, productoId, nombre, porSuc { suc: { cantidad, neto } }, cantidad, neto, vinculo, propuesta }] de mayor a menor venta
export function productosVendidos(lineas, vinculos = {}, recetas = []) {
  const P = {};
  (lineas || []).forEach(l => {
    const canal = canalDeSuc(l.suc), clave = claveProducto(canal, l.productoId);
    const x = P[clave] || (P[clave] = { clave, canal, productoId: l.productoId, nombre: l.nombre, recetaCatalogo: l.recetaCatalogo || '', areaCatalogo: l.areaCatalogo || '', porSuc: {}, cantidad: 0, neto: 0 });
    const ps = x.porSuc[l.suc] || (x.porSuc[l.suc] = { cantidad: 0, neto: 0 });
    ps.cantidad = red(ps.cantidad + num(l.cantidad)); ps.neto += num(l.neto);
    x.cantidad = red(x.cantidad + num(l.cantidad)); x.neto += num(l.neto);
    if (!x.recetaCatalogo && l.recetaCatalogo) x.recetaCatalogo = l.recetaCatalogo;
  });
  return Object.values(P).map(x => {
    const v = vinculos[x.clave] || null;
    return { ...x, vinculo: decidido(v) ? v : null, propuesta: decidido(v) ? null : proponer(x, recetas) };
  }).sort((a, b) => b.neto - a.neto || s(a.nombre).localeCompare(s(b.nombre), 'es'));
}

// ── Tabla "Ventas por producto": agrupa por receta (caja y B2B juntos), por reventa o por producto sin asociar ──
// filtro: { canal: 'todos'|'barros'|'ainavillo'|'b2b' }. Los "no es un producto" no van en la tabla (suman en totales.ignorado).
// Fila: { clave, tipo: receta|reventa|sin, nombre, area, receta, fuentes [{ canal, nombre, unidadesPorVenta }], porSuc { suc: { cantidad, unidades, neto } },
//   cantidad (lo vendido), unidades (de la receta = cantidad × unidades por venta), neto, precioUnidad (neto ÷ unidades), precioVenta (neto ÷ cantidad) }
export function tablaVentas(productos, { canal = 'todos' } = {}) {
  const F = {};
  (productos || []).forEach(p => {
    const v = p.vinculo;
    if (v && v.tipo === 'ignorar') return;
    const sucs = Object.keys(p.porSuc).filter(sc => canal === 'todos' || sc === canal);
    if (!sucs.length) return;
    const tipo = v ? v.tipo : 'sin';
    const clave = tipo === 'receta' ? 'r:' + v.receta : (tipo === 'reventa' ? 'v:' : 's:') + p.clave;
    const f = F[clave] || (F[clave] = { clave, tipo, nombre: tipo === 'receta' ? (v.recetaNombre || v.receta) : p.nombre, area: areaVinculo(v), receta: tipo === 'receta' ? v.receta : null,
      productoClave: tipo === 'receta' ? null : p.clave, fuentes: [], porSuc: {}, cantidad: 0, unidades: 0, neto: 0 });
    const u = upv(v);
    f.fuentes.push({ canal: p.canal, nombre: p.nombre, unidadesPorVenta: u, clave: p.clave });
    sucs.forEach(sc => {
      const x = p.porSuc[sc], y = f.porSuc[sc] || (f.porSuc[sc] = { cantidad: 0, unidades: 0, neto: 0 });
      y.cantidad = red(y.cantidad + x.cantidad); y.unidades = red(y.unidades + x.cantidad * u); y.neto += x.neto;
      f.cantidad = red(f.cantidad + x.cantidad); f.unidades = red(f.unidades + x.cantidad * u); f.neto += x.neto;
    });
  });
  return Object.values(F).map(f => ({ ...f, precioUnidad: f.unidades > 0 ? Math.round(f.neto / f.unidades) : null, precioVenta: f.cantidad > 0 ? Math.round(f.neto / f.cantidad) : null }))
    .filter(f => f.neto !== 0 || f.cantidad !== 0)
    .sort((a, b) => b.neto - a.neto || s(a.nombre).localeCompare(s(b.nombre), 'es'));
}
// Totales del período (sobre los productos vendidos): por área, por canal (sucursal), sin asociar, ignorado y cobertura
export function totales(productos, { canal = 'todos' } = {}) {
  const t = { total: 0, porArea: Object.fromEntries(AREAS.map(a => [a, 0])), porSuc: { barros: 0, ainavillo: 0, b2b: 0 }, sinAsociar: 0, ignorado: 0, reventa: 0, todo: 0, decidido: 0, nSinAsociar: 0 };
  (productos || []).forEach(p => {
    const v = p.vinculo;
    let neto = 0;
    Object.entries(p.porSuc).forEach(([sc, x]) => { if (canal !== 'todos' && sc !== canal) return; neto += x.neto; if (!v || v.tipo !== 'ignorar') t.porSuc[sc] = (t.porSuc[sc] || 0) + x.neto; });
    if (!neto && !Object.keys(p.porSuc).some(sc => canal === 'todos' || sc === canal)) return;
    t.todo += neto;
    if (v) t.decidido += neto;
    if (v && v.tipo === 'ignorar') { t.ignorado += neto; return; }
    t.total += neto;
    if (!v) { t.sinAsociar += neto; t.nSinAsociar++; return; }
    if (v.tipo === 'reventa') t.reventa += neto;
    const ar = areaVinculo(v); if (ar) t.porArea[ar] = (t.porArea[ar] || 0) + neto;
  });
  return { ...t, ...cobertura(t.decidido, t.todo) };
}
// Cobertura: parte de la venta neta del período que ya tiene vínculo (receta, reventa o "no es un producto")
export function cobertura(decididoNeto, todoNeto) {
  const pct = todoNeto > 0 ? decididoNeto / todoNeto * 100 : null;
  return { pct, pctTxt: pct === null ? '—' : (pct >= 99.95 || pct === 0 ? String(Math.round(pct)) : (Math.floor(pct * 10) / 10).toLocaleString('es-CL')) + ' %' };
}

// ── Caché del mes (fin_ventas_mes/{AAAA-MM}_{canal}) ──
// ¿Se puede guardar? Mes cerrado (día 8 del mes siguiente) y, en la caja, sin cajas abiertas ni cierres sin resumen.
export function guardable(mes, hoy, { abiertas = 0, faltan = 0 } = {}) { return mesCerrado(mes, hoy) && !abiertas && !faltan; }
export function docMes(mes, canal, lineas, extra = {}) {
  return { mes, canal, lineas: (lineas || []).map(l => ({ suc: l.suc, productoId: s(l.productoId), nombre: s(l.nombre).slice(0, 200), cantidad: red(num(l.cantidad)), neto: Math.round(num(l.neto)), recetaCatalogo: s(l.recetaCatalogo), areaCatalogo: s(l.areaCatalogo) })),
    neto: Math.round((lineas || []).reduce((a, l) => a + num(l.neto), 0)), version: 1, ...extra };
}
// Lecturas estimadas de leer un mes sin caché: caja ≈ cierres (resúmenes) + cajas del mes; B2B ≈ órdenes del mes. Con caché: 1.
export const lecturasEstimadas = ({ cierres = 0, cajas = 0, ordenes = 0, cache = 0 }) => Math.max(0, cierres) + Math.max(0, cajas) + Math.max(0, ordenes) + cache;
