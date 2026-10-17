// ═══════════════════════════════════════════════
//  Sistema Fën — Áreas: una sola lista para Gastos y Finanzas  v0.69.1
//  Antes cada módulo tenía su copia (gastos-g2.js, app.js, finanzas-ventas.js, finanzas-resultados.js, finanzas-eerr.js).
//  Ahora todas salen de aquí. Sin red ni pantalla: se prueba sola.
//
//  Dos ejes (finanzas-plan.md, sección 1): el ÁREA (quién produce o de quién es el margen) y el CANAL (dónde se vende:
//  caja Barros Arana, caja Ainavillo, B2B).
//   · PRODUCCION: las que producen (recetas, bodegas, jefas, Cocina). REVENTA no está aquí: nunca llega a Cocina ni a Producción.
//   · MARGEN: las que tienen margen de contribución (columnas del estado de resultados, Márgenes): las de producción + REVENTA.
//   · GASTO: los códigos de área de Gastos (ítems, gastos, Registrar, cartola, abonos, Previred).
//   · SOLO_A_MANO: no entran en un reparto que la app arma sola (prorrateo por defecto, "Agregar área", comunes repartidos
//     por causa). Se pueden elegir a mano.
// ═══════════════════════════════════════════════
export const REVENTA = 'REVENTA';
export const PRODUCCION = ['PAN', 'BOL', 'PAS', 'CAF'];
export const MARGEN = [...PRODUCCION, REVENTA];
// v0.63.1: B2B (costos del canal B2B: atención de clientes, órdenes y despacho) · v0.69.1: REVENTA (lo que se compra hecho)
export const GASTO = ['BOL', 'PAN', 'CAF', 'PAS', 'ADMIN', 'VENTAS', 'B2B', REVENTA];
export const NOMBRE = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', REVENTA: 'Reventa', ADMIN: 'Administración', VENTAS: 'Ventas', B2B: 'Canal B2B' };
export const SOLO_A_MANO = [REVENTA];
// Las áreas que la app puede proponer sola en un reparto (sin las que van solo a mano)
export const paraRepartir = (lista = GASTO) => (lista || []).filter(a => !SOLO_A_MANO.includes(a));
