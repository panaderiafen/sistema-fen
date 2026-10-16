// ═══════════════════════════════════════════════════════════════════════════
//  fën · Fermentación en bloque (sin pantalla)  ·  Cocina v0.17.1 · Sistema Fën v0.65.3
//  Copia exacta en las dos apps (cocina/fermentacion.js y sistema-fen/fermentacion.js).
//  config/{AREA}.fermentacionBloque = { recetaId | subId: minutos } (lo escribe Sistema Fën → Configuración de Producción).
//  Sin número (o null / 0) = esa receta no tiene fermentación en bloque.
//  La f.b. parte cuando se marca terminada la masa (hechos[clave].en) y dura esos minutos a temperatura ambiente.
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_MIN = 48 * 60;

// "2:00", "02:00", "0:45", "2" (horas) → minutos. Vacío → { ok: true, min: null } (sin f.b.). 0:00 = sin f.b.
export function leerHHMM(txt) {
  const t = String(txt === null || txt === undefined ? '' : txt).trim();
  if (!t) return { ok: true, min: null };
  const m = /^(\d{1,2})(?:\s*[:.h]\s*(\d{1,2}))?\s*(?:h|hrs?)?$/i.exec(t);
  if (!m) return { ok: false };
  const h = Number(m[1]), mm = m[2] === undefined ? 0 : Number(m[2]);
  if (m[2] !== undefined && m[2].length !== 2) return { ok: false };
  if (mm > 59) return { ok: false };
  const min = h * 60 + mm;
  if (min > MAX_MIN) return { ok: false };
  return { ok: true, min: min > 0 ? min : null };
}

// 120 → "2:00"; 45 → "0:45"; nada → ''
export function aHHMM(min) {
  const n = Math.round(Number(min));
  if (!(n > 0)) return '';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

const dos = n => String(n).padStart(2, '0');
// Hora local "HH:MM" de un instante (ms o ISO)
export function hora(x) {
  const d = new Date(typeof x === 'number' ? x : String(x || ''));
  if (isNaN(d.getTime())) return '';
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
const diaLocal = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

// Minutos de f.b. de una receta: el primero de los ids que tenga un número > 0
export function minutosFB(cfg, ids) {
  const fb = cfg && cfg.fermentacionBloque;
  if (!fb || typeof fb !== 'object') return null;
  for (const id of ids || []) { const v = Number(fb[id]); if (id && v > 0 && v <= MAX_MIN) return Math.round(v); }
  return null;
}

// Desde que se terminó (ISO) + minutos → { fin (ms), hasta: "HH:MM", diaSiguiente, lista (si se da 'ahora') }
export function estadoFB(enIso, min, ahora) {
  const ini = new Date(String(enIso || ''));
  if (isNaN(ini.getTime()) || !(Number(min) > 0)) return null;
  const fin = ini.getTime() + Math.round(Number(min)) * 60000, dFin = new Date(fin);
  const otroDia = diaLocal(dFin) !== diaLocal(ini);
  return { fin, hasta: hora(fin), diaSiguiente: otroDia, lista: typeof ahora === 'number' ? ahora >= fin : false };
}

// "Ana María Rojas" → "Ana"
export function nombreCorto(nombre) { return String(nombre || '').trim().split(/\s+/)[0] || ''; }

// "a las 13:00" / "a la 01:00" (la una)
const artHora = hhmm => (/^01:/.test(hhmm) ? 'la ' : 'las ') + hhmm;

// La línea de lo terminado: "Hecho · Ana 11:00", "… · f.b. hasta 13:00", "… · f.b. lista desde las 13:00".
// ahora: ms (solo el día de hoy: decide "lista"); null = otro día (solo las horas).
export function lineaHecho(h, min, ahora = null) {
  if (!h || !h.por) return null;
  const base = `Hecho · ${nombreCorto(h.por)} ${hora(h.en)}`.trim();
  const e = estadoFB(h.en, min, typeof ahora === 'number' ? ahora : undefined);
  if (!e) return { texto: base, fb: null, lista: false };
  const sig = e.diaSiguiente ? ' (día siguiente)' : '';
  const lista = typeof ahora === 'number' && e.lista;
  return { texto: `${base} · ${lista ? `f.b. lista desde ${artHora(e.hasta)}` : `f.b. hasta ${e.hasta}`}${sig}`, fb: e, lista };
}
