// ═══════════════════════════════════════════════
//  Sistema Fën — Mercado Pago: leer el "reporte de liberaciones" (reserve-release, CSV)  v0.81.0
//  Reglas puras, sin red. Mercado Pago es una cuenta de la empresa: ahí caen las ventas con tarjeta (Point) de la caja y desde
//  ahí se paga con su tarjeta de débito o su saldo. Del reporte salen:
//   · los PAGOS hechos con el saldo (DESCRIPTION "payment" con NET_DEBIT > 0) → cargos de la cuenta "Mercado Pago" (Gastos →
//     Bandeja), como los de la cartola del banco. El reporte no dice a quién se pagó: se calzan por monto y fecha.
//   · los RETIROS al banco (DESCRIPTION "payout") → cargos que se marcan solos "Traspaso entre cuentas propias".
//   · las VENTAS con tarjeta (SUB_UNIT "Point", NET_CREDIT > 0) → un resumen por día (venta, comisión real y neto, por tipo de
//     tarjeta): la comisión cambia según las metas de venta, así que se toma la real de cada venta.
//   Los "reserve_for_payment" / "reserve_for_payout" van y vuelven (se anulan entre sí): no se cuentan.
//  El reporte de liquidaciones (settlement) no sirve para esto: no trae los retiros ni el saldo. Se avisa.
// ═══════════════════════════════════════════════
const s = v => String(v ?? '').trim();
const num = v => { const x = Number(s(v).replace(/[^0-9.-]/g, '')); return isFinite(x) ? x : 0; };
const fechaDe = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(v)); return m ? m[0] : ''; };
const horaDe = v => { const m = /T(\d{2}:\d{2})/.exec(s(v)); return m ? m[1] : ''; };

// El N° de operación en grupos de 4 ("1768-5379-0018"): así la glosa de cada pago es única y "lo aprendido" de uno no se aplica a otro
const opLegible = id => s(id).replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1-');
export const CUENTA = 'mp';
export const NOMBRE = 'Mercado Pago';
export const NOTA_RETIRO = 'Retiro de Mercado Pago a la cuenta del banco';
export const TIPOS_TARJETA = { debit_card: 'Débito', credit_card: 'Crédito', prepaid_card: 'Prepago' };

// Una línea CSV con comillas ("a;b" queda junto)
function partir(linea, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) { if (ch === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
export function filasCsv(texto) {
  const t = s(texto).replace(/^﻿/, ''), lineas = t.split(/\r?\n/).filter(x => x.trim());
  if (!lineas.length) return [];
  const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
  return lineas.map(l => partir(l, sep).map(x => x.trim()));
}
const COLS_LIB = ['DATE', 'SOURCE_ID', 'DESCRIPTION', 'NET_CREDIT_AMOUNT', 'NET_DEBIT_AMOUNT', 'BALANCE_AMOUNT'];
const COLS_SET = ['SOURCE_ID', 'TRANSACTION_TYPE', 'TRANSACTION_AMOUNT', 'SETTLEMENT_DATE', 'REAL_AMOUNT'];
// → 'liberaciones' | 'liquidaciones' | ''
export function tipoReporte(texto) {
  const f = filasCsv(String(texto || '').slice(0, 4000))[0] || [], h = f.map(x => x.toUpperCase());
  if (COLS_LIB.every(c => h.includes(c))) return 'liberaciones';
  if (COLS_SET.every(c => h.includes(c))) return 'liquidaciones';
  return '';
}

// → { error } o { desde, hasta, cargos: [{ fecha, hora, descripcion, monto, saldo, operacion, tipo: 'pago'|'retiro', ml }],
//      dias: { 'AAAA-MM-DD': { fecha, n, bruto, comision, neto, porTipo: { debit_card: { n, bruto, comision } … } } },
//      resumen: { pagos: { n, monto }, retiros: { n, monto }, ventas: { n, bruto, comision, neto }, filas } }
export function leer(texto) {
  const filas = filasCsv(texto);
  if (filas.length < 2) return { error: 'El archivo está vacío.' };
  const h = filas[0].map(x => x.toUpperCase()), col = k => h.indexOf(k);
  if (!COLS_LIB.every(c => col(c) >= 0)) return { error: tipoReporte(texto) === 'liquidaciones' ? 'Ese es el reporte de liquidaciones de Mercado Pago: no trae los retiros ni el saldo. Sube el reporte de liberaciones (Reportes → Liberaciones).' : 'No es el reporte de liberaciones de Mercado Pago.' };
  const v = (r, k) => (col(k) >= 0 ? s(r[col(k)]) : '');
  const cargos = [], dias = {}, R = { pagos: { n: 0, monto: 0 }, retiros: { n: 0, monto: 0 }, ventas: { n: 0, bruto: 0, comision: 0, neto: 0 }, filas: filas.length - 1 };
  let desde = '', hasta = '';
  const vistos = new Set();
  filas.slice(1).forEach(r => {
    const fecha = fechaDe(v(r, 'DATE')); if (!fecha) return;
    if (!desde || fecha < desde) desde = fecha; if (!hasta || fecha > hasta) hasta = fecha;
    const desc = v(r, 'DESCRIPTION').toLowerCase(), id = v(r, 'SOURCE_ID'), deb = Math.round(num(v(r, 'NET_DEBIT_AMOUNT'))), cred = Math.round(num(v(r, 'NET_CREDIT_AMOUNT')));
    const saldo = Math.round(num(v(r, 'BALANCE_AMOUNT'))), unidad = v(r, 'BUSINESS_UNIT'), sub = v(r, 'SUB_UNIT'), tipoT = v(r, 'PAYMENT_METHOD_TYPE');
    if (desc === 'payment' && deb > 0) {
      const k = 'p|' + id + '|' + deb; if (vistos.has(k)) return; vistos.add(k);
      const ml = /mercado libre/i.test(unidad);
      cargos.push({ fecha, hora: horaDe(v(r, 'DATE')), descripcion: `${ml ? 'COMPRA MERCADO LIBRE' : 'PAGO CON SALDO MERCADO PAGO'} OP ${opLegible(id)}`, monto: deb, saldo, operacion: id, tipo: 'pago', ml });
      R.pagos.n++; R.pagos.monto += deb;
    } else if (desc === 'payout' && deb > 0) {
      const k = 'r|' + id + '|' + deb; if (vistos.has(k)) return; vistos.add(k);
      cargos.push({ fecha, hora: horaDe(v(r, 'DATE')), descripcion: `RETIRO MERCADO PAGO A CUENTA BANCARIA OP ${id}`, monto: deb, saldo, operacion: id, tipo: 'retiro', ml: false });
      R.retiros.n++; R.retiros.monto += deb;
    } else if (desc === 'payment' && cred > 0 && /point/i.test(sub)) {
      const bruto = Math.round(num(v(r, 'GROSS_AMOUNT'))) || cred, com = -Math.round(num(v(r, 'MP_FEE_AMOUNT')));
      const d = dias[fecha] || (dias[fecha] = { fecha, n: 0, bruto: 0, comision: 0, neto: 0, porTipo: {} });
      const t = TIPOS_TARJETA[tipoT] ? tipoT : 'otro', pt = d.porTipo[t] || (d.porTipo[t] = { n: 0, bruto: 0, comision: 0 });
      d.n++; d.bruto += bruto; d.comision += com; d.neto += cred; pt.n++; pt.bruto += bruto; pt.comision += com;
      R.ventas.n++; R.ventas.bruto += bruto; R.ventas.comision += com; R.ventas.neto += cred;
    }
  });
  cargos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
  if (!cargos.length && !R.ventas.n) return { error: 'El reporte no trae pagos, retiros ni ventas.' };
  return { desde, hasta, cargos, dias, resumen: R };
}
// La "cartola" para Gastos (la misma forma que la de BancoEstado: Cartola.cargar)
export function cartolaDe(L) {
  return { identificador: `Mercado Pago · liberaciones ${L.desde} al ${L.hasta}`, tipo: 'mercadopago', cuenta: { tipo: CUENTA, numero: '' }, nCartola: '', desde: L.desde, hasta: L.hasta,
    filas: L.cargos.map(c => ({ fecha: c.fecha, descripcion: c.descripcion, cargos: c.monto, abonos: 0, saldo: c.saldo, operacion: c.operacion })) };
}
// % efectivo de la comisión (comisión ÷ venta), con 2 decimales
export const pctComision = d => (d && d.bruto > 0 ? Math.round(d.comision / d.bruto * 10000) / 100 : 0);
// Resumen por mes de los días (para mostrar)
export function porMes(dias) {
  const m = {};
  Object.values(dias || {}).forEach(d => { const k = d.fecha.slice(0, 7), x = m[k] || (m[k] = { mes: k, n: 0, bruto: 0, comision: 0, neto: 0 }); x.n += d.n; x.bruto += d.bruto; x.comision += d.comision; x.neto += d.neto; });
  return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).map(x => ({ ...x, pct: pctComision(x) }));
}
