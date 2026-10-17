// ═══════════════════════════════════════════════
//  Sistema Fën — "Ver el registro": el detalle de un movimiento parecido o repetido, ahí mismo  v0.67.7
//  Donde la pantalla dice que hay otro movimiento igual o parecido ("Parece el mismo movimiento que…", "Ojo: hay otro cargo del mismo
//  día y monto", "Repetido de la cartola…", "Ojo: el folio … ya se registró pagado…"), un bloque que se abre sin salir de la pantalla:
//   · el movimiento original: fecha, monto, glosa, cuenta, N° de operación, de qué cartola vino, cuándo se subió y quién lo subió;
//   · cómo se resolvió: en B2B el cliente, los folios (fecha de factura, monto, saldo que queda), si fue un pago parcial; en Gastos la
//     acción (vencimiento pagado, gasto, Previred, abono de sueldo…) con sus gastos o vencimientos (fecha, ítem, monto);
//     quién lo resolvió y cuándo;
//   · la fecha de pago registrada en la factura o el gasto.
//  Todo sale de lo que ya está en la memoria (sin lecturas). Funciones puras: las usan app.js y las pruebas.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v);
export const esc = v => s(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
// "2026-10-13" → "13-10-2026"; "2026-10-13 09:05:12" → "13-10-2026 09:05"
export function fechaTxt(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s(f));
  return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? ' ' + m[4] + ':' + m[5] : ''}` : s(f);
}
const quienCuando = (por, en) => [en ? 'el ' + fechaTxt(en) : '', por ? 'por ' + por : ''].filter(Boolean).join(' ');

// ── El bloque (lo mismo para B2B y Gastos) ──
// reg = { clave, mov: [[etiqueta, valor]], estado: { texto, tono }, resolucion: [[etiqueta, valor]], docs: { titulo, filas: [{ titulo, texto }] },
//         fechaPago, quien, aviso }
// opts = { abierto, icono (html del ícono), resumen (texto del botón) }
export function htmlRegistro(reg, opts = {}) {
  if (!reg) return '';
  const dl = l => `<dl class="reg-dl">${l.filter(x => x && s(x[1]).trim()).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const docs = reg.docs && reg.docs.filas && reg.docs.filas.length
    ? `<p class="reg-sub">${esc(reg.docs.titulo)}</p><ul class="reg-docs">${reg.docs.filas.map(f => `<li><b>${esc(f.titulo)}</b>${f.texto ? `<span>${esc(f.texto)}</span>` : ''}</li>`).join('')}</ul>` : '';
  // Un botón (no <details>): así el bloque puede ir dentro de otras filas plegables sin abrirlas ni cerrarlas
  return `<div class="reg-det${opts.abierto ? ' abierto' : ''}" data-reg="${esc(reg.clave || '')}"><button type="button" class="reg-btn" data-reg-btn aria-expanded="${opts.abierto ? 'true' : 'false'}">${opts.icono || ''}<span>${esc(opts.resumen || 'Ver el registro')}</span></button>
    <div class="reg-cuerpo"${opts.abierto ? '' : ' hidden'}>
      <div class="reg-bloque"><p class="reg-tit">El movimiento${opts.info ? ' ' + opts.info : ''}</p>${dl(reg.mov || [])}</div>
      <div class="reg-bloque"><p class="reg-tit">Cómo se resolvió${reg.estado ? ` <span class="chip chip-chico ${esc('c-' + (reg.estado.tono || 'gris'))}">${esc(reg.estado.texto)}</span>` : ''}</p>${dl(reg.resolucion || [])}${docs}
        ${reg.fechaPago ? `<p class="reg-pago"><span>Fecha de pago registrada</span><b>${esc(reg.fechaPago)}</b></p>` : ''}
        ${reg.quien ? `<p class="reg-quien">${esc(reg.quien)}</p>` : ''}${reg.aviso ? `<p class="ayuda reg-aviso">${esc(reg.aviso)}</p>` : ''}</div>
    </div></div>`;
}

// ═══ B2B: un abono de la cartola (movimientos de fen-b2b) ═══
// m: el abono (cualquier estado) o la copia guardada en un repetido (repetido.original, con menos datos).
// ctx = { cuentaTxt(cuenta), fuenteTxt(m) ("cartola en línea del 13-10-2026"), infoFolio(folio) → { fechaFactura, total, saldo, pagado,
//         fechaPago, medioPago, ordenes: [n] } | null, cuando(ts) → texto }
const ESTADO_B2B = { pendiente: ['Por conciliar', 'amarillo'], conciliado: ['Conciliado', 'verde'], revisado: ['Ya registrado', 'azul'], ignorado: ['No es de B2B', 'gris'], repetido: ['Repetido', 'gris'] };
const TIPO_ASIG = { pago: 'paga el folio completo', abono: 'abono parcial', 'abono final': 'último abono: el folio queda pagado' };
export function registroAbono(m, ctx = {}) {
  if (!m) return null;
  const cuando = ctx.cuando || (t => s(t)), cuentaTxt = ctx.cuentaTxt || (x => s(x)), infoFolio = ctx.infoFolio || (() => null);
  const subidaPor = (m.cargado && m.cargado.por) || m.subidaPor || '', subidaEl = m.subidaEl || cuando(m.cargado && m.cargado.en);
  const mov = [['Fecha', fechaTxt(m.fecha)], ['Monto', pesos(m.monto)], ['Glosa', m.descripcion], ['Cuenta', cuentaTxt(m.cuenta || 'chequera')],
    ['N° de operación', m.nOperacion || '—'], ['Cartola', ctx.fuenteTxt ? ctx.fuenteTxt(m) : m.cartola], ['Subida', quienCuando(subidaPor, subidaEl) || (m.origen === 'app antigua' ? 'traída de la app B2B antigua' : '—')]];
  const [et, tono] = m._fuera ? ['Resuelto en otro equipo', 'gris'] : m.estado === 'conciliado' && m.origen === 'app antigua' ? ['Conciliado en la app antigua', 'gris'] : ESTADO_B2B[m.estado] || [s(m.estado) || '—', 'gris'];
  const asig = Array.isArray(m.asignaciones) ? m.asignaciones : Array.isArray(m.folios) ? m.folios : [];
  const filas = [], pagos = [];
  asig.forEach(a => {
    const f = infoFolio(String(a.folio)) || {};
    if (f.fechaPago) pagos.push(`${fechaTxt(f.fechaPago)} (folio ${a.folio})`);
    const ords = (a.pagaOrdenes || []).length ? `órdenes N° ${a.pagaOrdenes.join(', ')}` : (f.ordenes || []).length ? `${f.ordenes.length === 1 ? 'orden' : 'órdenes'} N° ${f.ordenes.join(', ')}` : '';
    filas.push({ titulo: `Folio ${a.folio} · ${pesos(a.monto)} de este abono${a.tipo ? ' (' + (TIPO_ASIG[a.tipo] || a.tipo) + ')' : ''}`,
      texto: [f.fechaFactura ? 'factura del ' + fechaTxt(f.fechaFactura) : '', f.total ? 'total ' + pesos(f.total) : '', f.saldo !== undefined && f.saldo !== null ? (f.pagado || f.saldo <= 0 ? 'saldo $0 (pagado)' : 'saldo que queda ' + pesos(f.saldo)) : '',
        f.fechaPago ? 'pagado el ' + fechaTxt(f.fechaPago) + (f.medioPago ? ' · ' + f.medioPago : '') : '', ords].filter(Boolean).join(' · ') });
  });
  const parcial = asig.some(a => a.tipo === 'abono') || (asig.length && asig.some(a => { const f = infoFolio(String(a.folio)); return f && !f.pagado && f.saldo > 0; }));
  const res = [['Cliente', m.cliente || (m.estado === 'pendiente' ? 'todavía no se elige' : '—')]];
  if (m.estado === 'conciliado') res.push(['Pago parcial', parcial ? 'Sí: queda saldo por cobrar' : 'No']);
  if (m.favorInicial) res.push(['Saldo a favor', pesos(m.favorInicial)]);
  if (m.origen === 'app antigua' && typeof m.folios === 'string' && m.folios) res.push(['Folios', m.folios]);
  if (m.nota) res.push(['Nota', m.nota]);
  if (m.estado === 'repetido' && m.repetido && m.repetido.original) res.push(['Es el mismo que', `${pesos(m.repetido.original.monto)} del ${fechaTxt(m.repetido.original.fecha)} (${ctx.fuenteTxt ? ctx.fuenteTxt(m.repetido.original) : ''})`]);
  const r = m.resuelto || {}, quien = m.estado === 'pendiente' ? 'Todavía por conciliar.' : (r.por || r.en || m.resueltoPor) ? `Resuelto ${quienCuando(r.por || m.resueltoPor, r.en ? cuando(r.en) : m.resueltoEn)}.` : '';
  const aviso = m._fuera ? 'Se resolvió desde otro equipo mientras esta pantalla estaba abierta: toca Actualizar para ver cómo.' : m.estado === 'revisado' ? 'Se marcó "Ya estaba registrado": no registró ningún pago nuevo.' : '';
  return { clave: 'b2b:' + s(m.id || m.repetidoDe || m.fecha + m.monto), mov, estado: { texto: et, tono }, resolucion: res, docs: { titulo: filas.length === 1 ? 'La factura' : 'Las facturas', filas },
    fechaPago: pagos.join(' · '), quien, aviso };
}
// Un folio ya pagado que se parece al abono ("Ojo: el folio … ya se registró pagado el …"): de las órdenes en la memoria
export function registroFolioPagado(p, ctx = {}) {
  if (!p) return null;
  const f = (ctx.infoFolio && ctx.infoFolio(String(p.folio))) || {};
  const mov = ctx.movDe ? ctx.movDe(String(p.folio)) : null;   // el abono de la cartola que lo pagó, si está en la memoria
  if (mov) { const r = registroAbono(mov, ctx); r.clave = 'folio:' + p.folio; r.aviso = (r.aviso ? r.aviso + ' ' : '') + `Este es el abono de la cartola con que se pagó el folio ${p.folio}.`; return r; }
  return { clave: 'folio:' + p.folio, mov: [['Folio', s(p.folio)], ['Cliente', f.cliente || ''], ['Fecha de factura', fechaTxt(f.fechaFactura)], ['Monto', pesos(p.total || f.total)]],
    estado: { texto: 'Pagado', tono: 'verde' }, resolucion: [['Cómo se pagó', f.medioPago || 'registrado a mano en Por cobrar'], ['Órdenes', (f.ordenes || []).length ? 'N° ' + f.ordenes.join(', ') : '']],
    docs: null, fechaPago: fechaTxt(p.fechaPago || f.fechaPago), quien: '', aviso: 'No está en la cartola de estos días: el pago se registró a mano (o con una cartola más antigua).' };
}

// ═══ Gastos: un cargo de la cartola (cartola_cargos de fen-gastos, como lo entrega vistaCargo) ═══
// ctx = { cuentaTxt(c), fuentesTxt(c) ("Cartola en línea del … · Cartola histórica N°53"), gastos: [lo ligado a ese cargo], nombreCriterio(por) }
const ACCION_CC = { vencimientos: 'Pagó vencimientos', gasto: 'Ya estaba en Gastos', nuevo: 'Gasto nuevo', abono: 'Abono de sueldo', abono_parcial: 'Abono a un vencimiento', previred: 'Pago de Previred',
  previred_planilla: 'Unido a una planilla de Previred', pago_tarjeta: 'Pago de tarjeta de crédito', traspaso: 'Traspaso entre cuentas propias', ignorar: 'No es gasto', repetido: 'Repetido de otra cartola' };
export function registroCargo(c, ctx = {}) {
  if (!c) return null;
  const d = c.detalle || {}, gs = ctx.gastos || [];
  const mov = [['Fecha', fechaTxt(c.fecha)], ['Monto', pesos(c.monto)], ['Glosa', c.descripcion], ['Cuenta', ctx.cuentaTxt ? ctx.cuentaTxt(c) : c.cuenta], ['N° de operación', c.operacion || '—'],
    ['Cartola', ctx.fuentesTxt ? ctx.fuentesTxt(c) : c.cartola], ['Subida', quienCuando(c.subidaPor, c.subidaEl) || '—']];
  const est = c.estado === 'POR_REVISAR' ? ['Por revisar', 'amarillo'] : c.estado === 'IGNORADO' ? ['No es gasto', 'gris'] : c.estado === 'REPETIDO' ? ['Repetido', 'gris'] : c.estado === 'A_MEDIAS' ? ['A medias', 'rojo']
    : c.accion === 'pago_tarjeta' || c.accion === 'traspaso' ? [ACCION_CC[c.accion], 'gris'] : ['Conciliado', 'verde'];
  const res = [['Acción', c.estado === 'POR_REVISAR' ? 'todavía no se revisa' : ACCION_CC[c.accion] || (c.estado === 'IGNORADO' ? 'No es gasto' : s(c.accion) || '—')]];
  const filas = [];
  const fila = g => ({ titulo: `${fechaTxt(g.fecha)} · ${g.item || g.itemGasto || 'gasto'} · ${pesos(g.monto !== undefined ? g.monto : g.montoFinal)}`,
    texto: [g.area ? 'área ' + g.area : '', g.folio ? 'factura N° ' + g.folio : '', g.razon || g.razonSocial || '', g.fechaPago ? 'pagado el ' + fechaTxt(g.fechaPago) : g.formaPago === 'contado' ? 'al contado' : ''].filter(Boolean).join(' · ') });
  if (c.accion === 'vencimientos') (d.vencimientos || []).forEach(v => filas.push({ titulo: `${v.nombre || 'Vencimiento'} · ${pesos(v.monto)}`, texto: [v.folio ? 'factura N° ' + v.folio : '', v.razon || '', `pagado el ${fechaTxt(c.fecha)} con este cargo`].filter(Boolean).join(' · ') }));
  if (c.accion === 'abono' || c.accion === 'abono_parcial') { const x = d.abono || d.abonoParcial || {}; filas.push({ titulo: `${x.nombre || 'Vencimiento'} · abono ${x.n || ''} · ${pesos(x.monto || c.monto)}`, texto: x.final ? 'último abono: quedó pagado' : x.saldo ? 'queda ' + pesos(x.saldo) : '' }); }
  if (c.accion === 'previred' || c.accion === 'previred_planilla') { const x = d.previred || d.previredPlanilla || {}; filas.push({ titulo: `${x.nombre || 'Planilla de Previred'} · ${pesos(x.suma || c.monto)}`, texto: `${(x.cargos || []).length || 1} ${(x.cargos || []).length === 1 ? 'cargo' : 'cargos'}${x.completa ? ' · pagada y conciliada' : ''}` }); }
  if (c.accion === 'pago_tarjeta' && d.tarjeta) res.push(['Tarjeta', d.tarjeta]);
  if (c.accion === 'traspaso' && d.nota) res.push(['Nota', d.nota]);
  if (c.estado === 'IGNORADO') res.push(['Motivo', (d.motivo || '') + (d.regla ? ' (siempre)' : '')]);
  if (c.estado === 'REPETIDO' && d.original) res.push(['Es el mismo que', `${d.original.descripcion || ''} del ${fechaTxt(d.original.fecha)}${ctx.nombreCriterio && d.por ? ' (' + ctx.nombreCriterio(d.por) + ')' : ''}`]);
  // Los gastos ligados a este cargo (de la memoria); si no están (más antiguos), lo que guardó el cargo
  if (gs.length) gs.forEach(g => filas.push(fila(g)));
  else if (c.accion === 'gasto' || c.accion === 'nuevo') filas.push({ titulo: `${(d.items || []).join(' + ') || 'Gasto'}${d.fecha ? ' · ' + fechaTxt(d.fecha) : ''}${d.monto ? ' · ' + pesos(d.monto) : ''}`, texto: d.combinacion ? (d.documentos || []).join(' · ') : d.sinFactura ? 'sin factura' : '' });
  const fPago = [...new Set(gs.map(g => g.fechaPago).filter(Boolean))].map(fechaTxt);
  if (!fPago.length && c.accion === 'vencimientos') fPago.push(fechaTxt(c.fecha));
  const quien = c.estado === 'POR_REVISAR' ? 'Todavía por revisar.' : (c.resueltoPor || c.resueltoEl) ? `Resuelto ${quienCuando(c.resueltoPor, c.resueltoEl)}.` : '';
  return { clave: 'cc:' + s(c.id), mov, estado: { texto: est[0], tono: est[1] }, resolucion: res, docs: { titulo: c.accion === 'vencimientos' ? 'Los vencimientos' : 'Lo registrado', filas }, fechaPago: fPago.join(' · '), quien };
}
