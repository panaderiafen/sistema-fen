// ═══════════════════════════════════════════════
//  Sistema Fën — memoria de lecturas de las otras bases (fen-produccion, fen-b2b, fen-ventas)  v0.63.3
//  Cada base tiene su cuota gratis (50.000 lecturas al día). fen-produccion es la de Cocina (las tablets de las jefas):
//  Sistema Fën no puede gastarla. Esas bases las escriben otras apps (Cocina, la caja, logística), que no dejan una marca
//  de "cambió" (como `_m` en fen-gastos): por eso aquí no se pregunta "qué cambió", se guarda lo leído un rato (TTL).
//  · memo(clave, fn): lo leído queda en memoria mientras la app está abierta (10 minutos por defecto). Hoy, Producción y
//    Finanzas comparten la misma memoria: lo que leyó una pantalla no lo vuelve a leer otra.
//  · guardar: true → también en este navegador (localStorage), para la próxima apertura de la app (dentro del TTL). Solo
//    cosas chicas (resúmenes para Hoy, recetas y materias primas); si no cabe, sigue sin guardarlo.
//  · olvidar(...): después de un cambio hecho desde Sistema Fën, o con el botón "Actualizar".
//  · buscar(prefijo, sirve): una lectura más amplia ya en memoria (p. ej. 120 días de Cocina) responde una más chica (el mes).
//  Sin Firebase: lo usan produccion.js, b2b.js y la pantalla Hoy.
// ═══════════════════════════════════════════════
export const TTL = 10 * 60000;
const PREF = 'fen_sf_mem:';
const mem = new Map();   // clave → { t, v } | { t, p (promesa) }
const lsLeer = k => { try { const x = JSON.parse(localStorage.getItem(PREF + k) || 'null'); return x && typeof x.t === 'number' ? x : null; } catch (e) { return null; } };
const lsGuardar = (k, t, v) => { try { const s = JSON.stringify({ t, v }); if (s.length < 1500000) localStorage.setItem(PREF + k, s); } catch (e) { try { localStorage.removeItem(PREF + k); } catch (x) {} } };
const vigente = (t, ttl, ahora) => ahora - t < ttl && ahora >= t - 60000;   // un reloj que retrocede no deja algo "para siempre"

// Lo leído (o la lectura en curso: dos pantallas que piden lo mismo a la vez leen una sola vez)
export function memo(clave, fn, { ttl = TTL, guardar = false, forzar = false } = {}) {
  const ahora = Date.now(), m = mem.get(clave);
  if (!forzar && m && vigente(m.t, ttl, ahora)) return m.p || Promise.resolve(m.v);
  if (!forzar && guardar) { const x = lsLeer(clave); if (x && vigente(x.t, ttl, ahora)) { mem.set(clave, { t: x.t, v: x.v }); return Promise.resolve(x.v); } }
  const p = Promise.resolve().then(fn).then(v => {
    if (mem.get(clave) && mem.get(clave).p === p) { mem.set(clave, { t: ahora, v }); if (guardar) lsGuardar(clave, ahora, v); }
    return v;
  }, e => { if (mem.get(clave) && mem.get(clave).p === p) mem.delete(clave); throw e; });
  mem.set(clave, { t: ahora, p });
  return p;
}
// Lo que hay en memoria (sin leer); undefined si no hay o venció
export function ver(clave, ttl = TTL) {
  const m = mem.get(clave); if (m && !m.p && vigente(m.t, ttl, Date.now())) return m.v;
  const x = lsLeer(clave); if (x && vigente(x.t, ttl, Date.now())) return x.v;
  return undefined;
}
// Una lectura ya hecha (en memoria, vigente) cuya clave empieza con prefijo y que sirve (sirve(resto de la clave) = true)
export function buscar(prefijo, sirve, ttl = TTL) {
  const ahora = Date.now();
  for (const [k, m] of mem) if (k.startsWith(prefijo) && !m.p && vigente(m.t, ttl, ahora) && sirve(k.slice(prefijo.length))) return m.v;
  return undefined;
}
// Olvida las claves que empiezan con alguno de los prefijos (sin prefijos: todo), en memoria y en este navegador
export function olvidar(...prefijos) {
  const toca = k => !prefijos.length || prefijos.some(p => k.startsWith(p));
  [...mem.keys()].forEach(k => { if (toca(k)) mem.delete(k); });
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(PREF) && toca(k.slice(PREF.length))) localStorage.removeItem(k); } } catch (e) {}
}
// Cuándo se leyó (ms) lo más viejo que se está mostrando de estas claves; null si nada
export function leidoEn(...prefijos) {
  let t = null;
  for (const [k, m] of mem) if (!m.p && prefijos.some(p => k.startsWith(p))) t = t === null ? m.t : Math.min(t, m.t);
  return t;
}
