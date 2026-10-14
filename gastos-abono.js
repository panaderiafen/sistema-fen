// ═══════════════════════════════════════════════
//  Sistema Fën — Área de cada abono (obligaciones libres: sueldos líquidos)  v0.63.1 (reglas puras, sin red)
//  Antes, cada abono tomaba el área (o el reparto) de la obligación: el sueldo de UNA persona abonado a
//  "REMUNERACION LIQUIDO" quedaba repartido entre áreas. Ahora cada abono lleva su propia área o reparto en %.
//  · claveDestinatario: a quién va el abono. Con la cartola, el RUT o la glosa del cargo (la misma clave de lo
//    aprendido: claveDe); a mano, el texto "Para quién". Id del documento en abono_destinatarios.
//  · trabajadorDe: el trabajador de Previred (cotiz_trabajadores) por RUT o por nombre (al menos 2 palabras del
//    nombre en el texto, y uno solo).
//  · areasPorDefecto: (a) lo recordado para ese destinatario, (b) el área de Previred del trabajador,
//    (c) el área o el reparto de la obligación.
//  · validarAreas / vistaConAreas: el reparto elegido (en %, suma 100) y las líneas del gasto (montos que suman exacto).
// ═══════════════════════════════════════════════
import { claveDe, norm, rutNorm } from './gastos-cartola.js?v=0.63.6';

const s = v => String(v == null ? '' : v);
const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const x = Number(s(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return isFinite(x) ? x : 0; };
export const MAX_AREAS = 4;
export const FUENTES = { recordado: 'Recordado para este destinatario', previred: 'Área de Previred', obligacion: 'Área de la obligación', elegido: 'Elegido' };

// ── Clave del destinatario ──
// x = { rut, descripcion, nombre }. Devuelve { clave, id, nombre } o null si no hay nada con qué reconocerlo.
export function claveDestinatario(x) {
  const o = x || {}, rut = rutNorm(o.rut), desc = s(o.descripcion).trim(), nom = norm(o.nombre);
  let clave = '';
  if (rut.length >= 7) clave = 'rut:' + rut;
  else if (desc) clave = claveDe(desc);
  else if (nom.length >= 3) clave = 'nom:' + nom.slice(0, 80);
  if (!clave || clave === 'txt:') return null;
  return { clave, id: idDestinatario(clave), nombre: s(o.nombre).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80).replace(/^[=+\-@\s]+/, '') };
}
// Id de Firestore (sin "/" ni puntos): "ad-rut-12345678K", "ad-txt-TRANSF_A_LUCIA_VELASQUEZ"
export const idDestinatario = clave => 'ad-' + s(clave).replace(':', '-').replace(/[^A-Za-z0-9#-]/g, '_').replace(/#/g, 'N').slice(0, 140);

// Lo recordado para un destinatario: por su clave; si no, por el mismo nombre (lo recordado desde la cartola
// sirve para el abono a mano "Para quién", y al revés)
export function recordadoDe(lista, dest, nombre) {
  const L = Array.isArray(lista) ? lista : [];
  const r = dest ? L.find(x => x && x.clave === dest.clave) : null;
  if (r) return r;
  const n = norm(nombre);
  return n.length >= 3 ? L.find(x => x && norm(x.nombre) === n) || null : null;
}

// ── Trabajador de Previred ──
// trabajadores: [{ rut, nombre, area }] (cotiz_trabajadores). texto: glosa del cargo o "Para quién".
const palabras = t => norm(t).split(' ').filter(w => w.length >= 3);
export function trabajadorDe(trabajadores, texto, rut) {
  const L = (trabajadores || []).filter(t => t && s(t.area));
  const r = rutNorm(rut);
  if (r) { const t = L.find(x => rutNorm(x.rut) === r); if (t) return t; }
  const w = new Set(palabras(texto));
  if (w.size < 2) return null;
  let mejor = null, n = 0, empate = false;
  L.forEach(t => {
    const p = palabras(t.nombre); if (p.length < 2) return;
    const k = p.filter(x => w.has(x)).length;
    if (k < 2) return;
    if (k > n) { mejor = t; n = k; empate = false; } else if (k === n) empate = true;
  });
  return empate ? null : mejor;
}

// ── Área de la obligación como reparto en % ──
// v: vencimiento (vistaVencimiento o vencimientosAbiertos): area, pArea1..3/pPct1..3, multiArea [{ area, monto }]
export function areasDeObligacion(v) {
  const x = v || {};
  if (x.area === 'PRORRATEADO' && x.pArea1) {
    const l = [1, 2, 3].map(k => ({ area: s(x['pArea' + k]), pct: Math.round(num(x['pPct' + k])) })).filter(a => a.area && a.pct > 0);
    if (l.length) return l;
  }
  const ma = Array.isArray(x.multiArea) ? x.multiArea : [];
  if (ma.length) {
    const tot = ma.reduce((t, a) => t + num(a.monto), 0);
    if (tot > 0) {
      let resto = 100;
      const l = ma.map((a, i) => { const p = i === ma.length - 1 ? resto : Math.round(num(a.monto) * 100 / tot); resto -= p; return { area: s(a.area), pct: p }; }).filter(a => a.area && a.pct > 0);
      if (l.length) return l;
    }
  }
  return x.area && !['PRORRATEADO', 'MULTI', 'SELECCIONAR'].includes(x.area) ? [{ area: s(x.area), pct: 100 }] : [];
}

// ── Orden por defecto: recordado → Previred → obligación ──
// recordado: el documento de abono_destinatarios (o null); trabajador: el de trabajadorDe (o null); v: el vencimiento
export function areasPorDefecto({ recordado, trabajador, v, areas }) {
  const ok = l => (areas ? l.every(a => areas.includes(a.area)) : true);
  const rec = recordado && Array.isArray(recordado.areas) ? recordado.areas.map(a => ({ area: s(a.area), pct: Math.round(num(a.pct)) })) : [];
  if (rec.length && !validarAreas(rec, areas).error && ok(rec)) return { areas: rec, fuente: 'recordado', texto: FUENTES.recordado + (recordado.nombre ? ` (${recordado.nombre})` : '') };
  if (trabajador && s(trabajador.area) && (!areas || areas.includes(s(trabajador.area)))) return { areas: [{ area: s(trabajador.area), pct: 100 }], fuente: 'previred', texto: `${FUENTES.previred}: ${s(trabajador.nombre)}` };
  const ob = areasDeObligacion(v);
  return { areas: ob, fuente: 'obligacion', texto: FUENTES.obligacion };
}

// ── Reparto elegido: áreas distintas, % enteros mayores que 0 que suman 100 ──
export function validarAreas(lista, areas) {
  const l = (Array.isArray(lista) ? lista : []).map(a => ({ area: s(a && a.area).trim().toUpperCase(), pct: num(a && a.pct) })).filter(a => a.area || a.pct);
  if (!l.length) return { error: 'Elige el área de este abono' };
  if (l.length > MAX_AREAS) return { error: `Hasta ${MAX_AREAS} áreas por abono` };
  if (l.some(a => !a.area)) return { error: 'Elige el área de cada parte' };
  if (areas && l.some(a => !areas.includes(a.area))) return { error: 'Área no válida' };
  if (new Set(l.map(a => a.area)).size !== l.length) return { error: 'Cada área va una sola vez' };
  if (l.some(a => !(a.pct > 0) || Math.round(a.pct) !== a.pct)) return { error: 'Los % van en números enteros mayores que 0' };
  const t = l.reduce((x, a) => x + a.pct, 0);
  if (t !== 100) return { error: `Los % deben sumar 100 (suman ${t})` };
  return { areas: l };
}
// El vencimiento como lo usa lineasPago, con las áreas del abono: una sola área, o multiArea con montos que suman exacto
export function vistaConAreas(v, areas, monto) {
  const m = Math.round(num(monto));
  if (areas.length === 1) return { ...v, area: areas[0].area, multiArea: [], pArea1: '', pPct1: '', pArea2: '', pPct2: '', pArea3: '', pPct3: '' };
  let resto = m;
  const ma = areas.map((a, i) => { const x = i === areas.length - 1 ? resto : Math.round(m * a.pct / 100); resto -= x; return { area: a.area, monto: x }; });
  return { ...v, area: 'MULTI', multiArea: ma, pArea1: '', pPct1: '', pArea2: '', pPct2: '', pArea3: '', pPct3: '' };
}
export const textoAreas = l => (Array.isArray(l) ? l : []).map(a => (l.length === 1 ? a.area : `${a.area} ${a.pct}%`)).join(' · ');
export const iguales = (a, b) => JSON.stringify((a || []).map(x => [x.area, Number(x.pct)])) === JSON.stringify((b || []).map(x => [x.area, Number(x.pct)]));
