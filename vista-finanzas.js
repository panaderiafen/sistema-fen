// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Finanzas  v0.56.0 (F1 paso 1)
//  Pestañas: Cómo trabajamos (el método acordado el 12-oct, fijo) · Costos (Materias primas y Revisión de datos).
//  Más adelante: Márgenes, Resultados, Flujo de caja y Metas.
//  Datos en fen-gastos (finanzas.js); reglas puras en finanzas-costos.js. Solo administración: nada va a Cocina.
//  H = ayudas de app.js: { esc, info, registrar, mensajeError, hace, dialogo }
// ═══════════════════════════════════════════════
import * as F from './finanzas.js?v=0.56.0';
import * as FC from './finanzas-costos.js?v=0.56.0';
import { normalizar, coincide } from './buscador.js?v=0.56.0';

const st = { datos: null, prod: null, cx: null, filtro: 'todas', q: '', msg: '', err: '', cargando: false, verRevisados: false };
const $ = id => document.getElementById(id);
const nf = v => Number(v || 0).toLocaleString('es-CL');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaTxt = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '—'; };
const ORIGEN = { planilla: 'Planilla', manual: 'A mano', sii: 'SII' };
const TIPO = { mp: 'Materia prima', insumo: 'Insumo', sub_receta: 'Sub receta' };

// Íconos lineales propios de esta pantalla
const PI = {
  dia: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cierre: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  informe: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  decision: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
  meta: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>', sube: '<path d="M12 19V5M6 11l6-6 6 6"/>', baja: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', bajar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  neto: '<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="9"/>', fuente: '<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6"/>', candado: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};
const ic = (n, t = 20) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PI[n] || ''}</svg>`;

function error(e, H) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return 'La base nueva de Gastos no dejó leer o guardar: revisa que tu cuenta esté en admins de fen-gastos.';
  if (c === 'actualizar' || c === 'sin_url') return (e && e.message) || 'Revisa el script de Producción en Configuración → Conexiones.';
  return (e && e.message) || H.mensajeError(e);
}

const partes = () => (location.hash || '').replace('#', '').split('/');
const cab = (tab) => `<div class="cabecera"><div><h1 id="t-finanzas">Finanzas</h1><p>Análisis financiero de Fën</p></div>
  <div class="pestanas" role="tablist" aria-label="Secciones de Finanzas">
    <a role="tab" href="#finanzas" aria-selected="${tab === 'como'}">Cómo trabajamos</a>
    <a role="tab" href="#finanzas/costos" aria-selected="${tab === 'costos'}">Costos</a></div></div>
  <p class="fin-pronto">Próximamente: Márgenes, Resultados, Flujo de caja, Metas</p>`;

export async function pintar(el, sub, H) {
  const p = partes(), tab = p[1] === 'costos' ? 'costos' : 'como';
  st.msg = ''; st.err = '';
  if (tab === 'como') { el.innerHTML = cab(tab) + comoTrabajamos(H); return; }
  const parte = p[2] === 'revision' ? 'revision' : 'mp';
  el.innerHTML = cab(tab) + subPestanas(parte, null) + '<section class="tarjeta"><div class="vacio" style="border:0">Abriendo los costos…</div></section>';
  try {
    st.cx = await F.conexiones();
    if (st.cx.gastos.estado !== 'ok') return sinBase(el, tab, H);
    await recargar();
  } catch (e) { el.innerHTML = cab(tab) + `<section class="tarjeta"><p class="error" role="alert">${H.esc(error(e, H))}</p></section>`; return; }
  pintarCostos(el, parte, H);
}
async function recargar() {
  const [d, prod] = await Promise.all([F.leer(), st.cx && st.cx.prod.estado === 'ok' ? F.produccion() : Promise.resolve({ mps: [], recetas: [], error: 'sin conexión' })]);
  st.datos = d; st.prod = prod;
}
function sinBase(el, tab, H) {
  const g = st.cx.gastos;
  const txt = g.estado === 'sin_config' ? 'Falta conectar la base nueva de Gastos (fen-gastos), donde se guardan los costos.'
    : g.estado === 'sin_sesion' ? 'Falta entrar a la base nueva de Gastos con tu contraseña.'
    : g.estado === 'sin_admin' ? 'Tu cuenta no está marcada como administración en fen-gastos.' : 'No se pudo abrir la base nueva de Gastos.';
  el.innerHTML = cab(tab) + `<section class="tarjeta" aria-labelledby="t-fin-sin"><h2 id="t-fin-sin">Los costos se guardan en la base nueva de Gastos</h2>
    <p class="ayuda">${H.esc(txt)} Se arregla en <a href="#gastos/base">Gastos → Base nueva</a>; después vuelve aquí.</p></section>`;
}

// ═══════════════ Cómo trabajamos (contenido fijo) ═══════════════
function comoTrabajamos(H) {
  const paso = (n, icono, titulo, cuando, cuerpo) => `<li class="fin-paso"><div class="fin-paso-ic" aria-hidden="true">${ic(icono, 22)}</div>
    <div class="fin-paso-txt"><div class="fin-paso-tit"><span class="fin-num">${n}</span><h3>${titulo}</h3>${cuando ? `<span class="chip c-gris">${cuando}</span>` : ''}</div>${cuerpo}</div></li>`;
  const cond = t => `<li>${ic('check', 16)}<span>${t}</span></li>`;
  const def = (termino, cuerpo, ej) => `<div class="fin-def"><dt>${termino}</dt><dd>${cuerpo}${ej ? `<p class="fin-ej">${ej}</p>` : ''}</dd></div>`;
  return `
  <section class="tarjeta" aria-labelledby="t-fin-metodo">
    <h2 id="t-fin-metodo">La forma de trabajar ${H.info('Cómo trabajamos', 'Es el método acordado el 12 de octubre de 2026 para mirar los números de Fën. Cada pantalla de Finanzas sigue estas reglas.\nSolo tú ves estos números, y solo en Sistema Fën: las jefas no ven nada de esto.')}</h2>
    <p class="ayuda">Todo se mira en dos ejes: el <b>área que produce</b> (Panadería, Bollería, Pastelería, Cafetería) y el <b>canal donde se vende</b> (caja Barros Arana, caja Ainavillo, B2B). Cada venta va al área del producto; cada canal tiene sus propios costos (cajeras, despacho, comisiones).</p>
    <ol class="fin-pasos">
      ${paso(1, 'dia', 'Todos los días', '', '<p>El costo directo de cada producto se actualiza con cada compra. En <b>Hoy</b>: la venta del mes contra la meta y el punto de equilibrio.</p>')}
      ${paso(2, 'cierre', 'Cierre del mes', 'día 5 a 8 del mes siguiente', `<p>Se cierra cuando están las cuatro cosas:</p>
        <ul class="fin-cond">${cond('SII del mes cargado')}${cond('Ventas completas, de las dos sucursales')}${cond('Gastos conciliados con la cartola')}${cond('Conteo de bodega hecho')}</ul>
        <p>Al cerrarlo, el mes queda <b>congelado</b>. Lo que aparezca después entra como ajuste del mes siguiente.</p>`)}
      ${paso(3, 'informe', 'Informes', '', '<p>Estado de resultados y flujo de caja del mes cerrado, comparados con el presupuesto.</p>')}
      ${paso(4, 'decision', 'Decisiones', '', '<p>Precios, mezcla de productos, costos y metas.</p>')}
      ${paso(5, 'meta', 'Presupuesto del mes siguiente', '', '<p>Fijos y metas de venta por área.</p>')}
    </ol>
  </section>
  <section class="tarjeta" aria-labelledby="t-fin-reglas">
    <h2 id="t-fin-reglas">Reglas fijas</h2>
    <div class="fin-reglas">
      <div class="fin-regla">${ic('neto', 22)}<div><b>Todo en neto</b><span>Ventas y costos sin IVA. El IVA va al flujo de caja.</span></div></div>
      <div class="fin-regla">${ic('fuente', 22)}<div><b>Una sola fuente por dato</b><span>Cada número se anota en un solo lugar y de ahí lo leen todos.</span></div></div>
      <div class="fin-regla">${ic('candado', 22)}<div><b>Un mes cerrado no se toca</b><span>Las correcciones entran como ajuste del mes siguiente.</span></div></div>
    </div>
  </section>
  <section class="tarjeta" aria-labelledby="t-fin-calc">
    <h2 id="t-fin-calc">Cómo se calcula</h2>
    <dl class="fin-glosario">
      ${def('Costo directo', 'Lo que cuesta hacer una unidad: materias primas al precio neto de la última compra (del SII, se puede corregir a mano) + insumos y envases + merma de proceso. Las sub recetas (masa madre, crema pastelera…) entran con su propio costo.')}
      ${def('Margen de contribución', 'Precio neto − costo directo. En %, se mide <b>sobre el precio neto</b>.', 'Ejemplo: precio neto $2.000 y costo directo $800 → margen $1.200, o sea 60 %. El mismo margen visto como <b>recargo</b> sobre el costo es 150 % ($1.200 ÷ $800). Recargo = margen ÷ (1 − margen); margen = recargo ÷ (1 + recargo).')}
      ${def('Margen objetivo del área', 'Lo indirecto entra al precio a nivel de área, no repartido por unidad: margen objetivo = (fijos del área + utilidad objetivo) ÷ ventas esperadas. Precio sugerido = costo directo ÷ (1 − margen objetivo).')}
      ${def('Margen del área', 'Margen de contribución del área − sus fijos propios.')}
      ${def('Fijos propios y fijos comunes', '<b>Propios</b>: existen solo por esa área (por ejemplo, un sueldo o una máquina de una sola área). <b>Comunes</b>: son de todo el negocio (arriendo, contador, luz general, sueldo empresarial). En el resultado los comunes van <b>sin repartir</b>; aparte se puede ver un reparto por causa (m², kWh, horas), solo para conversar.')}
      ${def('Resultado del negocio', 'Tres pisos: ventas netas − costo directo = margen de contribución; − fijos propios = margen del área; − fijos comunes = resultado del negocio.')}
      ${def('Punto de equilibrio', 'La venta neta que cubre los fijos: fijos ÷ % de margen de contribución.', 'Ejemplo: fijos $3.000.000 al mes y margen 60 % → hay que vender $5.000.000 netos en el mes.')}
      ${def('Qué queda fuera del resultado', 'No son gasto del mes, van al flujo de caja: el <b>capital</b> de las cuotas de crédito (solo el interés es gasto), el pago de IVA (<b>F29</b>), las <b>inversiones</b> (entran al resultado como depreciación mensual según su vida útil) y los <b>retiros</b>. El sueldo empresarial sí es costo (fijo común).')}
    </dl>
  </section>`;
}

// ═══════════════ Costos ═══════════════
function subPestanas(parte, n) {
  return `<div class="pastillas fin-sub" role="group" aria-label="Partes de Costos">
    <a class="pastilla" href="#finanzas/costos" aria-current="${parte === 'mp' ? 'page' : 'false'}" aria-pressed="${parte === 'mp'}">Materias primas</a>
    <a class="pastilla" href="#finanzas/costos/revision" aria-current="${parte === 'revision' ? 'page' : 'false'}" aria-pressed="${parte === 'revision'}">Revisión de datos${n ? ` <span class="chip c-rojo chip-chico">${n}</span>` : ''}</a></div>`;
}
const lista = () => Object.values((st.datos && st.datos.costos) || {});
function revision() {
  const items = FC.revisarDatos({ costos: st.datos.costos, mps: st.prod.mps || [], recetas: st.prod.recetas || [] });
  return { pendientes: items.filter(i => FC.pendiente(i, st.datos.marcas)), revisados: items.filter(i => !FC.pendiente(i, st.datos.marcas)) };
}
function pintarCostos(el, parte, H) {
  const rv = revision();
  el.innerHTML = cab('costos') + subPestanas(parte, rv.pendientes.length) + (parte === 'revision' ? htmlRevision(rv, H) : htmlMaestro(H));
  if (parte === 'revision') conectarRevision(el, rv, H); else conectarMaestro(el, H);
}

// ── Materias primas ──
const FILTROS = [['todas', 'Todas'], ['problemas', 'Con problemas'], ['insumo', 'Insumos'], ['sub_receta', 'Sub recetas'], ['archivada', 'Archivadas']];
function filtrar(xs, f, q) {
  const r = xs.filter(m => f === 'archivada' ? m.estado === 'archivada' : m.estado !== 'archivada')
    .filter(m => f === 'problemas' ? FC.problemasMp(m).length > 0 : f === 'insumo' ? m.tipo === 'insumo' : f === 'sub_receta' ? m.tipo === 'sub_receta' : true)
    .filter(m => !normalizar(q) || coincide(`${m.nombre} ${m.id} ${m.unidadCompra || ''}`, q));
  return r.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}
function htmlMaestro(H) {
  const xs = lista(), activas = xs.filter(m => m.estado !== 'archivada');
  const cuenta = k => k === 'todas' ? activas.length : filtrar(xs, k, '').length;
  const ult = st.datos.ultimaCarga;
  const prodAviso = st.cx.prod.estado !== 'ok' ? '<p class="aviso" style="margin-top:12px">La base de Producción no está conectada: la lista de materias primas y recetas no se puede leer. Conéctala en <a href="#produccion">Producción</a>.</p>' : '';
  return `<section class="tarjeta" aria-labelledby="t-fin-mp">
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-mp">Maestro de materias primas ${H.info('Maestro de materias primas con costos', 'Cada materia prima o insumo con lo que trae una unidad de compra (contenido en g, ml o unidades) y su precio neto. Con eso sale el precio por kg, l o unidad que usa el costeo.\nLos precios parten de la planilla (MP_maestro). Más adelante se actualizan solos con la última compra del SII. Lo que cambies a mano queda "A mano" y la planilla no lo vuelve a pisar.\nCada cambio queda en el historial, con fecha, quién y motivo: nada se borra.\nEl impuesto adicional (harina) se guarda, pero no se suma al costo: en la harina es IVA anticipado y se recupera.\nLas sub recetas aparecen en la lista, pero su costo se calculará de su receta (paso 3).\nSe guarda en la base de Gastos (fen-gastos): las jefas no lo ven.')}</h2>
      <button type="button" class="${xs.length ? 'btn-sec' : 'btn'}" id="fin-traer">${ic('bajar', 18)} Traer precios desde la planilla</button></div>
    <p class="ayuda" id="fin-resumen">${xs.length ? `${nf(activas.length)} activas · ${nf(cuenta('problemas'))} con problemas · última carga desde la planilla: ${ult ? `${fechaTxt(ult.fecha)} (${nf(ult.nuevas)} nuevas, ${nf(ult.cambian)} con cambios)` : '—'}` : 'Todavía no hay precios: tráelos desde la planilla (MP_maestro).'}</p>
    <p class="ok-texto" id="fin-msg" role="status">${H.esc(st.msg)}</p><p class="error" id="fin-err" role="alert">${H.esc(st.err)}</p>
    ${prodAviso}
    ${xs.length ? `<div class="filtros fin-filtros">
      <div class="fin-buscar">${ic('lupa', 18)}<label class="sr" for="fin-q">Buscar materia prima</label><input type="search" id="fin-q" placeholder="Buscar por nombre…" autocomplete="off" spellcheck="false" value="${H.esc(st.q)}"></div>
      <div class="chips" role="group" aria-label="Filtrar">${FILTROS.map(([k, t]) => `<button type="button" class="chip-filtro" data-fin-filtro="${k}" aria-pressed="${st.filtro === k}">${t} <span class="fin-cuenta">${nf(cuenta(k))}</span></button>`).join('')}</div></div>
    <div class="fin-tabla" aria-label="Materias primas con costos">
      <div class="fin-fila fin-cab" aria-hidden="true"><span>Nombre</span><span>Unidad de compra</span><span>Contenido</span><span>Precio neto</span><span>Precio por kg, l o un</span><span>Origen</span><span>Cambio</span></div>
      <div id="fin-filas"></div></div>` : ''}
  </section>`;
}
function filaMp(m, H) {
  const pr = FC.problemasMp(m), lec = m.contenido ? FC.porLectura(m.precioPorBase, m.contenido.unidad) : null;
  const v = m.anterior ? FC.variacion(m.precioPorBase, m.anterior.precioPorBase) : null;
  const cambio = v && v.dir !== 'igual' ? `<span class="fin-var ${v.dir === 'sube' ? 'fin-sube' : 'fin-baja'}" title="Contra el precio anterior (${H.esc(fechaTxt(m.anterior.fecha))})">${ic(v.dir, 14)}${FC.textoVariacion(v)}<span class="sr">${v.dir === 'sube' ? 'subió' : 'bajó'} contra el precio anterior</span></span>` : v ? '<span class="ayuda">igual</span>' : '';
  const esSub = m.tipo === 'sub_receta';
  return `<div class="fin-fila"><button type="button" class="fin-abrir" data-fin-mp="${H.esc(m.id)}">
    <span class="fin-nombre"><b>${H.esc(m.nombre)}</b>${m.tipo !== 'mp' ? ` <span class="chip c-gris chip-chico">${TIPO[m.tipo]}</span>` : ''}${pr.map(p => ` <span class="chip c-rojo chip-chico">${H.esc(p.texto.replace(/^Contenido: .*/, 'Contenido dudoso'))}</span>`).join('')}</span>
    <span><span class="fin-et">Unidad de compra</span>${H.esc(m.unidadCompra || '—')}</span>
    <span><span class="fin-et">Contenido</span>${FC.textoContenido(m.contenido)}</span>
    <span><span class="fin-et">Precio neto</span>${esSub ? '<span class="ayuda">se calcula de su receta</span>' : m.precioNeto > 0 ? FC.pesos(m.precioNeto) : '—'}</span>
    <span><span class="fin-et">Por kg, l o un</span>${esSub ? '—' : lec ? `<b>${lec.texto}</b>` : '—'}</span>
    <span><span class="fin-et">Origen</span>${ORIGEN[m.origen] || H.esc(m.origen || '—')} <span class="ayuda">${fechaTxt(m.fecha)}</span></span>
    <span><span class="fin-et">Cambio</span>${cambio || '<span class="ayuda">—</span>'}</span></button></div>`;
}
function pintarFilas(H) {
  const xs = filtrar(lista(), st.filtro, st.q), c = $('fin-filas'); if (!c) return;
  c.innerHTML = xs.length ? xs.map(m => filaMp(m, H)).join('') : '<div class="vacio">Nada con ese filtro.</div>';
}
function conectarMaestro(el, H) {
  pintarFilas(H);
  const q = $('fin-q');
  if (q) q.addEventListener('input', () => { st.q = q.value; pintarFilas(H); });
  el.querySelectorAll('[data-fin-filtro]').forEach(b => b.addEventListener('click', () => {
    st.filtro = b.dataset.finFiltro; el.querySelectorAll('[data-fin-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarFilas(H);
  }));
  const filas = $('fin-filas');
  if (filas) filas.addEventListener('click', ev => { const b = ev.target.closest('[data-fin-mp]'); if (b) editar(b.dataset.finMp, el, H, 'mp'); });
  $('fin-traer').addEventListener('click', () => traer(el, H));
}

// ── Traer precios desde la planilla: vista previa → confirmar ──
async function traer(el, H) {
  const btn = $('fin-traer'); st.msg = ''; st.err = ''; $('fin-msg').textContent = ''; $('fin-err').textContent = '';
  btn.disabled = true; btn.lastChild.textContent = ' Leyendo la planilla…';
  let r;
  try { r = await F.prepararCarga(); } catch (e) { $('fin-err').textContent = error(e, H); btn.disabled = false; btn.lastChild.textContent = ' Traer precios desde la planilla'; return; }
  btn.disabled = false; btn.lastChild.textContent = ' Traer precios desde la planilla';
  const p = r.plan, total = p.nuevas.length + p.cambian.length + p.metadatos.length;
  const li = (xs, f) => xs.length ? `<ul class="fin-prev-lista">${xs.map(f).join('')}</ul>` : '';
  const precioTxt = d => d.tipo === 'sub_receta' ? 'sub receta' : `${d.precioNeto > 0 ? FC.pesos(d.precioNeto) : 'sin precio'} por ${FC.textoContenido(d.contenido)}`;
  const det = (t, n, cuerpo, abierto) => n ? `<details class="fin-prev" ${abierto ? 'open' : ''}><summary>${t} <span class="chip c-gris chip-chico">${nf(n)}</span></summary>${cuerpo}</details>` : '';
  const d = H.dialogo(`<form method="dialog" class="form-dialogo" id="fin-prev-form">
    <h2>Traer precios desde la planilla</h2>
    <p class="ayuda">Se leyeron ${nf(r.filas)} filas de MP_maestro${r.prodError ? '' : ' y la lista de Producción'}. Todavía no se guardó nada.</p>
    ${r.prodError ? '<p class="aviso">No se pudo leer la lista de Producción: se usan los nombres y estados de la planilla.</p>' : ''}
    <div class="fin-prev-cifras">
      <div><b>${nf(p.nuevas.length)}</b><span>nuevas</span></div><div><b>${nf(p.cambian.length)}</b><span>cambian de precio</span></div>
      <div><b>${nf(p.respetadas.length)}</b><span>se respetan (a mano o SII)</span></div><div><b>${nf(p.conProblema)}</b><span>con problemas</span></div></div>
    ${det('Nuevas', p.nuevas.length, li(p.nuevas, x => `<li><b>${H.esc(x.doc.nombre)}</b> · ${H.esc(precioTxt(x.doc))}${x.doc.contenidoProblema ? ` <span class="chip c-rojo chip-chico">${H.esc(x.doc.contenidoProblema)}</span>` : ''}</li>`), p.nuevas.length <= 12)}
    ${det('Cambian en la planilla', p.cambian.length, li(p.cambian, x => `<li><b>${H.esc(x.nombre)}</b> · ${H.esc(precioTxt(x.antes))} → ${H.esc(precioTxt(x.doc))} <span class="ayuda">(${H.esc(x.cambios.join(', '))})</span></li>`), true)}
    ${det('Se respetan: tienen precio a mano o del SII (no se tocan)', p.respetadas.length, li(p.respetadas, x => `<li><b>${H.esc(x.nombre)}</b> · queda ${H.esc(precioTxt(x.actual))} (${H.esc(ORIGEN[x.origen] || x.origen)}); la planilla dice ${H.esc(precioTxt(x.planilla))}</li>`), true)}
    ${det('Cambian solo nombre, tipo o estado', p.metadatos.length, li(p.metadatos, x => `<li><b>${H.esc(x.nombre)}</b></li>`), false)}
    ${p.sinId.length ? `<p class="aviso">Ids que no se pueden usar (se saltan): ${H.esc(p.sinId.join(', '))}</p>` : ''}
    ${total ? '' : `<p class="ok-texto">Todo igual a la planilla${p.respetadas.length ? ' (salvo las que tienen precio a mano o del SII, que se respetan)' : ''}.</p>`}
    <p class="error" id="fin-prev-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="fin-prev-no">${total ? 'Cancelar' : 'Cerrar'}</button>${total ? `<button type="button" class="btn" id="fin-prev-si">Guardar ${nf(total)} ${total === 1 ? 'cambio' : 'cambios'}</button>` : ''}</div></form>`);
  d.querySelector('#fin-prev-no').addEventListener('click', () => d.close());
  const si = d.querySelector('#fin-prev-si');
  if (si) si.addEventListener('click', async () => {
    si.disabled = true; si.textContent = 'Guardando…';
    try {
      await F.aplicarCarga(p);
      H.registrar('Finanzas: trajo precios desde la planilla', `${p.nuevas.length} nuevas, ${p.cambian.length} con cambios, ${p.respetadas.length} respetadas`);
      st.msg = `Listo: ${nf(p.nuevas.length)} nuevas, ${nf(p.cambian.length)} con precio nuevo${p.respetadas.length ? `, ${nf(p.respetadas.length)} respetadas` : ''}.`;
      d.close(); await recargar(); pintarCostos(el, 'mp', H);
    } catch (e) { d.querySelector('#fin-prev-err').textContent = error(e, H); si.disabled = false; si.textContent = `Guardar ${nf(total)} cambios`; }
  });
}

// ── Editar un precio (con motivo) e historial ──
function enUnidadLectura(c) {
  if (!FC.contenidoValido(c)) return { cantidad: '', unidad: 'kg' };
  if (c.unidad === 'g') return c.cantidad >= 1000 ? { cantidad: c.cantidad / 1000, unidad: 'kg' } : { cantidad: c.cantidad, unidad: 'g' };
  if (c.unidad === 'ml') return c.cantidad >= 1000 ? { cantidad: c.cantidad / 1000, unidad: 'l' } : { cantidad: c.cantidad, unidad: 'ml' };
  return { cantidad: c.cantidad, unidad: 'un' };
}
function editar(id, el, H, volver) {
  const m = st.datos.costos[id]; if (!m) return;
  const esSub = m.tipo === 'sub_receta', c = enUnidadLectura(m.contenido), lec = m.contenido ? FC.porLectura(m.precioPorBase, m.contenido.unidad) : null;
  const pr = FC.problemasMp(m);
  const d = H.dialogo(`<form class="form-dialogo" id="fin-ed" novalidate>
    <h2>${H.esc(m.nombre)}</h2>
    <p class="ayuda">${TIPO[m.tipo] || ''} · ${H.esc(id)} · unidad de compra en la planilla: <b>${H.esc(m.unidadCompra || '—')}</b>${m.impAdicionalPct ? ` · impuesto adicional ${nf(m.impAdicionalPct)} % (no se suma al costo)` : ''}</p>
    ${pr.length ? `<p class="aviso">${pr.map(p => H.esc(p.texto)).join(' · ')}</p>` : ''}
    ${m.contenidoNota ? `<p class="ayuda">${H.esc(m.contenidoNota)}</p>` : ''}
    <p class="fin-actual">Ahora: ${esSub ? 'se calcula de su receta' : `${m.precioNeto > 0 ? FC.pesos(m.precioNeto) + ' neto' : 'sin precio'} por ${FC.textoContenido(m.contenido)}${lec ? ` → <b>${lec.texto}</b>` : ''}`} · ${ORIGEN[m.origen] || ''} ${fechaTxt(m.fecha)}</p>
    ${esSub ? '<p class="aviso">El costo de una sub receta se calcula de su receta (llega en el paso 3: motor de costeo). Aquí no se edita.</p>' : `
    <div class="grilla-montos">
      <div class="campo"><label for="fin-precio">Precio por unidad de compra</label><input id="fin-precio" type="number" inputmode="decimal" min="0" step="any" value="${m.precioNeto > 0 ? H.esc(String(m.precioNeto)) : ''}" required>
        <label class="check fin-check"><input type="checkbox" id="fin-coniva"> Lo escribo con IVA (19 %) ${H.info('Precio con IVA', 'Si copias el precio de una boleta o de la góndola, marca esta casilla: se guarda el neto (precio ÷ 1,19). Todo en Finanzas va en neto.')}</label></div>
      <div class="campo"><span class="rotulo-campo" id="fin-cont-l">Una unidad de compra trae</span>
        <div class="fin-cont" role="group" aria-labelledby="fin-cont-l"><label class="sr" for="fin-cant">Cantidad</label><input id="fin-cant" type="number" inputmode="decimal" min="0" step="any" value="${H.esc(String(c.cantidad))}">
        <label class="sr" for="fin-uni">Unidad</label><select id="fin-uni">${['kg', 'g', 'l', 'ml', 'un'].map(u => `<option value="${u}" ${u === c.unidad ? 'selected' : ''}>${u === 'un' ? 'unidades' : u}</option>`).join('')}</select></div></div>
    </div>
    <div class="campo ${c.unidad === 'un' ? '' : 'oculto'}" id="fin-peso-c"><label for="fin-peso">Peso de una unidad, en gramos (opcional)</label><input id="fin-peso" type="number" inputmode="decimal" min="0" step="any" value="${m.pesoPorUnidad > 0 ? H.esc(String(m.pesoPorUnidad)) : ''}"><span class="ayuda">Solo si alguna receta la usa en gramos (por ejemplo, huevos).</span></div>
    <p class="fin-calc" id="fin-calc" aria-live="polite"></p>
    <div class="campo"><label for="fin-motivo">Motivo del cambio</label><input id="fin-motivo" type="text" maxlength="160" placeholder="Ej.: factura nueva del proveedor" required></div>
    <p class="error" id="fin-ed-err" role="alert"></p>`}
    <div class="botones"><button type="button" class="btn-sec" id="fin-ed-no">${esSub ? 'Cerrar' : 'Cancelar'}</button>${esSub ? '' : '<button type="submit" class="btn" id="fin-ed-si">Guardar</button>'}</div>
    <div class="fin-hist"><h3>Historial ${H.info('Historial de precios', 'Cada cambio de precio o contenido queda aquí con su fecha, origen, motivo y quién lo hizo. No se borra ni se edita.')}</h3><div id="fin-hist-lista"><p class="ayuda">Cargando…</p></div></div>
  </form>`);
  d.querySelector('#fin-ed-no').addEventListener('click', () => d.close());
  F.historial(id).then(hs => {
    const c2 = d.querySelector('#fin-hist-lista'); if (!c2) return;
    c2.innerHTML = hs.length ? `<ul class="fin-hist-lista">${hs.map(h => { const l = h.contenido ? FC.porLectura(h.precioPorBase, h.contenido.unidad) : null; return `<li><div><b>${fechaTxt(h.fecha)}</b> · ${h.precioNeto > 0 ? FC.pesos(h.precioNeto) : 'sin precio'} por ${FC.textoContenido(h.contenido)}${l ? ` (${l.texto})` : ''}</div><span class="ayuda">${ORIGEN[h.origen] || H.esc(h.origen || '')} · ${H.esc(h.motivo || '')}${h.por ? ` · ${H.esc(h.por)}` : ''}</span></li>`; }).join('')}</ul>` : '<p class="ayuda">Sin cambios todavía.</p>';
  }).catch(e => { const c2 = d.querySelector('#fin-hist-lista'); if (c2) c2.innerHTML = `<p class="error">${H.esc(error(e, H))}</p>`; });
  if (esSub) return;
  const leerForm = () => ({ precioNeto: d.querySelector('#fin-precio').value, conIva: d.querySelector('#fin-coniva').checked, contenido: { cantidad: d.querySelector('#fin-cant').value, unidad: d.querySelector('#fin-uni').value }, pesoPorUnidad: d.querySelector('#fin-peso').value, motivo: d.querySelector('#fin-motivo').value });
  const calc = () => {
    const x = leerForm(); d.querySelector('#fin-peso-c').classList.toggle('oculto', x.contenido.unidad !== 'un');
    let t = '';
    try {
      const { doc } = FC.edicion({ ...m, id }, { ...x, motivo: x.motivo || '-' });
      const l = FC.porLectura(doc.precioPorBase, doc.contenido.unidad), v = FC.variacion(doc.precioPorBase, m.precioPorBase);
      t = `${x.conIva ? `Neto: ${FC.pesos(doc.precioNeto)} · ` : ''}Precio por ${l.por}: ${l.texto}${v && v.dir !== 'igual' ? ` (${FC.textoVariacion(v)} contra ahora)` : ''}`;
    } catch (e) { t = ''; }
    d.querySelector('#fin-calc').textContent = t;
  };
  ['#fin-precio', '#fin-coniva', '#fin-cant', '#fin-uni'].forEach(s => d.querySelector(s).addEventListener('input', calc));
  d.querySelector('#fin-uni').addEventListener('change', calc);
  calc();
  d.querySelector('#fin-ed').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#fin-ed-err'), b = d.querySelector('#fin-ed-si'); err.textContent = '';
    const x = leerForm();
    try { FC.edicion({ ...m, id }, x); } catch (e) { err.textContent = e.message; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await F.guardarPrecio(id, x);
      H.registrar('Finanzas: cambió un precio', `${m.nombre}: ${x.motivo}`);
      st.msg = `${m.nombre}: precio guardado.`; st.err = '';
      d.close(); await recargar(); pintarCostos(el, volver, H);
    } catch (e) { err.textContent = error(e, H); b.disabled = false; b.textContent = 'Guardar'; }
  });
}

// ── Revisión de datos ──
function htmlRevision(rv, H) {
  const lista = st.verRevisados ? rv.revisados : rv.pendientes;
  const sinProd = st.cx.prod.estado !== 'ok' || (st.prod && st.prod.error);
  const grupos = FC.GRUPOS.map(([k, t, ayuda]) => {
    const xs = lista.filter(i => i.grupo === k);
    if (!xs.length) return '';
    return `<section class="tarjeta fin-grupo" aria-labelledby="t-fin-g-${k}">
      <div class="titulo-fila"><h2 id="t-fin-g-${k}">${t} ${H.info(t, ayuda)}</h2><span class="chip ${st.verRevisados ? 'c-gris' : 'c-rojo'}">${nf(xs.length)}</span></div>
      ${xs.map(i => { const marca = (st.datos.marcas || {})[FC.idRevision(i.clave)]; return `<div class="fila-caja fin-item"><div class="txt"><b>${H.esc(i.titulo)}</b><span>${H.esc(i.detalle)}</span>${st.verRevisados && marca && marca.revisado ? `<span class="ayuda">Revisado por ${H.esc(marca.revisado.por)} el ${fechaTxt(marca.revisado.fecha)}</span>` : ''}</div>
        <div class="acciones">${i.mp && st.datos.costos[i.mp] && ['sin_precio', 'contenido', 'raro', 'unidad'].includes(i.grupo) ? `<button type="button" class="btn-sec" data-fin-corregir="${H.esc(i.mp)}">Corregir</button>` : i.receta ? '<a class="btn-sec fin-enlace" href="#produccion">Ver en Producción</a>' : ''}
        <button type="button" class="btn-sec" data-fin-rev="${H.esc(i.clave)}">${st.verRevisados ? 'Volver a la lista' : `${ic('check', 16)} Marcar revisado`}</button></div></div>`; }).join('')}
    </section>`;
  }).join('');
  return `<section class="tarjeta" aria-labelledby="t-fin-rev">
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-rev">Revisión de datos ${H.info('Revisión de datos', 'Lista de lo que parece mal en el maestro de costos y en las recetas aprobadas: sin precio, contenido que no se entiende, precios raros, ingredientes sin costo, unidades que no calzan y recetas sin rendimiento.\n"Corregir" abre el precio de esa materia prima. Lo de las recetas se corrige en la receta.\nSi algo está bien así, márcalo "revisado": sale de la lista y vuelve solo si cambia.')}</h2>
      <button type="button" class="btn-sec" id="fin-ver-rev" aria-pressed="${st.verRevisados}">${st.verRevisados ? 'Ver pendientes' : `Ver revisados (${nf(rv.revisados.length)})`}</button></div>
    <p class="ayuda">${st.verRevisados ? `${nf(rv.revisados.length)} marcados como revisados.` : rv.pendientes.length ? `${nf(rv.pendientes.length)} por revisar.` : lista.length === 0 && Object.keys(st.datos.costos).length ? 'Nada por revisar.' : 'Trae los precios desde la planilla para empezar.'}</p>
    ${sinProd ? '<p class="aviso">Sin la base de Producción no se revisan las recetas (solo el maestro de costos). Conéctala en <a href="#produccion">Producción</a>.</p>' : ''}
    <p class="ok-texto" id="fin-msg" role="status">${H.esc(st.msg)}</p><p class="error" id="fin-err" role="alert"></p>
  </section>${grupos}`;
}
function conectarRevision(el, rv, H) {
  $('fin-ver-rev').addEventListener('click', () => { st.verRevisados = !st.verRevisados; st.msg = ''; pintarCostos(el, 'revision', H); });
  el.querySelectorAll('[data-fin-corregir]').forEach(b => b.addEventListener('click', () => editar(b.dataset.finCorregir, el, H, 'revision')));
  el.querySelectorAll('[data-fin-rev]').forEach(b => b.addEventListener('click', async () => {
    const it = [...rv.pendientes, ...rv.revisados].find(i => i.clave === b.dataset.finRev); if (!it) return;
    b.disabled = true;
    try {
      await F.marcarRevisado(it, !st.verRevisados);
      st.msg = st.verRevisados ? `${it.titulo}: vuelve a la lista.` : `${it.titulo}: revisado.`;
      await recargar(); pintarCostos(el, 'revision', H);
    } catch (e) { $('fin-err').textContent = error(e, H); b.disabled = false; }
  }));
}
