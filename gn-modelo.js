// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo (desde cero), reglas puras  v0.90.0 · Etapa 1: base y carga
//  Propuesta "Gastos desde cero" (23 oct 2026): todo gasto es un DOCUMENTO y todo pago es un MOVIMIENTO; la Bandeja los une.
//  Aquí: cómo nace cada documento (del SII) y cada movimiento (cartola BancoEstado, Mercado Pago), su id fijo (el freno de
//  repetidos) y el plan de cada carga. Sin red ni Firebase: lo prueba pruebas/sistemafen/gn-etapa1-v0900.test.js.
//  · Documento: id = d_<RUT sin puntos>_<tipo>_<folio>. Subir el mismo archivo dos veces no crea nada nuevo.
//    Antes del inicio (v0.90.3: hasta un año antes, no solo el mes anterior) queda como "deuda anterior" (anterior: true, no se muestra en la Bandeja hasta que
//    un pago lo pida); lo más antiguo no entra. Las guías de despacho no entran (sii.leer ya las deja fuera).
//  · Movimiento: solo lo que SALE (cargos). Id fijo por la línea exacta (cuenta, fecha, monto, saldo, glosa, N° de operación);
//    en Mercado Pago, por su N° de operación. Antes del inicio: no entra.
//    "Parece el mismo": la misma salida que ya llegó en OTRA carga (otra cartola del mismo período: histórica y en línea),
//    misma cuenta, mismo monto, ±1 día y (mismo N° de operación o glosa igual / contenida) → no se guarda otra vez.
//    Dentro del mismo archivo nunca se descarta nada: dos compras iguales el mismo día son dos movimientos.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v).trim();
export const VERSION = '0.90.0';
export const COL = { docs: 'gn_documentos', movs: 'gn_movimientos', cargas: 'gn_cargas', pagos: 'gn_pagos', provs: 'gn_proveedores', config: 'gn_config', repartos: 'gn_repartos' };   // v0.91.0: pagos, proveedores y config
export const CUENTAS = { cc: 'BancoEstado cta. cte.', chequera: 'BancoEstado chequera', mp: 'Mercado Pago', tc: 'Tarjeta de crédito' };
export const TIPOS_DOC = { '33': 'Factura', '34': 'Factura exenta', '39': 'Boleta', '41': 'Boleta exenta', '46': 'Factura de compra', '56': 'Nota de débito', '61': 'Nota de crédito' };

// ── Fechas ──
export const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
export function aIso(f) {
  const t = s(f); if (esIso(t)) return t;
  let m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(t); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(t); return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
export const mesDe = f => (esIso(f) ? f.slice(0, 7) : '');
export function mesAnterior(mes) { const [y, m] = mes.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
const diasEntre = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
// Lo que cuenta desde el inicio, y desde cuándo entra la deuda anterior. v0.90.3: hasta un año antes del inicio (antes, solo el mes anterior:
// el Registro de Compras de septiembre traía facturas de agosto que se pagan después y quedaban fuera)
export function corte(inicio) { const ini = esIso(inicio) ? inicio : '2026-10-01'; return { inicio: ini, anterior: (Number(ini.slice(0, 4)) - 1) + ini.slice(4, 8) + '01' }; }

// ── RUT ──
export const rutN = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
export function rutTexto(r) { const n = rutN(r); if (n.length < 2) return n; const c = n.slice(0, -1), dv = n.slice(-1); return c.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv; }

// ── Texto ──
export const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const corto = (v, n) => s(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const entero = v => { const x = Math.round(Number(v)); return isFinite(x) ? x : 0; };

// ═══════════════ Documentos ═══════════════
export const idDoc = (rut, tipo, folio) => `d_${rutN(rut)}_${s(tipo) || '33'}_${s(folio).replace(/[^0-9A-Za-z]/g, '').replace(/^0+(?=\d)/, '')}`;
// Un documento del SII (lo que entrega sii.leer: fecha dd-mm-aaaa, montos con signo) → documento nuevo
export function docDeSii(f, cargaId) {
  const tipo = s(f.tipoDoc) || '33', fecha = aIso(f.fecha), nc = tipo === '61';
  const det = (f.detalle || []).slice(0, 40).map(d => ({ descripcion: corto(d.descripcion, 120), cantidad: Number(d.cantidad) || 0, unidad: corto(d.unidad, 12), monto: entero(d.monto) }));
  return {
    id: idDoc(f.rut, tipo, f.folio), origen: 'sii', tipo, tipoTexto: TIPOS_DOC[tipo] || ('Documento ' + tipo), nc,
    rut: rutTexto(f.rut), rutN: rutN(f.rut), razon: corto(f.razonSocial, 120), folio: s(f.folio).replace(/^0+(?=\d)/, ''),
    fecha, mes: mesDe(fecha), neto: entero(f.neto), exento: entero(f.exento), iva: entero(f.iva), otroImp: entero(f.otroImpuesto), total: entero(f.total),
    vence: esIso(f.fechaVencISO) ? f.fechaVencISO : '', formaPago: s(f.formaPagoSII), referencias: (f.referencias || []).map(r => ({ tipo: s(r.tipo), folio: s(r.folio) })),
    detalle: det, descuadre: s(f.descuadre), cargaId: s(cargaId),
    cliente: s(f.cdgIntRecep).slice(0, 40), direccion: s(f.cdgIntRecep) ? corto([f.dirRecep, f.comunaRecep].filter(Boolean).join(', '), 100) : '',   // v0.92.4: la del servicio (solo si trae N° de cliente)
    periodo: esIso(f.periodoDesde) && esIso(f.periodoHasta) ? { desde: f.periodoDesde, hasta: f.periodoHasta } : null   // v0.92.3
  };
}
// Plan de una carga del SII: qué entra nuevo, qué ya estaba, qué es deuda anterior y qué queda fuera por antiguo
export function planDocs(facturas, existentes, inicio, cargaId) {
  const C = corte(inicio), ya = new Map((existentes || []).map(x => [x.id, x])), visto = new Set();
  const out = { nuevos: [], completar: [], yaEstaban: 0, anteriores: 0, antiguos: 0, sinFecha: 0, leidos: (facturas || []).length };
  (facturas || []).forEach(f => {
    const d = docDeSii(f, cargaId);
    if (!d.fecha) { out.sinFecha++; return; }
    if (d.fecha < C.anterior) { out.antiguos++; return; }
    if (visto.has(d.id)) { out.yaEstaban++; return; }
    const e = ya.get(d.id);
    if (e) {
      // v0.90.2 · Ya estaba sin detalle (vino del Registro de Compras) y ahora llega el XML con detalle: se completa (montos y todo lo demás no se tocan)
      // v0.92.3 · también el N° de cliente y el período, si faltaban (subir otra vez el XML se los agrega)
      const falta = { ...(!(e.detalle || []).length && d.detalle.length ? { detalle: d.detalle } : {}), ...(!e.cliente && d.cliente ? { cliente: d.cliente } : {}), ...(!e.direccion && d.direccion ? { direccion: d.direccion } : {}), ...(!e.periodo && d.periodo ? { periodo: d.periodo } : {}) };
      if (Object.keys(falta).length) {
        visto.add(d.id);
        out.completar.push({ id: d.id, ...falta, ...(e.vence ? {} : d.vence ? { vence: d.vence } : {}), ...(e.formaPago ? {} : d.formaPago ? { formaPago: d.formaPago } : {}),
          ...((e.referencias || []).length || !d.referencias.length ? {} : { referencias: d.referencias }), completadoCon: cargaId });
      } else out.yaEstaban++;
      return;
    }
    visto.add(d.id);
    if (d.fecha < C.inicio) { d.anterior = true; out.anteriores++; }
    out.nuevos.push(d);
  });
  return out;
}

// ═══════════════ Movimientos ═══════════════
export const huellaMov = m => ['M', m.cuenta, s(m.cuentaN), m.fecha, entero(m.monto), entero(m.saldo), norm(m.glosa), s(m.operacion)].join('|');
// Id corto y fijo a partir de la huella (FNV-1a de 64 bits en dos mitades: sin crypto, igual en el navegador y en las pruebas)
export function hash(t) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; h2 = (h2 ^ (h2 >>> 13)) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
export function idMov(m) {
  if (m.cuenta === 'mp' && s(m.operacion)) return `m_mp_${m.tipoMp === 'retiro' ? 'r' : 'p'}_${s(m.operacion).replace(/\D/g, '')}`;
  return 'm_' + hash(huellaMov(m));
}
const ultimos4 = n => s(n).replace(/\D/g, '').slice(-4);
// La cartola de BancoEstado (lo que entrega B2b.leerCartola) → movimientos (solo los cargos)
export function movsDeCartola(c, cargaId) {
  const cuenta = c && c.cuenta && c.cuenta.tipo === 'cc' ? 'cc' : 'chequera', cuentaN = ultimos4(c && c.cuenta && c.cuenta.numero);
  return ((c && c.filas) || []).filter(f => entero(f.cargos) > 0 && esIso(f.fecha)).map(f => {
    const m = { cuenta, cuentaN, fecha: f.fecha, hora: '', glosa: corto(f.descripcion, 160), monto: entero(f.cargos), saldo: entero(f.saldo), operacion: s(f.operacion), naturaleza: '', cargaId: s(cargaId) };
    return { ...m, id: idMov(m), huella: huellaMov(m) };
  });
}
// El reporte de liberaciones de Mercado Pago (lo que entrega mercadopago.leer) → movimientos. El retiro al banco es un traspaso.
export function movsDeMP(L, cargaId) {
  return ((L && L.cargos) || []).filter(x => entero(x.monto) > 0 && esIso(x.fecha)).map(x => {
    const m = { cuenta: 'mp', cuentaN: '', fecha: x.fecha, hora: s(x.hora), glosa: corto(x.descripcion, 160), monto: entero(x.monto), saldo: entero(x.saldo), operacion: s(x.operacion),
      tipoMp: x.tipo === 'retiro' ? 'retiro' : 'pago', naturaleza: x.tipo === 'retiro' ? 'traspaso' : '', mercadoLibre: !!x.ml, cargaId: s(cargaId) };
    return { ...m, id: idMov(m), huella: huellaMov(m) };
  });
}
// ¿Es la misma salida que ya llegó en otra carga? (otra cartola del mismo período)
export function mismaSalida(a, b) {
  if (a.cuenta !== b.cuenta || entero(a.monto) !== entero(b.monto) || !esIso(a.fecha) || !esIso(b.fecha) || Math.abs(diasEntre(a.fecha, b.fecha)) > 1) return false;
  if (s(a.operacion) && s(b.operacion)) return s(a.operacion) === s(b.operacion);
  const ga = norm(a.glosa), gb = norm(b.glosa);
  if (!ga || !gb) return false;
  return ga === gb || (Math.min(ga.length, gb.length) >= 6 && (ga.includes(gb) || gb.includes(ga)));
}
// Plan de una carga de movimientos
export function planMovs(movs, existentes, inicio) {
  const C = corte(inicio), porId = new Map((existentes || []).map(x => [x.id, x])), visto = new Set(), tomados = new Set();
  const out = { nuevos: [], yaEstaban: 0, parecidos: [], antes: 0, leidos: (movs || []).length };
  (movs || []).forEach(m => {
    if (m.fecha < C.inicio) { out.antes++; return; }
    if (porId.has(m.id) || visto.has(m.id)) { out.yaEstaban++; return; }
    const otro = (existentes || []).find(e => !tomados.has(e.id) && e.cargaId !== m.cargaId && mismaSalida(e, m));
    if (otro) { tomados.add(otro.id); out.parecidos.push({ fecha: m.fecha, monto: m.monto, glosa: m.glosa, cuenta: m.cuenta, de: otro.id }); return; }
    visto.add(m.id); out.nuevos.push(m);
  });
  return out;
}

// ═══════════════ Cargas ═══════════════
export const idCarga = (tipo, ms = Date.now()) => `c_${tipo}_${ms.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
export function textoCarga(k) {
  const n = (x, s1, p1) => `${x} ${x === 1 ? s1 : p1}`;
  if (k.tipo === 'sii') return [`${n(k.nuevos - (k.anteriores || 0), 'documento nuevo', 'documentos nuevos')}`, k.yaEstaban ? `${k.yaEstaban} ya estaban` : '', k.completados ? `${k.completados} ya estaban sin detalle y se completaron` : '', k.anteriores ? `${k.anteriores} anteriores al inicio (deuda anterior)` : '',
    k.antiguos ? `${k.antiguos} de hace más de un año (no entran)` : '', k.guias ? n(k.guias, 'guía de despacho fuera', 'guías de despacho fuera') : ''].filter(Boolean).join(' · ');
  return [`${n(k.nuevos, 'movimiento nuevo', 'movimientos nuevos')}`, k.yaEstaban ? `${k.yaEstaban} ya estaban` : '', k.parecidos ? `${n(k.parecidos, 'ya llegó en otra cartola', 'ya llegaron en otra cartola')}` : '',
    k.antes ? `${k.antes} antes del inicio (no entran)` : '', k.traspasos ? n(k.traspasos, 'traspaso al banco', 'traspasos al banco') : ''].filter(Boolean).join(' · ');
}

// ═══════════════ La Bandeja (Etapa 1: los dos lados, sin unir todavía) ═══════════════
// Cobertura: por cuenta, el primer y el último día con movimientos y la última carga
export function cobertura(movs, cargas) {
  const out = {};
  (movs || []).forEach(m => { const c = out[m.cuenta] || (out[m.cuenta] = { cuenta: m.cuenta, nombre: CUENTAS[m.cuenta] || m.cuenta, desde: m.fecha, hasta: m.fecha, n: 0 }); c.n++; if (m.fecha < c.desde) c.desde = m.fecha; if (m.fecha > c.hasta) c.hasta = m.fecha; });
  (cargas || []).forEach(k => { if (k.tipo === 'sii') return; (k.cuentas || []).forEach(cu => { const c = out[cu]; if (c && (!c.ultimaCarga || s(k.en) > c.ultimaCarga)) c.ultimaCarga = s(k.en); }); });
  return ['cc', 'chequera', 'mp', 'tc'].filter(k => out[k]).map(k => out[k]);
}
export function bandeja(docs, movs, { cuenta = '' } = {}) {
  const vivos = l => (l || []).filter(x => x.estado !== 'no_va');
  const izq = vivos(docs).filter(d => !d.anterior).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.razon.localeCompare(b.razon));
  const der = vivos(movs).filter(m => !cuenta || m.cuenta === cuenta).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || ''));
  const anteriores = vivos(docs).filter(d => d.anterior);
  return { docs: izq, movs: der.filter(m => m.naturaleza !== 'traspaso'), traspasos: der.filter(m => m.naturaleza === 'traspaso'), anteriores,
    totalDocs: izq.reduce((a, d) => a + d.total, 0), totalMovs: der.filter(m => m.naturaleza !== 'traspaso').reduce((a, m) => a + m.monto, 0) };
}
