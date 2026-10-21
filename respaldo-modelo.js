// ═══════════════════════════════════════════════
//  Sistema Fën — Respaldo mensual en Excel: reglas puras (sin red, sin SheetJS)  v0.73.0
//  Las copias en vivo a las planillas se apagaron (v0.73.0): en su lugar, una vez al mes se baja un .xlsx con lo del mes y los catálogos.
//  Aquí se arma cada hoja como { nombre, columnas, filas } (filas = listas de celdas); respaldo.js las pasa a SheetJS y descarga.
//  Lo que es un objeto o una lista se guarda como texto (JSON), para no perder nada; las horas de Firestore, como fecha y hora ISO.
// ═══════════════════════════════════════════════
export const HOJAS_MES = ['Resumen', 'Gastos del mes', 'Vencimientos', 'SII docs del mes', 'Cartola cargos del mes', 'B2B órdenes del mes', 'Clientes B2B', 'Productos B2B',
  'Ventas caja del mes', 'Recetas', 'Materias primas', 'Reventa', 'Catálogo vínculos'];
export const HOJAS_CATALOGOS = ['Resumen', 'Recetas', 'Materias primas', 'Reventa', 'Catálogo vínculos', 'Productos caja', 'Clientes B2B', 'Productos B2B'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = mes => { const [y, m] = String(mes || '').split('-').map(Number); return m ? `${MESES[m - 1]} ${y}` : String(mes || ''); };
export const mesAnterior = hoy => { const [y, m] = String(hoy).slice(0, 7).split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export const finDeMes = mes => { const [y, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
const MAX_CELDA = 32000;   // Excel acepta hasta 32.767 caracteres por celda
const FUERA = new Set(['_m', 'historial', 'hoja', 'fila', 'filaOriginal', 'idPlanilla', 'planillaPendiente', 'planillaEn', 'hechoEnBase', 'cache']);

// Un valor de Firestore → una celda (texto, número, booleano o fecha ISO)
export function celda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > MAX_CELDA ? v.slice(0, MAX_CELDA) + '…' : v;
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function') { try { return new Date(v.toMillis()).toISOString(); } catch (e) { return ''; } }
    if (typeof v.__ts === 'number') return new Date(v.__ts).toISOString();
    if (typeof v.seconds === 'number' && Object.keys(v).every(k => ['seconds', 'nanoseconds'].includes(k))) return new Date(v.seconds * 1000).toISOString();
    if (Array.isArray(v) && v.every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x))) return celda(v.join(', '));
    let t; try { t = JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toMillis === 'function' ? new Date(x.toMillis()).toISOString() : x)); } catch (e) { t = String(v); }
    return celda(t);
  }
  return String(v);
}
// Documentos → hoja: primero las columnas de "orden" (las que existan), después las demás en orden alfabético
export function hojaDe(nombre, docs, orden = [], { fuera = [] } = {}) {
  const sin = new Set([...FUERA, ...fuera]);
  const claves = new Set(); (docs || []).forEach(d => Object.keys(d || {}).forEach(k => { if (!sin.has(k)) claves.add(k); }));
  const cols = [...orden.filter(k => claves.has(k)), ...[...claves].filter(k => !orden.includes(k)).sort((a, b) => a.localeCompare(b, 'es'))];
  return { nombre, columnas: cols, filas: (docs || []).map(d => cols.map(k => celda(d[k]))) };
}
const enMes = (f, mes) => String(f || '').slice(0, 7) === mes;
const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };

// ── Hojas del mes ──
export const gastosMes = (gastos, mes) => hojaDe('Gastos del mes', (gastos || []).filter(g => enMes(g.fecha, mes)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id))),
  ['id', 'fecha', 'hora', 'estado', 'itemGasto', 'area', 'monto', 'montoNeto', 'iva', 'proveedor', 'rut', 'folio', 'formaPago', 'medioPago', 'fechaPago', 'observacion', 'origen']);
export const vencimientos = vs => hojaDe('Vencimientos', [...(vs || [])].sort((a, b) => String(a.fechaVencimiento || a.fecha || '').localeCompare(String(b.fechaVencimiento || b.fecha || ''))),
  ['id', 'nombre', 'item', 'estado', 'periodoKey', 'fechaVencimiento', 'montoEstimado', 'montoPago', 'fechaPago', 'plantillaDocId']);
export const siiMes = (docs, mes) => hojaDe('SII docs del mes', (docs || []).filter(d => enMes(d.fecha, mes)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
  ['id', 'fecha', 'tipo', 'folio', 'rut', 'razonSocial', 'totalNeto', 'iva', 'total', 'lineas', 'notas', 'importado']);
export const cartolaMes = (cargos, mes) => hojaDe('Cartola cargos del mes', (cargos || []).filter(c => enMes(c.fecha, mes)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
  ['id', 'fecha', 'descripcion', 'monto', 'estado', 'accion', 'cartolaId', 'resueltoEl', 'resueltoPor']);
// Órdenes B2B: una fila por línea (con los datos de su orden)
export function b2bMes(ordenes, mes) {
  const filas = [];
  [...(ordenes || [])].filter(o => enMes(o.fecha, mes)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || n(a.n) - n(b.n)).forEach(o => {
    const ls = Array.isArray(o.lineas) && o.lineas.length ? o.lineas : [{}];
    ls.forEach((l, i) => filas.push({ 'N° orden': o.n ?? o.id, fecha: o.fecha, cliente: o.cliente || '', clienteId: o.clienteId || '', estado: o.estado || '', folio: o.folio || '', estadoPago: o.estadoPago || '',
      linea: i + 1, productoId: l.productoId || '', producto: l.producto || l.nombre || '', cantidad: l.cantidad ?? '', precio: l.precio ?? '', 'neto línea': l.neto ?? '', 'neto orden': o.neto ?? '', 'total orden': o.total ?? '' }));
  });
  return hojaDe('B2B órdenes del mes', filas, ['N° orden', 'fecha', 'cliente', 'clienteId', 'estado', 'folio', 'estadoPago', 'linea', 'productoId', 'producto', 'cantidad', 'precio', 'neto línea', 'neto orden', 'total orden']);
}
export const clientesB2b = cs => hojaDe('Clientes B2B', [...(cs || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')), ['id', 'nombre', 'rut', 'estado', 'facturacion', 'frecuenciaPago', 'precios']);
export const productosB2b = ps => hojaDe('Productos B2B', [...(ps || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')), ['id', 'nombre', 'precioBase', 'area', 'idReceta', 'estado', 'categoria']);
export const productosCaja = ps => hojaDe('Productos caja', [...(ps || [])].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')), ['id', 'nombre', 'area', 'categoria', 'precio', 'activo', 'idRecetaFen']);
// Ventas de la caja: de cada resumen de cierre (resumenes_caja.porProducto), una fila por producto
export function cajaMes(resumenes, mes) {
  const filas = [];
  [...(resumenes || [])].filter(r => enMes(r.fecha, mes)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.sucursal).localeCompare(String(b.sucursal))).forEach(r =>
    Object.entries(r.porProducto || {}).sort((a, b) => String(a[1].nombre || '').localeCompare(String(b[1].nombre || ''), 'es')).forEach(([pid, p]) =>
      filas.push({ fecha: r.fecha, sucursal: r.sucursal || '', cierre: r.cajaId || r.id || '', productoId: pid, producto: p.nombre || '', area: p.area || '', cantidad: n(p.cantidad), bruto: n(p.bruto), neto: n(p.neto) })));
  return hojaDe('Ventas caja del mes', filas, ['fecha', 'sucursal', 'cierre', 'productoId', 'producto', 'area', 'cantidad', 'bruto', 'neto']);
}
// Recetas con su costo (costos_recetas: el último cálculo de Finanzas)
const cant = i => `${i.unidades !== null && i.unidades !== undefined && i.unidades !== '' ? `${i.unidades} un · ` : ''}${Math.round(n(i.gramos) * 10) / 10} g`;
export function recetas(rs, costos = {}) {
  const docs = [...(rs || [])].sort((a, b) => String(a.area).localeCompare(String(b.area)) || String(a.nombre).localeCompare(String(b.nombre), 'es')).map(r => {
    const c = costos[r.id] || {};
    return { id: r.id, area: r.area || '', nombre: r.nombre || '', tipo: r.tipo || '', estado: r.estado || '', version: r.version ?? '', porciones: r.porciones ?? '', unidad: r.unidad || '', mpId: r.mpId || '',
      ingredientes: (r.ingredientes || []).map(i => `${i.nombre || i.id} (${i.id}) ${cant(i)}`).join('; '), insumos: (r.insumos || []).map(i => `${i.nombre || i.id} (${i.id}) ${i.cantidad ?? i.unidades ?? ''}`).join('; '),
      'costo neto por unidad': c.costoUnit ?? '', 'costo del lote': c.costoTotal ?? '', 'costo por': c.unidad === 'g' ? 'g' : c.costoUnit !== undefined ? 'un' : '', 'costo calculado': c.fecha || '', incompleto: (c.incompleto || []).join('; '),
      aprobadaPor: r.aprobadaPor || '', aprobadaEn: r.aprobadaEn || '', pasos: (r.pasos || []).join(' | ') };
  });
  return hojaDe('Recetas', docs, ['id', 'area', 'nombre', 'tipo', 'estado', 'version', 'porciones', 'unidad', 'mpId', 'ingredientes', 'insumos', 'costo neto por unidad', 'costo del lote', 'costo por', 'costo calculado', 'incompleto', 'aprobadaPor', 'aprobadaEn', 'pasos']);
}
// Materias primas (fen-produccion mps) con su precio (fen-gastos costos_mp)
const contTxt = c => (c && n(c.cantidad) > 0 ? `${c.cantidad} ${c.unidad}` : '');
export function materiasPrimas(mps, costos = {}) {
  const ids = [...new Set([...(mps || []).map(m => m.id), ...Object.keys(costos || {})])];
  const porId = {}; (mps || []).forEach(m => { porId[m.id] = m; });
  const docs = ids.map(id => { const m = porId[id] || {}, c = (costos || {})[id] || {};
    return { id, nombre: m.nombre || c.nombre || '', tipo: m.tipo || c.tipo || '', categoria: m.categoria || '', estado: m.estado || c.estado || '', areas: m.areas || [], recetaOrigen: m.recetaOrigen || '',
      'unidad de compra': c.unidadCompra || m.unidad || '', contenido: contTxt(c.contenido), 'precio neto': c.precioNeto ?? '', 'precio neto por g, ml o un': c.precioPorBase ?? '', 'origen del precio': c.origen || '', 'fecha del precio': c.fecha || '',
      'en la base de Cocina': porId[id] ? 'sí' : 'no' }; }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  return hojaDe('Materias primas', docs, ['id', 'nombre', 'tipo', 'categoria', 'estado', 'areas', 'recetaOrigen', 'unidad de compra', 'contenido', 'precio neto', 'precio neto por g, ml o un', 'origen del precio', 'fecha del precio', 'en la base de Cocina']);
}
export const reventa = xs => hojaDe('Reventa', [...(xs || [])].map(x => ({ ...x, 'proveedor razón': (x.proveedor && x.proveedor.razon) || '', 'proveedor RUT': (x.proveedor && x.proveedor.rut) || '', proveedor: undefined }))
  .sort((a, b) => String(a.id).localeCompare(String(b.id))), ['id', 'nombre', 'costoNeto', 'unidad', 'proveedor razón', 'proveedor RUT', 'estado', 'origen', 'creadoEn', 'creadoPor'], { fuera: ['proveedor'] });
export const vinculos = vs => hojaDe('Catálogo vínculos', Object.entries(vs || {}).map(([clave, v]) => ({ clave, ...v })).sort((a, b) => String(a.clave).localeCompare(String(b.clave))),
  ['clave', 'canal', 'productoId', 'nombre', 'tipo', 'receta', 'recetaNombre', 'reventaId', 'reventaNombre', 'area', 'costoReventaNeto', 'unidadesPorVenta', 'costoExtraNeto', 'fecha', 'por'], { fuera: ['updatedAt'] });

export function resumen(titulo, hojas, { generado, por }) {
  return { nombre: 'Resumen', columnas: ['Qué', 'Valor'], filas: [['Respaldo', titulo], ['Generado', generado], ['Por', por || ''], ['', ''], ...hojas.map(h => [h.nombre, h.filas.length])] };
}
// Todo el libro del mes. d: { gastos, vencimientos, sii, cartola, ordenes, clientes, productosB2b, resumenes, recetas, costosRecetas, mps, costosMp, reventa, vinculos }
export function libroMes(mes, d, meta) {
  const hojas = [gastosMes(d.gastos, mes), vencimientos(d.vencimientos), siiMes(d.sii, mes), cartolaMes(d.cartola, mes), b2bMes(d.ordenes, mes), clientesB2b(d.clientes), productosB2b(d.productosB2b),
    cajaMes(d.resumenes, mes), recetas(d.recetas, d.costosRecetas), materiasPrimas(d.mps, d.costosMp), reventa(d.reventa), vinculos(d.vinculos)];
  return [resumen(`Mes de ${nombreMes(mes)}`, hojas, meta), ...hojas];
}
export function libroCatalogos(d, meta) {
  const hojas = [recetas(d.recetas, d.costosRecetas), materiasPrimas(d.mps, d.costosMp), reventa(d.reventa), vinculos(d.vinculos), productosCaja(d.productosCaja), clientesB2b(d.clientes), productosB2b(d.productosB2b)];
  return [resumen('Catálogos completos (solo maestros)', hojas, meta), ...hojas];
}
// Agenda: el día 1 de cada mes, "Bajar respaldo de <mes anterior>" (hecho si ya se bajó). hechos: { 'AAAA-MM': {...} }
export function itemsAgenda(desde, hasta, hechos = {}) {
  const out = [];
  let [y, m] = String(desde).slice(0, 7).split('-').map(Number);
  for (let k = 0; k < 24; k++) {
    const f = `${y}-${String(m).padStart(2, '0')}-01`;
    if (f > hasta) break;
    if (f >= desde) { const ant = mesAnterior(f); out.push({ auto: true, cat: 'respaldo', tipo: 'fen', fecha: f, hora: '', titulo: `Bajar respaldo de ${nombreMes(ant).split(' ')[0]}`, sub: 'Configuración → Respaldo', url: '#ajustes/respaldo', origen: 'Respaldo', mes: ant, hecho: !!(hechos && hechos[ant]) }); }
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
