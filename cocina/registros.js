// ═══════════════════════════════════════════════
//  fën · Cocina — merma (las cuatro áreas) y bitácora de turno de Cafetería (sin pantalla)  v0.11.0
//
//  Se guarda en el día del área (dias/{AREA}_{fecha}), sin precios (las jefas no ven costos):
//  · merma = { id: { tipo: 'receta'|'mp', item, nombre, sub, cantidad, unidad: 'un'|'g'|'ml',
//                    motivo, nota, congelado (Bollería), congeladoDe: 'masa'|'producto', por, en, anulado } }
//  · turno = { id: { tipo: 'calibracion'|'merma'|'prueba_receta', shots, gPorShot, gramos, nota,
//                    barista: { email, nombre }, por, en, anulado } }      (solo Cafetería)
//  · registrosPendientes = true → el script copia a "Registro_merma" y "CAF_registros" (sin duplicar).
//  Nada se borra: se anula. Sistema Fën valoriza la merma con los costos de la planilla.
// ═══════════════════════════════════════════════
import * as M from './modelo.js?v=0.11.0';

export const MOTIVOS = {
  derrame_error: 'Derrame o error', quemado: 'Quemado o mal horneado', vencimiento: 'Vencimiento',
  devolucion_cliente: 'Devolución de cliente', prueba_receta: 'Prueba de receta', otro: 'Otro'
};
export const TIPOS_CAF = { calibracion: 'Calibración', merma: 'Café botado', prueba_receta: 'Prueba de receta' };
export const GRAMOS_SHOT = 14;   // si Cafetería no tiene "gramos por shot" en su configuración (como la app actual)

// Unidad en que se anota: recetas en unidades o gramos (según rinden); materias primas según su unidad de compra
export function unidadDe(tipo, x) {
  if (!x) return 'un';
  if (tipo === 'receta') return x.unidad === 'g' ? 'g' : 'un';
  const u = String(x.unidad || 'kg').toLowerCase().trim().replace(/^[\d.,\s]+/, '');   // "10un", "25kg", "5lt": cuenta la unidad, no el número
  if (/^(un|unidad|u\b|pieza|caja|bolsa|paquete)/.test(u)) return 'un';
  if (/^(l|lt|litro|ml|cc)/.test(u)) return 'ml';
  return 'g';
}
export const textoUnidad = (u, n) => u === 'g' ? 'g' : u === 'ml' ? 'ml' : (M.num(n) === 1 ? 'unidad' : 'unidades');
export const cantidadTexto = (n, u) => u === 'g' ? M.gramos(n) : u === 'ml' ? (M.num(n) >= 1000 ? M.unidades(M.num(n) / 1000) + ' l' : M.miles(n) + ' ml') : `${M.unidades(n)} ${textoUnidad(u, n)}`;

// Período: { desde, hasta } (fechas AAAA-MM-DD, incluidas)
export function periodo(clave, hoy = M.hoyTxt()) {
  if (clave === 'hoy') return { desde: hoy, hasta: hoy };
  if (clave === 'semana') return { desde: M.lunesDe(hoy), hasta: M.sumarDias(M.lunesDe(hoy), 6) };
  if (clave === 'semana_ant') { const l = M.sumarDias(M.lunesDe(hoy), -7); return { desde: l, hasta: M.sumarDias(l, 6) }; }
  if (clave === 'mes') { const d = hoy.slice(0, 8) + '01'; return { desde: d, hasta: finDeMes(d) }; }
  if (clave === 'mes_ant') { const ini = M.sumarDias(hoy.slice(0, 8) + '01', -1).slice(0, 8) + '01'; return { desde: ini, hasta: finDeMes(ini) }; }
  return { desde: '0000-00-00', hasta: '9999-12-31' };
}
function finDeMes(primero) { const y = Number(primero.slice(0, 4)), m = Number(primero.slice(5, 7)); return M.sumarDias(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1); }

// Anotaciones de un período, de los días del área: [{ ...a, id, fecha }] ordenadas (la más nueva primero)
export function delPeriodo(diasDocs, campo, { desde, hasta }, conAnuladas = true) {
  const out = [];
  Object.entries(diasDocs || {}).forEach(([f, d]) => {
    if (f < desde || f > hasta) return;
    Object.entries((d && d[campo]) || {}).forEach(([id, a]) => { if (a && (conAnuladas || !a.anulado)) out.push({ ...a, id, fecha: f }); });
  });
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.en || '').localeCompare(String(a.en || '')));
}

// Merma de un período, sumada por ítem (sin anuladas): [{ clave, tipo, item, nombre, unidad, cantidad, veces }]
export function resumenMerma(lista) {
  const r = {};
  lista.filter(a => !a.anulado).forEach(a => {
    const k = (a.tipo === 'mp' ? 'mp' : 'receta') + ':' + a.item + ':' + a.unidad;
    const x = r[k] || (r[k] = { clave: k, tipo: a.tipo === 'mp' ? 'mp' : 'receta', item: a.item, nombre: a.nombre, unidad: a.unidad, cantidad: 0, veces: 0 });
    x.cantidad += M.num(a.cantidad); x.veces++;
  });
  return Object.values(r).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Bitácora de café: gramos totales por tipo (sin anuladas)
export function totalesCafe(lista) {
  const t = { calibracion: 0, merma: 0, prueba_receta: 0, total: 0, shots: 0 };
  lista.filter(a => !a.anulado).forEach(a => {
    const g = M.num(a.gramos);
    if (a.tipo in t) t[a.tipo] += g;
    t.total += g;
    if (a.tipo === 'calibracion') t.shots += M.num(a.shots);
  });
  return t;
}
export const gramosCafe = (tipo, shots, gPorShot, gramos) => tipo === 'calibracion' ? Math.round(M.num(shots) * M.num(gPorShot) * 10) / 10 : Math.round(M.num(gramos) * 10) / 10;
