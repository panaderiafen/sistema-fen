// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo → Finanzas (Etapa 4, el puente)  v0.101.1 · reglas puras, sin red
//  Finanzas sigue trabajando con "gastos" de una línea (ítem, área, neto, fecha). Aquí cada parte de cada documento clasificado del
//  Gastos nuevo se entrega en esa forma: el estado de resultados, la cuadratura y los cierres no cambian.
//  v0.101.1 · Desde cero en octubre (Emmanuel, 25 oct): Finanzas parte en el mes del inicio y solo cuenta el Gastos nuevo. Lo de antes del
//  inicio no entra al resultado (la deuda anterior queda solo para pagarla; de un pago que cubre varios meses, solo cuentan los meses desde
//  el inicio). El Gastos anterior no se lee para el resultado (solo las inversiones ya registradas, para su depreciación).
//  · El mes de cada documento es su "mes" (el de la factura; el del período en boletas, Previred, F29 y liquidaciones).
//  · Un documento que se reparte en 6 o 12 meses (patentes, permisos) entrega una línea por mes (el último absorbe el redondeo).
//  · Sin clasificar o "Esto no va": no entrega líneas (el cierre avisa lo sin clasificar).
//  · Las notas de crédito vienen en negativo desde el SII: sus partes restan solas.
// ═══════════════════════════════════════════════
import * as GB from './gn-bandeja.js?v=0.101.1';

const s = v => String(v == null ? '' : v).trim();
const entero = v => { const x = Math.round(Number(v)); return isFinite(x) ? x : 0; };
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
const sigMes = m => { const [y, n] = m.split('-').map(Number); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`; };
const ultimoDia = m => { const [y, n] = m.split('-').map(Number); return `${m}-${String(new Date(Date.UTC(y, n, 0)).getUTCDate()).padStart(2, '0')}`; };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesCorto = m => (/^\d{4}-\d{2}$/.test(s(m)) ? `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : s(m));
export const TOL = 5;
const hashCorto = t => { let h = 5381; for (const c of s(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };

// ── Los meses en que cuenta un documento: el suyo, o 6 / 12 desde el inicio de su período ──
export function mesesDoc(d) {
  const n = Number(d.prorratear) || 0, m0 = s(d.mes) || s(d.fecha).slice(0, 7);
  if (!(n > 1)) return [m0];
  let m = (d.periodo && esIso(d.periodo.desde) ? d.periodo.desde.slice(0, 7) : m0); const out = [];
  for (let i = 0; i < n; i++) { out.push(m); m = sigMes(m); }
  return out;
}
const repartirEn = (monto, n) => { const b = Math.trunc(monto / n), out = Array(n).fill(b); out[n - 1] = monto - b * (n - 1); return out; };

// ── Las líneas de un documento para Finanzas (solo los meses desde el inicio) ──
// → [{ id, fecha, itemGasto, area, montoNeto, razonSocial, observacion, estado, origenGN, docId, mesOriginal }]
// El id no depende del orden de las partes (ítem y área): reclasificar no cambia la llave de lo que sigue igual.
export function lineasDoc(d, provs, reps, { inicio } = {}) {
  if (!d || d.estado === 'no_va') return [];
  const mesIni = s(inicio).slice(0, 7), meses = mesesDoc(d), n = meses.length;
  if (meses[n - 1] < mesIni) return [];   // todo es de antes del inicio
  const c = GB.clasifDe(d, provs, reps); if (!c || !(c.partes || []).length) return [];
  const ref = `${s(d.tipoTexto)}${d.folio && d.origen !== 'credito' ? ' N° ' + s(d.folio) : ''}`;
  const out = [], vistos = {};
  c.partes.forEach(p => {
    const montos = repartirEn(entero(p.monto), n);
    const k0 = hashCorto(norm(p.item) + '|' + s(p.area).toUpperCase()), k = vistos[k0] ? `${k0}${vistos[k0]}` : k0; vistos[k0] = (vistos[k0] || 0) + 1;
    meses.forEach((m, i) => {
      if (!montos[i] || m < mesIni) return;
      const fecha = s(d.fecha).slice(0, 7) === m ? s(d.fecha) : ultimoDia(m);
      const obs = [ref, n > 1 ? `${i + 1}/${n} (${mesCorto(meses[0])} a ${mesCorto(meses[n - 1])})` : ''].filter(Boolean).join(' · ');
      out.push({ id: `gn_${d.id}_${k}${n > 1 ? '_' + m.replace('-', '') : ''}`, fecha, itemGasto: s(p.item), area: s(p.area).toUpperCase(), montoNeto: montos[i], razonSocial: s(d.razon), observacion: obs,
        estado: 'vigente', origenGN: s(d.origen) || 'sii', docId: s(d.id), mesOriginal: m });
    });
  });
  return out;
}

// ── Todo para Finanzas: las líneas del Gastos nuevo desde el inicio ──
// D: { docs, provs, repartos }. → { lineas, errores [docId] } (un documento raro se salta y se avisa: no deja a Finanzas sin nada)
export function gastosParaFinanzas(D, inicio) {
  const lineas = [], errores = [];
  ((D && D.docs) || []).forEach(d => { try { lineas.push(...lineasDoc(d, D.provs || {}, D.repartos || {}, { inicio })); } catch (e) { errores.push(d && d.id); } });
  return { lineas, errores };
}

// ── Lo del Gastos nuevo que todavía no tiene clasificación, por mes (para el cierre) ──
export function sinClasificarDelMes(D, mes) {
  const l = ((D && D.docs) || []).filter(d => d.estado !== 'no_va' && mesesDoc(d).includes(mes) && !GB.clasifDe(d, D.provs || {}, D.repartos || {}));   // también la parte del mes de un pago de varios meses
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
