// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Gastos (nuevo, desde cero)  v0.90.0 · Etapa 1: base y carga
//  Rutas: #gastos (Bandeja) · #gastos/cargas (lo que se subió). Cualquier otra ruta de Gastos (las del Gastos anterior) lleva a #gastos.
//  Etapa 1: subir las compras del SII, la cartola de BancoEstado (cuenta corriente y chequera) y el reporte de liberaciones de
//  Mercado Pago; ver los dos lados de la Bandeja (documentos y movimientos) y hasta dónde llega cada cuenta. Unir cada
//  documento con su pago llega en la Etapa 2.
//  La cartola de BancoEstado sigue pasando sus abonos a Ventas B2B → Conciliación, igual que antes.
//  H = ayudas de app.js: { esc, info, icono, registrar, mensajeError, pesos, diaTexto, cargarXLSX, B2b, Cartola }
// ═══════════════════════════════════════════════
import * as GN from './gn-modelo.js?v=0.95.0';
import * as GB from './gn-bandeja.js?v=0.95.0';
import * as AR from './areas.js?v=0.95.0';
import * as Sii from './sii.js?v=0.95.0';
import * as MP from './mercadopago.js?v=0.95.0';

const st = { D: null, B: null, err: '', msg: '', subiendo: false, cuenta: '', cargando: false, ocupado: false, sel: { d: [], m: [], primero: '' } };
const $ = id => document.getElementById(id);
const fsGN = () => import('./gn-fs.js?v=0.95.0');
const INICIO = () => (window.FEN_SIS && window.FEN_SIS.INICIO) || '2026-10-01';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = f => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`;
export const olvidar = () => { st.D = null; };

const TABS = [['bandeja', '', 'Bandeja'], ['proveedores', 'proveedores', 'Proveedores'], ['repartos', 'repartos', 'Repartos'], ['cargas', 'cargas', 'Archivos subidos']];   // v0.95.0
const hashDe = t => '#gastos' + (t === 'bandeja' ? '' : '/' + t);
const TXT_SUBIR = 'Sirven:\n• Las compras del SII: el XML de documentos recibidos, el Registro de Compras (.csv) o los Documentos recibidos (.xls).\n• La cartola de BancoEstado (.xlsx), histórica o en línea, de la cuenta corriente o de la chequera. Sus abonos siguen pasando a Ventas B2B → Conciliación.\n• El reporte de liberaciones de Mercado Pago (.csv).\n• Las boletas de luz (CGE) y agua (ESSBIO) en PDF: entran con su N° de cliente; el saldo anterior es de las boletas anteriores (súbalas también).\nSubir el mismo archivo dos veces no repite nada: cada documento se reconoce por RUT, tipo y folio, y cada movimiento por su línea exacta. Si la misma salida ya llegó en otra cartola (por ejemplo la en línea y después la histórica), no se guarda otra vez.\nLas guías de despacho no entran (no son compras: cuenta su factura).';
const TXT_BANDEJA = 'A la izquierda, lo que se debe: los documentos de compra desde el inicio del sistema. A la derecha, lo que salió: los movimientos de cada cuenta.\nEn la Etapa 2 la Bandeja propone qué documento va con qué movimiento, y se confirma con un toque.\nLos traspasos entre cuentas propias (por ejemplo, el retiro de Mercado Pago a BancoEstado) no son gasto: se muestran aparte.';
const TXT_ANTERIOR = 'Facturas anteriores al inicio del sistema (hasta un año antes). Si se pagan desde el inicio en adelante, son "deuda anterior": su pago no cuenta como gasto del mes nuevo.\n"Es de este documento" (en un movimiento) también las busca. Las que tienen el mismo monto que un cargo aparecen solas en Para confirmar.';
const TXT_ANTIGUA = 'VENTAS y B2C (sin local) ya no se usan en el Gastos nuevo: el costo de atender clientes en tienda va al local que corresponde, B2C-BA (Tienda Barros Arana) o B2C-AI (Sala de ventas Ainavillo). Así se ve el margen de cada tienda.\nCambie la clasificación de estos documentos; si el proveedor lo recuerda, cámbielo también en su ficha (Proveedores).';
const TXT_REPARTOS = 'Un reparto es una forma fija de dividir un gasto entre áreas, con nombre propio (por ejemplo, Ainavillo común). Se define una vez y se elige al clasificar o en la ficha del proveedor.\nSi un reparto cambia, rige para lo que viene: lo ya pagado queda como estaba, y se ofrece aplicarlo también a lo pagado del mes abierto. Los meses cerrados no cambian.';
const TXT_FICHA = 'Todo lo que el sistema sabe de este proveedor: su clasificación (y si recuerda ítem y áreas o solo el ítem), sus servicios por N° de cliente, los productos que recuerda y cómo aparece en el banco. Lo que cambie aquí rige para sus facturas sin pagar; las pagadas quedan como estaban.';
const TXT_ELEGIR = 'Marque una o varias facturas y aquí aparecen los cargos que pueden ser su pago, para la suma de lo que falta pagar (al revés también: marque un cargo y aparecen sus posibles facturas). Primero los que calzan, después los de las fechas probables y los del proveedor.\nSe puede unir una factura con varios cargos (un pago en partes) o varias facturas con un cargo. Varios con varios no: únalos en dos pasos.\nLos pares descartados con "No es este" aparecen al final, por si sí era.';
const TXT_CARGOS_ANT = 'Cargos de los 20 días antes del inicio. Entran solo para unirse con facturas desde el inicio (por ejemplo, un abono de septiembre de una factura de octubre). No cuentan como salida de plata del mes nuevo.\nAl unir uno, el sistema revisa si ese pago ya está en el Gastos anterior, para no contarlo dos veces.';
const TXT_INICIO = 'Gastos parte desde cero. Lo anterior a esta fecha no entra, salvo las facturas, que quedan aparte como deuda anterior. El Gastos anterior no se borró: sus datos siguen guardados en la base.';

function cab(H, tab) {
  return `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Lo que se debe y lo que salió, desde el ${H.esc(fechaLarga(INICIO()))} ${H.info('Desde cero', TXT_INICIO)}</p></div>
    </div>
    <nav class="pestanas" role="tablist" aria-label="Pestañas de Gastos">${TABS.map(([k, , t]) => `<a role="tab" href="${hashDe(k)}" aria-selected="${k === tab}">${t}</a>`).join('')}</nav>
    <div class="gn-drop${st.subiendo ? ' gn-drop-ocupado' : ''}" data-gn-drop>
      <label class="gn-drop-zona" for="gn-archivo">
        <span class="gn-drop-ic">${H.icono('subir', 26)}</span>
        <span class="gn-drop-txt"><b>${st.subiendo ? H.esc(st.subiendo === true ? 'Leyendo el archivo…' : st.subiendo) : '<span class="gn-pc">Arrastre aquí los archivos</span><span class="gn-cel">Toque para elegir los archivos</span>'}</b>
          <small>${st.subiendo ? 'No cierre esta pestaña' : '<span class="gn-pc">o haga clic para elegirlos · puede soltar varios a la vez</span><span class="gn-cel">Puede elegir varios a la vez</span>'}</small></span>
        <span class="gn-drop-tipos"><span>SII</span><span>BancoEstado</span><span>Mercado Pago</span><span>Luz y agua</span></span>
      </label>
      ${H.info('Subir archivo', TXT_SUBIR)}
      <input type="file" id="gn-archivo" class="sr" multiple accept=".xml,.csv,.txt,.xls,.xlsx,.html,.pdf" ${st.subiendo ? 'disabled' : ''}>
    </div>
    <div id="gn-msg" role="status" aria-live="polite">${st.err ? `<p class="error" role="alert">${st.err}</p>` : ''}${st.msg ? `<div class="aviso gn-aviso">${st.msg}</div>` : ''}</div>`;
}

export async function pintar(el, sub, H) {
  const tab = ['cargas', 'proveedores', 'repartos'].includes(sub) ? sub : 'bandeja';
  if (sub && tab === 'bandeja') { location.replace('#gastos'); return; }
  if (!st.D) {
    el.innerHTML = cab(H, tab) + '<section class="tarjeta"><div class="vacio" style="border:0">Cargando Gastos…</div></section>';
    conectar(el, H);
    try { st.D = await (await fsGN()).leer(); }
    catch (e) { el.innerHTML = cab(H, tab) + `<section class="tarjeta"><p class="error" role="alert">${H.esc(e.message || H.mensajeError(e))}</p>${e.code === 'sin_base' ? '<p class="ayuda">La conexión con la base de Gastos se hace en Configuración → Conexiones.</p>' : ''}</section>`; conectar(el, H); return; }
    if (!enGastos()) return;
  }
  const clave = decodeURIComponent((location.hash || '').split('/')[2] || '');
  const lugar = tab + '/' + clave; if (st.lugar && st.lugar !== lugar) { st.msg = ''; st.err = ''; } st.lugar = lugar;   // el aviso es de la pantalla donde se hizo
  el.innerHTML = cab(H, tab) + (tab === 'cargas' ? cargasHtml(H) : tab === 'repartos' ? repartosHtml(H) : tab === 'proveedores' ? (clave ? fichaHtml(H, clave) : proveedoresHtml(H)) : bandejaHtml(H));
  conectar(el, H);
}
const enGastos = () => (location.hash || '').replace('#', '').split('/')[0] === 'gastos';
const subActual = () => ((location.hash || '').split('/')[1] || '');

// ── Bandeja (v0.91.0 · Etapa 2: une cada documento con su pago) ──
const TXT_PARES = 'El documento y el movimiento del mismo monto (hasta $5 de diferencia), con la fecha del pago entre 20 días antes y 60 días después del documento.\nEn verde, los seguros: el RUT o el nombre del proveedor está en la glosa del banco, la glosa ya se confirmó antes con ese proveedor ("glosa conocida"), o son varios documentos del mismo proveedor que suman justo el pago. En amarillo, los que calzan solo por el monto: revíselos antes de confirmar.\nAl confirmar, el proveedor aprende cómo aparece en el banco. Si se aprendió mal, "Olvidar esta glosa". Deshacer el pago también la olvida.\nConfirmar crea el pago. Se puede deshacer en "Listos".';
const TXT_CLASIF = 'Un documento está listo cuando tiene su pago y su clasificación (ítem y área). Aquí quedan los que ya tienen su pago y todavía no su ítem.\nUna factura con cosas distintas se separa por líneas (o por montos, si no trae detalle). Lo que elija queda recordado en el proveedor, también por producto: sus próximas facturas llegan clasificadas.\n"Sugerido" viene del Gastos anterior: es solo una propuesta; nada se copia hasta que usted la usa. Antes de usarla, mire el detalle de la factura.';
const TXT_SINPAGO = 'Lo que se debe y todavía no tiene su pago. Si se pagó por el banco y el cargo ya llegó, use "¿Cómo se pagó?" → Con un cargo. Si se pagó en efectivo o con su plata, ahí mismo.\n"Esto no va": un documento repetido, que no es de la empresa o que no es una compra. No se borra.';
const TXT_SINDOC = 'Lo que salió de las cuentas y todavía no tiene su documento. "Es de este documento" lo une con una factura (también con la deuda anterior). "Registrar a mano": una boleta en papel o un pago sin documento. "No es gasto": traspaso entre sus cuentas, retiro suyo o pago de la tarjeta de crédito.';
const kPar = p => p.movId + '|' + p.docIds.join(',');
const POR_TXT = { rut: 'mismo monto y RUT en la glosa', glosa: 'mismo monto y glosa conocida', nombre: 'mismo monto y nombre en la glosa', monto: 'mismo monto', varios: 'varios documentos del mismo proveedor' };
function bandejaHtml(H) {
  const D = st.D, cob = GN.cobertura(D.movs, D.cargas);
  const B = st.B = GB.armar(D, { cuenta: st.cuenta }), pares = B.pares; st.antG = D.gastosAnt || [];
  const docDe = id => B.docs.find(d => d.id === id), movDe = id => B.movs.find(m => m.id === id);
  const cuentas = [['', 'Todas'], ...cob.map(c => [c.cuenta, c.nombre])];
  const nombreDoc = d => H.esc(d.razon || d.rut || 'Sin nombre');
  // v0.95.0 · De dónde vino: XML (trae el detalle) o RCV (Registro de Compras: sin detalle; subir su XML lo completa)
  const origenDoc = d => (d.origen === 'boleta' ? ' · PDF' + (d.saldoAnterior ? ` · trae saldo anterior ${H.pesos(d.saldoAnterior)}` : '') + (d.corte ? ` · <span class="gn-corte">corte ${d.corte.desde ? 'desde el ' + H.esc(H.diaTexto(d.corte.desde)) : 'en trámite'}</span>` : '') : d.origen !== 'sii' ? '' : (d.detalle || []).length ? ' · XML' : d.formato === 'registro' ? ' · RCV, sin detalle' : ' · sin detalle');
  const lineaDoc = d => `${H.esc(d.tipoTexto)}${d.folio ? ' N° ' + H.esc(d.folio) : ''} · ${H.esc(H.diaTexto(d.fecha))}${d.vence && d.vence !== d.fecha ? ` · vence ${H.esc(H.diaTexto(d.vence))}` : ''}${d.nc && (d.referencias || []).length ? ` · corrige la N° ${H.esc(d.referencias.map(r => r.folio).join(', '))}` : ''}${d.cliente ? ` · cliente ${H.esc(d.cliente)}${d.direccion ? ' · ' + H.esc(d.direccion) : ''}` : ''}${d.periodo ? ` · período ${H.esc(H.diaTexto(d.periodo.desde))} al ${H.esc(H.diaTexto(d.periodo.hasta))}` : ''}${d.anterior ? ' · deuda anterior' : ''}${origenDoc(d)}`;
  // v0.92.0 · La clasificación de cada documento a la vista (con su detalle), y sus botones, en la misma tarjeta donde esté
  const bt = (attr, txt, pri) => `<button type="button" class="${pri ? 'btn btn-chico' : 'btn-sec btn-chico'}" ${attr}>${txt}</button>`;
  const sugOk = d => d.sugerida && (d.sugerida.areas || []).length;
  // v0.92.3 · Verde con visto: lo que usted guardó (en el documento o en su proveedor). Rojo: lo que falta decidir (sugerido, sin clasificar, falta el área)
  const visto = '<svg class="gn-visto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const clasTxt = d => (d.clasifEf ? `<span class="gn-cl">${visto}${H.esc(GB.textoPartes(d.clasifEf.partes))}${d.clasifEf.de === 'proveedor' ? ' <span class="gn-cl-de">(como siempre)</span>' : ''}</span>`
    : d.soloItem ? `<span class="gn-cl gn-cl-falta">${H.esc(d.soloItem)} · falta el área</span>`
    : sugOk(d) ? `<span class="gn-cl gn-cl-falta">Sugerido: ${H.esc(d.sugerida.item)} · ${H.esc(GB.textoReparto(d.sugerida.areas))}</span>` : '<span class="gn-cl gn-cl-falta">Sin clasificar</span>');
  const detHtml = d => ((d.detalle || []).length ? `<details class="gn-detalle"><summary>Ver detalle (${d.detalle.length} ${d.detalle.length === 1 ? 'línea' : 'líneas'})</summary><ul>${d.detalle.map(x => `<li><span>${H.esc(x.descripcion)}${x.cantidad ? ` · ${H.esc(String(x.cantidad).replace('.', ','))}${x.unidad ? ' ' + H.esc(x.unidad) : ''}` : ''}</span><span class="gn-m">${H.pesos(x.monto)}</span></li>`).join('')}</ul></details>` : '');
  const clasBtns = d => d.estado === 'no_va' ? '' : d.clasifEf ? bt(`data-gn-clasif="${H.esc(d.id)}"`, 'Cambiar clasificación')
    : d.soloItem ? bt(`data-gn-clasif="${H.esc(d.id)}"`, 'Elegir el área')
    : sugOk(d) ? bt(`data-gn-usar="${H.esc(d.id)}"`, 'Usar lo sugerido') + bt(`data-gn-clasif="${H.esc(d.id)}"`, 'Clasificar') : bt(`data-gn-clasif="${H.esc(d.id)}"`, 'Clasificar');
  // v0.95.0 · Elegir (seleccionar y filtrar): la casilla va en lo que se puede unir (documentos con saldo, cargos con algo libre)
  const selD = new Set(st.sel.d), selM = new Set(st.sel.m), movsSel = st.sel.m.map(movDe).filter(Boolean), docsSel = st.sel.d.map(docDe).filter(Boolean);
  const puedeD = d => selD.has(d.id) || ((st.sel.m.length <= 1 || st.sel.d.length === 0) && movsSel.every(m => GB.compatible(d, m)) && !(st.sel.m.length > 1 && st.sel.d.length >= 1));
  const puedeM = m => selM.has(m.id) || (!(st.sel.d.length > 1 && st.sel.m.length >= 1) && docsSel.every(d => GB.compatible(d, m)));
  const casilla = (tipo, id, on, ok, quien) => `<label class="gn-elegir"><input type="checkbox" data-gn-sel-${tipo}="${H.esc(id)}" ${on ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="Elegir ${H.esc(quien)}"></label>`;
  const docFila = (d, acc, elegible) => `<div class="gn-it${d.nc ? ' gn-nc' : ''}${selD.has(d.id) ? ' gn-elegido' : ''}" data-gn-doc="${H.esc(d.id)}"><div class="gn-fila">${elegible && d.saldo > 0 ? casilla('d', d.id, selD.has(d.id), puedeD(d), nom(d)) : ''}<b>${nombreDoc(d)}</b><span class="gn-m">${H.pesos(d.estadoPago === 'a_medias' ? d.saldo : d.total)}</span></div>
      <small>${lineaDoc(d)}${d.estadoPago === 'a_medias' ? ` · falta de ${H.pesos(d.total)}` : ''}</small>${clasTxt(d)}${detHtml(d)}${acc ? `<div class="gn-acc">${acc}</div>` : ''}</div>`;
  const movFila = (m, acc, elegible) => `<div class="gn-it${selM.has(m.id) ? ' gn-elegido' : ''}" data-gn-mov="${H.esc(m.id)}"><div class="gn-fila">${elegible && m.libre > 0 ? casilla('m', m.id, selM.has(m.id), puedeM(m), m.glosa) : ''}<b>${H.esc(m.glosa)}</b><span class="gn-m">${H.pesos(m.libre > 0 && m.libre !== m.monto ? m.libre : m.monto)}</span></div>
      <small>${H.esc(GN.CUENTAS[m.cuenta] || m.cuenta)} · ${H.esc(H.diaTexto(m.fecha))}${m.hora ? ' ' + H.esc(m.hora) : ''}${m.libre > 0 && m.libre !== m.monto ? ` · queda libre de ${H.pesos(m.monto)}` : ''}${m.naturaleza ? ' · ' + H.esc(GB.NO_GASTO[m.naturaleza] || m.naturaleza) : ''}${m.anterior ? ' · anterior al inicio' : ''}</small>${acc ? `<div class="gn-acc">${acc}</div>` : ''}</div>`;
  const accDoc = d => d.nc ? bt(`data-gn-nc="${H.esc(d.id)}"`, 'Descontar de su factura', true) + clasBtns(d) + bt(`data-gn-nova="${H.esc(d.id)}"`, 'Esto no va')
    : bt(`data-gn-como="${H.esc(d.id)}"`, '¿Cómo se pagó?', true) + clasBtns(d) + bt(`data-gn-nova="${H.esc(d.id)}"`, 'Esto no va');
  const accMov = m => bt(`data-gn-esde="${H.esc(m.id)}"`, 'Es de este documento', true) + bt(`data-gn-mano="${H.esc(m.id)}"`, 'Registrar a mano') + bt(`data-gn-nogasto="${H.esc(m.id)}"`, 'No es gasto');
  const parHtml = p => { const m = movDe(p.movId), ds = p.docIds.map(docDe).filter(Boolean);
    const sena = p.por === 'glosa' ? GB.senaDe(m.glosa) : '';
    return `<div class="gn-par${p.por === 'monto' ? '' : ' gn-par-seguro'}" data-gn-par="${H.esc(kPar(p))}"><div class="gn-par-lados"><div class="gn-par-l">${ds.map(d => `<div><b>${nombreDoc(d)}</b> <span class="gn-m">${H.pesos(d.saldo)}</span><small>${lineaDoc(d)}</small>${clasTxt(d)}${detHtml(d)}${d.clasifEf ? '' : `<div class="gn-acc">${clasBtns(d)}</div>`}</div>`).join('')}</div>
      <div class="gn-par-r"><b>${H.esc(m.glosa)}</b> <span class="gn-m">${H.pesos(m.libre)}</span><small>${H.esc(GN.CUENTAS[m.cuenta] || m.cuenta)} · ${H.esc(H.diaTexto(m.fecha))}${m.anterior ? ' · anterior al inicio' : ''}</small></div></div>
      <div class="gn-par-pie"><span class="gn-par-por">${POR_TXT[p.por]}${sena ? ` (${H.esc(sena)})` : ''}${p.dif ? ` · diferencia de ${H.pesos(Math.abs(p.dif))}` : ''}${sena ? ` <button type="button" class="gn-link" data-gn-olvidar="${H.esc(GB.claveProveedor(ds[0]))}" data-sena="${H.esc(sena)}">Olvidar esta glosa</button>` : ''}</span><div class="gn-acc">${bt(`data-gn-confirmar="${H.esc(kPar(p))}"`, p.faltaClasif ? 'Clasificar y confirmar' : 'Confirmar', true)}${bt(`data-gn-noeseste="${H.esc(kPar(p))}"`, 'No es este')}</div></div></div>`; };
  const seguros = pares.filter(p => p.por !== 'monto' && !p.faltaClasif && !(movDe(p.movId) || {}).anterior);
  const clasifHtml = d => docFila(d, clasBtns(d));
  const listos = B.listosD.slice(0, 60);
  const pagoTxt = p => p.movId ? `${H.esc(GN.CUENTAS[p.cuenta] || p.cuenta || 'Banco')} ${H.esc(H.diaTexto(p.fecha))}` : `${H.esc((p.medio === 'nc' ? 'Nota de crédito' : GB.MEDIOS[p.medio] || p.medio))} ${H.esc(H.diaTexto(p.fecha))}`;
  const listoHtml = d => docFila(d, d.estado === 'no_va' ? `<span class="gn-sug">Esto no va: ${H.esc(GB.MOTIVOS_NO_VA[(d.noVa || {}).motivo] || '')}${(d.noVa || {}).nota ? ' · ' + H.esc(d.noVa.nota) : ''}</span>${bt(`data-gn-volverdoc="${H.esc(d.id)}"`, 'Volver a la Bandeja')}`
    : d.pagos.map(p => `<span class="gn-sug">Pagado: ${H.pesos(p.monto)} · ${pagoTxt(p)}</span>${bt(`data-gn-deshacer="${H.esc(p.id)}"`, 'Deshacer el pago')}`).join('') + clasBtns(d));   // v0.92.2: también se cambia la clasificación
  // v0.95.0 · Filtrar: lo elegido primero manda; el otro lado muestra sus posibles (lo elegido de ese lado, arriba)
  const filtraMovs = st.sel.primero === 'd' && docsSel.length > 0, filtraDocs = st.sel.primero === 'm' && movsSel.length > 0;
  const posMovs = filtraMovs ? movsSel.map(m => ({ m, calza: false, dentro: true, desc: false })).concat(GB.posiblesMovs(docsSel, B.abiertosM.filter(m => !selM.has(m.id) && (!st.cuenta || m.cuenta === st.cuenta)), B.S).slice(0, 20)) : [];
  const posDocs = filtraDocs ? docsSel.map(d => ({ d, calza: false, dentro: true, desc: false })).concat(GB.posiblesDocs(movsSel, B.abiertosD.filter(d => !selD.has(d.id)), B.S).slice(0, 20)) : [];
  const barraSel = () => { if (!docsSel.length && !movsSel.length) return '';
    const b = GB.balance(docsSel, movsSel), n = (x, s1, p1) => `${x} ${x === 1 ? s1 : p1}`;
    const estado = !docsSel.length || !movsSel.length ? `Elija también ${docsSel.length ? 'el cargo' : 'el documento'}.` : !b.valido ? 'Varios documentos con varios cargos: únalos en dos pasos.'
      : b.calza ? 'Calza.' : b.dif < 0 ? `Falta ${H.pesos(-b.dif)}: ${docsSel.length > 1 ? 'el último documento' : 'el documento'} queda pagado en parte.` : `Sobran ${H.pesos(b.dif)}: quedan libres en el cargo.`;
    return `<div class="gn-barra-sel" role="region" aria-label="Lo elegido"><div class="gn-barra-t"><span>${n(docsSel.length, 'documento', 'documentos')} · ${H.pesos(b.td)}</span><span>${n(movsSel.length, 'cargo', 'cargos')} · ${H.pesos(b.tm)}</span><b class="${b.valido && b.calza ? 'gn-ok' : ''}">${estado}</b></div>
      <div class="gn-acc"><button type="button" class="btn btn-chico" data-gn-unir ${b.valido ? '' : 'disabled'}>Unir</button><button type="button" class="btn-sec btn-chico" data-gn-limpiar>Limpiar</button></div></div>`; };
  return `<section class="tarjeta" aria-labelledby="t-gn-cob"><div class="titulo-fila"><h2 id="t-gn-cob">Hasta dónde llega cada cuenta</h2></div>
      ${cob.length ? `<div class="gn-cob">${cob.map(c => `<div class="gn-cob-c"><b>${H.esc(c.nombre)}</b><span>${H.esc(H.diaTexto(c.desde))} al ${H.esc(H.diaTexto(c.hasta))} · ${c.n} ${c.n === 1 ? 'movimiento' : 'movimientos'}</span></div>`).join('')}</div>` : '<p class="ayuda">Todavía no se sube ninguna cartola.</p>'}</section>
    <section class="tarjeta" aria-labelledby="t-gn-bandeja"><div class="titulo-fila"><h2 id="t-gn-bandeja">Bandeja</h2><span>${pares.length + B.n.clasificar + B.n.sinPago + B.n.sinDoc} por hacer</span></div>
      ${cuentas.length > 2 ? `<div class="gn-filtro" role="group" aria-label="Cuenta">${cuentas.map(([k, t]) => `<button type="button" class="chip ${st.cuenta === k ? 'c-verde' : 'c-gris'}" data-gn-cuenta="${k}" aria-pressed="${st.cuenta === k}">${H.esc(t)}</button>`).join('')}</div>` : ''}
      <div class="gn-grupo" id="gn-pares"><div class="gn-grupo-t"><h3>Para confirmar · ${pares.length} ${H.info('Para confirmar', TXT_PARES)}</h3>${seguros.length > 1 ? `<button type="button" class="btn btn-chico gn-btn-seguro" data-gn-confirmar-seguros>Confirmar los ${seguros.length} en verde ya clasificados</button>` : ''}</div>
        ${pares.length ? pares.map(parHtml).join('') : '<div class="vacio">Nada por confirmar.</div>'}</div>
      ${B.conAreaAntigua.length ? `<div class="gn-grupo" id="gn-antiguas"><div class="gn-grupo-t"><h3>Con área antigua · ${B.conAreaAntigua.length} ${H.info('Área antigua', TXT_ANTIGUA)}</h3></div>${B.conAreaAntigua.map(d => docFila(d, bt(`data-gn-clasif="${H.esc(d.id)}"`, 'Cambiar clasificación', true))).join('')}</div>` : ''}
      ${B.porClasificar.length ? `<div class="gn-grupo" id="gn-clasificar"><div class="gn-grupo-t"><h3>Pagados, falta clasificar · ${B.porClasificar.length} ${H.info('Pagados, falta clasificar', TXT_CLASIF)}</h3>${B.porClasificar.filter(sugOk).length > 1 ? bt('data-gn-usar-todas', `Usar lo sugerido en ${B.porClasificar.filter(sugOk).length}`) : ''}</div>${B.porClasificar.map(clasifHtml).join('')}</div>` : ''}
      <div class="gn-lados" id="gn-lados">
        <div class="gn-lado">${filtraDocs ? `<div class="gn-lado-t">Documentos posibles para ${movsSel.length === 1 ? 'el cargo elegido' : 'los cargos elegidos'} ${H.info('Elegir', TXT_ELEGIR)}</div>${posDocs.map(x => docFila(x.d, x.desc ? '<span class="chip c-gris chip-chico">descartado antes</span>' : x.calza ? '<span class="chip c-verde chip-chico">calza</span>' : (!x.dentro ? '<span class="gn-sug">fuera de las fechas</span>' : ''), true)).join('') || '<div class="vacio">Ningún documento con saldo para esto.</div>'}`
          : `<div class="gn-lado-t">Documentos sin pago · ${B.sinPago.length} ${H.info('Documentos sin pago', TXT_SINPAGO)}</div>
          ${B.sinPago.length ? B.sinPago.map(d => docFila(d, accDoc(d), true)).join('') : `<div class="vacio">${D.docs.length ? 'Todos los documentos tienen su pago.' : 'Todavía no hay documentos. Suba las compras del SII.'}</div>`}
          ${B.anteriores.length ? `<details class="gn-det"${B.anteriores.some(d => selD.has(d.id)) ? ' open' : ''}><summary>${B.anteriores.length} de deuda anterior sin pago ${H.info('Deuda anterior', TXT_ANTERIOR)}</summary>${B.anteriores.map(d => docFila(d, accDoc(d), true)).join('')}</details>` : ''}`}</div>
        <div class="gn-lado">${filtraMovs ? `<div class="gn-lado-t">Cargos posibles para ${docsSel.length === 1 ? 'el documento elegido' : 'los documentos elegidos'} ${H.info('Elegir', TXT_ELEGIR)}</div>${posMovs.map(x => movFila(x.m, x.desc ? '<span class="chip c-gris chip-chico">descartado antes</span>' : x.calza ? '<span class="chip c-verde chip-chico">calza</span>' : (!x.dentro ? '<span class="gn-sug">fuera de las fechas</span>' : ''), true)).join('') || '<div class="vacio">Ningún cargo libre para esto.</div>'}`
          : `<div class="gn-lado-t">Movimientos sin documento · ${B.sinDoc.length} ${H.info('Movimientos sin documento', TXT_SINDOC)}</div>
          ${B.sinDoc.length ? B.sinDoc.map(m => movFila(m, accMov(m), true)).join('') : `<div class="vacio">${D.movs.length ? 'Todos los movimientos tienen su documento.' : 'Todavía no hay movimientos. Suba la cartola o el reporte de Mercado Pago.'}</div>`}
          ${B.movsAnteriores.length ? `<details class="gn-det"${B.movsAnteriores.some(m => selM.has(m.id)) ? ' open' : ''}><summary>${B.movsAnteriores.length} ${B.movsAnteriores.length === 1 ? 'cargo anterior' : 'cargos anteriores'} al inicio sin documento ${H.info('Cargos anteriores', TXT_CARGOS_ANT)}</summary>${B.movsAnteriores.map(m => movFila(m, accMov(m), true)).join('')}</details>` : ''}`}
          ${filtraMovs ? '' : B.noGasto.length ? `<details class="gn-det"><summary>${B.noGasto.length} que no son gasto (traspasos, retiros, tarjeta)</summary>${B.noGasto.map(m => movFila(m, bt(`data-gn-volvermov="${H.esc(m.id)}"`, 'Volver a la Bandeja'))).join('')}</details>` : ''}</div>
      </div>
      ${barraSel()}
      ${listos.length ? `<details class="gn-det gn-listos"><summary>Listos · ${B.listosD.length} (pagados o "esto no va")</summary>${listos.map(listoHtml).join('')}${B.listosD.length > 60 ? `<p class="ayuda">Y ${B.listosD.length - 60} más antiguos.</p>` : ''}</details>` : ''}
    </section>`;
}

// ── Archivos subidos ──
function cargasHtml(H) {
  const K = st.D.cargas, nombre = { sii: 'Compras del SII', bancoestado: 'Cartola BancoEstado', mercadopago: 'Mercado Pago' };
  return `<section class="tarjeta" aria-labelledby="t-gn-cargas"><div class="titulo-fila"><h2 id="t-gn-cargas">Archivos subidos</h2><span>${K.length}</span></div>
    ${K.length ? K.map(k => `<div class="gn-carga"><div class="gn-fila"><b>${H.esc(nombre[k.tipo] || k.tipo)}${k.desde ? ` · ${H.esc(H.diaTexto(k.desde))} al ${H.esc(H.diaTexto(k.hasta))}` : ''}</b><small>${H.esc(k.en || '')}</small></div>
      <small>${H.esc(k.archivo || '')}${k.identificador ? ' · ' + H.esc(k.identificador) : ''} · ${H.esc(k.por || '')}</small>
      <p>${H.esc(GN.textoCarga(k))}</p>
      ${(k.parecidosLista || []).length ? `<details class="gn-det"><summary>Ver lo que ya había llegado en otra cartola</summary>${k.parecidosLista.map(p => `<div class="gn-fila"><span>${H.esc(H.diaTexto(p.fecha))} · ${H.esc(p.glosa)}</span><span class="gn-m">${H.pesos(p.monto)}</span></div>`).join('')}</details>` : ''}</div>`).join('')
      : '<div class="vacio" style="border:0">Todavía no se sube ningún archivo.</div>'}</section>`;
}

// ── Eventos ──
function conectar(el, H) {
  const inp = el.querySelector('#gn-archivo');
  if (inp) inp.addEventListener('change', () => { const l = Array.from(inp.files || []); inp.value = ''; if (l.length) subir(l, el, H); });
  arrastrar(el, H);
  acciones(el, H);
  const bp = el.querySelector('#gn-buscar-prov');
  if (bp) bp.addEventListener('input', () => { st.buscaProv = bp.value; const pos = bp.selectionStart; pintar(el, subActual(), H).then(() => { const n = el.querySelector('#gn-buscar-prov'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }); });
  el.querySelectorAll('[data-gn-sel-d], [data-gn-sel-m]').forEach(x => x.addEventListener('change', () => elegir(el, H, x.dataset.gnSelD ? 'd' : 'm', x.dataset.gnSelD || x.dataset.gnSelM, x.checked)));
  el.querySelectorAll('[data-gn-cuenta]').forEach(b => b.addEventListener('click', () => { st.cuenta = b.dataset.gnCuenta; pintar(el, subActual(), H); }));
}
const repintar = (el, H) => { if (enGastos()) pintar(el, subActual(), H); };

// Arrastrar y soltar: un solo juego de escuchadores en la vista (la cabecera se vuelve a dibujar). Soltar fuera del recuadro, dentro
// de Gastos, también sirve (así el navegador no abre el archivo en la pestaña).
function arrastrar(el, H) {
  if (el.dataset.gnArrastre) return;
  el.dataset.gnArrastre = '1';
  let n = 0;
  const conArchivos = ev => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
  const marcar = on => { const z = el.querySelector('[data-gn-drop]'); if (z) z.classList.toggle('gn-drop-sobre', on); };
  el.addEventListener('dragenter', ev => { if (!conArchivos(ev) || !enGastos()) return; ev.preventDefault(); n++; marcar(true); });
  el.addEventListener('dragover', ev => { if (!conArchivos(ev) || !enGastos()) return; ev.preventDefault(); ev.dataTransfer.dropEffect = st.subiendo ? 'none' : 'copy'; });
  el.addEventListener('dragleave', ev => { if (!conArchivos(ev)) return; n = Math.max(0, n - 1); if (!n) marcar(false); });
  el.addEventListener('drop', ev => {
    if (!conArchivos(ev) || !enGastos()) return;
    ev.preventDefault(); n = 0; marcar(false);
    const l = Array.from(ev.dataTransfer.files || []);
    if (l.length && !st.subiendo) subir(l, el, H);
  });
}
// Uno o varios archivos, uno detrás de otro; cada uno con su resultado
async function subir(lista, el, H) {
  const L = Array.isArray(lista) ? lista : [lista], msgs = [], errs = [];
  st.err = ''; st.msg = '';
  for (let i = 0; i < L.length; i++) {
    st.subiendo = L.length > 1 ? `Leyendo ${i + 1} de ${L.length}: ${L[i].name}` : true; repintar(el, H);
    try { msgs.push(await procesar(L[i], H)); }
    catch (e) { errs.push(H.esc(`${L.length > 1 ? L[i].name + ': ' : ''}No se pudo cargar el archivo: ` + (e.message || H.mensajeError(e)))); }
    st.D = null;
  }
  st.subiendo = false; st.msg = msgs.join('<hr class="gn-sep">'); st.err = errs.join('<br>');
  repintar(el, H);
}
const ext = f => (String(f.name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
async function procesar(f, H) {
  const e = ext(f);
  if (f.size > 10 * 1024 * 1024) throw new Error('el archivo pesa más de 10 MB.');
  if (e === 'pdf') return subirBoleta(f, H);
  if (e === 'csv') {
    const txt = await f.text(), tipo = MP.tipoReporte(txt);
    if (tipo === 'liberaciones') return subirMP(f, txt, H);
    if (tipo === 'liquidaciones') throw new Error(MP.leer(txt).error);
    return subirSii(f, txt, H);
  }
  if (['xml', 'txt', 'html'].includes(e)) return subirSii(f, await f.text(), H);
  if (!['xls', 'xlsx'].includes(e)) throw new Error('no se reconoce ese archivo. Sirven las compras del SII (XML, CSV o XLS), la cartola de BancoEstado (.xlsx) y el reporte de liberaciones de Mercado Pago (.csv).');
  const XLSX = await H.cargarXLSX();
  let wb = null; try { wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true }); } catch (x) { wb = null; }
  if (wb) {
    const tefs = H.B2b.leerTransferencias(wb, XLSX);
    if (tefs) { const r = await H.B2b.guardarTransferencias(tefs); H.registrar('Cargó transferencias recibidas', `${r.leidas} leídas · ${r.nuevas} nuevas`); return `<b>Transferencias recibidas</b>: ${r.leidas} en el archivo · ${r.nuevas} nuevas. Sirven a Ventas B2B → Conciliación (quién pagó cada abono).`; }
    if (esCartola(wb, XLSX, H)) return subirCartola(f, wb, XLSX, H);
  }
  return subirSii(f, await f.text(), H);
}
function esCartola(wb, XLSX, H) {
  if (wb.SheetNames.includes('Movimientos') || wb.SheetNames.includes('Registros')) return true;
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).slice(0, 30);
  return filas.some(r => { const n = r.map(x => H.B2b.normCartola(x)); return n.includes('DESCRIPCION') && (n.some(x => /^CARGOS?$|CHEQUES CARGOS/.test(x)) || n.some(x => /^ABONOS?$|DEPOSITOS ABONOS/.test(x))); });
}
// v0.95.0 · Boleta de luz (CGE) o agua (ESSBIO) en PDF: el mismo lector del Gastos anterior; entra como documento con su N° de cliente
async function subirBoleta(f, H) {
  const [Pv, Bo] = await Promise.all([import('./previred.js?v=0.95.0'), import('./boletas.js?v=0.95.0')]);
  let lineas = null; try { lineas = await Pv.lineasDelPdf(f); } catch (x) { throw new Error('no se pudo leer el PDF.'); }
  const r = Bo.leerBoleta(lineas);
  if (!r.reconocida) throw new Error('ese PDF no es una boleta de luz (CGE) ni de agua (ESSBIO). Previred, liquidaciones y la tarjeta de crédito llegan después.');
  if (r.bloquea) throw new Error(`la boleta no se guardó. ${r.errores.join(' ')}`);
  const emp = Bo.EMPRESAS[r.empresa], id = GN.idCarga('boleta');
  const d = GN.docDeBoleta(r, { rut: emp.rut, nombre: emp.nombre, servicio: emp.servicio }, GN.direccionDeBoleta(lineas), id);
  const k = await (await fsGN()).cargarBoleta(d, { nombre: f.name, tamano: f.size });
  H.registrar('Gastos: cargó una boleta', `${d.razon} N° ${d.folio} · ${GN.textoCarga(k)}`);
  return `<b>Boleta de ${H.esc(emp.servicio)} ${H.esc(emp.nombre)}</b> N° ${H.esc(d.folio)} · cliente ${H.esc(d.cliente)} · ${H.pesos(d.total)}: ${H.esc(GN.textoCarga(k))}.`
    + (d.saldoAnterior ? `<br>Trae saldo anterior de ${H.pesos(d.saldoAnterior)} (total a pagar ${H.pesos(d.totalPagar)}): es lo que quedó sin pagar de boletas anteriores. Suba también esas boletas y el pago se une con todas.` : '')
    + (d.corte ? `<br><b>Aviso de corte${d.corte.desde ? ' desde el ' + H.esc(H.diaTexto(d.corte.desde)) : ' en trámite'}.</b>` : '')
    + (r.avisos.length ? '<br>' + H.esc(r.avisos.join(' ')) : '');
}
async function subirSii(f, txt, H) {
  const L = Sii.leer(txt);
  if (!L.facturas.length) throw new Error(L.omitidas && L.omitidas.length ? Sii.textoOmitidas(L.omitidas) + ' El archivo no trae facturas.' : 'no se reconocieron documentos. Revise que sea el XML, el Registro de Compras (.csv) o los Documentos recibidos (.xls) del SII.');
  const k = await (await fsGN()).cargarSii(L, { nombre: f.name, tamano: f.size });
  H.registrar('Gastos: cargó compras del SII', GN.textoCarga(k));
  return `<b>Compras del SII</b>${k.desde ? ` (${H.esc(H.diaTexto(k.desde))} al ${H.esc(H.diaTexto(k.hasta))})` : ''}: ${H.esc(GN.textoCarga(k))}.${L.omitidas.length ? '<br>' + H.esc(Sii.textoOmitidas(L.omitidas)) : ''}`;
}
async function subirMP(f, txt, H) {
  const L = MP.leer(txt);
  if (L.error) throw new Error(L.error);
  const id = GN.idCarga('mp'), movs = GN.movsDeMP(L, id);
  const k = await (await fsGN()).cargarMovs('mercadopago', movs, { id, archivo: f.name, tamano: f.size, desde: L.desde, hasta: L.hasta, identificador: `Liberaciones ${L.desde} al ${L.hasta}` });
  // Las ventas con tarjeta (Point) y su comisión real, por día: las sigue leyendo Finanzas (mp_ventas)
  let ventas = ''; const meses = MP.porMes(L.dias || {});
  if (meses.length) { try { await H.Cartola.ventasMP(L.dias, f.name); ventas = `<br>Ventas con tarjeta: ${meses.map(m => `${H.esc(m.mes)} ${H.pesos(m.bruto)}, comisión ${H.pesos(m.comision)}`).join(' · ')}.`; } catch (x) { ventas = `<br>Las ventas con tarjeta no se guardaron (${H.esc(x.message || H.mensajeError(x))}).`; } }
  H.registrar('Gastos: cargó Mercado Pago', GN.textoCarga(k));
  return `<b>Mercado Pago</b> (${H.esc(H.diaTexto(L.desde))} al ${H.esc(H.diaTexto(L.hasta))}): ${H.esc(GN.textoCarga(k))}.${ventas}`;
}
async function subirCartola(f, wb, XLSX, H) {
  const c = H.B2b.leerCartola(wb, XLSX), id = GN.idCarga('be'), movs = GN.movsDeCartola(c, id);
  const k = await (await fsGN()).cargarMovs('bancoestado', movs, { id, archivo: f.name, tamano: f.size, desde: c.desde, hasta: c.hasta, identificador: c.identificador });
  // Los abonos siguen yendo a Ventas B2B → Conciliación, como siempre
  let ab = '';
  try {
    const conf = await H.B2b.leerConfConciliacion();
    if (conf && conf.importado) { const a = await H.B2b.cargarCartola(c, conf); ab = `<br>Abonos (pagos de clientes): ${a.nuevos} ${a.nuevos === 1 ? 'nuevo' : 'nuevos'} en <a href="#b2b/conciliacion">Ventas B2B → Conciliación</a>.`; }
    else ab = '<br>Abonos: la conciliación de Ventas B2B todavía no se empieza.';
  } catch (x) { ab = `<br>Abonos: no se pudieron pasar a Ventas B2B (${H.esc(x.message || H.mensajeError(x))}).`; }
  H.registrar('Gastos: cargó cartola', `${c.identificador} · ${GN.textoCarga(k)}`);
  return `<b>${H.esc(c.identificador)}</b>: ${H.esc(GN.textoCarga(k))}.${ab}`;
}

// ═══════════════ v0.91.0 · Etapa 2: acciones de la Bandeja ═══════════════
const TXT_COMO = 'Con un cargo: el pago está en la cartola o en Mercado Pago (aparecen primero los del mismo monto y fecha cercana).\nEn efectivo: excepción; queda con su fecha y cuenta en el informe de pagos en efectivo.\nCon plata del dueño: lo pagó usted con su plata; queda como aporte del dueño, fuera del resultado, y no espera cartola.';
const TXT_NOVA = 'Repetido: el mismo documento ya está (por ejemplo, una factura que se emitió dos veces).\nNo es de la empresa: una compra personal con el RUT de la empresa.\nNo es una compra: un documento que no es gasto.\nNo se borra: queda en Listos con el motivo, y se puede volver a la Bandeja.';
const TXT_NOGASTO = 'Traspaso entre cuentas propias: de una cuenta de la empresa a otra (por ejemplo, de Mercado Pago a BancoEstado).\nRetiro del dueño: plata de la empresa para usted. Va fuera del resultado.\nPago de la tarjeta de crédito: lo que se paga a la tarjeta; las compras ya están en su estado de cuenta.\nNo se borra: se puede volver a la Bandeja.';
const TXT_MANO = 'Para lo que no tiene factura del SII: una boleta en papel o un pago sin documento (por ejemplo, el maestro o la feria). Nace el documento ya pagado con este movimiento.\nEl monto puede ser menor que el movimiento si el mismo pago cubre varias cosas: lo que sobra queda libre.';
const nombreArea = a => (AR.NOMBRE[a] ? `${AR.NOMBRE[a]} (${a})` : a);
function aviso(el, H, txt) { st.msg = txt; st.err = ''; st.D = null; repintar(el, H); }
function falla(dlg, e, H) { const er = dlg.querySelector('[data-err]'); if (er) er.textContent = e.message || H.mensajeError(e); const b = dlg.querySelector('[type=submit]'); if (b) b.disabled = false; }
async function hacer(el, H, fn, ok) {
  if (st.ocupado) return; st.ocupado = true;
  try { await fn(); aviso(el, H, ok); } catch (e) { st.err = H.esc(e.message || H.mensajeError(e)); st.msg = ''; st.D = null; repintar(el, H); }
  finally { st.ocupado = false; }
}
const B = () => st.B;
// Lo sugerido con varias áreas se recuerda como "solo el ítem" (el reparto cambia de una compra a otra); con una sola área, entero
const modoSug = sg => ((sg.areas || []).length > 1 ? 'item' : 'fijo');
const docDe = id => B().docs.find(d => d.id === id), movDe = id => B().movs.find(m => m.id === id);
const nom = d => d.razon || d.rut || 'Sin nombre';

function acciones(el, H) {
  if (el.dataset.gnAcc) return;
  el.dataset.gnAcc = '1';
  el.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('button'); if (!b || !enGastos() || !st.D) return;
    const ds = b.dataset;
    if (ds.gnConfirmar !== undefined) return confirmarPar(el, H, ds.gnConfirmar);
    if (ds.gnConfirmarSeguros !== undefined) return confirmarSeguros(el, H);
    if (ds.gnNoeseste) { const p = parDe(ds.gnNoeseste); if (!p) return; return hacer(el, H, async () => (await fsGN()).descartarPar(p.docIds, p.movId), 'Listo: ese par no se vuelve a proponer. Si después resulta que sí era, elija la factura y el cargo y use Unir.'); }
    if (ds.gnUnir !== undefined) return unirElegidos(el, H);
    if (ds.gnLimpiar !== undefined) { st.sel = { d: [], m: [], primero: '' }; return repintarQuieto(el, H); }
    if (ds.gnComo) return dlgComo(el, H, docDe(ds.gnComo));
    if (ds.gnNova) return dlgNoVa(el, H, docDe(ds.gnNova));
    if (ds.gnClasif) return dlgClasif(el, H, docDe(ds.gnClasif));
    if (ds.gnUsar) { const d = docDe(ds.gnUsar); return hacer(el, H, async () => (await fsGN()).clasificar(d, d.sugerida, modoSug(d.sugerida)), `Clasificado: ${H.esc(nom(d))} → ${H.esc(d.sugerida.item)}. Sus próximas facturas llegan así.`); }
    if (ds.gnUsarTodas !== undefined) return usarTodas(el, H);
    if (ds.gnNc) return dlgNC(el, H, docDe(ds.gnNc));
    if (ds.gnEsde) return dlgEsDe(el, H, movDe(ds.gnEsde));
    if (ds.gnMano) return dlgMano(el, H, movDe(ds.gnMano));
    if (ds.gnNogasto) return dlgNoGasto(el, H, movDe(ds.gnNogasto));
    if (ds.gnVolverdoc) return hacer(el, H, async () => (await fsGN()).volverDoc(ds.gnVolverdoc), 'El documento volvió a la Bandeja.');
    if (ds.gnVolvermov) return hacer(el, H, async () => (await fsGN()).volverMov(ds.gnVolvermov), 'El movimiento volvió a la Bandeja.');
    if (ds.gnDeshacer) return dlgDeshacer(el, H, ds.gnDeshacer);
    if (ds.gnReparto !== undefined) return dlgReparto(el, H, ds.gnReparto);
    if (ds.gnFicha) return dlgFicha(el, H, ds.gnFicha, ds.razon || '', ds.rut || '');
    if (ds.gnQuitarprod) return hacer(el, H, async () => (await fsGN()).quitarProducto(ds.gnQuitarprod, ds.prod), `Producto olvidado: ${H.esc(ds.prod)}.`);
    if (ds.gnOlvidar) return hacer(el, H, async () => (await fsGN()).olvidarSena(ds.gnOlvidar, ds.sena), `Olvidada la glosa "${H.esc(ds.sena)}": ya no cuenta como de ese proveedor.`);
  });
}
const parDe = k => st.B.pares.find(p => p.movId + '|' + p.docIds.join(',') === k);
async function confirmarPar(el, H, k) {
  const p = parDe(k); if (!p) return;
  const docs = p.docIds.map(docDe), partes = GB.repartirPago(docs, p.monto);
  if (!(await asegurarClasif(H, docs))) return;   // v0.92.0: listo = pagado y clasificado
  const ga = await revisarAnterior(H, movDe(p.movId), docs); if (ga === undefined) return;
  return hacer(el, H, async () => { await (await fsGN()).pagar({ partes, movId: p.movId, enGastoAnterior: ga }); H.registrar('Gastos: confirmó un pago', `${nom(docs[0])} · ${p.monto}`); }, `Pagado: ${H.esc(nom(docs[0]))}${docs.length > 1 ? ` (${docs.length} documentos)` : ''} · ${H.pesos(p.monto)}.`);
}
async function confirmarSeguros(el, H) {
  const l = st.B.pares.filter(p => p.por !== 'monto' && !p.faltaClasif && !(movDe(p.movId) || {}).anterior);   // v0.95.0: los cargos anteriores se revisan uno a uno
  return hacer(el, H, async () => { const F = await fsGN(); for (const p of l) await F.pagar({ partes: GB.repartirPago(p.docIds.map(docDe), p.monto), movId: p.movId }); H.registrar('Gastos: confirmó pagos', `${l.length} pares con RUT o nombre`); }, `Confirmados ${l.length} pagos con RUT o nombre en la glosa.`);
}
async function usarTodas(el, H) {
  const l = st.B.porClasificar.filter(d => d.sugerida && (d.sugerida.areas || []).length), hechos = new Set();
  return hacer(el, H, async () => { const F = await fsGN(); for (const d of l) { await F.clasificar(d, d.sugerida, hechos.has(GB.claveProveedor(d)) ? false : modoSug(d.sugerida)); hechos.add(GB.claveProveedor(d)); } }, `Clasificados ${l.length} documentos con lo sugerido.`);
}

// ¿Cómo se pagó? (una sola puerta: con un cargo, en efectivo, con plata del dueño)
async function dlgComo(el, H, d) {
  if (!(await asegurarClasif(H, [d]))) return;
  const hoy = new Date().toISOString().slice(0, 10), cand = GB.candidatosMov(d, st.B.abiertosM, st.B.S).slice(0, 40);
  const opc = cand.map(({ m, igual, dentro }, i) => `<label class="gn-opc" data-txt="${H.esc(GN.norm(m.glosa + ' ' + m.monto))}"><input type="radio" name="gc-mov" value="${H.esc(m.id)}" ${i === 0 && igual && dentro ? 'checked' : ''}><span><b>${H.esc(m.glosa)}</b> <span class="gn-m">${H.pesos(m.libre)}</span><small>${H.esc(GN.CUENTAS[m.cuenta] || m.cuenta)} · ${H.esc(H.diaTexto(m.fecha))}${igual ? ' · mismo monto' : ''}${dentro ? '' : ' · fuera de la ventana de fechas'}</small></span></label>`).join('');
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>¿Cómo se pagó?</h2>${H.info('Cómo se pagó', TXT_COMO)}</div>
    <p class="ayuda"><b>${H.esc(nom(d))}</b> · ${H.esc(d.tipoTexto)} ${H.esc(d.folio || '')} · ${H.pesos(d.saldo)} · ${H.esc(H.diaTexto(d.fecha))}</p>
    <div class="chips" role="radiogroup" aria-label="Medio">${Object.entries(GB.MEDIOS).map(([k, t], i) => `<label class="chip-radio"><input type="radio" name="gc-medio" value="${k}" ${i === 0 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
    <div data-gc="cargo" class="gn-dlg-bloque">${cand.length ? `<input type="search" data-gn-buscar placeholder="Buscar por glosa o monto" aria-label="Buscar movimiento"><div class="gn-opcs">${opc}</div>` : '<p class="ayuda">No hay movimientos libres. Suba la cartola o use otro medio.</p>'}</div>
    <div data-gc="otro" class="gn-dlg-bloque" hidden><div class="campo"><label for="gc-fecha">Fecha del pago</label><input id="gc-fecha" type="date" value="${H.esc(d.fecha <= hoy ? d.fecha : hoy)}" max="${hoy}"></div></div>
    <div class="campo"><label for="gc-nota">Nota (opcional)</label><input id="gc-nota" maxlength="200"></div>
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  const medio = () => dlg.querySelector('[name=gc-medio]:checked').value;
  dlg.querySelectorAll('[name=gc-medio]').forEach(r => r.addEventListener('change', () => { dlg.querySelector('[data-gc=cargo]').hidden = medio() !== 'cargo'; dlg.querySelector('[data-gc=otro]').hidden = medio() === 'cargo'; }));
  buscador(dlg); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const bt = dlg.querySelector('[type=submit]'); bt.disabled = true;
    try {
      const nota = dlg.querySelector('#gc-nota').value, F = await fsGN();
      if (medio() === 'cargo') {
        const r = dlg.querySelector('[name=gc-mov]:checked'); if (!r) throw new Error('Elija el movimiento.');
        const m = movDe(r.value), ga = await revisarAnterior(H, m, [d]); if (ga === undefined) { bt.disabled = false; return; }
        await F.pagar({ partes: GB.repartirPago([d], m.libre), movId: m.id, nota, enGastoAnterior: ga });
      } else {
        const f = dlg.querySelector('#gc-fecha').value; if (!GN.esIso(f)) throw new Error('Elija la fecha del pago.');
        await F.pagar({ partes: [{ docId: d.id, monto: d.saldo }], medio: medio(), fecha: f, nota });
      }
      dlg.close(); H.registrar('Gastos: registró un pago', `${nom(d)} · ${GB.MEDIOS[medio()]}`); aviso(el, H, `Pagado: ${H.esc(nom(d))} · ${H.esc(GB.MEDIOS[medio()].toLowerCase())}.`);
    } catch (e) { falla(dlg, e, H); }
  });
}
function buscador(dlg) {
  const q = dlg.querySelector('[data-gn-buscar]'); if (!q) return;
  q.addEventListener('input', () => { const t = GN.norm(q.value); dlg.querySelectorAll('.gn-opc').forEach(o => { o.hidden = !!t && !o.dataset.txt.includes(t); }); });
}
// Esto no va (un solo botón, tres motivos)
function dlgNoVa(el, H, d) {
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>Esto no va</h2>${H.info('Esto no va', TXT_NOVA)}</div>
    <p class="ayuda"><b>${H.esc(nom(d))}</b> · ${H.esc(d.tipoTexto)} ${H.esc(d.folio || '')} · ${H.pesos(d.total)}</p>
    <div class="chips" role="radiogroup" aria-label="Motivo">${Object.entries(GB.MOTIVOS_NO_VA).map(([k, t]) => `<label class="chip-radio"><input type="radio" name="nv-m" value="${k}"><span>${t}</span></label>`).join('')}</div>
    <div class="campo"><label for="nv-nota">Nota (opcional)</label><input id="nv-nota" maxlength="200" placeholder="Por ejemplo: es la misma que la N° 1234"></div>
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const r = dlg.querySelector('[name=nv-m]:checked'); if (!r) return falla(dlg, new Error('Elija el motivo.'), H);
    dlg.querySelector('[type=submit]').disabled = true;
    try { await (await fsGN()).noVa(d.id, r.value, dlg.querySelector('#nv-nota').value); dlg.close(); H.registrar('Gastos: esto no va', `${nom(d)} · ${GB.MOTIVOS_NO_VA[r.value]}`); aviso(el, H, `${H.esc(nom(d))}: ${H.esc(GB.MOTIVOS_NO_VA[r.value].toLowerCase())}. Queda en Listos.`); }
    catch (e) { falla(dlg, e, H); }
  });
}
// Ítem y reparto por área (lo usan Clasificar y Registrar a mano)
function camposClasif(H, pre, pref, sinItem) {
  const items = st.D.items || [], reps = Object.values(st.D.repartos || {}), rid = (pre && pre.repartoId) || '', areas = rid && st.D.repartos[rid] ? st.D.repartos[rid].areas : (pre && pre.areas) || [];
  return `${sinItem ? '' : `<div class="campo"><label for="${pref}-item">Ítem</label><input id="${pref}-item" list="${pref}-items" value="${H.esc((pre && pre.item) || '')}" autocomplete="off" placeholder="Escriba o elija"><datalist id="${pref}-items">${items.map(i => `<option value="${H.esc(i.item)}">`).join('')}</datalist></div>`}
    ${reps.length ? `<div class="campo"><label for="${pref}-reparto">Reparto</label><select id="${pref}-reparto" data-reparto><option value="">Elegir las áreas a mano</option>${reps.map(r => `<option value="${H.esc(r.id)}" ${r.id === rid ? 'selected' : ''}>${H.esc(r.nombre)} · ${H.esc(GB.textoReparto(r.areas))}</option>`).join('')}</select></div>` : ''}
    <fieldset class="campo"><legend>Área</legend><div class="chips" data-areas>${AR.GASTO_GN.map(a => `<label class="chip-radio"><input type="checkbox" value="${a}" ${areas.some(x => x.area === a) ? 'checked' : ''}><span>${H.esc(nombreArea(a))}</span></label>`).join('')}</div>
      <div class="gn-pcts" data-pcts></div><span class="ayuda">Con varias áreas, el reparto en %. Debe sumar 100.</span></fieldset>`;
}
function conectarClasif(dlg, H, pre, pref) {
  const items = st.D.items || [], pcts = dlg.querySelector('[data-pcts]'), prev = {}, rsel = dlg.querySelector('[data-reparto]');
  const rid0 = (pre && pre.repartoId) || '', ar0 = rid0 && st.D.repartos[rid0] ? st.D.repartos[rid0].areas : (pre && pre.areas) || [];
  ar0.forEach(a => { prev[a.area] = a.pct; });
  const elegidas = () => Array.from(dlg.querySelectorAll('[data-areas] input:checked')).map(x => x.value);
  const dibujar = () => { const l = elegidas(), ig = GB.repartoIgual(l); pcts.innerHTML = l.length > 1 ? l.map((a, i) => `<label class="gn-pct"><span>${H.esc(a)}</span><input type="number" min="1" max="100" step="1" data-pct="${a}" value="${prev[a] != null && l.length === Object.keys(prev).length ? prev[a] : ig[i].pct}" inputmode="numeric"><span>%</span></label>`).join('') : ''; };
  // v0.95.0 · Elegir un reparto marca sus áreas y porcentajes; tocar las áreas a mano lo deja en "a mano"
  dlg.querySelectorAll('[data-areas] input').forEach(x => x.addEventListener('change', () => { if (rsel) rsel.value = ''; dibujar(); })); dibujar();
  if (rsel) rsel.addEventListener('change', () => { const r = st.D.repartos[rsel.value]; if (!r) return; Object.keys(prev).forEach(k => delete prev[k]); r.areas.forEach(a => { prev[a.area] = a.pct; });
    dlg.querySelectorAll('[data-areas] input').forEach(x => { x.checked = r.areas.some(a => a.area === x.value); }); dibujar(); dlg.dispatchEvent(new Event('change')); });
  const it = dlg.querySelector(`#${pref}-item`);
  if (it) it.addEventListener('change', () => { const i = items.find(x => x.item === it.value); if (i && AR.GASTO_GN.includes(i.area) && !elegidas().length) { const c = dlg.querySelector(`[data-areas] input[value="${i.area}"]`); if (c) { c.checked = true; dibujar(); } } });
  return () => { const l = elegidas(); return { item: it ? it.value.trim() : '', repartoId: rsel ? rsel.value : '', areas: l.length === 1 ? [{ area: l[0], pct: 100 }] : l.map(a => ({ area: a, pct: Number((dlg.querySelector(`[data-pct="${a}"]`) || {}).value) || 0 })) }; };
}
function dlgClasif(el, H, d) {
  pedirClasif(H, d).then(r => { if (r) aviso(el, H, `Clasificado: ${H.esc(nom(d))} → ${H.esc(GB.textoPartes(r.partes))}.`); });
}
// v0.92.0 · Antes de pagar: cada documento clasificado. Abre la clasificación de los que faltan (uno por proveedor: si se recuerda,
// los demás del mismo proveedor quedan clasificados). → true si quedaron todos; false si se canceló.
async function asegurarClasif(H, docs) {
  const hechos = new Set();
  for (const d of docs) {
    if (!d || d.clasifEf || hechos.has(GB.claveProveedor(d))) continue;
    const r = await pedirClasif(H, d, true); if (!r) return false;
    if (r.recordar === 'fijo') hechos.add(GB.claveProveedor(d));   // en "solo el ítem", las otras facturas del proveedor piden su área
  }
  return true;
}
// La clasificación de un documento: toda la factura (ítem y áreas en %) o separada por líneas (con detalle) o por montos (sin detalle).
// → Promise: { partes, recordar } al guardar, o null si se cancela.
function pedirClasif(H, d, antesDePagar) {
  return new Promise(resolve => {
    const base = GB.baseDe(d), det = d.detalle || [], conLineas = det.length >= 2, c0 = d.clasifEf || null, sug = d.sugerida && (d.sugerida.areas || []).length ? d.sugerida : null;
    const prov = GB.provDe(d, st.D.provs || {}), prods = (prov && prov.productos) || {};
    const pre = c0 ? { item: c0.item, repartoId: c0.repartoId || '', areas: c0.areas && c0.areas.length ? c0.areas : [] } : d.soloItem ? { item: d.soloItem, areas: [] } : sug;
    const modo0 = prov ? GB.modoProveedor(prov) : '';
    const lineasPrev = c0 && c0.lineas && c0.lineas.length === det.length ? c0.lineas : null;
    const empezarSeparado = !!(lineasPrev || (conLineas && det.some(x => prods[GB.normProducto(x.descripcion)])) || (c0 && new Set((c0.partes || []).map(p => p.item)).size > 1));
    const items = st.D.items || [], repsL = Object.values(st.D.repartos || {}), areaSel = (v, k) => `<select data-${k} aria-label="Área"><option value="">Área</option>${k === 'la' && repsL.length ? `<optgroup label="Repartos">${repsL.map(r => `<option value="${GB.AREA_REPARTO}${H.esc(r.id)}" ${GB.AREA_REPARTO + r.id === v ? 'selected' : ''}>${H.esc(r.nombre)}</option>`).join('')}</optgroup><optgroup label="Un área">` : ''}${AR.GASTO_GN.map(a => `<option value="${a}" ${a === v ? 'selected' : ''}>${H.esc(a)}</option>`).join('')}${k === 'la' && repsL.length ? '</optgroup>' : ''}</select>`;
    const itemInp = (v, k) => `<input data-${k} list="cl-items" value="${H.esc(v || '')}" placeholder="Ítem" aria-label="Ítem" autocomplete="off">`;
    let idx = 0; const filaMonto = (x = {}) => `<div class="gn-sep-fila" data-parte="${idx++}"><input type="number" data-pm value="${x.monto || ''}" placeholder="Monto" aria-label="Monto" inputmode="numeric">${itemInp(x.item, 'pi')}${areaSel(x.area, 'pa')}<button type="button" class="gn-link" data-quitar>Quitar</button></div>`;
    const dlg = H.dialogo(`<form class="form-dialogo gn-dlg-ancho" novalidate><div class="titulo-fila"><h2>${antesDePagar ? 'Clasificar antes de confirmar' : 'Clasificar'}</h2>${H.info('Clasificar', TXT_CLASIF)}</div>
      <p class="ayuda"><b>${H.esc(nom(d))}</b> · ${H.esc(d.tipoTexto)} ${H.esc(d.folio || '')} · ${d.origen === 'boleta' ? 'total (sin crédito de IVA)' : 'neto'} ${H.pesos(base)}${sug && !c0 ? `<br>Sugerido por el Gastos anterior: ${H.esc(sug.item)} · ${H.esc(GB.textoReparto(sug.areas))}` : ''}</p>
      ${det.length ? `<div class="gn-det-dlg"><b>${d.origen === 'boleta' ? 'Detalle de la boleta (PDF)' : 'Detalle de la factura (XML)'}</b><ul>${det.map(x => `<li><span>${H.esc(x.descripcion)}${x.cantidad ? ` · ${H.esc(String(x.cantidad).replace('.', ','))}${x.unidad ? ' ' + H.esc(x.unidad) : ''}` : ''}</span><span class="gn-m">${H.pesos(x.monto)}</span></li>`).join('')}</ul></div>`
        : `<p class="ayuda gn-sin-det">${d.formato === 'registro' ? 'Esta factura vino del Registro de Compras (RCV): no trae el detalle. Si tiene su XML, arrástrelo a Gastos y se completa solo.' : 'Esta factura no trae detalle.'}</p>`}
      ${camposClasif(H, pre, 'cl')}
      <label class="gn-check"><input type="checkbox" id="cl-sep" ${empezarSeparado ? 'checked' : ''}> ${conLineas ? 'La factura trae cosas distintas: separar por líneas' : 'Separar en partes (por montos)'}</label>
      <div data-sep hidden>
        ${conLineas ? `<div class="gn-lineas">${det.map((x, i) => { const pr = (lineasPrev && lineasPrev[i]) || prods[GB.normProducto(x.descripcion)] || {};
          return `<div class="gn-sep-fila" data-linea="${i}"><span class="gn-lin-desc">${H.esc(x.descripcion)}<small>${x.cantidad ? H.esc(String(x.cantidad).replace('.', ',')) + (x.unidad ? ' ' + H.esc(x.unidad) : '') + ' · ' : ''}${H.pesos(x.monto)}</small></span>${itemInp(pr.item, 'li')}${areaSel(pr.area, 'la')}</div>`; }).join('')}</div>
          <p class="ayuda">Las líneas vacías toman lo de arriba (toda la factura).</p>`
        : `<div class="gn-montos" data-montos>${(c0 && (c0.partes || []).length > 1 ? c0.partes : [{}, {}]).map(filaMonto).join('')}</div><p><button type="button" class="btn-sec btn-chico" data-agregar>Agregar parte</button></p>`}
        <p class="ayuda" data-resumen></p>
      </div>
      <fieldset class="campo gn-recordar"><legend>Para las próximas facturas de este proveedor</legend>
        <label class="gn-opc"><input type="radio" name="cl-rec" value="fijo" ${modo0 !== 'item' ? 'checked' : ''}><span><b>Recordar ítem y áreas</b><small>Siempre se reparte igual (luz, agua, arriendo, o un proveedor de una sola área). La próxima factura llega clasificada.</small></span></label>
        <label class="gn-opc"><input type="radio" name="cl-rec" value="item" ${modo0 === 'item' ? 'checked' : ''}><span><b>Recordar solo el ítem</b><small>Las áreas cambian en cada compra. La próxima factura llega con el ítem y pide el área.</small></span></label>
        <label class="gn-opc"><input type="radio" name="cl-rec" value="no"><span><b>No recordar</b><small>Fue una compra excepcional.</small></span></label>
      </fieldset>
      <p class="error" data-err role="alert"></p>
      <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">${antesDePagar ? 'Guardar y seguir' : 'Guardar'}</button></div></form>`);
    let listo = false; dlg.addEventListener('close', () => { if (!listo) resolve(null); });
    const leerGen = conectarClasif(dlg, H, pre, 'cl'); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
    const sep = dlg.querySelector('#cl-sep'), caja = dlg.querySelector('[data-sep]'), resumen = dlg.querySelector('[data-resumen]');
    const generalPrimera = () => { const g = leerGen(); return { item: g.item, area: (g.areas[0] || {}).area || '' }; };
    const armar = () => {
      const g = leerGen();
      if (!sep.checked) return { general: g, partes: GB.partesSimple(base, g.item, g.areas), lineas: null };
      if (conLineas) {
        const asign = det.map((x, i) => { const f = dlg.querySelector(`[data-linea="${i}"]`), la = f.querySelector('[data-la]').value;   // v0.95.0: la línea vacía toma las áreas (o el reparto) de toda la factura
          // vacía: un área → esa; un reparto → el reparto (así se recuerda); varias áreas a mano → esas, en %
          const gArea = g.repartoId && st.D.repartos[g.repartoId] ? GB.AREA_REPARTO + g.repartoId : g.areas.length === 1 ? g.areas[0].area : '';
          return { item: f.querySelector('[data-li]').value.trim() || g.item, ...(la || gArea ? { area: la || gArea } : { area: '', areas: g.areas }) }; });
        return { general: g, separado: true, partes: GB.partesPorLineas(d, asign, st.D.repartos), lineas: det.map((x, i) => ({ descripcion: x.descripcion, ...asign[i] })) };
      }
      const partes = Array.from(dlg.querySelectorAll('[data-parte]')).map(f => ({ monto: Math.round(Number(f.querySelector('[data-pm]').value) || 0), item: f.querySelector('[data-pi]').value.trim(), area: f.querySelector('[data-pa]').value })).filter(x => x.monto);
      return { general: g, separado: true, partes, lineas: null };
    };
    const pintarResumen = () => { if (!sep.checked) return; const a = armar(), t = a.partes.reduce((x, p) => x + p.monto, 0); resumen.textContent = a.partes.length ? `${GB.textoPartes(a.partes)} · suma ${H.pesos(t)} de ${H.pesos(base)}${t !== base ? ` · ${t < base ? 'falta' : 'sobra'} ${H.pesos(Math.abs(base - t))}` : ''}` : ''; };
    const fsAreas = dlg.querySelector('[data-areas]').closest('fieldset');
    const notaGen = document.createElement('p'); notaGen.className = 'ayuda gn-nota-gen'; notaGen.textContent = 'Con la factura separada, esto es opcional: solo se usa para las líneas que deje vacías.'; fsAreas.appendChild(notaGen);
    const mostrar = () => { caja.hidden = !sep.checked; fsAreas.classList.toggle('gn-gris', sep.checked); notaGen.hidden = !sep.checked; pintarResumen(); };
    // Sin ficha del proveedor: si la factura va a más de un área, lo más probable es que cambie en cada compra → "solo el ítem" (si no lo tocó)
    let tocoRec = !!modo0; dlg.querySelectorAll('[name=cl-rec]').forEach(r => r.addEventListener('change', () => { tocoRec = true; }));
    const proponerRec = () => { if (tocoRec) return; const a = armar(), n = new Set(a.partes.map(p => p.area)).size, fijo = n <= 1 || (!a.separado && a.general.repartoId) || !!(a.lineas && a.lineas.length);   // por líneas: cada producto recuerda su área   // un reparto con nombre es una regla fija
      dlg.querySelector(`[name=cl-rec][value="${fijo ? 'fijo' : 'item'}"]`).checked = true; };
    dlg.addEventListener('change', ev => { if (!ev.target.matches('[name=cl-rec]')) proponerRec(); });
    sep.addEventListener('change', mostrar); mostrar();
    dlg.addEventListener('input', pintarResumen); dlg.addEventListener('change', pintarResumen);
    const ag = dlg.querySelector('[data-agregar]'); if (ag) ag.onclick = () => { dlg.querySelector('[data-montos]').insertAdjacentHTML('beforeend', filaMonto()); };
    dlg.addEventListener('click', ev => { const q = ev.target.closest && ev.target.closest('[data-quitar]'); if (q) { q.closest('[data-parte]').remove(); pintarResumen(); } });
    dlg.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
      try {
        const a = armar(), rv = dlg.querySelector('[name=cl-rec]:checked').value, rec = rv === 'no' ? false : rv;
        await (await fsGN()).clasificar(d, a, rec);
        listo = true; dlg.close(); st.D = null; H.registrar('Gastos: clasificó', `${nom(d)} · ${GB.textoPartes(a.partes)}`);
        resolve({ partes: a.partes, recordar: rec });
      } catch (e) { falla(dlg, e, H); }
    });
  });
}
// Una nota de crédito se descuenta de su factura (la que cita, si está)
function dlgNC(el, H, nc) {
  const ref = (nc.referencias || []).map(r => r.folio), facs = st.B.abiertosD.concat(st.B.anteriores).filter(d => !d.nc && d.rutN === nc.rutN && d.saldo > 0).filter((d, i, a) => a.findIndex(x => x.id === d.id) === i)
    .sort((a, b) => (ref.includes(b.folio) - ref.includes(a.folio)) || b.fecha.localeCompare(a.fecha));
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>Descontar de su factura</h2></div>
    <p class="ayuda"><b>${H.esc(nom(nc))}</b> · Nota de crédito ${H.esc(nc.folio)} · ${H.pesos(nc.saldo)}${ref.length ? ` · corrige la N° ${H.esc(ref.join(', '))}` : ''}</p>
    ${facs.length ? `<div class="gn-opcs">${facs.map((f, i) => `<label class="gn-opc"><input type="radio" name="nc-f" value="${H.esc(f.id)}" ${i === 0 ? 'checked' : ''}><span><b>Factura N° ${H.esc(f.folio)}</b> <span class="gn-m">${H.pesos(f.saldo)}</span><small>${H.esc(H.diaTexto(f.fecha))}${ref.includes(f.folio) ? ' · la que cita' : ''}${f.anterior ? ' · deuda anterior' : ''}</small></span></label>`).join('')}</div>` : '<p class="ayuda">No hay facturas abiertas de este proveedor. Si su factura ya se pagó, marque la nota como "Esto no va" con una nota, o espere la devolución.</p>'}
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button>${facs.length ? '<button type="submit" class="btn">Descontar</button>' : ''}</div></form>`);
  dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const r = dlg.querySelector('[name=nc-f]:checked'); if (!r) return; dlg.querySelector('[type=submit]').disabled = true;
    try { const f = facs.find(x => x.id === r.value), m = Math.max(nc.saldo, -f.saldo);
      if (!(await asegurarClasif(H, [f, nc]))) { dlg.querySelector('[type=submit]').disabled = false; return; }
      await (await fsGN()).pagar({ partes: [{ docId: nc.id, monto: m }, { docId: f.id, monto: -m }], medio: 'nc', fecha: nc.fecha }); dlg.close(); aviso(el, H, `Nota de crédito ${H.esc(nc.folio)} descontada de la factura N° ${H.esc(f.folio)}.`); }
    catch (e) { falla(dlg, e, H); }
  });
}
// Es de este documento (desde un movimiento): uno o varios documentos, también de la deuda anterior
function dlgEsDe(el, H, m) {
  const abiertos = st.B.abiertosD.filter((d, i, a) => a.findIndex(x => x.id === d.id) === i), cand = GB.candidatosDoc(m, abiertos, st.B.S).slice(0, 60);
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>Es de este documento</h2></div>
    <p class="ayuda"><b>${H.esc(m.glosa)}</b> · ${H.pesos(m.libre)} · ${H.esc(GN.CUENTAS[m.cuenta] || m.cuenta)} · ${H.esc(H.diaTexto(m.fecha))}</p>
    ${cand.length ? `<input type="search" data-gn-buscar placeholder="Buscar proveedor, folio o monto" aria-label="Buscar documento"><div class="gn-opcs">${cand.map(({ d, igual, dentro }) => `<label class="gn-opc" data-txt="${H.esc(GN.norm(nom(d) + ' ' + d.folio + ' ' + d.saldo + ' ' + d.rut))}"><input type="checkbox" value="${H.esc(d.id)}"><span><b>${H.esc(nom(d))}</b> <span class="gn-m">${H.pesos(d.saldo)}</span><small>${H.esc(d.tipoTexto)} ${H.esc(d.folio || '')} · ${H.esc(H.diaTexto(d.fecha))}${igual ? ' · mismo monto' : ''}${d.anterior ? ' · deuda anterior' : ''}${dentro ? '' : ' · fuera de la ventana de fechas'}</small></span></label>`).join('')}</div>
      <p class="ayuda" data-suma></p>` : '<p class="ayuda">No hay documentos sin pago. Use "Registrar a mano" si no tiene factura.</p>'}
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button>${cand.length ? '<button type="submit" class="btn">Unir</button>' : ''}</div></form>`);
  buscador(dlg); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  const elegidos = () => Array.from(dlg.querySelectorAll('.gn-opc input:checked')).map(x => abiertos.find(d => d.id === x.value));
  const suma = dlg.querySelector('[data-suma]');
  dlg.querySelectorAll('.gn-opc input').forEach(x => x.addEventListener('change', () => { const l = elegidos(), t = l.reduce((a, d) => a + d.saldo, 0); suma.textContent = l.length ? `Elegidos: ${l.length} · ${H.pesos(t)} de ${H.pesos(m.libre)}${t > m.libre ? ' · el último queda pagado en parte' : t < m.libre ? ' · sobra ' + H.pesos(m.libre - t) + ', queda libre' : ' · justo'}` : ''; }));
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const l = elegidos(); if (!l.length) return falla(dlg, new Error('Elija al menos un documento.'), H);
    dlg.querySelector('[type=submit]').disabled = true;
    try { if (!(await asegurarClasif(H, l))) { dlg.querySelector('[type=submit]').disabled = false; return; }
      const ga = await revisarAnterior(H, m, l); if (ga === undefined) { dlg.querySelector('[type=submit]').disabled = false; return; }
      await (await fsGN()).pagar({ partes: GB.repartirPago(l, m.libre), movId: m.id, enGastoAnterior: ga }); dlg.close(); aviso(el, H, `Unido: ${H.esc(m.glosa)} con ${l.length === 1 ? H.esc(nom(l[0])) : l.length + ' documentos'}.`); }
    catch (e) { falla(dlg, e, H); }
  });
}
// Registrar a mano: boleta en papel o pago sin documento
function dlgMano(el, H, m) {
  const provs = Object.values(st.D.provs || {});
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>Registrar a mano</h2>${H.info('Registrar a mano', TXT_MANO)}</div>
    <p class="ayuda"><b>${H.esc(m.glosa)}</b> · ${H.pesos(m.libre)} · ${H.esc(H.diaTexto(m.fecha))}</p>
    <div class="chips" role="radiogroup" aria-label="Documento"><label class="chip-radio"><input type="radio" name="am-t" value="boleta" checked><span>Boleta en papel</span></label><label class="chip-radio"><input type="radio" name="am-t" value="sin"><span>Sin documento</span></label></div>
    <div class="campo"><label for="am-prov">A quién se le pagó</label><input id="am-prov" list="am-provs" maxlength="120" autocomplete="off"><datalist id="am-provs">${provs.map(p => `<option value="${H.esc(p.razon)}">`).join('')}</datalist></div>
    <div class="gn-dos"><div class="campo"><label for="am-rut">RUT (opcional)</label><input id="am-rut" maxlength="14"></div><div class="campo"><label for="am-folio">N° de boleta (opcional)</label><input id="am-folio" maxlength="30"></div></div>
    <div class="campo"><label for="am-monto">Monto</label><input id="am-monto" type="number" min="1" max="${m.libre}" value="${m.libre}" inputmode="numeric"></div>
    <div class="campo"><label for="am-nota">Qué se compró (opcional)</label><input id="am-nota" maxlength="120"></div>
    ${camposClasif(H, null, 'am')}
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Registrar</button></div></form>`);
  const leer = conectarClasif(dlg, H, null, 'am'); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  const prov = dlg.querySelector('#am-prov');
  prov.addEventListener('change', () => { const p = provs.find(x => x.razon === prov.value); if (!p) return; if (p.rut) dlg.querySelector('#am-rut').value = p.rut; dlg.querySelector('#am-item').value = p.item || '';
    dlg.querySelectorAll('[data-areas] input').forEach(x => { x.checked = (p.areas || []).some(a => a.area === x.value); }); dlg.querySelector('[data-areas] input').dispatchEvent(new Event('change')); });
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
    try { const c = leer();
      await (await fsGN()).registrarAMano(m, { tipo: dlg.querySelector('[name=am-t]:checked').value, proveedor: prov.value, rut: dlg.querySelector('#am-rut').value, folio: dlg.querySelector('#am-folio').value,
        monto: dlg.querySelector('#am-monto').value, nota: dlg.querySelector('#am-nota').value, item: c.item, areas: c.areas });
      dlg.close(); H.registrar('Gastos: registró a mano', `${prov.value} · ${m.libre}`); aviso(el, H, `Registrado: ${H.esc(prov.value)} · ${H.esc(c.item)}, pagado con ${H.esc(m.glosa)}.`); }
    catch (e) { falla(dlg, e, H); }
  });
}
function dlgNoGasto(el, H, m) {
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>No es gasto</h2>${H.info('No es gasto', TXT_NOGASTO)}</div>
    <p class="ayuda"><b>${H.esc(m.glosa)}</b> · ${H.pesos(m.monto)} · ${H.esc(H.diaTexto(m.fecha))}</p>
    <div class="chips" role="radiogroup" aria-label="Qué es">${Object.entries(GB.NO_GASTO).map(([k, t]) => `<label class="chip-radio"><input type="radio" name="ng-t" value="${k}"><span>${t}</span></label>`).join('')}</div>
    <div class="campo"><label for="ng-nota">Nota (opcional)</label><input id="ng-nota" maxlength="200"></div>
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const r = dlg.querySelector('[name=ng-t]:checked'); if (!r) return falla(dlg, new Error('Elija qué es.'), H);
    dlg.querySelector('[type=submit]').disabled = true;
    try { await (await fsGN()).noEsGasto(m.id, r.value, dlg.querySelector('#ng-nota').value); dlg.close(); aviso(el, H, `${H.esc(m.glosa)}: ${H.esc(GB.NO_GASTO[r.value].toLowerCase())}.`); }
    catch (e) { falla(dlg, e, H); }
  });
}
function dlgDeshacer(el, H, pagoId) {
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>Deshacer el pago</h2></div>
    <p class="ayuda">El documento y el movimiento vuelven a la Bandeja. El pago no se borra: queda como deshecho, con quién y cuándo.</p>
    <div class="campo"><label for="dh-m">Motivo</label><input id="dh-m" maxlength="200" placeholder="Por ejemplo: era de otra factura"></div>
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Deshacer</button></div></form>`);
  dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
    try { await (await fsGN()).deshacerPago(pagoId, dlg.querySelector('#dh-m').value); dlg.close(); aviso(el, H, 'Pago deshecho: el documento y el movimiento volvieron a la Bandeja.'); }
    catch (e) { falla(dlg, e, H); }
  });
}

// ═══════════════ v0.95.0 · Repartos con nombre ═══════════════
function repartosHtml(H) {
  const R = Object.values(st.D.repartos || {}).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))), uso = GB.usoRepartos(st.D.provs);
  const barra = r => `<div class="gn-barra">${r.areas.map((a, i) => `<span class="gn-b${i % 5}" style="width:${Number(a.pct)}%"></span>`).join('')}</div>`;
  return `<section class="tarjeta" aria-labelledby="t-gn-rep"><div class="titulo-fila"><h2 id="t-gn-rep">Repartos ${H.info('Repartos', TXT_REPARTOS)}</h2><button type="button" class="btn btn-chico" data-gn-reparto="">Nuevo reparto</button></div>
    ${R.length ? R.map(r => `<div class="gn-it"><div class="gn-fila"><b>${H.esc(r.nombre)}</b><span class="chip ${uso[r.id] ? 'c-verde' : 'c-gris'} chip-chico">usado por ${uso[r.id] || 0}</span></div>${barra(r)}
      <small>${H.esc(r.areas.map(a => `${a.area} ${a.pct}%`).join(' · '))}</small><div class="gn-acc"><button type="button" class="btn-sec btn-chico" data-gn-reparto="${H.esc(r.id)}">Cambiar</button></div></div>`).join('') : '<div class="vacio" style="border:0">Todavía no hay repartos.</div>'}</section>`;
}
function dlgReparto(el, H, rid) {
  const r = rid ? st.D.repartos[rid] : null;
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>${r ? 'Cambiar el reparto' : 'Nuevo reparto'}</h2>${H.info('Repartos', TXT_REPARTOS)}</div>
    <div class="campo"><label for="rp-nombre">Nombre</label><input id="rp-nombre" maxlength="60" value="${H.esc(r ? r.nombre : '')}" placeholder="Por ejemplo: Ainavillo común"></div>
    ${camposClasif(H, r ? { areas: r.areas } : null, 'rp', true).replace(/<div class="campo"><label for="rp-reparto">[\s\S]*?<\/select><\/div>/, '')}
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  const leer = conectarClasif(dlg, H, r ? { areas: r.areas } : null, 'rp'); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
    try {
      const a = leer(), F = await fsGN(), id = await F.guardarReparto({ id: rid || '', nombre: dlg.querySelector('#rp-nombre').value, areas: a.areas });
      dlg.close(); H.registrar(r ? 'Gastos: cambió un reparto' : 'Gastos: creó un reparto', dlg.querySelector('#rp-nombre').value);
      const mes = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 7), n = r ? (st.D.docs || []).filter(x => x.clasif && x.clasif.repartoId === rid && x.mes === mes && !x.clasif.porLineas && !x.clasif.separado).length : 0;
      if (n) return ofrecerAplicar(el, H, id, mes, n);
      aviso(el, H, r ? 'Reparto cambiado. Rige para las facturas que vienen.' : 'Reparto creado. Ya se puede elegir al clasificar.');
    } catch (e) { falla(dlg, e, H); }
  });
}
function ofrecerAplicar(el, H, id, mes, n) {
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>¿También a lo ya pagado de este mes?</h2></div>
    <p>El reparto cambió y rige para lo que viene. Hay <b>${n}</b> ${n === 1 ? 'documento ya pagado' : 'documentos ya pagados'} de este mes con el reparto anterior.</p>
    <p class="ayuda">Los meses cerrados no se tocan en ningún caso.</p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Dejarlos como están</button><button type="submit" class="btn">Aplicar a los ${n}</button></div></form>`);
  dlg.querySelector('[data-cerrar]').onclick = () => { dlg.close(); aviso(el, H, 'Reparto cambiado. Rige para las facturas que vienen.'); };
  dlg.querySelector('form').addEventListener('submit', async ev => { ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
    try { const k = await (await fsGN()).aplicarRepartoAlMes(id, mes); dlg.close(); aviso(el, H, `Reparto cambiado y aplicado a ${k} ${k === 1 ? 'documento' : 'documentos'} de este mes.`); } catch (e) { falla(dlg, e, H); } });
}

// ═══════════════ v0.95.0 · Proveedores y su ficha ═══════════════
function listaProveedores() {
  const por = {};
  (st.D.docs || []).forEach(d => { const k = GB.claveBase(d), x = por[k] || (por[k] = { clave: k, razon: d.razon || d.rut, rut: d.rut || '', n: 0, total: 0, ultima: '' }); x.n++; x.total += Number(d.total) || 0; if (d.fecha > x.ultima) x.ultima = d.fecha; if (!x.razon) x.razon = d.razon; });
  Object.entries(st.D.provs || {}).forEach(([k, p]) => { const b = k.replace(/_c_.*$/, ''); if (!por[b]) por[b] = { clave: b, razon: p.razon || b, rut: p.rut || '', n: 0, total: 0, ultima: '' }; });
  return Object.values(por).sort((a, b) => String(a.razon).localeCompare(String(b.razon)));
}
function proveedoresHtml(H) {
  const L = listaProveedores(), q = GN.norm(st.buscaProv || ''), l = L.filter(x => !q || GN.norm(x.razon + ' ' + x.rut).includes(q));
  const estado = x => { const p = st.D.provs[x.clave]; return p && p.item ? `<span class="chip ${GB.modoProveedor(p) === 'item' ? 'c-amarillo' : 'c-verde'} chip-chico">${GB.modoProveedor(p) === 'item' ? 'Solo el ítem' : 'Ítem y áreas'}</span>` : '<span class="chip c-gris chip-chico">Sin ficha</span>'; };
  return `<section class="tarjeta" aria-labelledby="t-gn-provs"><div class="titulo-fila"><h2 id="t-gn-provs">Proveedores</h2><span>${L.length}</span></div>
    <div class="campo"><label class="sr" for="gn-buscar-prov">Buscar proveedor</label><input id="gn-buscar-prov" type="search" value="${H.esc(st.buscaProv || '')}" placeholder="Nombre o RUT"></div>
    ${l.length ? l.slice(0, 300).map(x => `<a class="gn-it gn-prov" href="#gastos/proveedores/${encodeURIComponent(x.clave)}"><div class="gn-fila"><b>${H.esc(x.razon)}</b>${estado(x)}</div><small>${x.rut ? 'RUT ' + H.esc(x.rut) + ' · ' : ''}${x.n} ${x.n === 1 ? 'documento' : 'documentos'}${x.n ? ' · ' + H.pesos(x.total) : ''}${x.ultima ? ' · último ' + H.esc(H.diaTexto(x.ultima)) : ''}</small></a>`).join('') : '<div class="vacio" style="border:0">Ningún proveedor con eso.</div>'}</section>`;
}
function fichaHtml(H, base) {
  const docs = (st.D.docs || []).filter(d => GB.claveBase(d) === base).sort((a, b) => b.fecha.localeCompare(a.fecha)), provs = st.D.provs || {};
  const gen = provs[base] || null, razon = (docs[0] && docs[0].razon) || (gen && gen.razon) || base, rut = (docs[0] && docs[0].rut) || (gen && gen.rut) || '';
  const B = st.B || GB.armar(st.D, {}), est = id => B.docs.find(x => x.id === id) || {};
  const clientes = {}; docs.filter(d => d.cliente).forEach(d => { if (!clientes[d.cliente]) clientes[d.cliente] = d; });
  Object.keys(provs).filter(k => k.startsWith(base + '_c_')).forEach(k => { const c = k.slice(base.length + 3); if (!clientes[c]) clientes[c] = { cliente: c, direccion: '' }; });
  const repTxt = p => (p.repartoId && st.D.repartos[p.repartoId] ? `${st.D.repartos[p.repartoId].nombre} · ${GB.textoReparto(st.D.repartos[p.repartoId].areas)}` : GB.textoReparto(p.areas || []) || 'sin áreas');
  const clasif = (p, clave, titulo) => `<div class="gn-it"><span class="gn-sub">${titulo}</span>${p && p.item ? `<b>${H.esc(p.item)}</b><small>${GB.modoProveedor(p) === 'item' ? 'Solo el ítem: las áreas se eligen en cada compra.' : 'Ítem y áreas: ' + H.esc(repTxt(p))}</small>` : '<small>Sin clasificación guardada.</small>'}
    <div class="gn-acc"><button type="button" class="btn-sec btn-chico" data-gn-ficha="${H.esc(clave)}" data-razon="${H.esc(razon)}" data-rut="${H.esc(rut)}">${p && p.item ? 'Cambiar' : 'Establecer'}</button></div></div>`;
  const prods = [...Object.entries((gen && gen.productos) || {}).map(([k, v]) => [base, k, v]), ...Object.keys(provs).filter(k => k.startsWith(base + '_c_')).flatMap(k => Object.entries(provs[k].productos || {}).map(([pk, v]) => [k, pk, v]))];
  const glosas = Object.keys(provs).filter(k => k === base || k.startsWith(base + '_c_')).flatMap(k => (provs[k].glosas || []).map(g => [k, g]));
  const estDoc = d => { const e = est(d.id); return e.estado === 'no_va' ? '<span class="chip c-gris chip-chico">esto no va</span>' : e.estadoPago === 'pagado' ? `<span class="chip ${e.clasifEf ? 'c-verde' : 'c-amarillo'} chip-chico">${e.clasifEf ? 'listo' : 'pagado, falta clasificar'}</span>` : '<span class="chip c-amarillo chip-chico">sin pago</span>'; };
  const hist = ((gen && gen.historial) || []).slice(-8).reverse();
  return `<p class="volver"><a href="#gastos/proveedores">Todos los proveedores</a></p>
    <section class="tarjeta" aria-labelledby="t-gn-ficha"><div class="titulo-fila"><h2 id="t-gn-ficha">${H.esc(razon)} ${H.info('Ficha del proveedor', TXT_FICHA)}</h2></div>
      <p class="ayuda">${rut ? 'RUT ' + H.esc(rut) + ' · ' : ''}${docs.length} ${docs.length === 1 ? 'documento' : 'documentos'} desde el inicio</p>
      <div class="gn-ficha">
        ${clasif(gen, base, 'Clasificación')}
        ${Object.keys(clientes).length ? `<div class="gn-it"><span class="gn-sub">Servicios (por N° de cliente)</span>${Object.values(clientes).map(c => { const k = base + '_c_' + String(c.cliente).replace(/[^0-9A-Za-z]/g, '').slice(0, 30), p = provs[k];
            return `<div class="gn-serv"><div><b>Cliente ${H.esc(c.cliente)}</b>${c.direccion ? ` · ${H.esc(c.direccion)}` : ''}<br><small>${p && p.item ? `${H.esc(p.item)} · ${GB.modoProveedor(p) === 'item' ? 'solo el ítem' : H.esc(repTxt(p))}` : 'Sin clasificación: use la del proveedor o establézcala'}</small></div>
              <button type="button" class="btn-sec btn-chico" data-gn-ficha="${H.esc(k)}" data-razon="${H.esc(razon)}" data-rut="${H.esc(rut)}">${p && p.item ? 'Cambiar' : 'Establecer'}</button></div>`; }).join('')}</div>` : ''}
        <div class="gn-it"><span class="gn-sub">Cómo aparece en el banco</span>${glosas.length ? glosas.map(([k, g]) => `<div class="gn-fila"><span>${H.esc(g.sena)}</span><button type="button" class="gn-link" data-gn-olvidar="${H.esc(k)}" data-sena="${H.esc(g.sena)}">Olvidar</button></div>`).join('') : '<small>Todavía no aprende ninguna glosa (se aprende al confirmar un pago).</small>'}</div>
        <div class="gn-it"><span class="gn-sub">Productos recordados</span>${prods.length ? prods.map(([k, pk, v]) => `<div class="gn-fila"><span>${H.esc(pk)}</span><span><small>${H.esc(v.item)}${v.area ? ' · ' + H.esc(String(v.area).startsWith(GB.AREA_REPARTO) ? ((st.D.repartos[v.area.slice(GB.AREA_REPARTO.length)] || {}).nombre || 'reparto que ya no está') : v.area) : ''}</small> <button type="button" class="gn-link" data-gn-quitarprod="${H.esc(k)}" data-prod="${H.esc(pk)}">Quitar</button></span></div>`).join('') : '<small>Ninguno (se recuerdan al separar una factura por líneas).</small>'}</div>
      </div>
      <h3 class="gn-h3">Últimos documentos</h3>
      ${docs.slice(0, 12).map(d => `<div class="gn-fila gn-fila-doc"><span>${H.esc(d.tipoTexto)} ${H.esc(d.folio)} · ${H.esc(H.diaTexto(d.fecha))} ${estDoc(d)}</span><span class="gn-m">${H.pesos(d.total)}</span></div>`).join('') || '<p class="ayuda">Sin documentos desde el inicio.</p>'}
      ${hist.length ? `<details class="gn-det"><summary>Historial de la ficha</summary>${hist.map(h => `<div class="gn-fila"><small>${H.esc(h.en || '')} · ${H.esc(h.por || '')}</small><small>${H.esc(h.que || '')}</small></div>`).join('')}</details>` : ''}
    </section>`;
}
function dlgFicha(el, H, clave, razon, rut) {
  const p = (st.D.provs || {})[clave] || null, pre = p ? { item: p.item, repartoId: p.repartoId || '', areas: p.areas || [] } : null, modo0 = p ? GB.modoProveedor(p) : 'fijo';
  const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>${H.esc(razon)}</h2>${H.info('Ficha del proveedor', TXT_FICHA)}</div>
    ${clave.includes('_c_') ? `<p class="ayuda">Servicio: cliente ${H.esc(clave.split('_c_')[1])}</p>` : ''}
    <fieldset class="campo gn-recordar"><legend>Qué recuerda</legend>
      <label class="gn-opc"><input type="radio" name="fi-modo" value="fijo" ${modo0 !== 'item' ? 'checked' : ''}><span><b>Ítem y áreas</b><small>Siempre se reparte igual: sus facturas llegan clasificadas.</small></span></label>
      <label class="gn-opc"><input type="radio" name="fi-modo" value="item" ${modo0 === 'item' ? 'checked' : ''}><span><b>Solo el ítem</b><small>Las áreas se eligen en cada compra.</small></span></label></fieldset>
    ${camposClasif(H, pre, 'fi')}
    <p class="error" data-err role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Guardar</button></div></form>`);
  const leer = conectarClasif(dlg, H, pre, 'fi'); dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
  dlg.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); dlg.querySelector('[type=submit]').disabled = true;
    try { const a = leer(), modo = dlg.querySelector('[name=fi-modo]:checked').value;
      await (await fsGN()).guardarFicha(clave, { item: a.item, modo, repartoId: a.repartoId, areas: a.areas, razon, rut }); dlg.close(); H.registrar('Gastos: ficha de proveedor', `${razon} · ${a.item}`); aviso(el, H, `Ficha guardada: ${H.esc(razon)}. Rige para sus facturas sin pagar.`); }
    catch (e) { falla(dlg, e, H); }
  });
}

// ═══════════════ v0.95.0 · Seleccionar y unir; revisar el Gastos anterior ═══════════════
function repintarQuieto(el, H) { const y = window.scrollY; repintar(el, H); requestAnimationFrame(() => window.scrollTo(0, y)); }
function elegir(el, H, tipo, id, on) {
  const S = st.sel, l = S[tipo];
  if (on && !l.includes(id)) l.push(id); if (!on) S[tipo] = l.filter(x => x !== id);
  if (!S.d.length && !S.m.length) S.primero = ''; else if (!S.primero || !S[S.primero].length) S.primero = S.d.length && !S.m.length ? 'd' : S.m.length && !S.d.length ? 'm' : (S.primero || tipo);
  repintarQuieto(el, H);
}
async function unirElegidos(el, H) {
  const docs = st.sel.d.map(docDe).filter(Boolean), movs = st.sel.m.map(movDe).filter(Boolean), b = GB.balance(docs, movs);
  if (!b.valido) return;
  if (!(await asegurarClasif(H, docs))) return;
  const ga = {};
  for (const m of movs) { const g = await revisarAnterior(H, m, docs); if (g === undefined) return; ga[m.id] = g; }
  const pasos = movs.length === 1 ? [{ movId: movs[0].id, partes: GB.repartirPago(docs, movs[0].libre) }] : GB.pagosDeVarios(docs[0], movs);
  return hacer(el, H, async () => { const F = await fsGN(); for (const p of pasos) await F.pagar({ ...p, enGastoAnterior: ga[p.movId] || null });
      st.sel = { d: [], m: [], primero: '' }; H.registrar('Gastos: unió lo elegido', `${docs.length} doc · ${movs.length} cargo`); },
    `Unido: ${docs.length === 1 ? H.esc(nom(docs[0])) : docs.length + ' documentos'} con ${movs.length === 1 ? H.esc(movs[0].glosa) : movs.length + ' cargos'}${b.calza ? '' : b.dif < 0 ? ` · queda por pagar ${H.pesos(-b.dif)}` : ` · quedan libres ${H.pesos(b.dif)}`}.`);
}
// Un cargo anterior al inicio: ¿ya está en el Gastos anterior? → Promise: el registro antiguo marcado, null (no está / es otro), undefined (canceló)
function revisarAnterior(H, m, docs) {
  if (!m || !m.anterior) return Promise.resolve(null);
  const c = GB.enAnterior(m, docs, st.antG || [], st.B && st.B.usadosAnterior);   // st.antG: lo guardado al dibujar (clasificar antes recarga los datos)
  if (!c.length) return Promise.resolve(null);
  return new Promise(resolve => {
    const dlg = H.dialogo(`<form class="form-dialogo" novalidate><div class="titulo-fila"><h2>¿Ya está en el Gastos anterior?</h2></div>
      <p class="ayuda">El cargo <b>${H.esc(m.glosa)}</b> · ${H.pesos(m.monto)} · ${H.esc(H.diaTexto(m.fecha))} es de antes del inicio. En el Gastos anterior hay ${c.length === 1 ? 'un registro parecido' : 'registros parecidos'}:</p>
      <div class="gn-opcs">${c.map(({ g, seguro }, i) => `<label class="gn-opc"><input type="radio" name="ga" value="${i}" ${i === 0 && seguro ? 'checked' : ''}><span><b>${H.esc(g.razon || g.rut || 'Sin proveedor')}</b> <span class="gn-m">${H.pesos(g.monto)}</span><small>${H.esc(H.diaTexto(g.fecha))}${g.item ? ' · ' + H.esc(g.item) : ''}${g.folio ? ' · folio ' + H.esc(g.folio) : ''}${seguro ? ' · mismo RUT y monto' : ' · mismo monto y fecha parecida'}</small></span></label>`).join('')}
        <label class="gn-opc"><input type="radio" name="ga" value="no"><span><b>No, es otro pago</b><small>Ese cargo no se registró en el Gastos anterior.</small></span></label></div>
      <p class="ayuda">Si es el mismo pago, queda marcado: el gasto cuenta en el mes de la factura y Finanzas no contará ese registro antiguo. El Gastos anterior no se modifica.</p>
      <p class="error" data-err role="alert"></p>
      <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cancelar</button><button type="submit" class="btn">Seguir</button></div></form>`);
    let listo = false; dlg.addEventListener('close', () => { if (!listo) resolve(undefined); });
    dlg.querySelector('[data-cerrar]').onclick = () => dlg.close();
    dlg.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); const r = dlg.querySelector('[name=ga]:checked');
      if (!r) { dlg.querySelector('[data-err]').textContent = 'Elija si es el mismo pago o no.'; return; }
      listo = true; dlg.close(); resolve(r.value === 'no' ? null : c[Number(r.value)].g); });
  });
}
