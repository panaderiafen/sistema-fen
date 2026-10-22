// ═══════════════════════════════════════════════
//  Sistema Fën · reglas-conc.js · v0.69.0 (Entrega B del rediseño de Conciliación)
//  Las reglas de conciliación que maneja el dueño (Gastos → Configuración → Reglas del banco), puras y sin red:
//  · la regla: condición (la glosa contiene palabras, todas, sin tildes ni mayúsculas, con "y no contiene"; o la glosa
//    exacta de lo aprendido; monto desde/hasta; cuenta; RUT en la glosa o en la transferencia), resultado (las mismas
//    acciones de siempre), nivel (Solo proponer o Pasar a Listos para confirmar), estado (activa, pausada, archivada;
//    las sugerencias descartadas quedan "descartada"), origen (creada por ti, propuesta y aceptada, migrada de Lo
//    aprendido, aprendida al confirmar), usos, último uso, quién y cuándo, y su historial;
//  · la frase que se lee ("Si la glosa contiene COMISION y el monto está entre $1.000 y $20.000 → Gasto nuevo: …");
//  · la migración de lo aprendido (Cargos: cartola_reglas; Abonos: equivalencias y textos a ignorar) a reglas "glosa
//    exacta" con el mismo comportamiento del primer día;
//  · lo aprendido al confirmar (crea o pone al día la regla exacta de esa glosa, "Solo proponer");
//  · las reglas sugeridas (≥3 movimientos de 120 días resueltos igual que comparten una palabra o un par, sin ninguno
//    resuelto distinto con esas palabras) y las propuestas de cada regla para un cargo.
//  Nunca se borra nada: se pausa o se archiva, con su historial. Nunca se confirma nada solo.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v);
const n = v => Number(v) || 0;
export const COL = 'conc_reglas';            // fen-gastos: las reglas de Cargos (una por documento)
export const ID_MARCA = 'migracion-v0690';   // fen-gastos: el documento que marca la migración (dentro de la misma colección)
export const CAMPO_B2B = 'reglasConc';       // fen-b2b: config/conciliacion.reglasConc (lista) con las reglas de Abonos
export const MARCA_B2B = 'reglasConcMigrado';
export const MAX_HIST = 30, MAX_REGLAS_B2B = 1500, DIAS_SUGERIR = 120, MIN_SUGERIR = 3, MAX_SUGERIDAS = 8;
export const NIVEL = { proponer: 'Solo proponer', listos: 'Pasar a Listos para confirmar' };
export const NIVEL_CORTO = { proponer: 'Solo propone', listos: 'Pasa a Listos' };
export const ESTADO = { activa: 'Activa', pausada: 'Pausada', archivada: 'Archivada', descartada: 'Descartada' };
export const ORIGEN = { manual: 'creada por ti', propuesta: 'propuesta y aceptada', migrada: 'migrada de Lo aprendido', aprendida: 'aprendida al confirmar' };
export const RES_CARGO = { nuevo: 'Gasto nuevo', ignorar: 'No es gasto', pago_tarjeta: 'Pago de tarjeta de crédito', traspaso: 'Traspaso entre cuentas propias', abono: 'Abono de sueldo a una persona', vencimiento: 'Paga un vencimiento', previred: 'Pago de Previred' };
export const RES_ABONO = { cliente: 'Asignar al cliente', noB2B: 'No es de B2B', revisado: 'Ya estaba registrado' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const diaTxt = f => (/^\d{4}-\d{2}-\d{2}/.test(s(f)) ? `${Number(s(f).slice(8, 10))} ${MESES[Number(s(f).slice(5, 7)) - 1]} ${s(f).slice(0, 4)}` : '');
const pesos = v => '$' + Math.round(n(v)).toLocaleString('es-CL');

// ═══ Texto ═══
export const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const rutNorm = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const dv = x => { let t = 0, m = 2; const q = s(x); for (let i = q.length - 1; i >= 0; i--) { t += Number(q[i]) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (t % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };
export function rutDe(desc) {
  const re = /(?:^|[^0-9])(\d{1,2}\.?\d{3}\.?\d{3})-?([0-9kK])(?![0-9])/g; let m;
  while ((m = re.exec(s(desc)))) { const x = m[1].replace(/\./g, ''); if (x.length >= 7 && dv(x) === m[2].toUpperCase()) return x + m[2].toUpperCase(); }
  return '';
}
export const rutValido = r => { const x = rutNorm(r); return x.length >= 8 && dv(x.slice(0, -1)) === x.slice(-1); };
export const rutTxt = r => { const x = rutNorm(r); if (x.length < 2) return x; const c = x.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return c + '-' + x.slice(-1); };
// La clave de una glosa de cargo (como gastos-cartola.js claveDe: el RUT si lo trae; si no, el texto sin números largos)
export const claveCargo = desc => { const r = rutDe(desc); return r ? 'rut:' + r : 'txt:' + norm(desc).replace(/\d{5,}/g, '#').slice(0, 80); };
// Palabras escritas por el dueño: separadas por espacio; "entre comillas" es una frase. Normalizadas y sin repetir.
export function palabrasDe(txt) {
  if (Array.isArray(txt)) return [...new Set(txt.map(norm).filter(Boolean))].slice(0, 8);
  const out = [], re = /"([^"]+)"|(\S+)/g; let m;
  while ((m = re.exec(s(txt)))) { const w = norm(m[1] || m[2]); if (w && !out.includes(w)) out.push(w); }
  return out.slice(0, 8);
}
export const palabrasTxt = l => (l || []).map(w => (/\s/.test(w) ? `"${w}"` : w)).join(' ');
// Huella corta (fnv-1a y djb2), para ids fijos: la misma glosa da siempre la misma regla (migrar dos veces no duplica)
export function huella(t) {
  let a = 2166136261, b = 5381;
  for (const ch of s(t)) { const c = ch.codePointAt(0); a ^= c; a = Math.imul(a, 16777619); b = (Math.imul(b, 33) ^ c) >>> 0; }
  return ((a >>> 0).toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).slice(0, 14);
}
export const idExacta = (lado, clave) => (lado === 'abono' ? 'ra-' : 'rc-') + huella(clave);
export const idNueva = (lado, semilla) => (lado === 'abono' ? 'ra-' : 'rc-') + 'm' + huella(s(semilla) + '|' + Date.now() + '|' + Math.random()).slice(0, 12);

// ═══ La regla en la memoria (de la base o de la lista de B2B) ═══
const numO = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Math.round(Number(v)));
export function vista(id, d) {
  const x = d || {}, k = x.cond || {}, r = x.res || {};
  return { id: s(x.id) || s(id), lado: x.lado === 'abono' ? 'abono' : 'cargo', estado: ESTADO[x.estado] ? x.estado : 'activa', nivel: x.nivel === 'listos' ? 'listos' : 'proponer',
    origen: ORIGEN[x.origen] ? x.origen : 'manual', cond: { tipo: k.tipo === 'exacta' ? 'exacta' : 'contiene', clave: s(k.clave), palabras: palabrasDe(k.palabras || []), no: palabrasDe(k.no || []),
      montoMin: numO(k.montoMin), montoMax: numO(k.montoMax), cuenta: ['cc', 'chequera'].includes(k.cuenta) ? k.cuenta : '', rut: rutNorm(k.rut) },
    res: { ...r, tipo: s(r.tipo) }, usos: n(x.usos), ultimoMonto: n(x.ultimoMonto), usadoEl: s(x.usadoEl).slice(0, 16), creado: x.creado || {}, actualizado: x.actualizado || {},
    historial: Array.isArray(x.historial) ? x.historial : [], migradaDe: s(x.migradaDe), evidencia: x.evidencia || null, firma: s(x.firma) };
}
export const activas = (reglas, lado) => (reglas || []).filter(r => r.estado === 'activa' && (!lado || r.lado === lado));
// Lo que se guarda (sin lo que es solo de la vista)
export function aDoc(r) {
  const k = r.cond || {};
  return { id: r.id, lado: r.lado, estado: r.estado, nivel: r.nivel, origen: r.origen,
    cond: { tipo: k.tipo, ...(k.tipo === 'exacta' ? { clave: s(k.clave) } : { palabras: k.palabras || [] }), no: k.no || [], montoMin: k.montoMin ?? null, montoMax: k.montoMax ?? null, cuenta: k.cuenta || '', rut: k.rut || '' },
    res: limpiarRes(r.res), usos: n(r.usos), ultimoMonto: n(r.ultimoMonto), usadoEl: s(r.usadoEl), creado: r.creado || {}, actualizado: r.actualizado || {},
    historial: (r.historial || []).slice(-MAX_HIST), ...(r.migradaDe ? { migradaDe: r.migradaDe } : {}), ...(r.evidencia ? { evidencia: r.evidencia } : {}), ...(r.firma ? { firma: r.firma } : {}) };
}
const CAMPOS_RES = { nuevo: ['item', 'area', 'sinFactura'], ignorar: ['motivo', 'siempre'], pago_tarjeta: ['tarjeta'], traspaso: ['nota'], abono: ['plantillaId', 'nombre'], vencimiento: ['vencimiento', 'nombre'], previred: [],
  cliente: ['clienteId', 'nombre'], noB2B: ['motivo', 'alSubir'], revisado: ['clienteId', 'nombre'] };
export function limpiarRes(r) {
  const x = r || {}, t = s(x.tipo), out = { tipo: t };
  (CAMPOS_RES[t] || []).forEach(k => { if (k === 'sinFactura' || k === 'siempre' || k === 'alSubir') out[k] = !!x[k]; else out[k] = s(x[k]).slice(0, 200); });
  return out;
}

// ═══ ¿Calza la regla con el movimiento? ═══
// m = { descripcion, monto, cuenta, claves: [txt:…, rut:…, tef:…], ruts: [RUT de la glosa y de la transferencia] }
export function calza(r, m) {
  const k = (r && r.cond) || {}, g = ' ' + norm(m && m.descripcion) + ' ';
  if (k.tipo === 'exacta') { if (!k.clave || !(m.claves || []).includes(k.clave)) return false; }
  else { const ps = (k.palabras || []).map(norm).filter(Boolean); if (!ps.length || !ps.every(p => g.includes(p))) return false; }
  if ((k.no || []).map(norm).filter(Boolean).some(p => g.includes(p))) return false;
  const mo = Math.abs(n(m.monto));
  if (k.montoMin !== null && k.montoMin !== undefined && mo < k.montoMin) return false;
  if (k.montoMax !== null && k.montoMax !== undefined && mo > k.montoMax) return false;
  if (k.cuenta && s(m.cuenta || 'chequera') !== k.cuenta) return false;
  if (k.rut && !(m.ruts || []).map(rutNorm).includes(rutNorm(k.rut))) return false;
  return true;
}
// La misma condición más específica primero: exacta, después más palabras, después con monto o RUT
const especificidad = r => (r.cond.tipo === 'exacta' ? 100 : 0) + (r.cond.palabras || []).length * 10 + (r.cond.no || []).length * 3 + (r.cond.montoMin !== null || r.cond.montoMax !== null ? 5 : 0) + (r.cond.rut ? 8 : 0) + (r.cond.cuenta ? 2 : 0);
export const ordenar = l => l.slice().sort((a, b) => especificidad(b) - especificidad(a) || (b.nivel === 'listos') - (a.nivel === 'listos') || s(a.id).localeCompare(s(b.id)));
export const calzan = (reglas, m, lado) => ordenar(activas(reglas, lado).filter(r => calza(r, m)));
// El movimiento para calzar: un cargo (vistaCargo con su transferencia) o un abono de B2B (con su transferencia recibida)
export const movCargo = c => ({ descripcion: c.descripcion, monto: c.monto, cuenta: c.cuenta, claves: [c.clave || claveCargo(c.descripcion)], ruts: [rutDe(c.descripcion), c.rut, c.tef && c.tef.rut].filter(Boolean).map(rutNorm) });
export const movAbono = (mv, tef) => ({ descripcion: mv.descripcion, monto: mv.monto, cuenta: mv.cuenta || 'chequera', claves: ['txt:' + (mv.descNorm || norm(mv.descripcion))].concat(tef && tef.rut ? ['tef:' + rutNorm(tef.rut)] : []), ruts: [rutDe(mv.descripcion), tef && tef.rut].filter(Boolean).map(rutNorm) });

// ═══ La frase ═══
const lista = (l, y = ' y ') => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + y + l[l.length - 1]);
export function condTxt(k) {
  const c = k || {};
  let t;
  if (c.tipo === 'exacta') {
    const cl = s(c.clave);
    t = cl.startsWith('rut:') ? `Si la glosa trae el RUT ${rutTxt(cl.slice(4))}` : cl.startsWith('tef:') ? `Si la transferencia viene del RUT ${rutTxt(cl.slice(4))}` : `Si la glosa es «${cl.slice(4).replace(/#/g, '(número)')}»`;
  } else t = `Si la glosa contiene ${lista((c.palabras || []).map(w => (/\s/.test(w) ? `«${w}»` : w)))}`;
  if ((c.no || []).length) t += ` y no contiene ${lista(c.no.map(w => (/\s/.test(w) ? `«${w}»` : w)), ' ni ')}`;
  const a = c.montoMin, b = c.montoMax;
  if (a !== null && a !== undefined && b !== null && b !== undefined) t += ` y el monto está entre ${pesos(a)} y ${pesos(b)}`;
  else if (a !== null && a !== undefined) t += ` y el monto es desde ${pesos(a)}`;
  else if (b !== null && b !== undefined) t += ` y el monto es hasta ${pesos(b)}`;
  if (c.cuenta) t += c.cuenta === 'cc' ? ' en la cuenta corriente' : ' en la Chequera Electrónica';
  if (c.rut) t += ` y trae el RUT ${rutTxt(c.rut)}`;
  return t;
}
// El reparto guardado en el área (JSON del gasto prorrateado): "PAN 40 % y B2B 60 %"
export function areaTxt(area) {
  const t = s(area);
  if (!/^\{/.test(t)) return t;
  try { const p = JSON.parse(t), l = [1, 2, 3].filter(i => p['area' + i]).map(i => `${p['area' + i]} ${n(p['pct' + i])} %`); return l.length ? 'reparto ' + lista(l) : ''; } catch (e) { return ''; }
}
export function resTxt(res, ctx = {}) {
  const r = res || {}, nom = id => (ctx.nombreCliente && ctx.nombreCliente(id)) || '';
  switch (r.tipo) {
    case 'nuevo': return `Gasto nuevo: ${r.item || 'sin ítem'}${areaTxt(r.area) ? ' · ' + areaTxt(r.area) : ''}${r.sinFactura ? ' (sin factura)' : ''}`;
    case 'ignorar': return `No es gasto${r.motivo ? ': ' + r.motivo : ''}${r.siempre ? ' (se ignora sola al subir la cartola)' : ''}`;
    case 'pago_tarjeta': return 'Pago de tarjeta de crédito' + (r.tarjeta && !/^Pago de tarjeta/.test(r.tarjeta) ? ': ' + r.tarjeta : '');
    case 'traspaso': return 'Traspaso entre cuentas propias' + (r.nota && !/^Traspaso entre/.test(r.nota) ? ': ' + r.nota : '');
    case 'abono': return `Abono de sueldo a ${r.nombre || 'una persona'}`;
    case 'vencimiento': return `Paga ${r.nombre || 'el vencimiento'}`;
    case 'previred': return 'Pago de Previred';
    case 'cliente': return `Asignar a ${r.nombre || nom(r.clienteId) || 'un cliente'}`;
    case 'noB2B': return `No es de B2B${r.motivo ? ': ' + r.motivo : ''}${r.alSubir ? ' (se ignora sola al subir la cartola)' : ''}`;
    case 'revisado': return `Ya estaba registrado${r.nombre ? ' · ' + r.nombre : ''}`;
    default: return 'Sin resultado';
  }
}
export const frase = (r, ctx) => `${condTxt(r.cond)} → ${resTxt(r.res, ctx)}`;
export const textoUso = r => (r.usos ? `Usada ${r.usos} ${r.usos === 1 ? 'vez' : 'veces'}${r.usadoEl ? ` · la última el ${diaTxt(r.usadoEl)}` : ''}` : 'Todavía no se usa');
export const textoQuien = r => [r.creado && r.creado.en ? `${r.origen === 'migrada' ? 'Migrada' : 'Creada'} el ${diaTxt(r.creado.en)}${r.creado.por ? ' por ' + r.creado.por : ''}` : '', r.actualizado && r.actualizado.en && r.actualizado.en !== (r.creado || {}).en ? `cambiada el ${diaTxt(r.actualizado.en)}${r.actualizado.por ? ' por ' + r.actualizado.por : ''}` : ''].filter(Boolean).join(' · ');
// La clave del resultado (dos reglas o una regla y una propuesta "dicen lo mismo" si su clave es igual)
export function claveRes(r) {
  const x = r || {};
  switch (x.tipo) {
    case 'nuevo': return `nuevo|${s(x.item)}|${s(x.area)}`;
    case 'abono': return `abono|${s(x.plantillaId)}`;
    case 'vencimiento': return `venc|${s(x.vencimiento)}`;
    case 'cliente': return `cliente|${s(x.clienteId)}`;
    case 'revisado': return `revisado|${s(x.clienteId)}`;
    default: return s(x.tipo);
  }
}

// ═══ Validar lo que escribe el dueño ═══
// p = { lado, cond: { tipo, palabras (texto o lista), no, montoMin, montoMax, cuenta, rut, clave }, res, nivel }
export function revisar(p) {
  const lado = p.lado === 'abono' ? 'abono' : 'cargo', k = p.cond || {};
  const tipo = k.tipo === 'exacta' ? 'exacta' : 'contiene';
  const palabras = palabrasDe(k.palabras || ''), no = palabrasDe(k.no || '');
  if (tipo === 'contiene' && !palabras.length) return { error: 'Escribe al menos una palabra que deba traer la glosa.' };
  if (tipo === 'contiene' && palabras.every(w => w.replace(/ /g, '').length < 3)) return { error: 'Las palabras son muy cortas: escribe al menos una de 3 letras o más.' };
  if (tipo === 'exacta' && !s(k.clave)) return { error: 'Falta la glosa exacta.' };
  const a = numO(s(k.montoMin).replace(/[^\d]/g, '') || null), b = numO(s(k.montoMax).replace(/[^\d]/g, '') || null);
  if (a !== null && b !== null && a > b) return { error: 'El monto "desde" es mayor que el "hasta".' };
  const rut = rutNorm(k.rut);
  if (rut && !rutValido(rut)) return { error: 'El RUT no es válido (revisa el dígito verificador).' };
  const res = limpiarRes(p.res);
  const T = lado === 'abono' ? RES_ABONO : RES_CARGO;
  if (!T[res.tipo]) return { error: 'Elige qué hacer con los movimientos que calzan.' };
  if (res.tipo === 'nuevo' && !res.item) return { error: 'Elige el ítem del gasto.' };
  if (res.tipo === 'abono' && !res.plantillaId) return { error: 'Elige a quién va el abono de sueldo.' };
  if (res.tipo === 'vencimiento' && !res.vencimiento) return { error: 'Elige la cuenta recurrente que paga.' };
  if (res.tipo === 'cliente' && !res.clienteId) return { error: 'Elige el cliente.' };
  return { regla: { lado, nivel: p.nivel === 'listos' ? 'listos' : 'proponer', cond: { tipo, ...(tipo === 'exacta' ? { clave: s(k.clave) } : { palabras }), no, montoMin: a, montoMax: b, cuenta: ['cc', 'chequera'].includes(k.cuenta) ? k.cuenta : '', rut }, res } };
}
// Historial: lo que cambió, en una línea
export const entrada = (que, por, en, extra) => ({ que: s(que).slice(0, 80), por: s(por), en: s(en), ...(extra || {}) });
export const conHist = (r, e) => (r.historial || []).concat([e]).slice(-MAX_HIST);
// Crear: la regla completa
export function nueva(regla, origen, por, en, extra = {}) {
  const r = { id: extra.id || idNueva(regla.lado, frase(regla)), lado: regla.lado, estado: 'activa', nivel: regla.nivel, origen, cond: regla.cond, res: regla.res, usos: 0, ultimoMonto: 0, usadoEl: '',
    creado: { por, en }, actualizado: { por, en }, historial: [], ...(extra.evidencia ? { evidencia: extra.evidencia } : {}), ...(extra.firma ? { firma: extra.firma } : {}) };
  r.historial = [entrada(origen === 'propuesta' ? 'aceptó la regla sugerida' : 'creó la regla', por, en, { frase: frase(r) })];
  return r;
}
// Editar: cambia condición, resultado y nivel; queda la frase de antes en el historial
export function editar(act, regla, por, en) {
  const r = { ...act, nivel: regla.nivel, cond: regla.cond, res: regla.res, actualizado: { por, en } };
  if (frase(act) === frase(r) && act.nivel === r.nivel) return null;
  r.historial = conHist(act, entrada('editó', por, en, { antes: frase(act) + ' · ' + NIVEL_CORTO[act.nivel], despues: frase(r) + ' · ' + NIVEL_CORTO[r.nivel] }));
  return r;
}
const QUE_ESTADO = { activa: 'la activó', pausada: 'la pausó', archivada: 'la archivó', descartada: 'descartó la sugerencia' };
export function conEstado(act, estado, por, en, motivo) {
  if (!ESTADO[estado] || act.estado === estado) return null;
  return { ...act, estado, actualizado: { por, en }, historial: conHist(act, entrada(QUE_ESTADO[estado], por, en, motivo ? { motivo: s(motivo).slice(0, 160) } : null)) };
}

// ═══ Migración: lo aprendido → reglas "glosa exacta" (el mismo comportamiento del primer día) ═══
// Cargos: cartola_reglas (vistaRegla de gastos-cartola.js, vivas). El nivel "Listos" solo donde hoy ya van a Listos para confirmar:
// "No es gasto" (siempre: se ignora sola al subir), pago de tarjeta, traspaso, gasto nuevo aprendido 2 o más veces (con el monto parecido)
// y pagar facturas del mismo proveedor (por RUT o nombre). Lo demás (un vencimiento de una obligación, abono de sueldo, Previred), Solo proponer.
export function resDeLegacy(x) {
  const a = s(x.accion);
  if (a === 'gasto') return { tipo: 'nuevo', item: s(x.item), area: s(x.area), sinFactura: !!x.sinFactura };
  if (a === 'ignorar') return { tipo: 'ignorar', motivo: s(x.ejemplo) || 'No es gasto', siempre: true };
  if (a === 'pago_tarjeta') return { tipo: 'pago_tarjeta', tarjeta: s(x.ejemplo) };
  if (a === 'traspaso') return { tipo: 'traspaso', nota: s(x.ejemplo) };
  if (a === 'abono') return { tipo: 'abono', plantillaId: s(x.vencimiento).replace(/^p:/, ''), nombre: s(x.ejemplo) };
  if (a === 'vencimiento') return { tipo: 'vencimiento', vencimiento: s(x.vencimiento), nombre: s(x.ejemplo) };
  if (a === 'previred') return { tipo: 'previred' };
  return null;
}
export function nivelLegacy(x) {
  const a = s(x.accion);
  if (['ignorar', 'pago_tarjeta', 'traspaso'].includes(a)) return 'listos';
  if (a === 'gasto') return n(x.veces) >= 2 ? 'listos' : 'proponer';
  if (a === 'vencimiento') return s(x.vencimiento).startsWith('p:') ? 'proponer' : 'listos';
  return 'proponer';
}
export function migrarCargos(viejas, por, en) {
  const out = new Map();
  (viejas || []).filter(x => x && x.clave && !x.quitada && n(x.veces) > 0).forEach(x => {
    const res = resDeLegacy(x); if (!res) return;
    const id = idExacta('cargo', x.clave);
    out.set(id, { id, lado: 'cargo', estado: 'activa', nivel: nivelLegacy(x), origen: 'migrada', cond: { tipo: 'exacta', clave: x.clave, no: [], montoMin: null, montoMax: null, cuenta: '', rut: '' }, res: limpiarRes(res),
      usos: n(x.veces), ultimoMonto: n(x.monto), usadoEl: s(x.actualizado).slice(0, 16), creado: { por, en }, actualizado: { por, en },
      historial: [entrada('migró de Lo aprendido', por, en, { veces: n(x.veces) })], migradaDe: 'cartola_reglas/' + s(x.docId || x.clave) });
  });
  return [...out.values()];
}
// Abonos: equivalencias (glosa → cliente y RUT de la transferencia → cliente; las dos van hoy a Listos) y los textos a ignorar
// ("No es de B2B" siempre: se saltan al subir la cartola).
export function migrarAbonos(conf, por, en) {
  const c = conf || {}, out = new Map();
  (Array.isArray(c.equivalencias) ? c.equivalencias : []).forEach(e => {
    if (!e || !e.clienteId) return;
    const clave = e.rut ? 'tef:' + rutNorm(e.rut) : e.desc ? 'txt:' + s(e.desc) : '';
    if (!clave || clave === 'txt:') return;
    const id = idExacta('abono', clave);
    out.set(id, { id, lado: 'abono', estado: 'activa', nivel: 'listos', origen: 'migrada', cond: { tipo: 'exacta', clave, no: [], montoMin: null, montoMax: null, cuenta: '', rut: '' },
      res: { tipo: 'cliente', clienteId: s(e.clienteId), nombre: s(e.nombre) }, usos: 1, ultimoMonto: 0, usadoEl: '', creado: { por, en }, actualizado: { por, en }, historial: [entrada('migró de Lo aprendido', por, en)], migradaDe: 'config/conciliacion.equivalencias' });
  });
  (Array.isArray(c.ignorar) ? c.ignorar : []).forEach(p0 => {
    const p = norm(p0); if (p.length < 4) return;
    const id = idExacta('abono', 'ign:' + p);
    out.set(id, { id, lado: 'abono', estado: 'activa', nivel: 'listos', origen: 'migrada', cond: { tipo: 'contiene', palabras: [p], no: [], montoMin: null, montoMax: null, cuenta: '', rut: '' },
      res: { tipo: 'noB2B', motivo: '', alSubir: true }, usos: 0, ultimoMonto: 0, usadoEl: '', creado: { por, en }, actualizado: { por, en }, historial: [entrada('migró de los textos a ignorar', por, en)], migradaDe: 'config/conciliacion.ignorar' });
  });
  return [...out.values()];
}

// ═══ Lo que leen los motores de siempre (el mismo comportamiento con las reglas nuevas) ═══
const ACC_DE = { nuevo: 'gasto', ignorar: 'ignorar', pago_tarjeta: 'pago_tarjeta', traspaso: 'traspaso', abono: 'abono', vencimiento: 'vencimiento', previred: 'previred' };
// Cargos: las reglas exactas activas, con la forma de cartola_reglas (gastos-cartola.js proponer, Previred, al subir)
export function legacyCargos(reglas) {
  return activas(reglas, 'cargo').filter(r => r.cond.tipo === 'exacta' && ACC_DE[r.res.tipo]).map(r => {
    const x = r.res;
    return { clave: r.cond.clave, accion: ACC_DE[x.tipo], item: s(x.item), area: s(x.area), vencimiento: x.tipo === 'abono' ? 'p:' + s(x.plantillaId) : s(x.vencimiento), sinFactura: !!x.sinFactura,
      ejemplo: s(x.motivo || x.tarjeta || x.nota || x.nombre || (x.tipo === 'previred' ? 'Pago de Previred' : '')), veces: Math.max(1, n(r.usos)), monto: n(r.ultimoMonto), quitada: false, regla: r.id, nivel: r.nivel,
      siempre: x.tipo === 'ignorar' ? !!x.siempre : undefined };
  });
}
// Al subir la cartola, solo "No es gasto" con "se ignora sola" (lo que el dueño marcó "siempre")
export const legacyAlSubir = reglas => legacyCargos(reglas).filter(r => r.accion !== 'ignorar' || r.siempre);
// Abonos: las equivalencias (glosa → cliente) de las reglas exactas activas de nivel Listos
export function legacyAbonos(reglas) {
  const out = [];
  activas(reglas, 'abono').filter(r => r.cond.tipo === 'exacta' && r.res.tipo === 'cliente' && r.nivel === 'listos').forEach(r => {
    const cl = r.cond.clave;
    if (cl.startsWith('txt:')) out.push({ desc: cl.slice(4), clienteId: r.res.clienteId, nombre: r.res.nombre || '', regla: r.id });
    else if (cl.startsWith('tef:')) out.push({ desc: '', rut: cl.slice(4), clienteId: r.res.clienteId, nombre: r.res.nombre || '', regla: r.id });
  });
  return out;
}
// Los textos que se saltan al subir la cartola de B2B (reglas activas "No es de B2B" que se ignoran solas)
export const ignorarAlSubir = reglas => activas(reglas, 'abono').filter(r => r.res.tipo === 'noB2B' && r.res.alSubir && r.cond.tipo === 'contiene' && !(r.cond.no || []).length && r.cond.montoMin === null && r.cond.montoMax === null && !r.cond.rut && !r.cond.cuenta).map(r => r.cond.palabras.join(' ')).filter(p => p.length >= 4);

// ═══ Aprender al confirmar (lo mismo que hacía lo aprendido): la regla exacta de esa glosa, creada o al día ═══
// act: la regla de esa clave (vista) o null; res: el resultado confirmado. Una regla nueva es "Solo proponer"; una que ya
// estaba conserva su nivel. Si el resultado cambia, queda el de ahora (como lo aprendido) y el de antes en el historial.
// Una archivada vuelve a activa (se aprendió otra vez); una pausada sigue pausada.
export function aprendida(act, lado, clave, res, monto, por, en) {
  const r0 = limpiarRes(res);
  if (!act) {
    const r = { id: idExacta(lado, clave), lado, estado: 'activa', nivel: 'proponer', origen: 'aprendida', cond: { tipo: 'exacta', clave, no: [], montoMin: null, montoMax: null, cuenta: '', rut: '' }, res: r0,
      usos: 1, ultimoMonto: n(monto), usadoEl: en, creado: { por, en }, actualizado: { por, en }, historial: [] };
    r.historial = [entrada('aprendió al confirmar', por, en, { frase: frase(r) })];
    return r;
  }
  const igual = claveRes(act.res) === claveRes(r0);
  const r = { ...act, res: igual ? { ...act.res, ...r0 } : r0, usos: igual ? n(act.usos) + 1 : 1, ultimoMonto: n(monto) || act.ultimoMonto, usadoEl: en };
  if (!igual) { r.actualizado = { por, en }; r.historial = conHist(act, entrada('cambió el resultado al confirmar', por, en, { antes: resTxt(act.res), despues: resTxt(r0) })); }
  if (act.estado === 'archivada') { r.estado = 'activa'; r.actualizado = { por, en }; r.historial = conHist(r, entrada('volvió a aprenderla al confirmar', por, en)); }
  return r;
}
// Contar un uso (la regla propuso y el dueño confirmó eso mismo): en la misma escritura de la confirmación
export const usada = (act, monto, en) => ({ ...act, usos: n(act.usos) + 1, ultimoMonto: n(monto) || act.ultimoMonto, usadoEl: en });
// Deshacer: la regla aprendida pierde un uso; en cero queda archivada (no se borra)
export function olvidada(act, por, en, motivo) {
  if (!act || act.estado === 'archivada' || act.estado === 'descartada') return null;
  const u = Math.max(0, n(act.usos) - 1);
  if (u > 0) return { ...act, usos: u };
  return { ...act, usos: 0, estado: 'archivada', actualizado: { por, en }, historial: conHist(act, entrada('la archivó al deshacer', por, en, motivo ? { motivo: s(motivo).slice(0, 160) } : null)) };
}

// ═══ La propuesta de una regla para un cargo (con la misma forma que gastos-cartola.js proponer) ═══
// D: la lista de Gastos (vencimientos abiertos, planillas); CB: gastos-cartola.js (combinacion, periodoPropuesto, Previred).
export function propuestaCargo(r, c, D, CB) {
  const x = r.res || {}, listos = r.nivel === 'listos', base = { por: 'regla', regla: r.id, nivelRegla: r.nivel, fraseRegla: frase(r) };
  const vencs = (D && D.vencimientos) || [], dias = (a, b) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 864e5);
  switch (x.tipo) {
    case 'nuevo': return { ...base, tipo: 'nuevo', seguro: listos, item: x.item, area: x.area, sinFactura: !!x.sinFactura, texto: x.item };
    case 'ignorar': return { ...base, tipo: 'ignorar', seguro: listos, motivo: x.motivo || 'No es gasto' };
    case 'pago_tarjeta': return { ...base, tipo: 'pago_tarjeta', seguro: listos, texto: x.tarjeta || 'Pago de tarjeta de crédito', tarjeta: x.tarjeta || '' };
    case 'traspaso': return { ...base, tipo: 'traspaso', seguro: listos, texto: x.nota || 'Traspaso entre cuentas propias', nota: x.nota || '' };
    case 'abono': {
      const l = vencs.filter(v => v.plantillaId === x.plantillaId && v.tipoObligacion === 'libre');
      if (!l.length) return null;
      const v = (CB && CB.periodoPropuesto && CB.periodoPropuesto(c, l)) || l.slice().sort((a, b) => Math.abs(dias(a.fecha, c.fecha)) - Math.abs(dias(b.fecha, c.fecha)))[0];
      return { ...base, tipo: 'abono', seguro: false, vencId: v.id, texto: v.nombre + (v.periodo && CB && CB.nombrePeriodo ? ' · ' + CB.nombrePeriodo(v.periodo) : ''), opciones: l.map(o => ({ id: o.id, nombre: o.nombre, monto: o.monto, fecha: o.fecha })) };
    }
    case 'vencimiento': {
      const t = s(x.vencimiento), val = t.replace(/^(p|rut|n):/, '');
      const cand = vencs.filter(v => v.tipoObligacion !== 'libre' && (t.startsWith('p:') ? v.plantillaId === val : t.startsWith('rut:') ? v.rut === val : norm(v.razon || v.nombre).startsWith(val)));
      if (!cand.length) return null;
      if (t.startsWith('p:')) {
        const v = cand.slice().sort((a, b) => Math.abs(dias(a.fecha, c.fecha)) - Math.abs(dias(b.fecha, c.fecha)))[0];
        if (Math.abs(dias(c.fecha, v.fecha)) > 45) return null;
        return { ...base, tipo: 'vencimientos', seguro: listos && Math.abs(n(v.monto) - c.monto) <= 1, pagos: [{ id: v.id, monto: c.monto }], texto: v.nombre + (v.monto && Math.abs(v.monto - c.monto) > 1 ? ` (estimado ${pesos(v.monto)})` : '') };
      }
      const comb = CB && CB.combinacion ? CB.combinacion(cand, c.monto) : null;
      return comb ? { ...base, tipo: 'vencimientos', seguro: listos, pagos: comb.map(v => ({ id: v.id, monto: v.monto })), texto: comb.map(v => v.nombre).join(' + ') } : null;
    }
    case 'previred': {
      if (!CB || !CB.opcionPropuesta) return null;
      const op = CB.opcionPropuesta(CB.opcionesPrevired(vencs, (D && D.planillas) || []), c.fecha);
      if (op && op.tipo === 'planilla') return { ...base, tipo: 'previred', seguro: false, opcion: op.id, planillaId: op.planillaId, texto: op.nombre };
      if (op && op.tipo === 'venc') return { ...base, tipo: 'previred', seguro: false, vencId: op.vencId, opcion: op.id, texto: op.nombre };
      return null;
    }
    default: return null;
  }
}
// La clave del destino de una propuesta de cargo (para saber si una regla y un documento "dicen lo mismo")
export function claveProp(p, D) {
  if (!p) return '';
  const vs = (D && D.vencimientos) || [], pl = id => ((vs.find(v => v.id === id) || {}).plantillaId) || '';
  switch (p.tipo) {
    case 'nuevo': return `nuevo|${s(p.item)}|${s(p.area)}`;
    case 'abono': return `abono|${pl(p.vencId)}`;
    case 'vencimientos': { const ids = (p.pagos || []).map(x => x.id); const pid = ids.length === 1 ? pl(ids[0]) : ''; return pid ? `venc|p:${pid}` : 'vencs|' + ids.sort().join(','); }
    case 'gasto': return 'gasto|' + (((p.gasto && p.gasto.filas) || []).map(f => f.id || f.fila).join(','));
    default: return s(p.tipo);
  }
}
// ¿La regla dice lo mismo que la propuesta? (un vencimiento por RUT o nombre calza con el pago de ese proveedor)
export function coinciden(r, p, D) {
  if (!r || !p) return false;
  const kr = claveRes(r.res), kp = claveProp(p, D);
  if (kr === kp) return true;
  if (r.res.tipo === 'vencimiento' && p.tipo === 'vencimientos') {
    const t = s(r.res.vencimiento), vs = (D && D.vencimientos) || [];
    return (p.pagos || []).every(x => { const v = vs.find(y => y.id === x.id); return v && (t.startsWith('p:') ? v.plantillaId === t.slice(2) : t.startsWith('rut:') ? v.rut === t.slice(4) : norm(v.razon || v.nombre).startsWith(t.replace(/^n:/, ''))); });
  }
  if (r.res.tipo === 'previred' && p.tipo === 'previred') return true;
  return false;
}
// Un documento "fuerte": la factura, el vencimiento o el folio del mismo monto con un dato que dice quién es (RUT, monto fijo de la
// obligación, documento de la obligación, factura del SII ya registrada)
export const docFuerte = p => !!p && !p.sinPropuesta && p.por !== 'regla' && p.por !== 'aprendido' && (['rut', 'proveedor', 'monto fijo', 'documento', 'saldo'].includes(p.por) || (p.registrado && p.seguro) || (p.tipo === 'sii_pend' && p.conf === 'seguro'));

// ═══ Juntar la propuesta de siempre con las reglas que calzan (Cargos) ═══
// p0: la propuesta de gastos-cartola.js (con lo aprendido exacto ya dentro); exacta: la regla exacta de esa glosa (si la usó);
// otras: las reglas que calzan (sin la exacta). → { p, alternativas: [p], conflicto: '' | texto }
export function combinarCargo(c, p0, exacta, otras, D, CB) {
  let p = p0;
  if (p && p.por === 'aprendido' && exacta) {
    p = { ...p, regla: exacta.id, nivelRegla: exacta.nivel, fraseRegla: frase(exacta) };
    if (exacta.nivel === 'proponer') p.seguro = false;
    // Nivel Listos en lo que ya está completo y sin dudas (gasto nuevo, no es gasto, tarjeta, traspaso; un vencimiento del monto exacto)
    else if (!p.seguro && !p.sinPropuesta && !p.duda && (['nuevo', 'ignorar', 'pago_tarjeta', 'traspaso'].includes(p.tipo) ? (p.tipo !== 'nuevo' || !exacta.ultimoMonto || Math.abs(c.monto - exacta.ultimoMonto) <= exacta.ultimoMonto * 0.5)
      : p.tipo === 'vencimientos' && (p.pagos || []).length === 1 && (((D.vencimientos || []).find(v => v.id === p.pagos[0].id) || {}).monto || 0) === c.monto)) p.seguro = true;
  }
  const props = (otras || []).map(r => ({ r, q: propuestaCargo(r, c, D, CB) })).filter(x => x.q);
  if (!props.length) return { p, alternativas: [], conflicto: '' };
  const usada = p && p.regla ? (exacta || null) : null;
  const igual = props.filter(x => p && (coinciden(x.r, p, D) || (usada && claveRes(x.r.res) === claveRes(usada.res))));
  const distintas = props.filter(x => !igual.includes(x));
  // Las reglas que no dicen lo mismo entre ellas
  const grupos = []; distintas.forEach(x => { const g = grupos.find(y => claveRes(y[0].r.res) === claveRes(x.r.res)); if (g) g.push(x); else grupos.push([x]); });
  // Lo aprendido (la glosa exacta) que la propuesta de siempre ya dejó atrás (un documento, un saldo o las opciones iban primero): queda
  // como otra opción, sin choque (así se comporta igual que antes). Los choques los marcan las reglas "contiene" que creaste tú.
  if (p && grupos.length && grupos.every(g => g.every(x => x.r.cond.tipo === 'exacta'))) return { p, alternativas: grupos.map(g => g[0].q), conflicto: '' };
  if (p && !p.sinPropuesta) {
    if (igual.length && !p.regla) p = { ...p, coincideRegla: igual[0].r.id, fraseCoincide: frase(igual[0].r) };
    if (!grupos.length) return { p, alternativas: [], conflicto: '' };
    // Una regla que dice otra cosa: si la propuesta es un documento fuerte (o lo aprendido exacto), manda la propuesta; si es débil (solo el
    // monto), manda la regla. Siempre se muestran las dos.
    const fuerte = docFuerte(p) || p.por === 'aprendido' || (p.tipo === 'gasto' && p.seguro);
    if (fuerte) return { p, alternativas: grupos.map(g => g[0].q), conflicto: docFuerte(p) ? 'Hay un documento del mismo monto y una regla que dice otra cosa' : 'Dos reglas dicen cosas distintas' };
    return { p: grupos[0][0].q, alternativas: [p].concat(grupos.slice(1).map(g => g[0].q)), conflicto: grupos.length > 1 ? 'Dos reglas dicen cosas distintas' : '' };
  }
  // Sin propuesta (o con opciones sin elegir): manda la regla más específica
  const alt = grupos.slice(1).map(g => g[0].q).concat(p ? [p] : []);
  return { p: grupos[0][0].q, alternativas: alt, conflicto: grupos.length > 1 ? 'Dos reglas dicen cosas distintas' : '' };
}

// ═══ Reglas sugeridas ═══
// Palabras que no dicen nada: artículos, preposiciones y lo que pone el banco en toda transferencia
export const VACIAS = new Set(('A DE DEL LA LAS EL LOS Y E O EN POR PARA CON AL SU SUS UN UNA SA SPA LTDA EIRL CIA S P N NRO NUM NO ' +
  'TEF TRANSF TRANSFERENCIA TRANSFERENCIAS TRASPASO TRASPASOS PAGO PAGOS CARGO CARGOS ABONO ABONOS BANCOESTADO BANCO ESTADO CTA CTE CUENTA CORRIENTE ' +
  'INTERNET LINEA ONLINE OTROS OTRO BANCOS TERCEROS TERCERO ELECTRONICA ELECTRONICO DEP DEPOSITO DEPOSITOS RUT CHEQUERA COMPRA COMPRAS MOV MOVIMIENTO').split(' '));
export function tokens(desc) {
  return norm(desc).split(' ').filter(w => w.length >= 3 && !VACIAS.has(w) && !/^\d+[K]?$/.test(w) && !/^\d{7,8}[0-9K]$/.test(w) && (w.match(/\d/g) || []).length < 3);
}
// Las palabras sueltas y los pares de palabras (en orden) de una glosa
function rasgos(desc) {
  const t = [...new Set(tokens(desc))], out = new Set(t);
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length && j <= i + 2; j++) out.add(t[i] + '|' + t[j]);
  return out;
}
export const firmaSug = (lado, palabras, res) => `${lado}|${palabras.slice().sort().join('+')}|${claveRes(res)}`;
// hechos: [{ id, fecha, descripcion, monto, res: { tipo, … } (null si se resolvió con algo que no es una regla), clave: claveRes o 'otro:…' }]
// reglas: las de ese lado (todas: activas, pausadas, archivadas y descartadas). → [regla sugerida, sin guardar]
export function sugerencias(lado, hechos, reglas, hoy, opc = {}) {
  const corte = sumar(hoy, -(opc.dias || DIAS_SUGERIR)), H = (hechos || []).filter(h => h && h.fecha >= corte && h.clave);
  const firmas = new Set((reglas || []).filter(r => r.firma).map(r => r.firma));
  // Una sugerencia aceptada o descartada tapa también las otras palabras del mismo resultado que comparten alguna (RETIRO y SOCIO tapa RETIRO)
  const tapadas = (reglas || []).filter(r => r.firma).map(r => ({ k: claveRes(r.res), ws: r.cond.palabras || [] }));
  const tapada = (k, ws) => tapadas.some(x => x.k === k && x.ws.some(w => ws.includes(w)));
  const vivas = (reglas || []).filter(r => r.estado === 'activa' || r.estado === 'pausada');
  const conR = H.map(h => ({ ...h, R: rasgos(h.descripcion) }));
  const porClave = {}; conR.forEach(h => { if (h.res) (porClave[h.clave] = porClave[h.clave] || []).push(h); });
  const out = [];
  Object.entries(porClave).forEach(([k, l]) => {
    if (l.length < MIN_SUGERIR) return;
    const cuenta = new Map(); l.forEach(h => h.R.forEach(f => cuenta.set(f, (cuenta.get(f) || 0) + 1)));
    const cands = [...cuenta.entries()].filter(([, c]) => c >= MIN_SUGERIR).map(([f, c]) => ({ f, c, ws: f.split('|') }))
      .filter(x => !conR.some(h => h.clave !== k && x.ws.every(w => h.R.has(w))))
      .sort((a, b) => b.c - a.c || b.ws.length - a.ws.length || b.ws.join('').length - a.ws.join('').length);
    for (const x of cands) {
      const conF = l.filter(h => x.ws.every(w => h.R.has(w)));
      // Todos con la misma glosa exacta: eso ya lo cubre lo aprendido
      if (new Set(conF.map(h => norm(h.descripcion).replace(/\d{5,}/g, '#'))).size < 2) continue;
      const ult = conF.slice().sort((a, b) => s(b.fecha).localeCompare(s(a.fecha)))[0], res = limpiarRes(ult.res);
      const firma = firmaSug(lado, x.ws, res);
      if (firmas.has(firma) || tapada(claveRes(res), x.ws)) continue;   // ya aceptada o descartada
      // Ya hay una regla viva que hace lo mismo con esos movimientos
      if (vivas.some(r => claveRes(r.res) === claveRes(res) && conF.every(h => calza(r, { descripcion: h.descripcion, monto: h.monto, cuenta: h.cuenta, claves: h.claves || [], ruts: h.ruts || [] })))) continue;
      out.push({ id: 'sug-' + huella(firma), lado, estado: 'sugerida', nivel: 'proponer', origen: 'propuesta', cond: { tipo: 'contiene', palabras: x.ws, no: [], montoMin: null, montoMax: null, cuenta: '', rut: '' }, res, usos: 0, ultimoMonto: 0, usadoEl: '',
        creado: {}, actualizado: {}, historial: [], firma, evidencia: { n: conF.length, desde: conF.map(h => h.fecha).sort()[0], hasta: ult.fecha, ejemplos: conF.slice(0, 4).map(h => ({ fecha: h.fecha, descripcion: h.descripcion, monto: h.monto })) } });
      break;   // una sugerencia por resultado: la palabra (o el par) que más se repite
    }
  });
  return out.sort((a, b) => b.evidencia.n - a.evidencia.n).slice(0, opc.max || MAX_SUGERIDAS);
}
function sumar(f, k) { if (!/^\d{4}-\d{2}-\d{2}/.test(s(f))) return '0000-00-00'; const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + k)); return d.toISOString().slice(0, 10); }
// Lo ya revisado de Cargos como "hechos" para sugerir (vistaCargo de la memoria)
export function hechosCargos(cargos, vencs) {
  const pl = id => (((vencs || []).find(v => v.id === id)) || {}).plantillaId || '';
  return (cargos || []).filter(c => c && ['CONCILIADO', 'IGNORADO'].includes(c.estado) && c.accion).map(c => {
    const d = c.detalle || {}, base = { id: c.id, fecha: c.fecha, descripcion: c.descripcion, monto: c.monto, cuenta: c.cuenta, claves: [c.clave || claveCargo(c.descripcion)], ruts: [rutDe(c.descripcion)].filter(Boolean) };
    let res = null;
    if (c.accion === 'nuevo' && (d.items || []).length === 1) res = { tipo: 'nuevo', item: d.items[0], area: '' };
    else if (c.accion === 'ignorar') res = { tipo: 'ignorar', motivo: s(d.motivo) };
    else if (c.accion === 'pago_tarjeta') res = { tipo: 'pago_tarjeta', tarjeta: s(d.tarjeta) };
    else if (c.accion === 'traspaso') res = { tipo: 'traspaso', nota: s(d.nota) };
    else if (c.accion === 'abono' && d.abono && d.abono.plantillaId) res = { tipo: 'abono', plantillaId: s(d.abono.plantillaId), nombre: s(d.abono.nombre) };
    else if (c.accion === 'vencimientos' && (d.vencimientos || []).length === 1 && d.vencimientos[0].plantillaId) res = { tipo: 'vencimiento', vencimiento: 'p:' + d.vencimientos[0].plantillaId, nombre: s(d.vencimientos[0].nombre) };
    return { ...base, res, clave: res ? claveRes(res) : 'otro:' + c.accion };
  });
}
// El área del gasto nuevo (de los gastos ligados al cargo, si están en la memoria): para que la sugerencia traiga ítem y área
export function conArea(hechos, ligados) {
  return (hechos || []).map(h => { if (!h.res || h.res.tipo !== 'nuevo' || h.res.area) return h; const l = (ligados || {})[h.id] || []; const as = [...new Set(l.map(g => g.area).filter(Boolean))];
    if (as.length !== 1) return h; const res = { ...h.res, area: as[0] }; return { ...h, res, clave: claveRes(res) }; });
}
// Lo ya revisado de B2B (movimientos de 120 días) como "hechos"
export function hechosAbonos(movs) {
  return (movs || []).filter(m => m && ['conciliado', 'ignorado', 'revisado'].includes(m.estado) && m.origen !== 'app antigua').map(m => {
    const base = { id: m.id, fecha: s(m.fecha).slice(0, 10), descripcion: m.descripcion, monto: m.monto, cuenta: m.cuenta || 'chequera', claves: ['txt:' + (m.descNorm || norm(m.descripcion))], ruts: [rutDe(m.descripcion)].filter(Boolean) };
    let res = null;
    if (m.estado === 'conciliado' && m.clienteId) res = { tipo: 'cliente', clienteId: m.clienteId, nombre: m.cliente || '' };
    else if (m.estado === 'ignorado') res = { tipo: 'noB2B', motivo: '' };
    else if (m.estado === 'revisado') res = { tipo: 'revisado', clienteId: m.clienteId || '', nombre: m.cliente || '' };
    return { ...base, res, clave: res ? claveRes(res) : 'otro:' + m.estado };
  });
}
