// ═══════════════════════════════════════════════
//  Sistema Fën — Plan de cuentas de gestión  v0.102.0 · reglas puras, sin red
//  La hoja de ruta (claude/hoja-de-ruta-estados-financieros.md, sección 3): cada ítem de Gastos apunta a UNA cuenta, y la cuenta dice
//  todo lo demás: en qué estado va (1-3 balance, 4-9 resultado, 10 solo gestión), en qué línea del estado de resultados y si es
//  fija o variable (para el punto de equilibrio). Así nada se clasifica dos veces.
//  · tipo: cómo la cuenta el estado de resultados de hoy (finanzas-resultados.TIPOS): costo (remuneraciones, fijo, financiero,
//    costo_venta), compra (inventario: se usa para la desviación), fuera (no es gasto del mes: va al flujo y al balance).
//  · fila: la línea propia del estado de resultados, cuando la tiene (packaging, marketing, seguros, transporte, capacitación).
//  Solo están las cuentas a las que puede apuntar un ítem de Gastos. Las demás (ventas, caja, provisiones, impuesto a la renta…)
//  llegan con su parte de la hoja de ruta.
// ═══════════════════════════════════════════════
const s = v => (v === null || v === undefined ? '' : String(v));

// Secciones del plan (el primer número del código)
export const SECCIONES = { 1: 'Activos', 2: 'Pasivos', 3: 'Patrimonio', 5: 'Costos de venta', 6: 'Gastos de operación', 7: 'Resultado financiero', 8: 'No son del giro' };
// var: variable con la venta (true) o fijo (false); solo para las cuentas del resultado
export const CUENTAS = {
  '1.3.2': { n: 'PPM pagados', tipo: 'fuera_impuestos' },
  '1.4.1': { n: 'Inventario de materias primas', tipo: 'compras_mp', ayuda: 'La compra va al inventario; al resultado va lo usado en lo vendido (recetas) y, al contar, la diferencia de inventario.' },
  '1.4.2': { n: 'Inventario de productos de reventa', tipo: 'compras_reventa', ayuda: 'Lo que se compra hecho para vender tal cual. Al resultado va el costo de lo vendido.' },
  '1.5.1': { n: 'Equipos y maquinaria', tipo: 'inversion', ayuda: 'Dura años: entra al resultado como depreciación mensual (Finanzas → Resultados → Inversiones).' },
  '1.5.2': { n: 'Muebles y habilitación de locales', tipo: 'inversion', ayuda: 'Dura años: entra al resultado como depreciación mensual.' },
  '1.5.3': { n: 'Activo intangible (marca, licencias)', tipo: 'inversion', ayuda: 'Dura años: entra al resultado repartido en su vida útil.' },
  '2.5': { n: 'Impuestos por pagar (F29)', tipo: 'fuera_impuestos' },
  '2.5.1': { n: 'IVA por pagar (F29)', tipo: 'fuera_impuestos' },
  '2.6': { n: 'Créditos bancarios (capital)', tipo: 'fuera_capital_credito' },
  '2.8': { n: 'Provisiones de los trabajadores (vacaciones y finiquitos)', tipo: 'fuera_provision', ayuda: 'Lo que se acumula cada mes para las vacaciones (con su reemplazo) y los finiquitos. Un pago que sale de aquí no es gasto del mes: ya se cargó antes.' },
  '2.9': { n: 'Deuda con el fisco (convenios TGR)', tipo: 'fuera_deuda', ayuda: 'Pagar la deuda no es gasto: baja lo que se debe. Solo sus intereses y multas son gasto (Multas e intereses, 7.3).' },
  // v0.102.0 · Las facturas de comisiones (Transbank, Mercado Pago) ya están en el margen: el margen resta la comisión como % de la venta.
  // Se registran (cuadran con Gastos y quedan para comparar lo real con lo estimado) pero no suman otra vez. El arriendo del POS sí suma.
  '5.4': { n: 'Comisiones de tarjeta y medios de pago (ya en el margen)', tipo: 'en_margen', var: true, ayuda: 'Ya se restan en el margen como % de la venta: la factura se registra, pero no suma otra vez al resultado.' },
  '5.4.2': { n: 'Arriendo del POS', tipo: 'costo_venta', var: false, ayuda: 'El arriendo mensual de la máquina: el % de comisión no lo incluye. Va con las comisiones, en el piso 1.' },
  '5.7': { n: 'Packaging', tipo: 'costo_venta', fila: 'packaging', var: true, ayuda: 'Bolsas, cajas, envases y etiquetas, por área.' },
  '6.1': { n: 'Remuneraciones', tipo: 'remuneraciones', var: false },
  '6.2': { n: 'Arriendos y patentes', tipo: 'fijo', var: false },
  '6.3': { n: 'Servicios básicos', tipo: 'fijo', var: false },
  '6.4': { n: 'Mantención y reparaciones', tipo: 'fijo', var: false },
  '6.5': { n: 'Insumos de aseo y operación', tipo: 'fijo', var: false },
  '6.6': { n: 'Contabilidad, trámites, software y suscripciones', tipo: 'fijo', var: false },
  '6.7': { n: 'Otros gastos', tipo: 'fijo', var: false },
  '6.9': { n: 'Marketing y publicidad', tipo: 'fijo', fila: 'marketing', var: false },
  '6.10': { n: 'Seguros', tipo: 'fijo', fila: 'seguros', var: false },
  '6.11': { n: 'Transporte y movilización', tipo: 'fijo', fila: 'transporte', var: false, ayuda: 'Combustible, fletes y traslados por compras. Con área B2B va al canal B2B.' },
  '6.12': { n: 'Capacitación, uniformes y elementos de seguridad', tipo: 'fijo', fila: 'capacitacion', var: false },
  '7.1': { n: 'Intereses de créditos', tipo: 'financiero', var: false },
  '7.2': { n: 'Comisiones y mantención bancaria', tipo: 'financiero', var: false },
  '7.3': { n: 'Multas e intereses (Previred, F29, mora)', tipo: 'financiero', var: false }
};
// Orden del plan (para los selectores)
const orden = c => c.split('.').map(n => n.padStart(3, '0')).join('.');
export const CODIGOS = Object.keys(CUENTAS).sort((a, b) => orden(a).localeCompare(orden(b)));
export const existe = c => !!CUENTAS[s(c)];
export const nombre = c => (CUENTAS[s(c)] ? CUENTAS[s(c)].n : '');
export const texto = c => (CUENTAS[s(c)] ? `${c} ${CUENTAS[s(c)].n}` : 'Sin cuenta');
export const tipoDeCuenta = c => (CUENTAS[s(c)] ? CUENTAS[s(c)].tipo : '');
export const filaDeCuenta = c => (CUENTAS[s(c)] && CUENTAS[s(c)].fila) || '';
export const seccion = c => SECCIONES[Number(s(c).split('.')[0])] || '';
// Dónde queda en los estados, en palabras (para la ficha del ítem y la vista previa)
export function dondeVa(c) {
  const x = CUENTAS[s(c)]; if (!x) return 'No entra al estado de resultados hasta que tenga cuenta';
  const n = Number(s(c).split('.')[0]);
  if (x.tipo === 'compras_mp' || x.tipo === 'compras_reventa') return 'Inventario: al resultado va como costo de lo vendido';
  if (x.tipo === 'inversion') return 'Activo fijo: al resultado va como depreciación';
  if (n <= 3) return 'Balance y flujo de caja: no es gasto del mes';
  if (x.tipo === 'en_margen') return 'Ya en el margen (comisión estimada): no suma otra vez';
  if (x.fila === 'packaging') return 'Resultado · piso 1: packaging, en su área';
  if (x.tipo === 'costo_venta') return 'Resultado · piso 1: comisiones y despacho';
  if (x.fila) return `Resultado · gastos fijos del área; con área común, en su línea (${x.n.toLowerCase()})`;
  if (x.tipo === 'remuneraciones') return 'Resultado · remuneraciones (del área o comunes)';
  if (x.tipo === 'fijo') return 'Resultado · gastos fijos (del área o comunes)';
  if (x.tipo === 'financiero') return 'Resultado · financieros';
  return '';
}
