// ═══════════════════════════════════════════════
//  Sistema Fën — Áreas: una sola lista para Gastos, Finanzas y la caja  v0.69.1 · v0.70.0 · v0.75.1
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
// v0.94.0 · Gastos nuevo: el canal B2C separado por local (para el margen de cada tienda) y sin VENTAS (se cruzaba con B2C).
// Solo lo usa el Gastos nuevo; Finanzas los junta como B2C en la Etapa 4. El Gastos anterior sigue con GASTO.
export const B2C_BA = 'B2C-BA', B2C_AI = 'B2C-AI';
export const GASTO_GN = ['PAN', 'BOL', 'PAS', 'CAF', 'ADMIN', B2C_BA, B2C_AI, 'B2B', REVENTA];
export const ANTIGUAS_GN = ['VENTAS', B2C];   // si aparecen en el Gastos nuevo, se piden pasar a su local
NOMBRE[B2C_BA] = 'Tienda Barros Arana'; NOMBRE[B2C_AI] = 'Sala de ventas Ainavillo';
export const esCanal = a => CANAL.includes(String(a || '').toUpperCase());
// Las áreas que la app puede proponer sola en un reparto (sin las que van solo a mano)
export const paraRepartir = (lista = GASTO) => (lista || []).filter(a => !SOLO_A_MANO.includes(a));
// v0.75.1 · Etapa 2b: las pestañas de la caja (fen-ventas) son estas mismas (las que producen + REVENTA); la caja ya no tiene
// su propia lista. "REV" (la pestaña antigua de reventa de la caja) es el mismo REVENTA: se lee como alias en todas partes
// (historia de la caja, resúmenes de cierre, Finanzas, caja.js). Un área desconocida o vacía es "Sin área" (nunca Bollería).
export const CAJA = [...PRODUCCION, REVENTA];
export const ALIAS = { REV: REVENTA };
export const SIN_AREA = 'SIN';
// El código de un área (acepta el alias): 'rev' → 'REVENTA', 'pan' → 'PAN'; lo demás tal cual en mayúsculas
export const codigo = a => { const u = String(a == null ? '' : a).trim().toUpperCase(); return ALIAS[u] || u; };
// El área de un producto de la caja: una de CAJA, o SIN_AREA
export const deCaja = a => { const c = codigo(a); return CAJA.includes(c) ? c : SIN_AREA; };
