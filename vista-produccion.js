// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Producción  v0.35.0
//  Base nueva de Producción (fen-produccion): conexión, cuentas de las áreas (las tablets
//  de la app Cocina), copia desde la planilla con control de totales y Configuración de
//  Producción por área (v0.32.0), y recetas por aprobar y materias primas pedidas desde Cocina (v0.33.0).
//  H = ayudas de app.js: { esc, info, icono, registrar, mensajeError, hace }
// ═══════════════════════════════════════════════
import * as P from './produccion.js?v=0.35.0';

const st = { prep: null, tot: null, copiando: false, msg: '', props: null, sols: null, abierta: null, costos: {}, cocinaMsg: '', mover: null, moverMsg: '' };
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
const cab = H => `<div class="cabecera"><div><h1 id="t-produccion">Producción</h1><p>Base nueva de la cocina (fen-produccion) · la app actual sigue funcionando igual</p></div></div>`;

export async function pintar(el, sub, H) {
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
  el.innerHTML = cab(H) + `
    <section class="tarjeta" aria-labelledby="t-prod-revision" id="prod-cocina"><div class="vacio" style="border:0">Revisando lo que llegó desde Cocina…</div></section>
    <section class="tarjeta" aria-labelledby="t-prod-cuentas">
      <div class="titulo-fila"><h2 id="t-prod-cuentas">Cuentas de las áreas ${H.info('Cuentas de las áreas', 'Cada tablet de la cocina se autoriza una vez con la cuenta de su área (la creas en la consola de Firebase de fen-produccion → Authentication). Aquí dices de qué área es cada cuenta: con eso, esa tablet solo ve y cambia lo de su área. Una cuenta puede tener más de un área ("También entra a").\nEl UID está en la consola → Authentication → Usuarios. No es secreto.\nLa contraseña de cada cuenta no pasa por aquí: la escribes tú en la tablet al autorizarla.')}</h2><span>${H.esc(cx.cfg.projectId)}</span></div>
      <div class="lista-simple">${Object.keys(P.AREAS).map(a => `<div class="fila-caja fila-compacta"><div class="txt"><b>${P.AREAS[a]}</b><span>${porArea(a).length ? porArea(a).map(c => H.esc(c.uid) + (c.area !== a ? ` (también; principal ${H.esc(P.AREAS[c.area] || c.area)})` : '')).join(' · ') : 'Sin cuenta asignada'}</span></div>${porArea(a).length ? '<span class="chip c-verde">Lista</span>' : '<span class="chip c-gris">Falta</span>'}</div>`).join('')}</div>
      ${cuentas.length ? `<h3 style="margin:14px 0 4px;font-size:15px">Cuentas ${H.info('Cambiar las áreas de una cuenta', 'Toca "Cambiar" para cargar la cuenta en el formulario de abajo, marca o desmarca áreas y presiona Guardar.\nSi una tablet ya estaba abierta, toma el cambio en la próxima carga.')}</h3>
      <div class="lista-simple">${cuentas.map(c => `<div class="fila-caja fila-compacta"><div class="txt"><b>${P.areasDeCuenta(c).map(a => H.esc(P.AREAS[a])).join(' + ') || 'Sin área'}</b><span>${H.esc(c.uid)}</span></div><button type="button" class="btn-sec" data-cta-editar="${H.esc(c.uid)}">Cambiar</button></div>`).join('')}</div>` : ''}
      <form id="prod-cuenta" style="margin-top:12px">
        <div class="fila-campos" style="align-items:flex-end">
          <div class="campo"><label for="prod-cta-area">Área principal ${H.info('Área principal', 'Con esta área abre la tablet la primera vez. Después recuerda la última en que estuvo.')}</label><select id="prod-cta-area">${Object.entries(P.AREAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="campo" style="flex:2"><label for="prod-cta-uid">UID de la cuenta del área</label><input id="prod-cta-uid" spellcheck="false" autocomplete="off"></div>
        </div>
        <fieldset style="border:0;padding:0;margin:8px 0 0"><legend style="font-weight:600;font-size:14px;margin-bottom:4px">También entra a ${H.info('Más de un área', 'Marca las otras áreas a las que puede entrar esta tablet (por ejemplo, una tablet compartida entre Bollería y Pastelería).\nArriba de la app aparece "Cambiar de área". En cada área se pide el PIN de una persona de esa área, y la tablet ve y cambia solo lo de esa área mientras está en ella.')}</legend>
          <div style="display:flex;gap:16px;flex-wrap:wrap">${Object.entries(P.AREAS).map(([k, v]) => `<label style="display:flex;gap:6px;align-items:center;min-height:44px"><input type="checkbox" name="prod-cta-otras" value="${k}">${v}</label>`).join('')}</div>
        </fieldset>
        <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn-sec">Guardar</button></div>
      </form>
      <div class="error" id="prod-cta-err" role="alert"></div>
    </section>

    <section class="tarjeta" aria-labelledby="t-prod-copia">
      <div class="titulo-fila"><h2 id="t-prod-copia">Copia desde la planilla ${H.info('Copia desde la planilla', 'Lee la planilla de Producción con el script (v2.3.0) y copia a la base nueva: recetas, materias primas (sin costos), configuración de masa madre y poolish, planes semanales y quién entra a cada área con su PIN.\nSe puede repetir las veces que quieras. Un plan semanal que ya se cambió en la app Cocina no se pisa: desde que un área usa Cocina, su plan manda ahí.\nNada se borra.')}</h2><span>${ult && ult.ultima ? 'Última: ' + H.esc(H.hace(ult.ultima)) : 'Nunca copiada'}</span></div>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prod-leer">Leer la planilla</button></div>
      <div id="prod-prep">${p ? resumenPrep(p, H) : ''}</div>
      <div id="prod-avance" class="ayuda" aria-live="polite">${H.esc(st.msg)}</div>
    </section>

    ${seccionConfig(cfgs, H)}

    <section class="tarjeta" aria-labelledby="t-prod-mover" id="prod-mover">
      <div class="titulo-fila"><h2 id="t-prod-mover">Pasar recetas de Bollería a Pastelería ${H.info('Pasar recetas a Pastelería', 'Los rellenos, cremas y otras preparaciones del día pasan a Pastelería. Marca cuáles: se mueven en la planilla con el mismo ID (la fila se copia a PAS_recetas y recién después sale de BOL_recetas; queda registro en "Movimientos_recetas") y en la base nueva.\nLos productos de Bollería que las usan siguen funcionando: la sub receta queda habilitada para las dos áreas.')}</h2></div>
      ${st.mover ? listaMover(H) : '<div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" id="prod-mover-ver">Ver las recetas de Bollería</button></div>'}
      ${st.moverMsg ? `<p class="ayuda" role="status">${H.esc(st.moverMsg)}</p>` : ''}
    </section>

    ${t ? `<section class="tarjeta" aria-labelledby="t-prod-control"><h2 id="t-prod-control">Control de totales</h2>${tablaControl(p, t)}</section>` : ''}`;

  pintarCocina(el, H, true);
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
          return `<div class="campo" style="min-width:200px"><label for="${id}">${H.esc(f.etiqueta)}</label><input id="${id}" data-k="${f.k}" inputmode="decimal" value="${v === undefined || v === null ? '' : H.esc(String(v).replace('.', ','))}" placeholder="${f.def !== undefined ? f.def : ''}"><small class="ayuda">${H.esc(f.ayuda)}</small></div>`;
        }).join('')}
      </div>
      <div class="error" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn-sec">Guardar ${P.AREAS[area]}</button></div>
    </form>`;
  };
  return `<section class="tarjeta" aria-labelledby="t-prod-config">
    <h2 id="t-prod-config">Configuración de Producción ${H.info('Configuración de Producción', 'Lo que define cómo calcula Cocina en cada área: amasadora, tandas por día, merma, congeladores, días del pie de masa madre.\nLa cambias tú; las jefas la ven en Cocina sin poder cambiarla. Una configuración que guardas aquí no se pisa al volver a copiar desde la planilla.')}</h2>
    ${bloque('PAN')}${bloque('BOL')}
  </section>`;
}

// ═══════════════ Recetas por aprobar y materias primas pedidas (desde Cocina) ═══════════════
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
  caja.innerHTML = `
    <div class="titulo-fila"><h2 id="t-prod-revision">Desde Cocina ${H.info('Desde Cocina', 'Las jefas de Panadería y Bollería crean y cambian recetas en Cocina. Cada cambio llega aquí como propuesta: la receta vigente sigue igual hasta que la apruebas.\nEl costo lo calcula el script de Producción con los precios de la planilla (neto, sin IVA). Al aprobar, la receta queda en la planilla (costeo, catálogo de caja/B2B y Looker siguen igual) y en la base nueva; la versión anterior queda guardada.\nSi la devuelves, la jefa ve tu comentario y la corrige.')}</h2></div>
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
  const filas = ids.map(id => {
    const a = vIngs.find(i => i.id === id), b = (d.ingredientes || []).find(i => i.id === id), igual = a && b && cant(a) === cant(b);
    return `<tr${igual ? '' : ' class="cambio"'}><td>${H.esc((b || a).nombre)}</td>${v ? `<td>${cant(a)}</td>` : ''}<td>${cant(b)}${!a && v ? ' <span class="chip c-verde">nuevo</span>' : !b ? ' <span class="chip c-rojo">sale</span>' : ''}</td></tr>`;
  }).join('');
  const otros = [];
  const cmp = (t, x, y) => { if (String(x ?? '') !== String(y ?? '')) otros.push(`${t}: ${H.esc(String(x ?? '—'))} → <b>${H.esc(String(y ?? '—'))}</b>`); };
  if (v) {
    cmp('Nombre', v.nombre, d.nombre); cmp('Rinde', `${v.porciones} ${v.unidad}`, `${d.porciones} ${d.unidad}`); cmp('Tipo', v.tipo, d.tipo);
    cmp('Clasificación', v.clasificacion, d.clasificacion); cmp('Peso por unidad', v.pesoUnidad || '', d.pesoUnidad || '');
    if (JSON.stringify(v.pasos || []) !== JSON.stringify(d.pasos || [])) otros.push(`Pasos: ${(v.pasos || []).length} → <b>${(d.pasos || []).length}</b> (cambiaron)`);
    if (JSON.stringify((v.insumos || []).map(i => i.id)) !== JSON.stringify((d.insumos || []).map(i => i.id))) otros.push('Insumos: cambiaron');
  } else otros.push(`Rinde ${H.esc(String(d.porciones))} ${d.unidad === 'g' ? 'g' : 'un'} · ${d.tipo === 'sub_receta' ? 'sub receta' : 'receta'}${d.clasificacion ? ' · ' + H.esc(d.clasificacion) : ''} · ${(d.pasos || []).length} pasos`);
  const costo = !c ? '<p class="ayuda">Calculando el costo con los precios de la planilla…</p>' : c.error ? `<p class="error">${H.esc(c.error)}</p>` : (() => {
    const n = c.propuesta, o = c.vigente, dif = o && o.unidadNeto ? (n.unidadNeto - o.unidadNeto) / o.unidadNeto * 100 : null;
    const avisos = [...(n.faltan || []).map(x => `${x}: no está en MP_maestro`), ...(n.sinPrecio || []).map(x => `${x}: sin precio`)];
    return `<div class="cifras" style="margin:10px 0">
      ${o ? `<div class="tarjeta cifra"><span class="rotulo">Vigente · por ${v.unidad === 'g' ? 'gramo' : 'unidad'}</span><span class="valor">${pesosD(o.unidadNeto)}</span><span class="nota">neto · bruto ${pesosD(o.unidadBruto)}</span></div>` : ''}
      <div class="tarjeta cifra"><span class="rotulo">Propuesta · por ${d.unidad === 'g' ? 'gramo' : 'unidad'}</span><span class="valor">${pesosD(n.unidadNeto)}</span><span class="nota">neto · bruto ${pesosD(n.unidadBruto)}${dif !== null ? ` · <b>${dif >= 0 ? '+' : ''}${(Math.round(dif * 10) / 10).toLocaleString('es-CL')} %</b>` : ''}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Lote completo</span><span class="valor">${pesosN(n.loteNeto)}</span><span class="nota">neto · ${H.esc(String(d.porciones))} ${d.unidad === 'g' ? 'g' : 'un'}</span></div>
    </div>${avisos.length ? `<p class="aviso">${avisos.map(H.esc).join(' · ')}</p>` : ''}`;
  })();
  const ult = [...(p.historial || [])].reverse().find(h => h.comentario);
  return `<div style="border-top:1px solid var(--borde);margin-top:10px;padding-top:10px">
    ${ult ? `<p class="ayuda">Nota de ${H.esc(ult.por || '')}: ${H.esc(ult.comentario)}</p>` : ''}
    <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Ingrediente</th>${v ? '<th scope="col">Vigente</th>' : ''}<th scope="col">Propuesta</th></tr></thead><tbody>${filas}</tbody></table></div>
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

