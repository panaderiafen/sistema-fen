// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo → Finanzas (Etapa 4, el puente)  v0.101.0 · reglas puras, sin red
//  Finanzas sigue trabajando con "gastos" de una línea (ítem, área, neto, fecha), como los del Gastos anterior. Aquí cada parte de cada
//  documento clasificado del Gastos nuevo se entrega en esa misma forma. Así el estado de resultados, la cuadratura, los cierres y los
//  ajustes de meses cerrados no cambian.
//  Corte (acordado con Emmanuel el 25 oct): hasta septiembre manda el Gastos anterior; desde el inicio (octubre) solo el Gastos nuevo.
//  · El mes de cada documento es su "mes" (el de la factura; el del período en boletas, Previred, F29 y liquidaciones).
//  · Un documento que se reparte en 6 o 12 meses (patentes, permisos) entrega una línea por mes (el último absorbe el redondeo).
//  · Lo del Gastos nuevo que es de ANTES del inicio (deuda anterior, la parte de junio a septiembre de una patente) se decide uno por uno,
//    porque solo Emmanuel sabe si estaba en el Gastos anterior: si tiene el mismo RUT y folio que un gasto del anterior, ya estaba (no entra);
//    si no, queda "por decidir" (no entra hasta decidir) y él elige "Ya estaba en el anterior" o "Entra en octubre" (como "Ajuste de meses
//    anteriores", visible). Así nada se cuenta dos veces por una coincidencia dudosa.
//  · Lo pagado con un cargo de antes del inicio que ya era gasto en el anterior ("ya está en el Gastos anterior" al pagar): esa parte no
//    entra de nuevo (el anterior la contó en su mes).
//  · Sin clasificar o "Esto no va": no entrega líneas (el cierre de mes avisa lo sin clasificar).
//  · Las notas de crédito vienen en negativo desde el SII: sus partes restan solas.
//  También: la revisión de octubre (gn_config/revisionAnterior), en dos partes: (A) los gastos del Gastos anterior con fecha desde el inicio
//  (anotados antes de que existiera el nuevo) y (B) los documentos del nuevo de antes del inicio.
// ═══════════════════════════════════════════════
import * as GB from './gn-bandeja.js?v=0.101.0';

const s = v => String(v == null ? '' : v).trim();
const entero = v => { const x = Math.round(Number(v)); return isFinite(x) ? x : 0; };
const rutN = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const folioN = f => s(f).replace(/[^0-9A-Za-z]/g, '').replace(/^0+(?=\d)/, '');
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
const sigMes = m => { const [y, n] = m.split('-').map(Number); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`; };
const ultimoDia = m => { const [y, n] = m.split('-').map(Number); return `${m}-${String(new Date(Date.UTC(y, n, 0)).getUTCDate()).padStart(2, '0')}`; };
const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesCorto = m => (/^\d{4}-\d{2}$/.test(s(m)) ? `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : s(m));
export const TOL = 5;
const hashCorto = t => { let h = 5381; for (const c of s(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };

// Un gasto del Gastos anterior que cuenta (como en Finanzas: no quitado ni anulado)
export const vigenteAnterior = g => !!g && !g.quitadoEnPlanilla && !/^anulad/i.test(s(g.estado));
const fechaAnt = g => (/^(\d{4}-\d{2}-\d{2})/.exec(s(g && g.fecha)) || [])[1] || '';
// El folio de un gasto del anterior: el campo folio o, si no, el de la observación ("F 123", "NC 45"), como las sugerencias
export const folioAnterior = g => folioN(s(g && g.folio) || s((/(?:F|NC)\.?\s*(\d+)/.exec(s(g && g.observacion)) || [])[1]));
export const llaveB = docId => 'n:' + docId;   // la decisión de un documento del nuevo de antes del inicio (parte B)

// ── ¿Ya estaba en el Gastos anterior (antes del inicio)? Solo por RUT y folio: lo demás lo decide Emmanuel ──
export function indiceAnterior(gastos, inicio) {
  const conFolio = new Set();
  (gastos || []).filter(vigenteAnterior).forEach(g => {
    const f = fechaAnt(g); if (!f || f >= inicio) return;
    const r = rutN(g.rutProveedor || g.rut), fo = folioAnterior(g);
    if (r && fo) conFolio.add(r + '|' + fo);
  });
  return { conFolio };
}
export function enAnteriorDoc(d, I) {
  const r = rutN(d.rutN || d.rut), fo = folioN(d.folio);
  return !!(I && r && fo && I.conFolio.has(r + '|' + fo));
}

// ── Los meses en que cuenta un documento: el suyo, o 6 / 12 desde el inicio de su período ──
export function mesesDoc(d) {
  const n = Number(d.prorratear) || 0, m0 = s(d.mes) || s(d.fecha).slice(0, 7);
  if (!(n > 1)) return [m0];
  let m = (d.periodo && esIso(d.periodo.desde) ? d.periodo.desde.slice(0, 7) : m0); const out = [];
  for (let i = 0; i < n; i++) { out.push(m); m = sigMes(m); }
  return out;
}
const repartirEn = (monto, n) => { const b = Math.trunc(monto / n), out = Array(n).fill(b); out[n - 1] = monto - b * (n - 1); return out; };
// ¿Tiene algo de antes del inicio? (su mes, o el primer mes de su reparto)
export const esDeAntes = (d, inicio) => { const mi = s(inicio).slice(0, 7); return mesesDoc(d)[0] < mi || s(d.mes || s(d.fecha).slice(0, 7)) < mi; };
// Lo pagado con un cargo que ya era gasto en el Gastos anterior, por documento
export function yaEnAnterior(pagos) {
  const out = {};
  (pagos || []).filter(p => p && p.estado !== 'deshecho' && p.enGastoAnterior).forEach(p => { out[p.docId] = (out[p.docId] || 0) + Math.abs(entero(p.monto)); });
  return out;
}

// ── Las líneas de un documento para Finanzas ──
// opciones: inicio; anterior (indiceAnterior); decision ('estaba' | 'ajuste' | '' para lo de antes del inicio); yaAnt (monto pagado que ya
// era gasto en el anterior). → [{ id, fecha, itemGasto, area, montoNeto, razonSocial, observacion, estado, origenGN, docId, mesOriginal, ajusteAnterior }]
// El id no depende del orden de las partes (ítem y área): reclasificar no cambia la llave de lo que sigue igual.
export function lineasDoc(d, provs, reps, { inicio, anterior = null, decision = '', yaAnt = 0 } = {}) {
  if (!d || d.estado === 'no_va') return [];
  const c = GB.clasifDe(d, provs, reps); if (!c || !(c.partes || []).length) return [];
  const mesIni = s(inicio).slice(0, 7), meses = mesesDoc(d), n = meses.length;
  // Lo de antes del inicio: con el mismo RUT y folio que un gasto del anterior, ya estaba; si no, entra solo si Emmanuel lo decidió
  if (esDeAntes(d, inicio) && (enAnteriorDoc(d, anterior) || decision !== 'ajuste')) return [];
  // La parte pagada con un cargo que ya era gasto en el anterior no entra otra vez
  const tot = Math.abs(entero(d.total)), queda = tot && yaAnt ? Math.max(0, 1 - yaAnt / tot) : 1;
  if (queda <= 0.0001) return [];
  const ref = `${s(d.tipoTexto)}${d.folio && d.origen !== 'credito' ? ' N° ' + s(d.folio) : ''}`;
  const out = [], vistos = {};
  c.partes.forEach(p => {
    const base = queda < 1 ? Math.round(entero(p.monto) * queda) : entero(p.monto), montos = repartirEn(base, n);
    const k0 = hashCorto(norm(p.item) + '|' + s(p.area).toUpperCase()), k = vistos[k0] ? `${k0}${vistos[k0]}` : k0; vistos[k0] = (vistos[k0] || 0) + 1;
    meses.forEach((m, i) => {
      if (!montos[i]) return;
      const antes = m < mesIni;
      const fecha = antes ? s(inicio) : s(d.fecha).slice(0, 7) === m ? s(d.fecha) : ultimoDia(m);
      const obs = [ref, n > 1 ? `${i + 1}/${n} (${mesCorto(meses[0])} a ${mesCorto(meses[n - 1])})` : '', antes ? `Ajuste de meses anteriores: ${mesCorto(m)}` : '', queda < 1 ? `sin lo pagado que ya era gasto en el anterior (${yaAnt.toLocaleString('es-CL')})` : ''].filter(Boolean).join(' · ');
      out.push({ id: `gn_${d.id}_${k}${n > 1 ? '_' + m.replace('-', '') : ''}`, fecha, itemGasto: s(p.item), area: s(p.area).toUpperCase(), montoNeto: montos[i], razonSocial: s(d.razon), observacion: obs,
        estado: 'vigente', origenGN: s(d.origen) || 'sii', docId: s(d.id), mesOriginal: m, ...(antes ? { ajusteAnterior: m } : {}) });
    });
  });
  return out;
}

// ── Todo para Finanzas: los gastos del anterior hasta antes del inicio + las líneas del Gastos nuevo ──
// gastosAnt: colección gastos (todos); D: { docs, provs, repartos, pagos, revAnterior { decisiones } }.
// → { gastos, deGN, ajuste { total, n, porMes }, yaAnterior { total, n }, porDecidir { n }, errores [docId] }
export function gastosParaFinanzas(gastosAnt, D, inicio) {
  const antes = (gastosAnt || []).filter(g => { const f = fechaAnt(g); return !f || f < inicio; });
  const I = indiceAnterior(gastosAnt, inicio), deGN = [], dec = ((D && D.revAnterior) || {}).decisiones || {}, ya = yaEnAnterior(D && D.pagos), errores = [];
  let porDecidir = 0;
  ((D && D.docs) || []).forEach(d => {
    try {
      const de = dec[llaveB(d.id)], decision = de && de.que !== 'abierta' ? de.que : '';
      if (esDeAntes(d, inicio) && d.estado !== 'no_va' && !enAnteriorDoc(d, I) && !decision) porDecidir++;
      deGN.push(...lineasDoc(d, D.provs || {}, D.repartos || {}, { inicio, anterior: I, decision, yaAnt: ya[d.id] || 0 }));
    } catch (e) { errores.push(d && d.id); }   // un documento raro no deja a Finanzas sin nada: se avisa
  });
  const aj = deGN.filter(l => l.ajusteAnterior), porMes = {};
  aj.forEach(l => { porMes[l.ajusteAnterior] = (porMes[l.ajusteAnterior] || 0) + l.montoNeto; });
  const yaDocs = Object.keys(ya).filter(id => (D.docs || []).some(d => d.id === id && d.estado !== 'no_va'));
  return { gastos: antes.concat(deGN), deGN, ajuste: { total: aj.reduce((a, l) => a + l.montoNeto, 0), n: new Set(aj.map(l => l.docId)).size, porMes },
    yaAnterior: { total: yaDocs.reduce((a, id) => a + ya[id], 0), n: yaDocs.length }, porDecidir: { n: porDecidir }, errores };
}

// ── Lo del Gastos nuevo que todavía no tiene clasificación, por mes (para el cierre) ──
export function sinClasificarDelMes(D, mes) {
  const l = ((D && D.docs) || []).filter(d => d.estado !== 'no_va' && !d.anterior && s(d.mes) === mes && !GB.clasifDe(d, D.provs || {}, D.repartos || {}));
  return { n: l.length, monto: l.reduce((a, d) => a + entero(d.total), 0), lista: l.slice(0, 30).map(d => ({ id: d.id, razon: s(d.razon), folio: s(d.folio), total: entero(d.total), tipo: s(d.tipoTexto) })) };
}
// Movimientos del mes con saldo sin explicar (ni pago, ni "no es gasto", ni "no va"); los anteriores al inicio no cuentan
export function movsSinRevisarDelMes(D, mes) {
  const I = GB.indicePagos((D && D.pagos) || []), l = ((D && D.movs) || []).filter(m => !m.anterior && s(m.fecha).slice(0, 7) === mes && entero(m.monto) > 0 && GB.libreMov(m, I) > TOL);
  return { n: l.length, monto: l.reduce((a, m) => a + GB.libreMov(m, I), 0) };
}
// Pagos de la tarjeta de crédito (movimientos marcados así): no son gasto, van al flujo de caja
export const pagosTarjetaGN = D => ((D && D.movs) || []).filter(m => m.naturaleza === 'tarjeta' && m.estado !== 'no_va').map(m => ({ id: s(m.id), fecha: s(m.fecha), monto: entero(m.monto), descripcion: s(m.glosa) }));
// ¿El SII del mes está completo? Su método (anotado en la (i) de "Hasta dónde llega"): a fin de mes se sube el RCV (o el XML) ya
// terminado el mes. Cuenta como completo si alguna carga del SII se subió después del último día del mes y trae documentos de ese mes.
// → { ok, hasta (la factura más reciente cargada), ultima (la última carga que cubre el mes) }
export function siiDelMes(cargas, mes) {
  const fin = ultimoDia(mes), l = (cargas || []).filter(k => s(k.tipo) === 'sii');
  const cubre = l.filter(k => esIso(s(k.hasta)) && s(k.hasta) >= mes + '-01' && (!esIso(s(k.desde)) || s(k.desde) <= fin));
  const despues = cubre.filter(k => s(k.en).slice(0, 10) > fin);
  return { ok: despues.length > 0, hasta: l.map(k => s(k.hasta)).filter(esIso).sort().pop() || '', ultima: (despues[0] && s(despues[0].en).slice(0, 10)) || '', rcv: despues.some(k => k.formato === 'registro') };
}
// Previred del mes (el documento del período)
export const previredDelMes = (D, mes) => ((D && D.docs) || []).find(d => d.origen === 'previred' && s(d.mes) === mes && d.estado !== 'no_va') || null;

// ═══════════════ Revisión de octubre, parte A: gastos del Gastos anterior con fecha desde el inicio ═══════════════
// Un "pago" del anterior: sus líneas (una por área) con la misma fecha, hora, observación, RUT y folio
export function gruposAnterior(gastos, inicio) {
  const g = {};
  (gastos || []).filter(vigenteAnterior).forEach(x => {
    const f = fechaAnt(x); if (!f || f < inicio) return;
    const fo = folioAnterior(x), k = [f, s(x.hora), s(x.observacion), rutN(x.rutProveedor), fo].join('|');
    const y = g[k] || (g[k] = { id: s(x.id), fecha: f, rut: rutN(x.rutProveedor), razon: s(x.razonSocial), folio: fo, obs: s(x.observacion).slice(0, 120), total: 0, neto: 0, lineas: [], ids: [] });
    y.total += Number(x.montoFinal) || 0; y.neto += Number(x.montoNeto) || 0; y.ids.push(s(x.id));
    y.lineas.push({ item: s(x.itemGasto), area: s(x.area).toUpperCase(), neto: Number(x.montoNeto) || 0 });
    if (s(x.id) < y.id) y.id = s(x.id);
  });
  return Object.values(g).map(y => ({ ...y, total: Math.round(y.total), neto: Math.round(y.neto) })).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.razon.localeCompare(b.razon));
}
// La clasificación del anterior como propuesta para pasarlo al nuevo: el ítem principal y las áreas en % del neto (sin áreas antiguas)
export function propuestaDe(gr) {
  const porItem = {}, porArea = {};
  gr.lineas.forEach(l => { porItem[l.item] = (porItem[l.item] || 0) + Math.abs(l.neto); if (l.area && !GB.AREAS_ANTIGUAS.includes(l.area) && l.area !== 'PRORRATEADO') porArea[l.area] = (porArea[l.area] || 0) + Math.abs(l.neto); });
  const item = Object.entries(porItem).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || '';
  const tot = Object.values(porArea).reduce((a, x) => a + x, 0), ar = Object.keys(porArea);
  let areas = ar.map(a => ({ area: a, pct: tot ? Math.round(porArea[a] / tot * 10000) / 100 : 0 }));
  if (areas.length > 1) { const sum = areas.slice(0, -1).reduce((a, x) => a + x.pct, 0); areas[areas.length - 1].pct = Math.round((100 - sum) * 100) / 100; } else if (areas.length) areas = [{ area: areas[0].area, pct: 100 }];
  return { item, areas };
}
// Cada grupo con su coincidencia: 'esta' (mismo RUT y folio en el nuevo), 'puede' (mismo RUT o nombre y total ±$5, fechas a 15 días) o 'solo'.
// Lo que Emmanuel decidió (decisiones[id]) manda: 'mismo' (docId), 'pasado' (docId), 'no_va', 'no_es'; 'abierta' = volver a revisar.
// Un documento del nuevo se une con UN solo gasto del anterior por decisión ("Es este"): no se ofrece si ya lo tiene otro.
// Si el documento unido después se marcó "no va" o ya no está, vuelve a "por resolver".
// final: 'nuevo' (ya está o se pasó), 'no_va' o 'pendiente'. La suma da el total.
// Con factura (RUT y folio) y sin coincidencia: no se pasa a mano (llega por el SII; a mano entraría con IVA y después repetida).
export const FINALES = { nuevo: 'En el Gastos nuevo', no_va: 'No va', pendiente: 'Por resolver' };
export function revisarAnterior(gastos, docs, inicio, decisiones = {}) {
  const vivos = (docs || []).filter(d => d.estado !== 'no_va'), vivo = id => vivos.find(d => d.id === id);
  const porFolio = {}; vivos.forEach(d => { const r = rutN(d.rutN || d.rut), f = folioN(d.folio); if (r && f) (porFolio[r + '|' + f] = porFolio[r + '|' + f] || []).push(d); });
  const corto = d => ({ id: d.id, razon: s(d.razon), folio: s(d.folio), total: entero(d.total), fecha: s(d.fecha), tipo: s(d.tipoTexto) });
  const dec0 = id => { const d = decisiones[id]; return d && d.que !== 'abierta' ? d : null; };
  const g0 = gruposAnterior(gastos, inicio);
  // Documentos ya tomados por una decisión ("Es este" o "Pasado"): no se ofrecen a otro gasto
  const tomados = {}; g0.forEach(g => { const d = dec0(g.id); if (d && ['mismo', 'pasado'].includes(d.que) && d.docId) tomados[d.docId] = g.id; });
  const grupos = g0.map(g => {
    const dec = dec0(g.id);
    const exacto = g.rut && g.folio ? (porFolio[g.rut + '|' + g.folio] || [])[0] : null;
    const parecidos = exacto ? [] : vivos.filter(d => !(tomados[d.id] && tomados[d.id] !== g.id) && (g.rut ? rutN(d.rutN || d.rut) === g.rut : norm(d.razon) && norm(d.razon) === norm(g.razon)) && Math.abs(Math.abs(entero(d.total)) - Math.abs(g.total)) <= TOL && esIso(d.fecha) && Math.abs(dias(g.fecha, d.fecha)) <= 15).slice(0, 3);
    let estado = exacto ? 'esta' : parecidos.length ? 'puede' : 'solo';
    if (dec && dec.que === 'no_es' && estado === 'puede') estado = 'solo';
    const unido = dec && ['mismo', 'pasado'].includes(dec.que) ? vivo(dec.docId) : null;
    const final = estado === 'esta' || unido ? 'nuevo' : dec && dec.que === 'no_va' ? 'no_va' : 'pendiente';
    const perdido = !!(dec && ['mismo', 'pasado'].includes(dec.que) && !unido);
    const docFinal = exacto || unido;
    return { ...g, estado, final, resuelto: final !== 'pendiente', doc: docFinal ? corto(docFinal) : null, parecidos: parecidos.map(corto), decision: perdido ? null : dec, perdido,
      factura: !!(g.rut && g.folio), propuesta: propuestaDe(g) };
  });
  const suma = (l, k) => l.reduce((a, x) => a + x[k], 0), de = f => grupos.filter(x => x.final === f);
  return { grupos, n: grupos.length, neto: suma(grupos, 'neto'), total: suma(grupos, 'total'), pendientes: de('pendiente').length,
    por: Object.fromEntries(Object.keys(FINALES).map(f => [f, { n: de(f).length, neto: suma(de(f), 'neto') }])) };
}

// ═══════════════ Revisión de octubre, parte B: documentos del Gastos nuevo de antes del inicio ═══════════════
// Cada uno: 'estaba' solo (mismo RUT y folio que un gasto del anterior de antes del inicio), o lo que decida Emmanuel: 'estaba' (ya estaba en
// el anterior: no entra) o 'ajuste' (no estaba: entra en octubre como "Ajuste de meses anteriores"). Sin decidir no entra. Sin clasificar,
// primero se clasifica. "Esto no va" no se revisa. antes = lo que es de meses anteriores al inicio (entra en octubre con "ajuste").
export const FINALES_B = { estaba: 'Ya estaba en el anterior', ajuste: 'Entra en octubre (ajuste)', pendiente: 'Por decidir', sin_clasif: 'Falta clasificar' };
export function revisarAntes(docs, gastos, inicio, decisiones = {}, provs = {}, reps = {}) {
  const I = indiceAnterior(gastos, inicio), mi = s(inicio).slice(0, 7);
  const lista = (docs || []).filter(d => d.estado !== 'no_va' && esDeAntes(d, inicio)).map(d => {
    const de = decisiones[llaveB(d.id)], dec = de && de.que !== 'abierta' ? de : null, auto = enAnteriorDoc(d, I), c = GB.clasifDe(d, provs, reps);
    const meses = mesesDoc(d), n = meses.length, base = c ? (c.partes || []).reduce((a, p) => a + entero(p.monto), 0) : 0;
    const antes = c ? repartirEn(base, n).filter((x, i) => meses[i] < mi).reduce((a, x) => a + x, 0) : 0;
    const final = auto ? 'estaba' : !c ? 'sin_clasif' : dec && ['estaba', 'ajuste'].includes(dec.que) ? dec.que : 'pendiente';
    return { docId: d.id, razon: s(d.razon), tipo: s(d.tipoTexto), folio: s(d.folio), fecha: s(d.fecha), mes: s(d.mes), total: entero(d.total), base, antes, meses: n, desde: meses[0], hasta: meses[n - 1],
      auto, final, resuelto: final === 'estaba' || final === 'ajuste', decision: dec };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.razon.localeCompare(b.razon));
  const de = f => lista.filter(x => x.final === f);
  return { lista, n: lista.length, pendientes: lista.filter(x => !x.resuelto).length, por: Object.fromEntries(Object.keys(FINALES_B).map(f => [f, { n: de(f).length, base: de(f).reduce((a, x) => a + x.base, 0) }])) };
}
// Las dos partes juntas (lo que muestra la pantalla y revisa el cierre de octubre)
export function revisionOctubre(gastos, docs, inicio, decisiones = {}, provs = {}, reps = {}) {
  const A = revisarAnterior(gastos, docs, inicio, decisiones), B = revisarAntes(docs, gastos, inicio, decisiones, provs, reps);
  return { ...A, A, B, pendientes: A.pendientes + B.pendientes };
}
export const DECISIONES = { mismo: 'Es el mismo documento', pasado: 'Pasado al Gastos nuevo', no_va: 'No va (no es gasto o estaba repetido)', no_es: 'No es el mismo', estaba: 'Ya estaba en el Gastos anterior', ajuste: 'Entra en octubre como ajuste de meses anteriores', abierta: 'Vuelve a revisarse' };
