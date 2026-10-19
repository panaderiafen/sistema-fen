// ═══════════════════════════════════════════════
//  Sistema Fën — Áreas: una sola lista para Gastos y Finanzas  v0.69.1 · v0.70.0
//  Antes cada módulo tenía su copia (gastos-g2.js, app.js, finanzas-ventas.js, finanzas-resultados.js, finanzas-eerr.js).
//  Ahora todas salen de aquí. Sin red ni pantalla: se prueba sola.
//
//  Dos ejes (finanzas-plan.md, sección 1): el ÁREA (quién produce o de quién es el margen) y el CANAL (dónde se vende:
//  caja Barros Arana, caja Ainavillo, B2B).
//   · PRODUCCION: las que producen (recetas, bodegas, jefas, Cocina). REVENTA no está aquí: nunca llega a Cocina ni a Producción.
//   · MARGEN: las que tienen margen de contribución (columnas del estado de resultados, Márgenes): las de producción + REVENTA.
//   · GASTO: los códigos de área de Gastos (ítems, gastos, Registrar, cartola, abonos, Previred).
//   · CANAL: los códigos de costo de canal (lo que cuesta atender a los clientes de ese canal). No son áreas que producen ni de
//     margen: en el estado de resultados van como B2B hoy (Común, con su nota de costo de canal).
//     v0.63.1: B2B (atención de clientes B2B, órdenes y despacho). v0.70.0: B2C (lo que cuesta atender a los clientes de las
//     tiendas: la parte de luz, agua, cajeras… que es de la venta y no de la producción; base para el costo de adquirir clientes).
//   · SOLO_A_MANO: no entran en un reparto que la app arma sola (prorrateo por defecto, "Agregar área", comunes repartidos
//     por causa). Se pueden elegir a mano.
// ═══════════════════════════════════════════════
export const REVENTA = 'REVENTA';
export const B2C = 'B2C';
export const PRODUCCION = ['PAN', 'BOL', 'PAS', 'CAF'];
export const MARGEN = [...PRODUCCION, REVENTA];
export const CANAL = ['B2B', B2C];
// v0.63.1: B2B (costos del canal B2B: atención de clientes, órdenes y despacho) · v0.69.1: REVENTA (lo que se compra hecho)
// v0.70.0: B2C (costos del canal B2C: atención de los clientes de las tiendas)
export const GASTO = ['BOL', 'PAN', 'CAF', 'PAS', 'ADMIN', 'VENTAS', 'B2B', B2C, REVENTA];
export const NOMBRE = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', REVENTA: 'Reventa', ADMIN: 'Administración', VENTAS: 'Ventas', B2B: 'Canal B2B', B2C: 'Canal B2C' };
export const SOLO_A_MANO = [REVENTA, B2C];
export const esCanal = a => CANAL.includes(String(a || '').toUpperCase());
// Las áreas que la app puede proponer sola en un reparto (sin las que van solo a mano)
export const paraRepartir = (lista = GASTO) => (lista || []).filter(a => !SOLO_A_MANO.includes(a));
