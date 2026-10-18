// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Producción  v0.42.0
//  Base nueva de Producción (fen-produccion): conexión, cuentas de las áreas (las tablets
//  de la app Cocina), copia desde la planilla con control de totales y Configuración de
//  Producción por área (v0.32.0), y recetas por aprobar y materias primas pedidas desde Cocina (v0.33.0).
//  H = ayudas de app.js: { esc, info, icono, registrar, mensajeError, hace }
// ═══════════════════════════════════════════════
import * as P from './produccion.js?v=0.69.3';
import * as K from './cocina/consumo.js?v=0.17.0';
import { conBuscador, coincide } from './buscador.js?v=0.69.3';
import * as FBQ from './fermentacion.js?v=0.69.3';

const st = { fb: null, fbMsg: '', prep: null, tot: null, copiando: false, msg: '', props: null, sols: null, abierta: null, costos: {}, cocinaMsg: '', mover: null, moverMsg: '', merma: { periodo: 'semana', datos: null, msg: '', cargando: false }, bodega: { calc: null, msg: '', cargando: false, periodo: 'semana', agregar: '', ver: 'PROD' } };
const $ = id => document.getElementById(id);
const n = v => Number(v || 0).toLocaleString('es-CL');

function error(e, H) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return 'La base nueva no dejó leer o guardar: revisa que estén publicadas las reglas de fen-produccion v1.0.0 y que tu cuenta esté en admins (ver README).';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'En fen-produccion no hay una cuenta con tu correo y esa contraseña. Créala en la consola de Firebase → Authentication (ver README).';
  if (/invalid-api-key|api-key-not-valid/.test(c)) return 'La configuración guardada no es válida (apiKey). Vuelve a pegarla.';
  if (/failed-precondition/.test(c)) return 'Firestore todavía no está creado en fen-produccion (consola → Firestore Database → Crear base de datos).';
  return (e && e.message) || H.mensajeError(e);
}
// v0.39.0: la pestaña se ordena en dos tarjetas (Cocina y Sistema) con partes plegables; lo abierto se recuerda en el equipo
const K_PLIEGUES = 'fen_sf_prod_pliegues';
const abiertos = (() => { try { return new Set(JSON.parse(localStorage.getItem(K_PLIEGUES) || '[]')); } catch (e) { return new Set(); } })();
const pliegue = (clave, titulo, resumen, cuerpo) => `<details class="pliegue" data-pliegue="${clave}" ${abiertos.has(clave) ? 'open' : ''}>
    <summary><span class="pl-tit">${titulo}</span><span class="pl-res" id="pl-res-${clave}">${resumen || ''}</span></summary>
    <div class="pliegue-cuerpo">${cuerpo}</div></details>`;
function conectarPliegues(el) {
  el.querySelectorAll('details.pliegue').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) abiertos.add(d.dataset.pliegue); else abiertos.delete(d.dataset.pliegue);
    try { localStorage.setItem(K_PLIEGUES, JSON.stringify([...abiertos])); } catch (e) {}
  }));
}
const resumenBodega = () => {
  const c = st.bodega.calc; if (!c) return 'Toca para ver el stock';
  const bajos = c.criticas.filter(e => e.st.contado && (e.bajoAhora || e.bajoDesde)).length, sin = c.criticas.filter(e => !e.st.contado).length;
  const porB = (c.bodegas || []).filter(x => (c.porBodega[x] || []).length).map(x => `${K.nombreBodega(x, c.mapa)} ${c.porBodega[x].length}`).join(' · ');
  return `${c.criticas.length} ${c.criticas.length === 1 ? 'crítica' : 'críticas'}${porB && (c.bodegas || []).length > 1 ? ` (${porB})` : ''}${bajos ? ` · <span class="chip c-rojo">${bajos} bajo el mínimo</span>` : c.criticas.length ? ' · bien' : ''}${sin ? ` · ${sin} sin conteo` : ''}`;
};
const resumenMerma = () => st.merma.datos ? `${P.PERIODOS_MERMA[st.merma.periodo]}: ${pesosN(P.resumenMerma(st.merma.datos).total)} neto` : 'Toca para ver lo perdido';
const cab = H => `<div class="cabecera"><div><h1 id="t-produccion">Producción</h1><p>Base nueva de la cocina (fen-produccion) · la app actual sigue funcionando igual</p></div>
  <div class="botones" style="margin:0;align-items:center"><button type="button" class="btn-sec btn-chico" id="prod-actualizar">Actualizar</button>${H.info('Actualizar', 'Lo que Sistema Fën lee de la base de Cocina (recetas, materias primas, configuración, bodega, días de Cocina) queda 10 minutos en memoria: así no gasta la cuota de las tablets de las jefas cada vez que abres Hoy, Producción o Finanzas.\nLo que cambias aquí se ve al tiro. Lo que cambian las jefas en Cocina puede tardar hasta 10 minutos en verse; "Actualizar" lo vuelve a leer ahora.')}</div></div>`;

export async function pintar(el, sub, H) {
  // v0.63.3: un solo escuchador para el botón Actualizar (la cabecera se vuelve a dibujar en cada pantalla)
  if (!el.dataset.actualizar) { el.dataset.actualizar = '1'; el.addEventListener('click', ev => { if (ev.target.closest('#prod-actualizar')) { P.olvidarMemoria(); st.bodega.calc = null; st.merma.datos = null; pintar(el, '', H); } }); }
  el.innerHTML = cab(H) + '<section class="tarjeta"><div class="vacio" style="border:0">Conectando…</div></section>';
  let cx;
  try { cx = await P.conexion(); } catch (e) { el.innerHTML = cab(H) + `<section class="tarjeta"><p class="error">${H.esc(error(e, H))}</p></section>`; return; }
  if (cx.estado === 'sin_config') return pintarConfig(el, H, null);
  if (cx.estado === 'sin_sesion') return pintarEntrar(el, H, cx);
  if (cx.estado === 'sin_admin') return pintarSinAdmin(el, H, cx);
  return pintarBase(el, H, cx);
}

function pintarConfig(el, H, actual) {
  el.innerHTML = cab(H) + `<section class="tarjeta" aria-labelledby="t-prod-cfg">
    <h2 id="t-prod-cfg">Conectar la base nueva ${H.info('Base nueva de Producción', 'Es un proyecto de Firebase aparte (fen-produccion), en tu misma cuenta de Google, con su propia cuota gratis.\nLa configuración que pegas aquí no es secreta: solo dice cuál es el proyecto. Los datos los protegen las reglas y las cuentas (la tuya y la de cada área).')}</h2>
    <p class="ayuda">Consola de Firebase → proyecto <b>fen-produccion</b> → ⚙️ Configuración del proyecto → Tus apps → la app web → copia todo el bloque <code>const firebaseConfig = { … }</code>.</p>
    <div class="campo"><label for="prod-cfg">Configuración web de fen-produccion</label><textarea id="prod-cfg" rows="8" spellcheck="false" style="font-family:monospace;font-size:13px;padding:12px;border-radius:12px;border:1px solid var(--borde)">${actual ? H.esc(JSON.stringify(actual, null, 2)) : ''}</textarea></div>
    <div class="error" id="prod-cfg-err" role="alert"></div>
    <div class="botones">${actual ? '<button type="button" class="btn-sec" id="prod-cfg-volver">Volver</button>' : ''}<button type="button" class="btn" id="prod-cfg-ok">Guardar y conectar</button></div></section>`;
  if (actual) $('prod-cfg-volver').addEventListener('click', () => pintar(el, '', H));
  $('prod-cfg-ok').addEventListener('click', async () => {
    const btn = $('prod-cfg-ok'); $('prod-cfg-err').textContent = '';
    let cfg; try { cfg = P.parsearConfig($('prod-cfg').value); } catch (e) { $('prod-cfg-err').textContent = e.message; return; }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try { await P.salir(); await P.guardarConfig(cfg); H.registrar('Conectó la base nueva de Producción', cfg.projectId); pintar(el, '', H); }
    catch (e) { $('prod-cfg-err').textContent = error(e, H); btn.disabled = false; btn.textContent = 'Guardar y conectar'; }
  });
}

function pintarEntrar(el, H, cx) {
  el.innerHTML = cab(H) + `<section class="tarjeta" aria-labelledby="t-prod-entrar">
    <h2 id="t-prod-entrar">Entrar a la base nueva de Producción</h2>
    <p class="ayuda">Proyecto <b>${H.esc(cx.cfg.projectId)}</b> · cuenta <b>${H.esc(cx.correo)}</b> (tu misma contraseña de Sistema Fën)</p>
    <form id="prod-form-entrar" class="campo" style="max-width:420px">
      <label for="prod-clave">Tu contraseña de Sistema Fën</label><input type="password" id="prod-clave" autocomplete="current-password" required>
      <div class="error" id="prod-entrar-err" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn" id="prod-entrar-ok">Entrar</button><button type="button" class="btn-sec" id="prod-cambiar-cfg">Cambiar configuración</button></div>
    </form></section>`;
  $('prod-cambiar-cfg').addEventListener('click', () => pintarConfig(el, H, cx.cfg));
  $('prod-form-entrar').addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = $('prod-entrar-ok'); $('prod-entrar-err').textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
    try { await P.entrar($('prod-clave').value, false); pintar(el, '', H); }
    catch (e) { $('prod-entrar-err').textContent = error(e, H); btn.disabled = false; btn.textContent = 'Entrar'; }
  });
}

function pintarSinAdmin(el, H, cx) {
  el.innerHTML = cab(H) + `<section class="tarjeta" aria-labelledby="t-prod-adm">
    <h2 id="t-prod-adm">Falta marcar tu cuenta como administración</h2>
    <p class="ayuda">Entraste a <b>${H.esc(cx.cfg.projectId)}</b> con <b>${H.esc(cx.correo)}</b>, pero esa cuenta no está en <code>admins</code>. Consola de Firebase de fen-produccion → Firestore Database → <b>Iniciar colección</b> <code>admins</code> → ID del documento:</p>
    <div class="aviso" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><code style="font-size:15px;word-break:break-all">${H.esc(cx.uid)}</code></div>
    <p class="ayuda" style="margin-top:8px">Agrega un campo <code>ok</code> (booleano, true) y guarda. Después presiona Revisar.</p>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prod-revisar">Revisar</button></div></section>`;
  $('prod-revisar').addEventListener('click', () => pintar(el, '', H));
}

function tablaControl(prep, tot) {
  const filas = [];
  Object.keys(P.AREAS).forEach(a => filas.push([`Recetas de ${P.AREAS[a]}`, prep ? prep.resumen.recetasPorArea[a] : null, tot.recetasPorArea[a]]));
  filas.push(['Materias primas', prep ? prep.resumen.mps : null, tot.mps]);
  filas.push(['Personas que entran con PIN', prep ? prep.resumen.personas : null, tot.personas]);
  ['PAN', 'BOL', 'PAS'].forEach(a => filas.push([`Unidades planificadas de ${P.AREAS[a]} (planes sin cambios en Cocina)`, prep ? prep.planesACopiar.filter(id => id.startsWith(a + '_')).reduce((s, id) => s + Object.values(prep.docs.planes[id].filas).reduce((x, d) => x + Object.values(d).reduce((y, v) => y + v, 0), 0), 0) : null, tot.unidadesSinCambiar[a]]));
  const ok = filas.every(f => f[1] === null || Math.round(f[1]) === Math.round(f[2]));
  return `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">Planilla</th><th scope="col">Base nueva</th><th scope="col"><span class="sr">Cuadra</span></th></tr></thead><tbody>
    ${filas.map(([t, a, b]) => `<tr><td>${t}</td><td>${a === null ? '—' : n(a)}</td><td>${n(b)}</td><td>${a === null ? '' : Math.round(a) === Math.round(b) ? '<span class="chip c-verde">Cuadra</span>' : '<span class="chip c-rojo">No cuadra</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    ${prep ? `<p class="${ok ? 'ok-texto' : 'error'}" style="margin-top:8px">${ok ? 'Todo cuadra: la base nueva tiene lo mismo que la planilla.' : 'Hay diferencias. Si recién copiaste, presiona "Leer la planilla" de nuevo; si siguen, avísame.'}</p>` : '<p class="ayuda">Lee la planilla para comparar.</p>'}`;
}

async function pintarBase(el, H, cx) {
  let cuentas = [], personas = [], cfgs = {};
  try { [cuentas, st.tot, cfgs] = await Promise.all([P.cuentas(), P.totales(), P.leerConfigs()]); } catch (e) { st.msg = error(e, H); }
  const t = st.tot, p = st.prep, ult = t && t.ultima;
  const porArea = a => cuentas.filter(c => P.areasDeCuenta(c).includes(a));
  const listas = Object.keys(P.AREAS).filter(a => porArea(a).length).length;
  const control = t ? tablaControl(p, t) : '';
  const resControl = !t ? '' : !p ? 'Lee la planilla para comparar' : /Todo cuadra/.test(control) ? '<span class="chip c-verde">Todo cuadra</span>' : '<span class="chip c-rojo">Hay diferencias</span>';
  el.innerHTML = cab(H) + `
    <section class="tarjeta" aria-labelledby="t-prod-revision" id="prod-cocina"><div class="vacio" style="border:0">Revisando lo que llegó desde Cocina…</div></section>

    <section class="tarjeta grupo-pliegues" aria-labelledby="t-prod-g-cocina">
      <h2 id="t-prod-g-cocina">Cocina</h2>
      ${pliegue('bodega', 'Bodega', resumenBodega(), `<div id="prod-bodega">${seccionBodega(H)}</div>`)}
      ${pliegue('merma', 'Merma', resumenMerma(), `<div id="prod-merma">${seccionMerma(H)}</div>`)}
      ${pliegue('config', 'Configuración de Producción', ['PAN', 'BOL', 'CAF'].map(a => P.AREAS[a] + (cfgs[a] && cfgs[a].editado ? ' ✓' : '')).join(' · '), seccionConfig(cfgs, H))}
    </section>

    <section class="tarjeta grupo-pliegues" aria-labelledby="t-prod-g-sistema">
      <h2 id="t-prod-g-sistema">Sistema</h2>
      ${pliegue('cuentas', 'Cuentas de las áreas', `${listas} de ${Object.keys(P.AREAS).length} áreas con cuenta`, `<p class="ayuda">Las tablets de la cocina y sus áreas · ${H.esc(cx.cfg.projectId)} ${H.info('Cuentas de las áreas', 'Cada tablet de la cocina se autoriza una vez con la cuenta de su área (la creas en la consola de Firebase de fen-produccion → Authentication). Aquí dices de qué área es cada cuenta: con eso, esa tablet solo ve y cambia lo de su área. Una cuenta puede tener más de un área ("También entra a").\nEl UID está en la consola → Authentication → Usuarios. No es secreto.\nLa contraseña de cada cuenta no pasa por aquí: la escribes tú en la tablet al autorizarla.')}</p>
      <div class="lista-simple">${Object.keys(P.AREAS).map(a => `<div class="fila-caja fila-compacta"><div class="txt"><b>${P.AREAS[a]}</b><span>${porArea(a).length ? porArea(a).map(c => H.esc(c.uid) + (c.area !== a ? ` (también; principal ${H.esc(P.AREAS[c.area] || c.area)})` : '')).join(' · ') : 'Sin cuenta asignada'}</span></div>${porArea(a).length ? '<span class="chip c-verde">Lista</span>' : '<span class="chip c-gris">Falta</span>'}</div>`).join('')}</div>
      ${cuentas.length ? `<h3 style="margin:14px 0 4px;font-size:15px">Cuentas ${H.info('Cambiar las áreas de una cuenta', 'Toca "Cambiar" para cargar la cuenta en el formulario de abajo, marca o desmarca áreas y presiona Guardar.\nSi una tablet ya estaba abierta, toma el cambio en la próxima carga.')}</h3>
      <div class="lista-simple">${cuentas.map(c => `<div class="fila-caja fila-compacta"><div class="txt"><b>${P.areasDeCuenta(c).map(a => H.esc(P.AREAS[a])).join(' + ') || 'Sin área'}</b><span>${H.esc(c.uid)}</span></div><button type="button" class="btn-sec" data-cta-editar="${H.esc(c.uid)}">Cambiar</button></div>`).join('')}</div>` : ''}
      <form id="prod-cuenta" style="margin-top:12px">
        <div class="fila-campos fila-bod">
          <div class="campo"><label for="prod-cta-area">Área principal ${H.info('Área principal', 'Con esta área abre la tablet la primera vez. Después recuerda la última en que estuvo.')}</label><select id="prod-cta-area">${Object.entries(P.AREAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="campo campo-ancho"><label for="prod-cta-uid">UID de la cuenta del área</label><input id="prod-cta-uid" spellcheck="false" autocomplete="off"></div>
        </div>
        <fieldset style="border:0;padding:0;margin:8px 0 0"><legend style="font-weight:600;font-size:14px;margin-bottom:4px">También entra a ${H.info('Más de un área', 'Marca las otras áreas a las que puede entrar esta tablet (por ejemplo, una tablet compartida entre Bollería y Pastelería).\nArriba de la app aparece "Cambiar de área". En cada área se pide el PIN de una persona de esa área, y la tablet ve y cambia solo lo de esa área mientras está en ella.')}</legend>
          <div style="display:flex;gap:16px;flex-wrap:wrap">${Object.entries(P.AREAS).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="prod-cta-otras" value="${k}">${v}</label>`).join('')}</div>
        </fieldset>
        <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn-sec">Guardar</button></div>
      </form>
      <div class="error" id="prod-cta-err" role="alert"></div>
`)}
      ${pliegue('copia', 'Copia desde la planilla', ult && ult.ultima ? 'Última: ' + H.esc(H.hace(ult.ultima)) : 'Nunca copiada', `<p class="ayuda">Recetas, materias primas, configuración, planes y personas, desde la planilla ${H.info('Copia desde la planilla', 'Lee la planilla de Producción con el script (v2.3.0) y copia a la base nueva: recetas, materias primas (sin costos), configuración de masa madre y poolish, planes semanales y quién entra a cada área con su PIN.\nSe puede repetir las veces que quieras. Un plan semanal que ya se cambió en la app Cocina no se pisa: desde que un área usa Cocina, su plan manda ahí.\nNada se borra.')}</p>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prod-leer">Leer la planilla</button></div>
      <div id="prod-prep">${p ? resumenPrep(p, H) : ''}</div>
      <div id="prod-avance" class="ayuda" aria-live="polite">${H.esc(st.msg)}</div>
`)}
      ${pliegue('mover', 'Pasar recetas de Bollería a Pastelería', '', `<div id="prod-mover"><p class="ayuda">Rellenos, cremas y preparaciones del día ${H.info('Pasar recetas a Pastelería', 'Los rellenos, cremas y otras preparaciones del día pasan a Pastelería. Marca cuáles: se mueven en la planilla con el mismo ID (la fila se copia a PAS_recetas y recién después sale de BOL_recetas; queda registro en "Movimientos_recetas") y en la base nueva.\nLos productos de Bollería que las usan siguen funcionando: la sub receta queda habilitada para las dos áreas.')}</p>
      ${st.mover ? listaMover(H) : '<div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" id="prod-mover-ver">Ver las recetas de Bollería</button></div>'}
      ${st.moverMsg ? `<p class="ayuda" role="status">${H.esc(st.moverMsg)}</p>` : ''}
</div>`)}
      ${t ? pliegue('control', 'Control de totales', resControl, control) : ''}
    </section>`;
  conectarPliegues(el);
  // v0.66.0: la lista de la fermentación en bloque se lee solo con "Configuración de Producción" abierta
  const plCfg = el.querySelector('details.pliegue[data-pliegue="config"]');
  if (plCfg) { if (plCfg.open) cargarFB(el, H, cfgs); else plCfg.addEventListener('toggle', () => { if (plCfg.open) cargarFB(el, H, cfgs); }); }
  if (st.fb) conectarFB();
  st.fbMsg = '';
  const fFB = $('prod-fb');
  if (fFB) fFB.addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = $('prod-fb-err'), btn = $('prod-fb-guardar'); err.textContent = '';
    const valores = {};
    for (const inp of fFB.querySelectorAll('[data-fb-id]')) {
      const r = FBQ.leerHHMM(inp.value);
      inp.removeAttribute('aria-invalid');
      if (!r.ok) {
        inp.setAttribute('aria-invalid', 'true');
        const fila = inp.closest('.fb-fila'); if (fila) fila.hidden = false;
        err.textContent = `${inp.closest('.fb-fila').dataset.fbNombre}: escribe horas y minutos, por ejemplo 2:00 (máximo 48:00), o déjalo vacío.`;
        inp.focus(); return;
      }
      valores[inp.dataset.fbId] = r.min;
    }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await P.guardarFB('PAN', valores);
      const con = Object.values(valores).filter(v => v > 0).length;
      H.registrar('Cambió la fermentación en bloque (Producción)', `Panadería · ${con} ${con === 1 ? 'receta' : 'recetas'} con f.b.`);
      st.fbMsg = 'Guardado. Las tablets lo ven al instante.';
      pintarBase(el, H, cx);
    } catch (e) { err.textContent = error(e, H); btn.disabled = false; btn.textContent = 'Guardar fermentación en bloque'; }
  });

  pintarCocina(el, H, true);
  conectarMerma(el, H); conectarBodega(H);
  const verMover = $('prod-mover-ver');
  if (verMover) verMover.addEventListener('click', async () => {
    verMover.disabled = true; verMover.textContent = 'Cargando…';
    try { st.mover = await P.recetasDeArea('BOL'); st.moverMsg = ''; } catch (e) { st.moverMsg = error(e, H); }
    pintarBase(el, H, cx);
  });
  const btnMover = $('prod-mover-ok');
  if (btnMover) btnMover.addEventListener('click', async () => {
    const ids = [...el.querySelectorAll('[data-mover]:checked')].map(x => x.dataset.mover);
    if (!ids.length) { st.moverMsg = 'Marca al menos una receta.'; pintarBase(el, H, cx); return; }
    if (!confirm(`¿Pasar ${ids.length} ${ids.length === 1 ? 'receta' : 'recetas'} a Pastelería? Se mueven en la planilla y en la base nueva, con el mismo ID.`)) return;
    btnMover.disabled = true; btnMover.textContent = 'Moviendo…';
    try {
      const r = await P.moverRecetas(ids);
      H.registrar('Pasó recetas de Bollería a Pastelería', `${r.movidas.length} recetas`);
      st.moverMsg = `Listo: ${r.movidas.length} ${r.movidas.length === 1 ? 'receta pasó' : 'recetas pasaron'} a Pastelería.${r.saltadas.length ? ' No se movieron: ' + r.saltadas.map(x => `${x.id} (${x.motivo})`).join(', ') + '.' : ''}`;
      st.mover = await P.recetasDeArea('BOL');
    } catch (e) { st.moverMsg = error(e, H); }
    pintarBase(el, H, cx);
  });
  const marcarPrincipal = () => el.querySelectorAll('[name="prod-cta-otras"]').forEach(x => { const es = x.value === $('prod-cta-area').value; x.disabled = es; if (es) x.checked = false; });
  $('prod-cta-area').addEventListener('change', marcarPrincipal); marcarPrincipal();
  el.querySelectorAll('[data-cta-editar]').forEach(b => b.addEventListener('click', () => {
    const c = cuentas.find(x => x.uid === b.dataset.ctaEditar); if (!c) return;
    $('prod-cta-uid').value = c.uid; $('prod-cta-area').value = P.AREAS[c.area] ? c.area : 'PAN';
    const otras = P.areasDeCuenta(c).filter(a => a !== c.area);
    el.querySelectorAll('[name="prod-cta-otras"]').forEach(x => { x.checked = otras.includes(x.value); });
    marcarPrincipal(); $('prod-cta-uid').focus();
  }));
  $('prod-cuenta').addEventListener('submit', async ev => {
    ev.preventDefault(); $('prod-cta-err').textContent = '';
    const principal = $('prod-cta-area').value, otras = [...el.querySelectorAll('[name="prod-cta-otras"]:checked')].map(x => x.value).filter(a => a !== principal);
    try { await P.asignarCuenta($('prod-cta-uid').value, principal, otras); H.registrar('Asignó una cuenta de área (Producción)', `${[principal, ...otras].map(a => P.AREAS[a]).join(' + ')} · ${$('prod-cta-uid').value.trim()}`); pintarBase(el, H, cx); }
    catch (e) { $('prod-cta-err').textContent = error(e, H); }
  });
  el.querySelectorAll('[data-cfg-area]').forEach(f => f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const area = f.dataset.cfgArea, err = f.querySelector('.error'), btn = f.querySelector('button[type=submit]');
    err.textContent = '';
    const cambios = {};
    for (const c of P.CAMPOS_CONFIG[area]) {
      if (c.t === 'dias') { cambios[c.k] = [...f.querySelectorAll(`[name="${area}-${c.k}"]:checked`)].map(x => Number(x.value)); if (!cambios[c.k].length) { err.textContent = `${c.etiqueta}: marca al menos un día.`; return; } continue; }
      const t = f.querySelector(`[data-k="${c.k}"]`).value.trim();
      if (t === '') { cambios[c.k] = null; continue; }
      if (c.t === 'fecha') { if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) { err.textContent = `${c.etiqueta}: elige una fecha o déjalo vacío.`; return; } cambios[c.k] = t; continue; }
      const v = Number(t.replace(',', '.'));
      if (!isFinite(v) || v < 0 || v > 100000) { err.textContent = `${c.etiqueta}: escribe un número (0 o más).`; return; }
      cambios[c.k] = v;
    }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try { await P.guardarConfigArea(area, cambios); H.registrar('Cambió la configuración de Producción', P.AREAS[area]); pintarBase(el, H, cx); }
    catch (e) { err.textContent = error(e, H); btn.disabled = false; btn.textContent = 'Guardar'; }
  }));
  $('prod-leer').addEventListener('click', async () => {
    const b = $('prod-leer'); b.disabled = true; b.textContent = 'Leyendo la planilla…'; st.msg = '';
    try { st.prep = await P.preparar(); } catch (e) { st.msg = error(e, H); }
    pintarBase(el, H, cx);
  });
  const bc = $('prod-copiar');
  if (bc) bc.addEventListener('click', async () => {
    bc.disabled = true; st.copiando = true;
    try {
      const r = await P.copiar(st.prep, (h, tot) => { $('prod-avance').textContent = `Copiando… ${n(h)} de ${n(tot)}`; });
      H.registrar('Copió Producción a la base nueva', `${n(r.escritos)} documentos`);
      st.msg = `Listo: ${n(r.escritos)} documentos copiados.`;
    } catch (e) { st.msg = error(e, H); }
    st.copiando = false; pintarBase(el, H, cx);
  });
}

function resumenPrep(p, H) {
  const r = p.resumen, docs = Object.keys(p.docs.recetas).length + Object.keys(p.docs.mps).length + Object.keys(p.docs.config).length + Object.keys(p.docs.personas).length + p.planesACopiar.length;
  return `<div class="tabla-b2b" style="margin-top:12px"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">En la planilla</th><th scope="col">Se copia</th></tr></thead><tbody>
      ${Object.keys(P.AREAS).map(a => `<tr><td>Recetas de ${P.AREAS[a]}</td><td>${n(r.recetasPorArea[a])}</td><td>${n(r.recetasPorArea[a])}</td></tr>`).join('')}
      <tr><td>Materias primas (sin costos)</td><td>${n(r.mps)}</td><td>${n(r.mps)}</td></tr>
      <tr><td>Semanas planificadas</td><td>${n(r.planes)}</td><td>${n(p.planesACopiar.length)}${p.planesRespetados.length ? ` (${n(p.planesRespetados.length)} ya se cambiaron en Cocina: no se pisan)` : ''}</td></tr>
      <tr><td>Personas que entran con PIN</td><td>${n(r.personas)}</td><td>${n(r.personas)}</td></tr>
    </tbody></table></div>
    ${p.avisos.length ? `<details class="aviso" style="margin-top:10px"><summary><b>${p.avisos.length} ${p.avisos.length === 1 ? 'aviso' : 'avisos'} de la planilla</b> · no frenan la copia</summary><ul>${p.avisos.slice(0, 150).map(a => `<li>${H.esc(a.hoja)}${a.fila ? ', fila ' + a.fila : ''}: ${H.esc(a.texto)}</li>`).join('')}${p.avisos.length > 150 ? `<li>… y ${p.avisos.length - 150} más</li>` : ''}</ul></details>` : ''}
    <div class="botones" style="justify-content:flex-start;margin-top:12px"><button type="button" class="btn" id="prod-copiar" ${st.copiando ? 'disabled' : ''}>Copiar ${n(docs)} documentos a la base nueva</button></div>`;
}

// Configuración de Producción por área: la editas tú; las jefas la ven en Cocina (solo lectura)
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function seccionConfig(cfgs, H) {
  const bloque = area => {
    const c = cfgs[area] || {}, campos = P.CAMPOS_CONFIG[area];
    const viejo = area === 'BOL' && !(Number(c.amasadora_kg) > 0) && c.amasadora_max_por_tanda ? `<p class="ayuda">Hoy (app actual): ${H.esc(String(c.amasadora_max_por_tanda))} masas por tanda.</p>` : '';
    return `<form class="cfg-area" data-cfg-area="${area}" style="margin-top:14px">
      <h3 style="margin:0 0 6px">${P.AREAS[area]}${c.editado ? ' <span class="chip c-gris">editada aquí</span>' : ''}</h3>${viejo}
      ${campos.filter(f => f.t === 'dias').map(f => {
        const v = P.valorEn(c, f.k), sel = Array.isArray(v) ? v.map(Number) : [1, 4];
        return `<fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:600;font-size:14px;margin-bottom:4px">${H.esc(f.etiqueta)}</legend><div style="display:flex;gap:16px;flex-wrap:wrap">${DIAS_C.map((d, i) => `<label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="${area}-${f.k}" value="${i}" ${sel.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div><small class="ayuda">${H.esc(f.ayuda)}</small></fieldset>`;
      }).join('')}
      <div class="fila-campos" style="flex-wrap:wrap;align-items:flex-end">
        ${campos.filter(f => f.t !== 'dias').map(f => {
          const v = P.valorEn(c, f.k);
          const id = `cfg-${area}-${f.k.replace(/\./g, '-')}`;
          const lab = `<label for="${id}">${H.esc(f.etiqueta)}${f.info ? ' ' + H.info(f.etiqueta, f.info) : ''}</label>`;
          if (f.t === 'fecha') return `<div class="campo" style="min-width:200px">${lab}<input id="${id}" data-k="${f.k}" type="date" value="${typeof v === 'string' ? H.esc(v) : ''}"><small class="ayuda">${H.esc(f.ayuda)}</small></div>`;
          return `<div class="campo" style="min-width:200px">${lab}<input id="${id}" data-k="${f.k}" inputmode="decimal" value="${v === undefined || v === null ? '' : H.esc(String(v).replace('.', ','))}" placeholder="${f.def !== undefined ? f.def : ''}"><small class="ayuda">${H.esc(f.ayuda)}</small></div>`;
        }).join('')}
      </div>
      <div class="error" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn-sec">Guardar ${P.AREAS[area]}</button></div>
    </form>`;
  };
  return `<p class="ayuda">Cómo calcula Cocina en cada área ${H.info('Configuración de Producción', 'Lo que define cómo calcula Cocina en cada área: amasadora, tandas por día, merma, congeladores, días del pie de masa madre.\nLa cambias tú; las jefas la ven en Cocina sin poder cambiarla. Una configuración que guardas aquí no se pisa al volver a copiar desde la planilla.')}</p>
    ${bloque('PAN')}${bloqueFB(cfgs.PAN || {}, H)}${bloque('BOL')}${bloque('CAF')}`;
}

// ── v0.66.0 · Fermentación en bloque (Panadería): config/PAN.fermentacionBloque = { recetaId | subId: minutos } ──
// Se carga al abrir "Configuración de Producción" (recetas con su marca, como siempre, + ajustes/PAN__hoy: un documento).
const INFO_FB = 'Tiempo a temperatura ambiente después de terminar la masa. Ajústalo según la temporada: en invierno más, en verano menos.';
function bloqueFB(c, H) {
  return `<form class="cfg-area" id="prod-fb" style="margin-top:14px" novalidate>
      <h3 style="margin:0 0 6px">Fermentación en bloque · Panadería ${H.info('Fermentación en bloque', INFO_FB)}</h3>
      <p class="ayuda">Las recetas de "Recetas del día" en Cocina. Escribe horas y minutos (2:00, 1:30); vacío = sin fermentación en bloque. Al marcar terminada, Cocina muestra "f.b. hasta 13:00".</p>
      <div id="prod-fb-lista">${listaFBHtml(c, H)}</div>
      <div class="error" role="alert" id="prod-fb-err"></div>
      ${st.fbMsg ? `<p class="ok-texto" role="status">${H.esc(st.fbMsg)}</p>` : ''}
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn-sec" id="prod-fb-guardar" ${st.fb && st.fb.lista ? '' : 'disabled'}>Guardar fermentación en bloque</button></div>
    </form>`;
}
function listaFBHtml(c, H) {
  if (!st.fb) return '<p class="ayuda">Cargando las recetas…</p>';
  if (st.fb.error) return `<p class="error">${H.esc(st.fb.error)}</p>`;
  const L = st.fb.lista || [], fb = (c && c.fermentacionBloque) || {};
  if (!L.length) return '<p class="ayuda">No hay recetas aprobadas de Panadería en la base nueva (copia la planilla primero).</p>';
  const buscar = L.length > 8 ? `<div class="campo fb-buscar"><label for="prod-fb-q">Buscar receta</label><input id="prod-fb-q" type="search" placeholder="Escribe para buscar…" autocomplete="off" spellcheck="false"></div>` : '';
  return `${buscar}${st.fb.leyoHoy ? '' : '<p class="ayuda">No se pudo leer "Ordenar Hoy" de Cocina: se muestran las masas por defecto ("Masa …").</p>'}
    <div class="fb-lista">${L.map((r, i) => `<div class="fb-fila" data-fb-nombre="${H.esc(r.nombre)}">
        <label for="prod-fb-${i}"><span>${H.esc(r.nombre)}</span><small>${r.tipo === 'sub' ? 'Masa · sub receta' : 'Receta'}</small></label>
        <input id="prod-fb-${i}" data-fb-id="${H.esc(r.id)}" inputmode="numeric" maxlength="5" placeholder="sin f.b." value="${H.esc(FBQ.aHHMM(fb[r.id]))}" aria-describedby="prod-fb-formato">
      </div>`).join('')}</div>
    <p class="ayuda" id="prod-fb-nada" hidden>Sin resultados</p>
    <small class="ayuda" id="prod-fb-formato">Formato h:mm (por ejemplo 2:00). Vacío = sin f.b.</small>`;
}
async function cargarFB(el, H, cfgs) {
  if (st.fb && !st.fb.error) return;
  st.fb = null;
  try { st.fb = await P.recetasFB('PAN'); } catch (e) { st.fb = { error: error(e, H) }; }
  const caja = $('prod-fb-lista'); if (!caja) return;
  caja.innerHTML = listaFBHtml(cfgs.PAN || {}, H);
  const b = $('prod-fb-guardar'); if (b) b.disabled = !(st.fb && st.fb.lista && st.fb.lista.length);
  conectarFB();
}
function conectarFB() {
  const q = $('prod-fb-q');
  if (q) q.addEventListener('input', () => {
    let vis = 0;
    document.querySelectorAll('#prod-fb .fb-fila').forEach(f => { const ok = coincide(f.dataset.fbNombre, q.value); f.hidden = !ok; if (ok) vis++; });
    $('prod-fb-nada').hidden = vis > 0;
  });
  if (q) q.addEventListener('keydown', e => { if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; q.dispatchEvent(new Event('input')); } });
}

// ═══════════════ Bodega (P5): stock de las críticas por bodega, consumo por área y llegadas ═══════════════
// v0.54.0: bodegas separadas (Producción y Cafetería), en pestañas. Cada una con sus críticas, mínimos, llegadas y alertas.
// Las de Producción conservan los mismos campos de antes (ids sin sufijo); las de otra bodega llevan "-{BODEGA}".
const fechaC = f => f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '';
const sufijo = bod => bod === K.BODEGA_PRINCIPAL ? '' : '-' + bod;
// v0.65.0 · Bodegas por área responsable: textos de la ayuda (i)
const INFO_RESP = 'Cada materia prima crítica de producción tiene UNA bodega responsable: Panadería, Bollería o Pastelería (Cafetería tiene la suya, como antes).\nSu stock es uno solo y baja con lo que consume CUALQUIER área: la harina es de Panadería y baja también con lo que usan Bollería y Pastelería.\nEn Cocina, cada área ve, cuenta y recibe solo las de su bodega. El correo de bajo el mínimo llega a ti y a las jefas del área responsable (no a las demás).\nSi una materia prima es crítica en dos bodegas de producción, se avisa aquí: lo que consume un área va a la suya si la tiene; si no, a la primera.\nCambiar la responsable no mueve nada: el stock, los conteos y las llegadas siguen igual (mismo documento); solo cambia quién la ve y a quién le llega el aviso. Queda la historia de cada cambio.';
const INFO_ASIGNAR = 'Hasta ahora Panadería, Bollería y Pastelería compartían una bodega (Producción). Desde aquí cada materia prima crítica queda a cargo de UNA de ellas.\nLa propuesta sale del uso: lo consumido por cada área en los últimos 120 días (o, si no hay consumo, sus recetas). Las harinas van a Panadería aunque las usen otras áreas (se comparten).\nRevisa y cambia lo que quieras; nada se aplica hasta "Confirmar responsables". Hasta entonces todo sigue como hoy.\nAl confirmar no se copia ni se borra nada: el stock, los conteos y las llegadas siguen en el mismo lugar. Después puedes cambiar la responsable de cada una en su pestaña.';
const bajosDe = lista => lista.filter(e => e.st.contado && (e.bajoAhora || e.bajoDesde)).length;
function seccionBodega(H) {
  const b = st.bodega, c = b.calc;
  const cab = `<div class="titulo-fila"><span class="ayuda">Stock de las críticas por bodega, consumo por área y llegadas ${H.info('Bodega (materias primas críticas)', 'Hay dos bodegas, cada una con su stock: Producción (Panadería, Bollería y Pastelería: lo que cuenta un área vale para las tres) y Cafetería (solo Cafetería).\nUna materia prima puede ser crítica en una o en las dos, con su propio mínimo, llegadas, conteos y stock. Lo que consume Cafetería (ventas de la caja, calibración diaria y extra, derramado, merma) baja la bodega de Cafetería; lo de las otras áreas, la de Producción. Si una materia prima no es crítica en esa bodega, no se sigue ahí.\nStock = último conteo + llegadas − lo consumido. El conteo vale como cierre de su día (se cuenta después de la producción; en Cafetería, después de cerrar la caja): lo hecho ese día ya está incluido y se descuenta desde el día siguiente.\nLas jefas anotan llegadas y conteos en Cocina → Bodega, solo de su bodega. El conteo corrige la cuenta. Si faltó, es lo que se usa sin anotar (harina de mesón, pruebas, pérdidas chicas) o algo hecho que no se marcó; si sobró, una llegada o un hecho que no se anotó.\n"Alcanza" y "bajo el mínimo" usan lo planificado de los próximos 7 días (Panadería: el plan; Bollería: masas y metas; Pastelería y Cafetería: su ritmo de los últimos 14 días).\nBajo el mínimo: aparece en Hoy, en Cocina (arriba de la Bodega del área) y llega un correo (uno por día por materia prima) a ti y a las jefas de esa bodega. Se revisa cuando se abre Sistema Fën o Cocina, o se hace un conteo: no hay revisión automática de noche.\nEn Producción, si no marcas una crítica aquí, vale lo de la planilla (es_critica, stock_seguridad).')}</span>
    <button type="button" class="btn-sec" id="prod-bod-calc" ${b.cargando ? 'disabled' : ''}>${b.cargando ? 'Calculando…' : c ? 'Calcular de nuevo' : 'Calcular'}</button></div>`;
  if (!c) return cab + (b.msg ? `<p class="error">${H.esc(b.msg)}</p>` : '<p class="ayuda">Presiona "Calcular" (lee los últimos 120 días de Cocina).</p>');
  const bods = c.bodegas || [K.BODEGA_PRINCIPAL], ver = bods.includes(b.ver) ? b.ver : bods[0], resp = K.esResponsable(c.mapa);
  const pest = `<div class="pestanas pest-bodega" role="tablist" aria-label="Bodegas">${bods.map(x => { const n = bajosDe(c.porBodega[x] || []); return `<button type="button" role="tab" data-bod-tab="${H.esc(x)}" aria-selected="${x === ver}">${H.esc(K.nombreBodega(x, c.mapa))}${n ? ` <span class="chip c-rojo">${n}</span>` : ''}</button>`; }).join('')}</div>`;
  const per = P.periodoMerma(b.periodo), cons = P.consumoPeriodo(c, per);
  const AR = ['PAN', 'BOL', 'PAS', 'CAF'].filter(a => cons.some(x => x.porArea[a]));
  const sinId = Object.keys(c.sinId || {});
  return cab + `
    <p class="ayuda">Calculado el ${H.esc(fechaC(c.hoy))} a las ${H.esc(new Date(c.en).toTimeString().slice(0, 5))} · las jefas ven en Cocina lo de su bodega que está bajo el mínimo.${resp ? ' ' + H.info('Bodegas por área responsable', INFO_RESP) : ''}</p>
    ${resp ? avisosResp(H, c) : seccionAsignar(H, c)}
    ${pest}
    <div class="bod-bodega" data-bodega="${H.esc(ver)}">${seccionUnaBodega(H, c, ver)}</div>
    <div class="error" id="prod-bod-err" role="alert">${H.esc(b.msg)}</div>
    <div class="titulo-fila" style="margin-top:18px"><h3 style="margin:0">Consumo por área ${H.info('Consumo por área', 'Todas las materias primas (no solo las críticas), con lo que se marcó como hecho en Cocina, lo vendido en la caja (Cafetería) y la merma de materias primas. Las sub recetas se bajan hasta sus materias primas; la de otra área la cuenta el área que la hace.\nLa columna Cafetería baja la bodega de Cafetería; las demás, la de Producción (con responsables: la bodega responsable de cada materia prima, por ejemplo la harina de Bollería baja la de Panadería).')}</h3>
      <select id="prod-bod-per" aria-label="Período">${Object.entries(P.PERIODOS_MERMA).map(([k, t]) => `<option value="${k}" ${b.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${cons.length ? `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Materia prima</th>${AR.map(a => `<th scope="col" style="text-align:right">${H.esc(P.AREAS[a])}</th>`).join('')}<th scope="col" style="text-align:right">Total</th></tr></thead><tbody>
      ${cons.map(x => `<tr><td>${H.esc(x.nombre)}</td>${AR.map(a => `<td style="text-align:right">${x.porArea[a] ? H.esc(K.texto(x.porArea[a], x.unidad)) : ''}</td>`).join('')}<td style="text-align:right"><b>${H.esc(K.texto(x.total, x.unidad))}</b></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="ayuda">Nada marcado como hecho en este período.</p>'}
    <h3 style="margin:16px 0 4px">Cafetería ${H.info('Consumo de Cafetería', 'Cafetería descuenta de SU bodega lo VENDIDO en la caja: cada producto vinculado a una receta de Cafetería (en la caja, Configuración → Conexión con fën-producción) se baja por su receta hasta las materias primas. Los cierres cuentan al final de su día; la caja abierta, venta por venta.\nAdemás, el café de la bitácora de turno (calibración diaria automática o editada, calibración extra, café botado, pruebas) se descuenta de la materia prima que elijas aquí, y lo derramado baja la preparación entera.\nLos productos de otras áreas que se venden en la cafetería (croissant, pan) no descuentan aquí: los cuenta su área al hacerlos.')}</h3>
    <div class="fila-campos fila-bod">
      <div class="campo campo-ancho"><label for="prod-bod-cafe">El café de la bitácora de turno sale de</label><select id="prod-bod-cafe"><option value="">(no descuenta)</option>${c.datos.mps.filter(m => m.tipo !== 'sub_receta' && (m.estado || 'activa') === 'activa').sort((a, x) => a.nombre.localeCompare(x.nombre, 'es')).map(m => `<option value="${H.esc(m.id)}" ${((c.datos.config.CAF || {}).mp_cafe) === m.id ? 'selected' : ''}>${H.esc(m.nombre)}</option>`).join('')}</select></div>
      <button type="button" class="btn-sec" id="prod-bod-cafe-ok">Guardar</button>
    </div>
    ${c.cafe && c.cafe.error ? `<p class="error">No se pudieron leer las ventas de la caja: ${H.esc(c.cafe.error)}</p>` : ''}
    ${c.cafe && Object.keys(c.cafe.sinReceta).length ? `<p class="ayuda">Vendidos en Cafetería sin receta vinculada en la caja (no descuentan): ${H.esc(Object.entries(c.cafe.sinReceta).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, q]) => `${n} (${Math.round(q)})`).join(', '))}${Object.keys(c.cafe.sinReceta).length > 10 ? '…' : ''}. Vincúlalos en la caja para que cuenten.</p>` : ''}
    ${sinId.length ? `<p class="ayuda">Ingredientes sin materia prima en el maestro (no se cuentan): ${H.esc(sinId.slice(0, 8).join(', '))}${sinId.length > 8 ? '…' : ''}.</p>` : ''}`;
}
// v0.65.0 · "Asignar responsables" (una vez, mientras Producción es una sola bodega): propuesta por uso, se cambia y se confirma
function seccionAsignar(H, c) {
  const lista = c.propuesta || [], b = st.bodega, elegidas = b.resp || {};
  if (!lista.length) return '';
  const pct = (x, a) => x.fuente ? `${x.pct[a]} %` : '—';
  const fuente = x => x.fuente === 'consumo' ? 'consumo (120 días)' : x.fuente === 'recetas' ? 'recetas' : 'sin uso';
  const motivo = x => x.motivo === 'harina' ? 'Harina: va a Panadería' : x.motivo === 'uso' ? 'La que más la usa' : 'Sin uso: Panadería';
  return `<details class="aviso asignar-resp" id="prod-bod-asignar" ${b.asignarAbierto === false ? '' : 'open'}><summary><b>Asignar responsables</b> · cada materia prima crítica, a cargo de una sola área</summary>
    <p class="ayuda">Propuesta por uso. Revisa, cambia lo que quieras y confirma. Hasta confirmar, Panadería, Bollería y Pastelería siguen compartiendo la bodega Producción. ${H.info('Asignar responsables', INFO_ASIGNAR)}</p>
    <div class="tabla-b2b"><table class="tabla-tiempos tabla-asignar"><thead><tr><th scope="col">Materia prima</th><th scope="col" style="text-align:right">Panadería</th><th scope="col" style="text-align:right">Bollería</th><th scope="col" style="text-align:right">Pastelería</th><th scope="col">Según</th><th scope="col">Responsable</th></tr></thead><tbody>
    ${lista.map(x => `<tr><td>${H.esc(x.mp.nombre)}<br><span class="ayuda">${H.esc(motivo(x))}</span></td>${K.AREAS_PROD.map(a => `<td style="text-align:right">${H.esc(pct(x, a))}</td>`).join('')}<td class="ayuda">${H.esc(fuente(x))}</td>
      <td><select data-bod-asignar="${H.esc(x.mp.id)}" aria-label="Responsable de ${H.esc(x.mp.nombre)}">${K.AREAS_PROD.map(a => `<option value="${a}" ${(elegidas[x.mp.id] || x.propuesta) === a ? 'selected' : ''}>${H.esc(P.AREAS[a])}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table></div>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prod-bod-asignar-ok">Confirmar responsables</button></div></details>`;
}
// v0.65.0 · Avisos de la configuración: críticas en dos bodegas de producción y críticas sin responsable elegida
function avisosResp(H, c) {
  const nom = id => { const m = c.datos.mps.find(x => x.id === id); return m ? m.nombre : id; };
  const rep = (c.repetidas || []).map(r => `<li><b>${H.esc(nom(r.mp))}</b>: crítica en ${H.esc(r.bodegas.map(x => K.nombreBodega(x, c.mapa)).join(' y '))}. Lo que consume un área va a la suya si la tiene; si no, a ${H.esc(K.nombreBodega(r.bodegas[0], c.mapa))}. Si es un error, quítala de una (botón Quitar en su pestaña).</li>`).join('');
  const sin = (c.sinResponsable || []).map(id => H.esc(nom(id))).join(', ');
  return `${rep ? `<div class="aviso" id="prod-bod-repetidas" role="status"><b>Críticas en más de una bodega de producción</b><ul>${rep}</ul></div>` : ''}
    ${sin ? `<p class="ayuda" id="prod-bod-sinresp">Sin responsable elegida (van a Panadería): ${sin}. Elige la responsable en la pestaña de Panadería.</p>` : ''}`;
}
// Una bodega: críticas (estado, stock, mínimo, envase, alcanza, último conteo), agregar, llegadas y (Producción) pasar a Cafetería
function seccionUnaBodega(H, c, bod) {
  const lista = c.porBodega[bod] || [], s = sufijo(bod), nombre = K.nombreBodega(bod, c.mapa);
  const areas = K.areasDeBodega(bod, c.mapa).map(a => P.AREAS[a] || a).join(', ');
  const resp = K.esResponsable(c.mapa), prodB = resp && K.esProduccion(bod, c.mapa);
  // v0.65.0: la responsable de cada una (las que viven en su documento de siempre); se cambia aquí y no mueve el stock
  const selResp = e => prodB && e.docId === e.mp.id ? `<br><label class="ayuda resp-sel">Responsable <select data-bod-resp="${H.esc(e.mp.id)}" aria-label="Responsable de ${H.esc(e.mp.nombre)}">${K.AREAS_PROD.map(a => `<option value="${a}" ${a === bod ? 'selected' : ''}>${H.esc(P.AREAS[a])}</option>`).join('')}</select></label>` : prodB ? '<br><span class="chip c-amarillo">También en otra bodega</span>' : '';
  const est = e => !e.st.contado ? '<span class="chip c-gris" title="No hay conteo en los últimos 120 días">Falta conteo</span>' : e.bajoAhora ? '<span class="chip c-rojo">Bajo el mínimo</span>' : e.bajoDesde ? `<span class="chip c-amarillo">Bajo el ${H.esc(fechaC(e.bajoDesde))}</span>` : '<span class="chip c-verde">Bien</span>';
  const dif = e => { const t = e.st.teoricoAlContar; if (t === null || t === undefined) return ''; const d = e.st.conteo.cantidad - t; return Math.abs(d) < 1 ? ' · cuadró' : d < 0 ? ` · faltaron ${H.esc(K.texto(-d, e.cfg.unidad))} (uso sin anotar: mesón, pruebas…)` : ` · sobraron ${H.esc(K.texto(d, e.cfg.unidad))} (llegada o hecho sin anotar)`; };
  const filas = lista.map(e => `<tr>
      <td>${H.esc(e.mp.nombre)}${selResp(e)}</td><td>${est(e)}</td>
      <td style="text-align:right">${e.st.contado ? H.esc(K.texto(e.st.stock, e.cfg.unidad)) + (e.cfg.envase ? `<br><span class="ayuda">${H.esc((Math.round(e.st.stock / e.cfg.envase.tamano * 10) / 10).toLocaleString('es-CL'))} ${H.esc(K.envases(e.cfg.envase.nombre, 2))}</span>` : '') : '—'}</td>
      <td><input class="bod-min" data-bod-min="${H.esc(e.docId)}" inputmode="decimal" value="${H.esc(String(K.deBase(e.cfg.seguridad, e.cfg.unidad)).replace('.', ','))}" aria-label="Mínimo de ${H.esc(e.mp.nombre)} en ${H.esc(nombre)}" style="width:80px"> ${K.unidadEntrada(e.cfg.unidad)}</td>
      <td class="bod-env"><input data-bod-env-n="${H.esc(e.docId)}" value="${H.esc(e.cfg.envase ? e.cfg.envase.nombre : '')}" placeholder="${K.unidadEntrada(e.cfg.unidad)}" maxlength="20" aria-label="Envase de ${H.esc(e.mp.nombre)}" style="width:72px"> de <input data-bod-env-t="${H.esc(e.docId)}" inputmode="decimal" value="${e.cfg.envase ? H.esc(String(K.deBase(e.cfg.envase.tamano, e.cfg.unidad)).replace('.', ',')) : ''}" aria-label="Tamaño del envase de ${H.esc(e.mp.nombre)}" style="width:56px"> ${K.unidadEntrada(e.cfg.unidad)}</td>
      <td>${e.alcanza === null ? '—' : H.esc((Math.round(e.alcanza * 10) / 10).toLocaleString('es-CL')) + ' días'}<br><span class="ayuda">${e.prom ? H.esc(K.texto(e.prom, e.cfg.unidad)) + '/día' : ''}</span></td>
      <td class="ayuda">${e.st.conteo ? `${H.esc(fechaC(e.st.conteo.fecha))} · ${H.esc(P.AREAS[e.st.conteo.area] || (e.st.conteo.area === 'ADM' ? 'Administración' : e.st.conteo.area))}${dif(e)}` : 'nunca'}</td>
      <td><button type="button" class="btn-link" data-bod-quitar="${H.esc(e.docId)}">Quitar</button></td></tr>`).join('');
  const otras = c.datos.mps.filter(m => (m.estado || 'activa') === 'activa' && m.tipo !== 'sub_receta' && !lista.some(e => e.mp.id === m.id)).sort((a, x) => a.nombre.localeCompare(x.nombre, 'es'));
  const enCaf = new Set((c.porBodega.CAF || []).map(e => e.mp.id));
  const pasables = (bod === K.BODEGA_PRINCIPAL || prodB) && (c.bodegas || []).includes('CAF') ? lista.filter(e => !enCaf.has(e.mp.id)) : [];
  const quien = prodB ? `Responsable: ${H.esc(P.AREAS[K.areasAviso(bod, c.mapa)[0]] || nombre)} (la ve, la cuenta y recibe el aviso). Su stock baja con lo que consume cualquier área.`
    : areas ? 'La usan: ' + H.esc(areas) : 'Ningún área la usa';
  return `<h3 style="margin:12px 0 2px">Bodega ${H.esc(nombre)}</h3><p class="ayuda" style="margin-top:0">${quien}</p>
    ${lista.length ? `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Materia prima</th><th scope="col">Estado</th><th scope="col" style="text-align:right">Stock</th><th scope="col">Mínimo</th><th scope="col">Se cuenta en ${H.info('Se cuenta en', 'Vacío: se cuenta y se recibe en kg, litros o unidades.\nCon un envase (por ejemplo "saco" de 25 kg), en Cocina se escriben los sacos más lo suelto (3 sacos + 5 kg = 80 kg), y el stock también se ve en sacos. Si cambia el formato (centeno en sacos de 20 kg), lo cambias aquí.')}</th><th scope="col">Alcanza</th><th scope="col">Último conteo</th><th scope="col"><span class="sr">Quitar</span></th></tr></thead><tbody>${filas}</tbody></table></div>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" id="prod-bod-min${s}" data-bod-guardar="${H.esc(bod)}">Guardar cambios</button></div>` : `<p class="ayuda">Todavía no hay materias primas críticas en ${H.esc(nombre)}. Agrega las que quieres controlar${bod === 'CAF' ? ' (café, leche, vasos…)' : ' (harina, mantequilla…)'}.</p>`}
    <div class="fila-campos fila-bod" style="margin-top:8px">
      <div class="campo campo-ancho"><label for="prod-bod-nueva${s}">Agregar crítica en ${H.esc(nombre)}</label><select id="prod-bod-nueva${s}"><option value="">Elige una materia prima…</option>${otras.map(m => `<option value="${H.esc(m.id)}">${H.esc(m.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label for="prod-bod-nueva-min${s}">Mínimo</label><input id="prod-bod-nueva-min${s}" inputmode="decimal" placeholder="kg, l o un"></div>
      <button type="button" class="btn-sec" id="prod-bod-agregar${s}" data-bod-agregar="${H.esc(bod)}">Agregar</button>
    </div>
    ${lista.length ? `<h3 style="margin:16px 0 4px">Llegó mercadería a ${H.esc(nombre)}</h3>
    <div class="fila-campos fila-bod">
      <div class="campo campo-ancho"><label for="prod-bod-ll-mp${s}">Materia prima</label><select id="prod-bod-ll-mp${s}">${lista.map(e => `<option value="${H.esc(e.mp.id)}">${H.esc(e.mp.nombre)} (${K.unidadEntrada(e.cfg.unidad)})</option>`).join('')}</select></div>
      <div class="campo"><label for="prod-bod-ll-cant${s}">Cantidad</label><input id="prod-bod-ll-cant${s}" inputmode="decimal"></div>
      <div class="campo campo-ancho"><label for="prod-bod-ll-nota${s}">Proveedor o factura</label><input id="prod-bod-ll-nota${s}" maxlength="120"></div>
      <button type="button" class="btn-sec" id="prod-bod-llegada${s}" data-bod-llegada="${H.esc(bod)}">Anotar llegada</button>
    </div>` : ''}
    ${pasables.length ? `<details class="aviso" style="margin-top:14px" id="prod-bod-pasar"><summary><b>Pasar a Cafetería</b> · una vez, para las que hoy son críticas solo por Cafetería</summary>
      <p class="ayuda">Marca las que en realidad se guardan en la Cafetería. Se copia su mínimo y envase a la bodega de Cafetería ${H.info('Pasar a Cafetería', 'Hasta Cocina v0.15.0 había una sola bodega. Si una materia prima estaba marcada crítica por Cafetería (leche, café, vasos), aquí la pasas a la bodega de Cafetería.\nSe copia la crítica, el mínimo y el envase. Nada se borra: los conteos y llegadas de antes quedan en Producción. En Cafetería parte con su primer conteo.\nSi marcas "Dejar de seguirlas en Producción", en Producción quedan como no críticas (puedes volver a marcarlas).')}</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">${pasables.map(e => `<label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" data-bod-pasar="${H.esc(e.mp.id)}">${H.esc(e.mp.nombre)}</label>`).join('')}</div>
      <label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" id="prod-bod-pasar-quitar">Dejar de seguirlas en Producción</label>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" id="prod-bod-pasar-ok">Pasar a Cafetería</button></div></details>` : ''}`;
}
function conectarBodega(H) {
  const $b = id => document.getElementById(id), b = st.bodega;
  const repintarB = () => { $b('prod-bodega').innerHTML = seccionBodega(H); const r = $b('pl-res-bodega'); if (r) r.innerHTML = resumenBodega(); conectarBodega(H); };
  const calcular = async () => { b.cargando = true; b.msg = ''; repintarB(); try { b.calc = await P.calcularBodega(); } catch (e) { b.msg = error(e, H); } b.cargando = false; repintarB(); };
  const boton = $b('prod-bod-calc'); if (!boton) return;
  // v0.54.1: buscador sobre las listas de materias primas (café de Cafetería, agregar crítica, llegó mercadería)
  document.querySelectorAll('#prod-bod-cafe, select[id^="prod-bod-nueva"], select[id^="prod-bod-ll-mp"]').forEach(conBuscador);
  boton.addEventListener('click', calcular);
  document.querySelectorAll('[data-bod-tab]').forEach(t => t.addEventListener('click', () => { b.ver = t.dataset.bodTab; repintarB(); }));
  const per = $b('prod-bod-per'); if (per) per.addEventListener('change', () => { b.periodo = per.value; repintarB(); });
  const mp = id => b.calc.datos.mps.find(m => m.id === id);
  const nomB = bod => K.nombreBodega(bod, b.calc.mapa);
  const leerCant = (t, u) => { const v = String(t || '').trim(); if (!/^\d+([.,]\d+)?$/.test(v)) return null; return K.aBase(v, u); };
  const err = t => { $b('prod-bod-err').textContent = t; };
  // lista: [[mpId, control, bodega]]
  const guardar = async (lista, msg) => { try { for (const [id, x, bod] of lista) await P.guardarControl(id, x, bod); H.registrar(msg, lista.map(([id, , bod]) => `${(mp(id) || {}).nombre || id} (${nomB(bod)})`).join(', ')); await calcular(); } catch (e) { b.msg = error(e, H); repintarB(); } };
  const ag = document.querySelector('[data-bod-agregar]');
  if (ag) ag.addEventListener('click', () => {
    const bod = ag.dataset.bodAgregar, s = sufijo(bod), id = $b('prod-bod-nueva' + s).value; if (!id) { err('Elige una materia prima.'); return; }
    const u = K.unidadMp(mp(id)), t = $b('prod-bod-nueva-min' + s).value, seg = t.trim() === '' ? 0 : leerCant(t, u);
    if (seg === null) { err('El mínimo es un número (en kg, l o un).'); return; }
    // v0.65.0: en una bodega de producción (con responsables), esa área queda como responsable (el stock de siempre)
    const c = b.calc;
    if (K.esResponsable(c.mapa) && K.esProduccion(bod, c.mapa)) {
      const otra = c.criticas.find(e => e.mp.id === id && e.docId === id && e.bodega !== bod);
      if (otra && !confirm(`${mp(id).nombre} ya es crítica en ${nomB(otra.bodega)}. ¿Pasarla a ${nomB(bod)}? El stock y los conteos siguen igual.`)) return;
      (async () => { try { await P.guardarResponsables({ [id]: bod }); H.registrar('Cambió la bodega responsable', `${mp(id).nombre} → ${nomB(bod)}`); } catch (e) { b.msg = error(e, H); repintarB(); return; }
        guardar([[id, { critica: true, seguridad: seg }, bod]], 'Marcó una materia prima crítica (Bodega ' + nomB(bod) + ')'); })();
      return;
    }
    guardar([[id, { critica: true, seguridad: seg }, bod]], 'Marcó una materia prima crítica (Bodega ' + nomB(bod) + ')');
  });
  const gm = document.querySelector('[data-bod-guardar]');
  if (gm) gm.addEventListener('click', () => {
    const bod = gm.dataset.bodGuardar, lista = [];
    for (const e of b.calc.porBodega[bod] || []) {
      const inp = document.querySelector(`[data-bod-min="${CSS.escape(e.docId)}"]`); if (!inp) continue;
      const v = inp.value.trim() === '' ? 0 : leerCant(inp.value, e.cfg.unidad);
      if (v === null) { err(`${e.mp.nombre}: el mínimo es un número.`); return; }
      // Envase: nombre + tamaño (los dos o ninguno)
      const n = (document.querySelector(`[data-bod-env-n="${CSS.escape(e.docId)}"]`) || {}).value || '', tt = (document.querySelector(`[data-bod-env-t="${CSS.escape(e.docId)}"]`) || {}).value || '';
      let env = null;
      if (n.trim() || tt.trim()) {
        const tam = leerCant(tt, e.cfg.unidad);
        if (!n.trim() || !(tam > 0)) { err(`${e.mp.nombre}: el envase necesita nombre y tamaño (por ejemplo, saco de 25 ${K.unidadEntrada(e.cfg.unidad)}), o déjalo vacío.`); return; }
        env = { nombre: K.singular(n), tamano: tam };   // se guarda en singular ("sacos" → "saco")
      }
      const envAntes = e.cfg.envase ? `${e.cfg.envase.nombre}|${e.cfg.envase.tamano}` : '', envAhora = env ? `${env.nombre}|${env.tamano}` : '';
      if (Math.abs(v - e.cfg.seguridad) > 0.001 || envAntes !== envAhora) lista.push([e.mp.id, { critica: true, seguridad: v, envase: env }, bod]);
    }
    if (!lista.length) { err('No cambiaste nada.'); return; }
    guardar(lista, 'Cambió mínimos o envases de bodega');
  });
  document.querySelectorAll('[data-bod-quitar]').forEach(x => x.addEventListener('click', () => {
    const e = b.calc.criticas.find(y => y.docId === x.dataset.bodQuitar); if (!e) return;
    if (!confirm(`¿Quitar ${e.mp.nombre} de las críticas de ${nomB(e.bodega)}? Deja de llevar stock y alerta ahí. Sus llegadas y conteos quedan guardados.`)) return;
    guardar([[e.mp.id, { critica: false, seguridad: e.cfg.seguridad }, e.bodega]], 'Quitó una materia prima crítica (Bodega ' + nomB(e.bodega) + ')');
  }));
  // v0.65.0 · Asignar responsables (una vez) y cambiar la responsable de una
  document.querySelectorAll('[data-bod-asignar]').forEach(x => x.addEventListener('change', () => { b.resp = { ...(b.resp || {}), [x.dataset.bodAsignar]: x.value }; }));
  const asg = $b('prod-bod-asignar');
  if (asg) asg.addEventListener('toggle', () => { b.asignarAbierto = asg.open; });
  const asgOk = $b('prod-bod-asignar-ok');
  if (asgOk) asgOk.addEventListener('click', async () => {
    const elegidas = {}; document.querySelectorAll('[data-bod-asignar]').forEach(x => { elegidas[x.dataset.bodAsignar] = x.value; });
    const n = Object.keys(elegidas).length, cuenta = a => Object.values(elegidas).filter(v => v === a).length;
    if (!confirm(`¿Confirmar responsables? Panadería ${cuenta('PAN')}, Bollería ${cuenta('BOL')}, Pastelería ${cuenta('PAS')} (${n} en total). Cada área verá y contará solo las suyas en Cocina. No se copia ni se borra nada.`)) return;
    asgOk.disabled = true;
    try { await P.guardarResponsables(elegidas, { confirmar: true }); H.registrar('Confirmó las bodegas por área responsable', Object.entries(elegidas).map(([id, a]) => `${(mp(id) || {}).nombre || id} → ${P.AREAS[a]}`).join(', ')); b.resp = null; b.ver = 'PAN'; await calcular(); }
    catch (e) { b.msg = error(e, H); repintarB(); }
  });
  document.querySelectorAll('[data-bod-resp]').forEach(x => x.addEventListener('change', async () => {
    const id = x.dataset.bodResp, m = mp(id), de = b.ver, a = x.value; if (a === de) return;
    if (!confirm(`¿Pasar ${m ? m.nombre : id} de ${P.AREAS[de] || de} a ${P.AREAS[a] || a}? El stock, los conteos y las llegadas siguen igual; desde ahora la ve, la cuenta y recibe el aviso ${P.AREAS[a] || a}.`)) { x.value = de; return; }
    try { await P.guardarResponsables({ [id]: a }); H.registrar('Cambió la bodega responsable', `${m ? m.nombre : id}: ${P.AREAS[de] || de} → ${P.AREAS[a] || a}`); b.ver = a; await calcular(); }
    catch (e) { b.msg = error(e, H); repintarB(); }
  }));
  const pasar = $b('prod-bod-pasar-ok');
  if (pasar) pasar.addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('[data-bod-pasar]:checked')].map(x => x.dataset.bodPasar), quitar = $b('prod-bod-pasar-quitar').checked;
    if (!ids.length) { err('Marca al menos una materia prima para pasar a Cafetería.'); return; }
    if (!confirm(`¿Pasar ${ids.length} ${ids.length === 1 ? 'materia prima' : 'materias primas'} a la bodega de Cafetería?${quitar ? ' En Producción dejan de ser críticas.' : ' En Producción siguen igual.'} Nada se borra.`)) return;
    pasar.disabled = true;
    try { await P.pasarABodega(ids, 'CAF', { quitar }); H.registrar('Pasó materias primas a la bodega de Cafetería', ids.map(id => (mp(id) || {}).nombre || id).join(', ') + (quitar ? ' (ya no en Producción)' : '')); b.ver = 'CAF'; await calcular(); }
    catch (e) { b.msg = error(e, H); repintarB(); }
  });
  const cf = $b('prod-bod-cafe-ok');
  if (cf) cf.addEventListener('click', async () => {
    cf.disabled = true;
    try { const id = $b('prod-bod-cafe').value; await P.guardarMpCafe(id); H.registrar('Eligió la materia prima del café de Cafetería (Bodega)', id ? (mp(id) || {}).nombre || id : 'ninguna'); await calcular(); }
    catch (e) { b.msg = error(e, H); repintarB(); }
  });
  const ll = document.querySelector('[data-bod-llegada]');
  if (ll) ll.addEventListener('click', async () => {
    const bod = ll.dataset.bodLlegada, s = sufijo(bod), m = mp($b('prod-bod-ll-mp' + s).value), u = K.unidadMp(m), q = leerCant($b('prod-bod-ll-cant' + s).value, u);
    if (!(q > 0)) { err('Escribe la cantidad que llegó (en ' + K.unidadEntrada(u) + ').'); return; }
    ll.disabled = true;
    try { await P.registrarLlegada(m, q, $b('prod-bod-ll-nota' + s).value, bod); H.registrar('Anotó una llegada a bodega', `${m.nombre} · ${K.texto(q, u)} (${nomB(bod)})`); await calcular(); }
    catch (e) { b.msg = error(e, H); repintarB(); }
  });
}

// ═══════════════ Merma (P4b): lo que anotan las áreas en Cocina, valorizado ═══════════════
const UNID = { un: 'un', g: 'g', ml: 'ml' };
const cantM = (n, u) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-CL')} ${UNID[u] || ''}`;   // solo unidades conocidas (lo demás no se muestra)
function seccionMerma(H) {
  const m = st.merma, r = m.datos ? P.resumenMerma(m.datos) : null;
  const cab = `<div class="titulo-fila"><span class="ayuda">Lo perdido por área, valorizado ${H.info('Merma', 'Lo que las áreas anotan en Cocina como perdido (productos, preparaciones o materias primas), con su motivo.\nEl costo es neto (sin IVA) y sale del costo directo de Finanzas (Finanzas → Costos → Productos): recetas y sub recetas con su costo por unidad o por gramo, y materias primas con el precio de su última compra. Si algo no tiene costo ahí (o está incompleto), se usa el de la planilla (Maestro_recetas o MP_maestro) y dice "costo de la planilla". Las jefas no ven precios.\nSe copia sola a la hoja "Registro_merma" para Looker.\nLas anotaciones anuladas no cuentan.')}</span>
      <div class="fila-campos" style="align-items:flex-end;gap:8px;flex-wrap:nowrap"><select id="prod-merma-per" aria-label="Período">${Object.entries(P.PERIODOS_MERMA).map(([k, t]) => `<option value="${k}" ${m.periodo === k ? 'selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="btn-sec" id="prod-merma-ver" ${m.cargando ? 'disabled' : ''}>${m.cargando ? 'Leyendo…' : m.datos ? 'Actualizar' : 'Ver'}</button></div></div>`;
  if (!r) return cab + (m.msg ? `<p class="error">${H.esc(m.msg)}</p>` : '<p class="ayuda">Elige el período y presiona "Ver".</p>');
  const d = m.datos, rango = `${d.desde.split('-').reverse().slice(0, 2).join('/')} al ${d.hasta.split('-').reverse().slice(0, 2).join('/')}`;
  const area = a => `<div class="merma-area">
      <div class="titulo-fila" style="margin-top:10px"><h3 style="margin:0">${H.esc(P.AREAS[a.area] || a.area)}</h3><b>${pesosN(a.total)}${a.sinCosto ? ' <span class="chip c-amarillo">' + a.sinCosto + ' sin costo</span>' : ''}</b></div>
      <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Ítem</th><th scope="col">Cantidad</th><th scope="col">Motivo</th><th scope="col" style="text-align:right">Costo neto</th></tr></thead><tbody>
      ${a.items.map(it => `<tr><td>${H.esc(it.nombre)}${it.tipo === 'mp' ? ' <span class="ayuda">(MP)</span>' : ''}${it.derramado ? ' <span class="chip c-amarillo">Derramado</span>' : ''}</td><td>${cantM(it.cantidad, it.unidad)}</td><td>${Object.entries(it.motivos).map(([k, n]) => H.esc(P.MOTIVOS[k] || k) + (n > 1 ? ` (${n})` : '')).join(', ')}</td><td style="text-align:right">${it.sinCosto && !it.neto ? '<span class="ayuda">sin costo</span>' : pesosN(it.neto) + (it.sinCosto ? ' <span class="ayuda">(parcial)</span>' : '') + (it.planilla ? ' <span class="ayuda merma-fuente">costo de la planilla</span>' : '') + (it.incompleto ? ' <span class="ayuda merma-fuente">costo incompleto</span>' : '')}</td></tr>`).join('')}
      </tbody></table></div>
      ${Object.keys(a.motivos).length > 1 ? `<p class="ayuda">Por motivo: ${Object.entries(a.motivos).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${H.esc(P.MOTIVOS[k] || k)} ${pesosN(v)}`).join(' · ')}</p>` : ''}
    </div>`;
  return cab + `
    <p class="ayuda">${H.esc(rango)} · Total: <b>${pesosN(r.total)}</b> neto${r.areas.some(a => a.sinCosto) ? ' (hay ítems sin costo en la planilla: no suman)' : ''}${r.areas.some(a => a.planilla) ? ' · algunos con costo de la planilla' : ''}</p>
    ${d.errorCostos ? `<p class="error">No se pudieron leer los costos: ${H.esc(d.errorCostos)}</p>` : ''}
    ${r.areas.length ? r.areas.map(area).join('') : '<p class="ayuda">Nada anotado como merma en este período.</p>'}
    ${r.cafe.total ? seccionCafe(H, r.cafe) : ''}`;
}
// Café de Cafetería: calibración diaria (automática o editada, por día, valorizada como gasto de calibración) + la bitácora
const DIA_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function seccionCafe(H, cafe) {
  const cd = cafe.calibracionDiaria;
  const dias = cd.dias.map(x => `<li>${H.esc(DIA_S[new Date(x.fecha + 'T12:00:00').getDay()] + ' ' + fechaC(x.fecha))}: ${H.esc(String(x.shots))} shots ${x.auto ? '(automática)' : '<b>(editada)</b>'} · ${cantM(x.gramos, 'g')}</li>`).join('');
  return `<h3 style="margin:16px 0 4px">Café de Cafetería ${H.info('Café de Cafetería', 'Calibración diaria: los shots que se cuentan solos cada día que Cafetería vende en la caja (configuración de Cafetería; vacío = 6), o el número que la barista editó ese día en Cocina (0 si no se calibró). Se valoriza como gasto de calibración, con el costo neto del café (maestro de costos de Finanzas; si falta, MP_maestro).\nCalibración extra, café botado y pruebas: lo anotado en la bitácora de turno.\nTodo esto se descuenta del café de la bodega de Cafetería.')}</h3>
    <p class="ayuda">Calibración diaria: <b>${H.esc(String(cd.shots))} shots · ${cantM(cd.gramos, 'g')}</b> en ${cd.dias.length} ${cd.dias.length === 1 ? 'día' : 'días'}${cd.editados ? ` (${cd.editados} editado${cd.editados === 1 ? '' : 's'})` : ''}${cd.neto !== null ? ` · gasto de calibración <b>${pesosN(cd.neto)}</b> neto` : cd.gramos ? ' · sin costo del café' : ''}</p>
    ${cd.dias.length ? `<details><summary class="ayuda">Ver por día</summary><ul class="ayuda">${dias}</ul></details>` : ''}
    <p class="ayuda">Bitácora de turno: calibración extra ${cantM(cafe.calibracion, 'g')} · café botado ${cantM(cafe.merma, 'g')} · pruebas ${cantM(cafe.prueba_receta, 'g')} · <b>total de café ${cantM(cafe.total, 'g')}</b> (con la calibración diaria)</p>
    ${cafe.porGramo !== null && cafe.porGramo !== undefined ? `<p class="ayuda" id="merma-cafe-valor">Valorizado: bitácora de turno <b>${pesosN(cafe.netoBitacora)}</b> · todo el café <b>${pesosN(cafe.netoTotal)}</b> neto · café a ${pesosN(cafe.porGramo * 1000)} / kg${cafe.fuente === 'planilla' ? ' (costo de la planilla)' : ''} ${H.info('Café valorizado', 'Los gramos de café (calibración diaria, calibración extra, café botado y pruebas) × el precio neto por gramo de la materia prima café de Cafetería (Configuración de Producción → Cafetería).\nEl precio sale del maestro de costos de Finanzas (última compra); si no está, de la planilla.')}</p>` : ''}`;
}
function conectarMerma(el, H) {
  const b = $('prod-merma-ver'), sel = $('prod-merma-per'); if (!b) return;
  sel.addEventListener('change', () => { st.merma.periodo = sel.value; });
  b.addEventListener('click', async () => {
    st.merma.periodo = sel.value; st.merma.cargando = true; st.merma.msg = ''; $('prod-merma').innerHTML = seccionMerma(H); conectarMerma(el, H);
    // v0.63.3: lo pides tú: se lee de nuevo (fresco)
    try { st.merma.datos = await P.mermaDelPeriodo({ ...P.periodoMerma(st.merma.periodo), fresco: true }); } catch (e) { st.merma.datos = null; st.merma.msg = error(e, H); }
    st.merma.cargando = false; $('prod-merma').innerHTML = seccionMerma(H); if ($('pl-res-merma')) $('pl-res-merma').innerHTML = resumenMerma(); conectarMerma(el, H);
  });
}

// ═══════════════ Recetas por aprobar y materias primas pedidas (desde Cocina) ═══════════════
const FMr = c => P.resumenPropuesta(c);
const pesosN = v => '$' + Math.round(Number(v) || 0).toLocaleString('es-CL');
const pesosD = v => '$' + (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('es-CL');
const ESTADO_TXT = { en_revision: 'En revisión', devuelta: 'Devuelta', aprobada: 'Aprobada' };
async function pintarCocina(el, H, leer) {
  const caja = $('prod-cocina'); if (!caja) return;
  if (leer) {
    try { [st.props, st.sols] = await Promise.all([P.propuestasEnRevision(), P.solicitudesPendientes()]); st.cocinaMsg = ''; }
    catch (e) { st.props = st.props || []; st.sols = st.sols || []; st.cocinaMsg = error(e, H); }
  }
  if (!$('prod-cocina')) return;
  const props = st.props || [], sols = st.sols || [];
  const cuando = p => String(((p.historial || []).slice(-1)[0] || {}).en || '').slice(0, 10);
  // Sin nada esperando: una sola línea
  if (!props.length && !sols.length && !st.cocinaMsg) {
    caja.innerHTML = `<div class="titulo-fila"><h2 id="t-prod-revision">Desde Cocina</h2><span class="ayuda">Nada esperando: recetas por aprobar · 0 · materias primas pedidas · 0</span></div>`;
    return;
  }
  caja.innerHTML = `
    <div class="titulo-fila"><h2 id="t-prod-revision">Desde Cocina ${H.info('Desde Cocina', 'Las jefas de cada área crean y cambian recetas en Cocina. Cada cambio llega aquí como propuesta: la receta vigente sigue igual hasta que la apruebas.\nEl costo lo calcula el script de Producción con los precios de la planilla (neto, sin IVA). Al aprobar, la receta queda en la planilla (costeo, catálogo de caja/B2B y Looker siguen igual) y en la base nueva; la versión anterior queda guardada.\nSi la devuelves, la jefa ve tu comentario y la corrige.')}</h2></div>
    ${st.cocinaMsg ? `<p class="error">${H.esc(st.cocinaMsg)}</p>` : ''}
    <h3 style="margin:8px 0">Recetas por aprobar · ${props.length}</h3>
    ${props.length ? `<div class="lista-simple">${props.map(p => `<div class="fila-caja" data-prop="${H.esc(p.docId)}" style="flex-wrap:wrap">
        <div class="txt"><b>${H.esc((p.datos || {}).nombre || 'Sin nombre')}</b><span>${P.AREAS[p.area] || p.area} · ${p.recetaId ? `cambio a la v${H.esc(String((p.vigente || {}).version || 1))}` : 'receta nueva'}${p.origen === 'ajuste' ? ' · desde el ajuste de harina/agua' : ''} · ${H.esc(p.creadaPor || '')} · ${H.esc(cuando(p))}</span></div>
        ${p.estado === 'aprobando' ? `<span class="chip c-amarillo">Aprobándose</span><button type="button" class="btn-sec" data-prop-destrabar="${H.esc(p.docId)}" title="Si se cortó la aprobación, vuelve a revisión para reintentarla">Volver a revisión</button>`
          : `<button type="button" class="btn-sec" data-prop-revisar="${H.esc(p.docId)}">${st.abierta === p.docId ? 'Cerrar' : 'Revisar'}</button>`}
        ${st.abierta === p.docId ? `<div style="flex-basis:100%">${detallePropuesta(p, H)}</div>` : ''}
      </div>`).join('')}</div>` : '<p class="ayuda">No hay recetas esperando.</p>'}
    <h3 style="margin:16px 0 8px">Materias primas pedidas · ${sols.length}</h3>
    ${sols.length ? `<div class="lista-simple">${sols.map(s => filaSolicitud(s, H)).join('')}</div>` : '<p class="ayuda">No hay pedidos.</p>'}`;
  caja.querySelectorAll('[data-prop-revisar]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.propRevisar;
    st.abierta = st.abierta === id ? null : id;
    pintarCocina(el, H, false);
    if (st.abierta && !st.costos[id]) {
      const p = props.find(x => x.docId === id);
      try { st.costos[id] = await P.costear(p); } catch (e) { st.costos[id] = { error: error(e, H) }; }
      pintarCocina(el, H, false);
    }
  }));
  caja.querySelectorAll('[data-prop-destrabar]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await P.destrabar(props.find(x => x.docId === b.dataset.propDestrabar)); } catch (e) { st.cocinaMsg = error(e, H); }
    pintarCocina(el, H, true);
  }));
  caja.querySelectorAll('[data-prop-accion]').forEach(b => b.addEventListener('click', async () => {
    const p = props.find(x => x.docId === b.dataset.propId), com = ($('prop-com') || {}).value || '', err = $('prop-err');
    err.textContent = ''; b.disabled = true;
    try {
      if (b.dataset.propAccion === 'aprobar') {
        const r = await P.aprobar(p, com);
        H.registrar('Aprobó una receta de Cocina', `${(p.datos || {}).nombre} · ${P.AREAS[p.area]} · v${r.version}`);
        st.cocinaMsg = '';
      } else {
        await P.devolver(p, com);
        H.registrar('Devolvió una receta a Cocina', `${(p.datos || {}).nombre} · ${P.AREAS[p.area]}`);
      }
      st.abierta = null; delete st.costos[p.docId];
      pintarCocina(el, H, true);
    } catch (e) {
      if (e.code === 'cambio') { st.abierta = null; st.cocinaMsg = error(e, H); pintarCocina(el, H, true); return; }
      err.textContent = error(e, H); b.disabled = false;
    }
  }));
  caja.querySelectorAll('[data-sol-accion]').forEach(b => b.addEventListener('click', async () => {
    const s = sols.find(x => x.docId === b.dataset.solId), f = b.closest('[data-sol]'), err = f.querySelector('.error'), v = k => (f.querySelector(`[data-k="${k}"]`) || {}).value || '';
    err.textContent = ''; b.disabled = true;
    try {
      if (b.dataset.solAccion === 'rechazar') {
        const motivo = prompt('¿Por qué no se crea? (lo ve la jefa)', ''); if (motivo === null) { b.disabled = false; return; }
        await P.rechazarSolicitud(s, motivo);
      } else if (b.dataset.solAccion === 'habilitar') {
        await P.resolverSolicitud(s, { habilitarId: b.dataset.mpId || s.mpId });
        H.registrar('Habilitó una materia prima para un área', `${s.nombre} → ${P.AREAS[s.area]}`);
      } else {
        const costo = Number(v('costo').replace(/\./g, '').replace(',', '.'));
        if (!(costo > 0)) { err.textContent = 'Escribe el costo neto (sin IVA) de la unidad de compra.'; b.disabled = false; return; }
        await P.resolverSolicitud(s, { nombre: v('nombre').trim() || s.nombre, tipo: v('tipo'), categoria: v('categoria').trim(), unidad: v('unidad').trim(), costoNeto: costo });
        H.registrar('Creó una materia prima pedida en Cocina', `${s.nombre} · ${P.AREAS[s.area]}`);
      }
      pintarCocina(el, H, true);
    } catch (e) {
      err.innerHTML = H.esc(error(e, H)) + (e.code === 'existe' && e.datos && e.datos.id ? ` <button type="button" class="btn-sec" data-sol-accion="habilitar" data-sol-id="${H.esc(s.docId)}" data-mp-id="${H.esc(e.datos.id)}">Habilitar esa</button>` : '');
      err.querySelectorAll('[data-sol-accion]').forEach(x => x.addEventListener('click', async () => {
        try { await P.resolverSolicitud(s, { habilitarId: x.dataset.mpId }); pintarCocina(el, H, true); } catch (e2) { err.textContent = error(e2, H); }
      }));
      b.disabled = false;
    }
  }));
}

function detallePropuesta(p, H) {
  const d = p.datos || {}, v = p.vigente, c = st.costos[p.docId];
  const cant = i => i ? (i.unidades !== null && i.unidades !== undefined && i.unidades !== '' ? `${String(i.unidades).replace('.', ',')} un · ` : '') + `${(Math.round((Number(i.gramos) || 0) * 10) / 10).toLocaleString('es-CL')} g` : '—';
  const vIngs = v ? v.ingredientes || [] : [];
  const ids = [...new Set([...(d.ingredientes || []).map(i => i.id), ...vIngs.map(i => i.id)])];
  // v0.63.6: costo neto por ingrediente (Finanzas), vigente y propuesta: se ve qué ingrediente mueve el costo
  const lnV = c && !c.error && c.vigente && c.vigente.lineas, lnP = c && !c.error && c.propuesta && c.propuesta.lineas, conCosto = !!(lnP || lnV);
  const cst = (ln, id, hay) => (!hay ? '' : ln && ln[id] !== null && ln[id] !== undefined ? ` <span class="prop-costo">${pesosN(ln[id])}</span>` : ln && id in ln ? ' <span class="prop-costo">sin precio</span>' : '');
  const filas = ids.map(id => {
    const a = vIngs.find(i => i.id === id), b = (d.ingredientes || []).find(i => i.id === id), igual = a && b && cant(a) === cant(b);
    return `<tr${igual ? '' : ' class="cambio"'}><td>${H.esc((b || a).nombre)}</td>${v ? `<td>${cant(a)}${cst(lnV, id, !!a)}</td>` : ''}<td>${cant(b)}${cst(lnP, id, !!b)}${!a && v ? ' <span class="chip c-verde">nuevo</span>' : !b ? ' <span class="chip c-rojo">sale</span>' : ''}</td></tr>`;
  }).join('');
  const otros = [];
  const cmp = (t, x, y) => { if (String(x ?? '') !== String(y ?? '')) otros.push(`${t}: ${H.esc(String(x ?? '—'))} → <b>${H.esc(String(y ?? '—'))}</b>`); };
  if (v) {
    cmp('Nombre', v.nombre, d.nombre); cmp('Rinde', `${v.porciones} ${v.unidad}`, `${d.porciones} ${d.unidad}`); cmp('Tipo', v.tipo, d.tipo);
    cmp('Clasificación', v.clasificacion, d.clasificacion); cmp('Peso por unidad', v.pesoUnidad || '', d.pesoUnidad || '');
    if (JSON.stringify(v.pasos || []) !== JSON.stringify(d.pasos || [])) otros.push(`Pasos: ${(v.pasos || []).length} → <b>${(d.pasos || []).length}</b> (cambiaron)`);
    if (JSON.stringify((v.insumos || []).map(i => i.id)) !== JSON.stringify((d.insumos || []).map(i => i.id))) otros.push('Insumos: cambiaron');
  } else otros.push(`Rinde ${H.esc(String(d.porciones))} ${d.unidad === 'g' ? 'g' : 'un'} · ${d.tipo === 'sub_receta' ? 'sub receta' : 'receta'}${d.clasificacion ? ' · ' + H.esc(d.clasificacion) : ''} · ${(d.pasos || []).length} pasos`);
  const pct = x => (x === null || x === undefined || !isFinite(x) ? '' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${(Math.round(Math.abs(x) * 10) / 10).toLocaleString('es-CL')} %`);
  const pctCls = x => (x > 0.05 ? 'dif-mal' : x < -0.05 ? 'prop-baja' : '');
  const rinde = x => `${H.esc(String(x.porciones))} ${x.unidad === 'g' ? 'g' : 'un'}`;
  const costo = !c ? '<p class="ayuda">Calculando el costo (neto, con Finanzas o con los precios de la planilla)…</p>' : c.error ? `<p class="error">${H.esc(c.error)}</p>` : (() => {
    const n = c.propuesta, o = c.vigente, R = FMr(c);
    const avisos = [...(n.faltan || []).map(x => `${x}: no está en MP_maestro`), ...(n.sinPrecio || []).map(x => `${x}: sin precio`)];
    const rv = o ? { porciones: v.porciones, unidad: v.unidad } : null, rn = { porciones: d.porciones, unidad: d.unidad };
    const fuente = c.fuente === 'finanzas' ? 'Costo neto de Finanzas (Finanzas → Costos: precio de la última compra).' : 'Costo neto con los precios de la planilla (Finanzas no tiene todos los precios de esta receta).';
    const tit = R.titular ? `<p class="prop-titular" id="prop-titular"><b class="${pctCls(R.titular.pct)}">${pct(R.titular.pct)}</b> el costo ${R.titular.que} (neto) ${H.info('Qué cambia', `Lo primero es el costo ${R.titular.que === 'por unidad' ? 'por unidad (lo que cuesta cada una)' : 'del lote completo (todo lo que se hace con la receta)'}, no el costo por gramo.\nSi la receta rinde más gramos porque lleva más agua o leche, el gramo sale más barato aunque cada taza o pieza cueste más: por eso el costo por gramo queda abajo, como dato secundario.\n${fuente}`)}</p>` : '';
    const vpu = c.vendePorUnidad && c.vendePorUnidad.si ? `<p class="aviso" id="prop-aviso-unidad">Esta receta rinde en gramos pero se vende por unidad: compara el costo del lote. Conviene que rinda unidades (ej. 1 espresso). ${H.info('Rinde en gramos, se vende por unidad', `Esta receta ${c.vendePorUnidad.motivo || 'se vende por unidad'}. Su costo se calcula por gramo, y el gramo cambia cuando cambia el rendimiento (más agua = más gramos), aunque cada taza cueste lo mismo o más.\nMientras rinda gramos, mira el costo del lote (lo que cuesta hacerla una vez).\nSi en Cocina se cambia para que rinda unidades (por ejemplo 1 espresso), el costo por unidad sale directo y se compara bien.`)}</p>` : '';
    const lote = `<div class="cifras" style="margin:10px 0">
      ${o ? `<div class="tarjeta cifra"><span class="rotulo">Lote vigente</span><span class="valor">${pesosN(o.loteNeto)}</span><span class="nota">neto · ${rinde(rv)}</span></div>` : ''}
      <div class="tarjeta cifra"><span class="rotulo">Lote propuesto</span><span class="valor">${pesosN(n.loteNeto)}</span><span class="nota">neto · ${rinde(rn)}${R.pctLote !== null ? ` · <b class="${pctCls(R.pctLote)}">${pct(R.pctLote)}</b>` : ''}</span></div>
      ${R.unN !== null ? `${R.unV !== null ? `<div class="tarjeta cifra"><span class="rotulo">Vigente · por unidad</span><span class="valor">${pesosD(R.unV)}</span><span class="nota">neto · bruto ${pesosD(R.unV * 1.19)}</span></div>` : ''}<div class="tarjeta cifra"><span class="rotulo">Propuesta · por unidad</span><span class="valor">${pesosD(R.unN)}</span><span class="nota">neto · bruto ${pesosD(R.unN * 1.19)}${R.pctUn !== null ? ` · <b class="${pctCls(R.pctUn)}">${pct(R.pctUn)}</b>` : ''}</span></div>` : ''}
    </div>`;
    const pgV = o ? (o.unidad === 'g' ? o.unidadNeto : o.porGramo) : null, pgN = n.unidad === 'g' ? n.unidadNeto : n.porGramo;
    const gramo = pgN !== null && pgN !== undefined ? `<div class="cifras prop-secundaria" id="prop-por-gramo">
      ${pgV !== null && pgV !== undefined ? `<div class="cifra"><span class="rotulo">Vigente · por gramo</span><span class="valor">${pesosD(pgV)}</span><span class="nota">neto · bruto ${pesosD(pgV * 1.19)}</span></div>` : ''}
      <div class="cifra"><span class="rotulo">Propuesta · por gramo</span><span class="valor">${pesosD(pgN)}</span><span class="nota">neto · bruto ${pesosD(pgN * 1.19)}${R.pctGramo !== null ? ` · ${pct(R.pctGramo)}` : ''}</span></div>
    </div>` : '';
    return `${tit}${vpu}${lote}${gramo}${avisos.length ? `<p class="aviso">${avisos.map(H.esc).join(' · ')}</p>` : ''}`;
  })();
  const ult = [...(p.historial || [])].reverse().find(h => h.comentario);
  return `<div style="border-top:1px solid var(--borde);margin-top:10px;padding-top:10px">
    ${ult ? `<p class="ayuda">Nota de ${H.esc(ult.por || '')}: ${H.esc(ult.comentario)}</p>` : ''}
    <div class="tabla-b2b"><table class="tabla-tiempos" id="prop-ingredientes"><thead><tr><th scope="col">Ingrediente</th>${v ? `<th scope="col">Vigente${conCosto ? ' · costo neto' : ''}</th>` : ''}<th scope="col">Propuesta${conCosto ? ' · costo neto' : ''}</th></tr></thead><tbody>${filas}</tbody></table></div>
    ${otros.length ? `<ul class="ayuda" style="margin:8px 0 0 18px">${otros.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${costo}
    <div class="campo"><label for="prop-com">Comentario (si la devuelves, la jefa lo ve; si la apruebas, queda en el registro)</label><textarea id="prop-com" rows="2" maxlength="500" style="font:inherit;padding:10px;border-radius:10px;border:1px solid var(--borde)"></textarea></div>
    <div class="error" id="prop-err" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" data-prop-accion="devolver" data-prop-id="${H.esc(p.docId)}">Devolver</button><button type="button" class="btn" data-prop-accion="aprobar" data-prop-id="${H.esc(p.docId)}" ${c && !c.error && !(c.propuesta.faltan || []).length ? '' : 'disabled'}>Aprobar${p.recetaId ? ' y reemplazar la vigente' : ''}</button></div>
  </div>`;
}

function filaSolicitud(s, H) {
  const base = `<div class="txt"><b>${s.tipo === 'habilitar' ? 'Habilitar' : 'Nueva'}: ${H.esc(s.nombre)}</b><span>${P.AREAS[s.area] || s.area} · ${H.esc(s.por || '')}${s.receta ? ' · para ' + H.esc(s.receta) : ''}${s.nota ? ' · “' + H.esc(s.nota) + '”' : ''}</span></div>`;
  if (s.tipo === 'habilitar') return `<div class="fila-caja" data-sol="${H.esc(s.docId)}" style="flex-wrap:wrap">${base}
      <div class="botones"><button type="button" class="btn-sec" data-sol-accion="rechazar" data-sol-id="${H.esc(s.docId)}">No</button><button type="button" class="btn" data-sol-accion="habilitar" data-sol-id="${H.esc(s.docId)}">Habilitar para ${P.AREAS[s.area] || s.area}</button></div>
      <div class="error" role="alert" style="flex-basis:100%"></div></div>`;
  const id = k => `sol-${s.docId}-${k}`;
  return `<div class="fila-caja" data-sol="${H.esc(s.docId)}" style="flex-wrap:wrap">${base}
    <div class="fila-campos" style="flex-basis:100%;flex-wrap:wrap;align-items:flex-end">
      <div class="campo"><label for="${id('n')}">Nombre</label><input id="${id('n')}" data-k="nombre" value="${H.esc(s.nombre)}"></div>
      <div class="campo"><label for="${id('t')}">Es</label><select id="${id('t')}" data-k="tipo"><option value="mp" ${s.esInsumo ? '' : 'selected'}>Materia prima</option><option value="insumo" ${s.esInsumo ? 'selected' : ''}>Insumo</option></select></div>
      <div class="campo"><label for="${id('c')}">Categoría</label><input id="${id('c')}" data-k="categoria" placeholder="Secos, Lácteos…"></div>
      <div class="campo"><label for="${id('u')}">Se compra por</label><input id="${id('u')}" data-k="unidad" value="${H.esc(P.UNIDAD_COMPRA.test(s.unidadCompra || '') ? s.unidadCompra : (s.esInsumo ? 'un' : 'kg'))}" placeholder="kg, 25kg, lt, un, 10un">${s.unidadCompra && !P.UNIDAD_COMPRA.test(s.unidadCompra) ? `<small class="ayuda">La jefa escribió “${H.esc(s.unidadCompra)}”</small>` : ''}</div>
      <div class="campo"><label for="${id('p')}">Costo neto de esa unidad ($, sin IVA)</label><input id="${id('p')}" data-k="costo" inputmode="decimal"></div>
    </div>
    <div class="error" role="alert" style="flex-basis:100%"></div>
    <div class="botones" style="flex-basis:100%"><button type="button" class="btn-sec" data-sol-accion="rechazar" data-sol-id="${H.esc(s.docId)}">No crear</button><button type="button" class="btn" data-sol-accion="crear" data-sol-id="${H.esc(s.docId)}">Crear y habilitar para ${P.AREAS[s.area] || s.area}</button></div>
  </div>`;
}

function listaMover(H) {
  const l = st.mover || [];
  if (!l.length) return '<p class="ayuda">Bollería no tiene recetas en la base nueva.</p>';
  const sug = l.filter(r => r.sugerida).length;
  return `<p class="ayuda">${sug ? `Marcadas las ${sug} que parecen de Pastelería (rellenos, cremas, glaseados…). Revisa y cambia lo que haga falta.` : 'Marca las que pasan a Pastelería.'}</p>
    <div class="lista-simple">${l.map(r => `<label class="fila-caja" style="cursor:pointer"><input type="checkbox" data-mover="${H.esc(r.id)}" ${r.sugerida ? 'checked' : ''} style="width:22px;height:22px">
      <div class="txt"><b>${H.esc(r.nombre)}</b><span>${r.tipo === 'sub_receta' ? 'Sub receta' : 'Receta'}${r.clasificacion ? ' · ' + H.esc(r.clasificacion) : ''} · ${H.esc(r.estado || '')}</span></div></label>`).join('')}</div>
    <div class="botones" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn" id="prod-mover-ok">Pasar las marcadas a Pastelería</button></div>`;
}

