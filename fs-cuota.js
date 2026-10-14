// ═══════════════════════════════════════════════
//  Sistema Fën — cuota diaria de Firestore (plan gratis Spark)  v0.63.3
//  Reglas puras (sin Firebase): el día de la cuota, cuándo se reinicia y el texto del letrero.
//  La cuota se reinicia a medianoche de California (America/Los_Angeles): en Chile cerca de las 4:00 (3:00 o 5:00 según la época).
// ═══════════════════════════════════════════════
const fmtLA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
export const diaCuota = (ms = Date.now()) => fmtLA.format(new Date(ms));
// Próxima medianoche de California, como instante (ms): el momento en que cambia el día de LA
export function proximoReinicio(ms = Date.now()) {
  const hoy = diaCuota(ms);
  let lo = ms, hi = ms + 26 * 3600e3;
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (diaCuota(mid) === hoy) lo = mid; else hi = mid; }
  return Math.round(hi / 60000) * 60000;
}
export function horaChile(ms) { return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)); }
export const esCuota = e => !!e && (/resource-exhausted/i.test(String(e.code || '')) || /quota exceeded|resource[_ -]exhausted/i.test(String(e.message || '')));
// v0.63.3: una cuota por base (cada proyecto de Firebase tiene la suya): 'gastos' (fen-gastos) y 'produccion' (fen-produccion)
const TEXTO = {
  gastos: { nombre: 'Gastos y Finanzas', siguen: 'Caja, B2B y Cocina siguen funcionando.' },
  produccion: { nombre: 'Producción/Cocina', siguen: 'Las tablets de Cocina también quedan en pausa hasta esa hora (lo que anoten se guarda solo cuando vuelva). Gastos, Caja y B2B siguen funcionando.' }
};
export function mensajeCuota(hasta, base = 'gastos') {
  const t = TEXTO[base] || TEXTO.gastos;
  return `Se acabó la cuota diaria gratuita de la base de ${t.nombre}. No se perdió nada: lo guardado quedó guardado y lo que no, no entró. Vuelve a funcionar cerca de las ${horaChile(hasta || proximoReinicio())} (hora de Chile). ${t.siguen}`;
}

// ═══════════════ Uso de hoy y cuota agotada, por base ═══════════════
// v0.63.3: lo mismo para cada base (antes solo fen-gastos). crearCuota('gastos') usa las claves de la v0.63.2 (no se pierde lo contado).
const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
export function crearCuota(base) {
  const K_USO = base === 'gastos' ? 'fen_gastos_uso' : `fen_${base}_uso`, K_AGOTADO = base === 'gastos' ? 'fen_gastos_cuota' : `fen_${base}_cuota`;
  const usoVacio = () => ({ dia: diaCuota(), lecturas: 0, escrituras: 0, pedidos: 0, porCol: {}, desdeMemoria: 0 });
  let uso = (() => { try { const u = JSON.parse((ls() && ls().getItem(K_USO)) || 'null'); return u && u.dia === diaCuota() ? u : usoVacio(); } catch (e) { return usoVacio(); } })();
  let tGuardar = 0;
  const publicar = () => { if (typeof window !== 'undefined') window[base === 'gastos' ? '__fsUso' : '__fsUso_' + base] = uso; };
  const guardarUso = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => { try { ls() && ls().setItem(K_USO, JSON.stringify(uso)); } catch (x) {} }, 500); };
  const C = { base };
  // Una lectura de un documento cuenta 1 (una consulta vacía, 1); cada pedido cuenta 1 más por la regla de seguridad (exists de admins)
  C.anotar = (col, l, e, pedidos = 1) => {
    if (uso.dia !== diaCuota()) uso = usoVacio();
    uso.lecturas += l; uso.escrituras += e; uso.pedidos += pedidos;
    const c = uso.porCol[col] = uso.porCol[col] || { l: 0, e: 0 };
    c.l += l; c.e += e;
    publicar(); guardarUso();
  };
  C.contarMemoria = () => { uso.desdeMemoria = (uso.desdeMemoria || 0) + 1; };
  // { dia, lecturas, escrituras, pedidos, estimadoLecturas (lecturas + 1 por pedido), porCol, desdeMemoria }
  C.usoHoy = () => { if (uso.dia !== diaCuota()) uso = usoVacio(); return { ...uso, estimadoLecturas: uso.lecturas + uso.pedidos, porCol: { ...uso.porCol } }; };
  C.reiniciarUso = () => { uso = usoVacio(); publicar(); try { ls() && ls().removeItem(K_USO); } catch (e) {} };
  publicar();
  // Cuota agotada: { desde, hasta (próximo reinicio), tipo: 'lectura' | 'escritura' }. Las lecturas y las escrituras tienen cuotas
  // separadas: si se acabaron las escrituras, una lectura que funciona no apaga el aviso (se apaga con una escritura que funciona o al pasar la hora).
  let agotado = (() => { try { const a = JSON.parse((ls() && ls().getItem(K_AGOTADO)) || 'null'); return a && a.hasta > Date.now() ? a : null; } catch (e) { return null; } })();
  const oyentes = new Set();
  C.alCambiarCuota = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
  const avisar = () => oyentes.forEach(fn => { try { fn(C.cuota()); } catch (e) {} });
  C.cuota = () => (agotado && agotado.hasta > Date.now() ? { agotada: true, hasta: agotado.hasta, tipo: agotado.tipo, mensaje: mensajeCuota(agotado.hasta, base) } : { agotada: false });
  C.marcarAgotada = (tipo = 'lectura') => {
    const ya = C.cuota().agotada;
    agotado = { desde: Date.now(), hasta: proximoReinicio(), tipo: ya && agotado.tipo === 'escritura' ? 'escritura' : tipo };
    try { ls() && ls().setItem(K_AGOTADO, JSON.stringify(agotado)); } catch (e) {}
    if (!ya) avisar();
  };
  C.marcarViva = tipo => {
    if (!agotado || (tipo === 'lectura' && agotado.tipo === 'escritura')) return;
    agotado = null; try { ls() && ls().removeItem(K_AGOTADO); } catch (e) {}
    avisar();
  };
  C.olvidarCuota = () => { if (agotado) { agotado = null; try { ls() && ls().removeItem(K_AGOTADO); } catch (e) {} avisar(); } };
  C.errorCuota = () => Object.assign(new Error(mensajeCuota(agotado && agotado.hasta, base)), { code: 'cuota-agotada' });
  return C;
}
// fen-gastos (como en la v0.63.2: lo usan fs-gastos.js y la pantalla)
const G = crearCuota('gastos');
export const { anotar, contarMemoria, usoHoy, reiniciarUso, alCambiarCuota, cuota, marcarAgotada, marcarViva, olvidarCuota, errorCuota } = G;
// v0.63.3: fen-produccion (la base de Cocina; la usa produccion.js)
export const produccion = crearCuota('produccion');
