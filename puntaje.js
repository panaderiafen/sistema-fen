// ═══════════════════════════════════════════════
//  Sistema Fën · puntaje.js · v0.69.0 (Entrega B del rediseño de Conciliación)
//  El puntaje (0 a 100) de cada propuesta, explicado: puro y en el navegador, con lo que la pantalla ya tiene leído.
//  Factores (los pesos están todos en PESOS):
//   · monto: exacto (±$1) alto; una combinación que suma exacto, alto pero un poco menos; si no, baja;
//   · quién es: el RUT confirmado (transferencia o RUT en la glosa) alto; el proveedor o el cliente reconocido por su nombre o
//     por la glosa aprendida, medio; nada, cero;
//   · la fecha: contra lo normal de ese proveedor o cliente (el ritmo de pago: la mediana de días entre la factura y el pago, con
//     su dispersión, en 12 meses); sin historia, contra las ventanas de siempre;
//   · de dónde sale la propuesta: una regla (con su nivel), lo aprendido de la glosa exacta, un documento o una combinación;
//   · descuentos: hay otra opción a 5 puntos o menos, parece repetido (débil) o dos reglas (o una regla y un documento) chocan.
//  Lo que nunca se confirma solo (probable, la regla solo propone, Previred, abonos de sueldo…) queda con tope 84.
//  En la bandeja: 85 o más y sin choque → Listo (verde); 50 a 84 → Revisar (amarillo); menos de 50 o nada → Sin coincidencia (rojo).
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v);
const n = v => Number(v) || 0;
export const PESOS = {
  monto: { exacto: 30, combinacion: 25, rango: 30, parecido: 20, sinReferencia: 10, cerca: 15, lejos: 0 },
  quien: { rut: 25, nombre: 15, glosa: 15, obligacion: 15, parcial: 8, nada: 0 },
  fecha: { ritmo: 15, ritmoCerca: 8, ventana: 10, fuera: 0 },
  fuente: { reglaListos: 60, reglaProponer: 35, aprendidaListos: 60, aprendidaProponer: 35, documento: 35, gasto: 35, gastoEspera: 45, folio: 45, cliente: 35, combinacion: 30, monto: 20, repetido: 55 },
  descuento: { ambiguo: -12, repetidoDebil: -20, conflicto: -25 },
  tope: 84,
  umbral: { listo: 85, revisar: 50 },
  ambiguedad: 5,
  ritmo: { minimo: 3, dias: 365, minDisp: 1 }
};
const esIso = f => /^\d{4}-\d{2}-\d{2}/.test(s(f));
export const diasEntre = (a, b) => (esIso(a) && esIso(b) ? Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5) : null);
const sumar = (f, k) => { if (!esIso(f)) return '0000-00-00'; const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + k)); return d.toISOString().slice(0, 10); };
const pesos = v => '$' + Math.round(n(v)).toLocaleString('es-CL');
const dd = k => `${k} ${Math.abs(k) === 1 ? 'día' : 'días'}`;

// ═══ El ritmo de pago ═══
export function mediana(l) { const x = (l || []).filter(v => isFinite(v)).slice().sort((a, b) => a - b); if (!x.length) return null; const m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : Math.round((x[m - 1] + x[m]) / 2); }
// pares: [{ clave (RUT o cliente), fechaDoc, fechaPago, id (para no contar dos veces el mismo folio) }] → { clave: { n, mediana, disp } }
// disp = la mediana de las diferencias con la mediana (redondeada, al menos 1 día). Solo los pagos de los últimos 12 meses y con 3 o más.
export function ritmos(pares, hoy) {
  const corte = sumar(hoy, -PESOS.ritmo.dias), por = {}, vistos = new Set();
  (pares || []).forEach(p => {
    if (!p || !p.clave || !esIso(p.fechaDoc) || !esIso(p.fechaPago) || p.fechaPago < corte) return;
    const k = p.clave + '|' + s(p.id || p.fechaDoc); if (vistos.has(k)) return; vistos.add(k);
    const d = diasEntre(p.fechaDoc, p.fechaPago); if (d === null || d < -10 || d > 200) return;
    (por[p.clave] = por[p.clave] || []).push(d);
  });
  const out = {};
  Object.entries(por).forEach(([k, l]) => { if (l.length < PESOS.ritmo.minimo) return; const m = mediana(l); out[k] = { n: l.length, mediana: m, disp: Math.max(PESOS.ritmo.minDisp, mediana(l.map(x => Math.abs(x - m)))) }; });
  return out;
}
export const ritmoTxt = (r, quien = 'proveedor') => (r ? (quien === 'cliente' ? `este cliente te paga en promedio a los ${dd(r.mediana)} de la factura (±${r.disp})` : `a este proveedor le pagas en promedio a los ${dd(r.mediana)} de la factura (±${r.disp})`) : '');
// La fecha contra lo normal: a ±disp → todo; hasta 3×disp+3 → la mitad; más lejos → nada
export function factorFecha(fechaDoc, fechaPago, r, enVentana, de = 'de la factura') {
  const d = diasEntre(fechaDoc, fechaPago);
  if (r && d !== null) {
    const lejos = Math.abs(d - r.mediana), txt = `${d === 0 ? 'el mismo día' : 'a ' + dd(d)} ${de} (lo normal: ${r.mediana} ± ${r.disp})`;
    if (lejos <= r.disp) return { k: 'fecha', pts: PESOS.fecha.ritmo, txt };
    if (lejos <= 3 * r.disp + 3) return { k: 'fecha', pts: PESOS.fecha.ritmoCerca, txt };
    return { k: 'fecha', pts: PESOS.fecha.fuera, txt, malo: true };
  }
  if (enVentana === undefined || enVentana === null) return null;
  const t = d === null ? '' : ` (${d === 0 ? 'el mismo día' : dd(Math.abs(d)) + (d >= 0 ? ' después' : ' antes')} ${de})`;
  return enVentana ? { k: 'fecha', pts: PESOS.fecha.ventana, txt: 'dentro de las fechas de siempre' + t } : { k: 'fecha', pts: PESOS.fecha.fuera, txt: 'fuera de las fechas de siempre' + t, malo: true };
}

// ═══ El puntaje ═══
// f = { monto, quien, fecha, fuente: factores { k, pts, txt, malo? }; puedeListo; tope (motivo); ambiguo; repetidoDebil; conflicto }
export function puntuar(f) {
  const fs = [f.quien, f.monto, f.fecha, f.fuente].filter(Boolean);
  // Lo que suma llega a 100 como máximo; los descuentos se restan después (así una opción parecida o un choque siempre se notan)
  let v = Math.min(100, fs.reduce((t, x) => t + n(x.pts), 0));
  const des = [];
  if (f.ambiguo) des.push({ k: 'descuento', pts: PESOS.descuento.ambiguo, txt: typeof f.ambiguo === 'string' ? f.ambiguo : 'hay otra opción parecida', malo: true });
  if (f.repetidoDebil) des.push({ k: 'descuento', pts: PESOS.descuento.repetidoDebil, txt: typeof f.repetidoDebil === 'string' ? f.repetidoDebil : 'puede ser un repetido de otra cartola', malo: true });
  if (f.conflicto) des.push({ k: 'descuento', pts: PESOS.descuento.conflicto, txt: typeof f.conflicto === 'string' ? f.conflicto.charAt(0).toLowerCase() + f.conflicto.slice(1) : 'una regla dice otra cosa', malo: true });
  v += des.reduce((t, x) => t + x.pts, 0);
  v = Math.max(0, Math.min(100, Math.round(v)));
  const out = fs.concat(des);
  if (!f.puedeListo && v > PESOS.tope) { v = PESOS.tope; out.push({ k: 'tope', pts: 0, txt: 'tope ' + PESOS.tope + ': ' + (f.tope || 'nunca se confirma solo'), malo: true }); }
  else if (!f.puedeListo && f.tope) out.push({ k: 'tope', pts: 0, txt: f.tope, malo: true, info: true });
  return { valor: v, factores: out };
}
export function clase(pt, { hay, conflicto, puedeListo } = {}) {
  if (!hay || !pt) return 'sin';
  if (pt.valor >= PESOS.umbral.listo && !conflicto && puedeListo) return 'listo';
  return pt.valor >= PESOS.umbral.revisar ? 'revisar' : 'sin';
}
// "+ mismo RUT · + monto exacto · + a 2 días (lo normal: 28 ± 6) · − hay otra opción parecida"
export const factoresTxt = pt => ((pt && pt.factores) || []).filter(x => x.txt).map(x => `${x.malo || n(x.pts) < 0 ? '−' : '+'} ${x.txt}`);

// ═══ Cargos ═══
// ctx = { D (lista de Gastos), ritmos ({ rut → ritmo }), B (gastos-banco.js: ventanas), regla (la regla de la propuesta, vista) }
function quienCargo(c, p) {
  if (p && (p.por === 'rut' || (p.tipo === 'sii_pend' && p.conf === 'seguro') || (p.gasto && c.rut && p.gasto.rut === c.rut))) return { k: 'quien', pts: PESOS.quien.rut, txt: c.rutDe === 'tef' ? 'mismo RUT (transferencia enviada)' : 'mismo RUT' };
  if (p && p.combo && p.conf === 'seguro') return { k: 'quien', pts: PESOS.quien.rut, txt: 'mismo RUT del proveedor' };
  if (p && (p.por === 'proveedor' || (p.combo && c.proveedor))) return { k: 'quien', pts: PESOS.quien.nombre, txt: 'proveedor reconocido' + (c.proveedor && c.proveedor.nombre ? ` (${c.proveedor.nombre})` : '') };
  if (p && p.por === 'aprendido') return { k: 'quien', pts: PESOS.quien.glosa, txt: 'glosa aprendida' };
  // v0.69.2 · El saldo de un documento con partes: el proveedor del cargo es el del documento (RUT o nombre)
  if (p && p.saldoDoc && p.quien === 'rut') return { k: 'quien', pts: PESOS.quien.rut, txt: c.rutDe === 'tef' ? 'mismo RUT del documento (transferencia enviada)' : 'mismo RUT del documento' };
  if (p && p.saldoDoc && p.quien === 'proveedor') return { k: 'quien', pts: PESOS.quien.nombre, txt: 'proveedor reconocido' + (c.proveedor && c.proveedor.nombre ? ` (${c.proveedor.nombre})` : '') };
  if (p && p.saldoDoc) return { k: 'quien', pts: PESOS.quien.parcial, txt: 'nada dice que sea de ese proveedor', malo: true };
  // v0.70.0 · Boleta de luz o agua: la glosa dice la empresa (CGE, ESSBIO) o es una cuenta recurrente conocida
  if (p && p.por === 'boleta') return p.empresaEnGlosa ? { k: 'quien', pts: PESOS.quien.rut, txt: `la glosa dice ${p.empresa}` } : { k: 'quien', pts: PESOS.quien.obligacion, txt: 'cuenta recurrente conocida' };
  if (p && (p.por === 'monto fijo' || p.por === 'documento' || p.por === 'saldo')) return { k: 'quien', pts: PESOS.quien.obligacion, txt: 'cuenta recurrente conocida' };
  if (p && p.por === 'regla') return { k: 'quien', pts: PESOS.quien.glosa, txt: 'la glosa calza con tu regla' };
  if (p && p.por === 'glosa') return { k: 'quien', pts: PESOS.quien.glosa, txt: 'la glosa dice Previred' };
  return { k: 'quien', pts: PESOS.quien.nada, txt: 'nada dice a quién se pagó', malo: true };
}
function montoCargo(c, p, ctx) {
  const D = ctx.D || {}, r = ctx.regla, vs = D.vencimientos || [];
  if (p.tipo === 'vencimientos' && p.sinPropuesta) return (p.opciones || []).some(o => Math.abs(n(o.monto) - c.monto) <= 1) ? { k: 'monto', pts: PESOS.monto.exacto, txt: 'monto exacto' } : { k: 'monto', pts: PESOS.monto.sinReferencia, txt: 'falta el documento con el monto' };
  // v0.70.0 · El total a pagar (o el saldo anterior) exacto de una boleta; un pago en partes no calza con un total
  if (p.tipo === 'vencimientos' && p.por === 'boleta') return p.que === 'orden' ? { k: 'monto', pts: PESOS.monto.lejos, txt: 'paga una parte: lo más antiguo primero', malo: true } : { k: 'monto', pts: PESOS.monto.exacto, txt: p.que === 'saldo' ? 'el saldo anterior exacto de la boleta' : 'el total a pagar exacto de la boleta' };
  if (p.tipo === 'vencimientos') {
    if ((p.pagos || []).length > 1) return { k: 'monto', pts: PESOS.monto.combinacion, txt: `${p.pagos.length} por pagar suman exacto` };
    const v = vs.find(x => x.id === (p.pagos || [])[0].id), m = v ? (v.estadoBase === 'con_abonos' && v.saldo ? v.saldo : v.monto) : 0;
    if (!m) return { k: 'monto', pts: PESOS.monto.sinReferencia, txt: 'el vencimiento no tiene monto' };
    const dif = Math.abs(m - c.monto);
    if (dif <= 1) return { k: 'monto', pts: PESOS.monto.exacto, txt: 'monto exacto' };
    return dif <= m * 0.15 ? { k: 'monto', pts: PESOS.monto.cerca, txt: `monto parecido al estimado (${pesos(m)})` } : { k: 'monto', pts: PESOS.monto.lejos, txt: `el monto no calza con el estimado (${pesos(m)})`, malo: true };
  }
  if (p.tipo === 'gasto' && !p.combo && p.gasto && Math.abs(Math.abs(n(p.gasto.monto)) - c.monto) > 1) return { k: 'monto', pts: PESOS.monto.lejos, txt: `otro monto (${pesos(p.gasto.monto)})`, malo: true };
  if (p.tipo === 'gasto') return p.combo ? { k: 'monto', pts: PESOS.monto.combinacion, txt: 'la suma calza exacto' } : { k: 'monto', pts: PESOS.monto.exacto, txt: 'monto exacto' };
  if (p.tipo === 'sii_pend') { const v = (D.siiPendientes || []).find(x => x.id === p.docId); if (v && Math.abs(Math.abs(n(v.total)) - c.monto) > 1) return { k: 'monto', pts: PESOS.monto.lejos, txt: `otro monto (${pesos(v.total)})`, malo: true }; }
  if (p.tipo === 'abono_parcial' && p.saldoDoc) return { k: 'monto', pts: PESOS.monto.exacto, txt: `el saldo exacto (de ${pesos(p.total)}, ya tiene ${p.partes} ${p.partes === 1 ? 'pago' : 'pagos'})` };
  if (p.tipo === 'sii_pend' || p.tipo === 'abono_parcial') return { k: 'monto', pts: PESOS.monto.exacto, txt: 'monto exacto' };
  // v0.69.2 · Un pago parcial: el monto no calza con el documento (paga una parte)
  if (p.tipo === 'pago_parcial') return { k: 'monto', pts: PESOS.monto.lejos, txt: `paga una parte: ${pesos(c.monto)} de ${pesos(p.pendiente)}, falta ${pesos(p.falta)}`, malo: true };
  // Resultados sin documento (gasto nuevo, no es gasto, tarjeta, traspaso, abono de sueldo, Previred): el rango de la regla o el último monto
  if (r && (r.cond.montoMin !== null || r.cond.montoMax !== null)) return { k: 'monto', pts: PESOS.monto.rango, txt: 'monto dentro del rango de la regla' };
  const ult = r ? n(r.ultimoMonto) : 0;
  if (ult && ['nuevo', 'ignorar', 'pago_tarjeta', 'traspaso'].includes(p.tipo)) return Math.abs(c.monto - ult) <= ult * 0.5 ? { k: 'monto', pts: PESOS.monto.parecido, txt: `monto parecido al último (${pesos(ult)})` } : { k: 'monto', pts: PESOS.monto.lejos, txt: `monto lejos del último (${pesos(ult)})`, malo: true };
  return { k: 'monto', pts: PESOS.monto.sinReferencia, txt: r ? 'la regla no fija el monto' : 'sin monto con qué comparar' };
}
function fechaCargo(c, p, ctx) {
  const D = ctx.D || {}, R = ctx.ritmos || {}, B = ctx.B, vs = D.vencimientos || [];
  if (p.tipo === 'gasto' && p.gasto && !p.combo) {
    const g = p.gasto, rr = (g.rut && R[g.rut]) || (c.rut && R[c.rut]) || null, dist = diasEntre(g.fecha, c.fecha);
    return factorFecha(g.fecha, c.fecha, g.clase === 'sii' || g.folio ? rr : null, B && B.enVentanaExacta && dist !== null ? B.enVentanaExacta(dist, g) : true, g.folio ? 'de la factura' : 'del gasto');
  }
  // v0.70.0 · Boleta: contra la fecha de pago de esa boleta (su vencimiento o, sin él, su emisión)
  if (p.tipo === 'vencimientos' && p.por === 'boleta' && p.boletaId) {
    const v = vs.find(x => x.id === p.boletaId), f = v && v.boleta ? (v.boleta.vence || v.boleta.emision || v.fecha) : ''; if (!f) return null;
    const d = diasEntre(f, c.fecha); if (d === null) return null;
    return d >= -20 && d <= 40 ? { k: 'fecha', pts: PESOS.fecha.ritmo, txt: d === 0 ? 'el mismo día que vence la boleta' : `a ${dd(Math.abs(d))} ${d > 0 ? 'después' : 'antes'} del vencimiento de la boleta` } : { k: 'fecha', pts: PESOS.fecha.fuera, txt: 'lejos de la fecha de la boleta', malo: true };
  }
  if (p.tipo === 'vencimientos' && !p.sinPropuesta && (p.pagos || []).length) {
    const v = vs.find(x => x.id === p.pagos[0].id); if (!v) return null;
    const rr = v.rut && R[v.rut] && v.fechaDoc ? R[v.rut] : null;
    if (rr) return factorFecha(v.fechaDoc, c.fecha, rr, true);
    const d = diasEntre(v.fecha, c.fecha); if (d === null) return null;
    if (Math.abs(d) <= 3) return { k: 'fecha', pts: PESOS.fecha.ritmo, txt: d === 0 ? 'el mismo día del vencimiento' : `a ${dd(Math.abs(d))} del vencimiento` };
    return factorFecha(v.fecha, c.fecha, null, d >= -15 && d <= 10, 'del vencimiento');
  }
  // v0.69.2 · El saldo de un documento con partes y el pago parcial: la fecha del documento (o de su saldo)
  if ((p.tipo === 'abono_parcial' && p.saldoDoc) || (p.tipo === 'pago_parcial' && p.doc)) {
    const v = p.vencId ? vs.find(x => x.id === p.vencId) : p.doc && p.doc.tipo === 'venc' ? vs.find(x => x.id === p.doc.vencId) : null;
    const f = v ? v.fecha : p.doc && p.doc.fecha; if (!f) return null;
    const d = diasEntre(f, c.fecha); if (d === null) return null;
    if (Math.abs(d) <= 3) return { k: 'fecha', pts: PESOS.fecha.ritmo, txt: d === 0 ? 'el mismo día que vence el saldo' : `a ${dd(Math.abs(d))} de la fecha del saldo` };
    return factorFecha(f, c.fecha, null, d >= -15 && d <= 45, v ? 'de la fecha del saldo' : 'del documento');
  }
  if (p.tipo === 'sii_pend') {
    const v = (D.siiPendientes || []).find(x => x.id === p.docId); if (!v) return null;
    const rut = s(v.rut || v.rutEmisor).toUpperCase().replace(/[^0-9K]/g, '');
    const d = diasEntre(v.fecha, c.fecha);
    return factorFecha(v.fecha, c.fecha, rut ? R[rut] : null, d !== null && d >= -5 && d <= 60);
  }
  return null;
}
const FUENTE_TXT = { 'monto fijo': 'monto fijo de la cuenta recurrente', documento: 'monto del documento de la cuenta recurrente', rut: 'factura del proveedor por pagar', saldo: 'el saldo de un por pagar con abonos', monto: 'solo calza el monto', glosa: 'la glosa', boleta: 'la boleta de la cuenta (lo más antiguo primero)' };
function fuenteCargo(c, p) {
  const nr = p.nivelRegla;
  if (p.por === 'regla') return { k: 'fuente', pts: nr === 'listos' ? PESOS.fuente.reglaListos : PESOS.fuente.reglaProponer, txt: `tu regla (${nr === 'listos' ? 'pasa a Listos' : 'solo propone'})` };
  if (p.por === 'aprendido') return { k: 'fuente', pts: nr === 'proponer' ? PESOS.fuente.aprendidaProponer : PESOS.fuente.aprendidaListos, txt: nr === 'proponer' ? 'lo aprendiste (la regla solo propone)' : 'lo aprendiste al conciliar esta glosa' };
  if (p.tipo === 'gasto' && p.combo) return { k: 'fuente', pts: PESOS.fuente.combinacion, txt: 'combinación de documentos del proveedor' };
  if (p.tipo === 'gasto') { const esp = !!(p.gasto && (p.gasto.esperaCargo || p.gasto.clase === 'espera')); return { k: 'fuente', pts: esp ? PESOS.fuente.gastoEspera : p.por === 'monto' && !p.seguro ? PESOS.fuente.monto : p.por === 'monto' ? PESOS.fuente.gastoEspera : PESOS.fuente.gasto, txt: p.registrado ? 'factura del SII ya registrada' : esp ? 'pago registrado a mano que espera su cargo' : 'gasto ya registrado, sin cargo' }; }
  if (p.tipo === 'sii_pend') return { k: 'fuente', pts: PESOS.fuente.documento, txt: 'factura del SII por clasificar' };
  if (p.tipo === 'abono_parcial' && p.saldoDoc) return { k: 'fuente', pts: PESOS.fuente.documento, txt: 'el saldo de un documento que ya tiene pagos' };
  if (p.tipo === 'pago_parcial') return { k: 'fuente', pts: PESOS.fuente.documento, txt: 'documento del proveedor por pagar, mayor que el cargo' };
  if (p.registrado) return { k: 'fuente', pts: PESOS.fuente.documento, txt: 'factura del SII ya registrada' };
  if (p.tipo === 'vencimientos' && p.sinPropuesta) return { k: 'fuente', pts: PESOS.fuente.documento, txt: 'por pagar de la cuenta recurrente' };
  if (p.por === 'monto') return { k: 'fuente', pts: PESOS.fuente.monto, txt: FUENTE_TXT.monto };
  if (p.por === 'glosa') return { k: 'fuente', pts: PESOS.fuente.aprendidaProponer, txt: 'la glosa dice Previred' };
  return { k: 'fuente', pts: PESOS.fuente.documento, txt: FUENTE_TXT[p.por] || 'documento del mismo monto' };
}
function topeCargo(p) {
  if (p.sinPropuesta) return 'elige cuál paga';
  if (p.tipo === 'previred') return 'Previred se revisa juntando los cargos';
  if (p.tipo === 'abono') return 'los abonos de sueldo se revisan siempre';
  if (p.tipo === 'gasto' && p.combo) return 'una combinación se revisa en el detalle';
  if (p.tipo === 'sii_pend') return 'la factura se clasifica antes';
  if (p.tipo === 'abono_parcial') return p.saldoDoc ? 'el proveedor del cargo no se reconoce como el del documento' : 'el abono parcial se revisa';
  if (p.tipo === 'pago_parcial') return 'un pago parcial se revisa siempre';
  if (p.por === 'boleta') return p.que === 'orden' ? 'un pago en partes se revisa siempre' : 'la glosa no dice la empresa de la boleta';
  if ((p.por === 'regla' || p.por === 'aprendido') && p.nivelRegla === 'proponer') return 'la regla solo propone';
  return 'probable: confírmalo tú';
}
// → { valor, factores, puedeListo }
export function cargo(c, p, ctx = {}) {
  if (!p) return null;
  const puedeListo = !!p.seguro && !p.sinPropuesta && !c.repetidoProp;
  const f = { quien: quienCargo(c, p), monto: montoCargo(c, p, ctx), fecha: fechaCargo(c, p, ctx), fuente: fuenteCargo(c, p), puedeListo, tope: puedeListo ? '' : topeCargo(p),
    ambiguo: ctx.ambiguo, repetidoDebil: c.repetidoProp ? (c.repetidoProp.candidatos || []).some(x => x.fuerte) ? 'parece el mismo movimiento de otra cartola' : 'puede ser un repetido de otra cartola' : '', conflicto: ctx.conflicto || '' };
  if (p.sinPropuesta || (p.opciones && p.duda && p.tipo === 'vencimientos')) f.ambiguo = f.ambiguo || (p.sinPropuesta ? `hay ${(p.opciones || []).length} opciones` : 'hay otro vencimiento del mismo monto');
  return { ...puntuar(f), puedeListo };
}
// El repetido propuesto: su propio puntaje (fuerte o débil), nunca Listo
export function repetidoCargo(c) {
  const l = (c.repetidoProp && c.repetidoProp.candidatos) || []; if (!l.length) return null;
  const o = l[0], fuerte = !!o.fuerte;
  const f = { monto: { k: 'monto', pts: PESOS.monto.exacto, txt: 'mismo monto' }, fecha: { k: 'fecha', pts: PESOS.fecha.ventana, txt: o.dias ? `fecha a ${dd(o.dias)}` : 'la misma fecha' },
    quien: fuerte ? { k: 'quien', pts: PESOS.quien.rut, txt: { operacion: 'mismo N° de operación', glosa: 'misma glosa', rut: 'mismo RUT en la glosa' }[o.por] || 'misma glosa' } : { k: 'quien', pts: 0, txt: 'solo coinciden la fecha y el monto', malo: true },
    fuente: { k: 'fuente', pts: fuerte ? PESOS.fuente.repetido : PESOS.fuente.monto, txt: 'movimiento de otra cartola' }, puedeListo: false, tope: 'primero decide si es el mismo movimiento', ambiguo: l.length > 1 ? `hay ${l.length} posibles` : '' };
  return { ...puntuar(f), puedeListo: false };
}
// Lo que se puede comparar para "hay otra opción parecida": cada alternativa con su puntaje (sin ese descuento)
export function ambiguedad(valor, otros) { const m = (otros || []).filter(v => v !== null && v !== undefined && Math.abs(v - valor) <= PESOS.ambiguedad); return m.length ? 'hay otra opción parecida' : ''; }

// ═══ Abonos (B2B) ═══
// ctx = { folios (por cobrar del cliente), ritmos ({ clienteId → ritmo }), plazo(clienteId) días, rep (propuesta de repetido), conflicto, ambiguo }
const QUIEN_AB = { transferencia: ['rut', 'RUT de la transferencia recibida'], rut: ['rut', 'RUT en la glosa'], manual: ['rut', 'elegiste tú el cliente'], aprendido: ['glosa', 'glosa aprendida'], regla: ['glosa', 'la glosa calza con tu regla'],
  nombre: ['nombre', 'la glosa trae su nombre'], 'nombre-parcial': ['parcial', 'la glosa se parece a su nombre'] };
export function abono(m, p, ctx = {}) {
  if (!p || p.tipo === 'sinCliente') return null;
  if (p.accion === 'noB2B' || p.accion === 'revisado') {
    const r = ctx.regla, f = { quien: { k: 'quien', pts: PESOS.quien.glosa, txt: 'la glosa calza con tu regla' },
      monto: r && (r.cond.montoMin !== null || r.cond.montoMax !== null) ? { k: 'monto', pts: PESOS.monto.rango, txt: 'monto dentro del rango de la regla' } : { k: 'monto', pts: PESOS.monto.sinReferencia, txt: 'la regla no fija el monto' },
      fuente: { k: 'fuente', pts: p.nivelRegla === 'listos' ? PESOS.fuente.reglaListos : PESOS.fuente.reglaProponer, txt: `tu regla (${p.nivelRegla === 'listos' ? 'pasa a Listos' : 'solo propone'})` },
      puedeListo: p.tipo === 'auto', tope: p.tipo === 'auto' ? '' : 'la regla solo propone', conflicto: ctx.conflicto || '', repetidoDebil: ctx.rep ? 'puede ser un repetido de otra cartola' : '' };
    return { ...puntuar(f), puedeListo: f.puedeListo };
  }
  const q = QUIEN_AB[p.por], quien = q ? { k: 'quien', pts: PESOS.quien[q[0]], txt: q[1] } : { k: 'quien', pts: 0, txt: 'nada dice quién pagó', malo: true };
  const as = (p.asignaciones || []).filter(a => n(a.monto) > 0), suma = as.reduce((t, a) => t + n(a.monto), 0);
  let monto, fuente;
  if (as.length && Math.abs(suma - m.monto) <= 1) {
    monto = as.length > 1 || as.some(a => (a.ordenes || []).length) ? { k: 'monto', pts: PESOS.monto.combinacion, txt: as.length > 1 ? `${as.length} folios suman exacto` : 'las órdenes suman exacto' } : { k: 'monto', pts: PESOS.monto.exacto, txt: 'monto exacto' };
    fuente = { k: 'fuente', pts: p.confianza === 'probable' ? PESOS.fuente.monto : PESOS.fuente.folio, txt: p.confianza === 'probable' ? 'solo calza el monto' : 'folio por cobrar del cliente' };
  } else if (as.length) {
    monto = { k: 'monto', pts: PESOS.monto.lejos, txt: `sobran ${pesos(m.monto - suma)}`, malo: true };
    fuente = { k: 'fuente', pts: PESOS.fuente.cliente, txt: 'cliente reconocido' };
  } else {
    monto = { k: 'monto', pts: PESOS.monto.lejos, txt: 'no calza con ningún folio', malo: true };
    fuente = { k: 'fuente', pts: PESOS.fuente.cliente, txt: 'cliente reconocido, sin folio que calce' };
  }
  if (p.por === 'regla') fuente = { k: 'fuente', pts: Math.max(fuente.pts, p.soloProponer ? PESOS.fuente.reglaProponer : PESOS.fuente.folio), txt: as.length && Math.abs(suma - m.monto) <= 1 ? 'folio por cobrar del cliente de tu regla' : 'tu regla dice el cliente' };
  // La fecha: la factura más antigua de lo asignado contra lo normal del cliente; sin historia, la ventana de su plazo
  let fecha = null;
  const fs = (ctx.folios || []).filter(f => as.some(a => s(a.folio) === s(f.folio)) && f.fecha).map(f => f.fecha).sort();
  if (fs.length && m.fecha) {
    const rr = ctx.ritmos && p.clienteId ? ctx.ritmos[p.clienteId] : null, plazo = ctx.plazo ? n(ctx.plazo(p.clienteId)) : 0, d = diasEntre(fs[0], m.fecha);
    fecha = factorFecha(fs[0], m.fecha, rr, d !== null && d >= -1 && d <= plazo + 7);
  }
  const puedeListo = p.tipo === 'auto';
  const tope = puedeListo ? '' : p.soloProponer ? 'la regla solo propone' : p.confianza === 'probable' ? 'nada dice quién pagó: confírmalo tú' : p.yaPagado ? 'hay un pago igual ya registrado' : as.length ? 'hay dudas en cómo calza' : 'elige el folio';
  const f = { quien, monto, fecha, fuente, puedeListo, tope, conflicto: ctx.conflicto || '', ambiguo: ctx.ambiguo || ((p.candidatos || []).length ? `hay ${p.candidatos.length} ${p.candidatos.length === 1 ? 'otra coincidencia exacta' : 'otras coincidencias exactas'}` : ''),
    repetidoDebil: ctx.rep ? 'puede ser un repetido de otra cartola' : p.yaPagado ? `el folio ${p.yaPagado.folio} ya se registró pagado` : '' };
  return { ...puntuar(f), puedeListo };
}
