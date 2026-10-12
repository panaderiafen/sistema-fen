// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos → Base nueva (fen-gastos)  v0.43.0 (etapa G1)
//  Conectar la base nueva, entrar, leer la planilla (2026), copiar y control de totales.
//  Nada cambia en el uso de Gastos: sigue con la planilla hasta el cambio.
//  H = ayudas de app.js: { esc, info, registrar, mensajeError, hace }
// ═══════════════════════════════════════════════
import * as GB from './gastos-base.js?v=0.43.0';
import { COLECCIONES, NOMBRES } from './gastos-modelo.js?v=0.43.0';

const st = { prep: null, ctrl: null, msg: '', copiando: false, leyendo: false, controlando: false };
const $ = id => document.getElementById(id);
const n = v => Math.round(Number(v || 0)).toLocaleString('es-CL');
const pesos = v => { const x = Math.round(Number(v) || 0); return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('es-CL'); };

function error(e, H) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return 'La base nueva no dejó leer o guardar: revisa que estén publicadas las reglas de fen-gastos y que tu cuenta esté en admins (ver README).';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'En fen-gastos no hay una cuenta con tu correo y esa contraseña. Créala en la consola de Firebase → Authentication (ver README).';
  if (/invalid-api-key|api-key-not-valid/.test(c)) return 'La configuración guardada no es válida (apiKey). Vuelve a pegarla.';
  if (/failed-precondition/.test(c)) return 'Firestore todavía no está creado en fen-gastos (consola → Firestore Database → Crear base de datos).';
  return (e && e.message) || H.mensajeError(e);
}
// Partes plegables (como en Producción); lo abierto se recuerda en este equipo
const K_PLIEGUES = 'fen_sf_gastos_pliegues';
const abiertos = (() => { try { const g = localStorage.getItem(K_PLIEGUES); return new Set(g ? JSON.parse(g) : ['conexion', 'copia', 'control']); } catch (e) { return new Set(['conexion', 'copia', 'control']); } })();
const pliegue = (clave, titulo, resumen, cuerpo) => `<details class="pliegue" data-pliegue="${clave}" ${abiertos.has(clave) ? 'open' : ''}>
    <summary><span class="pl-tit">${titulo}</span><span class="pl-res" id="gb-res-${clave}">${resumen || ''}</span></summary>
    <div class="pliegue-cuerpo">${cuerpo}</div></details>`;
function conectarPliegues(el) {
  el.querySelectorAll('details.pliegue').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) abiertos.add(d.dataset.pliegue); else abiertos.delete(d.dataset.pliegue);
    try { localStorage.setItem(K_PLIEGUES, JSON.stringify([...abiertos])); } catch (e) {}
  }));
}

// cab = cabecera de Gastos con sus pestañas (la arma app.js)
export async function pintar(el, cab, H) {
  el.innerHTML = cab + '<section class="tarjeta"><div class="vacio" style="border:0">Conectando con la base nueva…</div></section>';
  let cx, ult = null, errorCx = '';
  try { cx = await GB.conexion(); if (cx.estado === 'ok') ult = await GB.ultimaCopia(); }
  catch (e) { errorCx = error(e, H); cx = { estado: 'error' }; }
  if (!el.isConnected || !/^#gastos\/base/.test(location.hash)) return;
  const ok = cx.estado === 'ok';
  const resCx = ok ? `<span class="chip c-verde">Conectada</span> ${H.esc(cx.cfg.projectId)}` : cx.estado === 'error' ? '<span class="chip c-rojo">Error</span>' : '<span class="chip c-gris">Sin conectar</span>';
  const resCopia = !ok ? '' : st.prep ? (st.prep.porEscribir ? `${n(st.prep.porEscribir)} por copiar` : 'Todo al día') : ult && ult.ultima ? 'Última: ' + H.esc(H.hace(ult.ultima)) : 'Nunca copiada';
  const resCtrl = !ok ? '' : st.ctrl && st.ctrl.resultado ? (st.ctrl.resultado.ok ? '<span class="chip c-verde">Todo cuadra</span>' : '<span class="chip c-rojo">Hay diferencias</span>') : 'Lee la planilla para comparar';
  el.innerHTML = cab + `
    <section class="tarjeta grupo-pliegues" aria-labelledby="t-gb">
      <h2 id="t-gb">Base nueva (fen-gastos) ${H.info('Base nueva de Gastos', 'Es un proyecto de Firebase aparte (fen-gastos), en tu misma cuenta de Google, con su propia cuota gratis.\nEn esta etapa solo se copia la planilla de 2026 a la base nueva y se revisa que cuadre.\nGastos sigue funcionando igual, con la planilla: Registrar, pagar, el SII, la cartola y Previred no cambian. El cambio a la base nueva se hace después, todo de una vez.\nLas fotos y PDF de las boletas siguen en Drive.')}</h2>
      <p class="ayuda">Gastos sigue trabajando con la planilla hasta el cambio. Aquí solo se copia y se compara.</p>
      ${pliegue('conexion', 'Conexión', resCx, `<div id="gb-conexion">${errorCx ? `<p class="error" role="alert">${H.esc(errorCx)}</p>` : seccionConexion(cx, H)}</div>`)}
      ${ok ? pliegue('copia', `Copia desde la planilla (${GB.ANIO})`, resCopia, seccionCopia(H)) : ''}
      ${ok ? pliegue('control', 'Control de totales', resCtrl, seccionControl(H)) : ''}
    </section>`;
  conectarPliegues(el);
  const otra = () => pintar(el, cab, H);
  conectarConexion(el, cx, H, otra);
  if (ok) conectarCopia(el, H, otra);
}

// ── Conexión ──
function seccionConexion(cx, H) {
  if (cx.estado === 'sin_config') {
    const cfg = cx.sugerida;
    return `<p class="ayuda">La configuración de <b>fen-gastos</b> ya viene escrita. Si creaste el proyecto con otro nombre, pega aquí el bloque <code>const firebaseConfig = { … }</code> de la consola (⚙️ Configuración del proyecto → Tus apps).</p>
      <div class="campo"><label for="gb-cfg">Configuración web de fen-gastos</label><textarea id="gb-cfg" rows="8" spellcheck="false" style="font-family:monospace;font-size:13px;padding:12px;border-radius:12px;border:1px solid var(--borde)">${cfg ? H.esc(JSON.stringify(cfg, null, 2)) : ''}</textarea></div>
      <div class="error" id="gb-cfg-err" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="gb-conectar">Conectar</button></div>`;
  }
  if (cx.estado === 'sin_sesion') return `<p class="ayuda">Proyecto <b>${H.esc(cx.cfg.projectId)}</b> · cuenta <b>${H.esc(cx.correo)}</b></p>
      <form id="gb-form-entrar" style="max-width:420px">
        <div class="campo"><label for="gb-clave">Tu contraseña de Sistema Fën</label><input type="password" id="gb-clave" autocomplete="current-password" required></div>
        <div class="error" id="gb-entrar-err" role="alert"></div>
        <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn" id="gb-entrar">Entrar</button><button type="button" class="btn-sec" id="gb-cambiar-cfg">Cambiar configuración</button></div>
      </form>`;
  if (cx.estado === 'sin_admin') return `<p class="ayuda">Entraste a <b>${H.esc(cx.cfg.projectId)}</b> con <b>${H.esc(cx.correo)}</b>, pero esa cuenta no está en <code>admins</code>. Consola de Firebase de fen-gastos → Firestore Database → <b>Iniciar colección</b> <code>admins</code> → ID del documento:</p>
      <div class="aviso" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><code style="font-size:15px;word-break:break-all">${H.esc(cx.uid)}</code></div>
      <p class="ayuda" style="margin-top:8px">Agrega un campo <code>ok</code> (booleano, true) y guarda. Después presiona Revisar.</p>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="gb-revisar">Revisar</button></div>`;
  return `<div class="fila-caja fila-compacta"><div class="txt"><b>Conectada a ${H.esc(cx.cfg.projectId)}</b><span>${H.esc(cx.correo)}</span></div><span class="chip c-verde">Lista</span></div>`;
}
function conectarConexion(el, cx, H, otra) {
  const bc = $('gb-conectar');
  if (bc) bc.addEventListener('click', async () => {
    $('gb-cfg-err').textContent = '';
    let cfg; try { cfg = GB.parsearConfig($('gb-cfg').value); } catch (e) { $('gb-cfg-err').textContent = e.message; return; }
    bc.disabled = true; bc.textContent = 'Conectando…';
    try { await GB.salir(); await GB.guardarConfig(cfg); H.registrar('Conectó la base nueva de Gastos', cfg.projectId); otra(); }
    catch (e) { $('gb-cfg-err').textContent = error(e, H); bc.disabled = false; bc.textContent = 'Conectar'; }
  });
  const cambiar = $('gb-cambiar-cfg');
  if (cambiar) cambiar.addEventListener('click', () => { $('gb-conexion').innerHTML = seccionConexion({ estado: 'sin_config', sugerida: cx.cfg }, H); conectarConexion(el, cx, H, otra); });
  const f = $('gb-form-entrar');
  if (f) f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const b = $('gb-entrar'); $('gb-entrar-err').textContent = ''; b.disabled = true; b.textContent = 'Entrando…';
    try { await GB.entrar($('gb-clave').value); otra(); }
    catch (e) { $('gb-entrar-err').textContent = error(e, H); b.disabled = false; b.textContent = 'Entrar'; }
  });
  const rev = $('gb-revisar');
  if (rev) rev.addEventListener('click', otra);
}

// ── Copia ──
function seccionCopia(H) {
  const p = st.prep;
  return `<p class="ayuda">Gastos, anulados, ítems, obligaciones, vencimientos, SII, Previred y cartola de ${GB.ANIO} ${H.info('Copia desde la planilla', `Lee la planilla de Gastos con el script (v${GB.VERSION_EXPORTAR}) y copia a la base nueva lo de ${GB.ANIO}: gastos (también los anulados, con quién y por qué), vencimientos de ${GB.ANIO} y los que siguen por pagar, cargas y documentos del SII, cotizaciones de Previred y la cartola. Ítems, obligaciones y reglas van completos.\nSe puede repetir las veces que quieras: solo escribe lo que cambió desde la copia anterior y nunca duplica.\nNada se borra. Si algo ya no está en la planilla (por ejemplo, un gasto corregido), en la base nueva queda marcado "quitado de la planilla" y deja de sumar.\nLas fotos y PDF de las boletas siguen en Drive.`)}</p>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="gb-leer" ${st.leyendo || st.copiando ? 'disabled' : ''}>${st.leyendo ? 'Leyendo la planilla…' : `Leer la planilla (${GB.ANIO})`}</button></div>
    <div id="gb-prep">${p ? resumenPrep(p, H) : ''}</div>
    <div id="gb-avance" class="ayuda" aria-live="polite">${H.esc(st.msg)}</div>`;
}
function resumenPrep(p, H) {
  const c = p.cambios;
  const filas = COLECCIONES.map(col => `<tr><td>${H.esc(NOMBRES[col])}</td><td>${n(p.totales.porColeccion[col])}</td><td>${n(c[col].nuevos.length)}</td><td>${n(c[col].cambiados.length)}</td><td>${n(c[col].quitar.length)}</td><td>${n(c[col].iguales)}</td></tr>`).join('');
  const g = p.totales.gastos;
  return `<p class="ayuda" style="margin-top:12px">Gastos de ${p.anio}: <b>${n(g.vigentes)}</b> vigentes y <b>${n(g.anulados)}</b> anulados.</p>
    <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">En la planilla</th><th scope="col">Nuevos</th><th scope="col">Cambiados</th><th scope="col">Quitados</th><th scope="col">Iguales</th></tr></thead><tbody>${filas}</tbody></table></div>
    ${p.avisos.length ? `<details class="aviso" style="margin-top:10px"><summary><b>${n(p.avisos.length)} ${p.avisos.length === 1 ? 'aviso' : 'avisos'} de la planilla</b> · no frenan la copia</summary><ul>${p.avisos.slice(0, 150).map(a => `<li>${H.esc(a.hoja)}${a.fila ? ', fila ' + H.esc(a.fila) : ''}: ${H.esc(a.texto)}</li>`).join('')}${p.avisos.length > 150 ? `<li>… y ${n(p.avisos.length - 150)} más</li>` : ''}</ul></details>` : ''}
    <div class="botones" style="justify-content:flex-start;margin-top:12px">${p.porEscribir
      ? `<button type="button" class="btn" id="gb-copiar" ${st.copiando ? 'disabled' : ''}>Copiar a la base nueva (${n(p.porEscribir)} ${p.porEscribir === 1 ? 'cambio' : 'cambios'})</button>`
      : '<span class="chip c-verde">Todo al día: no hay nada que copiar</span>'}</div>`;
}
function conectarCopia(el, H, otra) {
  const bl = $('gb-leer');
  if (bl) bl.addEventListener('click', async () => {
    st.leyendo = true; st.msg = ''; st.ctrl = null; bl.disabled = true; bl.textContent = 'Leyendo la planilla…';
    try { st.prep = await GB.preparar(t => { const a = $('gb-avance'); if (a) a.textContent = t; }); st.msg = ''; }
    catch (e) { st.prep = null; st.msg = error(e, H); }
    st.leyendo = false;
    // Si ya está todo copiado, el control se hace al tiro
    if (st.prep && !st.prep.porEscribir) await hacerControl(H);
    otra();
  });
  const bc = $('gb-copiar');
  if (bc) bc.addEventListener('click', async () => {
    if (!confirm(`¿Copiar ${n(st.prep.porEscribir)} ${st.prep.porEscribir === 1 ? 'cambio' : 'cambios'} a la base nueva? La planilla no cambia.`)) return;
    st.copiando = true; bc.disabled = true;
    try {
      const r = await GB.copiar(st.prep, (h, t) => { const a = $('gb-avance'); if (a) a.textContent = `Copiando… ${n(h)} de ${n(t)}`; });
      H.registrar('Copió Gastos a la base nueva', `${n(r.escritos)} documentos · ${GB.ANIO}`);
      st.msg = `Listo: ${n(r.escritos)} ${r.escritos === 1 ? 'documento copiado' : 'documentos copiados'}.`;
      // Lo copiado ya está: lo que queda por copiar es nada (si se vuelve a leer, lo confirma)
      const p = st.prep; COLECCIONES.forEach(c => { const x = p.cambios[c]; x.iguales += x.nuevos.length + x.cambiados.length; x.nuevos = []; x.cambiados = []; x.quitar = []; });
      p.porEscribir = 0;
      await hacerControl(H);
    } catch (e) { st.msg = error(e, H) + ' Lo copiado hasta aquí queda; vuelve a leer la planilla y copia lo que falta.'; }
    st.copiando = false; otra();
  });
  const bt = $('gb-control');
  if (bt) bt.addEventListener('click', async () => { bt.disabled = true; bt.textContent = 'Revisando…'; await hacerControl(H); otra(); });
}
async function hacerControl(H) {
  try { st.ctrl = await GB.control(st.prep); st.ctrlErr = ''; } catch (e) { st.ctrl = null; st.ctrlErr = error(e, H); }
}

// ── Control de totales ──
function seccionControl(H) {
  const c = st.ctrl, r = c && c.resultado;
  const boton = `<div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" id="gb-control">Control de totales</button></div>`;
  const ayuda = `<p class="ayuda">Planilla contra base nueva ${H.info('Control de totales', 'Compara lo leído de la planilla con lo que hay en la base nueva: cuántos documentos hay en cada parte y, en los gastos vigentes, cuántos, el monto neto y el monto final de cada mes.\nLo marcado "quitado de la planilla" no cuenta.\nCuesta una lectura por cada gasto de la base nueva (unas pocas miles): úsalo después de copiar.')}</p>`;
  if (st.ctrlErr) return ayuda + `<p class="error" role="alert">${H.esc(st.ctrlErr)}</p>` + boton;
  if (!r) return ayuda + `<p class="ayuda">${st.prep ? 'Presiona "Control de totales" para comparar.' : 'Lee la planilla para comparar.'}</p>` + (st.prep ? boton : '');
  const val = (f, v) => (f.pesos ? pesos(v) : n(v));
  const tabla = filas => `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">Planilla</th><th scope="col">Base nueva</th><th scope="col"><span class="sr">Cuadra</span></th></tr></thead><tbody>
    ${filas.map(f => `<tr><td>${H.esc(f.que)}</td><td>${val(f, f.planilla)}</td><td>${val(f, f.base)}</td><td>${f.ok ? '<span class="chip c-verde">Cuadra</span>' : '<span class="chip c-rojo">No cuadra</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  return ayuda + `<p class="${r.ok ? 'ok-texto' : 'error'}" role="status" id="gb-control-res">${r.ok ? 'Todo cuadra: la base nueva tiene lo mismo que la planilla.' : `Hay ${r.diferencias.length} ${r.diferencias.length === 1 ? 'diferencia' : 'diferencias'}: ${H.esc(r.diferencias.slice(0, 6).map(d => d.que).join(' · '))}${r.diferencias.length > 6 ? '…' : ''}. Si recién copiaste, lee la planilla de nuevo; si siguen, avísame.`}</p>
    <h3 style="margin:12px 0 4px;font-size:15px">Por colección</h3>${tabla(r.filas.filter(f => f.grupo !== 'mes'))}
    <h3 style="margin:12px 0 4px;font-size:15px">Gastos vigentes por mes</h3>${tabla(r.filas.filter(f => f.grupo === 'mes'))}
    ${boton}`;
}
