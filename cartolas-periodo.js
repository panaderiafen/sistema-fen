// ═══════════════════════════════════════════════════════════════════════
//  Sistema Fën — Cartolas por período  v0.127.2 (aprobado por Emmanuel el 13 nov, boceto "Cartolas por período")
//  Las cartolas de la misma cuenta cuyas fechas caben dentro de otra que manda se muestran dentro de ella, plegadas:
//   · manda la histórica (la oficial del banco) sobre las en línea que caben completas en sus fechas;
//   · entre en línea, manda la más nueva sobre las anteriores que caben en sus fechas (trae todo lo de ellas).
//  Una histórica nunca queda dentro de otra cartola. Nada se borra: solo se agrupa para mostrar. Puro, sin Firebase.
// ═══════════════════════════════════════════════════════════════════════
const s = v => (v == null ? '' : String(v));
export const esHistorica = ident => /hist[oó]rica/i.test(s(ident));
export const esEnLinea = ident => /en l[ií]nea/i.test(s(ident));

// a: { clave, desde, hasta, hist, en }. ¿b manda sobre a (a cabe en b)?
export function mandaSobre(b, a) {
  if (!a || !b || a === b || s(a.clave) !== s(b.clave)) return false;
  if (!(s(b.desde) <= s(a.desde) && s(a.hasta) <= s(b.hasta))) return false;
  if (a.hist) return false;
  if (b.hist) return true;
  return s(b.en) > s(a.en);
}
const mejor = (x, y) => (x.hist !== y.hist ? (x.hist ? x : y) : s(x.hasta) !== s(y.hasta) ? (s(x.hasta) > s(y.hasta) ? x : y) : s(x.en) >= s(y.en) ? x : y);

// lista: [{ clave, desde, hasta, hist, en, ... }] → [{ item, dentro: [item…] }] (las que mandan, con las que quedaron dentro, más nueva primero)
export function agruparPorPeriodo(lista) {
  const l = (lista || []).filter(Boolean), padre = new Map();
  l.forEach(a => { let p = null; l.forEach(b => { if (mandaSobre(b, a)) p = p ? mejor(p, b) : b; }); if (p) padre.set(a, p); });
  const raiz = a => { let x = a, n = 0; while (padre.has(x) && n++ < 50) x = padre.get(x); return x; };
  const grupos = new Map();
  l.forEach(a => { const r = raiz(a); if (!grupos.has(r)) grupos.set(r, []); if (r !== a) grupos.get(r).push(a); });
  return [...grupos.entries()].map(([item, dentro]) => ({ item, dentro: dentro.sort((x, y) => s(y.en).localeCompare(s(x.en))) }));
}
// Las fechas que cubren las en línea que quedaron dentro de una histórica (para comparar): { desde, hasta } o null
export function rangoDentro(dentro) {
  const l = (dentro || []).filter(d => !d.hist); if (!l.length) return null;
  return { desde: l.map(d => s(d.desde)).sort()[0], hasta: l.map(d => s(d.hasta)).sort().pop() };
}
