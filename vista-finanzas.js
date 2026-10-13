// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Finanzas  v0.58.0 (F1 pasos 1, 2 y 3)
//  Pestañas: Cómo trabajamos (el método acordado el 12-oct, fijo) · Costos (Productos, Materias primas, Compras del SII y Revisión de datos).
//  v0.58.0: Costos → Productos (costo directo por producto con el motor finanzas-motor.js; detalle por ingrediente, historial,
//  alzas sobre el % de aviso y Ajustes de Finanzas). Rutas: #finanzas/costos/productos[/alzas | /r/{recetaId}].
//  Más adelante: Márgenes, Resultados, Flujo de caja y Metas.
//  Datos en fen-gastos (finanzas.js); reglas puras en finanzas-costos.js. Solo administración: nada va a Cocina.
//  H = ayudas de app.js: { esc, info, registrar, mensajeError, hace, dialogo }
// ═══════════════════════════════════════════════
import * as F from './finanzas.js?v=0.58.0';
import * as FC from './finanzas-costos.js?v=0.58.0';
import * as FS from './finanzas-sii.js?v=0.58.0';
import * as FM from './finanzas-motor.js?v=0.58.0';
import { normalizar, coincide, conBuscador } from './buscador.js?v=0.58.0';

const st = { datos: null, prod: null, cx: null, filtro: 'todas', q: '', msg: '', err: '', cargando: false, verRevisados: false, compras: null, cFiltro: '', cQ: '',
  pr: null, pArea: 'todas', pQ: '', pOrden: 'nombre', calcErr: '' };
const $ = id => document.getElementById(id);
const nf = v => Number(v || 0).toLocaleString('es-CL');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaTxt = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '—'; };
const ORIGEN = { planilla: 'Planilla', manual: 'A mano', sii: 'SII' };
const TIPO = { mp: 'Materia prima', insumo: 'Insumo', sub_receta: 'Sub receta' };
// v0.57.0: "SII · Proveedor · F.123" cuando el precio viene de una compra del SII
const origenTxt = (m, H) => FS.textoOrigenSii(m) ? H.esc(FS.textoOrigenSii(m)) : (ORIGEN[m.origen] || H.esc(m.origen || '—'));

// Íconos lineales propios de esta pantalla
const PI = {
  dia: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cierre: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  informe: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  decision: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
  meta: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>', sube: '<path d="M12 19V5M6 11l6-6 6 6"/>', baja: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', bajar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  neto: '<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="9"/>', fuente: '<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6"/>', candado: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  factura: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  revisar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>', atras: '<path d="M19 12H5M11 6l-6 6 6 6"/>', no: '<circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/>'
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
    <a role="tab" href="#finanzas/costos/productos" aria-selected="${tab === 'costos'}">Costos</a></div></div>
  <p class="fin-pronto">Próximamente: Márgenes, Resultados, Flujo de caja, Metas</p>`;

export async function pintar(el, sub, H) {
  const p = partes(), tab = p[1] === 'costos' ? 'costos' : 'como';
  st.msg = ''; st.err = '';
  if (tab === 'como') { el.innerHTML = cab(tab) + comoTrabajamos(H); return; }
  const parte = p[2] === 'revision' ? 'revision' : p[2] === 'compras' ? 'compras' : p[2] === 'productos' ? 'productos' : 'mp';
  el.innerHTML = cab(tab) + subPestanas(parte, null) + '<section class="tarjeta"><div class="vacio" style="border:0">Abriendo los costos…</div></section>';
  try {
    st.cx = await F.conexiones();
    if (st.cx.gastos.estado !== 'ok') return sinBase(el, tab, H);
    await recargar();
    // v0.58.0: al abrir Costos se recalcula el costo de todos los productos (en este equipo; cada 2 minutos como máximo)
    st.calcErr = '';
    if (st.cx.prod.estado === 'ok' && (!F.ultimoResultado() || F.calculadoHace() > 120000)) {
      el.innerHTML = cab(tab) + subPestanas(parte, null) + '<section class="tarjeta"><div class="vacio" style="border:0" role="status" id="fin-calculando">Calculando… el costo de todos los productos con los precios de hoy.</div></section>';
      try { await F.recalcularRecetas({ costos: st.datos.costos }); st.pr = await F.leerProductos(); } catch (e) { st.calcErr = error(e, H); }
    }
  } catch (e) { el.innerHTML = cab(tab) + `<section class="tarjeta"><p class="error" role="alert">${H.esc(error(e, H))}</p></section>`; return; }
  if (partes()[1] !== 'costos') return;
  pintarCostos(el, parte, H);
}
async function recargar(conCompras) {
  const [d, prod, c, pr] = await Promise.all([F.leer(), st.cx && st.cx.prod.estado === 'ok' ? F.produccion() : Promise.resolve({ mps: [], recetas: [], error: 'sin conexión' }),
    conCompras || partes()[2] === 'compras' ? F.leerCompras() : Promise.resolve(st.compras), F.leerProductos().catch(() => null)]);
  st.datos = d; st.prod = prod; st.compras = c; st.pr = pr;
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
  const nc = st.datos && st.datos.porConfirmar ? st.datos.porConfirmar.length : 0;
  return `<div class="pastillas fin-sub" role="group" aria-label="Partes de Costos">
    <a class="pastilla" href="#finanzas/costos/productos" aria-current="${parte === 'productos' ? 'page' : 'false'}" aria-pressed="${parte === 'productos'}">Productos</a>
    <a class="pastilla" href="#finanzas/costos" aria-current="${parte === 'mp' ? 'page' : 'false'}" aria-pressed="${parte === 'mp'}">Materias primas</a>
    <a class="pastilla" href="#finanzas/costos/compras" aria-current="${parte === 'compras' ? 'page' : 'false'}" aria-pressed="${parte === 'compras'}">Compras del SII${nc ? ` <span class="chip c-amarillo chip-chico" title="Precios por confirmar">${nc}</span>` : ''}</a>
    <a class="pastilla" href="#finanzas/costos/revision" aria-current="${parte === 'revision' ? 'page' : 'false'}" aria-pressed="${parte === 'revision'}">Revisión de datos${n ? ` <span class="chip c-rojo chip-chico">${n}</span>` : ''}</a></div>`;
}
const lista = () => Object.values((st.datos && st.datos.costos) || {});
// v0.58.0: productos aprobados con costo incompleto (del último cálculo guardado)
const productosIncompletos = () => Object.entries((st.pr && st.pr.docs) || {}).filter(([, d]) => d && d.aprobada && (d.incompleto || []).length).sort((a, b) => String(a[1].nombre).localeCompare(String(b[1].nombre), 'es'));
const GRUPOS = [...FC.GRUPOS, ['producto_incompleto', 'Productos con costo incompleto', 'Productos y sub recetas aprobados a los que les falta algo para tener su costo completo: un ingrediente sin precio, una unidad que no calza, una sub receta incompleta o sin rendimiento. Su costo se muestra con lo que sí tiene costo. "Ver costo" abre su detalle.']];
function revision() {
  const items = FC.revisarDatos({ costos: st.datos.costos, mps: st.prod.mps || [], recetas: st.prod.recetas || [] })
    .concat(productosIncompletos().map(([id, d]) => ({ clave: `producto_incompleto:${id}`, grupo: 'producto_incompleto', titulo: d.nombre || id, detalle: d.incompleto.join(' · '), producto: id, huella: JSON.stringify(d.incompleto) })));
  return { pendientes: items.filter(i => FC.pendiente(i, st.datos.marcas)), revisados: items.filter(i => !FC.pendiente(i, st.datos.marcas)) };
}
function pintarCostos(el, parte, H) {
  const rv = revision();
  if (parte === 'productos') { const p = partes(); if (p[3] === 'r' && p[4]) return pintarDetalle(el, decodeURIComponent(p[4]), rv, H); }
  el.innerHTML = cab('costos') + subPestanas(parte, rv.pendientes.length) + (parte === 'revision' ? htmlRevision(rv, H) : parte === 'compras' ? htmlCompras(H) : parte === 'productos' ? htmlProductos(H) : htmlMaestro(H));
  if (parte === 'revision') conectarRevision(el, rv, H); else if (parte === 'compras') conectarCompras(el, H); else if (parte === 'productos') conectarProductos(el, H); else conectarMaestro(el, H);
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
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-mp">Maestro de materias primas ${H.info('Maestro de materias primas con costos', 'Cada materia prima o insumo con lo que trae una unidad de compra (contenido en g, ml o unidades) y su precio neto. Con eso sale el precio por kg, l o unidad que usa el costeo.\nLos precios parten de la planilla (MP_maestro). Se actualizan solos con la última compra del SII (Compras del SII), en neto: lo que trae una unidad de la factura se lleva a la unidad de compra de cada materia prima. Lo que cambies a mano queda "A mano" y la planilla no lo vuelve a pisar.\nCada cambio queda en el historial, con fecha, quién y motivo: nada se borra.\nEl impuesto adicional (harina) se guarda, pero no se suma al costo: en la harina es IVA anticipado y se recupera.\nLas sub recetas aparecen en la lista, pero su costo sale de su receta (Costos → Productos).\nSe guarda en la base de Gastos (fen-gastos): las jefas no lo ven.')}</h2>
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
    <span><span class="fin-et">Origen</span>${origenTxt(m, H)} <span class="ayuda">${fechaTxt(m.fecha)}</span></span>
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
    <p class="fin-actual">Ahora: ${esSub ? 'se calcula de su receta' : `${m.precioNeto > 0 ? FC.pesos(m.precioNeto) + ' neto' : 'sin precio'} por ${FC.textoContenido(m.contenido)}${lec ? ` → <b>${lec.texto}</b>` : ''}`} · ${origenTxt(m, H)} ${fechaTxt(m.fecha)}</p>
    ${esSub ? '<p class="aviso">El costo de una sub receta se calcula de su receta: míralo en Costos → Productos. Aquí no se edita.</p>' : `
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
  const grupos = GRUPOS.map(([k, t, ayuda]) => {
    const xs = lista.filter(i => i.grupo === k);
    if (!xs.length) return '';
    return `<section class="tarjeta fin-grupo" aria-labelledby="t-fin-g-${k}">
      <div class="titulo-fila"><h2 id="t-fin-g-${k}">${t} ${H.info(t, ayuda)}</h2><span class="chip ${st.verRevisados ? 'c-gris' : 'c-rojo'}">${nf(xs.length)}</span></div>
      ${xs.map(i => { const marca = (st.datos.marcas || {})[FC.idRevision(i.clave)]; return `<div class="fila-caja fin-item"><div class="txt"><b>${H.esc(i.titulo)}</b><span>${H.esc(i.detalle)}</span>${st.verRevisados && marca && marca.revisado ? `<span class="ayuda">Revisado por ${H.esc(marca.revisado.por)} el ${fechaTxt(marca.revisado.fecha)}</span>` : ''}</div>
        <div class="acciones">${i.mp && st.datos.costos[i.mp] && ['sin_precio', 'contenido', 'raro', 'unidad'].includes(i.grupo) ? `<button type="button" class="btn-sec" data-fin-corregir="${H.esc(i.mp)}">Corregir</button>` : i.producto ? `<a class="btn-sec fin-enlace" href="#finanzas/costos/productos/r/${encodeURIComponent(i.producto)}">Ver costo</a>` : i.receta ? '<a class="btn-sec fin-enlace" href="#produccion">Ver en Producción</a>' : ''}
        <button type="button" class="btn-sec" data-fin-rev="${H.esc(i.clave)}">${st.verRevisados ? 'Volver a la lista' : `${ic('check', 16)} Marcar revisado`}</button></div></div>`; }).join('')}
    </section>`;
  }).join('');
  return `<section class="tarjeta" aria-labelledby="t-fin-rev">
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-rev">Revisión de datos ${H.info('Revisión de datos', 'Lista de lo que parece mal en el maestro de costos y en las recetas aprobadas: sin precio, contenido que no se entiende, precios raros, ingredientes sin costo, unidades que no calzan, recetas sin rendimiento y productos con costo incompleto.\n"Corregir" abre el precio de esa materia prima. Lo de las recetas se corrige en la receta.\nSi algo está bien así, márcalo "revisado": sale de la lista y vuelve solo si cambia.')}</h2>
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

// ═══════════════ v0.57.0 · Compras del SII: asociar productos de factura → materia prima, precios por confirmar ═══════════════
const C_FILTROS = [['sin_asociar', 'Sin asociar'], ['asociada', 'Asociadas'], ['ignorada', 'No son materia prima'], ['todas', 'Todas']];
const RESULTADO = { aplicada: 'Precio aplicado', por_confirmar: 'Precio por confirmar', igual: 'Es el precio actual', omitida: 'No cambió el precio' };
function gruposCompras() { const c = st.compras; return c ? FS.agrupar(c.lineas, c.asocs) : []; }
const lecturaPpb = (ppb, unidad) => { const l = FC.porLectura(ppb, unidad); return l ? l.texto : '—'; };
const cantTxt = n => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 3 });

function htmlCompras(H) {
  const c = st.compras;
  if (!c) return '<section class="tarjeta"><div class="vacio" style="border:0">Leyendo las compras del SII…</div></section>';
  const gs = gruposCompras(), cuenta = k => k === 'todas' ? gs.length : gs.filter(g => g.estado === k).length;
  if (!st.cFiltro) st.cFiltro = cuenta('sin_asociar') ? 'sin_asociar' : 'todas';
  const ult = c.ultimaRevision, pend = st.datos.porConfirmar || [];
  const info = H.info('Compras del SII', 'Aquí están los productos de las facturas del SII (tipo 33 y 34) de los últimos 90 días, agrupados por proveedor y producto.\nCada producto se asocia una vez a su materia prima o insumo, con lo que trae UNA unidad de la factura (una línea "HARINA SACO 25 KG" por 10 sacos → 25 kg por unidad). Se aprende: las próximas facturas de ese proveedor y producto se usan solas.\nEl precio de cada materia prima es el neto de su ÚLTIMA compra: precio de la línea (con su descuento) ÷ lo que trae una unidad, llevado a la unidad de compra de la materia prima.\nUn precio a mano más nuevo que la factura no se pisa. Si el precio cambia más de ±40 %, no se aplica solo: queda "por confirmar".\nSe revisa solo al importar un archivo del SII en Gastos (base nueva) y con el botón. Revisar de nuevo no repite nada.\nLas notas de crédito se muestran, pero no cambian precios. Gas, servicios, despacho…: márcalos "No es materia prima".');
  return `<section class="tarjeta" aria-labelledby="t-fin-compras">
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-compras">Compras del SII ${info}</h2>
      <button type="button" class="btn-sec" id="fin-revisar">${ic('revisar', 18)} Revisar compras de los últimos 90 días</button></div>
    <p class="ayuda" id="fin-c-resumen">${nf(gs.length)} ${gs.length === 1 ? 'producto' : 'productos'} en facturas desde el ${fechaTxt(c.desde)} · ${nf(cuenta('sin_asociar'))} sin asociar · ${nf(cuenta('asociada'))} asociados · ${nf(cuenta('ignorada'))} no son materia prima · última revisión: ${ult ? `${fechaTxt(ult.fecha)} (${nf(ult.aplicadas)} ${ult.aplicadas === 1 ? 'precio aplicado' : 'precios aplicados'}${ult.porConfirmar ? `, ${nf(ult.porConfirmar)} por confirmar` : ''})` : '—'}</p>
    <p class="ok-texto" id="fin-msg" role="status">${H.esc(st.msg)}</p><p class="error" id="fin-err" role="alert">${H.esc(st.err)}</p>
    ${c.sinDetalle.length ? `<details class="fin-prev fin-sindet"><summary>${ic('factura', 18)} ${nf(c.sinDetalle.length)} ${c.sinDetalle.length === 1 ? 'factura' : 'facturas'} sin detalle de productos</summary>
      <p class="aviso">Esta carga no trae el detalle de productos (sube el XML para actualizar precios).</p>
      <ul class="fin-prev-lista">${c.sinDetalle.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(d => `<li>${H.esc(d.proveedor || d.rut)} · F.${H.esc(d.folio)} · ${fechaTxt(d.fecha)}</li>`).join('')}</ul></details>` : ''}
  </section>
  ${pend.length ? `<section class="tarjeta fin-pend" aria-labelledby="t-fin-pend">
    <div class="titulo-fila"><h2 id="t-fin-pend">Precios por confirmar ${H.info('Precios por confirmar', 'El precio de la última compra cambia más de ±40 % contra el precio actual. Puede ser un alza real, o la asociación con un contenido mal escrito (por ejemplo, 1 kg en vez de 25 kg).\nConfirmar: aplica el precio de la factura (queda en el historial).\nDescartar: deja el precio como está; escribe el motivo. Si el contenido estaba mal, corrige la asociación y revisa de nuevo.')}</h2><span class="chip c-amarillo">${nf(pend.length)}</span></div>
    ${pend.map(p => { const u = p.nuevo && p.nuevo.contenido ? p.nuevo.contenido.unidad : 'g';
      return `<div class="fila-caja fin-item fin-conf" data-pc="${H.esc(p.id)}"><div class="txt"><b>${H.esc(p.mpNombre)}</b>
        <span class="fin-conf-precios">Ahora ${p.actual && p.actual.precioPorBase ? lecturaPpb(p.actual.precioPorBase, u) : 'sin precio'} → factura <b>${lecturaPpb(p.nuevo.precioPorBase, u)}</b>
          <span class="fin-var ${p.pct > 0 ? 'fin-sube' : 'fin-baja'}">${ic(p.pct > 0 ? 'sube' : 'baja', 14)}${p.pct > 0 ? '+' : '−'}${Math.abs(p.pct).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %</span></span>
        <span class="ayuda">${H.esc(p.sii.proveedor)} · F.${H.esc(p.sii.folio)} · ${fechaTxt(p.sii.fecha)} · ${H.esc(p.sii.nombreItem)}</span></div>
        <div class="acciones"><button type="button" class="btn-sec" data-pc-si="${H.esc(p.id)}">${ic('check', 16)} Confirmar</button><button type="button" class="btn-sec" data-pc-no="${H.esc(p.id)}">Descartar</button></div></div>`; }).join('')}
  </section>` : ''}
  <section class="tarjeta" aria-labelledby="t-fin-prods">
    <div class="titulo-fila"><h2 id="t-fin-prods">Productos de las facturas</h2></div>
    ${gs.length ? `<div class="filtros fin-filtros">
      <div class="fin-buscar">${ic('lupa', 18)}<label class="sr" for="fin-cq">Buscar producto o proveedor</label><input type="search" id="fin-cq" placeholder="Buscar producto o proveedor…" autocomplete="off" spellcheck="false" value="${H.esc(st.cQ)}"></div>
      <div class="chips" role="group" aria-label="Filtrar">${C_FILTROS.map(([k, t]) => `<button type="button" class="chip-filtro" data-fin-cf="${k}" aria-pressed="${st.cFiltro === k}">${t} <span class="fin-cuenta">${nf(cuenta(k))}</span></button>`).join('')}</div></div>
      <div id="fin-compras" class="fin-compras"></div>` : '<div class="vacio">No hay productos de facturas en los últimos 90 días. Se llenan al importar un archivo del SII (XML o XLS con detalle) en Gastos.</div>'}
  </section>`;
}
function filaCompra(g, H) {
  const c = st.compras, a = g.asoc, u = g.ultima;
  const pu = g.precioUnitario, pr = u ? c.procesadas[FS.idLinea(u.id)] : null;
  let estado = '';
  if (g.estado === 'sin_asociar') estado = '<span class="chip c-amarillo chip-chico">Sin asociar</span>';
  else if (g.estado === 'ignorada') estado = `<span class="chip c-gris chip-chico">${ic('no', 13)} No es materia prima</span>`;
  else {
    const ppb = u ? FS.precioPorBaseLinea(u, a.contenidoPorUnidad) : null, m = st.datos.costos[a.mp];
    estado = `<span class="fin-asoc">${ic('enlace', 14)} <b>${H.esc((m && m.nombre) || a.mpNombre || a.mp)}</b></span><span class="ayuda">${FC.textoContenido(a.contenidoPorUnidad)} por unidad${ppb ? ` · ${lecturaPpb(ppb, a.contenidoPorUnidad.unidad)}` : ''}</span>`
      + (pr && pr.huella === FS.huellaAsoc(a) ? `<span class="ayuda fin-res">${H.esc(RESULTADO[pr.resultado] || '')}${pr.motivo && pr.resultado !== 'aplicada' ? `: ${H.esc(pr.motivo)}` : ''}</span>` : '');
  }
  return `<div class="fin-compra">
    <div class="fin-c-prod"><b>${H.esc(g.nombreItem)}</b><span class="ayuda">${H.esc(g.proveedor || g.rut)}${g.codigo ? ` · cód. ${H.esc(g.codigo)}` : ''}</span></div>
    <div class="fin-c-ult">${u ? `<span>${pu ? FC.pesos(pu) : '—'} neto por ${H.esc(u.unidad || 'unidad')}</span><span class="ayuda">${cantTxt(u.cantidad)} ${H.esc(u.unidad || 'un')} · ${fechaTxt(u.fecha)} · F.${H.esc(u.folio)} · ${g.veces} ${g.veces === 1 ? 'compra' : 'compras'}</span>` : '<span class="ayuda">Solo en notas de crédito</span>'}
      ${g.ncs ? `<span class="ayuda">${g.ncs} ${g.ncs === 1 ? 'nota de crédito' : 'notas de crédito'} (no cambian el precio)</span>` : ''}</div>
    <div class="fin-c-est">${estado}</div>
    <div class="fin-c-acc">${u ? `<button type="button" class="btn-sec" data-fin-asoc="${H.esc(g.clave)}">${g.estado === 'sin_asociar' ? 'Asociar' : 'Cambiar'}</button>` : ''}</div></div>`;
}
function pintarCompras(H) {
  const cont = $('fin-compras'); if (!cont) return;
  const xs = gruposCompras().filter(g => st.cFiltro === 'todas' || g.estado === st.cFiltro).filter(g => !normalizar(st.cQ) || coincide(`${g.nombreItem} ${g.proveedor} ${g.codigo} ${g.asoc && g.asoc.mpNombre || ''}`, st.cQ));
  cont.innerHTML = xs.length ? xs.map(g => filaCompra(g, H)).join('') : '<div class="vacio">Nada con ese filtro.</div>';
}
function conectarCompras(el, H) {
  if (!st.compras) { F.leerCompras().then(c => { st.compras = c; pintarCostos(el, 'compras', H); }).catch(e => { const x = $('fin-err'); if (x) x.textContent = error(e, H); else el.insertAdjacentHTML('beforeend', `<p class="error" role="alert">${H.esc(error(e, H))}</p>`); }); return; }
  pintarCompras(H);
  const q = $('fin-cq');
  if (q) q.addEventListener('input', () => { st.cQ = q.value; pintarCompras(H); });
  el.querySelectorAll('[data-fin-cf]').forEach(b => b.addEventListener('click', () => { st.cFiltro = b.dataset.finCf; el.querySelectorAll('[data-fin-cf]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarCompras(H); }));
  const lista = $('fin-compras');
  if (lista) lista.addEventListener('click', ev => { const b = ev.target.closest('[data-fin-asoc]'); if (b) asociar(b.dataset.finAsoc, el, H); });
  $('fin-revisar').addEventListener('click', async () => {
    const b = $('fin-revisar'); b.disabled = true; b.lastChild.textContent = ' Revisando…'; $('fin-err').textContent = '';
    try { const r = await F.preciosDesdeSii({ origen: 'boton' }); H.registrar('Finanzas: revisó las compras del SII', resumenRevision(r)); st.msg = resumenRevision(r); st.err = ''; await recargar(true); pintarCostos(el, 'compras', H); }
    catch (e) { $('fin-err').textContent = error(e, H); b.disabled = false; b.lastChild.textContent = ' Revisar compras de los últimos 90 días'; }
  });
  el.querySelectorAll('[data-pc-si]').forEach(b => b.addEventListener('click', () => resolver(b.dataset.pcSi, true, el, H)));
  el.querySelectorAll('[data-pc-no]').forEach(b => b.addEventListener('click', () => resolver(b.dataset.pcNo, false, el, H)));
}
function resumenRevision(r) {
  const a = r.aplicadas.length;
  return `Listo: ${a ? `${nf(a)} ${a === 1 ? 'precio actualizado' : 'precios actualizados'} (${r.aplicadas.slice(0, 4).map(x => x.nombre).join(', ')}${a > 4 ? '…' : ''})` : 'ningún precio cambió'}${r.porConfirmar ? ` · ${nf(r.porConfirmar)} por confirmar` : ''}${r.sinAsociar ? ` · ${nf(r.sinAsociar)} ${r.sinAsociar === 1 ? 'producto' : 'productos'} sin asociar` : ''}.`;
}
// Confirmar (aplica) o descartar (con motivo) un cambio de más de ±40 %
function resolver(id, confirmar, el, H) {
  const p = (st.datos.porConfirmar || []).find(x => x.id === id); if (!p) return;
  const u = p.nuevo.contenido.unidad;
  const d = H.dialogo(`<form class="form-dialogo" id="fin-pc" novalidate>
    <h2>${confirmar ? 'Confirmar precio' : 'Descartar precio'}: ${H.esc(p.mpNombre)}</h2>
    <p class="fin-actual">Ahora ${p.actual && p.actual.precioPorBase ? lecturaPpb(p.actual.precioPorBase, u) : 'sin precio'} → factura <b>${lecturaPpb(p.nuevo.precioPorBase, u)}</b> (${p.pct > 0 ? '+' : '−'}${Math.abs(p.pct).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %)</p>
    <p class="ayuda">${H.esc(p.sii.proveedor)} · F.${H.esc(p.sii.folio)} · ${fechaTxt(p.sii.fecha)} · ${H.esc(p.sii.nombreItem)}. ${confirmar ? `Queda en ${FC.pesos(p.nuevo.precioNeto)} neto por ${FC.textoContenido(p.nuevo.contenido)}.` : 'El precio actual no cambia.'}</p>
    <div class="campo"><label for="fin-pc-mot">${confirmar ? 'Nota (opcional)' : 'Motivo'}</label><input id="fin-pc-mot" type="text" maxlength="200" ${confirmar ? 'placeholder="Ej.: alza real del proveedor"' : 'placeholder="Ej.: el contenido de la asociación estaba mal" required'}></div>
    <p class="error" id="fin-pc-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="fin-pc-no">Cancelar</button><button type="submit" class="btn" id="fin-pc-si">${confirmar ? 'Confirmar' : 'Descartar'}</button></div></form>`);
  d.querySelector('#fin-pc-no').addEventListener('click', () => d.close());
  d.querySelector('#fin-pc').addEventListener('submit', async ev => {
    ev.preventDefault();
    const mot = d.querySelector('#fin-pc-mot').value, err = d.querySelector('#fin-pc-err'), b = d.querySelector('#fin-pc-si');
    if (!confirmar && !mot.trim()) { err.textContent = 'Escribe por qué lo descartas.'; return; }
    b.disabled = true;
    try {
      await F.resolverPorConfirmar(id, confirmar, mot);
      H.registrar(confirmar ? 'Finanzas: confirmó un precio del SII' : 'Finanzas: descartó un precio del SII', `${p.mpNombre} · ${p.sii.proveedor} F.${p.sii.folio}${mot ? ' · ' + mot : ''}`);
      st.msg = confirmar ? `${p.mpNombre}: precio confirmado (${lecturaPpb(p.nuevo.precioPorBase, u)}).` : `${p.mpNombre}: descartado, el precio no cambia.`; st.err = '';
      d.close(); await recargar(true); pintarCostos(el, 'compras', H);
    } catch (e) { err.textContent = error(e, H); b.disabled = false; }
  });
}

// ── Asociar un producto de factura a su materia prima (o "no es materia prima") ──
const enForm = c => { if (!FC.contenidoValido(c)) return { cantidad: '', unidad: 'kg' }; return enUnidadLectura(c); };
function asociar(clave, el, H) {
  const g = gruposCompras().find(x => x.clave === clave); if (!g || !g.ultima) return;
  const a = g.asoc, u = g.ultima, costos = st.datos.costos;
  const leido = FS.contenidoDeLinea(u.descripcion, u.unidad);
  const c0 = enForm(a && a.contenidoPorUnidad ? a.contenidoPorUnidad : leido.contenido);
  const sug = FS.sugerirMp(g.nombreItem, costos), idsSug = new Set(sug.map(x => x.id));
  const elegibles = Object.values(costos).filter(m => m.tipo !== 'sub_receta' && m.estado !== 'archivada').sort((x, y) => String(x.nombre).localeCompare(String(y.nombre), 'es'));
  const mpSel = a && a.mp ? a.mp : (sug[0] ? sug[0].id : '');
  const opt = (m, t) => `<option value="${H.esc(m.id)}" ${m.id === mpSel ? 'selected' : ''}>${H.esc(t)}</option>`;
  const notaLeido = a && a.contenidoPorUnidad ? 'Lo que se guardó al asociarlo.' : leido.contenido ? (leido.de === 'unidad' ? `La factura cobra por ${H.esc(u.unidad)}: una unidad trae ${FC.textoContenido(leido.contenido)}.` : `Leído del nombre: ${FC.textoContenido(leido.contenido)}.`) + (leido.dudoso ? ` ${H.esc(leido.motivo)}` : '') : H.esc(leido.motivo);
  const ignorar = !!(a && a.ignorar);
  const d = H.dialogo(`<form class="form-dialogo" id="fin-as" novalidate>
    <h2>${a ? 'Cambiar asociación' : 'Asociar producto'}</h2>
    <p class="fin-actual"><b>${H.esc(g.nombreItem)}</b></p>
    <p class="ayuda">${H.esc(g.proveedor || '')} · ${H.esc(g.rut)}${g.codigo ? ` · cód. ${H.esc(g.codigo)}` : ''} · última compra: ${cantTxt(u.cantidad)} ${H.esc(u.unidad || 'un')} a ${g.precioUnitario ? FC.pesos(g.precioUnitario) : '—'} neto c/u (${fechaTxt(u.fecha)}, F.${H.esc(u.folio)})</p>
    <fieldset class="fin-as-tipo"><legend class="sr">Qué es</legend>
      <label class="check"><input type="radio" name="fin-as-t" value="mp" ${ignorar ? '' : 'checked'}> Es una materia prima o insumo</label>
      <label class="check"><input type="radio" name="fin-as-t" value="no" ${ignorar ? 'checked' : ''}> No es materia prima (gas, servicios, despacho…)</label></fieldset>
    <div id="fin-as-mp-c" class="${ignorar ? 'oculto' : ''}">
      <div class="campo"><label for="fin-as-mp">Materia prima o insumo</label><select id="fin-as-mp"><option value="">Elige…</option>
        ${sug.map(x => opt(costos[x.id], `${costos[x.id].nombre} · parecida`)).join('')}${elegibles.filter(m => !idsSug.has(m.id)).map(m => opt(m, m.nombre)).join('')}</select>
        ${sug.length ? '<span class="ayuda">Primero las de nombre parecido.</span>' : ''}</div>
      <div class="campo"><span class="rotulo-campo" id="fin-as-cont-l">Una unidad de la factura trae ${H.info('Contenido por unidad', 'Lo que trae UNA unidad de la línea de la factura, no la línea completa. Ejemplos: "HARINA SACO 25 KG", 10 sacos → 25 kg. "MANTEQUILLA" en KG, 20 KG → 1 kg. "LECHE 1 LT X12" (una caja de 12) → 12 l.\nSe usa para sacar el precio por kg, l o unidad. Si la materia prima se compra por peso, aquí va peso (kg o g); si se compra por unidades, unidades.')}</span>
        <div class="fin-cont" role="group" aria-labelledby="fin-as-cont-l"><label class="sr" for="fin-as-cant">Cantidad</label><input id="fin-as-cant" type="number" inputmode="decimal" min="0" step="any" value="${H.esc(String(c0.cantidad))}">
        <label class="sr" for="fin-as-uni">Unidad</label><select id="fin-as-uni">${['kg', 'g', 'l', 'ml', 'un'].map(x => `<option value="${x}" ${x === c0.unidad ? 'selected' : ''}>${x === 'un' ? 'unidades' : x}</option>`).join('')}</select></div>
        <span class="ayuda">${notaLeido}</span></div>
      <p class="fin-calc" id="fin-as-calc" aria-live="polite"></p>
    </div>
    <div class="campo"><label for="fin-as-nota">Nota (opcional)</label><input id="fin-as-nota" type="text" maxlength="200"></div>
    <p class="error" id="fin-as-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="fin-as-no">Cancelar</button><button type="submit" class="btn" id="fin-as-si">Guardar</button></div>
    ${a ? `<div class="fin-hist"><h3>Historial de la asociación</h3><div id="fin-as-hist"><p class="ayuda">Cargando…</p></div></div>` : ''}
  </form>`);
  const sel = d.querySelector('#fin-as-mp');
  conBuscador(sel);
  d.querySelector('#fin-as-no').addEventListener('click', () => d.close());
  const tipo = () => d.querySelector('input[name="fin-as-t"]:checked').value;
  const leer = () => ({ rut: g.rut, proveedor: g.proveedor, nombreItem: g.nombreItem, codigo: g.codigo, ignorar: tipo() === 'no', mp: tipo() === 'no' ? null : sel.value,
    contenido: { cantidad: d.querySelector('#fin-as-cant').value, unidad: d.querySelector('#fin-as-uni').value }, nota: d.querySelector('#fin-as-nota').value });
  const calc = () => {
    d.querySelector('#fin-as-mp-c').classList.toggle('oculto', tipo() === 'no');
    const x = leer(), out = d.querySelector('#fin-as-calc'), m = costos[x.mp];
    const cont = FS.contenidoDesdeForm(x.contenido.cantidad, x.contenido.unidad);
    if (x.ignorar || !m || !cont) { out.textContent = ''; return; }
    const cand = FS.candidato(u, { contenidoPorUnidad: cont });
    if (!(cand.ppb > 0)) { out.textContent = 'La última línea no trae precio o cantidad.'; return; }
    const r = FS.decidir({ ...m }, cand), lec = lecturaPpb(cand.ppb, cont.unidad);
    out.textContent = r.accion === 'aplicar' ? `${lec} → ${m.nombre} queda en ${FC.pesos(r.nuevo.precioNeto)} neto por ${FC.textoContenido(r.nuevo.contenido)}${r.pct !== null ? ` (${r.pct > 0 ? '+' : ''}${r.pct.toLocaleString('es-CL', { maximumFractionDigits: 1 })} % contra ahora)` : ''}`
      : r.accion === 'confirmar' ? `${lec} · ${r.motivo}: quedará por confirmar` : `${lec} · no cambia el precio: ${r.motivo}`;
  };
  d.querySelectorAll('input[name="fin-as-t"]').forEach(r => r.addEventListener('change', calc));
  ['#fin-as-cant', '#fin-as-uni'].forEach(q => d.querySelector(q).addEventListener('input', calc));
  ['#fin-as-mp', '#fin-as-uni'].forEach(q => d.querySelector(q).addEventListener('change', calc));
  calc();
  if (a) F.historialAsoc(clave).then(hs => {
    const c2 = d.querySelector('#fin-as-hist'); if (!c2) return;
    const t = x => !x ? '—' : x.ignorar ? 'No es materia prima' : `${x.mpNombre || x.mp} · ${FC.textoContenido(x.contenidoPorUnidad)} por unidad`;
    c2.innerHTML = hs.length ? `<ul class="fin-hist-lista">${hs.map(h => `<li><div><b>${fechaTxt(h.fecha)}</b> · ${H.esc(h.accion)}: ${H.esc(t(h.despues))}</div><span class="ayuda">${h.antes ? `Antes: ${H.esc(t(h.antes))} · ` : ''}${H.esc(h.por || '')}${h.nota ? ` · ${H.esc(h.nota)}` : ''}</span></li>`).join('')}</ul>` : '<p class="ayuda">Sin cambios.</p>';
  }).catch(() => {});
  d.querySelector('#fin-as').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#fin-as-err'), b = d.querySelector('#fin-as-si'), x = leer(); err.textContent = '';
    try { FS.armarAsociacion(a, x, { mpDoc: x.mp ? costos[x.mp] : null }); } catch (e) { err.textContent = e.message; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      await F.guardarAsociacion(clave, x);
      const nombre = x.ignorar ? '' : (costos[x.mp] || {}).nombre || x.mp;
      H.registrar('Finanzas: asoció un producto del SII', `${g.proveedor} · ${g.nombreItem} → ${x.ignorar ? 'no es materia prima' : nombre}`);
      let r = null;
      try { r = await F.preciosDesdeSii({ origen: 'asociacion' }); } catch (e) { st.err = `Asociación guardada, pero no se pudieron revisar los precios: ${error(e, H)}`; }
      const ap = r && r.aplicadas.find(y => y.mp === x.mp);
      st.msg = x.ignorar ? `${g.nombreItem}: marcado "No es materia prima".` : `${g.nombreItem} → ${nombre}.${ap ? ` Precio actualizado: ${lecturaPpb(ap.despues, ap.unidad)}.` : r && r.porConfirmar ? ' El precio cambia más de ±40 %: quedó por confirmar.' : ''}`;
      d.close(); await recargar(true); pintarCostos(el, 'compras', H);
    } catch (e) { err.textContent = error(e, H); b.disabled = false; b.textContent = 'Guardar'; }
  });
}

// ═══════════════ v0.58.0 · Costos → Productos: costo directo por producto ═══════════════
const AREAS = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería' };
const hoyTxt = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ORDENES = [['nombre', 'Nombre'], ['costo', 'Costo'], ['alza', 'Mayor alza']];
const costoTxt = d => d.unidad === 'g' ? `${FC.pesos(d.costoUnit * 1000)} / kg` : `${FC.pesos(d.costoUnit)} / un`;
const varHtml = (v, titulo, H) => !v ? '<span class="ayuda">—</span>' : v.dir === 'igual' ? '<span class="ayuda">igual</span>'
  : `<span class="fin-var ${v.dir === 'sube' ? 'fin-sube' : 'fin-baja'}" title="${H.esc(titulo)}">${ic(v.dir, 14)}${FC.textoVariacion(v)}<span class="sr">${v.dir === 'sube' ? 'subió' : 'bajó'} ${H.esc(titulo)}</span></span>`;
const filasP = () => st.pr ? FM.filasProductos(st.pr.docs, st.pr.hist, hoyTxt()) : [];
const alzasP = () => st.pr ? FM.alzas(filasP(), st.pr.vistas, st.pr.alzaAviso) : [];
const causaTxt = h => {
  if (!h) return '';
  const c = (h.causa || []).map(x => `${x.nombre}${x.pct !== null && x.pct !== undefined ? ` ${x.pct > 0 ? '+' : ''}${String(x.pct).replace('.', ',')} %` : x.antes === null ? ' (precio nuevo)' : x.despues === null ? ' (sin precio)' : ''}`);
  if (h.recetaCambio) c.push('cambió la receta');
  return h.primero ? 'Primer cálculo' : c.length ? c.join(', ') : 'otros cambios';
};
function ordenarP(xs, orden) {
  const alza = f => (f.vsMes ? f.vsMes.pct : -Infinity);
  return xs.sort((a, b) => orden === 'costo' ? (b.unidad === 'g' ? b.costoUnit * 1000 : b.costoUnit) - (a.unidad === 'g' ? a.costoUnit * 1000 : a.costoUnit)
    : orden === 'alza' ? alza(b) - alza(a) || String(a.nombre).localeCompare(String(b.nombre), 'es') : String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
function htmlProductos(H) {
  const p = partes(); if (p[3] === 'alzas') st.pOrden = 'alza';
  const todas = filasP(), alzas = alzasP(), umbral = st.pr ? st.pr.alzaAviso : FM.ALZA_DEFECTO;
  const cuenta = a => a === 'todas' ? todas.length : todas.filter(f => f.area === a).length;
  const inc = todas.filter(f => (f.incompleto || []).length).length;
  const calc = F.ultimoResultado();
  const sinProd = st.cx.prod.estado !== 'ok';
  const ayudaTabla = 'Costo directo de una unidad (o de un kg, si la receta rinde gramos), neto: ingredientes al precio de la última compra + sub recetas con su propio costo + insumos y envases + merma de laminado en Bollería, dividido por lo que rinde la receta.\nSolo recetas aprobadas. Se recalcula al abrir Costos y después de cada cambio de precio (a mano o del SII).\nMes anterior: contra el costo que tenía al empezar este mes (el último registrado antes del día 1).\nÚltimo cambio: contra el costo anterior al último cambio de más de 0,5 % (con su fecha).\n"Incompleto": a algún ingrediente le falta precio o una unidad no calza; el costo mostrado es solo lo que sí tiene costo.';
  return `<section class="tarjeta" aria-labelledby="t-fin-prod">
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-prod">Costo directo por producto ${H.info('Costo directo por producto', ayudaTabla)}</h2>
      <span class="ayuda" id="fin-calc-hora">${calc ? `Calculado ${H.esc(new Date(calc.cuando).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))}` : ''}</span></div>
    <p class="ayuda" id="fin-presumen">${todas.length ? `${nf(todas.length)} productos aprobados · ${nf(inc)} con costo incompleto` : sinProd ? '' : 'Todavía no hay productos costeados.'}</p>
    <p class="ok-texto" id="fin-msg" role="status">${H.esc(st.msg)}</p><p class="error" id="fin-err" role="alert">${H.esc(st.calcErr || st.err)}</p>
    ${sinProd ? '<p class="aviso">La base de Producción no está conectada: sin recetas no se puede calcular (se muestra el último cálculo guardado). Conéctala en <a href="#produccion">Producción</a>.</p>' : ''}
    ${alzas.length ? `<div class="fin-alzas" id="fin-alzas" role="region" aria-labelledby="t-fin-alzas">
      <h3 id="t-fin-alzas">${ic('sube', 18)} Subió el costo de ${nf(alzas.length)} ${alzas.length === 1 ? 'producto' : 'productos'} ${H.info('Alzas de costo', `Productos cuyo costo directo por unidad subió más de ${String(umbral).replace('.', ',')} % contra el costo con que empezó el mes (el % se cambia en Ajustes de Finanzas, abajo).\nTambién aparecen en Hoy. "Visto" lo saca de aquí y de Hoy mientras el costo siga igual; si vuelve a subir, avisa de nuevo.\nNo avisan los productos con costo incompleto (su costo no es confiable).`)}</h3>
      <ul class="fin-alzas-lista">${alzas.map(f => `<li data-alza="${H.esc(f.id)}"><div class="txt"><a href="#finanzas/costos/productos/r/${encodeURIComponent(f.id)}"><b>${H.esc(f.nombre)}</b></a> <span class="ayuda">${H.esc(AREAS[f.area] || f.area)}</span>
        <span>${f.unidad === 'g' ? FC.pesos(f.ref.valor * 1000) + ' / kg' : FC.pesos(f.ref.valor) + ' / un'} → <b>${costoTxt(f)}</b> <span class="fin-var fin-sube">${ic('sube', 14)}+${String(f.vsMes.pct).replace('.', ',')} %</span></span>
        <span class="ayuda">Por: ${H.esc(causaTxt(f.ultimo) || '—')}</span></div>
        <button type="button" class="btn-sec" data-fin-visto="${H.esc(f.id)}">${ic('check', 16)} Visto</button></li>`).join('')}</ul></div>` : ''}
    ${todas.length ? `<div class="filtros fin-filtros">
      <div class="fin-buscar">${ic('lupa', 18)}<label class="sr" for="fin-pq">Buscar producto</label><input type="search" id="fin-pq" placeholder="Buscar producto…" autocomplete="off" spellcheck="false" value="${H.esc(st.pQ)}"></div>
      <div class="chips" role="group" aria-label="Filtrar por área">${['todas', ...Object.keys(AREAS)].map(a => `<button type="button" class="chip-filtro" data-fin-area="${a}" aria-pressed="${st.pArea === a}">${a === 'todas' ? 'Todas' : AREAS[a]} <span class="fin-cuenta">${nf(cuenta(a))}</span></button>`).join('')}</div>
      <div class="campo fin-orden"><label for="fin-porden">Ordenar por</label><select id="fin-porden">${ORDENES.map(([k, t]) => `<option value="${k}" ${st.pOrden === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="fin-ptabla" aria-label="Costo directo por producto">
      <div class="fin-pcab" aria-hidden="true"><span>Producto</span><span>Costo directo</span><span>vs mes anterior</span><span>vs último cambio</span><span>Último cambio</span></div>
      <div id="fin-pfilas"></div></div>` : ''}
  </section>
  <section class="tarjeta" aria-labelledby="t-fin-ajustes">
    <h2 id="t-fin-ajustes">Ajustes de Finanzas</h2>
    <form id="fin-ajustes" class="fin-ajustes" novalidate>
      <div class="campo"><label for="fin-alza">Avisar en Hoy cuando el costo de un producto sube más de (%) ${H.info('Aviso de alza', 'Si el costo directo por unidad de un producto sube más de este % contra el costo con que empezó el mes, aparece en Hoy ("Subió el costo de N productos") y arriba en esta lista.\nPor defecto 5 %. Cada cambio de este número queda guardado con quién y cuándo.')}</label>
        <input id="fin-alza" type="number" inputmode="decimal" min="0.1" max="100" step="any" value="${H.esc(String(umbral))}"></div>
      <button type="submit" class="btn-sec" id="fin-alza-si">Guardar</button>
    </form><p class="error" id="fin-aj-err" role="alert"></p>
  </section>`;
}
function filaProducto(f, H) {
  const inc = (f.incompleto || []);
  return `<div class="fin-pfila"><a class="fin-pabrir" href="#finanzas/costos/productos/r/${encodeURIComponent(f.id)}">
    <span class="fin-nombre"><b>${H.esc(f.nombre)}</b> <span class="ayuda">${H.esc(AREAS[f.area] || f.area || '')}</span>${inc.length ? ` <span class="chip c-amarillo chip-chico" title="${H.esc(inc.join(' · '))}">Incompleto</span><span class="fin-inc-motivo">${H.esc(inc[0])}${inc.length > 1 ? ` y ${inc.length - 1} más` : ''}</span>` : ''}</span>
    <span><span class="fin-et">Costo directo</span><b>${costoTxt(f)}</b></span>
    <span><span class="fin-et">vs mes anterior</span>${varHtml(f.vsMes, 'contra el mes anterior', H)}</span>
    <span><span class="fin-et">vs último cambio</span>${varHtml(f.vsUltimo, 'contra el último cambio', H)}</span>
    <span><span class="fin-et">Último cambio</span>${f.ultimo ? fechaTxt(f.ultimo.fecha) : '<span class="ayuda">—</span>'}</span></a></div>`;
}
function pintarFilasP(H) {
  const c = $('fin-pfilas'); if (!c) return;
  const xs = ordenarP(filasP().filter(f => st.pArea === 'todas' || f.area === st.pArea).filter(f => !normalizar(st.pQ) || coincide(`${f.nombre} ${f.id}`, st.pQ)), st.pOrden);
  c.innerHTML = xs.length ? xs.map(f => filaProducto(f, H)).join('') : '<div class="vacio">Nada con ese filtro.</div>';
}
function conectarProductos(el, H) {
  pintarFilasP(H);
  const q = $('fin-pq'); if (q) q.addEventListener('input', () => { st.pQ = q.value; pintarFilasP(H); });
  const o = $('fin-porden'); if (o) o.addEventListener('change', () => { st.pOrden = o.value; pintarFilasP(H); });
  el.querySelectorAll('[data-fin-area]').forEach(b => b.addEventListener('click', () => { st.pArea = b.dataset.finArea; el.querySelectorAll('[data-fin-area]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarFilasP(H); }));
  el.querySelectorAll('[data-fin-visto]').forEach(b => b.addEventListener('click', async () => {
    const f = alzasP().find(x => x.id === b.dataset.finVisto); if (!f) return;
    b.disabled = true;
    try { await F.marcarAlzaVista(f.id, f.costoUnit, f.vsMes.pct); H.registrar('Finanzas: vio un alza de costo', `${f.nombre}: +${f.vsMes.pct} %`); st.msg = `${f.nombre}: marcado como visto.`; st.pr = await F.leerProductos(); pintarCostos(el, 'productos', H); }
    catch (e) { $('fin-err').textContent = error(e, H); b.disabled = false; }
  }));
  const fa = $('fin-ajustes');
  if (fa) fa.addEventListener('submit', async ev => {
    ev.preventDefault(); const err = $('fin-aj-err'); err.textContent = '';
    try { const x = await F.guardarAjustes({ alzaAviso: $('fin-alza').value }); H.registrar('Finanzas: cambió el % de aviso de alza', `${x} %`); st.msg = `Aviso de alza: más de ${String(x).replace('.', ',')} %.`; st.pr = await F.leerProductos(); pintarCostos(el, 'productos', H); }
    catch (e) { err.textContent = error(e, H); }
  });
}

// ── Detalle de un producto ──
const cantD = (c, u) => u === 'un' ? `${Number((Math.round(c * 100) / 100).toFixed(2)).toLocaleString('es-CL')} un` : u === 'ml' ? `${Math.round(c * 10) / 10 >= 1000 ? (c / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' l' : (Math.round(c * 10) / 10).toLocaleString('es-CL') + ' ml'}` : (c >= 1000 ? (c / 1000).toLocaleString('es-CL', { maximumFractionDigits: 3 }) + ' kg' : (Math.round(c * 10) / 10).toLocaleString('es-CL') + ' g');
const precioBaseTxt = l => l.precioBase === null || l.precioBase === undefined ? '—' : l.base === 'un' ? `${FC.pesos(l.precioBase)} / un` : FC.porLectura(l.precioBase, l.base || 'g').texto;
function lineaHtml(l, total, H, nivel = 0) {
  const pct = total > 0 && l.costo ? l.costo / total * 100 : null;
  const formula = l.costo === null || l.costo === undefined ? '' : l.tipo === 'sub' ? (l.unidad === 'un' ? `${cantD(l.cantidad, 'un')} × ${precioBaseTxt(l)}` : `${cantD(l.cantidad, 'g')} × costo por g de la sub receta`)
    : l.tipo === 'mp' || l.tipo === 'insumo' ? `${cantD(l.cantidad, l.unidad)}${l.supuesto ? ` (${l.supuesto})` : ''} × ${precioBaseTxt(l)}` : '';
  const sub = l.tipo === 'sub' && l.sub && l.subLineas ? `<details class="fin-subdet"><summary>Ver qué lleva (${H.esc(String(Math.round((l.factor || 0) * 1000) / 10).replace('.', ','))} % del lote de la sub receta)</summary>
    <div class="fin-dlista fin-dsub">${l.subLineas.map(x => lineaHtml(x, total, H, nivel + 1)).join('')}</div></details>` : '';
  return `<div class="fin-dfila ${nivel ? 'fin-dnivel' : ''}" data-linea="${H.esc(l.ingrediente)}">
    <span class="fin-dnom"><b>${H.esc(l.ingrediente)}</b>${l.tipo === 'sub' ? ' <span class="chip c-gris chip-chico">Sub receta</span>' : ''}${l.tipo === 'insumo' ? ' <span class="chip c-gris chip-chico">Insumo</span>' : ''}${l.supuesto === 'g = ml' ? ' <span class="chip c-amarillo chip-chico" title="Se compra por volumen y la receta lo pide en gramos: se usa 1 g = 1 ml">supuesto g = ml</span>' : ''}${l.incompleto ? ` <span class="chip c-rojo chip-chico">${H.esc(l.incompleto)}</span>` : ''}${l.nota ? `<span class="ayuda">${H.esc(l.nota)}</span>` : ''}</span>
    <span><span class="fin-et">Cantidad</span>${l.tipo === 'merma' ? '—' : cantD(l.cantidad, l.unidad)}${l.porUnidad ? ` <span class="ayuda">(${H.esc(String(l.porUnidad).replace('.', ','))} por unidad)</span>` : ''}</span>
    <span><span class="fin-et">Precio base</span>${l.tipo === 'merma' ? `${H.esc(String(l.pct).replace('.', ','))} % de ${FC.pesos(l.base)}` : precioBaseTxt(l)}${l.origenPrecio ? `<span class="ayuda">${H.esc(l.origenPrecio)}${l.fechaPrecio ? ' · ' + fechaTxt(l.fechaPrecio) : ''}</span>` : ''}</span>
    <span><span class="fin-et">Costo</span><b>${l.costo === null || l.costo === undefined ? 'sin costo' : FC.pesos(l.costo)}</b>${formula ? `<span class="ayuda">${H.esc(formula)}</span>` : ''}</span>
    <span><span class="fin-et">% del total</span>${pct === null ? '—' : (Math.round(pct * 10) / 10).toLocaleString('es-CL') + ' %'}</span>${sub}</div>`;
}
// Las líneas de una sub receta, en la proporción que usa el producto (recursivo)
function conSub(lineas, motor, fac = 1, prof = 0) {
  return lineas.map(l => {
    const x = { ...l, cantidad: l.cantidad * fac, costo: l.costo === null || l.costo === undefined ? l.costo : l.costo * fac };
    if (l.tipo === 'sub' && l.sub && prof < 6 && !l.ciclo) {
      const r = motor.costear(l.sub);
      if (r && !r.ciclo) x.subLineas = conSub([...r.desglose, ...r.insumos], motor, (l.factor || 0) * fac, prof + 1);
    }
    return x;
  });
}
function pintarDetalle(el, id, rv, H) {
  const calc = F.ultimoResultado(), d = (st.pr && st.pr.docs || {})[id];
  const motor = calc && calc.ctx ? FM.crearMotor(calc.ctx) : null;
  const r = motor ? motor.costear(id) : null;
  const fila = filasP().find(f => f.id === id) || (d ? FM.filasProductos({ [id]: { ...d, aprobada: true, tipo: 'receta' } }, (st.pr && st.pr.hist) || [], hoyTxt())[0] : null);
  const volver = `<a class="btn-sec fin-enlace fin-volver" href="#finanzas/costos/productos">${ic('atras', 16)} Productos</a>`;
  if (!r && !d) { el.innerHTML = cab('costos') + subPestanas('productos', rv.pendientes.length) + `<section class="tarjeta">${volver}<p class="aviso">No se encontró ese producto.</p></section>`; return; }
  const nombre = (r && r.nombre) || d.nombre, area = (r && r.area) || d.area, unidad = (r && r.unidad) || d.unidad || 'un';
  const costoUnit = r ? r.costoUnit : d.costoUnit, lote = r ? r.costoTotal : d.costoTotal, porc = r ? r.porciones : d.porciones;
  const inc = r ? r.incompleto : (d.incompleto || []);
  const lineas = r ? conSub(r.desglose, motor) : [], insumos = r ? r.insumos : [];
  const hs = ((st.pr && st.pr.hist) || []).filter(h => h.receta === id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.cuando || '').localeCompare(String(a.cuando || '')));
  const lect = unidad === 'g' ? `${FC.pesos(costoUnit * 1000)} / kg` : `${FC.pesos(costoUnit)} / un`;
  const cifra = (t, v, ayuda, extra = '') => `<div><span>${t} ${H.info(t, ayuda)}</span><b>${v}</b>${extra}</div>`;
  const cab5 = `<div class="fin-dfila fin-dcab" aria-hidden="true"><span>Ingrediente</span><span>Cantidad (lote)</span><span>Precio base</span><span>Costo</span><span>% del total</span></div>`;
  el.innerHTML = cab('costos') + subPestanas('productos', rv.pendientes.length) + `<section class="tarjeta" aria-labelledby="t-fin-det">
    ${volver}
    <div class="titulo-fila fin-titulo"><h2 id="t-fin-det">${H.esc(nombre)}</h2><span class="chip c-gris">${H.esc(AREAS[area] || area || '')}</span>${r && r.tipo === 'sub_receta' ? '<span class="chip c-gris">Sub receta</span>' : ''}</div>
    ${inc.length ? `<div class="aviso" role="note"><b>Costo incompleto:</b> el costo mostrado es solo lo que sí tiene costo.<ul class="fin-inc">${inc.map(x => `<li>${H.esc(x)}</li>`).join('')}</ul>Se corrige en <a href="#finanzas/costos">Materias primas</a> (precio, contenido, peso por unidad) o en la receta (en Producción).</div>` : ''}
    <div class="fin-prev-cifras fin-dcifras">
      ${cifra(unidad === 'g' ? 'Costo directo por kg' : 'Costo directo por unidad', lect, `Costo del lote ÷ lo que rinde la receta${unidad === 'g' ? ' (en gramos; se muestra por kg = × 1.000)' : ''}: ${FC.pesos(lote)} ÷ ${nf(porc)} ${unidad === 'g' ? 'g' : 'un'}.\nNeto, con los precios de la última compra de cada materia prima.`)}
      ${cifra('Costo del lote', FC.pesos(lote), `Suma de todas las líneas de abajo: ingredientes, sub recetas, insumos${r && r.merma ? ' y merma de laminado' : ''}, para una receta completa (rinde ${nf(porc)} ${unidad === 'g' ? 'g' : 'un'}).`, `<span>rinde ${nf(porc)} ${unidad === 'g' ? 'g' : 'un'}</span>`)}
      ${cifra('vs mes anterior', fila && fila.ref ? varHtml(fila.vsMes, 'contra el mes anterior', H) : '—', 'Contra el costo con que empezó este mes: el último registrado en el historial antes del día 1 (si el producto es nuevo este mes, el primero del mes).', fila && fila.ref ? `<span>${unidad === 'g' ? FC.pesos(fila.ref.valor * 1000) + ' / kg' : FC.pesos(fila.ref.valor) + ' / un'}</span>` : '')}
      ${cifra('vs último cambio', fila && fila.ultimo ? varHtml(fila.vsUltimo, 'contra el último cambio', H) : '—', 'Contra el costo que tenía antes del último cambio de más de 0,5 % (los cambios más chicos no quedan en el historial).', fila && fila.ultimo ? `<span>${fechaTxt(fila.ultimo.fecha)}</span>` : '')}
    </div>
    ${!r ? '<p class="aviso">Sin la base de Producción conectada no se puede ver el desglose (solo el último costo guardado).</p>' : `
    <h3 class="fin-dtit">Ingredientes ${H.info('Desglose por ingrediente', 'Cada ingrediente de una receta completa (lote): cantidad × precio base (por kg, l o unidad, neto, con su origen: SII con proveedor y folio, a mano o planilla).\nSub receta: su costo por gramo (costo de su lote ÷ peso de su lote) o por unidad si rinde unidades; "Ver qué lleva" muestra sus ingredientes en la proporción que usa este producto.\n"supuesto g = ml": se compra por volumen y la receta lo pide en gramos; se toma 1 g = 1 ml.\n% del total: costo de la línea ÷ costo del lote.')}</h3>
    <div class="fin-dlista">${cab5}${lineas.map(l => lineaHtml(l, lote, H)).join('') || '<p class="ayuda">Sin ingredientes.</p>'}</div>
    ${insumos.length ? `<h3 class="fin-dtit">Insumos ${H.info('Insumos y envases', 'Envases, etiquetas y otros insumos de la receta. Si la receta rinde unidades, la cantidad es por unidad (× lo que rinde = el lote); si rinde gramos, es por lote. Igual que el consumo de la bodega.')}</h3>
      <div class="fin-dlista">${cab5.replace('Ingrediente', 'Insumo')}${insumos.map(l => lineaHtml(l, lote, H)).join('')}</div>` : ''}
    ${r.merma ? `<h3 class="fin-dtit">Merma de laminado ${H.info('Merma de laminado', `Lo que se pierde al laminar la masa (recortes): ${String(r.merma.pct).replace('.', ',')} % según la Configuración de Producción → Bollería (merma_laminado_pct), la misma que usa la planificación para pedir más masas.\nSe calcula sobre el costo de la masa base y del empaste de este producto: (${r.merma.sobre.join(' + ')}) ${FC.pesos(r.merma.base)} × ${String(r.merma.pct).replace('.', ',')} % = ${FC.pesos(r.merma.costo)}.`)}</h3>
      <div class="fin-dlista">${lineaHtml(r.merma, lote, H)}</div>` : ''}
    <div class="fin-dtotal"><span>Costo del lote</span><b>${FC.pesos(lote)}</b><span>÷ ${nf(porc)} ${unidad === 'g' ? 'g' : 'un'} =</span><b>${lect}</b></div>`}
  </section>
  <section class="tarjeta" aria-labelledby="t-fin-dhist">
    <h2 id="t-fin-dhist">Historial de cambios ${H.info('Historial del costo', 'Cada vez que el costo por unidad cambia más de 0,5 % queda aquí: fecha, costo anterior y nuevo, % y la causa (las materias primas que cambiaron de precio, o un cambio en la receta). No se borra.')}</h2>
    ${hs.length ? `<ul class="fin-hist-lista fin-dhist">${hs.map(h => `<li><div><b>${fechaTxt(h.fecha)}</b> · ${h.anterior === null || h.anterior === undefined ? '' : (unidad === 'g' ? FC.pesos(h.anterior * 1000) : FC.pesos(h.anterior)) + ' → '}<b>${unidad === 'g' ? FC.pesos(h.nuevo * 1000) + ' / kg' : FC.pesos(h.nuevo) + ' / un'}</b>${h.pct !== null && h.pct !== undefined ? ` <span class="fin-var ${h.pct > 0 ? 'fin-sube' : 'fin-baja'}">${h.pct > 0 ? '+' : '−'}${String(Math.abs(Math.round(h.pct * 10) / 10)).replace('.', ',')} %</span>` : ''}</div><span class="ayuda">${H.esc(causaTxt(h))}${h.incompleto ? ' · costo incompleto' : ''}</span></li>`).join('')}</ul>` : '<p class="ayuda">Sin cambios todavía.</p>'}
  </section>`;
}
