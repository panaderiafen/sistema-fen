// ═══════════════════════════════════════════════
//  Sistema Fën — Rutas de Gastos, Ventas B2B → Conciliación y Finanzas → Resumen del mes  v0.78.0 (Gastos, etapa A)
//  Puro (sin Firebase ni DOM): sirve para la app y para las pruebas.
//  En la etapa A la sección Conciliación sale del menú y sus pantallas se mueven tal como funcionan:
//  · Gastos → Bandeja (#gastos): los cargos de la cartola, Cargas del SII (#gastos/sii) y Pagos sin banco (#gastos/sinbanco);
//  · Gastos → Previred (#gastos/previred) y Proveedores (#gastos/proveedores[/id]);
//  · Gastos → Configuración (#gastos/config/…): cuentas, items, reglas (del banco, cargos), archivos, base; clasificar es parte de cuentas;
//  · Ventas B2B → Conciliación (#b2b/conciliacion): los abonos; sus reglas en #b2b/conciliacion/reglas;
//  · Finanzas → Resumen del mes (#finanzas/resumen[/cargos|/abonos]).
//  Los enlaces viejos (#conciliacion…, #gastos/obligaciones, #gastos/items…) llevan solos al lugar nuevo.
// ═══════════════════════════════════════════════

export const SUBS_BANDEJA = ['cargos', 'sii', 'sinbanco'];
export const CONFIG_GASTOS = [['cuentas', 'Cuentas recurrentes'], ['items', 'Ítems'], ['reglas', 'Reglas del banco'], ['archivos', 'Archivos'], ['base', 'Base nueva']];
const partes = h => String(h || '').replace(/^#/, '').split('/');

// La ruta nueva de un enlace viejo (null si ya es una ruta vigente)
export function rutaNueva(h) {
  const s = String(h || ''), p = partes(s);
  if (p[0] === 'conciliacion') {
    const k = p[1] || '', resto = p.slice(2).filter(x => x !== '').join('/');
    if (!k || k === 'cargos' || k === 'cartola') return '#gastos';
    if (['sii', 'sinbanco', 'previred', 'proveedores'].includes(k)) return '#gastos/' + k + (resto ? '/' + resto : '');
    if (k === 'reglas') return '#gastos/config/reglas';
    if (k === 'reglas-abonos') return '#b2b/conciliacion/reglas';
    if (k === 'abonos') return '#b2b/conciliacion';
    if (k === 'resumen') return '#finanzas/resumen' + (resto ? '/' + resto : '');
    return '#gastos';
  }
  if (p[0] === 'gastos') {
    const k = p[1] || '';
    if (k === 'cartola' || k === 'cargos' || k === 'bandeja') return '#gastos';
    if (k === 'obligaciones' || k === 'clasificar') return '#gastos/config/cuentas';
    if (k === 'items') return '#gastos/config/items';
    if (k === 'base') return '#gastos/config/base';
    if (k === 'reglas') return '#gastos/config/reglas';
    if (k === 'archivos') return '#gastos/config/archivos';
    if (k === 'config' && p[2] === 'obligaciones') return '#gastos/config/cuentas';
  }
  if (p[0] === 'b2b' && p[1] === 'conciliacion' && p[2] === 'reglas-abonos') return '#b2b/conciliacion/reglas';
  if (p[0] === 'finanzas' && p[1] === 'resultados' && p[2] === 'resumen') return '#finanzas/resumen';
  return null;
}

// La pantalla de la antigua Conciliación que muestra esta ruta, con su nombre de siempre:
// 'cargos' | 'sii' | 'sinbanco' | 'previred' | 'proveedores' | 'reglas' (cargos) | '' (abonos) | 'reglas-abonos'; null si no es una de ellas
export function concSub(h) {
  const p = partes(h);
  if (p[0] === 'gastos') {
    if (!p[1]) return 'cargos';
    if (['sii', 'sinbanco', 'previred', 'proveedores'].includes(p[1])) return p[1];
    if (p[1] === 'config' && p[2] === 'reglas') return 'reglas';
    return null;
  }
  if (p[0] === 'b2b' && p[1] === 'conciliacion') return p[2] === 'reglas' ? 'reglas-abonos' : '';
  return null;
}
// La ruta nueva de cada pantalla de la antigua Conciliación
export const RUTA_CONC = { cargos: '#gastos', sii: '#gastos/sii', sinbanco: '#gastos/sinbanco', previred: '#gastos/previred', proveedores: '#gastos/proveedores',
  reglas: '#gastos/config/reglas', '': '#b2b/conciliacion', abonos: '#b2b/conciliacion', 'reglas-abonos': '#b2b/conciliacion/reglas' };
export const rutaConc = sub => (sub in RUTA_CONC ? RUTA_CONC[sub] : '#gastos');

// La pantalla de Gastos abierta, con los nombres que usan sus pantallas de siempre:
// '' (Bandeja) | 'por-pagar' | 'registrar' | 'registrados' | 'analisis' | 'obligaciones' | 'clasificar' | 'items' | 'archivos' | 'base' | 'reglas'
// | 'sii' | 'sinbanco' | 'previred' | 'proveedores'; null si no es Gastos
export function subGastos(h) {
  const p = partes(h);
  if (p[0] !== 'gastos') return null;
  if (p[1] === 'config') return { '': 'obligaciones', cuentas: 'obligaciones', clasificar: 'clasificar', items: 'items', reglas: 'reglas', archivos: 'archivos', base: 'base' }[p[2] || ''] || 'obligaciones';
  return p[1] || '';
}
// La pestaña de Gastos de cada pantalla ('' = Bandeja) y la parte de Configuración
export function tabGastos(sub) {
  const s = sub || '';
  if (['', 'cargos', 'bandeja', 'sii', 'sinbanco', 'registrar'].includes(s)) return '';
  if (['por-pagar', 'registrados', 'proveedores', 'previred', 'analisis'].includes(s)) return s;
  return 'config';
}
export function parteConfig(sub) {
  return { obligaciones: 'cuentas', clasificar: 'cuentas', cuentas: 'cuentas', items: 'items', reglas: 'reglas', archivos: 'archivos', base: 'base' }[sub] || 'cuentas';
}
// La pastilla de la Bandeja
export const pastillaBandeja = sub => (sub === 'sii' || sub === 'sinbanco' ? sub : 'cargos');
// Finanzas → Resumen del mes: qué lado ('cc' cargos o 'ab' abonos)
export const ladoResumen = h => (partes(h)[2] === 'abonos' ? 'ab' : 'cc');
export const enResumen = h => { const p = partes(h); return p[0] === 'finanzas' && p[1] === 'resumen'; };
