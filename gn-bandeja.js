// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo, la Bandeja que une  v0.91.0 · Etapa 2 (reglas puras, sin red)
//  Un PAGO une un documento con un movimiento (o con efectivo / plata del dueño). Es lo único que se crea al confirmar.
//  El estado de un documento (sin pago, a medias, pagado) y lo libre de un movimiento se CALCULAN de sus pagos: nunca se guardan.
//  · Una sola ventana de fechas (G5): el pago va de 20 días antes a 60 días después del documento. Fuera de eso se une igual, a mano.
//  · Pares sugeridos: mismo monto en la ventana; gana el que tiene el RUT o el nombre del proveedor en la glosa y la fecha más cercana.
//    También varios documentos del mismo proveedor (facturas y notas de crédito) que suman justo un movimiento.
//  · Una sola puerta "¿Cómo se pagó?" (G6), un solo "Esto no va" con tres motivos (G7), y lo que no es gasto en el movimiento.
//  · Clasificación: ítem y reparto por área. El proveedor la recuerda (gn_proveedores); el Gastos anterior solo sugiere.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v).trim();
const entero = v => { const x = Math.round(Number(v)); return isFinite(x) ? x : 0; };
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const rutN = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);

export const VENTANA = { antes: 20, despues: 60 };
// Diferencia que se acepta entre un documento y su pago (redondeos del IVA): hasta $5. El documento queda pagado y el movimiento usado.
export const TOLERANCIA = 5;
export const enVentana = (docFecha, movFecha) => { const d = dias(docFecha, movFecha); return d >= -VENTANA.antes && d <= VENTANA.despues; };
export const MOTIVOS_NO_VA = { repetido: 'Repetido', no_empresa: 'No es de la empresa', no_compra: 'No es una compra' };
export const NO_GASTO = { traspaso: 'Traspaso entre cuentas propias', retiro: 'Retiro del dueño', tarjeta: 'Pago de la tarjeta de crédito', otro: 'Otro (no es gasto)' };
export const MEDIOS = { cargo: 'Con un cargo', efectivo: 'En efectivo', personal: 'Con plata del dueño' };

// ── Estados (de los pagos vigentes) ──
const vivos = p => (p || []).filter(x => x.estado !== 'deshecho');
export function indicePagos(pagos) {
  const porDoc = {}, porMov = {};
  vivos(pagos).forEach(p => { (porDoc[p.docId] = porDoc[p.docId] || []).push(p); if (p.movId) (porMov[p.movId] = porMov[p.movId] || []).push(p); });
  return { porDoc, porMov };
}
export function estadoDoc(d, I) {
  if (d.estado === 'no_va') return { estado: 'no_va', pagado: 0, saldo: 0, pagos: [] };
  const ps = (I.porDoc[d.id] || []), pagado = ps.reduce((a, p) => a + entero(p.monto), 0), total = entero(d.total), saldo = total - pagado;
  const listo = total >= 0 ? saldo <= TOLERANCIA : saldo >= -TOLERANCIA;   // una nota de crédito (negativa) queda "pagada" al descontarse
  return { estado: listo ? 'pagado' : pagado ? 'a_medias' : 'sin_pago', pagado, saldo: listo ? 0 : saldo, pagos: ps };
}
export function libreMov(m, I) {
  if (m.estado === 'no_va' || m.naturaleza) return 0;
  return entero(m.monto) - (I.porMov[m.id] || []).reduce((a, p) => a + entero(p.monto), 0);
}

// ── Clasificación efectiva: la del documento, si no la del proveedor ──
export const claveProveedor = d => (rutN(d.rutN || d.rut) ? 'r_' + rutN(d.rutN || d.rut) : 'n_' + norm(d.razon).replace(/ /g, '_').slice(0, 60));
export function clasifDe(d, provs) {
  if (d.clasif && d.clasif.item) return { ...d.clasif, de: 'documento' };
  const p = provs && provs[claveProveedor(d)];
  return p && p.item ? { item: p.item, areas: p.areas || [], de: 'proveedor' } : null;
}
// Reparto válido: áreas distintas, porcentajes enteros que suman 100
export function repartoValido(areas) {
  const l = (areas || []).filter(a => s(a.area));
  if (!l.length) return 'Elija al menos un área.';
  if (new Set(l.map(a => a.area)).size !== l.length) return 'Hay un área repetida.';
  const t = l.reduce((x, a) => x + Number(a.pct || 0), 0);
  if (l.some(a => !(Number(a.pct) > 0))) return 'Cada área necesita su porcentaje.';
  return Math.abs(t - 100) > 0.5 ? `Los porcentajes suman ${t}%: deben sumar 100%.` : '';
}
export const repartoIgual = areas => { const n = areas.length; return areas.map((a, i) => ({ area: a, pct: i < n - 1 ? Math.floor(100 / n) : 100 - Math.floor(100 / n) * (n - 1) })); };
export const textoReparto = areas => (areas || []).map(a => (areas.length > 1 ? `${a.area} ${a.pct}%` : a.area)).join(' · ');

// ── Sugerencias del Gastos anterior (solo sugieren): por RUT, el ítem más usado y el reparto de su última factura ──
// gastos: filas del Gastos anterior { rutProveedor, itemGasto, area, montoFinal, fecha, estado, folio/observacion }
export function sugerenciasDeAnterior(gastos) {
  const por = {};
  (gastos || []).forEach(g => {
    const r = rutN(g.rutProveedor); if (!r || !s(g.itemGasto) || g.estado === 'anulado' || g.estado === 'ANULADO') return;
    const monto = Math.abs(Number(g.montoFinal) || 0); if (!monto) return;
    const x = por[r] || (por[r] = { items: {}, ultima: '', folios: {} });
    x.items[g.itemGasto] = (x.items[g.itemGasto] || 0) + monto;
    const folio = s(g.folio) || s((/(?:F|NC)\.?\s*(\d+)/.exec(s(g.observacion)) || [])[1]) || s(g.fecha);
    const f = x.folios[folio] || (x.folios[folio] = { fecha: s(g.fecha), areas: {} });
    if (s(g.area) && !['SELECCIONAR', 'PRORRATEADO'].includes(s(g.area))) f.areas[g.area] = (f.areas[g.area] || 0) + monto;
    if (s(g.fecha) > f.fecha) f.fecha = s(g.fecha);
  });
  const out = {};
  Object.entries(por).forEach(([r, x]) => {
    const item = Object.entries(x.items).sort((a, b) => b[1] - a[1])[0][0];
    const ult = Object.values(x.folios).filter(f => Object.keys(f.areas).length).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    let areas = [];
    if (ult) {
      const tot = Object.values(ult.areas).reduce((a, b) => a + b, 0), l = Object.entries(ult.areas).sort((a, b) => b[1] - a[1]);
      areas = l.map(([area, m]) => ({ area, pct: Math.round(m / tot * 100) }));
      const dif = 100 - areas.reduce((a, b) => a + b.pct, 0); if (areas.length) areas[0].pct += dif;
    }
    out['r_' + r] = { item, areas };
  });
  return out;
}

// ── Pares sugeridos ──
const PALABRAS_VACIAS = new Set(['SPA', 'LTDA', 'LIMITADA', 'EIRL', 'SA', 'S', 'A', 'Y', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'COMERCIAL', 'SOCIEDAD', 'EMPRESA', 'EMPRESAS', 'SERVICIOS', 'CIA', 'COMPANIA', 'INVERSIONES', 'DISTRIBUIDORA', 'CHILE']);
const palabras = t => norm(t).split(' ').filter(w => w.length >= 4 && !PALABRAS_VACIAS.has(w) && !/^\d+$/.test(w));
// Qué tan "de este proveedor" es la glosa: RUT (cuerpo) 50; una palabra del nombre 30
// v0.91.1 · Glosa aprendida (40): la seña de la glosa ya se confirmó con este proveedor y con ningún otro (S = indiceSenas)
export function afinidad(d, m, S) {
  const g = norm(m.glosa), gd = g.replace(/ /g, ''), r = rutN(d.rutN || d.rut);
  if (r.length > 2 && (gd.includes(r) || gd.includes(r.slice(0, -1)))) return 50;
  if (S) { const sn = senaDe(m.glosa), duenos = sn && S[sn]; if (duenos && duenos.length === 1 && duenos[0] === claveProveedor(d)) return 40; }
  return palabras(d.razon).some(w => g.split(' ').includes(w)) ? 30 : 0;
}
// ── v0.91.1 · Cómo aparece cada proveedor en el banco ──
// La seña de una glosa: sus palabras propias (sin números, sin palabras del banco ni comunes), hasta 3. Sin seña propia, no se aprende.
const COMUNES_BANCO = new Set(['COMPRA', 'COMPRAS', 'TEF', 'A', 'AL', 'DE', 'DEL', 'EN', 'POR', 'CON', 'PARA', 'Y', 'LA', 'EL', 'LOS', 'LAS', 'PAGO', 'PAGOS', 'CL', 'CHL', 'CHILE', 'SALDO', 'MERCADO', 'LIBRE', 'OP', 'TRANSFERENCIA', 'TRANSF', 'TRASPASO',
  'CARGO', 'CARGOS', 'DEBITO', 'CREDITO', 'REDCOMPRA', 'WEBPAY', 'LINEA', 'INTERNET', 'PAC', 'AUTOMATICO', 'CUENTA', 'CTA', 'CTE', 'CORRIENTE', 'CHEQUERA', 'ELECTRONICA', 'BANCO', 'ESTADO', 'BCO', 'RUT', 'NRO', 'NUM', 'NUMERO', 'SPA', 'LTDA', 'EIRL', 'SA',
  'SANTIAGO', 'CONCEPCION', 'GIRO', 'CAJERO', 'RETIRO', 'ABONO', 'COMISION', 'IVA', 'OTROS', 'VARIOS', 'PERSONA', 'TERCEROS', 'TERCERO', 'POS', 'CUOTA', 'CUOTAS']);
export function senaDe(glosa) {
  const l = norm(glosa).split(' ').filter(w => w.length >= 3 && !/\d/.test(w) && !COMUNES_BANCO.has(w)).slice(0, 3);
  const t = l.join(' ');
  return t.replace(/ /g, '').length >= 4 ? t : '';
}
// seña → proveedores que la tienen (de gn_proveedores.glosas)
export function indiceSenas(provs) {
  const S = {};
  Object.entries(provs || {}).forEach(([k, p]) => (p.glosas || []).forEach(g => { if (g && g.sena) { const l = S[g.sena] || (S[g.sena] = []); if (!l.includes(k)) l.push(k); } }));
  return S;
}
const subconjuntos = (l, max) => { const out = []; const ir = (i, act) => { if (act.length >= 2) out.push(act.slice()); if (act.length === max) return; for (let j = i; j < l.length; j++) { act.push(l[j]); ir(j + 1, act); act.pop(); } }; ir(0, []); return out; };
// docs: documentos con saldo (abiertos), movs: movimientos con lo libre. → [{ docIds, movId, monto, afinidad, por }]
export function sugerirPares(docs, movs, S) {
  const cand = [];
  docs.forEach(d => movs.forEach(m => {
    const dif = m.libre - d.saldo;
    if (d.saldo <= 0 || m.libre <= 0 || Math.abs(dif) > TOLERANCIA || !enVentana(d.fecha, m.fecha)) return;
    const a = afinidad(d, m, S), dd = Math.abs(dias(d.fecha, m.fecha));
    cand.push({ docIds: [d.id], movId: m.id, monto: m.libre, dif, afinidad: a, distancia: dd + Math.abs(dif) * 3, por: a >= 50 ? 'rut' : a >= 40 ? 'glosa' : a ? 'nombre' : 'monto' });
  }));
  cand.sort((a, b) => b.afinidad - a.afinidad || a.distancia - b.distancia);
  const usadoD = new Set(), usadoM = new Set(), out = [];
  const tomar = c => { if (c.docIds.some(i => usadoD.has(i)) || usadoM.has(c.movId)) return; c.docIds.forEach(i => usadoD.add(i)); usadoM.add(c.movId); out.push(c); };
  // 1) los del mismo monto con el proveedor en la glosa; 2) varios documentos del mismo proveedor; 3) los del mismo monto sin más señas
  cand.filter(c => c.afinidad > 0).forEach(tomar);
  // Varios documentos del mismo proveedor que suman justo un movimiento (facturas y sus notas de crédito)
  const porRut = {};
  docs.filter(d => !usadoD.has(d.id) && rutN(d.rutN || d.rut)).forEach(d => { (porRut[rutN(d.rutN || d.rut)] = porRut[rutN(d.rutN || d.rut)] || []).push(d); });
  movs.filter(m => !usadoM.has(m.id) && m.libre > 0).forEach(m => {
    let mejor = null;
    Object.values(porRut).forEach(l => {
      const ok = l.filter(d => !usadoD.has(d.id) && enVentana(d.fecha, m.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 8);
      if (ok.length < 2) return;
      const a = afinidad(ok[0], m, S);
      subconjuntos(ok, 4).forEach(sc => {
        if (sc.reduce((x, d) => x + d.saldo, 0) !== m.libre || !sc.some(d => d.saldo > 0)) return;
        const c = { docIds: sc.map(d => d.id), movId: m.id, monto: m.libre, afinidad: a, distancia: Math.max(...sc.map(d => Math.abs(dias(d.fecha, m.fecha)))), por: 'varios' };
        if (!mejor || c.afinidad > mejor.afinidad || (c.afinidad === mejor.afinidad && c.docIds.length < mejor.docIds.length)) mejor = c;
      });
    });
    if (mejor && mejor.afinidad > 0) tomar(mejor);
  });
  cand.filter(c => c.afinidad === 0).forEach(tomar);
  return out;
}
// Para "Es de este documento" (desde un movimiento): los abiertos, primero los del mismo monto y del proveedor de la glosa
export function candidatosDoc(m, docs, S) {
  return docs.filter(d => d.saldo > 0).map(d => ({ d, a: afinidad(d, m, S), igual: d.saldo === m.libre, dentro: enVentana(d.fecha, m.fecha) }))
    .sort((x, y) => (y.igual - x.igual) || (y.a - x.a) || (y.dentro - x.dentro) || Math.abs(dias(x.d.fecha, m.fecha)) - Math.abs(dias(y.d.fecha, m.fecha)));
}
// Para "¿Cómo se pagó? → Con un cargo" (desde un documento): los movimientos con algo libre, primero los del mismo monto en la ventana
export function candidatosMov(d, movs, S) {
  return movs.filter(m => m.libre > 0).map(m => ({ m, a: afinidad(d, m, S), igual: m.libre === d.saldo, dentro: enVentana(d.fecha, m.fecha) }))
    .sort((x, y) => (y.igual - x.igual) || (y.dentro - x.dentro) || (y.a - x.a) || Math.abs(dias(d.fecha, x.m.fecha)) - Math.abs(dias(d.fecha, y.m.fecha)));
}
// Cómo se reparte un movimiento entre documentos: en orden, a cada uno lo que le falta (lo último puede quedar a medias)
export function repartirPago(docs, monto) {
  let resto = entero(monto); const out = [];
  if (docs.length === 1 && docs[0].saldo > 0 && Math.abs(resto - docs[0].saldo) <= TOLERANCIA) return [{ docId: docs[0].id, monto: resto }];
  docs.filter(d => d.saldo < 0).forEach(d => { out.push({ docId: d.id, monto: d.saldo }); resto -= d.saldo; });   // notas de crédito: se descuentan enteras
  docs.filter(d => d.saldo > 0).forEach(d => { if (resto <= 0) return; const m = Math.min(d.saldo, resto); out.push({ docId: d.id, monto: m }); resto -= m; });
  return out;
}

// ── La Bandeja completa ──
// D: { docs, movs, pagos, provs, sugeridas, inicio }  opts: { cuenta }
export function armar(D, { cuenta = '', excluir = null } = {}) {
  const I = indicePagos(D.pagos), provs = D.provs || {}, sug = D.sugeridas || {};
  const docs = (D.docs || []).map(d => { const e = estadoDoc(d, I), c = clasifDe(d, provs); return { ...d, ...e, estadoPago: e.estado, clasifEf: c, sugerida: !c ? sug[claveProveedor(d)] || null : null }; });
  const movs = (D.movs || []).map(m => ({ ...m, libre: libreMov(m, I), pagosM: I.porMov[m.id] || [] }));
  const abiertosD = docs.filter(d => d.estadoPago === 'sin_pago' || d.estadoPago === 'a_medias');
  const abiertosM = movs.filter(m => m.libre > 0 && m.estado !== 'no_va' && !m.naturaleza);
  const S = indiceSenas(provs);
  const pares = sugerirPares(abiertosD, abiertosM, S).filter(p => !excluir || !excluir.has(p.movId + '|' + p.docIds.join(',')));   // "No es este": ese par no se vuelve a proponer (en esta sesión)
  const enPar = new Set(pares.flatMap(p => p.docIds)), movEnPar = new Set(pares.map(p => p.movId));
  const visible = d => !d.anterior;
  const porClasificar = docs.filter(d => visible(d) && d.estado !== 'no_va' && !d.clasifEf && entero(d.total) !== 0);
  const sinPago = abiertosD.filter(d => visible(d) && !enPar.has(d.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sinDoc = abiertosM.filter(m => !movEnPar.has(m.id) && (!cuenta || m.cuenta === cuenta)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const listosD = docs.filter(d => (visible(d) || d.pagos.length || d.estado === 'no_va') && (d.estadoPago === 'pagado' || d.estado === 'no_va')).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const noGasto = movs.filter(m => m.naturaleza || m.estado === 'no_va').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const paresV = pares.filter(p => !cuenta || (movs.find(m => m.id === p.movId) || {}).cuenta === cuenta);
  return { docs, movs, I, S, pares: paresV, porClasificar, sinPago, sinDoc, listosD, noGasto, abiertosD, abiertosM,
    anteriores: docs.filter(d => d.anterior && d.estadoPago !== 'pagado' && d.estado !== 'no_va'),
    n: { pares: paresV.length, clasificar: porClasificar.length, sinPago: sinPago.length, sinDoc: sinDoc.length, total: paresV.length + porClasificar.length + sinPago.length + sinDoc.length } };
}
