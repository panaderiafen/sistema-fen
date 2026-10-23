// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Gastos (nuevo, desde cero)  v0.90.0 · Etapa 1: base y carga
//  Rutas: #gastos (Bandeja) · #gastos/cargas (lo que se subió). Cualquier otra ruta de Gastos (las del Gastos anterior) lleva a #gastos.
//  Etapa 1: subir las compras del SII, la cartola de BancoEstado (cuenta corriente y chequera) y el reporte de liberaciones de
//  Mercado Pago; ver los dos lados de la Bandeja (documentos y movimientos) y hasta dónde llega cada cuenta. Unir cada
//  documento con su pago llega en la Etapa 2.
//  La cartola de BancoEstado sigue pasando sus abonos a Ventas B2B → Conciliación, igual que antes.
//  H = ayudas de app.js: { esc, info, icono, registrar, mensajeError, pesos, diaTexto, cargarXLSX, B2b, Cartola }
// ═══════════════════════════════════════════════
import * as GN from './gn-modelo.js?v=0.90.1';
import * as Sii from './sii.js?v=0.90.1';
import * as MP from './mercadopago.js?v=0.90.1';

const st = { D: null, err: '', msg: '', subiendo: false, cuenta: '', cargando: false };
const $ = id => document.getElementById(id);
const fsGN = () => import('./gn-fs.js?v=0.90.1');
const INICIO = () => (window.FEN_SIS && window.FEN_SIS.INICIO) || '2026-10-01';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = f => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`;
export const olvidar = () => { st.D = null; };

const TABS = [['bandeja', '', 'Bandeja'], ['cargas', 'cargas', 'Archivos subidos']];
const hashDe = t => '#gastos' + (t === 'cargas' ? '/cargas' : '');
const TXT_SUBIR = 'Sirven:\n• Las compras del SII: el XML de documentos recibidos, el Registro de Compras (.csv) o los Documentos recibidos (.xls).\n• La cartola de BancoEstado (.xlsx), histórica o en línea, de la cuenta corriente o de la chequera. Sus abonos siguen pasando a Ventas B2B → Conciliación.\n• El reporte de liberaciones de Mercado Pago (.csv).\nSubir el mismo archivo dos veces no repite nada: cada documento se reconoce por RUT, tipo y folio, y cada movimiento por su línea exacta. Si la misma salida ya llegó en otra cartola (por ejemplo la en línea y después la histórica), no se guarda otra vez.\nLas guías de despacho no entran (no son compras: cuenta su factura).';
const TXT_BANDEJA = 'A la izquierda, lo que se debe: los documentos de compra desde el inicio del sistema. A la derecha, lo que salió: los movimientos de cada cuenta.\nEn la Etapa 2 la Bandeja propone qué documento va con qué movimiento, y se confirma con un toque.\nLos traspasos entre cuentas propias (por ejemplo, el retiro de Mercado Pago a BancoEstado) no son gasto: se muestran aparte.';
const TXT_ANTERIOR = 'Facturas del mes anterior al inicio del sistema. Si se pagan desde el inicio en adelante, son "deuda anterior": su pago no cuenta como gasto del mes nuevo.\nNo aparecen en la Bandeja: en la Etapa 2, cuando un movimiento no encuentra su documento, el sistema las busca aquí.';
const TXT_INICIO = 'Gastos parte desde cero. Lo anterior a esta fecha no entra (solo las facturas del mes anterior, como deuda anterior). El Gastos anterior no se borró: sus datos siguen guardados en la base.';

function cab(H, tab) {
  return `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Lo que se debe y lo que salió, desde el ${H.esc(fechaLarga(INICIO()))} ${H.info('Desde cero', TXT_INICIO)}</p></div>
    </div>
    <nav class="pestanas" role="tablist" aria-label="Pestañas de Gastos">${TABS.map(([k, , t]) => `<a role="tab" href="${hashDe(k)}" aria-selected="${k === tab}">${t}</a>`).join('')}</nav>
    <div class="gn-drop${st.subiendo ? ' gn-drop-ocupado' : ''}" data-gn-drop>
      <label class="gn-drop-zona" for="gn-archivo">
        <span class="gn-drop-ic">${H.icono('subir', 26)}</span>
        <span class="gn-drop-txt"><b>${st.subiendo ? H.esc(st.subiendo === true ? 'Leyendo el archivo…' : st.subiendo) : '<span class="gn-pc">Arrastre aquí los archivos</span><span class="gn-cel">Toque para elegir los archivos</span>'}</b>
          <small>${st.subiendo ? 'No cierre esta pestaña' : '<span class="gn-pc">o haga clic para elegirlos · puede soltar varios a la vez</span><span class="gn-cel">Puede elegir varios a la vez</span>'}</small></span>
        <span class="gn-drop-tipos"><span>SII</span><span>BancoEstado</span><span>Mercado Pago</span></span>
      </label>
      ${H.info('Subir archivo', TXT_SUBIR)}
      <input type="file" id="gn-archivo" class="sr" multiple accept=".xml,.csv,.txt,.xls,.xlsx,.html" ${st.subiendo ? 'disabled' : ''}>
    </div>
    <div id="gn-msg" role="status" aria-live="polite">${st.err ? `<p class="error" role="alert">${st.err}</p>` : ''}${st.msg ? `<div class="aviso gn-aviso">${st.msg}</div>` : ''}</div>`;
}

export async function pintar(el, sub, H) {
  const tab = sub === 'cargas' ? 'cargas' : 'bandeja';
  if (sub && sub !== 'cargas') { location.replace('#gastos'); return; }
  if (!st.D) {
    el.innerHTML = cab(H, tab) + '<section class="tarjeta"><div class="vacio" style="border:0">Cargando Gastos…</div></section>';
    conectar(el, H);
    try { st.D = await (await fsGN()).leer(); }
    catch (e) { el.innerHTML = cab(H, tab) + `<section class="tarjeta"><p class="error" role="alert">${H.esc(e.message || H.mensajeError(e))}</p>${e.code === 'sin_base' ? '<p class="ayuda">La conexión con la base de Gastos se hace en Configuración → Conexiones.</p>' : ''}</section>`; conectar(el, H); return; }
    if (!enGastos()) return;
  }
  el.innerHTML = cab(H, tab) + (tab === 'cargas' ? cargasHtml(H) : bandejaHtml(H));
  conectar(el, H);
}
const enGastos = () => (location.hash || '').replace('#', '').split('/')[0] === 'gastos';
const subActual = () => ((location.hash || '').split('/')[1] || '');

// ── Bandeja (Etapa 1: los dos lados) ──
function bandejaHtml(H) {
  const D = st.D, B = GN.bandeja(D.docs, D.movs, { cuenta: st.cuenta }), cob = GN.cobertura(D.movs, D.cargas);
  const cuentas = [['', 'Todas'], ...cob.map(c => [c.cuenta, c.nombre])];
  const docFila = d => `<div class="gn-it${d.nc ? ' gn-nc' : ''}"><div class="gn-fila"><b>${H.esc(d.razon || d.rut)}</b><span class="gn-m">${H.pesos(d.total)}</span></div>
      <small>${H.esc(d.tipoTexto)} N° ${H.esc(d.folio)} · ${H.esc(H.diaTexto(d.fecha))}${d.vence && d.vence !== d.fecha ? ` · vence ${H.esc(H.diaTexto(d.vence))}` : ''}${d.nc && d.referencias && d.referencias.length ? ` · corrige la N° ${H.esc(d.referencias.map(r => r.folio).join(', '))}` : ''}</small></div>`;
  const movFila = m => `<div class="gn-it"><div class="gn-fila"><b>${H.esc(m.glosa)}</b><span class="gn-m">${H.pesos(m.monto)}</span></div>
      <small>${H.esc(GN.CUENTAS[m.cuenta] || m.cuenta)} · ${H.esc(H.diaTexto(m.fecha))}${m.hora ? ' ' + H.esc(m.hora) : ''}</small></div>`;
  const vacioD = D.docs.length ? 'No hay documentos desde el inicio.' : 'Todavía no hay documentos. Suba las compras del SII con "Subir archivo".';
  const vacioM = D.movs.length ? 'No hay movimientos de esta cuenta.' : 'Todavía no hay movimientos. Suba la cartola de BancoEstado o el reporte de Mercado Pago.';
  return `<section class="tarjeta" aria-labelledby="t-gn-cob"><div class="titulo-fila"><h2 id="t-gn-cob">Hasta dónde llega cada cuenta</h2></div>
      ${cob.length ? `<div class="gn-cob">${cob.map(c => `<div class="gn-cob-c"><b>${H.esc(c.nombre)}</b><span>${H.esc(H.diaTexto(c.desde))} al ${H.esc(H.diaTexto(c.hasta))} · ${c.n} ${c.n === 1 ? 'movimiento' : 'movimientos'}</span></div>`).join('')}</div>` : '<p class="ayuda">Todavía no se sube ninguna cartola.</p>'}</section>
    <section class="tarjeta" aria-labelledby="t-gn-bandeja"><div class="titulo-fila"><h2 id="t-gn-bandeja">Bandeja ${H.info('Bandeja', TXT_BANDEJA)}</h2></div>
      <p class="nota-i">(i) Etapa 1: aquí se ve lo cargado. Unir cada documento con su pago llega en la Etapa 2.</p>
      <div class="gn-lados">
        <div class="gn-lado"><div class="gn-lado-t">Documentos · ${B.docs.length} · ${H.pesos(B.totalDocs)}</div>
          ${B.docs.length ? B.docs.map(docFila).join('') : `<div class="vacio">${vacioD}</div>`}
          ${B.anteriores.length ? `<details class="gn-det"><summary>${B.anteriores.length} ${B.anteriores.length === 1 ? 'factura' : 'facturas'} del mes anterior, como deuda anterior ${H.info('Deuda anterior', TXT_ANTERIOR)}</summary>${B.anteriores.map(docFila).join('')}</details>` : ''}</div>
        <div class="gn-lado"><div class="gn-lado-t">Movimientos · ${B.movs.length} · ${H.pesos(B.totalMovs)}</div>
          ${cuentas.length > 2 ? `<div class="gn-filtro" role="group" aria-label="Cuenta">${cuentas.map(([k, t]) => `<button type="button" class="chip ${st.cuenta === k ? 'c-verde' : 'c-gris'}" data-gn-cuenta="${k}" aria-pressed="${st.cuenta === k}">${H.esc(t)}</button>`).join('')}</div>` : ''}
          ${B.movs.length ? B.movs.map(movFila).join('') : `<div class="vacio">${vacioM}</div>`}
          ${B.traspasos.length ? `<details class="gn-det"><summary>${B.traspasos.length} ${B.traspasos.length === 1 ? 'traspaso' : 'traspasos'} entre cuentas propias (no son gasto)</summary>${B.traspasos.map(movFila).join('')}</details>` : ''}</div>
      </div></section>`;
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
  if (e === 'pdf') throw new Error('los PDF (boletas de luz y agua, Previred, liquidaciones) se suben en la Etapa 3.');
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
