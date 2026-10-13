// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos: copia de la base nueva a la planilla  v0.45.0 (etapa G2)
//  Después del cambio, cada documento hecho o cambiado en fen-gastos queda marcado
//  (planillaPendiente = true) y el script de Gastos (v2.11.0, op planilla_sync) lo escribe en la
//  planilla unos segundos después: Looker Studio y el reparto de costos de Producción la siguen leyendo.
//  Igual que Cocina (programarPlanilla / pasarPlanilla / revisarPlanilla): si falla, se reintenta solo
//  (al minuto y después cada 2 minutos). Los pasos 3 y 4 de G2 llaman programar() después de cada escritura.
// ═══════════════════════════════════════════════
import * as GB from './gastos-base.js?v=0.61.0';
import * as Gastos from './gastos.js?v=0.61.0';
import * as FB from './firebase-gastos.js?v=0.61.0';

const E = { t: 0, corriendo: false, error: '', fallos: 0, pendientes: null, ultima: null, oyentes: new Set() };
const avisar = () => E.oyentes.forEach(fn => { try { fn(estado()); } catch (e) {} });
export const alCambiar = fn => { E.oyentes.add(fn); return () => E.oyentes.delete(fn); };
export const estado = () => ({ corriendo: E.corriendo, error: E.error, pendientes: E.pendientes, ultima: E.ultima, programada: !!E.t });

// Texto para la pantalla
export function texto() {
  if (E.error) return `Planilla pendiente: ${E.error}, se reintenta sola`;
  if (E.corriendo) return 'Pasando los cambios a la planilla…';
  if (E.pendientes === null) return 'Revisando la planilla…';
  if (E.pendientes > 0) return `Hay ${E.pendientes.toLocaleString('es-CL')} ${E.pendientes === 1 ? 'cambio' : 'cambios'} por pasar`;
  return 'Planilla al día';
}

// Cuántos documentos esperan pasar a la planilla (una agregación por colección)
export async function contar() {
  const db = await GB.dbBase();
  const ns = await Promise.all(GB.COLECCIONES_PLANILLA.map(async col => {
    const r = await FB.getAggregateFromServer(FB.query(FB.collection(db, col), FB.where('planillaPendiente', '==', true)), { n: FB.count() });
    return Number(r.data().n) || 0;
  }));
  E.pendientes = ns.reduce((s, x) => s + x, 0);
  avisar();
  return E.pendientes;
}

export function programar(ms = 5000) { clearTimeout(E.t); E.t = setTimeout(pasar, ms); avisar(); }
// Al abrir: si hay algo por pasar y no hay una copia en camino, se programa
export async function revisar() {
  try { await contar(); } catch (e) { return estado(); }
  if (E.pendientes > 0 && !E.t && !E.corriendo) programar(3000);
  return estado();
}

export async function pasar() {
  clearTimeout(E.t); E.t = 0;
  if (E.corriendo) return;
  if (navigator.onLine === false) { programar(60000); return; }
  E.corriendo = true; avisar();
  let r = null;
  try {
    // El script trabaja hasta ~4,5 minutos por llamada; si queda algo (mucho por pasar), se llama de nuevo
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      r = await Gastos.planillaSync(await GB.tokenBase());
      if (!r.quedan || r.siguenPendientes || (r.errores && r.errores.length) || !r.pasados) break;
    }
    E.error = ''; E.fallos = 0;
    E.ultima = { en: new Date(), pasados: r.pasados || 0, avisos: r.avisos || [], errores: r.errores || [] };
    if (r.errores && r.errores.length) { E.error = `${r.errores.length} ${r.errores.length === 1 ? 'cambio no se pudo escribir' : 'cambios no se pudieron escribir'} (${r.errores[0].error})`; E.fallos++; }
  } catch (e) {
    E.error = (e && e.message) || String(e);
    E.fallos++;
  } finally {
    E.corriendo = false;
    try { await contar(); } catch (e) {}
    // Reintento solo: al minuto la primera vez, después cada 2 minutos. Si quedó algo (cambió mientras se copiaba), en un minuto.
    if (E.error) programar(E.fallos <= 1 ? 60000 : 120000);
    else if (E.pendientes > 0) programar(60000);
    avisar();
  }
  return r;
}
