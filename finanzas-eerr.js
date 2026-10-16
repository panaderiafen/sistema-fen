// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas, F3 paso 2: estado de resultados por segmentos, cuadratura, cierre de mes y ajustes  v0.62.0
//  Reglas puras (sin red), probadas en pruebas/sistemafen/finanzas-f3b.test.js. Todo en NETO y en pesos enteros
//  (cada celda se redondea al peso y los totales son la suma de las celdas: lo que se ve siempre suma).
//
//  Columnas: Panadería, Bollería, Pastelería, Cafetería (área que produce), Común y Total.
//  Tres pisos (finanzas-plan.md, sección 1):
//   1. Ventas netas (por área productora; abre por canal) − costo directo de lo vendido (teórico: receta × unidades al
//      costo del mes; reventa a su costo de compra) − costos de venta (comisión de tarjeta, despacho) − merma valorizada
//      = MARGEN DE CONTRIBUCIÓN. Las ventas sin asociar van a Común (sin costo directo: se avisa).
//   2. − remuneraciones propias del área − otros fijos propios − depreciación del área = MARGEN DEL ÁREA.
//   3. Común: remuneraciones comunes (incluye el sueldo empresarial), fijos comunes y depreciación común, sin repartir →
//      RESULTADO OPERACIONAL (Total) = Σ margen de las áreas − comunes; − financieros (interés de las cuotas pagadas en el
//      mes según la tabla de cada crédito + gastos tipo financiero) = RESULTADO DEL MES.
//  Fuera del resultado (solo informativo): compras de MP y reventa (desviación), lo que ya está en el margen (comisión
//  Transbank), capital de créditos (cuotas − interés), impuestos (F29), inversiones (entran como depreciación), retiros,
//  otros con motivo y los pagos de tarjeta de crédito de la cartola (no son gastos: flujo de caja).
//  Cuadratura: total de gastos del mes en Gastos = en el resultado + interés dentro de las cuotas + compras + en el margen
//  + fuera + sin clasificar. Tiene que dar $0 de diferencia.
//  Cierre: snapshot (fin_cierres/{AAAA-MM}) con todo el estado de resultados, los costos usados y quién/cuándo. Un mes cerrado
//  no se toca: lo que cambie después aparece como "Ajustes de meses cerrados" en el primer mes abierto siguiente
//  (= cálculo de hoy del mes cerrado − su snapshot − lo ya informado como ajuste en otros meses cerrados).
// ═══════════════════════════════════════════════
import * as FR from './finanzas-resultados.js?v=0.67.2';

export const AREAS = ['PAN', 'BOL', 'PAS', 'CAF'];
export const COLS = ['PAN', 'BOL', 'PAS', 'CAF', 'comun'];
export const NOMBRE_COL = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', comun: 'Común', total: 'Total' };
export const SUCS = ['barros', 'ainavillo', 'b2b'];
export const NOMBRE_SUC = { barros: 'Caja Barros Arana', ainavillo: 'Caja Ainavillo', b2b: 'B2B' };
export const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mesTxt = m => { const [y, n] = String(m).split('-'); return `${MESES_L[Number(n) - 1] || n} ${y}`; };

// Filas del estado de resultados: k, texto, piso, signo con que se muestra (−: se resta), qué columnas usa
// (todas | areas = solo las 4 áreas | comun = solo Común), y si es un resultado (en negrita)
export const FILAS = [
  { k: 'ventas', t: 'Ventas netas', piso: 1, signo: '', cols: 'todas', abre: true },
  { k: 'costoDirecto', t: 'Costo directo de lo vendido', piso: 1, signo: '−', cols: 'todas' },
  { k: 'costosVenta', t: 'Costos de venta (comisión de tarjeta, despacho)', piso: 1, signo: '−', cols: 'todas' },
  { k: 'merma', t: 'Merma valorizada', piso: 1, signo: '−', cols: 'todas' },
  { k: 'mc', t: 'Margen de contribución', piso: 1, signo: '=', cols: 'todas', resultado: true, pct: true },
  { k: 'rem', t: 'Remuneraciones propias del área', piso: 2, signo: '−', cols: 'areas' },
  { k: 'fijos', t: 'Otros fijos propios del área', piso: 2, signo: '−', cols: 'areas' },
  { k: 'dep', t: 'Depreciación del área', piso: 2, signo: '−', cols: 'areas' },
  { k: 'ma', t: 'Margen del área', piso: 2, signo: '=', cols: 'todas', resultado: true, pct: true },
  { k: 'remComun', t: 'Remuneraciones comunes (incluye sueldo empresarial)', piso: 3, signo: '−', cols: 'comun' },
  { k: 'fijosComun', t: 'Fijos comunes', piso: 3, signo: '−', cols: 'comun' },
  { k: 'depComun', t: 'Depreciación común', piso: 3, signo: '−', cols: 'comun' },
  { k: 'resOp', t: 'Resultado operacional', piso: 3, signo: '=', cols: 'total', resultado: true, pct: true },
  { k: 'financieros', t: 'Financieros (intereses, multas y banco)', piso: 3, signo: '−', cols: 'comun' },
  { k: 'resultado', t: 'Resultado del mes', piso: 3, signo: '=', cols: 'total', resultado: true, pct: true }
];
export const FILA = Object.fromEntries(FILAS.map(f => [f.k, f]));
export const NOMBRE_PISO = { 1: 'Piso 1 · Margen de contribución', 2: 'Piso 2 · Margen del área', 3: 'Piso 3 · Comunes y resultado' };

const s = v => (v === null || v === undefined ? '' : String(v));
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const r0 = v => Math.round(num(v));
export const vacia = () => ({ PAN: 0, BOL: 0, PAS: 0, CAF: 0, comun: 0, total: 0 });
const conTotal = c => { const x = { ...vacia(), ...c }; COLS.forEach(k => { x[k] = r0(x[k]); }); x.total = COLS.reduce((a, k) => a + x[k], 0); return x; };
const colDe = a => (AREAS.includes(s(a).toUpperCase()) ? s(a).toUpperCase() : 'comun');
export const mesDe = f => s(f).slice(0, 7);
export const ultimoDia = mes => { const [y, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
export const mesMas = (mes, k) => FR.sumarMeses(mes + '-01', k).slice(0, 7);
const sumarDias = (f, k) => { const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + k)); return d.toISOString().slice(0, 10); };

// ── Gastos del mes: cada línea (por área, con los prorrateos) con su tipo para resultados ──
// → [{ id, fecha, item, clave, tipo ('' = sin clasificar), grupo, area (código), col (PAN…CAF|comun), neto, proveedor, obs }]
// v0.67.1: el tipo sale de FR.tipoResultado (Clasificación manda; sin ella, subtipo FINANCIERO = financiero). items: los de Gastos
// (para su subtipo); sin la lista, el subtipo guardado en el gasto.
export function lineasGastosMes(gastos, mes, fin = {}, mapa = {}, items = null) {
  const out = [], porClave = {};
  (items || []).forEach(i => { if (i && i.item) porClave[FR.claveItem(i.item)] = i; });
  (gastos || []).filter(FR.vigente).filter(g => FR.fechaGasto(g).slice(0, 7) === mes).forEach(g => {
    const clave = FR.claveItem(g.itemGasto), tipo = FR.tipoResultado(g.itemGasto, fin, porClave[clave] || g).tipo;
    FR.lineasArea(g).forEach(l => out.push({ id: s(g.id), fecha: FR.fechaGasto(g), item: s(g.itemGasto).trim() || '(sin ítem)', clave, tipo, grupo: tipo ? FR.TIPO[tipo].grupo : 'sin', area: l.area,
      col: FR.destinoArea(l.area, mapa), neto: num(l.neto), proveedor: s(g.razonSocial), obs: s(g.observacion).slice(0, 120) }));
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.item.localeCompare(b.item, 'es') || a.id.localeCompare(b.id));
}

// ── Interés y capital de los créditos en el mes (cuotas pagadas en el mes, por la fecha de pago) ──
// creditos: fin_creditos; vencs y gastos de fen-gastos. → [{ credito, nombre, interes, capital, cuotas }]
export function creditosDelMes(creditos, vencs, gastos, mes) {
  return (creditos || []).map(c => {
    const m = FR.marcarPagos(c.tabla || [], FR.pagosDeObligacion(c.obligacionId, vencs, gastos));
    const x = FR.creditoPorMes(m.filas)[mes];
    return x ? { credito: s(c.id), nombre: s(c.nombre), interes: r0(x.interes), capital: r0(x.capital), cuotas: x.cuotas } : null;
  }).filter(Boolean);
}

// ── Depreciación del mes, por inversión y por columna ──
export function depreciacionDelMes(invs, mes) {
  const out = [];
  (invs || []).forEach(inv => {
    const d = FR.deprMes(inv, mes); if (!d) return;
    const tot = inv.lineas.reduce((a, l) => a + l.neto, 0) || 1;
    inv.lineas.forEach(l => out.push({ id: inv.id, item: inv.item, fecha: inv.fecha, col: AREAS.includes(l.destino) ? l.destino : 'comun', area: l.area, neto: d * l.neto / tot, meses: inv.meses, valor: inv.valor }));
  });
  return out;
}

// ═══════════════ Armar el estado de resultados de un mes ═══════════════
// E = { mes,
//   margen: resultado de finanzas-margenes.calcularMargenes() para ese mes (filas con area, porSuc { neto, costo, comision, despacho }),
//   merma: { disponible, detalle: [{ area, nombre, neto }], cafe (neto del café de calibración, va a Cafetería), sinCosto (n) },
//   gastos (todos), fin (fin_items), mapa (areasGasto), creditosMes (creditosDelMes), invs (FR.inversiones), pagosTarjeta [{ fecha, monto, descripcion, id }] }
export function armarEERR(E) {
  const mes = E.mes, F = {}, D = {}, avisos = [];
  const fila = k => F[k] || (F[k] = vacia());
  const det = (k, col, ref) => { const kk = k + '.' + col; (D[kk] || (D[kk] = [])).push(ref); };
  ['ventas', 'costoDirecto', 'costosVenta', 'merma', 'rem', 'fijos', 'dep', 'remComun', 'fijosComun', 'depComun', 'financieros'].forEach(fila);
  const canal = Object.fromEntries(SUCS.map(x => [x, vacia()]));
  const costosUsados = {};
  let sinCostoNeto = 0, nSinCosto = 0, sinAsocNeto = 0;
  // Piso 1: ventas, costo directo y costos de venta, por producto y canal
  ((E.margen && E.margen.filas) || []).forEach(f => {
    const col = f.tipo === 'sin' ? 'comun' : colDe(f.area);
    Object.entries(f.porSuc || {}).forEach(([suc, x]) => {
      const cv = num(x.comision) + num(x.despacho);
      F.ventas[col] += num(x.neto); F.costoDirecto[col] += num(x.costo); F.costosVenta[col] += cv;
      if (canal[suc]) canal[suc][col] += num(x.neto);
      const ref = { tipo: 'venta', nombre: s(f.nombre), suc, neto: r0(x.neto), costo: r0(x.costo), costoVenta: r0(cv), unidades: Math.round(num(x.unidades) * 1000) / 1000, ok: !!f.ok, motivo: (f.motivos || [])[0] || '' };
      det('ventas', col, ref); det('ventasCanal_' + suc, col, ref); det('costoDirecto', col, ref); det('costosVenta', col, ref);
    });
    if (f.tipo === 'sin') sinAsocNeto += num(f.neto);
    else if (!f.ok) { sinCostoNeto += num(f.neto); nSinCosto++; }
    if (f.tipo === 'receta' && f.receta) costosUsados[f.receta] = { nombre: s(f.nombre), costoUnit: f.costoUnit === null || f.costoUnit === undefined ? null : Math.round(num(f.costoUnit) * 100) / 100, lectura: f.lectura || 'un', fuente: (f.fuenteCosto || []).join(',') };
  });
  if (sinAsocNeto) avisos.push({ k: 'sin_asociar', texto: `Ventas de productos sin asociar: ${pesosTxt(sinAsocNeto)} (en Común, sin costo directo). Asócialos en Márgenes → Asociar productos.` });
  if (nSinCosto) avisos.push({ k: 'sin_costo', texto: `${nSinCosto} ${nSinCosto === 1 ? 'producto' : 'productos'} con costo incompleto o sin costo (${pesosTxt(sinCostoNeto)} de venta): su costo directo va con lo que sí tiene costo.` });
  // Merma valorizada (neto)
  const M = E.merma || {};
  (M.detalle || []).forEach(x => { const col = colDe(x.area); F.merma[col] += num(x.neto); det('merma', col, { tipo: 'merma', nombre: s(x.nombre), neto: r0(x.neto), cantidad: x.cantidad, unidad: x.unidad || '' }); });
  if (num(M.cafe)) { F.merma.CAF += num(M.cafe); det('merma', 'CAF', { tipo: 'merma', nombre: 'Café de calibración, botado y pruebas', neto: r0(M.cafe) }); }
  if (M.disponible === false) avisos.push({ k: 'merma', texto: 'No se pudo leer la merma de Producción: la merma va en $0.' });
  if (num(M.sinCosto)) avisos.push({ k: 'merma_sin_costo', texto: `${M.sinCosto} ${M.sinCosto === 1 ? 'anotación' : 'anotaciones'} de merma sin costo (no suman).` });
  // Gastos del mes
  const lineas = lineasGastosMes(E.gastos, mes, E.fin, E.mapa, E.items);
  const info = { compras: { mp: 0, reventa: 0, total: 0 }, enMargen: 0, fuera: { cuotas: 0, capital: 0, impuestos: 0, inversion: 0, retiro: 0, otro: 0, total: 0 }, interes: 0, pagosTarjeta: { n: 0, monto: 0 }, sinClasificar: { n: 0, neto: 0 } };
  const refG = l => ({ tipo: 'gasto', id: l.id, fecha: l.fecha, item: l.item, clave: l.clave, tipoRes: l.tipo, area: l.area, neto: r0(l.neto), proveedor: l.proveedor, obs: l.obs });
  const sinClas = {};
  lineas.forEach(l => {
    const t = l.tipo, propio = AREAS.includes(l.col);
    if (t === 'remuneraciones') { if (propio) { F.rem[l.col] += l.neto; det('rem', l.col, refG(l)); } else { F.remComun.comun += l.neto; det('remComun', 'comun', refG(l)); } }
    else if (t === 'fijo') { if (propio) { F.fijos[l.col] += l.neto; det('fijos', l.col, refG(l)); } else { F.fijosComun.comun += l.neto; det('fijosComun', 'comun', refG(l)); } }
    else if (t === 'financiero') { F.financieros.comun += l.neto; det('financieros', 'comun', refG(l)); }
    else if (t === 'compras_mp') { info.compras.mp += l.neto; det('compras', 'mp', refG(l)); }
    else if (t === 'compras_reventa') { info.compras.reventa += l.neto; det('compras', 'reventa', refG(l)); }
    else if (t === 'en_margen') { info.enMargen += l.neto; det('enMargen', 'total', refG(l)); }
    else if (t === 'fuera_capital_credito') { info.fuera.cuotas += l.neto; det('fuera', 'capital', refG(l)); }
    else if (t === 'fuera_impuestos') { info.fuera.impuestos += l.neto; det('fuera', 'impuestos', refG(l)); }
    else if (t === 'inversion') { info.fuera.inversion += l.neto; det('fuera', 'inversion', refG(l)); }
    else if (t === 'retiro') { info.fuera.retiro += l.neto; det('fuera', 'retiro', refG(l)); }
    else if (t === 'otro_fuera') { info.fuera.otro += l.neto; det('fuera', 'otro', refG(l)); }
    else { info.sinClasificar.neto += l.neto; det('sinClasificar', 'total', refG(l)); const x = sinClas[l.clave] || (sinClas[l.clave] = { clave: l.clave, item: l.item, n: 0, neto: 0 }); x.n++; x.neto += l.neto; }
  });
  info.sinClasificar.n = Object.keys(sinClas).length;
  // Interés de los créditos (de la tabla) → financieros; capital = cuotas − interés (fuera)
  (E.creditosMes || []).forEach(c => { if (!c.interes) return; F.financieros.comun += c.interes; info.interes += c.interes; det('financieros', 'comun', { tipo: 'credito', nombre: c.nombre, neto: c.interes, capital: c.capital, cuotas: c.cuotas }); });
  info.fuera.capital = info.fuera.cuotas - info.interes;
  if (info.interes > info.fuera.cuotas + 1) avisos.push({ k: 'interes', texto: `El interés de las cuotas del mes (${pesosTxt(info.interes)}) es mayor que las cuotas clasificadas como "Cuota de crédito" (${pesosTxt(info.fuera.cuotas)}): revisa que el ítem de la cuota esté clasificado así.` });
  // Depreciación
  depreciacionDelMes(E.invs, mes).forEach(d => {
    const k = d.col === 'comun' ? 'depComun' : 'dep';
    F[k][d.col] += d.neto; det(k, d.col, { tipo: 'depreciacion', id: d.id, item: d.item, clave: FR.claveItem(d.item), fecha: d.fecha, area: d.area, neto: Math.round(d.neto), meses: d.meses, valor: r0(d.valor) });
  });
  // Pagos de tarjeta (cartola): no son gasto; flujo de caja
  (E.pagosTarjeta || []).filter(p => mesDe(p.fecha) === mes).forEach(p => { info.pagosTarjeta.n++; info.pagosTarjeta.monto += num(p.monto); det('pagosTarjeta', 'total', { tipo: 'cartola', id: s(p.id), fecha: s(p.fecha), nombre: s(p.descripcion), neto: r0(p.monto) }); });
  // Redondeo por celda y filas derivadas
  Object.keys(F).forEach(k => { F[k] = conTotal(F[k]); });
  SUCS.forEach(x => { canal[x] = conTotal(canal[x]); });
  F.mc = conTotal(Object.fromEntries(COLS.map(c => [c, F.ventas[c] - F.costoDirecto[c] - F.costosVenta[c] - F.merma[c]])));
  F.ma = conTotal(Object.fromEntries(COLS.map(c => [c, F.mc[c] - F.rem[c] - F.fijos[c] - F.dep[c]])));
  const comunes = F.remComun.total + F.fijosComun.total + F.depComun.total;
  F.resOp = { ...vacia(), total: F.ma.total - comunes };
  F.resultado = { ...vacia(), total: F.resOp.total - F.financieros.total };
  // Info redondeada
  info.compras.mp = r0(info.compras.mp); info.compras.reventa = r0(info.compras.reventa); info.compras.total = info.compras.mp + info.compras.reventa;
  info.enMargen = r0(info.enMargen); info.interes = r0(info.interes); info.sinClasificar.neto = r0(info.sinClasificar.neto); info.pagosTarjeta.monto = r0(info.pagosTarjeta.monto);
  ['cuotas', 'impuestos', 'inversion', 'retiro', 'otro'].forEach(k => { info.fuera[k] = r0(info.fuera[k]); });
  info.fuera.capital = info.fuera.cuotas - info.interes;
  info.fuera.total = info.fuera.capital + info.fuera.impuestos + info.fuera.inversion + info.fuera.retiro + info.fuera.otro;
  info.sinClasificarLista = Object.values(sinClas).map(x => ({ ...x, neto: r0(x.neto) })).sort((a, b) => b.neto - a.neto);
  info.ventasSinAsociar = r0(sinAsocNeto); info.ventasSinCosto = r0(sinCostoNeto);
  const out = { mes, filas: F, canal, info, detalle: D, avisos, costosUsados };
  out.cuadratura = cuadratura(out, E.gastos);
  return out;
}
const pesosTxt = v => '$' + r0(v).toLocaleString('es-CL');

// ── Cuadratura con Gastos: el total de gastos del mes (sumado directo de los gastos, sin pasar por las líneas) contra
// dónde quedó cada peso. Gastos en el resultado = remuneraciones + fijos (propios y comunes) + financieros de gastos
// (sin el interés de las cuotas, que sale de la tabla del crédito y está dentro de las cuotas).
export function cuadratura(eerr, gastos) {
  const F = eerr.filas, I = eerr.info;
  const totalGastos = r0((gastos || []).filter(FR.vigente).filter(g => FR.fechaGasto(g).slice(0, 7) === eerr.mes).reduce((a, g) => a + FR.netoGasto(g), 0));
  const enResultado = F.rem.total + F.fijos.total + F.remComun.total + F.fijosComun.total + (F.financieros.total - I.interes);
  const partes = { enResultado, interesCuotas: I.interes, compras: I.compras.total, enMargen: I.enMargen, fuera: I.fuera.total, sinClasificar: I.sinClasificar.neto };
  const suma = Object.values(partes).reduce((a, v) => a + v, 0);
  return { totalGastos, ...partes, suma, diferencia: totalGastos - suma, cuadra: Math.abs(totalGastos - suma) <= 1 && !I.sinClasificar.n };
}

// ═══════════════ Vista secundaria: comunes repartidos por causa ═══════════════
// claves (fin_config/claves): { bases: { m2: { PAN, BOL, PAS, CAF }, kwh: {…}, horas: {…} },
//   porTipo: { remuneraciones: asig, fijo: asig, depreciacion: asig }, porItem: { claveItem: asig } }
//   asig = { base: 'm2'|'kwh'|'horas' } | { base: 'manual', pct: { PAN, BOL, PAS, CAF } } (suma 100). Sin asig = sin repartir.
export const BASES = [{ k: 'm2', t: 'Metros cuadrados (m²)', u: 'm²' }, { k: 'kwh', t: 'Maquinaria (kWh)', u: 'kWh' }, { k: 'horas', t: 'Horas de trabajo', u: 'h' }, { k: 'manual', t: '% a mano', u: '%' }];
export const TIPOS_COMUNES = [{ k: 'remuneraciones', t: 'Remuneraciones comunes', fila: 'remComun' }, { k: 'fijo', t: 'Fijos comunes', fila: 'fijosComun' }, { k: 'depreciacion', t: 'Depreciación común', fila: 'depComun' }];
// % por área de una asignación (suma 100) o null
export function pctDe(asig, bases = {}) {
  if (!asig || !asig.base) return null;
  const src = asig.base === 'manual' ? asig.pct : (bases || {})[asig.base];
  if (!src) return null;
  const v = AREAS.map(a => Math.max(0, num(src[a])));
  const t = v.reduce((a, x) => a + x, 0);
  if (!(t > 0)) return null;
  if (asig.base === 'manual' && Math.abs(t - 100) > 0.01) return null;
  return Object.fromEntries(AREAS.map((a, i) => [a, v[i] / t * 100]));
}
export function validarClaves(d) {
  const out = { bases: {}, porTipo: {}, porItem: {} };
  ['m2', 'kwh', 'horas'].forEach(b => {
    const x = (d.bases || {})[b] || {}, y = {};
    AREAS.forEach(a => { const v = s(x[a]).trim() === '' ? 0 : Number(s(x[a]).replace(',', '.')); if (!(v >= 0)) throw new Error(`${BASES.find(z => z.k === b).t}: escribe números de 0 o más.`); y[a] = v; });
    out.bases[b] = y;
  });
  const asig = (a, nom) => {
    if (!a || !a.base) return null;
    if (!BASES.some(b => b.k === a.base)) throw new Error(`${nom}: elige una clave.`);
    if (a.base === 'manual') {
      const pct = {}; AREAS.forEach(k => { pct[k] = Number(s((a.pct || {})[k] || 0).replace(',', '.')) || 0; });
      const t = AREAS.reduce((x, k) => x + pct[k], 0);
      if (Math.abs(t - 100) > 0.01) throw new Error(`${nom}: los % suman ${String(Math.round(t * 100) / 100).replace('.', ',')}, deben sumar 100.`);
      return { base: 'manual', pct };
    }
    if (!pctDe(a, out.bases)) throw new Error(`${nom}: la clave "${BASES.find(b => b.k === a.base).t}" no tiene valores por área.`);
    return { base: a.base };
  };
  TIPOS_COMUNES.forEach(t => { const x = asig((d.porTipo || {})[t.k], t.t); if (x) out.porTipo[t.k] = x; });
  Object.entries(d.porItem || {}).forEach(([k, a]) => { const x = asig(a, `Ítem ${k}`); if (x) out.porItem[k] = x; });
  return out;
}
// Reparte las líneas comunes (remuneraciones, fijos y depreciación comunes; los financieros quedan sin repartir, debajo del
// resultado operacional). Cada línea con su clave (la del ítem manda sobre la del tipo); el redondeo lo absorbe la última área.
// → { porArea { PAN: { rem, fijos, dep, total } }, sinRepartir { rem, fijos, dep, total, lineas }, resultadoArea { PAN… },
//     comunResto (margen de Común − sin repartir), total (= resultado operacional), lineas [{ item, base, neto, partes }] }
export function repartirComunes(eerr, claves = {}) {
  const porArea = Object.fromEntries(AREAS.map(a => [a, { rem: 0, fijos: 0, dep: 0, total: 0 }])), sin = { rem: 0, fijos: 0, dep: 0, total: 0, lineas: [] }, lineas = [];
  const key = { remuneraciones: 'rem', fijo: 'fijos', depreciacion: 'dep' };
  TIPOS_COMUNES.forEach(t => {
    const refs = (eerr.detalle || {})[t.fila + '.comun'] || [];
    // Agrupadas por ítem (una clave por ítem)
    const grupos = {};
    refs.forEach(r => { const k = r.clave || FR.claveItem(r.item || r.nombre); const g = grupos[k] || (grupos[k] = { clave: k, item: r.item || r.nombre || k, neto: 0 }); g.neto += num(r.neto); });
    const totFila = num((eerr.filas[t.fila] || {}).total), sumaRefs = Object.values(grupos).reduce((a, g) => a + g.neto, 0);
    if (Math.abs(totFila - sumaRefs) >= 1) { const g = grupos.__ajuste || (grupos.__ajuste = { clave: '__ajuste', item: 'Redondeo', neto: 0 }); g.neto += totFila - sumaRefs; }
    Object.values(grupos).forEach(g => {
      const asig = ((claves.porItem || {})[g.clave]) || ((claves.porTipo || {})[t.k]) || null;
      const pct = pctDe(asig, claves.bases), neto = r0(g.neto);
      if (!pct) { sin[key[t.k]] += neto; sin.lineas.push({ tipo: t.k, item: g.item, neto }); lineas.push({ tipo: t.k, item: g.item, clave: g.clave, base: '', neto, partes: null }); return; }
      let resto = neto; const partes = {};
      const conPct = AREAS.filter(a => pct[a] > 0);
      conPct.forEach((a, i) => { const v = i === conPct.length - 1 ? resto : Math.round(neto * pct[a] / 100); resto -= v; partes[a] = v; porArea[a][key[t.k]] += v; });
      lineas.push({ tipo: t.k, item: g.item, clave: g.clave, base: asig.base, porItem: !!((claves.porItem || {})[g.clave]), neto, partes });
    });
  });
  AREAS.forEach(a => { const x = porArea[a]; x.total = x.rem + x.fijos + x.dep; });
  sin.total = sin.rem + sin.fijos + sin.dep;
  const resultadoArea = Object.fromEntries(AREAS.map(a => [a, eerr.filas.ma[a] - porArea[a].total]));
  const comunResto = eerr.filas.ma.comun - sin.total;
  return { porArea, sinRepartir: sin, resultadoArea, comunResto, total: AREAS.reduce((x, a) => x + resultadoArea[a], 0) + comunResto, lineas };
}

// ═══════════════ Cierre de mes: lo que se revisa antes de cerrar ═══════════════
// D = { mes, cargasSii [{ desde, hasta, quitada }], ventas { abiertas, faltan, guardado, netoAinavillo, nAinavillo, netoTotal, netoSinAsociar },
//   cargosPorRevisar [{ fecha, monto, descripcion }], conteos { bodegas [cód], nombres { cód: nombre }, porBodega { cód: [fechas] } },
//   sinClasificar { n, neto } }
// → [{ k, t, ok, nivel: 'ok'|'falla'|'aviso', detalle, ir (ruta para arreglarlo), info }]
export const VENTANA_CONTEO = 3;
export function ventanaConteo(mes) { const fin = ultimoDia(mes); return { desde: sumarDias(fin, -(VENTANA_CONTEO - 1)), hasta: sumarDias(fin, VENTANA_CONTEO) }; }
export function checksCierre(D) {
  const mes = D.mes, ini = mes + '-01', fin = ultimoDia(mes), out = [];
  const add = (k, t, ok, detalle, ir, info, nivelFalla = 'falla') => out.push({ k, t, ok: !!ok, nivel: ok ? 'ok' : nivelFalla, detalle, ir, info });
  // 1. SII del mes cargado: alguna carga cubre hasta el último día del mes
  const vivas = (D.cargasSii || []).filter(c => c && !s(c.quitada).trim()).map(c => ({ desde: s(c.desde).slice(0, 10) || s(c.hasta).slice(0, 10), hasta: s(c.hasta).slice(0, 10) || s(c.desde).slice(0, 10) })).filter(c => c.desde);
  const tocan = vivas.filter(c => c.desde <= fin && c.hasta >= ini), hasta = tocan.map(c => c.hasta).sort().pop() || '';
  add('sii', 'SII del mes cargado', tocan.length && hasta >= fin,
    !tocan.length ? `No hay ninguna carga del SII con documentos de ${mesTxt(mes)}.` : hasta >= fin ? `Cargado hasta el ${fechaCorta(hasta > fin ? fin : hasta)}.` : `Las cargas llegan solo hasta el ${fechaCorta(hasta)}: falta el resto del mes.`,
    '#conciliacion/sii', 'Que las compras del SII de todo el mes estén cargadas en Conciliación → Cargas del SII (alguna carga cubre hasta el último día del mes). Sin eso faltan facturas en Gastos y el costo de las materias primas no está al día.');
  // 2. Ventas completas (las dos sucursales y B2B): sin cajas abiertas ni cierres sin resumen
  const v = D.ventas || {};
  add('ventas', 'Ventas completas', !v.abiertas && !v.faltan,
    v.guardado ? 'Mes guardado completo en Finanzas.' : `${v.abiertas ? `${v.abiertas} ${v.abiertas === 1 ? 'caja abierta' : 'cajas abiertas'}` : ''}${v.abiertas && v.faltan ? ' · ' : ''}${v.faltan ? `${v.faltan} ${v.faltan === 1 ? 'cierre sin resumen' : 'cierres sin resumen'}` : ''}` || 'Todas las cajas cerradas y con su resumen.',
    '#finanzas/margenes', 'Todas las cajas del mes cerradas y con su resumen de cierre (Ventas de caja → Reportes o Finanzas → Márgenes → "Generar los que faltan"). Las órdenes B2B se leen tal cual.');
  add('ainavillo', 'Ainavillo registrando ventas', num(v.nAinavillo) > 0,
    num(v.nAinavillo) > 0 ? `${num(v.nAinavillo).toLocaleString('es-CL')} productos vendidos · ${pesosTxt(v.netoAinavillo)} neto.` : 'Ainavillo no tiene ventas registradas en la caja este mes.',
    '#caja/reportes', 'Ainavillo tiene que registrar sus ventas en la caja: si no, su venta no está en el estado de resultados. Es un aviso: no impide cerrar.', 'aviso');
  // 3. Cartola conciliada: ningún cargo del mes por revisar
  const cr = D.cargosPorRevisar || [];
  add('cartola', 'Cartola conciliada', !cr.length, cr.length ? `${cr.length} ${cr.length === 1 ? 'cargo' : 'cargos'} del mes por revisar (${pesosTxt(cr.reduce((a, c) => a + num(c.monto), 0))}).` : 'Sin cargos por revisar en el mes.',
    '#conciliacion/cargos', 'Que todos los cargos de la cartola del mes estén revisados en Conciliación → Cargos (pagan un vencimiento, ya están en Gastos, son gasto nuevo, pago de tarjeta o no son gasto).');
  // 4. Conteo de bodega hecho (cada bodega): un conteo en los últimos 3 días del mes o los primeros 3 del siguiente
  const w = ventanaConteo(mes), C = D.conteos || {}, bods = C.bodegas && C.bodegas.length ? C.bodegas : ['PROD', 'CAF'];
  const sinConteo = bods.filter(b => !((C.porBodega || {})[b] || []).some(f => f >= w.desde && f <= w.hasta));
  add('conteo', 'Conteo de bodega hecho', C.disponible !== false && !sinConteo.length,
    C.disponible === false ? 'No se pudo leer Producción (bodegas).' : sinConteo.length ? `Falta el conteo de ${sinConteo.map(b => (C.nombres || {})[b] || b).join(' y ')} (del ${fechaCorta(w.desde)} al ${fechaCorta(w.hasta)}).` : `Contado: ${bods.map(b => `${(C.nombres || {})[b] || b} ${fechaCorta(((C.porBodega || {})[b] || []).filter(f => f >= w.desde && f <= w.hasta).sort().pop())}`).join(' · ')}.`,
    '#produccion', `Un conteo en cada bodega (Producción y Cafetería) entre el ${fechaCorta(w.desde)} y el ${fechaCorta(w.hasta)}: los últimos ${VENTANA_CONTEO} días del mes o los primeros ${VENTANA_CONTEO} del siguiente. Lo anotan las jefas en Cocina → Bodega.`);
  // 5. Gastos sin clasificar = 0
  const sc = D.sinClasificar || {};
  add('clasificar', 'Gastos clasificados', !num(sc.n), num(sc.n) ? `${sc.n} ${sc.n === 1 ? 'ítem' : 'ítems'} sin tipo para resultados (${pesosTxt(sc.neto)}).` : 'Todos los gastos del mes tienen tipo.',
    '#finanzas/resultados/clasificacion', 'Cada ítem de gasto del mes con su tipo para resultados (Resultados → Clasificación). Lo sin clasificar no entra al resultado.');
  // v0.66.0 · Documentos del SII de ese mes sin clasificar = 0 (su gasto todavía no existe)
  if (D.siiPendientes) {
    const sp = D.siiPendientes;
    add('sii_clasif', `Documentos del SII de ${mesTxt(mes)} sin clasificar: ${num(sp.n)}`, !num(sp.n), num(sp.n) ? `${sp.n} ${sp.n === 1 ? 'documento del SII' : 'documentos del SII'} de ${mesTxt(mes)} sin clasificar (${pesosTxt(sp.monto)}): su gasto todavía no existe.` : `Todos los documentos del SII de ${mesTxt(mes)} están clasificados.`,
      `#conciliacion/sii/porclasificar/${mes}`, 'Los documentos del SII que subiste y no se clasificaron solos (proveedor nuevo o con dudas) no tienen gasto todavía: no están en el estado de resultados. Clasifícalos al conciliar la cartola (el cargo del mismo monto), en Conciliación → Pagos sin banco o en Cargas del SII. Para cerrar igual, escribe el motivo.');
  }
  // 6. Productos vendidos sin asociar < 10 % de la venta
  const pctSin = num(v.netoTotal) > 0 ? num(v.netoSinAsociar) / num(v.netoTotal) * 100 : 0;
  add('asociar', 'Productos vendidos asociados', pctSin < 10, `${String(Math.round(pctSin * 10) / 10).replace('.', ',')} % de la venta neta sin asociar (${pesosTxt(v.netoSinAsociar)}); el límite es menos de 10 %.`,
    '#finanzas/margenes/asociar', 'La venta de productos sin asociar a una receta o reventa no tiene costo directo. Para cerrar, menos del 10 % de la venta neta del mes puede quedar sin asociar.');
  return out;
}
export const fallas = checks => (checks || []).filter(c => c.nivel === 'falla');
const fechaCorta = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(f)); return m ? `${Number(m[3])} ${MESES_L[Number(m[2]) - 1].slice(0, 3)}` : '—'; };

// ═══════════════ Snapshot y ajustes ═══════════════
// Lo que se guarda al cerrar: el estado de resultados completo (filas, canal, info, cuadratura, detalle), los costos usados,
// las revisiones (y si se cerró igual con motivo), los ajustes de meses anteriores que se informaron aquí, quién y cuándo.
export function armarSnapshot(eerr, { checks = [], override = null, por = '', en = '', ajustes = null } = {}) {
  const f = fallas(checks);
  if (f.length && !(override && s(override.motivo).trim().length >= 5)) throw new Error('Hay revisiones sin cumplir: para cerrar igual, marca "Cerrar igual" y escribe el motivo.');
  return {
    mes: eerr.mes, estado: 'cerrado', filas: eerr.filas, canal: eerr.canal, info: eerr.info, cuadratura: eerr.cuadratura, detalle: eerr.detalle, avisos: eerr.avisos, costosUsados: eerr.costosUsados,
    checks: checks.map(c => ({ k: c.k, t: c.t, ok: c.ok, nivel: c.nivel, detalle: c.detalle })), override: f.length ? { motivo: s(override.motivo).trim().slice(0, 300), fallas: f.map(c => c.k) } : null,
    ajustes: ajustes ? { total: ajustes.total, porMes: ajustes.porMes } : null, cerradoPor: por, cerradoEn: en
  };
}
// Lo informado como ajuste de un mes X en los snapshots de otros meses cerrados (por fila, en Total)
export function yaInformado(cierres, mesX) {
  const out = {};
  Object.values(cierres || {}).forEach(c => { if (!c || c.estado !== 'cerrado' || !c.ajustes || !c.ajustes.porMes) return; const a = c.ajustes.porMes[mesX]; if (!a) return; Object.entries(a.porFila || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + num(v); }); });
  return out;
}
// Diferencia de un mes cerrado: cálculo de hoy − snapshot − lo ya informado. Por fila (Total) y los gastos que cambiaron.
export function ajusteDe(vivo, snap, informado = {}) {
  const porFila = {};
  FILAS.forEach(f => { const d = num(vivo.filas[f.k].total) - num((snap.filas[f.k] || {}).total) - num(informado[f.k]); if (Math.abs(d) >= 1) porFila[f.k] = r0(d); });
  // Gastos que cambiaron (por id): agregados, quitados o con otro monto/tipo/área
  const mapa = det => { const m = {}; Object.entries(det || {}).forEach(([k, refs]) => (refs || []).forEach(r => { if (r.tipo !== 'gasto') return; const x = m[r.id] || (m[r.id] = { id: r.id, item: r.item, fecha: r.fecha, neto: 0, donde: [] }); x.neto += num(r.neto); x.donde.push(k.split('.')[0]); })); return m; };
  const a = mapa(snap.detalle), b = mapa(vivo.detalle), gastos = [];
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(id => {
    const x = a[id], y = b[id];
    if (!x) gastos.push({ id, item: y.item, fecha: y.fecha, antes: 0, ahora: r0(y.neto), cambio: 'nuevo' });
    else if (!y) gastos.push({ id, item: x.item, fecha: x.fecha, antes: r0(x.neto), ahora: 0, cambio: 'quitado' });
    else if (r0(x.neto) !== r0(y.neto) || x.donde.sort().join() !== y.donde.sort().join()) gastos.push({ id, item: y.item, fecha: y.fecha, antes: r0(x.neto), ahora: r0(y.neto), cambio: 'cambió', antesDonde: x.donde, ahoraDonde: y.donde });
  });
  return { porFila, resultado: porFila.resultado || 0, gastos, hay: Object.keys(porFila).length > 0 };
}
// En qué mes abierto se informa el ajuste de un mes cerrado: el primer mes después de él que no esté cerrado
export function mesDeAjuste(mesX, cierres, hasta = '9999-12') {
  for (let m = mesMas(mesX, 1), k = 0; m <= hasta && k < 60; m = mesMas(m, 1), k++) { const c = (cierres || {})[m]; if (!c || c.estado !== 'cerrado') return m; }
  return null;
}
// Junta los ajustes que van en el mes M: { total, porMes { X: { porFila, resultado, gastos } } }
export function juntarAjustes(porMes) {
  const out = { total: 0, porMes: {} };
  Object.entries(porMes || {}).forEach(([m, a]) => { if (!a || !a.hay) return; out.porMes[m] = { porFila: a.porFila, resultado: a.resultado, gastos: (a.gastos || []).slice(0, 50) }; out.total += a.resultado; });
  return out;
}
// Meses de un año para el selector: de enero al mes de hoy (o diciembre), del más nuevo al más viejo
export function mesesDelAnio(anio, hoy) {
  const out = [], tope = mesDe(hoy) < `${anio}-12` ? mesDe(hoy) : `${anio}-12`;
  for (let m = `${anio}-01`; m <= tope; m = mesMas(m, 1)) out.push(m);
  return out.reverse();
}
