// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo, la Bandeja que une  v0.91.0 · Etapa 2 (reglas puras, sin red)
//  Un PAGO une un documento con un movimiento (o con efectivo / plata del dueño). Es lo único que se crea al confirmar.
//  El estado de un documento (sin pago, a medias, pagado) y lo libre de un movimiento se CALCULAN de sus pagos: nunca se guardan.
//  · Una sola ventana de fechas (G5): el pago va de 20 días antes a 60 días después del documento. Fuera de eso se une igual, a mano.
//  · Pares sugeridos: mismo monto en la ventana; gana el que tiene el RUT o el nombre del proveedor en la glosa y la fecha más cercana.
//    También varios documentos del mismo proveedor (facturas y notas de crédito) que suman justo un movimiento.
//  · Una sola puerta "¿Cómo se pagó?" (G6), un solo "Esto no va" con tres motivos (G7), y lo que no es gasto en el movimiento.
//  · Clasificación: ítem y reparto por área. El proveedor la recuerda (gn_proveedores); el Gastos anterior solo sugiere.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v).trim();
const entero = v => { const x = Math.round(Number(v)); return isFinite(x) ? x : 0; };
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const rutN = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

export const VENTANA = { antes: 20, despues: 60 };
// Diferencia que se acepta entre un documento y su pago (redondeos del IVA): hasta $5. El documento queda pagado y el movimiento usado.
export const TOLERANCIA = 5;
export const enVentana = (docFecha, movFecha) => { const d = dias(docFecha, movFecha); return d >= -VENTANA.antes && d <= VENTANA.despues; };
export const MOTIVOS_NO_VA = { repetido: 'Repetido', no_empresa: 'No es de la empresa', no_compra: 'No es una compra' };
export const NO_GASTO = { traspaso: 'Traspaso entre cuentas propias', retiro: 'Retiro del dueño', tarjeta: 'Pago de la tarjeta de crédito', otro: 'Otro (no es gasto)' };
export const MEDIOS = { cargo: 'Con un cargo', efectivo: 'En efectivo', personal: 'Con plata del dueño' };

// ── Estados (de los pagos vigentes) ──
const vivos = p => (p || []).filter(x => x.estado !== 'deshecho');
export function indicePagos(pagos) {
  const porDoc = {}, porMov = {};
  vivos(pagos).forEach(p => { (porDoc[p.docId] = porDoc[p.docId] || []).push(p); if (p.movId) (porMov[p.movId] = porMov[p.movId] || []).push(p); });
  return { porDoc, porMov };
}
export function estadoDoc(d, I) {
  if (d.estado === 'no_va') return { estado: 'no_va', pagado: 0, saldo: 0, pagos: [] };
  const ps = (I.porDoc[d.id] || []), pagado = ps.reduce((a, p) => a + entero(p.monto), 0), total = entero(d.total), saldo = total - pagado;
  const listo = total >= 0 ? saldo <= TOLERANCIA : saldo >= -TOLERANCIA;   // una nota de crédito (negativa) queda "pagada" al descontarse
  return { estado: listo ? 'pagado' : pagado ? 'a_medias' : 'sin_pago', pagado, saldo: listo ? 0 : saldo, pagos: ps };
}
export function libreMov(m, I) {
  if (m.estado === 'no_va' || m.naturaleza) return 0;
  return entero(m.monto) - (I.porMov[m.id] || []).reduce((a, p) => a + entero(p.monto), 0);
}

// ── Clasificación efectiva: la del documento, si no la del proveedor ──
// v0.91.2 · Un pago solo se crea con cada documento clasificado (la regla vive también en gn-fs.pagar).
export const faltaClasificar = (docs, provs, reps) => (docs || []).filter(d => !clasifDe(d, provs, reps));
// v0.92.3 · Con N° de cliente (CdgIntRecep), la memoria es por proveedor Y cliente: los servicios de un mismo proveedor (el internet de
// Ainavillo y el de Barros Arana) se clasifican cada uno con lo suyo. Lo guardado antes por proveedor sigue sirviendo de respaldo.
export const claveBase = d => (rutN(d.rutN || d.rut) ? 'r_' + rutN(d.rutN || d.rut) : 'n_' + norm(d.razon).replace(/ /g, '_').slice(0, 60));
export const claveProveedor = d => claveBase(d) + (s(d.cliente) ? '_c_' + s(d.cliente).replace(/[^0-9A-Za-z]/g, '').slice(0, 30) : '');
export const provDe = (d, provs) => (provs && (provs[claveProveedor(d)] || provs[claveBase(d)])) || null;
// v0.92.0 · La clasificación es POR PARTES: [{ item, area, monto }] en neto (neto + exento; una boleta o un pago sin documento, su total).
// La suma de las partes es la base del documento. El caso simple (un ítem, una o varias áreas en %) es una clasificación más.
// Lo antiguo ({ item, areas: [{ area, pct }] }) se lee igual. El proveedor recuerda su clasificación general y la de cada producto.
export const baseDe = d => { const b = entero(d.neto) + entero(d.exento); return b || entero(d.total); };
// v0.92.1 · Con sus números: el tamaño o el formato distinguen un producto de otro ("CAJA MONACO 12" no es "CAJA MONACO 15")
export const normProducto = t => norm(t).slice(0, 80);
// Reparte un monto en partes enteras según pesos, sin perder pesos (lo que sobra del redondeo va a la parte más grande)
export function repartirMonto(total, pesos) {
  const t = pesos.reduce((a, b) => a + b, 0); if (!t) return pesos.map(() => 0);
  const out = pesos.map(w => Math.round(total * w / t)), dif = total - out.reduce((a, b) => a + b, 0);
  if (dif) { let k = 0; out.forEach((v, i) => { if (Math.abs(pesos[i]) > Math.abs(pesos[k])) k = i; }); out[k] += dif; }
  return out;
}
const juntar = partes => { const m = {}; partes.forEach(p => { const k = p.item + '|' + p.area; m[k] = m[k] ? { ...m[k], monto: m[k].monto + p.monto } : { ...p }; }); return Object.values(m).filter(p => p.monto !== 0); };
// Un ítem con su reparto por área (%) → partes
export function partesSimple(base, item, areas) {
  const l = (areas || []).filter(a => s(a.area)); if (!s(item) || !l.length) return [];
  const m = repartirMonto(base, l.map(a => Number(a.pct) || 0));
  return juntar(l.map((a, i) => ({ item: s(item), area: s(a.area), monto: m[i] })));
}
// Por líneas del detalle: asign[i] = { item, area } de cada línea → partes, ajustadas a la base (descuentos globales, redondeos)
// v0.96.0 · Una línea puede ir a un reparto con nombre (area 'rp:<id>', con las áreas de hoy del reparto) o a varias áreas (asign[i].areas,
// lo general de la factura). Si el reparto ya no está, la línea queda sin área (y se pide).
export const AREA_REPARTO = 'rp:';
export function partesPorLineas(d, asign, reps) {
  const det = d.detalle || [], w = det.map(x => entero(x.monto)), m = repartirMonto(baseDe(d), w);
  return juntar(det.flatMap((x, i) => {
    const a = asign[i] || {}, item = s(a.item), ar = s(a.area);
    if (ar.startsWith(AREA_REPARTO)) { const r = (reps || {})[ar.slice(AREA_REPARTO.length)]; return r ? partesSimple(m[i], item, r.areas) : [{ item, area: '', monto: m[i] }]; }
    if (!ar && Array.isArray(a.areas) && a.areas.length) return partesSimple(m[i], item, a.areas);
    return [{ item, area: ar, monto: m[i] }];
  }));
}
export function partesValidas(partes, base) {
  if (!(partes || []).length) return 'Falta la clasificación.';
  if (partes.some(p => !s(p.item))) return 'Cada parte necesita su ítem.';
  if (partes.some(p => !s(p.area))) return 'Cada parte necesita su área.';
  const t = partes.reduce((a, p) => a + entero(p.monto), 0);
  return Math.abs(t - base) > 2 ? `Las partes suman ${t.toLocaleString('es-CL')} y la base del documento es ${base.toLocaleString('es-CL')}.` : '';
}
// Las partes de una clasificación guardada (nueva o antigua)
export function partesDe(d, c) {
  if (!c) return [];
  if (Array.isArray(c.partes) && c.partes.length) return c.partes;
  return partesSimple(baseDe(d), c.item, c.areas || []);
}
// Lo que dice la ficha del proveedor para un documento: su clasificación general y, por línea, la del producto si la recuerda
// v0.92.1 · Lo que el proveedor recuerda: modo "fijo" (ítem y áreas, siempre igual: la factura llega clasificada) o "item" (solo el
// ítem; las áreas cambian en cada compra: la factura llega con el ítem y pide el área). Sin modo (lo anterior) = fijo.
// Un producto recuerda su ítem, y su área solo si es siempre la misma.
export const modoProveedor = p => (p && p.modo === 'item' ? 'item' : 'fijo');
// v0.96.0 · Las áreas de una ficha: las de su reparto con nombre (si usa uno, las de HOY: un cambio del reparto rige para lo que viene) o las suyas
export const areasDe = (p, reps) => (p && p.repartoId && reps && reps[p.repartoId] && (reps[p.repartoId].areas || []).length ? reps[p.repartoId].areas : (p && p.areas) || []);
function desdeProveedor(d, p, reps) {
  const prods = p.productos || {}, det = d.detalle || [], usa = det.length > 1 && det.some(x => prods[normProducto(x.descripcion)]), ar = areasDe(p, reps);
  if (!usa) return partesSimple(baseDe(d), p.item, ar);
  // v0.96.0 · Lo que el producto no dice va con el reparto (o las áreas) del proveedor, no solo con su primera área
  return partesPorLineas(d, det.map(x => { const r = prods[normProducto(x.descripcion)]; return r && r.area ? { item: r.item || p.item, area: r.area } : { item: (r && r.item) || p.item, areas: ar }; }), reps);
}
// Los productos que se recuerdan de una factura separada por líneas: ítem siempre; área solo si el proveedor es "fijo" y ese producto
// fue a una sola área en la factura (el mismo producto en dos áreas no recuerda área)
export function productosARecordar(lineas, modo) {
  const por = {};
  (lineas || []).forEach(l => { const k = normProducto(l.descripcion); if (!k || !l.item) return; const x = por[k] || (por[k] = { item: l.item, areas: new Set() }); if (l.area) x.areas.add(l.area); });
  const out = {}; Object.entries(por).forEach(([k, x]) => { out[k] = modo === 'fijo' && x.areas.size === 1 ? { item: x.item, area: [...x.areas][0] } : { item: x.item }; });
  return out;
}
export function clasifDe(d, provs, reps) {
  if (d.clasif && (d.clasif.item || (d.clasif.partes || []).length)) { const partes = partesDe(d, d.clasif); return { ...d.clasif, partes, item: principal(partes), de: d.clasif.de === 'proveedor' ? 'proveedor' : 'documento' }; }
  if (d.origen === 'previred') return clasifPrevired(d, provs, reps);
  const p = provDe(d, provs);
  if (!p || !p.item || modoProveedor(p) === 'item') return null;
  // v0.96.0 · Si alguna parte queda sin área (un producto nuevo de un proveedor que recuerda por producto), se pide clasificar
  const ITEM_REC = 'MULTAS E INTERESES', aj = Number(d.ajuste && d.ajuste.recargo) || 0;   // v0.98.0: un compromiso ajustado al monto pagado
  const partes = aj > 0 ? partesSimple(baseDe(d) - aj, p.item, areasDe(p, reps)).concat([{ item: ITEM_REC, area: 'ADMIN', monto: aj }]) : desdeProveedor(d, p, reps);
  return partes.length && partes.every(x => x.item && x.area) ? { item: p.item, areas: areasDe(p, reps), repartoId: p.repartoId || '', partes, de: 'proveedor', vivo: true } : null;
}
// Previred: cada trabajador con el área (o reparto) de su ficha (la de su liquidación); las multas e intereses a ADMIN (financiero).
// El ítem: el de la ficha de PREVIRED, si se fijó; si no, COTIZACIONES PREVISIONALES. Si a alguien le falta su ficha, se pide clasificar.
export const ITEM_COTIZACIONES = 'COTIZACIONES PREVISIONALES', ITEM_RECARGOS_PREVIRED = 'MULTAS E INTERESES PREVIRED';
export function faltanFichasPrevired(d, provs, reps) {
  return ((d.previred && d.previred.trabajadores) || []).filter(t => { const p = (provs || {})['r_' + t.rutN]; return !p || modoProveedor(p) === 'item' || !areasDe(p, reps).length; }).map(t => t.nombre || t.rut);
}
function clasifPrevired(d, provs, reps) {
  const P = d.previred; if (!P || faltanFichasPrevired(d, provs, reps).length) return null;
  const pp = (provs || {})[claveBase(d)], item = (pp && pp.item) || ITEM_COTIZACIONES;
  const partes = juntar(P.trabajadores.flatMap(t => partesSimple(t.total, item, areasDe(provs['r_' + t.rutN], reps))).concat(P.recargos ? [{ item: ITEM_RECARGOS_PREVIRED, area: 'ADMIN', monto: P.recargos }] : []));
  const dif = d.total - partes.reduce((a, x) => a + x.monto, 0);
  if (dif && partes.length) partes[0] = { ...partes[0], monto: partes[0].monto + dif };   // redondeos o un total del comprobante distinto de la suma
  return { item, areas: [], repartoId: '', partes, de: 'proveedor', vivo: true };
}
// v0.93.0 · Repartos con nombre: los iniciales (acordados el 23 oct; se crean la primera vez, después se editan en Gastos → Repartos)
export const REPARTOS_INICIALES = [
  { id: 'rp_produccion_ainavillo', nombre: 'Producción Ainavillo', areas: [{ area: 'PAN', pct: 57 }, { area: 'BOL', pct: 43 }] },
  { id: 'rp_ainavillo_comun', nombre: 'Ainavillo común', areas: ['PAN', 'BOL', 'PAS', 'ADMIN', 'B2C-AI'].map(a => ({ area: a, pct: 20 })) },
  { id: 'rp_barros_comun', nombre: 'Barros Arana común', areas: [{ area: 'B2C-BA', pct: 50 }, { area: 'CAF', pct: 50 }] },
  { id: 'rp_tienda_barros', nombre: 'Tienda Barros Arana', areas: [{ area: 'B2C-BA', pct: 100 }] }];
// Áreas que el Gastos nuevo ya no usa (VENTAS, B2C sin local): se piden pasar a su local
export const AREAS_ANTIGUAS = ['VENTAS', 'B2C'];
export const tieneAreaAntigua = c => !!(c && (c.partes || []).some(p => AREAS_ANTIGUAS.includes(p.area)));
// Cuántas fichas usan cada reparto
export const usoRepartos = provs => { const u = {}; Object.values(provs || {}).forEach(p => { if (p && p.repartoId) u[p.repartoId] = (u[p.repartoId] || 0) + 1; }); return u; };
export const principal = partes => (partes.slice().sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto))[0] || {}).item || '';
// "MATERIA PRIMA · PAN" · "MATERIA PRIMA · PAN 60% · BOL 40%" · "MATERIA PRIMA · PAN $40.000 + INSUMOS VARIOS · VENTAS $9.990"
export function textoPartes(partes) {
  const l = partes || []; if (!l.length) return '';
  const items = [...new Set(l.map(p => p.item))], t = l.reduce((a, p) => a + p.monto, 0) || 1;
  if (items.length === 1) return items[0] + ' · ' + (l.length === 1 ? l[0].area : l.map(p => `${p.area} ${Math.round(p.monto / t * 100)}%`).join(' · '));
  return l.map(p => `${p.item} · ${p.area} $${Math.abs(p.monto).toLocaleString('es-CL')}`).join(' + ');
}
// Reparto válido: áreas distintas, porcentajes enteros que suman 100
export function repartoValido(areas) {
  const l = (areas || []).filter(a => s(a.area));
  if (!l.length) return 'Elija al menos un área.';
  if (new Set(l.map(a => a.area)).size !== l.length) return 'Hay un área repetida.';
  const t = l.reduce((x, a) => x + Number(a.pct || 0), 0);
  if (l.some(a => !(Number(a.pct) > 0))) return 'Cada área necesita su porcentaje.';
  return Math.abs(t - 100) > 0.5 ? `Los porcentajes suman ${t}%: deben sumar 100%.` : '';
}
// v0.96.0 · Con dos decimales (seis partes: 16,67 · … · 16,65)
export const repartoIgual = areas => { const n = areas.length, b = Math.floor(10000 / n) / 100; return areas.map((a, i) => ({ area: a, pct: i < n - 1 ? b : Math.round((100 - b * (n - 1)) * 100) / 100 })); };
export const textoReparto = areas => (areas || []).map(a => (areas.length > 1 ? `${a.area} ${a.pct}%` : a.area)).join(' · ');

// ── Sugerencias del Gastos anterior (solo sugieren): por RUT, el ítem más usado y el reparto de su última factura ──
// gastos: filas del Gastos anterior { rutProveedor, itemGasto, area, montoFinal, fecha, estado, folio/observacion }
export function sugerenciasDeAnterior(gastos) {
  const por = {};
  (gastos || []).forEach(g => {
    const r = rutN(g.rutProveedor); if (!r || !s(g.itemGasto) || g.estado === 'anulado' || g.estado === 'ANULADO') return;
    const monto = Math.abs(Number(g.montoFinal) || 0); if (!monto) return;
    const x = por[r] || (por[r] = { items: {}, ultima: '', folios: {} });
    x.items[g.itemGasto] = (x.items[g.itemGasto] || 0) + monto;
    const folio = s(g.folio) || s((/(?:F|NC)\.?\s*(\d+)/.exec(s(g.observacion)) || [])[1]) || s(g.fecha);
    const f = x.folios[folio] || (x.folios[folio] = { fecha: s(g.fecha), areas: {} });
    if (s(g.area) && !['SELECCIONAR', 'PRORRATEADO'].includes(s(g.area))) f.areas[g.area] = (f.areas[g.area] || 0) + monto;
    if (s(g.fecha) > f.fecha) f.fecha = s(g.fecha);
  });
  const out = {};
  Object.entries(por).forEach(([r, x]) => {
    const item = Object.entries(x.items).sort((a, b) => b[1] - a[1])[0][0];
    const ult = Object.values(x.folios).filter(f => Object.keys(f.areas).length).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    let areas = [];
    if (ult) {
      const tot = Object.values(ult.areas).reduce((a, b) => a + b, 0), l = Object.entries(ult.areas).sort((a, b) => b[1] - a[1]);
      areas = l.map(([area, m]) => ({ area, pct: Math.round(m / tot * 100) }));
      const dif = 100 - areas.reduce((a, b) => a + b.pct, 0); if (areas.length) areas[0].pct += dif;
    }
    out['r_' + r] = { item, areas };
  });
  return out;
}

// ── Pares sugeridos ──
const PALABRAS_VACIAS = new Set(['SPA', 'LTDA', 'LIMITADA', 'EIRL', 'SA', 'S', 'A', 'Y', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'COMERCIAL', 'SOCIEDAD', 'EMPRESA', 'EMPRESAS', 'SERVICIOS', 'CIA', 'COMPANIA', 'INVERSIONES', 'DISTRIBUIDORA', 'CHILE']);
const palabras = t => norm(t).split(' ').filter(w => w.length >= 4 && !PALABRAS_VACIAS.has(w) && !/^\d+$/.test(w));
// Qué tan "de este proveedor" es la glosa: RUT (cuerpo) 50; una palabra del nombre 30
// v0.91.1 · Glosa aprendida (40): la seña de la glosa ya se confirmó con este proveedor y con ningún otro (S = indiceSenas)
export function afinidad(d, m, S) {
  const g = norm(m.glosa), gd = g.replace(/ /g, ''), r = rutN(d.rutN || d.rut);
  if (r.length > 2 && (gd.includes(r) || gd.includes(r.slice(0, -1)))) return 50;
  if (S) { const sn = senaDe(m.glosa), duenos = sn && S[sn]; if (duenos && duenos.length === 1 && (duenos[0] === claveProveedor(d) || duenos[0] === claveBase(d))) return 40; }
  return palabras(d.razon).some(w => g.split(' ').includes(w)) ? 30 : 0;
}
// ── v0.91.1 · Cómo aparece cada proveedor en el banco ──
// La seña de una glosa: sus palabras propias (sin números, sin palabras del banco ni comunes), hasta 3. Sin seña propia, no se aprende.
const COMUNES_BANCO = new Set(['COMPRA', 'COMPRAS', 'TEF', 'A', 'AL', 'DE', 'DEL', 'EN', 'POR', 'CON', 'PARA', 'Y', 'LA', 'EL', 'LOS', 'LAS', 'PAGO', 'PAGOS', 'CL', 'CHL', 'CHILE', 'SALDO', 'MERCADO', 'LIBRE', 'OP', 'TRANSFERENCIA', 'TRANSF', 'TRASPASO',
  'CARGO', 'CARGOS', 'DEBITO', 'CREDITO', 'REDCOMPRA', 'WEBPAY', 'LINEA', 'INTERNET', 'PAC', 'AUTOMATICO', 'CUENTA', 'CTA', 'CTE', 'CORRIENTE', 'CHEQUERA', 'ELECTRONICA', 'BANCO', 'ESTADO', 'BCO', 'RUT', 'NRO', 'NUM', 'NUMERO', 'SPA', 'LTDA', 'EIRL', 'SA',
  'SANTIAGO', 'CONCEPCION', 'GIRO', 'CAJERO', 'RETIRO', 'ABONO', 'COMISION', 'IVA', 'OTROS', 'VARIOS', 'PERSONA', 'TERCEROS', 'TERCERO', 'POS', 'CUOTA', 'CUOTAS']);
export function senaDe(glosa) {
  const l = norm(glosa).split(' ').filter(w => w.length >= 3 && !/\d/.test(w) && !COMUNES_BANCO.has(w)).slice(0, 3);
  const t = l.join(' ');
  return t.replace(/ /g, '').length >= 4 ? t : '';
}
// seña → proveedores que la tienen (de gn_proveedores.glosas)
export function indiceSenas(provs) {
  const S = {};
  Object.entries(provs || {}).forEach(([k, p]) => (p.glosas || []).forEach(g => { if (g && g.sena) { const l = S[g.sena] || (S[g.sena] = []); if (!l.includes(k)) l.push(k); } }));
  return S;
}
const subconjuntos = (l, max) => { const out = []; const ir = (i, act) => { if (act.length >= 2) out.push(act.slice()); if (act.length === max) return; for (let j = i; j < l.length; j++) { act.push(l[j]); ir(j + 1, act); act.pop(); } }; ir(0, []); return out; };
// docs: documentos con saldo (abiertos), movs: movimientos con lo libre. → [{ docIds, movId, monto, afinidad, por }]
// v0.96.0 · Un cargo anterior al inicio solo se une con documentos del inicio en adelante (lo de antes con lo de antes es del Gastos anterior).
// "No es este" queda guardado en el documento (descartes): ese par no se vuelve a proponer.
export const compatible = (d, m) => !(d.anterior && m.anterior);
export const descartado = (d, m) => (d.descartes || []).includes(m.id);
export function sugerirPares(docs, movs, S) {
  const cand = [];
  docs.forEach(d => movs.forEach(m => {
    const dif = m.libre - d.saldo;
    if (!compatible(d, m) || descartado(d, m) || d.saldo <= 0 || m.libre <= 0 || Math.abs(dif) > TOLERANCIA || !enVentana(d.fecha, m.fecha)) return;
    const a = afinidad(d, m, S), dd = Math.abs(dias(d.fecha, m.fecha));
    cand.push({ docIds: [d.id], movId: m.id, monto: m.libre, dif, afinidad: a, distancia: dd + Math.abs(dif) * 3, por: a >= 50 ? 'rut' : a >= 40 ? 'glosa' : a ? 'nombre' : 'monto' });
  }));
  cand.sort((a, b) => b.afinidad - a.afinidad || a.distancia - b.distancia);
  const usadoD = new Set(), usadoM = new Set(), out = [];
  const tomar = c => { if (c.docIds.some(i => usadoD.has(i)) || usadoM.has(c.movId)) return; c.docIds.forEach(i => usadoD.add(i)); usadoM.add(c.movId); out.push(c); };
  // 1) los del mismo monto con el proveedor en la glosa; 2) varios documentos del mismo proveedor; 3) los del mismo monto sin más señas
  cand.filter(c => c.afinidad > 0).forEach(tomar);
  // Varios documentos del mismo proveedor que suman justo un movimiento (facturas y sus notas de crédito)
  const porRut = {};
  docs.filter(d => !usadoD.has(d.id) && rutN(d.rutN || d.rut)).forEach(d => { (porRut[rutN(d.rutN || d.rut)] = porRut[rutN(d.rutN || d.rut)] || []).push(d); });
  movs.filter(m => !usadoM.has(m.id) && m.libre > 0).forEach(m => {
    let mejor = null;
    Object.values(porRut).forEach(l => {
      const ok = l.filter(d => !usadoD.has(d.id) && enVentana(d.fecha, m.fecha) && compatible(d, m) && !descartado(d, m)).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 8);
      if (ok.length < 2) return;
      const a = afinidad(ok[0], m, S);
      subconjuntos(ok, 4).forEach(sc => {
        if (sc.reduce((x, d) => x + d.saldo, 0) !== m.libre || !sc.some(d => d.saldo > 0)) return;
        const c = { docIds: sc.map(d => d.id), movId: m.id, monto: m.libre, afinidad: a, distancia: Math.max(...sc.map(d => Math.abs(dias(d.fecha, m.fecha)))), por: 'varios' };
        if (!mejor || c.afinidad > mejor.afinidad || (c.afinidad === mejor.afinidad && c.docIds.length < mejor.docIds.length)) mejor = c;
      });
    });
    if (mejor && mejor.afinidad > 0) tomar(mejor);
  });
  cand.filter(c => c.afinidad === 0).forEach(tomar);
  return out;
}
// Para "Es de este documento" (desde un movimiento): los abiertos, primero los del mismo monto y del proveedor de la glosa
export function candidatosDoc(m, docs, S) {
  return docs.filter(d => d.saldo > 0 && compatible(d, m)).map(d => ({ d, a: afinidad(d, m, S), igual: d.saldo === m.libre, dentro: enVentana(d.fecha, m.fecha) }))
    .sort((x, y) => (y.igual - x.igual) || (y.a - x.a) || (y.dentro - x.dentro) || Math.abs(dias(x.d.fecha, m.fecha)) - Math.abs(dias(y.d.fecha, m.fecha)));
}
// Para "¿Cómo se pagó? → Con un cargo" (desde un documento): los movimientos con algo libre, primero los del mismo monto en la ventana
export function candidatosMov(d, movs, S) {
  return movs.filter(m => m.libre > 0 && compatible(d, m)).map(m => ({ m, a: afinidad(d, m, S), igual: m.libre === d.saldo, dentro: enVentana(d.fecha, m.fecha) }))
    .sort((x, y) => (y.igual - x.igual) || (y.dentro - x.dentro) || (y.a - x.a) || Math.abs(dias(d.fecha, x.m.fecha)) - Math.abs(dias(d.fecha, y.m.fecha)));
}
// ── v0.96.0 · Seleccionar y filtrar: lo elegido de un lado muestra los posibles del otro, para la suma ──
// Elegir documentos → los cargos posibles para la suma de sus saldos; elegir cargos → los documentos posibles para la suma de lo libre.
// Orden: los no descartados, los que calzan (±$5), los de la ventana de fechas, los del proveedor (afinidad), los más cercanos.
export function posiblesMovs(docs, movs, S) {
  const T = docs.reduce((a, d) => a + d.saldo, 0), f0 = docs.map(d => d.fecha).sort()[0] || '';
  return movs.filter(m => m.libre > 0 && docs.every(d => compatible(d, m))).map(m => ({ m, calza: Math.abs(m.libre - T) <= TOLERANCIA, dentro: docs.some(d => enVentana(d.fecha, m.fecha)),
    a: Math.max(0, ...docs.map(d => afinidad(d, m, S))), desc: docs.some(d => descartado(d, m)), dist: Math.abs(dias(f0, m.fecha)) }))
    .sort((x, y) => (x.desc - y.desc) || (y.calza - x.calza) || (y.dentro - x.dentro) || (y.a - x.a) || (x.dist - y.dist));
}
export function posiblesDocs(movs, docs, S) {
  const T = movs.reduce((a, m) => a + m.libre, 0), f0 = movs.map(m => m.fecha).sort()[0] || '';
  return docs.filter(d => d.saldo > 0 && movs.every(m => compatible(d, m))).map(d => ({ d, calza: Math.abs(d.saldo - T) <= TOLERANCIA, dentro: movs.some(m => enVentana(d.fecha, m.fecha)),
    a: Math.max(0, ...movs.map(m => afinidad(d, m, S))), desc: movs.some(m => descartado(d, m)), dist: Math.abs(dias(d.fecha, f0)) }))
    .sort((x, y) => (x.desc - y.desc) || (y.calza - x.calza) || (y.a - x.a) || (y.dentro - x.dentro) || (x.dist - y.dist));
}
// Cómo queda lo elegido: diferencia entre lo libre de los cargos y lo que falta pagar de los documentos
export function balance(docs, movs) {
  const td = docs.reduce((a, d) => a + d.saldo, 0), tm = movs.reduce((a, m) => a + m.libre, 0), dif = tm - td;
  return { td, tm, dif, calza: Math.abs(dif) <= TOLERANCIA, valido: docs.length > 0 && movs.length > 0 && !(docs.length > 1 && movs.length > 1) && docs.every(d => movs.every(m => compatible(d, m))) };
}
// Un documento con varios cargos: se paga cargo por cargo (por fecha), cada uno con lo que falta (el último puede quedar a medias)
export function pagosDeVarios(d, movs) {
  let resto = d.saldo; const out = [];
  movs.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => { if (resto <= 0) return; const p = repartirPago([{ ...d, saldo: resto }], m.libre)[0]; if (!p) return; out.push({ movId: m.id, partes: [p] }); resto -= p.monto; });
  return out;
}

// ── v0.96.0 · ¿Ya está en el Gastos anterior? (para un cargo anterior al inicio) ──
// Los gastos del anterior se agrupan como un pago (misma fecha, hora, observación, RUT y folio: un pago repartido en varias líneas de área)
export function resumenAnterior(gastos, desde, hasta) {
  const g = {};
  (gastos || []).forEach(x => {
    const f = s(x.fecha).slice(0, 10); if (!f || f < desde || f >= hasta || x.estado === 'anulado' || x.estado === 'ANULADO' || x.quitadoEnPlanilla) return;
    const k = [f, s(x.hora), s(x.observacion), rutN(x.rutProveedor), s(x.folio)].join('|'), y = g[k] || (g[k] = { id: x.id, fecha: f, monto: 0, rut: rutN(x.rutProveedor), razon: s(x.razonSocial), folio: s(x.folio), item: s(x.itemGasto), obs: s(x.observacion).slice(0, 80) });
    y.monto += Math.abs(Number(x.montoFinal) || 0);
  });
  return Object.values(g).map(y => ({ ...y, monto: Math.round(y.monto) })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
// Los del Gastos anterior que pueden ser este mismo cargo: mismo monto (±$5) y fecha (±3 días); "seguro" si además es del RUT del documento.
// Los ya marcados en otro pago no se repiten.
export function enAnterior(m, docs, G, usados) {
  const ruts = new Set(docs.map(d => rutN(d.rutN || d.rut)).filter(Boolean));
  return (G || []).filter(g => !(usados && usados.has(g.id)) && Math.abs(g.monto - m.monto) <= TOLERANCIA && Math.abs(dias(g.fecha, m.fecha)) <= 3)
    .map(g => ({ g, seguro: !!g.rut && ruts.has(g.rut) })).sort((a, b) => b.seguro - a.seguro);
}

// Cómo se reparte un movimiento entre documentos: en orden, a cada uno lo que le falta (lo último puede quedar a medias)
export function repartirPago(docs, monto) {
  let resto = entero(monto); const out = [];
  if (docs.length === 1 && docs[0].saldo > 0 && Math.abs(resto - docs[0].saldo) <= TOLERANCIA) return [{ docId: docs[0].id, monto: resto }];
  docs.filter(d => d.saldo < 0).forEach(d => { out.push({ docId: d.id, monto: d.saldo }); resto -= d.saldo; });   // notas de crédito: se descuentan enteras
  docs.filter(d => d.saldo > 0).forEach(d => { if (resto <= 0) return; const m = Math.min(d.saldo, resto); out.push({ docId: d.id, monto: m }); resto -= m; });
  return out;
}

// ── La Bandeja completa ──
// D: { docs, movs, pagos, provs, sugeridas, inicio }  opts: { cuenta }
export function armar(D, { cuenta = '', excluir = null } = {}) {
  const I = indicePagos(D.pagos), provs = D.provs || {}, sug = D.sugeridas || {}, reps = D.repartos || {};
  const docs = (D.docs || []).map(d => { const e = estadoDoc(d, I), c = clasifDe(d, provs, reps); return { ...d, ...e, estadoPago: e.estado, clasifEf: c, sugerida: !c ? sug[claveProveedor(d)] || sug[claveBase(d)] || null : null,
    soloItem: !c && d.origen !== 'previred' && provDe(d, provs) && provDe(d, provs).item ? provDe(d, provs).item : '', faltanFichas: !c && d.origen === 'previred' ? faltanFichasPrevired(d, provs, reps) : null }; });
  const movs = (D.movs || []).map(m => ({ ...m, libre: libreMov(m, I), pagosM: I.porMov[m.id] || [] }));
  const abiertosD = docs.filter(d => d.estadoPago === 'sin_pago' || d.estadoPago === 'a_medias');
  const abiertosM = movs.filter(m => m.libre > 0 && m.estado !== 'no_va' && !m.naturaleza);
  const S = indiceSenas(provs);
  const pares = sugerirPares(abiertosD, abiertosM, S).filter(p => !excluir || !excluir.has(p.movId + '|' + p.docIds.join(',')));   // "No es este": guardado en el documento (v0.96.0)
  const enPar = new Set(pares.flatMap(p => p.docIds)), movEnPar = new Set(pares.map(p => p.movId));
  const visible = d => !d.anterior;
  // v0.91.2 · "Listo" = pagado Y clasificado. Cada documento está en un solo grupo: en su par, sin pago (con su clasificación a la vista)
  // o, si ya está pagado y le falta el ítem, en "Pagados sin clasificar".
  const tocado = d => visible(d) || d.pagos.length || d.estado === 'no_va';
  const porClasificar = docs.filter(d => tocado(d) && d.estado !== 'no_va' && d.estadoPago === 'pagado' && !d.clasifEf && entero(d.total) !== 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sinPago = abiertosD.filter(d => visible(d) && !enPar.has(d.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sinDoc = abiertosM.filter(m => !m.anterior && !movEnPar.has(m.id) && (!cuenta || m.cuenta === cuenta)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const listosD = docs.filter(d => tocado(d) && ((d.estadoPago === 'pagado' && (d.clasifEf || entero(d.total) === 0)) || d.estado === 'no_va')).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const noGasto = movs.filter(m => m.naturaleza || m.estado === 'no_va').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const porId = Object.fromEntries(docs.map(d => [d.id, d]));
  const paresV = pares.filter(p => !cuenta || (movs.find(m => m.id === p.movId) || {}).cuenta === cuenta).map(p => ({ ...p, faltaClasif: p.docIds.some(i => !porId[i].clasifEf) }));
  return { docs, movs, I, S, pares: paresV, porClasificar, sinPago, sinDoc, listosD, noGasto, abiertosD, abiertosM,
    anteriores: docs.filter(d => d.anterior && d.estadoPago !== 'pagado' && d.estado !== 'no_va'),
    movsAnteriores: abiertosM.filter(m => m.anterior && !movEnPar.has(m.id) && (!cuenta || m.cuenta === cuenta)).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    usadosAnterior: new Set((D.pagos || []).filter(p => p.estado !== 'deshecho' && p.enGastoAnterior).map(p => p.enGastoAnterior.id)),
    conAreaAntigua: docs.filter(d => d.estado !== 'no_va' && tieneAreaAntigua(d.clasifEf)),
    n: { pares: paresV.length, clasificar: porClasificar.length, sinPago: sinPago.length, sinDoc: sinDoc.length, total: paresV.length + porClasificar.length + sinPago.length + sinDoc.length } };
}

// ═══════════════ v0.96.0 · Compromisos (pagos fijos sin documento: arriendos) ═══════════════
// Un compromiso crea el documento de cada mes desde que el mes empieza (no antes): lo que se debe ese mes, con su día de pago.
// Su clasificación vive en la ficha de "a quién se paga" (ítem y reparto): un cambio del reparto rige para lo que viene.
export const idCompromisoDoc = (cid, mes) => `d_cmp_${cid}_${mes.replace('-', '')}`;
const ultimoDiaMes = mes => { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const sigMes = mes => { const [y, m] = mes.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
// v0.98.0 · Frecuencia: cada mes o cada 6 meses (meses de pago: el primero y el que está 6 meses después). El de 6 meses cubre su semestre
// (periodo de 6 meses, prorratear: Finanzas lo reparte un sexto por mes). Rol y dirección para identificar el pago (patentes).
// El día va del 1 al 31 (si el mes es más corto, su último día).
export const semestral = c => c && c.frecuencia === 'semestral';
export const mesesDe = c => { const m = Math.min(Math.max(1, Number(c.mesInicio) || 1), 12); return semestral(c) ? [m, ((m + 5) % 12) + 1] : null; };
const sumarMeses = (mes, n) => { let m = mes; for (let i = 0; i < n; i++) m = sigMes(m); return m; };
export function docDeCompromiso(c, mes) {
  const dia = Math.min(Math.max(1, Number(c.dia) || 1), Number(ultimoDiaMes(mes).slice(8))), fecha = `${mes}-${String(dia).padStart(2, '0')}`, monto = Math.round(Number(c.monto) || 0);
  const sem = semestral(c), hasta = sem ? ultimoDiaMes(sumarMeses(mes, 5)) : ultimoDiaMes(mes);
  return { id: idCompromisoDoc(c.id, mes), origen: 'compromiso', compromiso: c.id, formato: '', tipo: 'cmp', tipoTexto: s(c.nombre) || 'Compromiso', nc: false,
    rut: s(c.rut), rutN: rutN(c.rut), razon: s(c.aQuien) || s(c.nombre), folio: '', fecha, mes, neto: monto, exento: 0, iva: 0, otroImp: 0, total: monto,
    vence: fecha, formaPago: '', referencias: [], detalle: [], descuadre: '', cargaId: '', cliente: '', direccion: s(c.direccion).slice(0, 100), rol: s(c.rol).slice(0, 40),
    periodo: { desde: mes + '-01', hasta }, ...(sem ? { prorratear: 6 } : {}) };
}
// Los documentos que faltan: de cada compromiso activo, sus meses desde max(inicio, su "desde") hasta el mes en curso
export function compromisosPendientes(comps, docs, inicio, hoy) {
  const ya = new Set((docs || []).map(d => d.id)), mesHoy = s(hoy).slice(0, 7), mesIni = s(inicio).slice(0, 7), out = [];
  (comps || []).filter(c => c.estado !== 'archivado' && Number(c.monto) > 0).forEach(c => {
    // v0.98.1 · "Desde" antes del inicio: esos meses entran como deuda anterior (hasta un año antes, como las facturas). Sin "Desde": el inicio.
    const anteriorMin = (Number(mesIni.slice(0, 4)) - 1) + mesIni.slice(4);
    let m = s(c.desde) ? (s(c.desde).slice(0, 7) < anteriorMin ? anteriorMin : s(c.desde).slice(0, 7)) : mesIni, n = 0;
    const meses = mesesDe(c);
    while (m && m <= mesHoy && n++ < 36) { if ((!meses || meses.includes(Number(m.slice(5)))) && !ya.has(idCompromisoDoc(c.id, m))) { const d = docDeCompromiso(c, m); out.push(d.fecha < s(inicio) ? { ...d, anterior: true } : d); } m = sigMes(m); }
  });
  return out;
}

// ═══════════════ v0.97.0 · Créditos: el documento de cada cuota se crea el mes en que vence (desde el inicio) ═══════════════
export const idCuotaDoc = (cid, n) => `d_cred_${cid}_${n}`;
export function docDeCuota(cr, c, partes) {
  const mes = c.fecha.slice(0, 7);
  return { id: idCuotaDoc(cr.id, c.n), origen: 'credito', credito: cr.id, formato: '', tipo: 'cuota', tipoTexto: `Cuota ${c.n} de ${cr.cuotas.length}`, nc: false, rut: '', rutN: '', razon: s(cr.nombre) || 'Crédito',
    folio: String(c.n), fecha: c.fecha, mes, neto: c.monto, exento: 0, iva: 0, otroImp: 0, total: c.monto, vence: c.fecha, formaPago: '', referencias: [], detalle: [], descuadre: '', cargaId: '', cliente: '', direccion: '', periodo: null,
    clasif: { item: partes[0].item, areas: [{ area: 'ADMIN', pct: 100 }], repartoId: '', partes, porLineas: false, separado: partes.length > 1, lineas: [], de: 'sistema' } };
}
export function cuotasPendientes(creds, docs, inicio, hoy, partesDe) {
  const ya = new Set((docs || []).map(d => d.id)), mesHoy = s(hoy).slice(0, 7), out = [];
  (creds || []).filter(cr => cr.estado !== 'archivado').forEach(cr => (cr.cuotas || []).forEach(c => { if (c.fecha >= s(inicio) && c.fecha.slice(0, 7) <= mesHoy && !ya.has(idCuotaDoc(cr.id, c.n))) out.push(docDeCuota(cr, c, partesDe(c))); }));
  return out;
}
