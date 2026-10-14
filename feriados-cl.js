// Sistema Fën · v0.63.4 · Días hábiles bancarios de Chile (para cruzar transferencias con la cartola)
// NOTA: lista escrita a mano (feriados legales de Chile 2026 y 2027 + el 31 de diciembre, feriado bancario).
// Asistencia guarda sus feriados en su planilla (hoja "feriados"), no en el código, por eso van aquí.
// Hay que agregar 2028 antes de que termine 2027. Un año que falte solo hace que se salten sábados y domingos.
export const FERIADOS = new Set([
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-21', '2026-06-29', '2026-07-16',
  '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-31',
  // 2027
  '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21', '2027-06-21', '2027-06-28', '2027-07-16',
  '2027-08-15', '2027-09-18', '2027-09-19', '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08', '2027-12-25', '2027-12-31',
]);
const aFecha = f => new Date(f + 'T12:00:00Z');
const aTxt = d => d.toISOString().slice(0, 10);
export const masDias = (f, n) => { const d = aFecha(f); d.setUTCDate(d.getUTCDate() + n); return aTxt(d); };
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 864e5);
export const esHabil = f => { const w = aFecha(f).getUTCDay(); return w !== 0 && w !== 6 && !FERIADOS.has(f); };
// Días hábiles después de `desde` hasta `hasta` (incluido). Sábado → lunes = 1.
export function habilesEntre(desde, hasta) {
  let n = 0;
  for (let f = masDias(desde, 1); f <= hasta; f = masDias(f, 1)) if (esHabil(f)) n++;
  return n;
}
// Distancia de la fecha de la cartola a la de la transferencia, o null si queda fuera de la ventana:
// mismo día = 0; un día antes (la hora de la transferencia cae en otro día por la zona horaria) = 1;
// después: los días hábiles que pasan (hasta 3; sábado → lunes = 1).
export const MAX_HABILES = 3;
export function distanciaTef(fechaTef, fechaCartola) {
  if (!fechaTef || !fechaCartola) return null;
  const d = diasEntre(fechaTef, fechaCartola);
  if (d === 0) return 0;
  if (d === -1) return 1;
  if (d < 0 || d > 14) return null;
  const h = habilesEntre(fechaTef, fechaCartola);
  return h <= MAX_HABILES ? Math.max(1, h) : null;
}
