// ═══════════════════════════════════════════════
//  Sistema Fën — Cartola: los cargos del banco contra Gastos  v0.18.0
//  La misma cartola que se sube en B2B → Conciliación (los abonos) trae los
//  cargos: aquí se dice qué es cada uno (paga vencimientos, ya estaba en
//  Gastos, gasto nuevo o no es gasto). Lo guarda el script de Gastos v2.8.0
//  (hojas "Cartola Cargos", "Cartolas" y "Cartola Reglas").
//  Las propuestas se calculan aquí, cada vez, con lo que está por pagar en ese momento.
// ═══════════════════════════════════════════════
import * as Gastos from './gastos.js?v=0.28.4';

export const VERSION_CARTOLA = '2.8.0';
const op = (o, d, idem) => Gastos.llamar(o, d, idem, VERSION_CARTOLA);

let cache = null;
export async function lista(forzar, dias = 60) {
  if (!forzar && cache && cache.dias === dias && Date.now() - cache.t < 60000) return cache.d;
  const d = await op('cc_lista', { dias });
  cache = { t: Date.now(), d, dias };
  return d;
}
export const olvidar = () => { cache = null; };

// Los cargos de la cartola leída (b2b.leerCartola) se suben de a 1500
export async function cargar(cartola, idemBase) {
  const cargos = cartola.filas.filter(f => f.cargos > 0).map(f => ({ fecha: f.fecha, descripcion: f.descripcion, monto: f.cargos, saldo: f.saldo, operacion: f.operacion || '' }));
  const meta = { id: cartola.identificador, tipo: cartola.tipo, cuenta: (cartola.cuenta && cartola.cuenta.tipo) || 'chequera', numero: (cartola.cuenta && cartola.cuenta.numero) || '', nCartola: cartola.nCartola || '', desde: cartola.desde || '', hasta: cartola.hasta || '' };
  const r = { cargos: 0, nuevos: 0, yaVistos: 0, ignorados: 0 };
  for (let i = 0; i < Math.max(1, cargos.length); i += 1500) {
    const x = await op('cc_cargar', { cartola: meta, cargos: cargos.slice(i, i + 1500), parte: i / 1500 }, `${idemBase}-${i}`);
    ['cargos', 'nuevos', 'yaVistos', 'ignorados'].forEach(k => { r[k] += x[k] || 0; });
  }
  olvidar(); Gastos.olvidar();
  return r;
}
export async function resolver(d, idem) { const r = await op('cc_resolver', d, idem); olvidar(); Gastos.olvidarTodo(); return r; }
export async function deshacer(id, motivo, idem) { const r = await op('cc_deshacer', { id, motivo }, idem); olvidar(); Gastos.olvidarTodo(); return r; }
export async function quitarRegla(clave) { const r = await op('cc_quitar_regla', { clave }); olvidar(); return r; }

// ── Propuestas ──
const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const dias = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
// Vencimientos de la misma factura/proveedor que suman exacto el cargo: primero los más antiguos seguidos;
// si no, la combinación (de hasta 12) que calza, prefiriendo las más antiguas.
export function combinacion(vencs, monto) {
  const l = vencs.filter(v => v.monto > 0).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(0, 12);
  let s = 0;
  for (let i = 0; i < l.length; i++) { s += l[i].monto; if (s === monto) return l.slice(0, i + 1); if (s > monto) break; }
  let mejor = null;
  for (let m = 1; m < (1 << l.length); m++) {
    let t = 0; const el = [];
    for (let i = 0; i < l.length; i++) if (m & (1 << i)) { t += l[i].monto; el.push(i); }
    if (t !== monto) continue;
    const clave = el.join(',');
    if (!mejor || el.length < mejor.el.length || (el.length === mejor.el.length && clave < mejor.clave)) mejor = { el, clave };
  }
  return mejor ? mejor.el.map(i => l[i]) : null;
}
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fCorta = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${Number(m[3])} ${MESES_C[Number(m[2]) - 1]}` : (f || ''); };
const pagosDe = l => l.map(v => ({ id: v.id, monto: v.monto }));
const nombresV = l => l.map(v => v.nombre).join(' + ');

// Para un cargo: qué parece ser. seguro = va a "Listos para confirmar".
export function proponer(c, d) {
  const reglas = {}; (d.reglas || []).forEach(r => { reglas[r.clave] = r; });
  const regla = reglas[c.clave];
  const vencs = (d.vencimientos || []);
  const cerca = (v, antes = 60, despues = 20) => !v.fecha || (dias(c.fecha, v.fecha) <= antes && dias(v.fecha, c.fecha) <= despues);
  // 1) Lo aprendido
  if (regla && regla.accion === 'ignorar') return { tipo: 'ignorar', seguro: true, motivo: regla.ejemplo || 'No es gasto', por: 'aprendido' };
  if (regla && regla.accion === 'vencimiento') {
    const [t, val] = [regla.vencimiento.slice(0, 2), regla.vencimiento.slice(2)];
    const cand = vencs.filter(v => (t === 'p:' ? v.plantillaId === val : t === 'rut:' ? v.rut === val : norm(v.razon || v.nombre).startsWith(val)));
    if (t === 'p:' && cand.length) {
      const v = cand.slice().sort((a, b) => Math.abs(dias(a.fecha, c.fecha)) - Math.abs(dias(b.fecha, c.fecha)))[0];
      // Seguro solo si el monto se parece a lo estimado (±15%): una descripción genérica puede ser de otra cosa
      if (cerca(v, 45, 25)) return { tipo: 'vencimientos', seguro: !v.monto || Math.abs(c.monto - v.monto) <= v.monto * 0.15, pagos: [{ id: v.id, monto: c.monto }], texto: v.nombre + (v.monto && v.monto !== c.monto ? ` (estimado ${v.monto.toLocaleString('es-CL')})` : ''), por: 'aprendido' };
    }
    const comb = combinacion(cand, c.monto);
    if (comb) return { tipo: 'vencimientos', seguro: true, pagos: pagosDe(comb), texto: nombresV(comb), por: 'aprendido' };
  }
  // 2) El RUT de la transferencia: facturas de ese proveedor
  if (c.rut) {
    const cand = vencs.filter(v => v.rut === c.rut), comb = combinacion(cand, c.monto);
    if (comb) return { tipo: 'vencimientos', seguro: true, pagos: pagosDe(comb), texto: nombresV(comb), por: 'rut' };
  }
  // 3) Un gasto al contado ya registrado, del mismo monto y de esos días
  const gs = (d.gastos || []).filter(g => Math.abs(g.monto - c.monto) <= g.filas.length && dias(c.fecha, g.fecha) >= -3 && dias(c.fecha, g.fecha) <= 10 && (!c.rut || !g.rut || g.rut === c.rut));
  if (gs.length === 1 && (c.rut ? gs[0].rut === c.rut : true)) return { tipo: 'gasto', seguro: !!(c.rut && gs[0].rut === c.rut), gasto: gs[0], texto: `${gs[0].items.join(' + ')} del ${fCorta(gs[0].fecha)}`, por: 'monto' };
  // 4) Lo aprendido como gasto nuevo
  // Gasto nuevo aprendido: seguro si ya se confirmó así más de una vez y el monto se parece al último (±50%)
  if (regla && regla.accion === 'gasto') return { tipo: 'nuevo', seguro: regla.veces >= 2 && (!regla.monto || Math.abs(c.monto - regla.monto) <= regla.monto * 0.5), item: regla.item, area: regla.area, sinFactura: !!regla.sinFactura, texto: regla.item, por: 'aprendido' };
  // 5) Un vencimiento por pagar con el monto exacto (sin nada más que lo confirme: a revisar)
  const ex = vencs.filter(v => v.monto === c.monto && cerca(v));
  if (ex.length === 1) return { tipo: 'vencimientos', seguro: false, pagos: [{ id: ex[0].id, monto: c.monto }], texto: ex[0].nombre, por: 'monto' };
  if (gs.length) return { tipo: 'gasto', seguro: false, gasto: gs[0], texto: `${gs[0].items.join(' + ')} del ${fCorta(gs[0].fecha)}`, por: 'monto' };
  return null;
}

// Facturas del SII por pagar cuyo vencimiento ya está cubierto por las cartolas subidas (deberían aparecer como cargo)
export function facturasSinPago(vencs, hastaRevisado) {
  if (!hastaRevisado) return [];
  return (vencs || []).filter(v => v.folio && v.razon && v.fecha && v.fecha <= hastaRevisado).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
// Hasta dónde están subidas las cartolas de cada cuenta (las cuentas que aparecen en la lista)
export function coberturaPorCuenta(cartolas, cobertura) {
  const out = {};
  (cartolas || []).forEach(c => { (out[c.cuenta] = out[c.cuenta] || []).push(c); });
  Object.keys(out).forEach(k => { out[k] = { ...cobertura(out[k]), cuentaN: (out[k].find(x => x.cuentaN) || {}).cuentaN || '' }; });
  return out;
}
