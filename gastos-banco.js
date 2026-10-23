// ═══════════════════════════════════════════════
//  Sistema Fën — Lo que se paga por banco llega con la cartola  v0.63.1 (reglas puras, sin red)
//  La forma de trabajar acordada (13-oct): todo lo que se paga por banco se REGISTRA desde la cartola; a mano solo el
//  efectivo. Los vencimientos dicen qué hay que PAGAR; la cartola lo registra. Si se paga y registra a mano igual,
//  la cartola solo lo confirma (lo vincula con "Ya está en Gastos").
//  · sePagaPor de cada obligación: banco (cartola) | efectivo | tarjeta. Sin el campo (las de antes) = banco.
//    propuestaSePagaPor: desde el historial (pagos con la cartola → banco; gastos en efectivo → efectivo; tarjeta → tarjeta).
//  · esperanCartola: vencimientos de banco atrasados (más de 2 días) sin cargo y gastos que esperan su cargo (esperaCargo,
//    más de 5 días): para Hoy.
//  · candidatosGastos / rankear: los gastos que pueden ser "Ya está en Gastos" para un cargo (con su origen), ordenados por
//    monto exacto, monto más parecido y fecha más cercana.
//  · resolverOrigen: de dónde salió un gasto (registro a mano, pago de un vencimiento, carga del SII, Previred, planilla
//    antigua, cartola), con lo que haya en sus campos (origen, origenDetalle, siiDoc, vencimientoId, previred, hoja/fila,
//    creado…). Lo nuevo guarda "origenDetalle" al crearse; lo de antes se reconoce igual.
//  Fechas aaaa-mm-dd (hora de Chile).
// ═══════════════════════════════════════════════

export const SE_PAGA = ['banco', 'efectivo', 'tarjeta'];
export const NOMBRE_SE_PAGA = { banco: 'Banco (cartola)', efectivo: 'Efectivo', tarjeta: 'Tarjeta de crédito' };
// Días de gracia antes de avisar "Esperan cartola"
export const GRACIA = { vencimiento: 2, gasto: 5 };
// Ventanas (días desde la fecha del gasto hasta la del cargo) para "Ya está en Gastos", por origen
export const VENTANAS = { sii: [-5, 60], espera: [-3, 30], vencimiento: [-3, 30], contado: [-3, 45], efectivo: [-3, 45] };

const s = v => String(v == null ? '' : v);
const n = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const x = Number(s(v).replace(/,\d{1,2}$/, '').replace(/[^0-9-]/g, '')); return isFinite(x) ? x : 0; };
const dia = v => { const t = s(v).trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const utc = f => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
// Días de a hasta b (b − a)
export const diasEntre = (a, b) => (dia(a) && dia(b) ? Math.round((utc(dia(b)) - utc(dia(a))) / 864e5) : NaN);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = f => (dia(f) ? `${MESES[Number(dia(f).slice(5, 7)) - 1]} ${dia(f).slice(0, 4)}` : '');
const dma = f => (dia(f) ? dia(f).split('-').reverse().join('-') : s(f));
const fmt = m => '$' + Math.round(m).toLocaleString('es-CL');
const ligado = d => !!(s(d && d.cartolaCargo) || /\[cc[0-9a-f]{10}\]/.test(s(d && d.cartola)));
const estadoV = d => { const e = s(d && d.estado); return { PENDIENTE: 'por_pagar', VENCIDA: 'por_pagar', PAGADO: 'pagado', ANULADO: 'anulado' }[e] || e; };

// ── Se paga por ──
export const sePagaPorOk = v => (SE_PAGA.includes(s(v)) ? s(v) : '');
export const sePagaPor = o => sePagaPorOk(o && o.sePagaPor) || 'banco';
// Mapa id de obligación → cómo se paga (las sin campo = banco)
export function mapaSePaga(plantillas) {
  const m = {}; (plantillas || []).forEach(x => { const d = x && (x.d || x); if (!d) return; m[s(d.id) || s(x.id)] = sePagaPor(d); });
  return m;
}
// Cómo se paga un vencimiento: el de su obligación; sin obligación (compra a crédito, factura del SII, suelto): '' (se paga con Pagar)
export const sePagaVenc = (v, mapa) => { const pid = s(v && (v.plantillaId || v.plantillaID)); return pid ? (mapa && mapa[pid]) || 'banco' : ''; };

// Propuesta para Clasificar obligaciones, desde los últimos pagos de esa obligación:
// vencimientos pagados con un cargo de la cartola → banco; sus gastos en efectivo → efectivo; con tarjeta → tarjeta. Sin historial: banco.
// vencs, gastos: [{ id, d }]
export function propuestaSePagaPor(pid, vencs, gastos) {
  const pagados = (vencs || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.plantillaID) === s(pid) && estadoV(x.d) === 'pagado')
    .sort((a, b) => s(dia(b.d.fechaPago)).localeCompare(s(dia(a.d.fechaPago)))).slice(0, 6);
  const ids = new Set(pagados.map(x => x.id).concat(pagados.map(x => s(x.d.id)).filter(Boolean)));
  const porVenc = {}; (gastos || []).forEach(x => { const v = s(x.d && x.d.vencimientoId); if (v && ids.has(v) && x.d.estado !== 'anulado') (porVenc[v] = porVenc[v] || []).push(x.d); });
  const votos = { banco: 0, efectivo: 0, tarjeta: 0 };
  pagados.forEach(x => {
    const gs = porVenc[x.id] || porVenc[s(x.d.id)] || [];
    if (ligado(x.d) || gs.some(ligado)) votos.banco++;
    else if (gs.some(g => s(g.medioPago) === 'efectivo' || /^efectivo$/i.test(s(g.formaPago)))) votos.efectivo++;
    else if (gs.some(g => s(g.formaPago) === 'tarjeta' || s(g.medioPago) === 'tarjeta')) votos.tarjeta++;
  });
  const total = votos.banco + votos.efectivo + votos.tarjeta;
  if (!total) return { valor: 'banco', motivo: pagados.length ? 'sus pagos no dicen cómo se pagaron: banco, como casi todo' : 'sin pagos todavía: banco, como casi todo', votos };
  const valor = ['banco', 'efectivo', 'tarjeta'].reduce((a, k) => (votos[k] > votos[a] ? k : a), 'banco');
  const txt = { banco: 'con la cartola', efectivo: 'en efectivo', tarjeta: 'con tarjeta' }[valor];
  return { valor, motivo: `${votos[valor]} de ${pagados.length} ${pagados.length === 1 ? 'pago' : 'pagos'} ${txt}`, votos };
}

// ── Esperan cartola (para Hoy) ──
// vencs, plantillas, gastos: [{ id, d }] (gastos: los que tienen esperaCargo). Devuelve { vencimientos, gastos, total }
export function esperanCartola({ vencs, plantillas, gastos, hoy, gracia = GRACIA, inicio = '' }) {
  const mapa = mapaSePaga(plantillas);
  const vs = [];
  (vencs || []).forEach(({ id, d }) => {
    if (!d || d.quitadoEnPlanilla) return;
    const pid = s(d.plantillaID); if (!pid || mapa[pid] === undefined || mapa[pid] !== 'banco') return;
    const e = estadoV(d);
    // Por pagar (sin abonos ni boleta pendiente): la boleta que falta se avisa en otro lado
    if (e !== 'por_pagar' || (Array.isArray(d.abonos) && d.abonos.length) || ligado(d)) return;
    const f = dia(d.fechaDocumento) || dia(d.fechaVencimiento); if (!f) return;
    const atraso = diasEntre(f, hoy);
    if (!(atraso > gracia.vencimiento)) return;
    vs.push({ id, nombre: s(d.nombre), fecha: f, dias: atraso, monto: n(d.montoDocumento) || n(d.montoEstimado) });
  });
  const grupos = {}, gs = [];
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.quitadoEnPlanilla || d.estado !== 'vigente' || d.esperaCargo !== true || ligado(d)) return;
    // El pago de un vencimiento lleva la fecha del vencimiento; lo que cuenta aquí es cuándo se pagó
    const f = dia(d.fechaPago) || dia(d.fecha); if (!f || (inicio && f < inicio)) return;   // v0.82.0: lo de antes del inicio no se pide
    const k = [f, s(d.hora), s(d.observacion), s(d.urlFoto), s(d.vencimientoId)].join('|');
    let g = grupos[k];
    if (!g) { g = grupos[k] = { ids: [], fecha: f, dias: diasEntre(f, hoy), items: [], monto: 0, vencimientoId: s(d.vencimientoId), obligacion: s(d.origenDetalle && d.origenDetalle.obligacion) }; gs.push(g); }
    g.ids.push(id); g.monto += n(d.montoFinal);
    if (!g.items.includes(s(d.itemGasto))) g.items.push(s(d.itemGasto));
  });
  const gastosL = gs.filter(g => g.dias > gracia.gasto).sort((a, b) => b.dias - a.dias);
  vs.sort((a, b) => b.dias - a.dias);
  return { vencimientos: vs, gastos: gastosL, total: vs.length + gastosL.length };
}
// Una línea por cada uno (para Hoy): "Luz Barros: venció hace 5 días, sin cargo en la cartola"
export function lineasEsperan(r) {
  const dd = k => `${k} ${k === 1 ? 'día' : 'días'}`;
  return (r.vencimientos || []).map(v => `${v.nombre}: venció hace ${dd(v.dias)}${v.monto ? ' (' + fmt(v.monto) + ')' : ''}, sin cargo en la cartola`)
    .concat((r.gastos || []).map(g => `${g.obligacion ? 'Pago a mano de ' + g.obligacion : g.items.join(' + ')} ${fmt(g.monto)}: pagado hace ${dd(g.dias)} y registrado a mano, sin su cargo`));
}

// ── Candidatos para "Ya está en Gastos" ──
// Qué clase de gasto es, para la ventana y el chip: sii | espera | vencimiento | efectivo | contado. null = no es candidato
export function claseCandidato(d) {
  const forma = s(d.formaPago || 'contado'), od = d.origenDetalle || {};
  if (forma === 'tarjeta') return null;
  if (d.esperaCargo === true) return 'espera';
  if (s(d.vencimientoId)) return forma === 'contado' ? 'vencimiento' : null;
  const esSii = s(d.origen) === 'sii' || od.tipo === 'sii' || !!(d.siiDoc && d.siiDoc.id);
  if (esSii) return forma === 'contado' || (forma === 'proveedor' && !s(d.fechaPago)) ? 'sii' : null;
  if (forma !== 'contado') return null;
  if (s(d.medioPago) === 'efectivo' || od.medio === 'efectivo') return 'efectivo';
  return 'contado';
}
export const CHIP_CLASE = { sii: 'Carga del SII', espera: 'Pagado por banco a mano', vencimiento: 'Pago de vencimiento', efectivo: 'Efectivo', contado: 'Al contado' };
// Gastos de los últimos 5 meses sin cargo, agrupados por registro (una compra, una factura o un pago), con su origen.
// facturasAbiertas: Set de "folio|RAZÓN" de facturas del SII con su vencimiento por pagar (esas se pagan con "Paga vencimientos")
// v0.67.4 · opc.conNC: también las notas de crédito (gastos con monto negativo), para sumarlas con su factura. Salen como grupos
// con monto < 0 y nc = true; quien llama las separa (una nota de crédito nunca es candidata sola).
// v0.81.0 · Lo pagado sin banco no espera ningún cargo
export const SIN_BANCO = ['efectivo', 'tarjeta', 'mercadopago', 'personal'];
export function candidatosGastos(gastos, hoy, facturasAbiertas, opc = {}) {
  const corte = sumar(hoy, -150), porRegistro = {}, out = [];
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.estado !== 'vigente' || d.quitadoEnPlanilla || ligado(d)) return;
    if (d.pagoSinBanco && SIN_BANCO.includes(s(d.pagoSinBanco.medio)) && !d.pagoMixto) return;   // v0.81.0: ya se dijo cómo se pagó (no espera cargo)
    const clase = claseCandidato(d); if (!clase) return;
    // Fecha de referencia: la del pago para lo pagado (vencimientos, pagos a mano por banco); la del documento para el SII y lo demás
    const f = (clase === 'espera' || clase === 'vencimiento') ? (dia(d.fechaPago) || dia(d.fecha)) : dia(d.fecha), monto = n(d.montoFinal);
    if (!f || f < corte || !(monto > 0 || (opc.conNC && monto < 0))) return;
    const m = /^(F|NC)\.\s*(\d+)/.exec(s(d.observacion)), folio = s(d.folio) || (m ? m[2] : '') || s(d.siiDoc && d.siiDoc.folio);
    if (clase === 'sii' && s(d.formaPago) === 'proveedor' && facturasAbiertas && facturasAbiertas.has(folio + '|' + normTxt(d.razonSocial))) return;
    const k = [f, s(d.hora), s(d.observacion), s(d.urlFoto), s(d.rutProveedor), s(d.vencimientoId)].join('|');
    let x = porRegistro[k];
    if (!x) {
      const od = d.origenDetalle || {};
      x = porRegistro[k] = { fecha: f, hora: s(d.hora).slice(0, 5), items: [], monto: 0, obs: s(d.observacion), rut: rutNorm(d.rutProveedor), razon: s(d.razonSocial), folio, filas: [],
        clase, chip: chipDe(d, clase), esperaCargo: d.esperaCargo === true, vencimientoId: s(d.vencimientoId), siiDocId: s(d.siiDoc && d.siiDoc.id), formato: s(od.formato), medio: s(d.medioPago || od.medio),
        planilla: !!s(d.hoja), mano: s(d.origen) === 'mano' || od.tipo === 'mano' };   // v0.64.0: para los filtros por origen
      out.push(x);
    }
    if (x.filas.length >= 40) return;
    x.filas.push({ fila: id, id, version: Number(d.version) || 0, item: s(d.itemGasto), area: s(d.area), monto }); x.monto += monto;
    if (!x.items.includes(s(d.itemGasto))) x.items.push(s(d.itemGasto));
    if (monto < 0 || d.esNC === true || /^NC\./.test(s(d.observacion)) || s(d.siiDoc && d.siiDoc.tipo) === '61') x.esNC = true;
  });
  out.forEach(x => { x.nc = x.monto < 0; });
  return out.filter(x => x.monto !== 0).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 800);
}
const normTxt = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const rutNorm = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const sumar = (f, k) => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10); };
export const claveFactura = (folio, razon) => s(folio) + '|' + normTxt(razon);
// El chip corto del origen, para la lista de candidatos
export function chipDe(d, clase) {
  const od = d.origenDetalle || {};
  if ((clase || claseCandidato(d)) === 'sii') return od.formato === 'registro' ? 'Carga del SII · sin detalle' : od.formato ? 'Carga del SII · con detalle' : 'Carga del SII';
  if (s(d.vencimientoId) || od.tipo === 'vencimiento') return `Pago de ${s(od.obligacion) || 'vencimiento'}${d.esperaCargo === true ? ' · a mano' : ''}`;
  if (d.esperaCargo === true) return 'A mano · por banco';
  if (s(d.medioPago) === 'efectivo' || od.medio === 'efectivo') return 'A mano · efectivo';
  if (s(d.hoja)) return 'Planilla antigua';
  return 'Al contado';
}
// Los candidatos de un cargo, en orden: monto exacto primero (lo de efectivo al final; entre los exactos, el mismo RUT y lo que
// espera su cargo primero), después el monto más parecido y la fecha más cercana.
// Solo los que caen en la ventana de su clase. c = { fecha, monto, rut }
export function rankear(c, grupos, ventanas = VENTANAS) {
  return (grupos || []).filter(g => g && g.monto > 0).map(g => {
    const dist = diasEntre(g.fecha, c.fecha), v = ventanas[g.clase] || ventanas.contado;
    if (!(dist >= v[0] && dist <= v[1])) return null;
    const dif = Math.abs(g.monto - c.monto);
    return { g, dist, dif, exacto: dif <= g.filas.length, rut: !!(c.rut && g.rut && g.rut === c.rut) };
  }).filter(Boolean).sort((a, b) => (b.exacto - a.exacto) || ((a.g.clase === 'efectivo') - (b.g.clase === 'efectivo')) || (b.exacto && a.exacto ? (b.rut - a.rut) || (b.g.esperaCargo - a.g.esperaCargo) : 0)
    || a.dif - b.dif || Math.abs(a.dist) - Math.abs(b.dist));
}
// ═══ v0.65.2 · "Ya está en Gastos" por defecto: solo montos EXACTOS (±$1) dentro de su ventana de fechas ═══
// dist = días del documento (o del pago a mano) al cargo. Facturas del SII: de 5 días antes a 45 después; lo demás (a mano,
// vencimientos, lo que espera su cargo): ±10 días; la planilla antigua: ±5 días (era la que llenaba la lista de "cabezas de pescado").
export const VENTANAS_EXACTAS = { sii: [-5, 45], otros: [-10, 10], planilla: [-5, 5] };
export const ventanaExacta = g => (g && g.clase === 'sii' ? VENTANAS_EXACTAS.sii : grupoOrigen(g) === 'planilla' ? VENTANAS_EXACTAS.planilla : VENTANAS_EXACTAS.otros);
export const enVentanaExacta = (dist, g) => { const v = ventanaExacta(g); return dist >= v[0] && dist <= v[1]; };
// ¿El proveedor reconocido del cargo (por la transferencia enviada, el RUT de la glosa o la glosa aprendida) es el del gasto?
export function proveedorCalza(c, g) {
  const p = c && c.proveedor; if (!p || !g) return false;
  if (p.rut && g.rut && rutNorm(p.rut) === g.rut) return true;
  const a = normTxt(p.nombre), b = normTxt(g.razon);
  return a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a));
}
// Confianza de un candidato exacto: 'seguro' (el mismo RUT o proveedor, o la propuesta segura) | 'probable' (monto y fecha)
export const confianzaCargo = (r, seguroProp) => (r.rut || r.prov || seguroProp ? 'seguro' : 'probable');
// Los exactos en su ventana (sin el efectivo; con un RUT en el cargo, no los de otro RUT), primero Seguro, después la fecha más cercana
export function exactosCargo(c, grupos) {
  return rankear(c, grupos).filter(x => x.exacto && x.g.clase !== 'efectivo' && enVentanaExacta(x.dist, x.g) && (!c.rut || !x.g.rut || x.g.rut === c.rut))
    .map(x => ({ ...x, prov: proveedorCalza(c, x.g) }))
    .sort((a, b) => ((b.rut || b.prov) - (a.rut || a.prov)) || (b.g.esperaCargo - a.g.esperaCargo) || Math.abs(a.dist) - Math.abs(b.dist));
}
// Lo que muestra "Ya está en Gastos": { exactos (con su confianza), parecidos (la lista ancha de antes, sin los exactos) }
export function candidatosCargo(c, grupos) {
  const ex = exactosCargo(c, grupos), pg = propuestaGasto(c, grupos), ids = new Set(ex.map(x => x.g));
  return { exactos: ex.map(x => ({ ...x, confianza: confianzaCargo(x, pg && pg.seguro && pg.a.g === x.g) })), parecidos: rankear(c, grupos).filter(x => !ids.has(x.g)) };
}
// La propuesta automática "Ya está en Gastos": solo montos exactos en su ventana (sin el efectivo). null si no hay.
export function propuestaGasto(c, grupos) {
  const l = exactosCargo(c, grupos);
  if (!l.length) return null;
  const [a, b] = l, empate = b && (b.rut || b.prov) === (a.rut || a.prov) && Math.abs(b.dist) === Math.abs(a.dist);
  // Seguro: por el RUT o el proveedor, o el único del monto con el pago a mano esperando su cargo o a 3 días o menos
  const seguro = !empate && (a.rut || a.prov || (l.length === 1 && (a.g.esperaCargo || Math.abs(a.dist) <= 3)));
  return { a, otros: l.slice(1, 4), seguro: !!seguro, por: a.rut ? 'rut' : a.prov ? 'proveedor' : 'monto' };
}

// ═══ v0.64.0 · "Ya está en Gastos": filtros por origen y días entre la compra y el cargo ═══
export const FILTROS_ORIGEN = [['todos', 'Todos'], ['sii_detalle', 'SII con detalle'], ['rcv', 'Registro de compras (RCV)'], ['mano', 'A mano'], ['vencimiento', 'Por pagar'], ['planilla', 'Planilla antigua']];
// El grupo de origen de un candidato (candidatosGastos)
export function grupoOrigen(x) {
  if (!x) return 'mano';
  if (x.clase === 'sii') return x.formato === 'registro' ? 'rcv' : 'sii_detalle';
  if (x.clase === 'vencimiento' || x.vencimientoId) return 'vencimiento';
  if (x.planilla) return 'planilla';
  return 'mano';
}
export const filtrarOrigen = (lista, f) => (!f || f === 'todos' ? lista : (lista || []).filter(r => grupoOrigen(r.g || r) === f));
// Color de "cargo N días después": amarillo desde 10, rojo desde 20 (puede no ser la compra de este cargo)
export const DIAS_AVISO_CARGO = { amarillo: 10, rojo: 20 };
export const colorDias = dist => (dist >= DIAS_AVISO_CARGO.rojo ? 'rojo' : dist >= DIAS_AVISO_CARGO.amarillo ? 'amarillo' : '');
export function textoDias(dist) {
  if (dist === 0) return 'mismo día';
  if (dist < 0) return `cargo ${-dist} ${dist === -1 ? 'día' : 'días'} antes`;
  return `cargo ${dist} ${dist === 1 ? 'día' : 'días'} después` + (dist >= DIAS_AVISO_CARGO.rojo ? ' · puede no ser la compra de este cargo' : '');
}

// ═══ v0.67.4 · Combinaciones en "Ya está en Gastos" y el proveedor del cargo ═══
// El caso: una transferencia paga una factura menos su nota de crédito (o varias facturas juntas). Ningún gasto es del monto del
// cargo, pero una combinación de gastos del MISMO proveedor sí (±$1). La combinación se propone como una opción más; al
// confirmarla todos sus gastos quedan con la cartola (deshacer los suelta todos). Una nota de crédito nunca va sola.
// · El proveedor del cargo: por el RUT (transferencia enviada o RUT en la glosa), por la glosa aprendida (ficha del proveedor) o
//   por el nombre de la glosa: sin "TEF A", "TRANSF A", "TRASPASO A", tildes, puntuación ni sufijos legales, sus palabras deben ser
//   el comienzo de la razón social de UN solo proveedor (al menos 10 letras o 2 palabras; la última puede venir cortada).
// · Búsqueda acotada: con el proveedor reconocido, hasta 15 documentos (los de fecha más cercana) y combinaciones de hasta 6;
//   sin proveedor, por RUT, hasta 10 documentos y combinaciones de hasta 3 (solo Probable). Primero la nota de crédito con la
//   factura que dice su referencia, después la combinación más chica y las fechas más cercanas.
export const COMB = { maxCand: 15, maxSub: 6, maxCandSin: 10, maxSubSin: 3, presupuesto: 40000, max: 5, tol: 1, ncDias: 45 };
const PREFIJO_GLOSA = /^(?:TEF|TRANSF(?:ERENCIA)?|TRASPASO|PAGO)(?: (?:ELECTRONICA|EN LINEA|BANCOESTADO|INTERNET))?(?: (?:A TERCEROS|DE PAGO A|A|DE))? /;
const SUFIJO_LEGAL = / (?:LTDA|LIMITADA|SPA|S P A|SA|S A|EIRL|E I R L|CIA|Y CIA|CIA LTDA)$/;
// Nombre para comparar: mayúsculas, sin tildes ni puntuación, sin sufijos legales al final
export function nombreBase(t) {
  let x = normTxt(t), y;
  do { y = x; x = x.replace(SUFIJO_LEGAL, '').trim(); } while (x !== y && x);
  return x;
}
// Lo que queda de la glosa para buscar por nombre: sin el prefijo de la transferencia ni palabras con números
export function nombreGlosa(desc) {
  let x = normTxt(desc), y;
  do { y = x; x = x.replace(PREFIJO_GLOSA, '').trim(); } while (x !== y && x);
  return nombreBase(x.split(' ').filter(w => w && !/\d/.test(w)).join(' '));
}
const glosaSirve = w => !!w && (w.replace(/ /g, '').length >= 10 || w.split(' ').filter(p => p.length >= 2).length >= 2);
// Proveedores distintos de una lista de grupos: clave = RUT (o el nombre base si no hay RUT)
const claveProv = g => (g.rut ? 'r:' + g.rut : g.razon ? 'n:' + nombreBase(g.razon) : '');
// El proveedor del cargo. grupos: los gastos sin cargo (positivos y notas de crédito). Devuelve
// { rut, nombre, por: 'rut'|'glosa'|'nombre', como } o { ambiguo: [nombres] } o null.
export function proveedorDelCargo(c, grupos) {
  const L = (grupos || []).filter(g => g && (g.rut || g.razon));
  const nombreDeRut = r => { const g = L.find(x => x.rut === r); return (g && g.razon) || (c.proveedor && rutNorm(c.proveedor.rut) === r ? c.proveedor.nombre : '') || (c.tef && c.tef.nombre) || ''; };
  const rutC = rutNorm(c && c.rut);
  if (rutC) return { rut: rutC, nombre: nombreDeRut(rutC), por: 'rut', como: c.rutDe === 'tef' ? 'RUT de la transferencia enviada' : 'RUT en la glosa' };
  const pf = c && c.proveedor;
  if (pf && pf.por === 'rut' && rutNorm(pf.rut)) return { rut: rutNorm(pf.rut), nombre: pf.nombre || nombreDeRut(rutNorm(pf.rut)), por: 'rut', como: 'RUT' };
  if (pf && pf.por === 'glosa') return { rut: rutNorm(pf.rut), nombre: pf.nombre, por: 'glosa', como: 'glosa aprendida' };
  const w = nombreGlosa(c && c.descripcion);
  if (glosaSirve(w)) {
    const vistos = new Map();
    L.forEach(g => { const nb = nombreBase(g.razon); if (nb && nb.startsWith(w)) { const k = claveProv(g); if (k && !vistos.has(k)) vistos.set(k, g); } });
    // Un mismo proveedor puede venir con y sin RUT: se juntan por el nombre base
    const porNombre = new Map(); vistos.forEach(g => { const nb = nombreBase(g.razon); const y = porNombre.get(nb); if (!y || (!y.rut && g.rut)) porNombre.set(nb, g); });
    const ruts = new Set([...porNombre.values()].map(g => g.rut || 'n:' + nombreBase(g.razon)));
    if (ruts.size === 1) { const g = [...porNombre.values()][0]; return { rut: g.rut, nombre: g.razon, por: 'nombre', como: 'nombre en la glosa' }; }
    if (ruts.size > 1) return { ambiguo: [...porNombre.values()].map(g => g.razon).slice(0, 4) };
  }
  if (pf && pf.por === 'nombre') return { rut: rutNorm(pf.rut), nombre: pf.nombre, por: 'nombre', como: 'nombre en la glosa' };
  return null;
}
// ¿El grupo es de ese proveedor? (el RUT, o el nombre base si alguno no tiene RUT)
export function esDelProveedor(prov, g) {
  if (!prov || prov.ambiguo || !g) return false;
  if (prov.rut && g.rut) return prov.rut === g.rut;
  const a = nombreBase(prov.nombre), b = nombreBase(g.razon);
  return a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a));
}
// Texto corto de un documento: "F.30990149", "NC 4068722", o los ítems y la fecha si no tiene folio
export const textoDocGrupo = g => (g.folio ? (g.nc || g.esNC ? 'NC ' : 'F.') + g.folio : `${(g.items || []).join(' + ') || 'Gasto'} ${dma(g.fecha)}`);
// "F.30990149 $135.768 − NC 4068722 $7.152 = $128.616"
export function textoCombinacion(gs) {
  const pos = gs.filter(g => g.monto > 0), neg = gs.filter(g => g.monto < 0), total = gs.reduce((t, g) => t + g.monto, 0);
  return pos.map((g, i) => (i ? '+ ' : '') + `${textoDocGrupo(g)} ${fmt(g.monto)}`).concat(neg.map(g => `− ${textoDocGrupo(g)} ${fmt(-g.monto)}`)).join(' ') + ` = ${fmt(total)}`;
}
export const claveGrupo = g => [g.fecha, g.hora, g.monto, g.filas[0].fila].join('|');
// Las combinaciones exactas (±$1) del cargo. grupos: positivos (candidatosGastos); ncs: notas de crédito (monto < 0, con refs:
// folios de las facturas que dice su referencia, si se conocen); prov: proveedorDelCargo. → [{ grupos, total, confianza, ref, texto, clave, filas }]
export function combinacionesCargo(c, grupos, ncs, prov, opc = {}) {
  const P = { ...COMB, ...opc }, monto = Math.round(n(c.monto)), conProv = !!(prov && !prov.ambiguo);
  const enVent = g => { const d = diasEntre(g.fecha, c.fecha); return isFinite(d) && enVentanaExacta(d, g); };
  const todos = (grupos || []).filter(g => g && g.monto > 0 && g.clase !== 'efectivo').concat((ncs || []).filter(g => g && g.monto < 0)).filter(enVent);
  const cubetas = new Map();
  if (conProv) cubetas.set('prov', todos.filter(g => esDelProveedor(prov, g)));
  else todos.forEach(g => { if (!g.rut) return; const k = 'r:' + g.rut; if (!cubetas.has(k)) cubetas.set(k, []); cubetas.get(k).push(g); });
  const maxC = conProv ? P.maxCand : P.maxCandSin, maxS = conProv ? P.maxSub : P.maxSubSin;
  let presupuesto = P.presupuesto, cortado = false;
  const out = [];
  cubetas.forEach(lista0 => {
    if (lista0.length < 2) return;
    const lista = lista0.slice().sort((a, b) => Math.abs(diasEntre(a.fecha, c.fecha)) - Math.abs(diasEntre(b.fecha, c.fecha)) || claveGrupo(a).localeCompare(claveGrupo(b))).slice(0, maxC);
    if (!lista.some(g => g.monto > 0)) return;
    // Para podar: lo máximo que todavía se puede sumar o restar con lo que queda
    const k = lista.length, posRest = new Array(k + 1).fill(0), negRest = new Array(k + 1).fill(0);
    for (let i = k - 1; i >= 0; i--) { posRest[i] = posRest[i + 1] + Math.max(0, lista[i].monto); negRest[i] = negRest[i + 1] + Math.min(0, lista[i].monto); }
    const el = [];
    const dfs = (i, suma) => {
      if (presupuesto-- <= 0) { cortado = true; return; }
      if (el.length >= 2 && Math.abs(suma - monto) <= P.tol) revisar(el.map(j => lista[j]));
      if (el.length >= maxS || i >= k) return;
      if (suma + posRest[i] < monto - P.tol || suma + negRest[i] > monto + P.tol) return;
      for (let j = i; j < k; j++) { el.push(j); dfs(j + 1, suma + lista[j].monto); el.pop(); if (presupuesto <= 0) { cortado = true; return; } }
    };
    const revisar = gs => {
      const pos = gs.filter(g => g.monto > 0), neg = gs.filter(g => g.monto < 0);
      if (!pos.length) return;
      // Cada nota de crédito: después de una de sus facturas (hasta 45 días). Si dice su referencia, mejor con esa factura.
      let ref = neg.length > 0;
      for (const x of neg) {
        if (!pos.some(f => { const d = diasEntre(f.fecha, x.fecha); return d >= 0 && d <= P.ncDias; })) return;
        const refs = Array.isArray(x.refs) ? x.refs.map(s) : [];
        if (!refs.length || !pos.some(f => f.folio && refs.includes(s(f.folio)))) ref = false;
      }
      const dist = gs.reduce((t, g) => t + Math.abs(diasEntre(g.fecha, c.fecha)), 0);
      const ord = pos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).concat(neg.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)));
      const seguro = !!(conProv && prov.por === 'rut' && prov.rut && gs.every(g => g.rut === prov.rut));
      out.push({ grupos: ord, total: gs.reduce((t, g) => t + g.monto, 0), nNC: neg.length, ref, dist, confianza: seguro ? 'seguro' : 'probable',
        texto: textoCombinacion(ord), clave: ord.map(claveGrupo).join('~~'), filas: ord.reduce((a, g) => a.concat(g.filas), []) });
    };
    dfs(0, 0);
  });
  out.sort((a, b) => (b.ref - a.ref) || (a.grupos.length - b.grupos.length) || (a.dist - b.dist) || a.clave.localeCompare(b.clave));
  const r = out.slice(0, P.max);
  Object.defineProperty(r, 'cortado', { value: cortado, enumerable: false });   // se acabó el presupuesto de la búsqueda
  return r;
}
// Documentos del SII por clasificar (aún sin gasto) que, con lo ya registrado del mismo RUT, suman el cargo: no se concilian
// aquí (primero se clasifican en Cargas del SII). pend: vistaPendiente[] (sii-pendientes.js). → { docs: [...], texto } o null
export function combinacionPorClasificar(c, pend, grupos, ncs, prov) {
  const monto = Math.round(n(c.monto)), conProv = !!(prov && !prov.ambiguo);
  const enV = f => { const d = diasEntre(f, c.fecha); return d >= VENTANAS_EXACTAS.sii[0] && d <= VENTANAS_EXACTAS.sii[1]; };
  const P0 = (pend || []).filter(v => v && Math.round(n(v.total)) !== 0 && enV(v.fecha)).map(v => ({ pc: true, rut: rutNorm(v.rut), razon: s(v.razonSocial), folio: s(v.folio), fecha: dia(v.fecha), monto: Math.round(n(v.total)), nc: !!v.esNC || n(v.total) < 0, id: v.id }));
  if (!P0.length) return null;
  const G0 = (grupos || []).filter(g => g.monto > 0).concat(ncs || []).filter(g => g.rut && enV(g.fecha) && g.clase !== 'efectivo');
  const ruts = [...new Set(P0.map(v => v.rut))].filter(r => r && (!conProv || !prov.rut || prov.rut === r)).slice(0, 6);
  for (const r of ruts) {
    const L = P0.filter(v => v.rut === r).concat(G0.filter(g => g.rut === r)).slice(0, 10);
    if (L.length < 2) continue;
    let mejor = null;
    const k = L.length;
    for (let m = 1; m < (1 << k); m++) {
      let suma = 0, cnt = 0, pc = 0, pos = 0;
      for (let i = 0; i < k; i++) if (m & (1 << i)) { suma += L[i].monto; cnt++; if (L[i].pc) pc++; if (L[i].monto > 0) pos++; }
      if (cnt < 2 || cnt > 4 || !pc || !pos || Math.abs(suma - monto) > COMB.tol) continue;
      if (!mejor || cnt < mejor.cnt) mejor = { cnt, docs: L.filter((_, i) => m & (1 << i)) };
    }
    if (mejor) {
      const docs = mejor.docs.slice().sort((a, b) => (b.monto > 0) - (a.monto > 0) || a.fecha.localeCompare(b.fecha));
      return { docs, porClasificar: docs.filter(x => x.pc).map(x => (x.nc ? 'NC ' : 'F.') + x.folio), texto: textoCombinacion(docs.map(x => ({ ...x, esNC: x.nc, items: [] }))) };
    }
  }
  return null;
}
// Todo lo de "Ya está en Gastos" para un cargo, de una vez (con memoria por lista: se calcula una sola vez por cargo).
// D: { gastos, notasCredito, siiPendientes }. → { prov, ambiguo, combos, delProv, porClasificar }
const memoAnalisis = new WeakMap();
export function analisisCargo(c, D) {
  if (!D || !c) return { prov: null, ambiguo: null, combos: [], delProv: [], porClasificar: null };
  let m = memoAnalisis.get(D); if (!m) { m = new Map(); memoAnalisis.set(D, m); }
  const k = c.id + '|' + c.monto + '|' + c.fecha + '|' + (c.rut || '') + '|' + ((c.proveedor && c.proveedor.id) || '');
  if (m.has(k)) return m.get(k);
  const G = D.gastos || [], N = D.notasCredito || [];
  const p0 = proveedorDelCargo(c, G.concat(N));
  const prov = p0 && !p0.ambiguo ? p0 : null, ambiguo = p0 && p0.ambiguo ? p0.ambiguo : null;
  const combos = combinacionesCargo(c, G, N, prov);
  const delProv = prov ? G.concat(N).filter(g => esDelProveedor(prov, g)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.monto - a.monto) : [];
  const porClasificar = combos.length ? null : combinacionPorClasificar(c, D.siiPendientes || [], G, N, prov);
  const r = { prov, ambiguo, combos, delProv, porClasificar, cortado: !!combos.cortado };
  m.set(k, r);
  return r;
}
// La propuesta de un cargo con una combinación: solo con el proveedor reconocido (sin él, solo se muestra al abrir el cargo).
// Nunca se confirma sola (seguro: false); conf dice Seguro (RUT confirmado) o Probable.
export function propuestaCombinacion(c, D) {
  const A = analisisCargo(c, D), k = A.combos[0];
  if (!A.prov || !k) return null;
  return { tipo: 'gasto', combo: true, seguro: false, conf: k.confianza, clave: k.clave, gasto: { fecha: k.grupos[0].fecha, hora: k.grupos[0].hora, monto: k.total, filas: k.filas }, grupos: k.grupos,
    texto: k.texto + (A.combos.length > 1 ? ` (hay ${A.combos.length - 1} ${A.combos.length === 2 ? 'combinación más' : 'combinaciones más'})` : ''), por: 'combinacion', chip: 'Combinación' };
}
// Revisa una selección de varios grupos (manual o combinación): cuadra con el cargo (±$1), al menos un gasto positivo
export function revisarSeleccion(gs, monto) {
  const L = (gs || []).filter(Boolean), suma = L.reduce((t, g) => t + g.monto, 0), dif = Math.round(n(monto) - suma);
  const tol = L.length === 1 ? Math.max(1, L[0].filas.length) : COMB.tol;
  const pos = L.some(g => g.monto > 0);
  return { suma, dif, cuadra: L.length > 0 && pos && Math.abs(dif) <= tol, soloNC: L.length > 0 && !pos, n: L.length };
}

// ── Origen de un gasto ──
// lineas: los documentos del registro [{ id, d }] (las líneas de una misma compra). ctx (opcional, lo que se pudo leer):
// { vencimiento: d, cargo: d (cartola_cargos), siiDoc: d (sii_docs), cargas: [{ id, d }] (sii_cargas) }
// Devuelve { tipo, titulo, filas: [[rótulo, valor]], por, en }
export function resolverOrigen(lineas, ctx = {}) {
  const l0 = (lineas || [])[0] || { id: '', d: {} }, d = l0.d || {}, id = s(l0.id), od = d.origenDetalle || {};
  const creado = d.creado || {}, por = s(od.por || creado.por), en = s(od.en) || enTexto(creado.en);
  const o = s(d.origen).toLowerCase();
  // Un pago de vencimiento manda (aunque traiga la factura del SII o sea de Previred); después Previred al subir, SII, cartola
  const tipo = od.tipo || (s(d.vencimientoId) || /^gp-/.test(id) || o === 'obligacion' ? 'vencimiento'
    : o === 'previred' || d.previred || /^gq-/.test(id) ? 'previred'
    : o === 'sii' || /^gs-/.test(id) || (d.siiDoc && d.siiDoc.id) ? 'sii'
    : o === 'cartola' || /^gc-/.test(id) ? 'cartola'
    : o === 'mano' ? 'mano'
    : s(d.hoja) ? 'planilla' : 'mano');
  const filas = [], v = ctx.vencimiento || null;
  const quien = por ? [['Por', por]] : [];
  if (tipo === 'mano') {
    const medio = s(d.medioPago || od.medio);
    filas.push(['Registrado', [dma(d.fecha), s(d.hora)].filter(Boolean).join(' ') + (en ? ` · guardado ${en}` : '')], ...quien);
    if (medio) filas.push(['Pagado con', medio === 'banco' ? 'Transferencia o banco (espera su cargo en la cartola)' : 'Efectivo']);
    if (s(d.urlFoto)) filas.push(['Boleta', 'adjunta']);
    return { tipo, titulo: 'Registro a mano', filas, por, en };
  }
  if (tipo === 'vencimiento' || tipo === 'abono') {
    const nombre = s(od.obligacion) || s(v && v.nombre) || 'vencimiento', periodo = s(od.periodo) || dia(v && (v.fechaVencimiento || v.fechaDocumento));
    const abono = d.abono || od.abono;
    filas.push(['Vencimiento', `${nombre}${periodo ? ' · ' + nombreMes(periodo) : ''}`]);
    if (abono) filas.push(['Abono', `N° ${abono}`]);
    const conCartola = od.cartola === true || !!s(od.cargoId) || (ligado(d) && !d.esperaCargo && !od.aMano);
    filas.push(['Pagado', `${dma(dia(d.fechaPago) || d.fecha)}${od.aMano ? ' · registrado a mano' : conCartola ? ' · con la cartola' : ''}`], ...quien);
    if (d.previred) filas.push(['Previred', `Certificado ${nombreMes(s(d.previred.periodo).length === 6 ? s(d.previred.periodo).slice(0, 4) + '-' + s(d.previred.periodo).slice(4) + '-01' : d.previred.periodo)} · RUT ${s(d.previred.rut)}`]);
    if (s(d.folio) || (v && v.documento && v.documento.folio)) filas.push(['Documento', `Factura N° ${s(d.folio) || s(v.documento.folio)}${s(d.rutProveedor) ? ' · RUT ' + s(d.rutProveedor) : ''}`]);
    if (s(d.vencimientoId)) filas.push(['Id del vencimiento', s(d.vencimientoId)]);
    return { tipo: 'vencimiento', titulo: `Pago del vencimiento ${nombre}${periodo ? ' ' + nombreMes(periodo) : ''}`, filas, por, en };
  }
  if (tipo === 'sii') {
    const doc = ctx.siiDoc || null, docLineas = doc && Array.isArray(doc.lineas) ? doc.lineas : [];
    const carga = cargaDe(d, doc, ctx.cargas);
    const formato = s(od.formato) || formatoArchivo(carga && carga.d.nombreArchivo) || (docLineas.length ? 'con_detalle' : doc ? 'registro' : '');
    const conDetalle = formato === 'xml' || formato === 'detalle' || formato === 'con_detalle';
    const nombreF = { xml: 'XML', detalle: 'Documentos recibidos (.xls)', con_detalle: 'Archivo' }[formato] || '';
    const titulo = 'Carga del SII · ' + (conDetalle ? `${nombreF} con detalle${docLineas.length ? ` (${docLineas.length} ${docLineas.length === 1 ? 'línea' : 'líneas'})` : ''}` : formato === 'registro' ? 'Registro de compras sin detalle' : 'documento del SII');
    if (carga) filas.push(['Carga', `${s(carga.d.id) || carga.id}${s(carga.d.fechaCarga) ? ' · cargada el ' + dma(carga.d.fechaCarga) : ''}${s(carga.d.nombreArchivo) ? ' · ' + s(carga.d.nombreArchivo) : ''}`]);
    else if (s(od.cargaId)) filas.push(['Carga', s(od.cargaId)]);
    filas.push(['Proveedor', `${s(d.razonSocial)}${s(d.rutProveedor) ? ' · RUT ' + s(d.rutProveedor) : ''}`]);
    const folio = s(d.folio) || s(d.siiDoc && d.siiDoc.folio);
    if (folio) filas.push(['Folio', `${d.esNC ? 'Nota de crédito' : 'Factura'} N° ${folio}${doc && doc.importado && doc.importado.fechaDocto ? ' · emitida ' + dma(doc.importado.fechaDocto) : ''}`]);
    if (conDetalle && docLineas.length) filas.push(['Detalle', docLineas.slice(0, 12).map(x => `${s(x.descripcion)}${x.montoNeto ? ' ' + fmt(n(x.montoNeto)) : ''}`).join(' · ') + (docLineas.length > 12 ? ` · y ${docLineas.length - 12} más` : '')]);
    if (formato === 'registro') filas.push(['Detalle', 'El Registro de compras trae solo los totales (sin productos)']);
    const imp = doc && doc.importado;
    if (imp && (imp.por || imp.en)) filas.push(['Importado', [s(imp.en), s(imp.por)].filter(Boolean).join(' · ')]);
    else filas.push(...quien);
    return { tipo, titulo, filas, por: por || s(imp && imp.por), en: en || s(imp && imp.en), formato, conDetalle, nLineas: docLineas.length };
  }
  if (tipo === 'previred') {
    const p = d.previred || {};
    filas.push(['Certificado', `Previred${p.periodo ? ' ' + s(p.periodo) : ''}${p.rut ? ' · RUT ' + s(p.rut) : ''}`], ...quien);
    if (s(d.urlFoto)) filas.push(['PDF', 'adjunto']);
    return { tipo, titulo: 'Previred (certificado)', filas, por, en };
  }
  if (tipo === 'cartola') {
    const c = ctx.cargo || null;
    filas.push(['Cargo', c ? `${fmt(n(c.monto))} · ${s(c.descripcion)} · ${dma(c.fecha)}` : s(d.cartola).replace(/\s*\[cc[0-9a-f]+\]$/, '') || 'de la cartola'], ...quien);
    if (s(d.cartolaCargo)) filas.push(['Id del cargo', s(d.cartolaCargo)]);
    return { tipo, titulo: 'Cartola (gasto nuevo desde un cargo)', filas, por, en };
  }
  // Copiado desde la planilla antigua (copia G1)
  filas.push(['Planilla', `${s(d.hoja) || 'Registro Gasto'}${d.fila ? ', fila ' + s(d.fila) : ''}`], ['ID planilla', id]);
  if (/^Previred /.test(s(d.observacion))) filas.push(['Nota', 'Era una línea de Previred']);
  return { tipo: 'planilla', titulo: 'Copiado desde la planilla antigua', filas, por: '', en: '' };
}
const enTexto = v => (!v ? '' : typeof v === 'string' ? v.slice(0, 16).replace('T', ' ') : v.__ts ? new Date(v.__ts).toISOString().slice(0, 16).replace('T', ' ') : typeof v.toDate === 'function' ? v.toDate().toISOString().slice(0, 16).replace('T', ' ') : v.seconds ? new Date(v.seconds * 1000).toISOString().slice(0, 16).replace('T', ' ') : '');
export const formatoArchivo = nombre => { const x = s(nombre).toLowerCase(); return /\.xml$/.test(x) ? 'xml' : /\.(xls|xlsx|html)$/.test(x) ? 'detalle' : /\.(csv|txt)$/.test(x) ? 'registro' : ''; };
// La carga del SII de ese documento: la de origenDetalle.cargaId, o la primera (por fecha) cuya lista de documentos lo trae
function cargaDe(d, doc, cargas) {
  const L = (cargas || []).filter(x => x && x.d && !x.d.quitadoEnPlanilla);
  const od = d.origenDetalle || {};
  if (s(od.cargaId)) { const x = L.find(y => (s(y.d.id) || y.id) === s(od.cargaId)); if (x) return x; }
  const clave = s(doc && doc.clave);
  if (!clave) return null;
  const con = L.filter(x => { try { return (JSON.parse(s(x.d.documentos) || '[]') || []).some(k => s(k && k.k) === clave); } catch (e) { return false; } });
  return con.sort((a, b) => s(dia(a.d.fechaCarga)).localeCompare(s(dia(b.d.fechaCarga))))[0] || null;
}
// Las líneas del registro, para el detalle: fecha, ítem, área, neto, IVA, total, tipo de monto, forma de pago, observación, archivos
export function resumenLineas(lineas) {
  const L = (lineas || []).map(x => x.d || {});
  const d0 = L[0] || {};
  const neto = L.reduce((t, d) => t + n(d.montoNeto), 0), total = L.reduce((t, d) => t + n(d.montoFinal), 0);
  const forma = s(d0.formaPago || 'contado'), medio = s(d0.medioPago || (d0.origenDetalle || {}).medio);
  // v0.69.2 · Pagado en partes (un cargo y el resto en efectivo o con tarjeta, o varios cargos): lo dice tal cual
  const mix = d0.pagoMixto && Array.isArray(d0.pagoMixto.partes) && d0.pagoMixto.partes.length ? d0.pagoMixto : null;
  // v0.81.0 · Pagado sin banco (efectivo, tarjeta, Mercado Pago o plata personal del dueño) y retiro del dueño
  const sb = d0.pagoSinBanco && !mix ? d0.pagoSinBanco : null;
  const MED = { efectivo: 'Pagado en efectivo', tarjeta: 'Pagado con tarjeta de crédito', mercadopago: 'Pagado o descontado en Mercado Pago', personal: 'Pagado por el dueño con plata personal' };
  const pagado = mix ? textoPagadoMix(mix) : sb && MED[sb.medio] ? `${MED[sb.medio]}${sb.fecha ? ' el ' + dma(sb.fecha) : ''}${sb.nota ? ' · ' + s(sb.nota) : ''}` : '';
  const formaTxt = mix ? `Pagado en partes (el ${dma(d0.fechaPago)}, la última)` : d0.enPartes === true ? 'En partes: todavía tiene saldo (ver su vencimiento)' : forma === 'tarjeta' ? 'Tarjeta de crédito' : forma === 'proveedor' ? 'Crédito proveedor' + (s(d0.fechaPago) ? ` (pagado el ${dma(d0.fechaPago)})` : '') : medio === 'efectivo' ? 'Contado · efectivo' : medio === 'banco' ? 'Contado · transferencia o banco' : 'Contado';
  return { fecha: dia(d0.fecha), fechaPago: dia(d0.fechaPago), hora: s(d0.hora).slice(0, 5), items: [...new Set(L.map(d => s(d.itemGasto)))],
    areas: L.map(d => ({ area: s(d.area), item: s(d.itemGasto), neto: n(d.montoNeto), total: n(d.montoFinal) })),
    neto, iva: total - neto, total, tipoMonto: { bruto: 'Bruto (con IVA)', neto: 'Neto (+IVA)', siniva: 'Sin IVA' }[s(d0.tipoMonto)] || s(d0.tipoMonto), forma: formaTxt,
    obs: s(d0.observacion), archivos: [...new Set(L.map(d => s(d.urlFoto)).filter(Boolean))], esperaCargo: L.some(d => d.esperaCargo === true), cartola: L.map(d => s(d.cartola)).find(Boolean) || '', pagado };
}
// "Pagado: $113.780 banco (cargo 14-10) + $11.220 efectivo (15-10, cobros B2B)" (de pagoMixto del gasto)
function textoPagadoMix(mix) {
  const dm = f => dma(f).slice(0, 5), o = p => (s(p.origen) === 'otro' ? s(p.origenTexto) || 'otro' : 'cobros B2B');
  return 'Pagado: ' + mix.partes.map(p => `${fmt(n(p.monto))} ${p.medio === 'banco' ? `banco (${p.cargoId ? 'cargo ' : ''}${dm(p.fecha)})` : p.medio === 'efectivo' ? `efectivo (${dm(p.fecha)}, ${o(p)})` : p.medio === 'tarjeta' ? `tarjeta (${dm(p.fecha)})` : `a mano (${dm(p.fecha)})`}`).join(' + ');
}
