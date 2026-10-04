// ═══════════════════════════════════════════════
//  Sistema Fën — app  v0.1.1
//  Etapa 1: entrada por equipo, Seguridad, Hoy (por ahora con la caja) y menú.
// ═══════════════════════════════════════════════
import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp
} from './firebase.js?v=0.1.1';

const F = window.FEN_SIS;
const $ = id => document.getElementById(id);
// Claves en este navegador (empiezan con fen_sistema: "Sincronizar" de Producción las respeta)
const K_EQUIPO = 'fen_sistema_equipo';
const K_MOTIVO = 'fen_sistema_motivo';

const estado = { user: null, equipoId: null, equipo: null, desuscribir: null, entrando: false, duracion: F.DURACION_SUGERIDA };

// ── Utilidades ─────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pesos = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CL'); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const aFecha = t => (t && typeof t.toDate === 'function') ? t.toDate() : (t instanceof Date ? t : null);
const fechaCorta = t => { const d = aFecha(t); return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—'; };
function hace(t) {
  const d = aFecha(t); if (!d) return '—';
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return fechaCorta(d);
}
const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diaTexto = txt => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt || ''); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : (txt || ''); };
const SUCURSALES = { barros_arana: 'Barros Arana', ainavillo: 'Ainavillo' };
const sucursal = s => SUCURSALES[s] || s || '';
const nombreDuracion = id => (F.DURACIONES.find(d => d.id === id) || {}).nombre || id;
const URL_CAJA = (F.APPS.find(a => a.id === 'caja') || {}).url || '#';

function calcularVence(dur, fechaTxt, desde = new Date()) {
  const d = new Date(desde.getTime());
  if (dur === 'sesion') return new Date(d.getTime() + 12 * 3600e3);
  if (dur === '30d') { d.setDate(d.getDate() + 30); return d; }
  if (dur === '4m') { d.setMonth(d.getMonth() + 4); return d; }
  if (dur === '1a') { d.setFullYear(d.getFullYear() + 1); return d; }
  if (dur === 'fecha') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaTxt || '');
    if (!m) return null;
    const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
    return f > desde ? f : null;
  }
  return null;
}
function tipoEquipo() {
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'celular';
  return 'computador';
}
function mensajeError(e) {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Correo o contraseña incorrectos.';
  if (/too-many-requests/.test(c)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (/network-request-failed|unavailable/.test(c)) return 'Sin conexión. Revisa internet y vuelve a probar.';
  if (/permission-denied/.test(c)) return 'Firestore no dejó guardar: falta publicar las reglas v1.2.0 (ver README).';
  return 'No se pudo completar: ' + (c || (e && e.message) || 'error desconocido');
}

// Este equipo: su ID se guarda aquí; con "Solo esta vez", solo mientras el navegador esté abierto.
const leerEquipoId = () => { try { return localStorage.getItem(K_EQUIPO) || sessionStorage.getItem(K_EQUIPO); } catch (e) { return null; } };
function guardarEquipoId(id, soloSesion) {
  try { localStorage.removeItem(K_EQUIPO); sessionStorage.removeItem(K_EQUIPO); (soloSesion ? sessionStorage : localStorage).setItem(K_EQUIPO, id); } catch (e) {}
}
const olvidarEquipo = () => { try { localStorage.removeItem(K_EQUIPO); sessionStorage.removeItem(K_EQUIPO); } catch (e) {} };
const ponerMotivo = m => { try { m ? sessionStorage.setItem(K_MOTIVO, m) : sessionStorage.removeItem(K_MOTIVO); } catch (e) {} };
const sacarMotivo = () => { try { const m = sessionStorage.getItem(K_MOTIVO); sessionStorage.removeItem(K_MOTIVO); return m; } catch (e) { return null; } };

// Deja registro en "historial" (si falla, no detiene nada).
function registrar(accion, detalle) {
  return addDoc(collection(db, 'historial'), {
    accion, detalle: detalle || '', por: (auth.currentUser && auth.currentUser.email) || '',
    equipo: (estado.equipo && estado.equipo.nombre) || '', en: serverTimestamp()
  }).catch(() => {});
}

// ── Íconos lineales ────────────────────────────────
const P = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  seguridad: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  camion: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  boleta: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  libro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  pantalla: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/>',
  personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  fuera: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  cajon: '<path d="M4 7h16v12H4z"/><path d="M8 7V5h8v2M4 12h16"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  anular: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  computador: '<rect x="3" y="5" width="18" height="11" rx="2"/><path d="M2 20h20"/>',
  celular: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>'
};
const icono = (n, t = 20) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ── Pantallas ──────────────────────────────────────
function mostrar(id) { ['cargando', 'entrada', 'sin-acceso', 'app'].forEach(x => $(x).classList.toggle('oculto', x !== id)); }

function pintarDuraciones() {
  $('duraciones').innerHTML = F.DURACIONES.map(d =>
    `<button type="button" class="pastilla" data-dur="${d.id}" aria-pressed="${d.id === estado.duracion}">${esc(d.nombre)}</button>`).join('');
  $('duraciones').querySelectorAll('button').forEach(b => {
    b.onclick = () => { estado.duracion = b.dataset.dur; pintarDuraciones(); };
  });
  $('campo-fecha').classList.toggle('oculto', estado.duracion !== 'fecha');
}

function mostrarEntrada(aviso) {
  mostrar('entrada');
  const a = $('aviso-entrada');
  a.textContent = aviso || '';
  a.classList.toggle('oculto', !aviso);
  if (auth.currentUser && auth.currentUser.email && !$('correo').value) $('correo').value = auth.currentUser.email;
  $('error-entrada').textContent = '';
  $('btn-entrar').disabled = false;
  pintarDuraciones();
}

async function esAdmin(user) {
  try { return (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch (e) { return false; }
}

// ── Entrar: valida la cuenta y autoriza este equipo ─
$('form-entrar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const correo = $('correo').value.trim(), clave = $('clave').value, nombre = $('nombre-equipo').value.trim();
  const err = $('error-entrada'), btn = $('btn-entrar');
  if (!correo || !clave) { err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
  if (!nombre) { err.textContent = 'Ponle un nombre a este equipo.'; return; }
  const vence = calcularVence(estado.duracion, $('fecha-hasta').value);
  if (!vence) { err.textContent = 'Elige una fecha que todavía no haya pasado.'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
  estado.entrando = true;
  try {
    await setPersistence(auth, estado.duracion === 'sesion' ? browserSessionPersistence : browserLocalPersistence);
    let user = auth.currentUser;
    if (user && (user.email || '').toLowerCase() === correo.toLowerCase()) {
      // Ya había sesión de Sistema Fën con esta cuenta, pero sin equipo autorizado: se confirma la contraseña igual.
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(correo, clave));
    } else {
      user = (await signInWithEmailAndPassword(auth, correo, clave)).user;
    }
    if (!(await esAdmin(user))) {
      await signOut(auth);
      estado.entrando = false;
      err.textContent = 'Esta cuenta no es de administración.';
      return;
    }
    const ref = await addDoc(collection(db, 'equipos'), {
      nombre, tipo: tipoEquipo(), uid: user.uid, correo: user.email,
      duracion: estado.duracion, venceEn: Timestamp.fromDate(vence), estado: 'vigente',
      autorizadoEn: serverTimestamp(), ultimaVez: serverTimestamp(), creadoPor: user.email
    });
    guardarEquipoId(ref.id, estado.duracion === 'sesion');
    $('clave').value = '';
    estado.equipo = { nombre };
    registrar('Autorizó un equipo', `${nombre} · ${nombreDuracion(estado.duracion)}`);
    estado.entrando = false;
    await abrirApp(user);
  } catch (e) {
    estado.entrando = false;
    err.textContent = mensajeError(e);
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});

$('btn-otra-cuenta').addEventListener('click', async () => { olvidarEquipo(); await signOut(auth); });

// ── Abrir: revisa que este equipo siga autorizado ───
function revisarEquipo(snap, user) {
  if (!snap.exists()) return 'Este equipo ya no está autorizado. Vuelve a entrar.';
  const e = snap.data();
  if (e.uid !== user.uid) return 'Este equipo estaba autorizado para otra cuenta. Vuelve a entrar.';
  if (e.estado === 'revocado') return 'Se revocó el acceso de este equipo.';
  const v = aFecha(e.venceEn);
  if (v && v.getTime() < Date.now()) return 'Terminó el tiempo que se recordaba este equipo. Vuelve a entrar.';
  return null;
}
function cerrarEscucha() {
  if (estado.desuscribir) { try { estado.desuscribir(); } catch (e) {} estado.desuscribir = null; }
  if (estado.reloj) { clearInterval(estado.reloj); estado.reloj = null; }
}
// Revisa de nuevo este equipo (vencimiento con la app abierta, o si la escucha se cayó).
async function revisarAhora() {
  if (!estado.user || !estado.equipoId) return;
  try {
    const s = await getDoc(doc(db, 'equipos', estado.equipoId));
    const m = revisarEquipo(s, estado.user);
    if (m) bloquear(m);
  } catch (e) { /* sin conexión: se intenta de nuevo en la próxima revisión */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarAhora(); });
async function bloquear(motivo) {
  cerrarEscucha(); olvidarEquipo(); ponerMotivo(motivo);
  estado.user = null; estado.equipo = null; estado.equipoId = null;
  try { await signOut(auth); } catch (e) { mostrarEntrada(motivo); }
}

async function abrirApp(user) {
  if (!(await esAdmin(user))) { $('correo-sin-acceso').textContent = user.email || '(sin correo)'; mostrar('sin-acceso'); return; }
  const id = leerEquipoId();
  if (!id) { mostrarEntrada('Este equipo todavía no está autorizado para Sistema Fën. Confirma tu contraseña y ponle un nombre.'); return; }
  let snap;
  try { snap = await getDoc(doc(db, 'equipos', id)); } catch (e) { mostrarEntrada(mensajeError(e)); return; }
  const motivo = revisarEquipo(snap, user);
  if (motivo) { await bloquear(motivo); return; }
  estado.user = user; estado.equipoId = id; estado.equipo = { id, ...snap.data() };
  cerrarEscucha();
  // Si se revoca desde otro equipo mientras este está abierto, se cierra al tiro.
  estado.desuscribir = onSnapshot(doc(db, 'equipos', id), s => {
    const m = revisarEquipo(s, user);
    if (m) bloquear(m); else estado.equipo = { id, ...s.data() };
  }, () => { /* si la escucha se cae, la revisión cada 5 minutos sigue cuidando */ });
  estado.reloj = setInterval(revisarAhora, 5 * 60e3);
  const ultima = aFecha(estado.equipo.ultimaVez);
  if (!ultima || Date.now() - ultima.getTime() > 6 * 3600e3) updateDoc(doc(db, 'equipos', id), { ultimaVez: serverTimestamp() }).catch(() => {});
  pintarMenus();
  mostrar('app');
  irA(vistaDesdeHash());
}

onAuthStateChanged(auth, async user => {
  if (estado.entrando) return;
  if (!user) { cerrarEscucha(); mostrarEntrada(sacarMotivo()); return; }
  await abrirApp(user);
});

// ── Navegación ─────────────────────────────────────
const VISTAS = ['hoy', 'seguridad', 'menu'];
const vistaDesdeHash = () => { const v = (location.hash || '').replace('#', ''); return VISTAS.includes(v) ? v : 'hoy'; };
window.addEventListener('hashchange', () => { if (estado.user) irA(vistaDesdeHash()); });

function pintarMenus() {
  const u = estado.user, eq = estado.equipo || {};
  const inicial = esc(((u && u.email) || '?').charAt(0).toUpperCase());
  const apps = F.APPS.map(a =>
    `<a class="nav-item" href="${esc(a.url)}" target="_blank" rel="noopener">${icono(a.icono)}<span>${esc(a.nombre)}</span><span class="fuera">${icono('fuera', 14)}</span><span class="sr">(se abre en otra pestaña)</span></a>`).join('');
  $('menu-lateral').innerHTML = `
    <div class="marca"><b>fën</b><span>Sistema</span></div>
    <a class="nav-item" href="#hoy" data-vista="hoy">${icono('hoy')}Hoy</a>
    <a class="nav-item" href="#seguridad" data-vista="seguridad">${icono('seguridad')}Seguridad</a>
    <div class="grupo">Abren la app actual</div>
    ${apps}
    <div class="yo"><div class="avatar" aria-hidden="true">${inicial}</div>
      <div class="quien">${esc(u.email)}<small>${esc(eq.nombre || '')} · v${F.VERSION}</small></div></div>`;
  $('barra').innerHTML = `
    <a href="#hoy" data-vista="hoy">${icono('hoy', 22)}Hoy</a>
    <a href="#seguridad" data-vista="seguridad">${icono('seguridad', 22)}Seguridad</a>
    <a href="#menu" data-vista="menu">${icono('menu', 22)}Menú</a>`;
}

function irA(v) {
  VISTAS.forEach(x => $('v-' + x).classList.toggle('oculto', x !== v));
  document.querySelectorAll('[data-vista]').forEach(a => {
    if (a.dataset.vista === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (v === 'hoy') pintarHoy();
  if (v === 'seguridad') pintarSeguridad();
  if (v === 'menu') pintarMenuCelular();
  window.scrollTo(0, 0);
}

// ── Hoy ────────────────────────────────────────────
// v0.1: lee de la caja (mismo proyecto de Firebase). Gastos, B2B y Producción se conectan en la v0.2.
function itemPendiente(p) {
  return `<a class="pendiente" href="${esc(p.url)}" target="_blank" rel="noopener">
    <div class="icono-caja c-${p.color}">${icono(p.icono)}</div>
    <div class="txt"><b>${esc(p.titulo)}</b><span>${esc(p.detalle)}</span></div>
    <span class="chip c-${p.color}">${esc(p.chip)}</span></a>`;
}

async function pintarHoy() {
  const ahora = new Date();
  const hoy = diaLocal(ahora), ayer = diaLocal(new Date(ahora.getTime() - 864e5));
  const fechaLarga = `${DIAS[ahora.getDay()]} ${ahora.getDate()} de ${MESES_LARGOS[ahora.getMonth()]}`;
  const el = $('v-hoy');
  el.innerHTML = `
    <div class="cabecera"><div><h1 id="t-hoy">Hoy</h1><p id="hoy-sub">${fechaLarga} · revisando…</p></div></div>
    <div class="cifras">
      <div class="tarjeta cifra"><span class="rotulo">Ventas de ayer en caja</span><span class="valor" id="c-ventas">…</span><span class="nota" id="c-ventas-n">Bruto, con IVA</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Cajas abiertas ahora</span><span class="valor" id="c-abiertas">…</span><span class="nota">Abiertas hoy</span></div>
    </div>
    <div class="columnas">
      <section class="tarjeta col-ancha" aria-labelledby="t-pend">
        <div class="titulo-fila"><h2 id="t-pend">Pendientes</h2><span>Lo más urgente primero</span></div>
        <div id="lista-pend"><div class="vacio">Revisando…</div></div>
      </section>
      <div class="col-angosta">
        <section class="tarjeta" aria-labelledby="t-fuentes">
          <div class="titulo-fila"><h2 id="t-fuentes">De dónde lee Hoy</h2><span id="hoy-hora"></span></div>
          <div id="fuentes"></div>
          <p class="nota-i">(i) Hoy solo lee: no cambia nada en las apps. Si una no responde, sus pendientes no aparecen hasta que vuelva.</p>
        </section>
      </div>
    </div>`;

  const q = (col, ...w) => getDocs(query(collection(db, col), ...w));
  const r = await Promise.allSettled([
    q('evaluacion_caja', where('fecha', 'in', [ayer, hoy])),
    q('cajas', where('estado', '==', 'abierta')),
    q('cajas', where('exportPendiente', '==', true)),
    q('solicitudes_anulacion', where('estado', '==', 'pendiente')),
    q('resumenes_caja', where('fecha', '==', ayer))
  ]);
  if (!$('lista-pend')) return; // se cambió de vista mientras cargaba
  const docs = i => (r[i].status === 'fulfilled' ? r[i].value.docs.map(d => ({ id: d.id, ...d.data() })) : []);
  const cajaOk = r.every(x => x.status === 'fulfilled');
  const pend = [];

  docs(0).filter(e => Math.abs(Number(e.difTotal) || 0) > 0).forEach(e => pend.push({
    orden: 0, color: 'rojo', icono: 'alerta', chip: 'Atención', url: URL_CAJA, titulo: 'Descuadre de caja',
    detalle: `${sucursal(e.sucursal)} · ${diaTexto(e.fecha)} · diferencia ${pesos(e.difTotal)}`
  }));
  const abiertas = docs(1);
  abiertas.filter(c => (c.fecha || '') < hoy).forEach(c => pend.push({
    orden: 1, color: 'amarillo', icono: 'reloj', chip: 'Cerrar', url: URL_CAJA, titulo: 'Caja anterior sin cerrar',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · ${c.usuario || ''}`
  }));
  docs(2).filter(c => c.estado === 'cerrada').forEach(c => pend.push({
    orden: 2, color: 'amarillo', icono: 'cajon', chip: 'Reenviar', url: URL_CAJA, titulo: 'Cierre sin pasar a planilla',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · en Eval. caja`
  }));
  docs(3).forEach(s => pend.push({
    orden: 3, color: 'lila', icono: 'anular', chip: 'Revisar', url: URL_CAJA, titulo: 'Anulación por aprobar',
    detalle: `${sucursal(s.sucursal)} · ${pesos(s.total)} · pide ${s.solicitadoPor || ''}`
  }));
  pend.sort((a, b) => a.orden - b.orden);

  $('lista-pend').innerHTML = pend.length ? pend.map(itemPendiente).join('')
    : `<div class="vacio">${cajaOk ? 'Nada pendiente en la caja.' : 'No se pudo leer la caja. Revisa internet y vuelve a abrir Hoy.'}</div>`;
  $('hoy-sub').textContent = `${fechaLarga} · ${pend.length} ${pend.length === 1 ? 'pendiente' : 'pendientes'}`;

  const resumenes = docs(4);
  $('c-ventas').textContent = r[4].status === 'fulfilled' ? pesos(resumenes.reduce((a, x) => a + (Number(x.totalBruto) || 0), 0)) : '—';
  $('c-ventas-n').textContent = `${resumenes.length} ${resumenes.length === 1 ? 'cierre' : 'cierres'} · bruto, con IVA`;
  $('c-abiertas').textContent = r[1].status === 'fulfilled' ? String(abiertas.filter(c => c.fecha === hoy).length) : '—';

  const fila = (nombre, chip, color) => `<div class="fuente"><span>${esc(nombre)}</span><span class="chip c-${color}">${esc(chip)}</span></div>`;
  $('fuentes').innerHTML = fila('Caja', cajaOk ? 'Al día' : 'Sin respuesta', cajaOk ? 'verde' : 'amarillo')
    + ['Gastos', 'Ventas B2B', 'Producción'].map(n => fila(n, 'Llega en la v0.2', 'gris')).join('');
  $('hoy-hora').textContent = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}

// ── Seguridad ──────────────────────────────────────
function opcionesDuracion(sel) {
  return F.DURACIONES.map(d => `<option value="${d.id}"${d.id === sel ? ' selected' : ''}>${esc(d.nombre)}</option>`).join('');
}

async function pintarSeguridad() {
  const el = $('v-seguridad');
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-seguridad">Seguridad</h1><p>Qué equipos entran a Sistema Fën y por cuánto tiempo</p></div></div>
    <div class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></div>`;
  const [rEq, rHist] = await Promise.allSettled([
    getDocs(collection(db, 'equipos')),
    getDocs(query(collection(db, 'historial'), orderBy('en', 'desc'), limit(15)))
  ]);
  if (rEq.status !== 'fulfilled') {
    el.querySelector('.tarjeta').innerHTML = `<div class="error">${esc(mensajeError(rEq.reason))}</div>`;
    return;
  }
  const ahora = Date.now();
  const todos = rEq.value.docs.map(d => ({ id: d.id, ...d.data() }));
  const vigente = e => e.estado !== 'revocado' && (!aFecha(e.venceEn) || aFecha(e.venceEn).getTime() > ahora);
  const vigentes = todos.filter(vigente).sort((a, b) => (a.id === estado.equipoId ? -1 : b.id === estado.equipoId ? 1 : (aFecha(b.ultimaVez) || 0) - (aFecha(a.ultimaVez) || 0)));
  const anteriores = todos.filter(e => !vigente(e)).sort((a, b) => (aFecha(b.revocadoEn || b.venceEn) || 0) - (aFecha(a.revocadoEn || a.venceEn) || 0));
  const hist = rHist.status === 'fulfilled' ? rHist.value.docs.map(d => d.data()) : [];

  const nombreEq = e => `<div class="equipo${e.id === estado.equipoId ? ' este' : ''}"><div class="icono-caja">${icono(e.tipo === 'celular' || e.tipo === 'tablet' ? e.tipo : 'computador', 18)}</div>
    <div><b>${esc(e.nombre)}</b><small>${e.id === estado.equipoId ? 'Este equipo' : 'Visto ' + hace(e.ultimaVez)}</small></div></div>`;
  const boton = e => e.id === estado.equipoId
    ? `<button type="button" class="btn-sec" data-salir="${e.id}">Salir</button>`
    : `<button type="button" class="btn-sec btn-peligro" data-revocar="${e.id}">Revocar</button>`;

  el.innerHTML = `
    <div class="cabecera"><div><h1 id="t-seguridad">Seguridad</h1><p>Qué equipos entran a Sistema Fën y por cuánto tiempo</p></div></div>
    <section class="tarjeta" aria-labelledby="t-equipos">
        <div class="titulo-fila"><h2 id="t-equipos">Equipos autorizados</h2><span>${vigentes.length} ${vigentes.length === 1 ? 'equipo' : 'equipos'}</span></div>
        <div class="tabla-caja"><table>
          <thead><tr><th scope="col">Equipo</th><th scope="col">Cuenta</th><th scope="col">Vence</th><th scope="col">Recordar por</th><th scope="col"><span class="sr">Acción</span></th></tr></thead>
          <tbody>${vigentes.map(e => `<tr>
            <td>${nombreEq(e)}</td><td>${esc(e.correo || '')}</td><td>${fechaCorta(e.venceEn)}</td>
            <td><select data-duracion="${e.id}" aria-label="Recordar ${esc(e.nombre)} por">${opcionesDuracion(e.duracion)}</select></td>
            <td style="text-align:right">${boton(e)}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="lista-equipos-cel">${vigentes.map(e => `<div class="equipo-cel">
          <div class="fila">${nombreEq(e)}${boton(e)}</div>
          <div class="fila"><span class="ayuda">Vence ${fechaCorta(e.venceEn)}</span>
            <select data-duracion="${e.id}" aria-label="Recordar ${esc(e.nombre)} por" style="min-height:40px;border-radius:10px;border:1px solid var(--borde);background:#fff;padding:0 8px">${opcionesDuracion(e.duracion)}</select></div>
        </div>`).join('')}</div>
        ${anteriores.length ? `<details style="margin-top:12px"><summary class="ayuda" style="cursor:pointer;min-height:32px">Equipos anteriores (${anteriores.length})</summary>
          <div class="actividad">${anteriores.map(e => `<div><span>${esc(e.nombre)} · ${e.estado === 'revocado' ? 'revocado ' + fechaCorta(e.revocadoEn) : 'venció ' + fechaCorta(e.venceEn)}</span><small>${esc(e.correo || '')}</small></div>`).join('')}</div></details>` : ''}
        <p class="nota-i">(i) Revocar cierra Sistema Fën en ese equipo: al instante si está abierto, o la próxima vez que se abra. No toca la caja. Si perdiste un equipo, revócalo y además cambia tu contraseña: al cambiarla, Firebase cierra tu cuenta en todos los equipos (también en la caja) en menos de una hora.</p>
      </section>
    <div class="columnas">
        <section class="tarjeta col-angosta" style="display:block" aria-labelledby="t-clave">
          <h2 id="t-clave">Tu contraseña</h2>
          <p class="ayuda" style="margin:8px 0 12px">Te llega un correo para cambiarla.</p>
          <button type="button" class="btn-sec" id="btn-clave">Enviarme el correo</button>
          <div class="ayuda" id="msg-clave" role="status" style="margin-top:8px"></div>
        </section>
        <section class="tarjeta col-ancha" aria-labelledby="t-act">
          <h2 id="t-act">Actividad reciente</h2>
          <div class="actividad" style="margin-top:8px">${hist.length ? hist.map(h => `<div><span>${esc(h.accion)}${h.detalle ? ' · ' + esc(h.detalle) : ''}</span><small>${esc(h.equipo || '')} · ${hace(h.en)}</small></div>`).join('') : '<div><small>Sin actividad todavía.</small></div>'}</div>
        </section>
    </div>`;

  const porId = id => todos.find(x => x.id === id);
  el.querySelectorAll('select[data-duracion]').forEach(s => s.addEventListener('change', async () => {
    const e = porId(s.dataset.duracion);
    let fechaTxt = '';
    if (s.value === 'fecha') fechaTxt = (window.prompt('¿Hasta qué fecha? (AAAA-MM-DD)', '') || '').trim();
    const vence = calcularVence(s.value, fechaTxt);
    if (!vence) { alert('Esa fecha no sirve: tiene que ser futura y con el formato AAAA-MM-DD.'); s.value = e.duracion; return; }
    s.disabled = true;
    try {
      await updateDoc(doc(db, 'equipos', e.id), { duracion: s.value, venceEn: Timestamp.fromDate(vence), actualizadoPor: estado.user.email, actualizadoEn: serverTimestamp() });
      registrar('Cambió la duración', `${e.nombre} · ${nombreDuracion(s.value)} · vence ${fechaCorta(vence)}`);
      pintarSeguridad();
    } catch (er) { alert(mensajeError(er)); s.value = e.duracion; s.disabled = false; }
  }));
  const revocar = async (id, propio) => {
    const e = porId(id);
    const ok = propio ? window.confirm('¿Salir de Sistema Fën en este equipo? Para volver a entrar tendrás que autorizarlo de nuevo.')
      : window.confirm(`¿Revocar "${e.nombre}"? Sistema Fën se cierra en ese equipo.`);
    if (!ok) return;
    try {
      await registrar(propio ? 'Salió de este equipo' : 'Revocó un equipo', e.nombre);
      if (propio) cerrarEscucha(); // si no, la escucha cierra antes y con otro mensaje
      await updateDoc(doc(db, 'equipos', id), { estado: 'revocado', revocadoEn: serverTimestamp(), revocadoPor: estado.user.email });
      if (propio) await bloquear('Saliste de Sistema Fën en este equipo.'); else pintarSeguridad();
    } catch (er) { alert(mensajeError(er)); if (propio && estado.user) abrirApp(estado.user); }
  };
  el.querySelectorAll('[data-revocar]').forEach(b => b.addEventListener('click', () => revocar(b.dataset.revocar, false)));
  el.querySelectorAll('[data-salir]').forEach(b => b.addEventListener('click', () => revocar(b.dataset.salir, true)));
  $('btn-clave').addEventListener('click', async () => {
    try { await sendPasswordResetEmail(auth, estado.user.email); $('msg-clave').textContent = `Listo: revisa ${estado.user.email}.`; }
    catch (er) { $('msg-clave').textContent = mensajeError(er); }
  });
}

// ── Menú (celular) ─────────────────────────────────
function pintarMenuCelular() {
  const u = estado.user, eq = estado.equipo || {};
  $('v-menu').innerHTML = `
    <div class="cabecera"><div><h1 id="t-menu">Menú</h1></div></div>
    <section class="tarjeta" aria-label="En Sistema Fën">
      <div class="grupo" style="padding:0 0 4px">En Sistema Fën</div>
      <a class="nav-item" href="#hoy">${icono('hoy')}Hoy</a>
      <a class="nav-item" href="#seguridad">${icono('seguridad')}Seguridad</a>
    </section>
    <section class="tarjeta" aria-label="Apps actuales">
      <div class="grupo" style="padding:0 0 4px">Abren la app actual</div>
      ${F.APPS.map(a => `<a class="nav-item" href="${esc(a.url)}" target="_blank" rel="noopener">${icono(a.icono)}<span>${esc(a.nombre)}</span><span class="fuera">${icono('fuera', 16)}</span></a>`).join('')}
    </section>
    <p class="nota-i">(i) Cada etapa trae un módulo a Sistema Fën y saca su app de esta lista.</p>
    <div class="tarjeta yo" style="border-top:1px solid var(--linea)"><div class="avatar" aria-hidden="true">${esc((u.email || '?').charAt(0).toUpperCase())}</div>
      <div class="quien" style="flex:1">${esc(u.email)}<small>${esc(eq.nombre || '')} · hasta ${fechaCorta(eq.venceEn)} · v${F.VERSION}</small></div></div>`;
}
