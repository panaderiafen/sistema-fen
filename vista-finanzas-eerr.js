// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas → Resultados: Estado de resultados (F3 paso 2) y Cierre de mes  v0.62.0
//  Rutas: #finanzas/resultados (Estado de resultados, la primera parte) · #finanzas/resultados/cierre.
//  Reglas puras en finanzas-eerr.js; datos en finanzas.js (fen-gastos y lectura de caja, B2B y Producción).
//  Un mes cerrado se lee de su snapshot (fin_cierres/{AAAA-MM}); lo que cambie después aparece como "Ajustes de meses
//  cerrados" en el primer mes abierto siguiente. Solo Emmanuel ve esto (Sistema Fën): nada va a Cocina ni a Hoy.
//  R = { datos (leerResultados: gastos, ítems, obligaciones, vencimientos, fin, config, créditos, inversiones), cabecera() }
// ═══════════════════════════════════════════════
import * as F from './finanzas.js?v=0.102.1';
import * as FR from './finanzas-resultados.js?v=0.102.1';
import * as FE from './finanzas-eerr.js?v=0.102.1';
import * as FC from './finanzas-costos.js?v=0.102.1';
import * as SP from './sii-pendientes.js?v=0.102.1';   // v0.66.0: documentos del SII por clasificar

const ES = { mes: '', comparar: false, vista: 'principal', abiertas: {}, cierres: null, claves: {}, cartola: null, sii: null, vivo: {}, msg: '', err: '', cargando: '', checks: {}, conteos: {} };
const $ = id => document.getElementById(id);
const nf = v => Number(v || 0).toLocaleString('es-CL');
const pesos = v => FC.pesos(Math.round(Number(v) || 0));
const pct = v => (v === null || v === undefined || !isFinite(v) ? '—' : `${(Math.round(v * 10) / 10).toLocaleString('es-CL')} %`);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaTxt = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '—'; };
const hoyTxt = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PI = {
  candado: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', abierto: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', aviso: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
  revisar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>', abajo: '<path d="M6 9l6 6 6-6"/>', ir: '<path d="M5 12h14M13 6l6 6-6 6"/>', hist: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  balanza: '<path d="M12 4v16M6 20h12M4 8h16"/><path d="M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z"/>'
};
const ic = (n, t = 18) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PI[n] || ''}</svg>`;
const mapaAreas = R => (R.datos.config && R.datos.config.areasGasto) || {};
// v0.102.0 · ¿Ya se pasó al catálogo de ítems? (entonces el tipo de cada gasto sale de la cuenta de su ítem, no de Clasificación)
const conCatalogo = R => !!(R.datos.gn && R.datos.gn.D && (R.datos.gn.D.catalogo || []).length);
const mesHoy = () => hoyTxt().slice(0, 7);
// v0.101.1 · Con el Gastos nuevo, Finanzas parte en el mes del inicio (desde cero en octubre)
const mesDesde = () => F.mesInicioGN() || `${FR.ANIO}-01`;
const mesDefecto = () => (FE.mesMas(mesHoy(), -1) >= mesDesde() ? FE.mesMas(mesHoy(), -1) : mesHoy());
const mesValido = m => (/^\d{4}-\d{2}$/.test(String(m || '')) && m >= mesDesde() ? m : mesDefecto());
const cerrado = m => !!(ES.cierres && ES.cierres[m] && ES.cierres[m].estado === 'cerrado');
const mensajes = H => `<p class="ok-texto" id="e-msg" role="status">${H.esc(ES.msg)}</p><p class="error" id="e-err" role="alert">${H.esc(ES.err)}</p>`;
// v0.69.3 · Finanzas → Resumen del mes: "Ir a Cierre de mes" abre el mismo mes
export function elegirMes(m) { if (/^\d{4}-\d{2}$/.test(String(m || ''))) { ES.mes = m; ES.msg = ''; ES.err = ''; } }
export function olvidar() { ES.cierres = null; ES.cartola = null; ES.sii = null; ES.siiPend = null; ES.vivo = {}; ES.checks = {}; ES.conteos = {}; ES.msg = ''; ES.err = ''; F.olvidarMeses(); }

// ── Datos comunes (una vez por entrada a Resultados) ──
async function base() {
  if (!ES.cierres) { const x = await F.leerCierres(); ES.cierres = x.cierres; ES.claves = x.claves || {}; }
  // v0.101.1 · Con el Gastos nuevo, la cartola y el SII del Gastos anterior ya no se leen (las revisiones salen del Gastos nuevo)
  if (F.gnActivo()) return;
  if (!ES.cartola) ES.cartola = await F.cargosCartola();
  if (!ES.siiPend) { try { ES.siiPend = await F.siiPorClasificar(); } catch (e) { ES.siiPend = null; } }
}
// Estado de resultados calculado hoy (sin el snapshot) de un mes
async function vivo(R, mes) {
  if (ES.vivo[mes]) return ES.vivo[mes];
  const dm = await F.datosMes(mes);
  const D = R.datos, mapa = mapaAreas(R);
  // v0.101.0 · Desde el inicio (octubre) manda el Gastos nuevo: el interés de los créditos va en sus cuotas (Gastos → Compromisos → Créditos),
  // no en la tabla de Finanzas → Créditos (sería doble); los pagos de la tarjeta son los movimientos marcados así en la Bandeja.
  // v0.101.1 · Desde cero en octubre: con el Gastos nuevo, Finanzas no muestra meses anteriores al inicio.
  if (F.delGastosNuevo(mes) && D.gn && D.gn.error) throw new Error(`No se pudo leer el Gastos nuevo (desde ${FE.mesTxt(D.gn.inicio.slice(0, 7))} los gastos salen de ahí): ${D.gn.error}. Revise la conexión y toque "Leer de nuevo".`);
  const nuevo = F.delGastosNuevo(mes) && D.gn, GF = nuevo ? await import('./gn-finanzas.js?v=0.102.1') : null;
  const pagosTarjeta = nuevo ? GF.pagosTarjetaGN(D.gn.D) : ((ES.cartola && ES.cartola.pagosTarjeta) || []);
  const e = FE.armarEERR({ mes, margen: dm.margen, merma: dm.merma, gastos: D.gastos, fin: D.fin, items: D.items, mapa, creditosMes: nuevo ? [] : FE.creditosDelMes(D.creditos, D.vencimientos, D.gastos, mes),
    invs: FR.inversiones(D.gastos, D.fin, D.invGuardadas, mapa), pagosTarjeta });
  e.ventasInfo = dm.ventasInfo;
  if (nuevo) {
    const sc = GF.sinClasificarDelMes(D.gn.D, mes), av = [];
    if (sc.n) av.push({ k: 'gn_sin_clasificar', texto: `${sc.n} ${sc.n === 1 ? 'documento' : 'documentos'} de ${FE.mesTxt(mes)} sin clasificar en Gastos (${pesos(sc.monto)}): no están en este estado de resultados. Clasifíquelos en Gastos → Bandeja.` });
    if ((D.gn.errores || []).length) av.push({ k: 'gn_errores', texto: `${D.gn.errores.length} ${D.gn.errores.length === 1 ? 'documento del Gastos nuevo no se pudo leer' : 'documentos del Gastos nuevo no se pudieron leer'} (no están en el estado de resultados): ${D.gn.errores.slice(0, 5).join(', ')}.` });
    // Un crédito de Finanzas → Créditos con cuota este mes y ninguna cuota del Gastos nuevo: su interés faltaría sin aviso
    const viejo = (D.creditos || []).filter(c => c.estado !== 'archivado' && (c.tabla || []).some(f => String(f.fecha || '').slice(0, 7) === mes)), cuotasGN = (D.gastos || []).some(g => FE.mesDe(g.fecha) === mes && g.origenGN === 'credito');
    if (viejo.length && !cuotasGN) av.push({ k: 'gn_credito_falta', texto: `${viejo.map(c => c.nombre).join(', ')}: tiene cuota en ${FE.mesTxt(mes)} en Finanzas → Créditos, pero no hay cuotas en el Gastos nuevo. Desde octubre el interés sale de Gastos → Compromisos → Créditos (súbalo ahí).` });
    if (!conCatalogo(R)) av.push({ k: 'gn_sin_catalogo', texto: 'Falta pasar al catálogo de ítems (Gastos → Ítems). Mientras tanto, el tipo de cada gasto sale de Clasificación y no se ven las líneas nuevas (packaging, tiendas, marketing…).' });
    const cuotas = (D.gastos || []).filter(g => FE.mesDe(g.fecha) === mes && FR.normalizar(g.itemGasto) === 'CUOTA DE CREDITO');
    if (cuotas.length) av.push({ k: 'gn_cuota_sin_separar', texto: `${cuotas.length} ${cuotas.length === 1 ? 'cuota de crédito va completa' : 'cuotas de crédito van completas'} (${pesos(cuotas.reduce((a, g) => a + (Number(g.montoNeto) || 0), 0))}) fuera del resultado: falta separar su interés. Anote el monto original y la tasa del crédito en Gastos → Compromisos → Créditos.` });
    e.avisos = (e.avisos || []).concat(av); e.conCatalogo = conCatalogo(R);
    ES.vivo[mes] = e;
    return e;
  }
  // v0.66.0 · Documentos del SII de ese mes por clasificar: su gasto todavía no existe (no están en este estado de resultados)
  const sp = ES.siiPend ? SP.pendientesDelMes(ES.siiPend, mes) : null;
  if (sp && sp.n) e.avisos = (e.avisos || []).concat([{ k: 'sii_por_clasificar', texto: `${sp.n} ${sp.n === 1 ? 'documento del SII' : 'documentos del SII'} de ${FE.mesTxt(mes)} sin clasificar (${SP.fmt(sp.monto)}): su gasto todavía no existe y no está en este estado de resultados. Clasifícalos al conciliar la cartola o en Gastos → Bandeja → Cargas del SII.` }]);
  ES.vivo[mes] = e;
  return e;
}
// Ajustes de meses cerrados que van en el mes abierto M (cálculo de hoy − snapshot − lo ya informado)
async function ajustesPara(R, M) {
  const porMes = {};
  for (const X of Object.keys(ES.cierres || {}).filter(x => x < M && x >= mesDesde() && cerrado(x)).sort()) {   // v0.101.1: los cierres de antes del inicio no se recalculan
    if (FE.mesDeAjuste(X, ES.cierres) !== M) continue;
    const v = await vivo(R, X);
    porMes[X] = FE.ajusteDe(v, ES.cierres[X], FE.yaInformado(ES.cierres, X));
  }
  return FE.juntarAjustes(porMes);
}
// El estado de resultados que se muestra: el snapshot si el mes está cerrado; si no, el de hoy + los ajustes
async function delMes(R, mes) {
  if (cerrado(mes)) { const c = ES.cierres[mes]; return { ...c, congelado: true }; }
  const e = await vivo(R, mes), aj = await ajustesPara(R, mes);
  return { ...e, ajustes: aj.total || Object.keys(aj.porMes).length ? aj : null, congelado: false };
}

// ═══════════════ Estado de resultados ═══════════════
const TXT_EERR = 'El estado de resultados del mes por área (la que produce) y el total, en tres pisos, todo en neto. Cada gasto va a su línea según la cuenta de su ítem (Gastos → Ítems).\nLa columna Reventa (lo que se compra hecho y se vende tal cual) aparece solo si el mes tiene ventas, costo o gastos de Reventa. Sus compras no son una línea de gasto (van a "Fuera del resultado"): entra el costo de lo vendido.\n1. Ventas netas − costo directo de lo vendido (receta × unidades al costo del mes; reventa a su costo de compra) − comisiones y despacho (comisión de tarjeta, despacho, arriendo del POS) − packaging − merma valorizada = margen de contribución.\n2. − remuneraciones propias del área − otros fijos propios − depreciación del área = margen del área.\nCanal B2B (en Total, solo si el mes lo tiene): + despacho cobrado (el cargo del Catálogo que se cobra a los clientes B2B) − costos del canal B2B (remuneraciones y fijos con área B2B: atención de clientes, órdenes y despacho) = resultado del canal B2B.\nTiendas (en Total, solo si el mes lo tiene): los costos propios de la Tienda Barros Arana y de la Sala de ventas Ainavillo (remuneraciones y fijos con área B2C-BA o B2C-AI): lo que cuesta vender ahí.\n3. + resultado del canal B2B − tiendas − comunes sin repartir (remuneraciones comunes con el sueldo empresarial, fijos comunes, marketing, seguros, transporte, capacitación, depreciación común) = resultado operacional; − financieros (intereses, multas y banco) = resultado del mes.\nCada cifra se puede tocar para ver de dónde sale.\nUn mes cerrado se ve congelado (como quedó al cerrarlo).';
function selectorMes(H, id = 'e-mes') {
  const meses = FE.mesesDelAnio(FR.ANIO, hoyTxt()).filter(m => m >= mesDesde());
  return `<div class="campo fin-emes"><label for="${id}">Mes</label><select id="${id}">${meses.map(m => `<option value="${m}" ${m === ES.mes ? 'selected' : ''}>${H.esc(FE.mesTxt(m))}${cerrado(m) ? ' · cerrado' : m === mesHoy() ? ' · en curso' : ''}</option>`).join('')}</select></div>`;
}
export async function pintarEERR(el, H, ctx, R) {
  ES.mes = mesValido(ES.mes);
  const tope = (cuerpo) => R.cabecera() + cuerpo;
  el.innerHTML = tope(`<section class="tarjeta"><div class="vacio" style="border:0" role="status" id="e-leyendo">Calculando el estado de resultados de ${H.esc(FE.mesTxt(ES.mes))}…</div></section>`);
  let e, prev = null;
  try {
    await base();
    e = await delMes(R, ES.mes);
    if (ES.comparar && FE.mesMas(ES.mes, -1) >= mesDesde()) prev = await delMes(R, FE.mesMas(ES.mes, -1)).catch(() => null);
  } catch (er) { el.innerHTML = tope(`<section class="tarjeta"><p class="error" role="alert">${H.esc(ctx.error(er, H))}</p></section>`); return; }
  if (!/^#finanzas\/resultados\/?$/.test(location.hash) && !/^#finanzas\/resultados\/eerr/.test(location.hash)) return;
  el.innerHTML = tope(htmlEERR(H, e, prev, R));
  conectarEERR(el, H, ctx, R, e, prev);
}
const valorFila = (e, k, col) => {
  if (k.startsWith('canal_')) return (e.canal[k.slice(6)] || {})[col] || 0;
  if (k === 'ajustes') return col === 'total' && e.ajustes ? e.ajustes.total : 0;
  if (k === 'resultadoAj') return col === 'total' ? e.filas.resultado.total + (e.ajustes ? e.ajustes.total : 0) : 0;
  return ((e.filas[k] || {})[col]) || 0;
};
const usaCol = (f, col) => col === 'total' || f.cols === 'todas' || (f.cols === 'areas' && FE.AREAS.includes(col)) || (f.cols === 'comun' && col === 'comun');
function celda(H, e, f, col, extra = '') {
  if (!usaCol(f, col)) return `<td class="fin-evacia"${extra}></td>`;
  const v = valorFila(e, f.k, col), venta = col === 'total' ? e.filas.ventas.total : e.filas.ventas[col];
  const detKey = f.k.startsWith('canal_') ? 'ventasCanal_' + f.k.slice(6) : f.k;
  const conDet = !['mc', 'ma', 'resCanalB2B', 'resOp', 'resultado', 'resultadoAj'].includes(f.k) && v !== 0;
  const txt = f.signo === '−' ? (v ? `−${pesos(v)}` : '—') : f.signo === '±' ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${pesos(Math.abs(v))}` : pesos(v);
  const p = f.pct && venta ? `<small class="fin-epct">${pct(v / venta * 100)}</small>` : '';
  return `<td class="fin-enum${v < 0 && f.resultado ? ' fin-eneg' : ''}"${extra}>${conDet ? `<button type="button" class="fin-ecel" data-e-det="${H.esc(detKey)}" data-e-col="${col}" aria-label="${H.esc(f.t)} · ${H.esc(FE.NOMBRE_COL[col])}: ver de dónde sale">${txt}</button>` : `<span>${txt}</span>`}${p}</td>`;
}
function htmlEERR(H, e, prev, R) {
  const cols = FE.colsVisibles(e).concat('total');   // v0.69.1: Reventa solo si tiene algo en el mes
  const congel = e.congelado ? ES.cierres[ES.mes] : null;
  const filasT = [];
  let pisoAnt = 0;
  // v0.75.1: el bloque del canal B2B (despacho cobrado y costos del canal) solo cuando el mes (o el anterior) tiene algo
  const conB2B = x => x && (valorFila(x, 'cargos', 'total') || valorFila(x, 'canalB2B', 'total'));
  // v0.102.0: las filas opcionales (tiendas, marketing, seguros, transporte, capacitación) solo cuando el mes (o el anterior) tiene algo
  const conFila = (x, k) => x && valorFila(x, k, 'total');
  const filasVer = FE.FILAS.filter(f => (!FE.FILAS_B2B.includes(f.k) || conB2B(e) || conB2B(prev)) && (!f.opcional || conFila(e, f.k) || conFila(prev, f.k)));
  const fila = (f, cls = '') => {
    const cmp = ES.comparar ? (() => { const a = prev ? valorFila(prev, f.k, 'total') : null, b = valorFila(e, f.k, 'total'); return `<td class="fin-enum fin-ecmp">${a === null ? '—' : f.signo === '−' ? (a ? '−' + pesos(a) : '—') : pesos(a)}</td><td class="fin-enum fin-ecmp">${a === null ? '—' : varTxt(b, a, f)}</td>`; })() : '';
    return `<tr class="${f.resultado ? 'fin-eres' : ''} ${cls}" data-e-fila="${f.k}"><th scope="row">${f.signo && f.signo !== '' ? `<span class="fin-esig" aria-hidden="true">${f.signo}</span>` : ''}${H.esc(f.t)}${f.abre ? ` <button type="button" class="fin-eabre" id="e-abre-canal" aria-expanded="${!!ES.abiertas.canal}" aria-controls="e-canal">${ic('abajo', 14)}<span class="sr">Ver por canal</span></button>` : ''}</th>${cols.map(c => celda(H, e, f, c)).join('')}<td class="fin-epres" hidden>sin presupuesto</td>${cmp}</tr>`;
  };
  filasVer.forEach(f => {
    if (f.piso !== pisoAnt) { filasT.push(`<tr class="fin-episo"><th scope="rowgroup" colspan="${cols.length + 1 + (ES.comparar ? 2 : 0)}">${H.esc(FE.NOMBRE_PISO[f.piso])}</th></tr>`); pisoAnt = f.piso; }
    filasT.push(fila(f));
    if (f.k === 'ventas' && ES.abiertas.canal) FE.SUCS.forEach(sc => filasT.push(fila({ k: 'canal_' + sc, t: FE.NOMBRE_SUC[sc], piso: 1, signo: '', cols: 'todas' }, 'fin-ecanal')));
  });
  if (e.ajustes) {
    filasT.push(fila({ k: 'ajustes', t: 'Ajustes de meses cerrados', signo: '±', cols: 'total' }, 'fin-eaj'));
    filasT.push(fila({ k: 'resultadoAj', t: 'Resultado del mes con ajustes', signo: '=', cols: 'total', resultado: true }));
  }
  const th = `<tr><th scope="col">Concepto</th>${cols.map(c => `<th scope="col" class="fin-enum">${FE.NOMBRE_COL[c]}</th>`).join('')}<th scope="col" class="fin-epres" hidden>Presupuesto</th>${ES.comparar ? `<th scope="col" class="fin-enum fin-ecmp">${H.esc(FE.mesTxt(FE.mesMas(ES.mes, -1)))}</th><th scope="col" class="fin-enum fin-ecmp">Variación</th>` : ''}</tr>`;
  const estado = congel ? `<div class="fin-econg" id="e-estado">${ic('candado', 18)}<span><b>Mes cerrado</b> el ${fechaTxt(congel.cerradoEn)} por ${H.esc(congel.cerradoPor || '—')}: se ve congelado, como quedó al cerrarlo.${congel.override ? ` Se cerró con revisiones pendientes: ${H.esc(congel.override.motivo)}.` : ''} ${H.info('Mes cerrado', 'Un mes cerrado no se toca: lo que se ve es el snapshot guardado al cerrarlo (ventas, costos, gastos y créditos de ese momento).\nSi después cambia algo de ese mes (un gasto corregido, una factura que llegó tarde), la diferencia aparece como "Ajustes de meses cerrados" en el primer mes abierto siguiente.')}</span></div>`
    : `<div class="fin-econg fin-eabierto" id="e-estado">${ic('abierto', 18)}<span><b>Mes abierto</b>: se calcula con lo que hay hoy. ${ES.mes < mesHoy() ? `Ciérralo en <a href="#finanzas/resultados/cierre">Cierre de mes</a> cuando esté completo.` : 'Es el mes en curso.'}</span></div>`;
  const vistaPills = `<div class="pastillas fin-evista" role="group" aria-label="Cómo ver los comunes">
    <button type="button" class="pastilla" data-e-vista="principal" aria-pressed="${ES.vista === 'principal'}">Comunes sin repartir</button>
    <button type="button" class="pastilla" data-e-vista="repartido" aria-pressed="${ES.vista === 'repartido'}">Comunes repartidos por causa · secundaria</button></div>`;
  return `<section class="tarjeta" aria-labelledby="t-e-eerr">
    <div class="titulo-fila fin-titulo"><h2 id="t-e-eerr">Estado de resultados ${H.info('Estado de resultados', TXT_EERR)}</h2>
      <button type="button" class="btn-sec btn-chico" id="e-releer">${ic('revisar', 16)} Volver a leer</button></div>
    <div class="fin-ecab">${selectorMes(H)}
      <div class="chips fin-ecomp" role="group" aria-label="Comparar"><button type="button" class="chip-filtro" id="e-comparar" aria-pressed="${ES.comparar}">Comparar con el mes anterior</button>
        <button type="button" class="chip-filtro" disabled aria-disabled="true" title="Llega con Metas (F5)">Contra presupuesto · sin presupuesto</button>${H.info('Presupuesto', 'El presupuesto mensual (fijos y metas por área) llega con Metas (F5). Entonces aquí se podrá comparar cada línea contra lo presupuestado.')}</div></div>
    ${estado}
    ${mensajes(H)}
    ${(e.avisos || []).length ? `<ul class="fin-eavisos" id="e-avisos">${e.avisos.map(a => `<li>${ic('aviso', 16)}<span>${H.esc(a.texto)}</span></li>`).join('')}</ul>` : ''}
    ${vistaPills}
    ${ES.vista === 'repartido' ? htmlRepartido(H, e, R) : `<div class="tabla-b2b fin-etabla"><table class="tabla-tiempos fin-eerr" id="e-tabla"><caption class="sr">Estado de resultados de ${H.esc(FE.mesTxt(ES.mes))}</caption><thead>${th}</thead><tbody>${filasT.join('')}</tbody></table></div>
    <p class="nota-i">(i) Toca una cifra para ver los gastos, ventas o movimientos que la forman. Los % son sobre las ventas netas de la columna. Los comunes van <b>sin repartir</b>: el resultado de cada área es su margen del área; el reparto por causa es solo una vista secundaria, para conversar.</p>`}
  </section>
  ${htmlInfo(H, e)}
  ${htmlCuadratura(H, e)}`;
}
const varTxt = (b, a, f) => { const d = b - a; if (!d) return '='; const signo = f.signo === '−' ? -1 : 1; const bueno = d * signo > 0; return `<span class="${bueno ? 'fin-ebien' : 'fin-emal'}">${d > 0 ? '+' : '−'}${pesos(Math.abs(d))}${a ? ` <small>(${d > 0 ? '+' : '−'}${pct(Math.abs(d / a) * 100)})</small>` : ''}</span>`; };

// ── Información (no está en el resultado) ──
function htmlInfo(H, e) {
  const I = e.info, l = (k, col, t, v, ayuda) => `<div class="fin-einfo-l"><span>${t}${ayuda ? ' ' + H.info(t, ayuda) : ''}</span>${v ? `<button type="button" class="fin-ecel" data-e-det="${k}" data-e-col="${col}">${pesos(v)}</button>` : `<span>${pesos(v)}</span>`}</div>`;
  return `<section class="tarjeta" aria-labelledby="t-e-info"><div class="titulo-fila fin-titulo"><h2 id="t-e-info">Fuera del resultado ${H.info('Fuera del resultado', 'Lo que salió o se compró en el mes pero no es una línea del estado de resultados. Va al flujo de caja o a la desviación de materias primas. Se muestra para que todo cuadre con Gastos.')}</h2></div>
    <div class="fin-einfo" id="e-info">
      <div><h3>Compras del mes</h3>${l('compras', 'mp', 'Materias primas e insumos', I.compras.mp, 'Su costo ya está en el costo directo de cada producto. Las compras se usan para la desviación (compras − consumo teórico ± conteo).')}${l('compras', 'reventa', 'Productos de reventa', I.compras.reventa)}
        <div class="fin-einfo-l fin-einfo-t"><span>Total compras</span><b>${pesos(I.compras.total)}</b></div>
        ${l('enMargen', 'total', 'Ya en el margen (comisión Transbank, despacho)', I.enMargen, 'Gastos clasificados como "Ya incluido en el margen": su costo ya se resta como costo de venta (Márgenes → Ajustes). No se cuentan dos veces.')}</div>
      <div><h3>Fuera del resultado</h3>${l('fuera', 'capital', 'Capital de créditos', I.fuera.capital, `Cuotas de crédito del mes (${pesos(I.fuera.cuotas)}) menos su interés según la tabla de cada crédito (${pesos(I.interes)}, que va a financieros).`)}
        ${l('fuera', 'impuestos', 'Impuestos (F29, IVA, PPM)', I.fuera.impuestos)}${I.fuera.deuda ? l('fuera', 'deuda', 'Deuda con el fisco (convenio TGR)', I.fuera.deuda, 'La cuota de un convenio de pago con la TGR baja una deuda: no es gasto del mes. Sus intereses y multas sí son gasto financiero.') : ''}${l('fuera', 'inversion', 'Inversiones (entran como depreciación)', I.fuera.inversion)}${l('fuera', 'retiro', 'Retiros', I.fuera.retiro)}${l('fuera', 'otro', 'Otros fuera del resultado', I.fuera.otro)}
        <div class="fin-einfo-l fin-einfo-t"><span>Total fuera del resultado</span><b>${pesos(I.fuera.total)}</b></div>
        ${l('pagosTarjeta', 'total', `Pagos de tarjeta de crédito (cartola · ${nf(I.pagosTarjeta.n)})`, I.pagosTarjeta.monto, 'Cargos de la cartola marcados "Pago de tarjeta". No son gasto: las compras con tarjeta ya entraron como gasto el día de la compra (por el SII). Solo mueven plata: van al flujo de caja. No son parte de Gastos, por eso no entran en la cuadratura.')}</div>
    </div></section>`;
}
// ── Cuadratura con Gastos ──
function htmlCuadratura(H, e) {
  const C = e.cuadratura, I = e.info;
  const l = (t, v, k) => `<div class="fin-einfo-l"><span>${t}</span><b${k ? ` id="${k}"` : ''}>${pesos(v)}</b></div>`;
  return `<section class="tarjeta" aria-labelledby="t-e-cuad"><div class="titulo-fila fin-titulo"><h2 id="t-e-cuad">${ic('balanza', 20)} Cuadratura con Gastos ${H.info('Cuadratura', 'El total de gastos del mes en Gastos (neto, sumado directo de los gastos vigentes) tiene que ser igual a la suma de dónde quedó cada peso: en el resultado (remuneraciones, fijos y financieros), el interés que va dentro de las cuotas, las compras, lo que ya está en el margen, lo que queda fuera del resultado y lo sin clasificar.\nSi algo no cuadra, aparece la diferencia. Lo sin clasificar se arregla en Clasificación.')}</h2>
      <span class="chip ${C.cuadra ? 'c-verde' : C.diferencia ? 'c-rojo' : 'c-amarillo'}" id="e-cuadra">${C.diferencia ? `No cuadra: ${pesos(C.diferencia)}` : C.cuadra ? 'Cuadra' : 'Cuadra, con gastos sin clasificar'}</span></div>
    <div class="fin-ecuad" id="e-cuad">
      ${l('Total de gastos del mes en Gastos', C.totalGastos, 'e-cuad-total')}
      ${l('= En el resultado (remuneraciones, fijos, costos de venta, financieros)', C.enResultado)}${l('+ Interés dentro de las cuotas de crédito', C.interesCuotas)}${l('+ Compras de MP y reventa', C.compras)}${l('+ Ya en el margen', C.enMargen)}${l('+ Fuera del resultado', C.fuera)}${l('+ Sin clasificar', C.sinClasificar)}
      <div class="fin-einfo-l fin-einfo-t"><span>Diferencia</span><b id="e-cuad-dif">${pesos(C.diferencia)}</b></div></div>
    ${I.sinClasificar.n ? `<div class="fin-esin" id="e-sin"><p class="aviso">${nf(I.sinClasificar.n)} ${I.sinClasificar.n === 1 ? 'ítem sin clasificar' : 'ítems sin clasificar'} (${pesos(I.sinClasificar.neto)}): no entran al resultado.</p>
      <ul>${I.sinClasificarLista.map(x => `<li><span>${H.esc(x.item)} · ${nf(x.n)} ${x.n === 1 ? 'línea' : 'líneas'}</span><b>${pesos(x.neto)}</b></li>`).join('')}</ul>
      ${e.conCatalogo ? `<a class="btn-sec" href="#gastos/catalogo">${ic('ir', 16)} Ir a Gastos → Ítems</a>` : `<a class="btn-sec" href="#finanzas/resultados/clasificacion">${ic('ir', 16)} Ir a Clasificación</a>`}</div>` : ''}
  </section>`;
}
// ── Vista secundaria: comunes repartidos por causa ──
function htmlRepartido(H, e, R) {
  const rp = FE.repartirComunes(e, ES.claves || {});
  const A = FE.AREAS_REPARTO;   // v0.69.1: Reventa no recibe comunes (su margen va en Común en esta vista)
  const filaR = (t, vals, tot, cls = '') => `<tr class="${cls}"><th scope="row">${t}</th>${A.map(a => `<td class="fin-enum">${vals[a] === null ? '' : pesos(vals[a])}</td>`).join('')}<td class="fin-enum">${vals.comun === null ? '' : pesos(vals.comun)}</td><td class="fin-enum">${pesos(tot)}</td></tr>`;
  const neg = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? null : -v]));
  const ma = { ...Object.fromEntries(A.map(a => [a, e.filas.ma[a]])), comun: e.filas.ma.comun + (rp.reventa || 0) };
  const rep = { ...Object.fromEntries(A.map(a => [a, rp.porArea[a].total])), comun: rp.sinRepartir.total };
  const res = { ...rp.resultadoArea, comun: rp.comunResto };
  const asignTxt = l => (l.partes ? `${l.porItem ? 'clave del ítem' : 'clave del tipo'}: ${FE.BASES.find(b => b.k === l.base).t}` : 'sin clave: queda sin repartir');
  return `<p class="aviso fin-esec">Vista secundaria, solo para conversar: reparte los comunes por causa (m², maquinaria, horas o % a mano). El resultado de cada área en la vista principal es su margen del área, con los comunes sin repartir.</p>
    <div class="tabla-b2b fin-etabla"><table class="tabla-tiempos fin-eerr" id="e-rep"><thead><tr><th scope="col">Concepto</th>${A.map(a => `<th scope="col" class="fin-enum">${FE.NOMBRE_COL[a]}</th>`).join('')}<th scope="col" class="fin-enum">Común</th><th scope="col" class="fin-enum">Total</th></tr></thead><tbody>
      ${filaR('Margen del área', ma, e.filas.ma.total)}
      ${filaR('− Comunes repartidos', neg(rep), -(rp.sinRepartir.total + A.reduce((x, a) => x + rp.porArea[a].total, 0)))}
      ${filaR('= Resultado con comunes repartidos', res, rp.total, 'fin-eres')}
      ${filaR('− Financieros', { PAN: null, BOL: null, PAS: null, CAF: null, comun: -e.filas.financieros.total }, -e.filas.financieros.total)}
      ${filaR('= Resultado del mes', { PAN: null, BOL: null, PAS: null, CAF: null, comun: null }, rp.total - e.filas.financieros.total, 'fin-eres')}</tbody></table></div>
    <p class="nota-i" id="e-rep-nota">(i) El total es el mismo que en la vista principal: resultado operacional ${pesos(e.filas.resOp.total)}. Común = margen de ventas sin asociar${rp.reventa ? ` y de Reventa (${pesos(rp.reventa)}: Reventa no recibe comunes)` : ''}${rp.canalB2B ? ` + resultado del canal B2B (${pesos(rp.canalB2B)})` : ''} − lo que quedó sin clave.</p>
    ${rp.lineas.length ? `<details class="fin-sindet" id="e-rep-det"><summary>Cómo se repartió cada común (${nf(rp.lineas.length)})</summary><ul class="fin-hist-lista">${rp.lineas.map(l => `<li><div><b>${H.esc(l.item)}</b> · ${pesos(l.neto)}</div><span class="ayuda">${H.esc(asignTxt(l))}${l.partes ? ' · ' + A.filter(a => l.partes[a]).map(a => `${FE.NOMBRE_COL[a]} ${pesos(l.partes[a])}`).join(' · ') : ''}</span></li>`).join('')}</ul></details>` : ''}
    ${htmlClaves(H, e)}`;
}
function htmlClaves(H, e) {
  const C = ES.claves || {}, B = C.bases || {}, A = FE.AREAS_REPARTO;
  const val = (b, a) => { const v = (B[b] || {})[a]; return v === undefined || v === null || v === 0 ? '' : H.esc(String(v)); };
  const selAsig = (id, asig, conTipo) => `<select id="${id}" data-e-asig="${id}">${conTipo ? `<option value="">Como su tipo</option>` : '<option value="">Sin repartir</option>'}${FE.BASES.map(b => `<option value="${b.k}" ${asig && asig.base === b.k ? 'selected' : ''}>${H.esc(b.t)}</option>`).join('')}</select>`;
  const manual = (id, asig) => `<div class="fin-epcts ${asig && asig.base === 'manual' ? '' : 'oculto'}" data-e-man="${id}">${A.map(a => `<label><span>${FE.NOMBRE_COL[a]} %</span><input type="number" inputmode="decimal" min="0" max="100" step="any" data-e-pct="${id}" data-area="${a}" value="${asig && asig.base === 'manual' && asig.pct ? H.esc(String(asig.pct[a] ?? '')) : ''}"></label>`).join('')}</div>`;
  const items = [];
  ['remComun', ...FE.FILAS_COMUNES_FIJOS, 'depComun'].forEach(k => { const vistos = new Set(); ((e.detalle || {})[k + '.comun'] || []).forEach(r => { const c = r.clave || FR.claveItem(r.item || r.nombre); if (c && !vistos.has(c)) { vistos.add(c); items.push({ clave: c, item: r.item || r.nombre || c }); } }); });
  return `<details class="tarjeta plegable fin-eclaves" id="e-claves" ${ES.abiertas.claves ? 'open' : ''}><summary class="titulo-fila"><h3>Claves de reparto ${H.info('Claves de reparto', 'Con qué se reparte cada común entre las áreas, solo para la vista secundaria:\n· Metros cuadrados: arriendo, aseo, seguros del local.\n· Maquinaria (kWh): luz, gas, mantención de equipos.\n· Horas de trabajo: remuneraciones comunes, administración.\n· % a mano: lo que quieras (tiene que sumar 100).\nCada tipo de común tiene su clave; un ítem puede tener una propia que manda sobre la del tipo. Sin clave, queda sin repartir.')}</h3></summary>
    <form id="e-claves-f" novalidate>
      <h4>Bases por área</h4>
      <div class="tabla-b2b"><table class="tabla-tiempos fin-ebases"><thead><tr><th scope="col">Base</th>${A.map(a => `<th scope="col">${FE.NOMBRE_COL[a]}</th>`).join('')}</tr></thead><tbody>
        ${FE.BASES.filter(b => b.k !== 'manual').map(b => `<tr><th scope="row">${H.esc(b.t)}</th>${A.map(a => `<td><label class="sr" for="e-b-${b.k}-${a}">${H.esc(b.t)} ${FE.NOMBRE_COL[a]}</label><input id="e-b-${b.k}-${a}" type="number" inputmode="decimal" min="0" step="any" data-e-base="${b.k}" data-area="${a}" value="${val(b.k, a)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <h4>Clave de cada tipo de común</h4>
      ${FE.TIPOS_COMUNES.map(t => `<div class="fin-easig"><label for="e-t-${t.k}">${H.esc(t.t)}</label>${selAsig('e-t-' + t.k, (C.porTipo || {})[t.k], false)}${manual('e-t-' + t.k, (C.porTipo || {})[t.k])}</div>`).join('')}
      ${items.length ? `<h4>Clave propia de un ítem (opcional)</h4>${items.map(x => `<div class="fin-easig"><label for="e-i-${H.esc(x.clave)}">${H.esc(x.item)}</label>${selAsig('e-i-' + x.clave, (C.porItem || {})[x.clave], true)}${manual('e-i-' + x.clave, (C.porItem || {})[x.clave])}</div>`).join('')}` : ''}
      <p class="error" id="e-claves-err" role="alert"></p>
      <div class="botones"><button type="submit" class="btn" id="e-claves-g">Guardar claves</button></div></form></details>`;
}

// ── Detalle de una cifra ──
const NOMBRE_DET = { compras: 'Compras', enMargen: 'Ya en el margen', fuera: 'Fuera del resultado', pagosTarjeta: 'Pagos de tarjeta de crédito', sinClasificar: 'Sin clasificar' };   // las filas (packaging, tiendas…) usan su texto de FE.FILA
function refsDe(e, k, col) {
  const D = e.detalle || {};
  if (col === 'total' && !D[k + '.total']) return FE.COLS.flatMap(c => D[k + '.' + c] || []);
  return D[k + '.' + col] || [];
}
function dialogoDetalle(H, e, k, col) {
  const refs = refsDe(e, k, col);
  const f = FE.FILA[k], tit = f ? f.t : k.startsWith('ventasCanal_') ? `Ventas netas · ${FE.NOMBRE_SUC[k.slice(12)]}` : (NOMBRE_DET[k] || k);
  const colTxt = FE.NOMBRE_COL[col] || ({ mp: 'materias primas', reventa: 'reventa', capital: 'capital de créditos', impuestos: 'impuestos', deuda: 'deuda con el fisco', inversion: 'inversiones', retiro: 'retiros', otro: 'otros' }[col] || col);
  const tot = refs.reduce((a, r) => a + (r.tipo !== 'venta' ? r.neto : k.startsWith('costoDirecto') ? r.costo : k === 'costosVenta' ? r.costoVenta : r.neto), 0);   // v0.102.0: costos de venta también desde Gastos
  const linea = r => {
    if (r.tipo === 'venta') { const v = k === 'costoDirecto' ? r.costo : k === 'costosVenta' ? r.costoVenta : r.neto; return `<li><div><b>${H.esc(r.nombre)}</b> · ${H.esc(FE.NOMBRE_SUC[r.suc] || r.suc)}</div><span class="ayuda">${nf(r.unidades)} un · venta ${pesos(r.neto)} · costo ${pesos(r.costo)} · costos de venta ${pesos(r.costoVenta)}${r.ok ? '' : ` · ${H.esc(r.motivo || 'sin costo')}`}</span><b class="fin-edval">${pesos(v)}</b></li>`; }
    if (r.tipo === 'gasto') return `<li><div><b>${H.esc(r.item)}</b>${r.itemOriginal ? ` <small>(guardado como ${H.esc(r.itemOriginal)})</small>` : ''} · ${fechaTxt(r.fecha)} · ${H.esc(r.area)}</div><span class="ayuda">${H.esc([r.proveedor, r.obs].filter(Boolean).join(' · ') || '—')} · ${H.esc(FR.textoLinea(r.tipoRes, r.cuenta))}</span><span class="fin-edacc"><b class="fin-edval">${pesos(r.neto)}</b><button type="button" class="fin-mlink" data-e-ver="${H.esc(r.item)}" data-e-vermes="${H.esc(String(r.fecha).slice(0, 7))}">Ver en Gastos</button></span></li>`;
    if (r.tipo === 'cargo') return `<li><div><b>${H.esc(r.nombre)}</b> · ${H.esc(FE.NOMBRE_SUC[r.suc] || r.suc)}${r.catalogoId ? ` · ${H.esc(r.catalogoId)}` : ''}</div><span class="ayuda">${nf(r.unidades)} cobrados · cargo del Catálogo (no es venta de un producto)</span><b class="fin-edval">${pesos(r.neto)}</b></li>`;
    if (r.tipo === 'merma') return `<li><div><b>${H.esc(r.nombre)}</b></div><span class="ayuda">${r.cantidad ? `${nf(r.cantidad)} ${H.esc(r.unidad || '')} · ` : ''}merma de Producción, neto</span><b class="fin-edval">${pesos(r.neto)}</b></li>`;
    if (r.tipo === 'credito') return `<li><div><b>${H.esc(r.nombre)}</b></div><span class="ayuda">Interés de ${nf(r.cuotas)} ${r.cuotas === 1 ? 'cuota pagada' : 'cuotas pagadas'} en el mes (capital ${pesos(r.capital)}, fuera del resultado) · tabla del crédito</span><b class="fin-edval">${pesos(r.neto)}</b></li>`;
    if (r.tipo === 'depreciacion') return `<li><div><b>${H.esc(r.item)}</b> · compra del ${fechaTxt(r.fecha)}</div><span class="ayuda">${pesos(r.valor)} ÷ ${nf(r.meses)} meses${r.area ? ' · ' + H.esc(r.area) : ''}</span><b class="fin-edval">${pesos(r.neto)}</b></li>`;
    if (r.tipo === 'cartola') return `<li><div><b>${H.esc(r.nombre)}</b> · ${fechaTxt(r.fecha)}</div><span class="ayuda">Cargo de la cartola marcado "Pago de tarjeta"</span><b class="fin-edval">${pesos(r.neto)}</b></li>`;
    return '';
  };
  const d = H.dialogo(`<div class="form-dialogo fin-edet"><h2>${H.esc(tit)}</h2><p class="fin-actual">${H.esc(colTxt)} · ${H.esc(FE.mesTxt(ES.mes))} · <b>${pesos(tot)}</b>${refs.length ? ` · ${nf(refs.length)} ${refs.length === 1 ? 'línea' : 'líneas'}` : ''}</p>
    ${refs.length ? `<ul class="fin-hist-lista fin-edlista" id="e-det-lista">${refs.slice(0, 300).map(linea).join('')}</ul>${refs.length > 300 ? `<p class="ayuda">Y ${nf(refs.length - 300)} más.</p>` : ''}` : '<p class="ayuda">Sin detalle.</p>'}
    <div class="botones"><button type="button" class="btn" id="e-det-ok">Cerrar</button></div></div>`);
  d.querySelector('#e-det-ok').addEventListener('click', () => d.close());
  d.querySelectorAll('[data-e-ver]').forEach(b => b.addEventListener('click', () => { d.close(); if (H.verGastos) H.verGastos(b.dataset.eVermes, b.dataset.eVer); }));
}
function dialogoAjustes(H, e) {
  const A = e.ajustes || { porMes: {} };
  const d = H.dialogo(`<div class="form-dialogo fin-edet"><h2>Ajustes de meses cerrados</h2><p class="ayuda">Cambios hechos después de cerrar un mes (un gasto corregido, una factura que llegó tarde…). El mes cerrado no se toca: la diferencia entra aquí. ${pesos(A.total)} en el resultado.</p>
    <ul class="fin-hist-lista" id="e-aj-lista">${Object.entries(A.porMes).map(([m, a]) => `<li><div><b>${H.esc(FE.mesTxt(m))}</b> · resultado ${a.resultado > 0 ? '+' : ''}${pesos(a.resultado)}</div>
      <span class="ayuda">${Object.entries(a.porFila).filter(([k]) => FE.FILA[k]).map(([k, v]) => `${H.esc(FE.FILA[k].t)} ${v > 0 ? '+' : ''}${pesos(v)}`).join(' · ')}</span>
      ${(a.gastos || []).map(g => `<span class="ayuda">${H.esc(g.item)} (${fechaTxt(g.fecha)}): ${g.cambio === 'nuevo' ? 'nuevo' : g.cambio === 'quitado' ? 'quitado o anulado' : 'cambió'} · antes ${pesos(g.antes)}, ahora ${pesos(g.ahora)}</span>`).join('')}</li>`).join('')}</ul>
    <div class="botones"><button type="button" class="btn" id="e-aj-ok">Cerrar</button></div></div>`);
  d.querySelector('#e-aj-ok').addEventListener('click', () => d.close());
}
function conectarEERR(el, H, ctx, R, e, prev) {
  const repintar = () => pintarEERR(el, H, ctx, R);
  const sel = $('e-mes'); if (sel) sel.addEventListener('change', () => { ES.mes = sel.value; ES.msg = ''; ES.err = ''; repintar(); });
  const cmp = $('e-comparar'); if (cmp) cmp.addEventListener('click', () => { ES.comparar = !ES.comparar; repintar(); });
  const ab = $('e-abre-canal'); if (ab) ab.addEventListener('click', () => { ES.abiertas.canal = !ES.abiertas.canal; el.innerHTML = R.cabecera() + htmlEERR(H, e, prev, R); conectarEERR(el, H, ctx, R, e, prev); });
  el.querySelectorAll('[data-e-vista]').forEach(b => b.addEventListener('click', () => { ES.vista = b.dataset.eVista; el.innerHTML = R.cabecera() + htmlEERR(H, e, prev, R); conectarEERR(el, H, ctx, R, e, prev); }));
  el.querySelectorAll('[data-e-det]').forEach(b => b.addEventListener('click', () => (b.dataset.eDet === 'ajustes' ? dialogoAjustes(H, e) : dialogoDetalle(H, e, b.dataset.eDet, b.dataset.eCol))));
  const rl = $('e-releer');
  if (rl) rl.addEventListener('click', async () => {
    rl.disabled = true; olvidar();
    try { await R.releer(); await F.datosMes(ES.mes, { forzar: true }); ES.msg = 'Gastos, ventas y merma leídos de nuevo.'; } catch (x) { ES.err = ctx.error(x, H); }
    repintar();
  });
  // Claves de reparto
  const cl = $('e-claves'); if (cl) cl.addEventListener('toggle', () => { ES.abiertas.claves = cl.open; });
  el.querySelectorAll('[data-e-asig]').forEach(s => s.addEventListener('change', () => { const m = el.querySelector(`[data-e-man="${CSS.escape(s.id)}"]`); if (m) m.classList.toggle('oculto', s.value !== 'manual'); }));
  const f = $('e-claves-f');
  if (f) f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = $('e-claves-err'), b = $('e-claves-g'); err.textContent = '';
    const bases = {}; el.querySelectorAll('[data-e-base]').forEach(i => { (bases[i.dataset.eBase] = bases[i.dataset.eBase] || {})[i.dataset.area] = i.value; });
    const asig = id => { const s = $(id); if (!s || !s.value) return null; if (s.value !== 'manual') return { base: s.value }; const pct = {}; el.querySelectorAll(`[data-e-pct="${CSS.escape(id)}"]`).forEach(i => { pct[i.dataset.area] = i.value; }); return { base: 'manual', pct }; };
    const porTipo = {}; FE.TIPOS_COMUNES.forEach(t => { const a = asig('e-t-' + t.k); if (a) porTipo[t.k] = a; });
    const porItem = { ...((ES.claves || {}).porItem || {}) };
    el.querySelectorAll('[data-e-asig^="e-i-"]').forEach(s => { const k = s.id.slice(4); const a = asig(s.id); if (a) porItem[k] = a; else delete porItem[k]; });
    try { FE.validarClaves({ bases, porTipo, porItem }); } catch (x) { err.textContent = x.message; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { ES.claves = await F.guardarClaves({ bases, porTipo, porItem }); H.registrar('Finanzas: guardó las claves de reparto', Object.keys(porTipo).join(', ') || 'sin claves'); ES.msg = 'Claves de reparto guardadas.'; ES.err = ''; }
    catch (x) { err.textContent = ctx.error(x, H); b.disabled = false; b.textContent = 'Guardar claves'; return; }
    el.innerHTML = R.cabecera() + htmlEERR(H, e, prev, R); conectarEERR(el, H, ctx, R, e, prev);
  });
}

// ═══════════════ Cierre de mes ═══════════════
const TXT_CIERRE = 'Lo acordado (Cómo trabajamos): el mes se cierra después de pagar y cargar su Previred, a más tardar el día 13 del mes siguiente. Orden recomendado: (1) pagar Previred, ojalá antes del día 10; (2) subir el comprobante o el CSV en Gastos → Previred; (3) revisar que esté todo y cerrar el mes.\nAl cerrarlo queda congelado: el estado de resultados de ese mes se guarda tal cual (ventas, costos usados, gastos, créditos, quién y cuándo) y no cambia más.\nLo que aparezca después (una factura atrasada, un gasto corregido) no cambia el mes cerrado: entra como "Ajustes de meses cerrados" en el primer mes abierto siguiente.\nSi una revisión no se cumple, se puede cerrar igual marcando "Cerrar igual" y escribiendo el motivo (queda guardado).';
async function datosCierre(R, mes) {
  // v0.69.5 · Previred del mes (planillas): de la memoria de la sesión, sin lecturas nuevas (lo que falte se lee)
  // v0.101.0 · Desde el inicio (octubre) las revisiones de Gastos salen del Gastos nuevo (gn-finanzas.js); lo demás (ventas, conteos,
  // asociar, clasificar) es igual.
  const D = R.datos;
  if (F.delGastosNuevo(mes) && D.gn && D.gn.error) throw new Error(`No se pudo leer el Gastos nuevo: ${D.gn.error}`);
  if (F.delGastosNuevo(mes) && D.gn) {
    const GF = await import('./gn-finanzas.js?v=0.102.1');
    const [e, dm, conteos] = await Promise.all([vivo(R, mes), F.datosMes(mes), ES.conteos[mes] ? Promise.resolve(ES.conteos[mes]) : F.conteosMes(mes)]);
    ES.conteos[mes] = conteos;
    const G = D.gn.D, pv = GF.previredDelMes(G, mes), I = pv ? (await import('./gn-bandeja.js?v=0.102.1')).indicePagos(G.pagos || []) : null;
    const pagado = pv ? (I.porDoc[pv.id] || []).reduce((a, p) => a + (Number(p.monto) || 0), 0) : 0;
    const gn = { sii: GF.siiDelMes(G.cargas, mes), movs: GF.movsSinRevisarDelMes(G, mes), sinClas: GF.sinClasificarDelMes(G, mes),
      previred: pv ? { total: Number(pv.total) || 0, pagado, completo: pagado >= (Number(pv.total) || 0) - GF.TOL } : null };
    const checks = FE.checksCierre({ mes, gn, ventas: dm.ventasInfo, conteos, sinClasificar: e.info.sinClasificar, catalogo: conCatalogo(R) });
    return { e, checks };
  }
  const [e, dm, conteos, sii, planillas] = await Promise.all([vivo(R, mes), F.datosMes(mes), ES.conteos[mes] ? Promise.resolve(ES.conteos[mes]) : F.conteosMes(mes), ES.sii ? Promise.resolve(ES.sii) : F.cargasSii(), F.planillasPrevired()]);
  ES.conteos[mes] = conteos; ES.sii = sii;
  const checks = FE.checksCierre({ mes, cargasSii: sii, ventas: dm.ventasInfo, cargosPorRevisar: FE.cargosPorRevisarDelMes(ES.cartola.porRevisar, mes), conteos, sinClasificar: e.info.sinClasificar,
    ...(ES.siiPend ? { siiPendientes: SP.pendientesDelMes(ES.siiPend, mes) } : {}), planillas });
  return { e, checks };
}
export async function pintarCierre(el, H, ctx, R) {
  ES.mes = mesValido(ES.mes);
  const tope = cuerpo => R.cabecera() + cuerpo;
  el.innerHTML = tope(`<section class="tarjeta"><div class="vacio" style="border:0" role="status">Revisando ${H.esc(FE.mesTxt(ES.mes))}…</div></section>`);
  let x = null, hist = [];
  try {
    await base();
    if (!cerrado(ES.mes) && ES.mes < mesHoy()) x = await datosCierre(R, ES.mes);
    hist = await F.historialCierres(ES.mes).catch(() => []);
  } catch (er) { el.innerHTML = tope(`<section class="tarjeta"><p class="error" role="alert">${H.esc(ctx.error(er, H))}</p></section>`); return; }
  if (!/^#finanzas\/resultados\/cierre/.test(location.hash)) return;
  el.innerHTML = tope(htmlCierre(H, x, hist));
  conectarCierre(el, H, ctx, R, x);
}
function filaCheck(H, c) {
  return `<li class="fin-ccheck fin-c-${c.nivel}" data-e-check="${c.k}"><span class="fin-cic" aria-hidden="true">${ic(c.nivel === 'ok' ? 'check' : c.nivel === 'aviso' ? 'aviso' : 'x', 18)}</span>
    <div><span class="fin-ctit"><b>${H.esc(c.t)}</b>${c.info ? H.info(c.t, c.info) : ''}</span><span class="ayuda">${H.esc(c.detalle)}</span></div>
    <span class="fin-cest"><span class="chip chip-chico ${c.nivel === 'ok' ? 'c-verde' : c.nivel === 'aviso' ? 'c-amarillo' : 'c-rojo'}">${c.nivel === 'ok' ? 'Listo' : c.nivel === 'aviso' ? 'Aviso' : 'Falta'}</span>${c.nivel !== 'ok' && c.ir ? `<a class="btn-sec btn-chico" href="${c.ir}">${ic('ir', 14)} Revisar</a>` : ''}</span></li>`;
}
function htmlCierre(H, x, hist) {
  const c = ES.cierres[ES.mes], cerr = cerrado(ES.mes);
  let cuerpo;
  if (cerr) {
    cuerpo = `<div class="fin-econg" id="c-estado">${ic('candado', 18)}<span><b>${H.esc(FE.mesTxt(ES.mes))} está cerrado</b> desde el ${fechaTxt(c.cerradoEn)} por ${H.esc(c.cerradoPor || '—')}. Resultado del mes: <b>${pesos(c.filas.resultado.total)}</b>.${c.override ? ` Se cerró con revisiones pendientes (${H.esc(c.override.fallas.join(', '))}): ${H.esc(c.override.motivo)}.` : ''}</span></div>
      <ul class="fin-cchecks" id="c-checks">${(c.checks || []).map(k => filaCheck(H, k)).join('')}</ul>
      <div class="botones fin-cbot"><a class="btn-sec" href="#finanzas/resultados">Ver el estado de resultados</a><button type="button" class="btn-sec btn-peligro" id="c-reabrir">${ic('abierto', 16)} Reabrir</button></div>
      <p class="nota-i">(i) Reabrir se puede, pero no se recomienda: el mes deja de estar congelado y sus números pueden cambiar respecto de lo que ya informaste. Para corregir algo de un mes cerrado no hace falta reabrir: el cambio aparece solo como ajuste en el mes siguiente.</p>`;
  } else if (ES.mes >= mesHoy()) {
    cuerpo = `<p class="aviso" id="c-estado">${H.esc(FE.mesTxt(ES.mes))} está en curso. Se cierra después de pagar y cargar su Previred, a más tardar el 13 de ${H.esc(FE.MESES_L[Number(FE.mesMas(ES.mes, 1).slice(5, 7)) - 1])}.</p>`;
  } else {
    const fs = FE.fallas(x.checks);
    cuerpo = `${c && c.estado === 'reabierto' ? `<p class="aviso" id="c-reab">Se reabrió el ${fechaTxt(c.reabiertoEn)} por ${H.esc(c.reabiertoPor || '—')}: ${H.esc(c.motivoReabrir || '')}</p>` : ''}
      <ul class="fin-cchecks" id="c-checks">${x.checks.map(k => filaCheck(H, k)).join('')}</ul>
      <div class="fin-cres"><span>Resultado del mes (hoy): <b id="c-resultado">${pesos(x.e.filas.resultado.total)}</b></span><a class="btn-sec btn-chico" href="#finanzas/resultados">Ver el estado de resultados</a></div>
      ${fs.length ? `<div class="fin-cover" id="c-over"><label class="check"><input type="checkbox" id="c-igual"> Cerrar igual, con ${fs.length === 1 ? 'una revisión pendiente' : `${fs.length} revisiones pendientes`}</label>
        <div class="campo"><label for="c-motivo">Motivo (obligatorio para cerrar igual)</label><textarea id="c-motivo" rows="2" maxlength="300" placeholder="Por ejemplo: la factura de luz llega tarde; entra como ajuste"></textarea></div></div>` : ''}
      <p class="error" id="c-err" role="alert">${H.esc(ES.err)}</p>
      <div class="botones fin-cbot"><button type="button" class="btn" id="c-cerrar">${ic('candado', 16)} Cerrar ${H.esc(FE.mesTxt(ES.mes))}</button></div>`;
  }
  return `<section class="tarjeta" aria-labelledby="t-c-cierre">
    <div class="titulo-fila fin-titulo"><h2 id="t-c-cierre">Cierre de mes ${H.info('Cierre de mes', TXT_CIERRE)}</h2>${F.gnActivo() ? '' : '<a class="btn-link" href="#finanzas/resumen" id="c-ir-resumen">Ver el Resumen del mes</a>'}</div>
    <div class="fin-ecab">${selectorMes(H, 'c-mes')}</div>
    <p class="ok-texto" id="c-msg" role="status">${H.esc(ES.msg)}</p>
    ${cuerpo}
    ${hist.length ? `<details class="fin-sindet" id="c-hist"><summary>${ic('hist', 16)} Historial del cierre (${nf(hist.length)})</summary><ul class="fin-hist-lista">${hist.map(h => `<li><div><b>${fechaTxt(h.fecha)}</b> · ${h.accion === 'cerrado' ? 'Cerrado' : 'Reabierto'}${h.resultado !== null && h.resultado !== undefined ? ` · resultado ${pesos(h.resultado)}` : ''}</div><span class="ayuda">${H.esc(h.por || '')}${h.motivo ? ' · ' + H.esc(h.motivo) : ''}</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}
function conectarCierre(el, H, ctx, R, x) {
  const repintar = () => pintarCierre(el, H, ctx, R);
  const sel = $('c-mes'); if (sel) sel.addEventListener('change', () => { ES.mes = sel.value; ES.msg = ''; ES.err = ''; repintar(); });
  const ce = $('c-cerrar');
  if (ce) ce.addEventListener('click', async () => {
    const fs = FE.fallas(x.checks), err = $('c-err'); err.textContent = '';
    let override = null;
    if (fs.length) {
      if (!$('c-igual').checked) { err.textContent = 'Hay revisiones pendientes: arréglalas, o marca "Cerrar igual" y escribe el motivo.'; return; }
      const m = $('c-motivo').value.trim(); if (m.length < 5) { err.textContent = 'Escribe el motivo para cerrar igual (al menos 5 letras).'; return; }
      override = { motivo: m };
    }
    const ok = await new Promise(res => {
      const d = H.dialogo(`<div class="form-dialogo"><h2>Cerrar ${H.esc(FE.mesTxt(ES.mes))}</h2><p>El estado de resultados de ${H.esc(FE.mesTxt(ES.mes))} queda <b>congelado</b> tal como está hoy (resultado ${pesos(x.e.filas.resultado.total)}). Lo que cambie después entra como ajuste en el mes siguiente.</p>${override ? `<p class="aviso">Se cierra con ${fs.length === 1 ? 'una revisión pendiente' : `${fs.length} revisiones pendientes`}: ${H.esc(override.motivo)}</p>` : ''}
        <div class="botones"><button type="button" class="btn-sec" id="c-no">Cancelar</button><button type="button" class="btn" id="c-si">Cerrar el mes</button></div></div>`);
      d.querySelector('#c-no').addEventListener('click', () => { d.close(); res(false); });
      d.querySelector('#c-si').addEventListener('click', () => { d.close(); res(true); });
    });
    if (!ok) return;
    ce.disabled = true; ce.lastChild.textContent = ' Cerrando…';
    try {
      const aj = await ajustesPara(R, ES.mes);
      const snap = FE.armarSnapshot(x.e, { checks: x.checks, override, ajustes: Object.keys(aj.porMes).length ? aj : null });
      ES.cierres[ES.mes] = await F.cerrarMes(ES.mes, snap);
      H.registrar('Finanzas: cerró un mes', `${FE.mesTxt(ES.mes)} · resultado ${x.e.filas.resultado.total}${override ? ' · cerrado igual: ' + override.motivo : ''}`);
      ES.msg = `${FE.mesTxt(ES.mes)} cerrado: queda congelado.`; ES.err = '';
    } catch (er) { ES.err = ctx.error(er, H); }
    repintar();
  });
  const ra = $('c-reabrir');
  if (ra) ra.addEventListener('click', () => {
    const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>Reabrir ${H.esc(FE.mesTxt(ES.mes))}</h2>
      <p class="aviso">No se recomienda: el mes deja de estar congelado y sus números pueden cambiar respecto de lo que ya informaste. Para corregir algo de un mes cerrado no hace falta reabrirlo: el cambio entra solo como ajuste en el mes siguiente.</p>
      <div class="campo"><label for="c-r-mot">Motivo</label><textarea id="c-r-mot" rows="2" maxlength="300"></textarea></div><p class="error" id="c-r-err" role="alert"></p>
      <div class="botones"><button type="button" class="btn-sec" id="c-r-no">Cancelar</button><button type="submit" class="btn btn-peligro" id="c-r-si">Reabrir</button></div></form>`);
    d.querySelector('#c-r-no').addEventListener('click', () => d.close());
    d.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const m = d.querySelector('#c-r-mot').value.trim(), er = d.querySelector('#c-r-err');
      if (m.length < 5) { er.textContent = 'Escribe el motivo (al menos 5 letras).'; return; }
      const b = d.querySelector('#c-r-si'); b.disabled = true; b.textContent = 'Reabriendo…';
      try { await F.reabrirMes(ES.mes, m); H.registrar('Finanzas: reabrió un mes', `${FE.mesTxt(ES.mes)} · ${m}`); ES.cierres = null; ES.vivo = {}; ES.msg = `${FE.mesTxt(ES.mes)} reabierto.`; d.close(); repintar(); }
      catch (x2) { er.textContent = ctx.error(x2, H); b.disabled = false; b.textContent = 'Reabrir'; }
    });
  });
}
