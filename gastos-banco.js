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
export function esperanCartola({ vencs, plantillas, gastos, hoy, gracia = GRACIA }) {
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
    const f = dia(d.fechaPago) || dia(d.fecha); if (!f) return;
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
export function candidatosGastos(gastos, hoy, facturasAbiertas) {
  const corte = sumar(hoy, -150), porRegistro = {}, out = [];
  (gastos || []).forEach(({ id, d }) => {
    if (!d || d.estado !== 'vigente' || d.quitadoEnPlanilla || ligado(d)) return;
    const clase = claseCandidato(d); if (!clase) return;
    // Fecha de referencia: la del pago para lo pagado (vencimientos, pagos a mano por banco); la del documento para el SII y lo demás
    const f = (clase === 'espera' || clase === 'vencimiento') ? (dia(d.fechaPago) || dia(d.fecha)) : dia(d.fecha), monto = n(d.montoFinal);
    if (!f || f < corte || !(monto > 0)) return;
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
  });
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 800);
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
  return (grupos || []).map(g => {
    const dist = diasEntre(g.fecha, c.fecha), v = ventanas[g.clase] || ventanas.contado;
    if (!(dist >= v[0] && dist <= v[1])) return null;
    const dif = Math.abs(g.monto - c.monto);
    return { g, dist, dif, exacto: dif <= g.filas.length, rut: !!(c.rut && g.rut && g.rut === c.rut) };
  }).filter(Boolean).sort((a, b) => (b.exacto - a.exacto) || ((a.g.clase === 'efectivo') - (b.g.clase === 'efectivo')) || (b.exacto && a.exacto ? (b.rut - a.rut) || (b.g.esperaCargo - a.g.esperaCargo) : 0)
    || a.dif - b.dif || Math.abs(a.dist) - Math.abs(b.dist));
}
// La propuesta automática "Ya está en Gastos": solo montos exactos (sin el efectivo). null si no hay.
export function propuestaGasto(c, grupos) {
  const l = rankear(c, grupos).filter(x => x.exacto && x.g.clase !== 'efectivo' && (!c.rut || !x.g.rut || x.g.rut === c.rut));
  if (!l.length) return null;
  const [a, b] = l, empate = b && b.rut === a.rut && Math.abs(b.dist) === Math.abs(a.dist);
  // Seguro: por el RUT, o el único del monto con el pago a mano esperando su cargo o a 3 días o menos
  const seguro = !empate && (a.rut || (l.length === 1 && (a.g.esperaCargo || Math.abs(a.dist) <= 3)));
  return { a, otros: l.slice(1, 4), seguro, por: a.rut ? 'rut' : 'monto' };
}

// ═══ v0.64.0 · "Ya está en Gastos": filtros por origen y días entre la compra y el cargo ═══
export const FILTROS_ORIGEN = [['todos', 'Todos'], ['sii_detalle', 'SII con detalle'], ['rcv', 'Registro de compras (RCV)'], ['mano', 'A mano'], ['vencimiento', 'Vencimientos'], ['planilla', 'Planilla antigua']];
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
  const formaTxt = forma === 'tarjeta' ? 'Tarjeta de crédito' : forma === 'proveedor' ? 'Crédito proveedor' + (s(d0.fechaPago) ? ` (pagado el ${dma(d0.fechaPago)})` : '') : medio === 'efectivo' ? 'Contado · efectivo' : medio === 'banco' ? 'Contado · transferencia o banco' : 'Contado';
  return { fecha: dia(d0.fecha), fechaPago: dia(d0.fechaPago), hora: s(d0.hora).slice(0, 5), items: [...new Set(L.map(d => s(d.itemGasto)))],
    areas: L.map(d => ({ area: s(d.area), item: s(d.itemGasto), neto: n(d.montoNeto), total: n(d.montoFinal) })),
    neto, iva: total - neto, total, tipoMonto: { bruto: 'Bruto (con IVA)', neto: 'Neto (+IVA)', siniva: 'Sin IVA' }[s(d0.tipoMonto)] || s(d0.tipoMonto), forma: formaTxt,
    obs: s(d0.observacion), archivos: [...new Set(L.map(d => s(d.urlFoto)).filter(Boolean))], esperaCargo: L.some(d => d.esperaCargo === true), cartola: L.map(d => s(d.cartola)).find(Boolean) || '' };
}
