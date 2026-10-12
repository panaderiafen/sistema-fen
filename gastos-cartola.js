// ═══════════════════════════════════════════════
//  Sistema Fën — Cartola con la base nueva (etapa G3, tercera parte): reglas puras  v0.50.0
//  Solo con la base nueva (config/gastos: fuente "base"). Con la planilla, cartola.js sigue igual que en la v0.49.0.
//  · Lo mismo que hacía Cartola.gs del script (estados POR_REVISAR / CONCILIADO / IGNORADO / A_MEDIAS, huella e id de
//    cada cargo, ya visto por huella o por N° de operación, la clave de lo aprendido por RUT o por descripción, la traza
//    "Cartola N°…[cc…]", aprender y desaprender con veces y último monto), ahora sobre las colecciones de fen-gastos
//    cartolas, cartola_cargos y cartola_reglas (con la forma de la copia G1: los nombres de las columnas de la planilla).
//  · Las propuestas con la forma de trabajar acordada (12-oct):
//     1) monto fijo: un cargo del monto exacto del vencimiento (±$0) dentro de la ventana de fechas → "pagar este
//        vencimiento", seguro;
//     2) según documento: por el monto del documento (boleta o SII), cuando ya llegó. Dos vencimientos con la misma
//        descripción en el banco se distinguen por ese monto; si los montos chocan o falta el documento, no hay
//        propuesta automática: se muestran las opciones;
//     3) libre (sueldos líquidos): lo aprendido propone "abono a …", nunca seguro; nunca se cierra solo.
//    Después, lo de siempre: RUT de la transferencia, gasto ya registrado del mismo monto (−3 a +10 días) y gasto nuevo
//    aprendido. La cartola nunca crea obligaciones.
//  Sin red: se prueba sola. Fechas aaaa-mm-dd (hora de Chile).
// ═══════════════════════════════════════════════
import * as G3 from './gastos-g3.js?v=0.51.0';

export const ESTADOS = { revisar: 'POR_REVISAR', conciliado: 'CONCILIADO', ignorado: 'IGNORADO', aMedias: 'A_MEDIAS' };
export const CUENTAS = { cc: 'Cta. Cte.', chequera: 'Chequera' };
// Ventana de fechas para el monto fijo y el documento: el cargo puede llegar hasta 15 días antes del vencimiento y hasta 10 después
export const VENTANA = { antes: 15, despues: 10 };

const s = v => String(v == null ? '' : v);
const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const x = Number(s(v).replace(/,\d{1,2}$/, '').replace(/[^0-9-]/g, '')); return isFinite(x) ? x : 0; };
const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
// Como sfTexto del script
export const texto = (v, max = 200) => s(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max).replace(/^[=+\-@\s]+/, '').trim();
export const dia = v => { const t = s(v).trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const dias = (a, b) => Math.round((Date.UTC(...a.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0))) - Date.UTC(...b.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))) / 864e5);
const dma = iso => { const p = s(iso).split('-'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s(iso); };

// ── Lo mismo que Cartola.gs ──
export const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const dv = n => { let x = 0, m = 2; const t = s(n); for (let i = t.length - 1; i >= 0; i--) { x += Number(t[i]) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (x % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };
export function rutDe(desc) {
  const re = /(?:^|[^0-9])(\d{1,2}\.?\d{3}\.?\d{3})-?([0-9kK])(?![0-9])/g;
  let m;
  while ((m = re.exec(s(desc)))) { const n = m[1].replace(/\./g, ''); if (n.length >= 7 && dv(n) === m[2].toUpperCase()) return n + m[2].toUpperCase(); }
  return '';
}
export const rutNorm = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
export const claveDe = desc => { const r = rutDe(desc); return r ? 'rut:' + r : 'txt:' + norm(desc).replace(/\d{5,}/g, '#').slice(0, 80); };
export const huellaDe = c => ['C', c.cuenta, c.fecha, Math.round(c.saldo), Math.round(c.monto), norm(c.descripcion)].join('|');
// Id del cargo: "cc" + los 10 primeros del SHA-256 de la huella (como ccId del script). sha: función async (texto) → hex
export const idDe = async (huella, sha) => 'cc' + (await sha(huella)).slice(0, 10);
const claveOp = (cu, f, m, op) => (op && Number(op) > 0 ? [cu, f, Math.round(m), s(op).replace(/^0+/, '')].join('|') : '');
// "Cartola N°012 · Cta. Cte. ···0123 · cargo 07-09-2026 · op. 5550101 · subida 08-10-2026 [cc1a2b3c4d5e]"
export function traza(c, sii) {
  return [(c.nCartola ? 'Cartola N°' + c.nCartola : 'Cartola en línea'), (CUENTAS[c.cuenta] || c.cuenta) + (c.cuentaN ? ' ···' + c.cuentaN : ''), 'cargo ' + dma(c.fecha)]
    .concat(c.operacion ? ['op. ' + c.operacion] : []).concat(['subida ' + dma(s(c.subidaEl).slice(0, 10))]).concat(sii ? [sii] : []).join(' · ') + ' [' + c.id + ']';
}

// ── Cargo de la base (copiado de la planilla en G1 o hecho en la base) → como lo entrega cc_lista ──
const json = t => { if (t && typeof t === 'object') return t; try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
export function vistaCargo(id, d) {
  const c = { id: s(d.id) || id, docId: id, huella: s(d.huella), cuenta: s(d.cuenta), cuentaN: s(d.cuentaN), fecha: dia(d.fecha), descripcion: s(d.descripcion), monto: num(d.monto), saldo: num(d.saldo),
    operacion: s(d.nOperacion), cartola: s(d.cartola), nCartola: s(d.nCartola), subidaEl: s(d.subidaEl).slice(0, 16), subidaPor: s(d.subidaPor), estado: s(d.estado),
    accion: s(d.accion), detalle: json(d.detalle), resueltoEl: s(d.resueltoEl).slice(0, 16), resueltoPor: s(d.resueltoPor), historial: s(d.historial), version: Number(d.version) || 0 };
  c.rut = rutDe(c.descripcion); c.clave = claveDe(c.descripcion);
  return c;
}
export const vistaCartola = (id, d) => ({ docId: id, id: s(d.cartola), cuenta: s(d.cuenta), cuentaN: s(d.cuentaN), tipo: s(d.tipo), nCartola: s(d.nCartola), desde: dia(d.desde), hasta: dia(d.hasta),
  cargos: num(d.cargos), nuevos: num(d.nuevos), yaVistos: num(d.yaVistos), ignorados: num(d.ignorados), subidaEl: s(d.subidaEl).slice(0, 16), archivo: s(d.archivo) });
export const vistaRegla = (id, d) => ({ docId: id, clave: s(d.clave), accion: s(d.accion), item: s(d.item), area: s(d.area), vencimiento: s(d.vencimiento), sinFactura: s(d.sinFactura) === 'Sí' || d.sinFactura === true,
  ejemplo: s(d.ejemplo), veces: num(d.veces), monto: num(d.ultimoMonto), actualizado: s(d.actualizado).slice(0, 16), quitada: !!(d.quitada && s(d.quitada)) });
// Reglas vivas por clave (una regla quitada no cuenta)
export function mapaReglas(reglas) { const out = {}; (reglas || []).forEach(r => { if (r.clave && !r.quitada && r.veces > 0) out[r.clave] = r; }); return out; }

// ── Subir los cargos (ccCargar): limpiar y decidir qué es nuevo ──
// meta = { id, tipo, cuenta, numero, nCartola, desde, hasta }. Devuelve { error } o { cuenta, ident, cuentaN, nCartola, limpios }
export function limpiarCarga(meta, lista) {
  const c = meta || {}, cuenta = CUENTAS[c.cuenta] ? s(c.cuenta) : '';
  if (!cuenta) return { error: 'Falta la cuenta de la cartola' };
  const ident = texto(c.id, 120);
  if (!ident) return { error: 'Falta el nombre de la cartola' };
  if (!Array.isArray(lista)) return { error: 'Faltan los cargos' };
  if (lista.length > 2000) return { error: 'Son demasiados cargos de una vez (máximo 2000)' };
  const limpios = [];
  for (let i = 0; i < lista.length; i++) {
    const x = lista[i] || {}, monto = Math.round(Number(x.monto)), saldo = Math.round(Number(x.saldo));
    if (!esIso(x.fecha) || !(monto > 0) || isNaN(saldo)) return { error: 'Un cargo no es válido (fila ' + (i + 1) + ')' };
    limpios.push({ cuenta, fecha: x.fecha, descripcion: texto(x.descripcion, 200), monto, saldo, operacion: s(x.operacion).replace(/\D/g, '').slice(0, 20) });
  }
  return { cuenta, ident, cuentaN: s(c.numero).replace(/\D/g, '').slice(-4), nCartola: s(c.nCartola).replace(/[^0-9A-Za-z]/g, '').slice(0, 10), limpios };
}
// existentes: cargos vistaCargo; limpios con { id, huella } ya calculados; reglas: mapaReglas.
// Devuelve { nuevos: [{ id, doc }], cuenta: { cargos, nuevos, yaVistos, ignorados } }
export function planCarga(L, existentes, reglas, ahora, quien) {
  const ya = new Set(), porOp = new Set();
  (existentes || []).forEach(c => { ya.add(c.id); const k = claveOp(c.cuenta, c.fecha, c.monto, c.operacion); if (k) porOp.add(k); });
  const r = { cargos: L.limpios.length, nuevos: 0, yaVistos: 0, ignorados: 0 }, nuevos = [];
  L.limpios.forEach(x => {
    const ko = claveOp(L.cuenta, x.fecha, x.monto, x.operacion);
    if (ya.has(x.id) || (ko && porOp.has(ko))) { r.yaVistos++; return; }
    ya.add(x.id); if (ko) porOp.add(ko);
    const regla = reglas[claveDe(x.descripcion)], ign = regla && regla.accion === 'ignorar';
    nuevos.push({ id: x.id, doc: { id: x.id, huella: x.huella, cuenta: L.cuenta, cuentaN: L.cuentaN, fecha: x.fecha, descripcion: x.descripcion, monto: x.monto, saldo: x.saldo, nOperacion: x.operacion,
      cartola: L.ident, nCartola: L.nCartola, subidaEl: ahora, subidaPor: quien, estado: ign ? ESTADOS.ignorado : ESTADOS.revisar, accion: ign ? 'ignorar' : '',
      detalle: ign ? JSON.stringify({ motivo: regla.ejemplo || 'No es gasto', regla: true }) : '', resueltoEl: ign ? ahora : '', resueltoPor: ign ? 'regla (siempre)' : '', historial: '' } });
    if (ign) r.ignorados++; else r.nuevos++;
  });
  return { nuevos, cuenta: r };
}
// La fila de la cartola (una vez por cartola y cuenta; una cartola grande llega en partes: la parte 2 en adelante suma)
export function filaCartola(previa, meta, L, r, parte, ahora, quien) {
  const f = { cartola: L.ident, cuenta: L.cuenta, cuentaN: L.cuentaN, tipo: meta.tipo === 'historica' ? 'histórica' : 'en línea', nCartola: L.nCartola,
    desde: esIso(meta.desde) ? meta.desde : '', hasta: esIso(meta.hasta) ? meta.hasta : '', cargos: r.cargos, nuevos: r.nuevos, yaVistos: r.yaVistos, ignorados: r.ignorados, subidaEl: ahora, subidaPor: quien };
  if (previa && Number(parte) > 0) ['cargos', 'nuevos', 'yaVistos', 'ignorados'].forEach(k => { f[k] += num(previa[k]); });
  return f;
}

// ── Aprender (ccAprender / ccDesaprender) ──
// act: la regla de esa clave (vistaRegla, puede estar quitada) o null. Devuelve los campos del documento de la regla.
export function aprender(act, clave, regla, desc, ahora, quien) {
  const vivo = act && !act.quitada && act.veces > 0;
  const igual = vivo && act.accion === regla.accion && act.item === (regla.item || '') && act.vencimiento === (regla.vencimiento || '');
  return { clave, accion: regla.accion, item: regla.item || '', area: regla.area || '', vencimiento: regla.vencimiento || '', sinFactura: regla.sinFactura ? 'Sí' : '',
    ejemplo: texto(regla.ejemplo || desc, 120), veces: igual ? act.veces + 1 : 1, ultimoMonto: regla.monto || '', actualizado: ahora, por: quien, quitada: '' };
}
// La regla pierde una vez; si queda en cero, queda quitada (en la base no se borra). null = no se toca
export function desaprender(act, accion, ahora, quien) {
  if (!act || act.quitada || act.accion !== accion) return null;
  if (act.veces > 1) return { veces: act.veces - 1, actualizado: ahora, por: quien };
  return { veces: 0, quitada: `${ahora} · ${quien} (deshecho)`, actualizado: ahora, por: quien };
}
// Qué se olvida al deshacer (como ccDeshacer): un "no es gasto" de una vez o uno ignorado por la regla no la toca
export function aDesaprender(c) {
  if (c.estado === ESTADOS.aMedias) return null;
  if (c.accion === 'ignorar') return c.detalle && c.detalle.siempre ? 'ignorar' : null;
  return { vencimientos: 'vencimiento', nuevo: 'gasto', abono: 'abono' }[c.accion] || null;
}
// "Deshecho … por …: motivo (antes: …)", al final del historial (texto, como la columna Historial)
export function conDeshecho(c, motivo, ahora, quien) {
  const antes = c.accion + (c.detalle ? ' ' + JSON.stringify(c.detalle).slice(0, 300) : '') + ' · ' + c.resueltoEl + ' ' + c.resueltoPor;
  return ((c.historial ? c.historial + '\n' : '') + 'Deshecho ' + ahora + ' por ' + quien + ': ' + motivo + ' (antes: ' + antes + ')').slice(-5000);
}
// Vuelta de resolución: cuántas veces se deshizo. Con ella se arman ids fijos por cargo (un reintento no duplica; después de
// deshacer, la siguiente vez usa otros ids)
export const vuelta = c => (s(c.historial).match(/(^|\n)Deshecho /g) || []).length;
export const marcaDe = (c, k) => ({ t: s(c.id), r: 'r' + vuelta(c) + (k !== undefined ? 'v' + k : '') });

// ── Vencimientos abiertos para la cartola (con su tipo y su documento) ──
// vencs: [{ id, d }] de la base; plantillas: [{ id, d }]; siiRut: { vencId → rut } (facturas del SII importadas)
export function vencimientosAbiertos(vencs, plantillas, siiRut, hoy) {
  const obl = {}; (plantillas || []).forEach(x => { obl[s(x.d.id) || x.id] = x.d; });
  const out = [];
  (vencs || []).forEach(({ id, d }) => {
    if (!d || d.quitadoEnPlanilla || !G3.abierto(d)) return;
    const pid = s(d.plantillaID), o = pid ? obl[pid] : null;
    const tipo = s(d.tipoObligacion) || (o ? G3.tipoDe(o) : '');
    const ma = Array.isArray(d.multiArea) ? d.multiArea : json(d.multiArea);
    const estimado = Array.isArray(ma) && ma.length ? ma.reduce((t, a) => t + num(a.monto), 0) : num(d.montoEstimado);
    const m = /^\s*📋\s*(.*?)\s+F\.(\d+)\s*$/.exec(s(d.nombre));
    const montoDoc = d.documento && num(d.montoDocumento) > 0 ? num(d.montoDocumento) : 0;
    out.push({ id, nombre: s(d.nombre), item: s(d.item), fecha: G3.fechaReal(d), monto: montoDoc || estimado, estimado, plantillaId: pid,
      estado: G3.estadoVista(d, hoy), estadoBase: G3.estadoBase(d), tipoObligacion: pid ? (o && G3.sinClasificar(o) && !s(d.tipoObligacion) ? 'sin_clasificar' : tipo || 'fijo') : '',
      montoDocumento: montoDoc, conDocumento: !!d.documento, abonos: Array.isArray(d.abonos) ? d.abonos : [], suelto: d.suelto === true, obs: s(d.obs),
      folio: m ? m[2] : '', razon: m ? m[1].trim() : '', rut: (siiRut && siiRut[id]) || (d.documento && d.documento.tipo === 'sii' ? rutNorm(d.documento.rut) : ''), sii: '' });
  });
  return out.sort((a, b) => s(a.fecha).localeCompare(s(b.fecha)) || a.id.localeCompare(b.id));
}

// ═══════════════════════════════════════════════
//  Propuestas (forma de trabajar acordada)
// ═══════════════════════════════════════════════
const enVentana = (c, v) => !!v.fecha && dias(c.fecha, v.fecha) >= -VENTANA.antes && dias(c.fecha, v.fecha) <= VENTANA.despues;
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesCorto = f => (esIso(f) ? MESES_C[Number(f.slice(5, 7)) - 1] : '');
const opcion = v => ({ id: v.id, nombre: v.nombre, monto: v.montoDocumento || v.monto || 0, fecha: v.fecha, conDocumento: !!v.conDocumento, tipo: v.tipoObligacion });
const pagoDe = (c, v, por, seguro, texto0) => ({ tipo: 'vencimientos', seguro, pagos: [{ id: v.id, monto: c.monto }], texto: texto0 || v.nombre, por });
// Vencimientos de facturas (sin obligación) que suman exacto el cargo (como cartola.js)
export function combinacion(vencs, monto) {
  const l = vencs.filter(v => v.monto > 0).slice().sort((a, b) => s(a.fecha).localeCompare(s(b.fecha))).slice(0, 12);
  let t = 0;
  for (let i = 0; i < l.length; i++) { t += l[i].monto; if (t === monto) return l.slice(0, i + 1); if (t > monto) break; }
  let mejor = null;
  for (let m = 1; m < (1 << l.length); m++) {
    let x = 0; const el = [];
    for (let i = 0; i < l.length; i++) if (m & (1 << i)) { x += l[i].monto; el.push(i); }
    if (x !== monto) continue;
    const k = el.join(',');
    if (!mejor || el.length < mejor.el.length || (el.length === mejor.el.length && k < mejor.k)) mejor = { el, k };
  }
  return mejor ? mejor.el.map(i => l[i]) : null;
}
// c: cargo (vistaCargo); D: { reglas, vencimientos (vencimientosAbiertos), gastos }. null = sin propuesta.
// Devuelve { tipo: 'vencimientos'|'abono'|'gasto'|'nuevo'|'ignorar', seguro, por, texto, pagos?, vencId?, opciones? }
export function proponer(c, D) {
  const reglas = {}; (D.reglas || []).forEach(r => { if (!r.quitada) reglas[r.clave] = r; });
  const regla = reglas[c.clave || claveDe(c.descripcion)];
  const vencs = D.vencimientos || [];
  // 0) "No es gasto" aprendido
  if (regla && regla.accion === 'ignorar') return { tipo: 'ignorar', seguro: true, motivo: regla.ejemplo || 'No es gasto', por: 'aprendido' };
  const aprendidoP = regla && (regla.accion === 'vencimiento' || regla.accion === 'abono') && s(regla.vencimiento).startsWith('p:') ? s(regla.vencimiento).slice(2) : '';
  // 1) Monto fijo: el monto exacto del vencimiento, dentro de la ventana
  const fijos = vencs.filter(v => v.plantillaId && v.tipoObligacion === 'fijo' && v.estadoBase !== 'con_abonos' && v.monto === c.monto && enVentana(c, v));
  if (fijos.length === 1) return pagoDe(c, fijos[0], 'monto fijo', true);
  if (fijos.length > 1) {
    // Varios del mismo monto: lo aprendido decide cuál (sin quitarle la duda: a revisar)
    const ap = fijos.find(v => v.plantillaId === aprendidoP) || fijos[0];
    return { ...pagoDe(c, ap, 'monto fijo', false), opciones: fijos.map(opcion), duda: `Hay ${fijos.length} vencimientos de monto fijo de ${fmt(c.monto)}: revisa cuál es.` };
  }
  // 2) Según documento: por el monto del documento (boleta o SII), ya llegado
  const docs = vencs.filter(v => v.plantillaId && v.tipoObligacion === 'documento');
  const conMonto = docs.filter(v => v.montoDocumento > 0 && v.montoDocumento === c.monto && enVentana(c, v));
  if (conMonto.length === 1) return pagoDe(c, conMonto[0], 'documento', true, `${conMonto[0].nombre} (documento de ${fmt(conMonto[0].montoDocumento)})`);
  // Choque de montos, o lo aprendido apunta a una obligación según documento sin documento todavía: opciones, sin propuesta automática
  // Lo aprendido apunta a una obligación; las de su mismo ítem (Luz Barros y Luz Ainavillo) son las opciones.
  // Sin nada aprendido: las que esperan su documento con un monto estimado parecido (±30%).
  const delAprendido = aprendidoP ? docs.filter(v => v.plantillaId === aprendidoP) : [];
  const itemAp = delAprendido.length ? delAprendido[0].item : '';
  const parecidos = !regla ? docs.filter(v => !v.conDocumento && v.estimado > 0 && Math.abs(v.estimado - c.monto) <= v.estimado * 0.3 && enVentana(c, v)) : [];
  if (conMonto.length > 1 || delAprendido.length || parecidos.length) {
    const ops = conMonto.length > 1 ? conMonto : delAprendido.length ? docs.filter(v => (v.plantillaId === aprendidoP || (itemAp && v.item === itemAp)) && enVentana(c, v)) : parecidos;
    const lista = (ops.length ? ops : delAprendido).slice(0, 6);
    return { tipo: 'vencimientos', seguro: false, sinPropuesta: true, pagos: [], opciones: lista.map(opcion), por: conMonto.length > 1 ? 'documento' : 'aprendido',
      texto: lista.map(v => v.nombre).join(' o '),
      duda: conMonto.length > 1 ? `Los documentos de ${lista.map(v => v.nombre).join(' y ')} son del mismo monto: elige cuál paga.` : `Falta el documento (o no calza el monto): elige cuál paga.` };
  }
  // 3) Libre (sueldos líquidos): lo aprendido propone un abono, nunca seguro
  if (regla && regla.accion === 'abono' && aprendidoP) {
    const l = vencs.filter(v => v.plantillaId === aprendidoP && v.tipoObligacion === 'libre');
    if (l.length) {
      const v = l.slice().sort((a, b) => Math.abs(dias(a.fecha, c.fecha)) - Math.abs(dias(b.fecha, c.fecha)))[0];
      return { tipo: 'abono', seguro: false, vencId: v.id, texto: v.nombre, por: 'aprendido', opciones: l.map(opcion) };
    }
  }
  // 4) Lo aprendido de un vencimiento (fijo o sin clasificar): a revisar si no es el monto exacto
  if (regla && regla.accion === 'vencimiento') {
    const t = s(regla.vencimiento).slice(0, 2), val = s(regla.vencimiento).slice(2);
    const cand = vencs.filter(v => v.tipoObligacion !== 'libre' && v.tipoObligacion !== 'documento' && (t === 'p:' ? v.plantillaId === val : t === 'rut:' ? v.rut === val : norm(v.razon || v.nombre).startsWith(val)));
    if (t === 'p:' && cand.length) {
      const v = cand.slice().sort((a, b) => Math.abs(dias(a.fecha, c.fecha)) - Math.abs(dias(b.fecha, c.fecha)))[0];
      if (Math.abs(dias(c.fecha, v.fecha)) <= 45) return pagoDe(c, v, 'aprendido', false, v.nombre + (v.monto && v.monto !== c.monto ? ` (estimado ${fmt(v.monto)})` : ''));
    }
    const comb = t !== 'p:' ? combinacion(cand, c.monto) : null;
    if (comb) return { tipo: 'vencimientos', seguro: true, pagos: comb.map(v => ({ id: v.id, monto: v.monto })), texto: comb.map(v => v.nombre).join(' + '), por: 'aprendido' };
  }
  // 5) El RUT de la transferencia: facturas de ese proveedor
  if (c.rut) {
    const comb = combinacion(vencs.filter(v => !v.plantillaId && v.rut === c.rut), c.monto);
    if (comb) return { tipo: 'vencimientos', seguro: true, pagos: comb.map(v => ({ id: v.id, monto: v.monto })), texto: comb.map(v => v.nombre).join(' + '), por: 'rut' };
  }
  // 6) Un gasto al contado ya registrado, del mismo monto, de −3 a +10 días (el más cercano)
  const gs = (D.gastos || []).filter(g => Math.abs(g.monto - c.monto) <= g.filas.length && dias(c.fecha, g.fecha) >= -3 && dias(c.fecha, g.fecha) <= 10 && (!c.rut || !g.rut || g.rut === c.rut))
    .map(g => ({ g, dist: Math.abs(dias(c.fecha, g.fecha)), rut: !!(c.rut && g.rut === c.rut) })).sort((a, b) => (b.rut - a.rut) || a.dist - b.dist);
  if (gs.length) {
    const [a, b] = gs, empate = b && b.rut === a.rut && b.dist === a.dist;
    return { tipo: 'gasto', seguro: !empate && (a.rut || (gs.length === 1 && a.dist <= 3)), gasto: a.g, texto: `${a.g.razon ? a.g.razon + ' · ' : ''}del ${dma(a.g.fecha)}` + (gs.length > 1 ? ` (hay ${gs.length - 1} más del mismo monto)` : ''), por: a.rut ? 'rut' : 'monto', otros: gs.slice(1, 4).map(x => x.g) };
  }
  // 7) Gasto nuevo aprendido (seguro con 2 o más veces y el monto parecido al último, ±50%)
  if (regla && regla.accion === 'gasto') return { tipo: 'nuevo', seguro: regla.veces >= 2 && (!regla.monto || Math.abs(c.monto - regla.monto) <= regla.monto * 0.5), item: regla.item, area: regla.area, sinFactura: !!regla.sinFactura, texto: regla.item, por: 'aprendido' };
  // 8) Un vencimiento sin clasificar con el monto exacto: a revisar (el tipo "monto fijo" lo deja seguro)
  const ex = vencs.filter(v => v.tipoObligacion !== 'libre' && v.tipoObligacion !== 'documento' && v.monto === c.monto && enVentana(c, v));
  if (ex.length === 1) return pagoDe(c, ex[0], 'monto', false);
  return null;
}
const fmt = n => '$' + Math.round(n).toLocaleString('es-CL');

// Lo que se aprende al resolver (regla), según la acción
export function reglaDe(accion, c, x) {
  if (accion === 'vencimientos') { const v0 = x.pagados[0]; return { accion: 'vencimiento', vencimiento: v0.plantillaId ? 'p:' + v0.plantillaId : (v0.rut ? 'rut:' + v0.rut : 'n:' + norm(v0.razon || v0.nombre).slice(0, 60)), ejemplo: v0.nombre, monto: c.monto }; }
  if (accion === 'abono') return { accion: 'abono', vencimiento: 'p:' + x.plantillaId, ejemplo: x.nombre, monto: c.monto };
  if (accion === 'nuevo') return { accion: 'gasto', item: x.it0.item, area: x.it0.prorrateo ? JSON.stringify(x.it0.prorrateo) : (x.it0.areas.length === 1 ? x.it0.areas[0].area : ''), sinFactura: !!x.sinFactura, ejemplo: c.descripcion, monto: c.monto };
  if (accion === 'ignorar' && x.siempre) return { accion: 'ignorar', ejemplo: x.motivo };
  return null;
}
// Pagos de varios vencimientos: revisa como ccPagarVencimientos. vs: { id → vencimiento abierto (vencimientosAbiertos) }
export function revisarPagos(pagos, c, vs) {
  if (!Array.isArray(pagos) || !pagos.length || pagos.length > 20) return { error: 'Elige el o los vencimientos que paga este cargo' };
  const vistos = new Set(), out = [];
  let suma = 0;
  for (const p of pagos) {
    const id = s(p && p.id), monto = Math.round(Number(p && p.monto));
    if (!id || vistos.has(id)) return { error: 'Vencimiento repetido o vacío' };
    vistos.add(id);
    if (!(monto > 0)) return { error: 'Cada vencimiento necesita su monto' };
    const v = vs[id];
    if (!v) return { error: 'Un vencimiento ya no está por pagar. Recarga la lista.', code: 'pagado' };
    if (v.tipoObligacion === 'libre') return { error: `"${v.nombre}" es de tipo libre: asígnale el cargo como abono.` };
    if (v.estadoBase === 'con_abonos') return { error: `"${v.nombre}" tiene abonos: agrega otro abono o ciérralo.` };
    if (!v.plantillaId && !v.suelto && v.monto && Math.abs(v.monto - monto) > 1) return { error: `"${v.nombre}" es de ${v.monto}: una factura o compra a crédito se paga completa (este cargo le asigna ${monto}).` };
    out.push({ v, monto }); suma += monto;
  }
  if (suma !== c.monto) return { error: `Los vencimientos suman ${suma} y el cargo es de ${c.monto}` };
  return { pedidos: out };
}
// Reparto por área de un pago de obligación con varias áreas: en la proporción de lo estimado (como el script)
export function repartoPago(multiArea, monto) {
  const l = Array.isArray(multiArea) ? multiArea : json(multiArea);
  if (!Array.isArray(l) || !l.length) return [];
  const est = l.reduce((t, a) => t + num(a.monto), 0);
  let resto = monto;
  return l.map((a, j) => { const m = j === l.length - 1 ? resto : Math.round(monto * (est ? num(a.monto) / est : 1 / l.length)); resto -= m; return { area: s(a.area), monto: m }; });
}

// Resumen de lo que se va a confirmar de una vez: cuántos, cuánto y de qué tipo
export function resumenLote(lista) {
  const r = { n: lista.length, monto: 0, porTipo: {} };
  lista.forEach(x => { r.monto += x.c.monto; r.porTipo[x.p.tipo] = (r.porTipo[x.p.tipo] || 0) + 1; });
  return r;
}
// Gastos al contado de los últimos 5 meses sin cartola, agrupados por registro (para "ya estaba en Gastos")
export function gastosSinCartola(gastos, hoy) {
  const corte = G3.sumarDias(hoy, -150), porRegistro = {}, out = [];
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.estado !== 'vigente' || d.quitadoEnPlanilla || s(d.cartola).match(/\[cc[0-9a-f]{10}\]/) || d.cartolaCargo) return;
    const f = dia(d.fecha), monto = num(d.montoFinal);
    if (!f || f < corte || s(d.formaPago) !== 'contado' || !(monto > 0)) return;
    const k = [f, s(d.hora), s(d.observacion), s(d.urlFoto), s(d.rutProveedor)].join('|');
    let x = porRegistro[k];
    if (!x) { x = porRegistro[k] = { fecha: f, hora: s(d.hora).slice(0, 5), items: [], monto: 0, obs: s(d.observacion), rut: rutNorm(d.rutProveedor), razon: s(d.razonSocial), folio: s(d.folio), filas: [] }; out.push(x); }
    if (x.filas.length >= 40) return;
    x.filas.push({ fila: id, id, version: Number(d.version) || 0, item: s(d.itemGasto), area: s(d.area), monto }); x.monto += monto;
    if (!x.items.includes(s(d.itemGasto))) x.items.push(s(d.itemGasto));
  });
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 800);
}
