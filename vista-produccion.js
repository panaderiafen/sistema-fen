// ═══════════════════════════════════════════════
//  Sistema Fën — pantalla Producción  v0.31.0
//  Base nueva de Producción (fen-produccion): conexión, cuentas de las áreas (las tablets
//  de la app Cocina) y copia desde la planilla con control de totales.
//  H = ayudas de app.js: { esc, info, icono, registrar, mensajeError, hace }
// ═══════════════════════════════════════════════
import * as P from './produccion.js?v=0.31.0';

const st = { prep: null, tot: null, copiando: false, msg: '' };
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
  let cuentas = [], personas = [];
  try { [cuentas, st.tot] = await Promise.all([P.cuentas(), P.totales()]); } catch (e) { st.msg = error(e, H); }
  const t = st.tot, p = st.prep, ult = t && t.ultima;
  const porArea = a => cuentas.filter(c => c.area === a);
  el.innerHTML = cab(H) + `
    <section class="tarjeta" aria-labelledby="t-prod-cuentas">
      <div class="titulo-fila"><h2 id="t-prod-cuentas">Cuentas de las áreas ${H.info('Cuentas de las áreas', 'Cada tablet de la cocina se autoriza una vez con la cuenta de su área (la creas en la consola de Firebase de fen-produccion → Authentication). Aquí dices de qué área es cada cuenta: con eso, esa tablet solo ve y cambia lo de su área.\nEl UID está en la consola → Authentication → Usuarios. No es secreto.\nLa contraseña de cada cuenta no pasa por aquí: la escribes tú en la tablet al autorizarla.')}</h2><span>${H.esc(cx.cfg.projectId)}</span></div>
      <div class="lista-simple">${Object.keys(P.AREAS).map(a => `<div class="fila-caja fila-compacta"><div class="txt"><b>${P.AREAS[a]}</b><span>${porArea(a).length ? porArea(a).map(c => H.esc(c.uid)).join(' · ') : 'Sin cuenta asignada'}</span></div>${porArea(a).length ? '<span class="chip c-verde">Lista</span>' : '<span class="chip c-gris">Falta</span>'}</div>`).join('')}</div>
      <form id="prod-cuenta" class="fila-campos" style="margin-top:12px;align-items:flex-end">
        <div class="campo"><label for="prod-cta-area">Área</label><select id="prod-cta-area">${Object.entries(P.AREAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="campo" style="flex:2"><label for="prod-cta-uid">UID de la cuenta del área</label><input id="prod-cta-uid" spellcheck="false" autocomplete="off"></div>
        <button type="submit" class="btn-sec">Asignar</button>
      </form>
      <div class="error" id="prod-cta-err" role="alert"></div>
    </section>

    <section class="tarjeta" aria-labelledby="t-prod-copia">
      <div class="titulo-fila"><h2 id="t-prod-copia">Copia desde la planilla ${H.info('Copia desde la planilla', 'Lee la planilla de Producción con el script (v2.3.0) y copia a la base nueva: recetas, materias primas (sin costos), configuración de masa madre y poolish, planes semanales y quién entra a cada área con su PIN.\nSe puede repetir las veces que quieras. Un plan semanal que ya se cambió en la app Cocina no se pisa: desde que un área usa Cocina, su plan manda ahí.\nNada se borra.')}</h2><span>${ult && ult.ultima ? 'Última: ' + H.esc(H.hace(ult.ultima)) : 'Nunca copiada'}</span></div>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prod-leer">Leer la planilla</button></div>
      <div id="prod-prep">${p ? resumenPrep(p, H) : ''}</div>
      <div id="prod-avance" class="ayuda" aria-live="polite">${H.esc(st.msg)}</div>
    </section>

    ${t ? `<section class="tarjeta" aria-labelledby="t-prod-control"><h2 id="t-prod-control">Control de totales</h2>${tablaControl(p, t)}</section>` : ''}`;

  $('prod-cuenta').addEventListener('submit', async ev => {
    ev.preventDefault(); $('prod-cta-err').textContent = '';
    try { await P.asignarCuenta($('prod-cta-uid').value, $('prod-cta-area').value); H.registrar('Asignó una cuenta de área (Producción)', `${P.AREAS[$('prod-cta-area').value]} · ${$('prod-cta-uid').value.trim()}`); pintarBase(el, H, cx); }
    catch (e) { $('prod-cta-err').textContent = error(e, H); }
  });
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
