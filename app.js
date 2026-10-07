// ═══════════════════════════════════════════════
//  Sistema Fën — app  v0.12.0
//  Etapa 1: entrada por equipo, Seguridad, Hoy, menú y la administración de la caja
//  (cierres y anulaciones).
// ═══════════════════════════════════════════════
import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp
} from './firebase.js?v=0.14.2';
import * as Caja from './caja.js?v=0.14.2';
import * as Stock from './stock.js?v=0.14.2';
import * as Ajustes from './ajustes.js?v=0.14.2';
import * as Apps from './apps.js?v=0.14.2';
import * as Agenda from './agenda.js?v=0.14.2';
import * as Gastos from './gastos.js?v=0.14.2';
import * as Sii from './sii.js?v=0.14.2';
import * as Previred from './previred.js?v=0.14.2';
import * as B2b from './b2b.js?v=0.14.2';
import * as PdfOrden from './pdf-orden.js?v=0.14.2';
import { usoEstimado, NOMBRES as NOMBRES_B2B, COLECCIONES as COLS_B2B } from './b2b-modelo.js?v=0.14.2';

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
  flecha: '<path d="M9 6l6 6-6 6"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  arriba: '<path d="M6 15l6-6 6 6"/>', izq: '<path d="M15 6l-6 6 6 6"/>', mas: '<path d="M12 5v14M5 12h14"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', abajo: '<path d="M6 9l6 6 6-6"/>'
};
const icono = (n, t = 20) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ── Botón (i): explicación corta al tocarlo ────────
// info('Título', 'texto') → botón redondo con una i. Al tocarlo abre un globo con la explicación.
// Se cierra tocando fuera, con Esc o tocando la (i) de nuevo. Funciona igual en celular.
const INFOS = [];
function info(titulo, texto) {
  let i = INFOS.findIndex(x => x.titulo === titulo && x.texto === texto);
  if (i < 0) { INFOS.push({ titulo, texto }); i = INFOS.length - 1; }
  return `<button type="button" class="btn-info" data-info="${i}" aria-label="Qué es: ${esc(titulo)}" aria-expanded="false"></button>`;
}
let globoAbierto = null;
function cerrarGlobo() {
  if (!globoAbierto) return;
  globoAbierto.btn.setAttribute('aria-expanded', 'false');
  globoAbierto.el.remove(); globoAbierto = null;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.btn-info');
  if (!b) { if (globoAbierto && !e.target.closest('.globo-info')) cerrarGlobo(); return; }
  e.preventDefault(); e.stopPropagation();
  const mismo = globoAbierto && globoAbierto.btn === b;
  cerrarGlobo();
  if (mismo) return;
  const d = INFOS[+b.dataset.info] || { titulo: '', texto: '' };
  const g = document.createElement('div');
  g.className = 'globo-info'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', d.titulo);
  g.innerHTML = `<b>${esc(d.titulo)}</b>${String(d.texto).split('\n').map(p => `<p>${esc(p)}</p>`).join('')}`;
  document.body.appendChild(g);
  const r = b.getBoundingClientRect(), ancho = Math.min(320, window.innerWidth - 32);
  g.style.width = ancho + 'px';
  g.style.left = Math.max(16, Math.min(r.left + r.width / 2 - ancho / 2, window.innerWidth - ancho - 16)) + 'px';
  const abajo = r.bottom + 8 + g.offsetHeight < window.innerHeight;
  g.style.top = (abajo ? r.bottom + 8 : Math.max(8, r.top - 8 - g.offsetHeight)) + 'px';
  b.setAttribute('aria-expanded', 'true');
  globoAbierto = { btn: b, el: g, y: window.scrollY };
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && globoAbierto) { const b = globoAbierto.btn; cerrarGlobo(); b.focus(); } });
// Al desplazar la página el globo se cierra (si se movió más que un poco: tocar la (i) puede mover la página unos píxeles)
window.addEventListener('scroll', () => { if (globoAbierto && Math.abs(window.scrollY - globoAbierto.y) > 40) cerrarGlobo(); }, { passive: true });
window.addEventListener('hashchange', cerrarGlobo);

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
    // Base nueva de B2B (si ya está conectada): misma cuenta y contraseña, se entra de una vez
    B2b.leerConfig().then(cfg => cfg && B2b.entrar(clave, estado.duracion === 'sesion')).catch(() => {});
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

$('btn-otra-cuenta').addEventListener('click', async () => { olvidarEquipo(); await B2b.salir(); await signOut(auth); });

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
  await B2b.salir();
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
const VISTAS = ['hoy', 'agenda', 'gastos', 'b2b', 'caja', 'ajustes', 'seguridad', 'menu'];
// #caja = cierres, #caja/anulaciones = anulaciones
const vistaDesdeHash = () => { const v = (location.hash || '').replace('#', '').split('/')[0]; return VISTAS.includes(v) ? v : 'hoy'; };
const subVista = () => (location.hash || '').split('/')[1] || '';
window.addEventListener('hashchange', () => { if (estado.user) irA(vistaDesdeHash()); });

function pintarMenus() {
  const u = estado.user, eq = estado.equipo || {};
  const inicial = esc(((u && u.email) || '?').charAt(0).toUpperCase());
  const apps = F.APPS.map(a =>
    `<a class="nav-item" href="${esc(a.url)}" target="_blank" rel="noopener">${icono(a.icono)}<span>${esc(a.nombre)}</span><span class="fuera">${icono('fuera', 14)}</span><span class="sr">(se abre en otra pestaña)</span></a>`).join('');
  $('menu-lateral').innerHTML = `
    <div class="marca"><img class="logo" src="logo-fen.png?v=0.14.2" alt="Fën"><span>Sistema de administración</span></div>
    <a class="nav-item" href="#hoy" data-vista="hoy">${icono('hoy')}Hoy</a>
    <a class="nav-item" href="#agenda" data-vista="agenda">${icono('calendario')}Agenda</a>
    <a class="nav-item" href="#gastos" data-vista="gastos">${icono('boleta')}Gastos</a>
    <a class="nav-item" href="#b2b" data-vista="b2b">${icono('camion')}Ventas B2B</a>
    <a class="nav-item" href="#caja" data-vista="caja">${icono('cajon')}Ventas de caja</a>
    <a class="nav-item" href="#ajustes" data-vista="ajustes">${icono('ajustes')}Configuración</a>
    <a class="nav-item" href="#seguridad" data-vista="seguridad">${icono('seguridad')}Seguridad</a>
    <div class="grupo">Abren la app actual</div>
    ${apps}
    <div class="yo"><div class="avatar" aria-hidden="true">${inicial}</div>
      <div class="quien">${esc(u.email)}<small>${esc(eq.nombre || '')} · v${F.VERSION}</small></div></div>`;
  $('barra').innerHTML = `
    <a href="#hoy" data-vista="hoy">${icono('hoy', 22)}Hoy</a>
    <a href="#caja" data-vista="caja">${icono('cajon', 22)}Caja</a>
    <a href="#seguridad" data-vista="seguridad">${icono('seguridad', 22)}Seguridad</a>
    <a href="#menu" data-vista="menu">${icono('menu', 22)}Menú</a>`;
}

function irA(v) {
  VISTAS.forEach(x => $('v-' + x).classList.toggle('oculto', x !== v));
  document.querySelectorAll('[data-vista]').forEach(a => {
    if (a.dataset.vista === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (v === 'hoy') pintarHoy();
  if (v === 'caja') pintarCaja(subVista());
  if (v === 'seguridad') pintarSeguridad();
  if (v === 'ajustes') pintarAjustes();
  if (v === 'agenda') pintarAgendaMes();
  if (v === 'gastos') pintarGastos(subVista());
  if (v === 'b2b') pintarB2b(subVista());
  if (v !== 'b2b' && b2b.vivo) { b2b.vivo(); b2b.vivo = null; b2b.datos = null; }
  if (v === 'menu') pintarMenuCelular();
  window.scrollTo(0, 0);
}

// ── Hoy ────────────────────────────────────────────
// Lee de la caja (mismo proyecto de Firebase) y los resuelve en "Ventas de caja". Gastos, B2B y Producción se conectan después.
function itemPendiente(p) {
  const fuera = /^https?:/.test(p.url) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="pendiente" href="${esc(p.url)}"${fuera}>
    <div class="icono-caja c-${p.color}">${icono(p.icono)}</div>
    <div class="txt">${p.origen ? `<small class="origen">${esc(p.origen)}</small>` : ''}<b>${esc(p.titulo)}</b><span>${esc(p.detalle)}</span></div>
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
      <a class="tarjeta cifra enlace-cifra" href="#caja/reportes/ayer"><span class="rotulo">Ventas de ayer en caja</span><span class="valor" id="c-ventas">…</span><span class="nota" id="c-ventas-n">Bruto, con IVA</span><span class="ver-mas-cifra">Ver reporte</span></a>
      <div class="tarjeta cifra"><span class="rotulo">Cajas abiertas ahora ${info('Cajas abiertas ahora', 'Cajas abiertas hoy que siguen vendiendo. Una caja de un día anterior que quedó abierta no cuenta aquí: aparece en Pendientes como "Caja anterior sin cerrar".')}</span><span class="valor" id="c-abiertas">…</span><span class="nota">Abiertas hoy</span></div>
    </div>
    <div class="columnas">
      <section class="tarjeta col-ancha" aria-labelledby="t-pend">
        <div class="titulo-fila"><h2 id="t-pend">Pendientes</h2><span>Lo más urgente primero</span></div>
        <div id="lista-pend"><div class="vacio">Revisando…</div></div>
      </section>
      <div class="col-angosta">
        <section class="tarjeta" aria-labelledby="t-agenda-sem" id="agenda-semana">
          <div class="titulo-fila"><h2 id="t-agenda-sem">Agenda semanal ${info('Agenda semanal', 'Lo que viene en los próximos 7 días, empezando hoy.\nFën: lo que agregas para el negocio y los pagos de Gastos de esta semana (llegan solos desde Gastos).\nPersonal: lo ves solo tú; no lo ven otras cuentas ni entra en los informes de Fën.\nToca algo tuyo para cambiarlo, marcarlo hecho o quitarlo. Un pago de Gastos abre Gastos.')}</h2><a href="#agenda">Ver mes</a></div>
          <div class="chips chips-chicos" role="group" aria-label="Qué mostrar">${['todo', 'fen', 'personal'].map(f => `<button type="button" class="chip-filtro" data-ag-filtro="${f}" aria-pressed="${agFiltro() === f}">${{ todo: 'Todo', fen: 'Fën', personal: 'Personal' }[f]}</button>`).join('')}</div>
          <div id="agenda-lista"><div class="vacio">Cargando…</div></div>
          <button type="button" class="btn-sec" id="ag-agregar" style="margin-top:12px">${icono('mas', 16)} Agregar</button>
        </section>
        <section class="tarjeta" aria-labelledby="t-fuentes">
          <div class="titulo-fila"><h2 id="t-fuentes">De dónde lee Hoy</h2><span id="hoy-hora"></span></div>
          <div id="fuentes"></div>
          <p class="nota-i">(i) Hoy solo lee: no cambia nada en las apps. Si una no responde, sus pendientes no aparecen hasta que vuelva.</p>
          <p class="ayuda" style="margin-top:6px">Cómo se calcula cada pendiente ${info('Pendientes de las otras apps', 'Gastos: pagos atrasados (vencimientos pendientes con fecha pasada), pagos de los próximos 7 días (incluye hoy) y documentos del SII cargados que aún no tienen gasto.\nVentas B2B: cobros atrasados según la frecuencia de pago de cada cliente (descuenta abonos), y órdenes sin folio; "atrasadas" según si el cliente factura diario, semanal o mensual. Es la misma cuenta que hace la app B2B.\nProducción: materias primas o insumos nuevos que pidieron las jefas y solicitudes de habilitar una materia prima en otra área.\nCada app guarda el resumen 2 minutos: un cambio recién hecho puede tardar eso en verse aquí. Tocar un pendiente abre la app.')}</p>
        </section>
      </div>
    </div>`;

  const q = (col, ...w) => getDocs(query(collection(db, col), ...w));
  const r = await Promise.allSettled([
    q('evaluacion_caja', where('fecha', 'in', [ayer, hoy])),
    q('cajas', where('estado', '==', 'abierta')),
    q('cajas', where('apertura', '>=', Caja.haceDias(F.DIAS_HISTORIAL))),
    q('solicitudes_anulacion', where('estado', '==', 'pendiente')),
    q('resumenes_caja', where('fecha', '==', ayer))
  ]);
  if (!$('lista-pend')) return; // se cambió de vista mientras cargaba
  const docs = i => (r[i].status === 'fulfilled' ? r[i].value.docs.map(d => ({ id: d.id, ...d.data() })) : []);
  const cajaOk = r.every(x => x.status === 'fulfilled');
  const pend = [];

  docs(0).filter(e => Math.abs(Number(e.difTotal) || 0) > 0 && e.diferenciaAceptada !== true).forEach(e => pend.push({
    orden: 0, color: 'rojo', icono: 'alerta', chip: 'Atención', url: '#caja', titulo: 'Descuadre de caja', origen: 'Caja',
    detalle: `${sucursal(e.sucursal)} · ${diaTexto(e.fecha)} · diferencia ${pesos(e.difTotal)}`
  }));
  const abiertas = docs(1);
  abiertas.filter(c => (c.fecha || '') < hoy).forEach(c => pend.push({
    orden: 1, color: 'amarillo', icono: 'reloj', chip: 'Cerrar', url: '#caja', titulo: 'Caja anterior sin cerrar', origen: 'Caja',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · ${c.usuario || ''}`
  }));
  docs(2).filter(c => c.estado === 'cerrada' && c.exportadaSheets !== true && (parseInt(c.nVentas) || 0) > 0).forEach(c => pend.push({
    orden: 2, color: 'amarillo', icono: 'cajon', chip: 'Reenviar', url: '#caja', titulo: 'Cierre sin pasar a planilla', origen: 'Caja',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · ${pesos(c.totalVentas)}`
  }));
  docs(3).forEach(s => pend.push({
    orden: 3, color: 'lila', icono: 'anular', chip: 'Revisar', url: '#caja/anulaciones', titulo: 'Anulación por aprobar', origen: 'Caja',
    detalle: `${sucursal(s.sucursal)} · ${pesos(s.total)} · pide ${s.solicitadoPor || ''}`
  }));
  const estados = { gastos: { estado: 'leyendo' }, b2b: { estado: 'leyendo' }, produccion: { estado: 'leyendo' } };
  const pintarLista = () => {
    if (!$('lista-pend')) return;
    const todos = pend.concat(pendientesApps(estados)).sort((a, b) => a.orden - b.orden);
    const leyendo = Object.values(estados).some(x => x.estado === 'leyendo');
    $('lista-pend').innerHTML = todos.length ? todos.map(itemPendiente).join('') + (leyendo ? '<div class="vacio">Revisando Gastos, Ventas B2B y Producción…</div>' : '')
      : `<div class="vacio">${leyendo ? 'Revisando…' : cajaOk ? 'Nada pendiente.' : 'No se pudo leer la caja. Revisa internet y vuelve a abrir Hoy.'}</div>`;
    $('hoy-sub').textContent = `${fechaLarga} · ${todos.length} ${todos.length === 1 ? 'pendiente' : 'pendientes'}${leyendo ? '…' : ''}`;
    pintarFuentes();
  };

  const resumenes = docs(4);
  $('c-ventas').textContent = r[4].status === 'fulfilled' ? pesos(resumenes.reduce((a, x) => a + (Number(x.totalBruto) || 0), 0)) : '—';
  $('c-ventas-n').textContent = `${resumenes.length} ${resumenes.length === 1 ? 'cierre' : 'cierres'} · bruto, con IVA`;
  $('c-abiertas').textContent = r[1].status === 'fulfilled' ? String(abiertas.filter(c => c.fecha === hoy).length) : '—';

  function pintarFuentes() {
    if (!$('fuentes')) return;
    const fila = (nombre, chip, color, extra = '') => `<div class="fuente"><span>${esc(nombre)}${extra}</span><span class="chip c-${color}">${esc(chip)}</span></div>`;
    const E = { ok: ['Al día', 'verde'], leyendo: ['Revisando…', 'gris'], sin_url: ['Falta la dirección', 'amarillo'], actualizar: ['Falta actualizar', 'amarillo'], error: ['Sin respuesta', 'amarillo'] };
    $('fuentes').innerHTML = fila('Caja', cajaOk ? 'Al día' : 'Sin respuesta', cajaOk ? 'verde' : 'amarillo')
      + Apps.APPS.map(a => { const e = estados[a.id]; const [t, c] = E[e.estado] || E.error;
        const ayuda = e.estado === 'sin_url' ? ' <a href="#ajustes/conexiones">Agregar</a>' : e.estado === 'actualizar' ? ' <a href="#ajustes/conexiones">Cómo</a>' : '';
        return fila(a.nombre, t, c, ayuda) + (e.estado === 'error' && e.error ? `<div class="ayuda" style="margin:-4px 0 6px">${esc(e.error)}</div>` : ''); }).join('');
  }
  $('hoy-hora').textContent = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  pintarLista();
  // Agenda de los próximos 7 días (lo propio + los pagos de Gastos cuando llegan)
  const hasta7 = Caja.diaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 6));
  let propios = null;
  const pintarSemana = () => { if ($('agenda-lista') && propios) pintarAgendaSemana(propios.concat(itemsAuto(estados, hoy, hasta7)), hoy, hasta7); };
  Agenda.leerAgenda(hoy, hasta7).then(l => { propios = l; pintarSemana(); })
    .catch(e => { if ($('agenda-lista')) $('agenda-lista').innerHTML = `<div class="error">${esc(e.code === 'permission-denied' ? 'Falta publicar las reglas v1.3.0 de Firestore (ver README).' : mensajeError(e))}</div>`; });
  $('ag-agregar').addEventListener('click', () => abrirItemAgenda(null, hoy));
  el.querySelectorAll('[data-ag-filtro]').forEach(b => b.addEventListener('click', () => {
    agFiltro(b.dataset.agFiltro);
    el.querySelectorAll('[data-ag-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    pintarSemana();
  }));
  // Las otras apps se leen en paralelo; cada una aparece apenas responde
  // v0.13: solicitudes de logística (base nueva de B2B), si está conectada en este equipo
  B2b.solicitudesParaHoy().then(l => {
    if (!l || !l.length) return;
    const tipos = { precio: 'precio especial', producto: 'producto nuevo', anulacion: 'anulación' };
    const cuenta = {}; l.forEach(x => { const t = tipos[x.tipo] || 'otra'; cuenta[t] = (cuenta[t] || 0) + 1; });
    pend.push({ orden: 2.8, color: 'lila', icono: 'camion', chip: 'Responder', url: '#b2b/solicitudes', origen: 'Ventas B2B', titulo: `${l.length === 1 ? 'Solicitud' : 'Solicitudes'} de logística`,
      detalle: Object.entries(cuenta).map(([t, n]) => `${n} de ${t}`).join(' · ') });
    pintarLista();
  }).catch(() => {});
  // v0.14: abonos de la cartola por revisar
  B2b.movimientosParaHoy().then(r => {
    if (!r || !r.n) return;
    pend.push({ orden: 2.9, color: 'azul', icono: 'boleta', chip: 'Conciliar', url: '#b2b/conciliacion', origen: 'Ventas B2B', titulo: `${r.n} ${r.n === 1 ? 'abono' : 'abonos'} de la cartola por revisar`,
      detalle: `${pesos(r.monto)}${r.desde ? ' · desde el ' + diaTexto(r.desde) : ''}` });
    pintarLista();
  }).catch(() => {});
  // v0.13.2: clientes que dejaron de comprar
  B2b.dejoDeComprarParaHoy().then(l => {
    if (!l || !l.length) return;
    l.forEach(c => pend.push({ orden: 3.5, color: 'amarillo', icono: 'camion', chip: 'Revisar', url: '#b2b/clientes/' + encodeURIComponent(c.id), origen: 'Ventas B2B', titulo: `${c.nombre} dejó de comprar`,
      detalle: `${c.diasSin} días sin pedir (normalmente cada ${c.intervalo}) · Llámalo o márcalo "Ya lo revisé" en Clientes` }));
    pintarLista();
  }).catch(() => {});
  const urls = await Apps.leerConexiones();
  await Promise.all(Apps.APPS.map(async a => { estados[a.id] = await Apps.leerPendientes(a.id, urls[a.id]); pintarLista(); if (a.id === 'gastos') pintarSemana(); }));
}

// ── Agenda ─────────────────────────────────────────
// Filtro Todo / Fën / Personal: se recuerda en este equipo (si el navegador lo permite)
let agFiltroMem = 'todo';
function agFiltro(v) {
  if (v) { agFiltroMem = v; try { localStorage.setItem('fen_sistema_agenda_filtro', v); } catch (e) {} return v; }
  try { agFiltroMem = localStorage.getItem('fen_sistema_agenda_filtro') || agFiltroMem; } catch (e) {}
  return ['todo', 'fen', 'personal'].includes(agFiltroMem) ? agFiltroMem : 'todo';
}
const pasaFiltro = x => agFiltro() === 'todo' || x.tipo === agFiltro();
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const partesDia = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
// Pagos de Gastos de esta semana (llegan con el resumen de Gastos: hasta 5, los más próximos)
function itemsAuto(estados, desde, hasta) {
  const g = estados && estados.gastos;
  if (!g || g.estado !== 'ok') return [];
  const s = (g.pendientes || []).find(x => x.clave === 'semana');
  return ((s && s.detalle) || []).filter(v => v.fecha >= desde && v.fecha <= hasta)
    .map(v => ({ auto: true, tipo: 'fen', fecha: v.fecha, hora: '', titulo: `Pago de ${v.nombre}`, origen: 'Desde Gastos', monto: v.monto, vencId: v.id }));
}
function filaAgenda(x, i) {
  const sub = [x.hora, x.auto ? `${x.origen}${x.monto ? ' · ' + pesos(x.monto) : ''}` : (x.nota || 'Agregado por ti')].filter(Boolean).join(' · ');
  const cuerpo = `<span class="ag-txt"><b>${esc(x.titulo)}</b><small>${esc(sub)}</small></span>${x.tipo === 'personal' ? '<span class="chip c-lila chip-chico">Personal</span>' : ''}`;
  if (x.auto) return x.vencId ? `<button type="button" class="ag-item${x.pagado ? ' hecho' : ''}" data-venc="${esc(x.vencId)}">${cuerpo}</button>` : `<div class="ag-item">${cuerpo}</div>`;
  return `<button type="button" class="ag-item${x.hecho ? ' hecho' : ''}" data-ag="${i}">${cuerpo}</button>`;
}
function pintarAgendaSemana(items, hoy, hasta) {
  const vis = items.filter(pasaFiltro);
  const manana = Caja.diaLocal(new Date(partesDia(hoy).getTime() + 864e5));
  const porDia = {}; vis.forEach(x => (porDia[x.fecha] = porDia[x.fecha] || []).push(x));
  const dias = Object.keys(porDia).sort();
  $('agenda-lista').innerHTML = dias.length ? dias.map(d => { const f = partesDia(d);
    const nombre = d === hoy ? 'HOY' : d === manana ? 'MAÑANA' : `${DIAS_CORTOS[f.getDay()]} ${f.getDate()}`;
    return `<div class="ag-dia"><div class="ag-fecha">${nombre}</div><div class="ag-items">${porDia[d].map(x => filaAgenda(x, vis.indexOf(x))).join('')}</div></div>`; }).join('')
    : `<div class="vacio">${agFiltro() === 'personal' ? 'Nada personal' : 'Nada agendado'} en estos 7 días.</div>`;
  $('agenda-lista').querySelectorAll('[data-ag]').forEach(b => b.addEventListener('click', () => abrirItemAgenda(vis[+b.dataset.ag])));
  $('agenda-lista').querySelectorAll('[data-venc]').forEach(b => b.addEventListener('click', () => abrirPagoPorId(b.dataset.venc)));
}

// Vista del mes
let agMes = null; // 'AAAA-MM'
async function pintarAgendaMes() {
  const el = $('v-agenda');
  const hoy = Caja.diaLocal();
  if (!agMes) agMes = hoy.slice(0, 7);
  const [y, m] = agMes.split('-').map(Number);
  const primero = new Date(y, m - 1, 1), ultimo = new Date(y, m, 0);
  const desde = Caja.diaLocal(primero), hasta = Caja.diaLocal(ultimo);
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-agenda">Agenda ${info('Agenda', 'Fën: lo del negocio (lo ve la administración). Personal: solo tú lo ves y no entra en los informes de Fën.\nToca un día para agregar algo ese día, o algo ya agendado para cambiarlo, marcarlo hecho o quitarlo. Quitar no lo borra: queda guardado como quitado.\nLos pagos de Gastos aparecen en Hoy (próximos 7 días). La copia a Google Calendar llega más adelante.')}</h1><p>${esc(MESES_LARGOS[m - 1].replace(/^./, c => c.toUpperCase()))} ${y}</p></div>
      <div class="mes-nav"><button type="button" class="btn-icono" id="mes-ant" aria-label="Mes anterior">${icono('izq', 18)}</button><button type="button" class="btn-sec btn-chico" id="mes-hoy">Hoy</button><button type="button" class="btn-icono" id="mes-sig" aria-label="Mes siguiente">${icono('flecha', 18)}</button></div></div>
    <div class="filtros"><div class="chips" role="group" aria-label="Qué mostrar">${['todo', 'fen', 'personal'].map(f => `<button type="button" class="chip-filtro" data-ag-filtro="${f}" aria-pressed="${agFiltro() === f}">${{ todo: 'Todo', fen: 'Fën', personal: 'Personal' }[f]}</button>`).join('')}</div>
      <button type="button" class="btn" id="mes-agregar">${icono('mas', 16)} Agregar</button></div>
    <section class="tarjeta" id="mes-cuerpo"><div class="vacio" style="border:0">Cargando…</div></section>`;
  $('mes-ant').onclick = () => { agMes = Caja.diaLocal(new Date(y, m - 2, 1)).slice(0, 7); pintarAgendaMes(); };
  $('mes-sig').onclick = () => { agMes = Caja.diaLocal(new Date(y, m, 1)).slice(0, 7); pintarAgendaMes(); };
  $('mes-hoy').onclick = () => { agMes = hoy.slice(0, 7); pintarAgendaMes(); };
  $('mes-agregar').onclick = () => abrirItemAgenda(null, agMes === hoy.slice(0, 7) ? hoy : desde);
  el.querySelectorAll('[data-ag-filtro]').forEach(b => b.addEventListener('click', () => { agFiltro(b.dataset.agFiltro); pintarAgendaMes(); }));
  let items;
  // Vencimientos de Gastos del mes (si Gastos responde; si no, la agenda se ve igual sin ellos)
  const vencPromesa = agFiltro() === 'personal' ? Promise.resolve([]) : Gastos.datos().then(d => (d.vencimientos || []).filter(v => v.fecha >= desde && v.fecha <= hasta)
    .map(v => ({ auto: true, tipo: 'fen', fecha: v.fecha, hora: '', titulo: `Pago de ${v.nombre}`, origen: v.estado === 'PAGADO' ? 'Desde Gastos · pagado' : 'Desde Gastos', monto: Number(v.montoPago || v.montoEstimado) || 0, vencId: v.id, pagado: v.estado === 'PAGADO' }))).catch(() => []);
  try { items = (await Agenda.leerAgenda(desde, hasta)).filter(pasaFiltro).concat(await vencPromesa).sort((a, b) => (a.fecha + (a.hora || '99:99')).localeCompare(b.fecha + (b.hora || '99:99'))); }
  catch (e) { $('mes-cuerpo').innerHTML = `<div class="error">${esc(e.code === 'permission-denied' ? 'Falta publicar las reglas v1.3.0 de Firestore (ver README).' : mensajeError(e))}</div>`; return; }
  if (!$('mes-cuerpo')) return;
  const porDia = {}; items.forEach(x => (porDia[x.fecha] = porDia[x.fecha] || []).push(x));
  const hueco = (primero.getDay() + 6) % 7; // lunes primero
  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push('<div class="mes-dia vacio-dia" aria-hidden="true"></div>');
  for (let d = 1; d <= ultimo.getDate(); d++) {
    const dia = Caja.diaLocal(new Date(y, m - 1, d)), lista = porDia[dia] || [];
    celdas.push(`<div class="mes-dia${dia === hoy ? ' es-hoy' : ''}${dia < hoy ? ' pasado' : ''}" data-dia="${dia}">
      <button type="button" class="mes-num" data-nuevo="${dia}" aria-label="Agregar el ${d}">${d}</button>
      ${lista.slice(0, 3).map(x => x.vencId ? `<button type="button" class="mes-item gasto${x.pagado ? ' hecho' : ''}" data-venc="${esc(x.vencId)}">${esc(x.titulo)}</button>`
        : `<button type="button" class="mes-item${x.tipo === 'personal' ? ' personal' : ''}${x.hecho ? ' hecho' : ''}" data-ag="${items.indexOf(x)}">${x.hora ? `<span>${esc(x.hora)}</span> ` : ''}${esc(x.titulo)}</button>`).join('')}
      ${lista.length > 3 ? `<button type="button" class="mes-mas" data-ver-dia="${dia}">+${lista.length - 3} más</button>` : ''}</div>`);
  }
  while (celdas.length % 7) celdas.push('<div class="mes-dia vacio-dia" aria-hidden="true"></div>');
  // En el celular: lista de los días con algo agendado
  const diasCon = Object.keys(porDia).sort();
  $('mes-cuerpo').innerHTML = `<div class="mes-grilla" role="grid" aria-label="Mes">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(n => `<div class="mes-cab">${n}</div>`).join('')}${celdas.join('')}</div>
    <div class="mes-lista">${diasCon.length ? diasCon.map(d => { const f = partesDia(d); return `<div class="ag-dia"><div class="ag-fecha">${d === hoy ? 'HOY' : `${DIAS_CORTOS[f.getDay()]} ${f.getDate()}`}</div><div class="ag-items">${porDia[d].map(x => filaAgenda(x, items.indexOf(x))).join('')}</div></div>`; }).join('') : '<div class="vacio">Nada agendado este mes.</div>'}</div>`;
  $('mes-cuerpo').querySelectorAll('[data-ag]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); abrirItemAgenda(items[+b.dataset.ag]); }));
  $('mes-cuerpo').querySelectorAll('[data-venc]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); abrirPagoPorId(b.dataset.venc); }));
  $('mes-cuerpo').querySelectorAll('[data-nuevo]').forEach(b => b.addEventListener('click', () => abrirItemAgenda(null, b.dataset.nuevo)));
  $('mes-cuerpo').querySelectorAll('[data-ver-dia]').forEach(b => b.addEventListener('click', () => {
    const d = b.dataset.verDia;
    const dlg = dialogo(`<div class="form-dialogo"><h2>${esc(fechaCaja(d))}</h2><div class="ag-items">${porDia[d].map(x => filaAgenda(x, items.indexOf(x))).join('')}</div><div class="botones"><button type="button" class="btn-sec" id="dd-cerrar">Cerrar</button></div></div>`);
    dlg.querySelector('#dd-cerrar').onclick = () => dlg.close();
    dlg.querySelectorAll('[data-ag]').forEach(x => x.addEventListener('click', () => { dlg.close(); abrirItemAgenda(items[+x.dataset.ag]); }));
    dlg.querySelectorAll('[data-venc]').forEach(x => x.addEventListener('click', () => { dlg.close(); abrirPagoPorId(x.dataset.venc); }));
  }));
}

// Agregar o cambiar algo de la agenda
function abrirItemAgenda(item, fecha) {
  const it = item || { titulo: '', fecha: fecha || Caja.diaLocal(), hora: '', nota: '', tipo: agFiltro() === 'personal' ? 'personal' : 'fen' };
  const d = dialogo(`<form class="form-dialogo" novalidate>
    <h2>${item ? 'Cambiar' : 'Agregar a la agenda'}</h2>
    <div class="campo"><label for="ag-titulo">Qué es</label><input id="ag-titulo" type="text" maxlength="120" value="${esc(it.titulo)}" placeholder="Por ejemplo: Reunión con proveedor de harina" autocomplete="off"></div>
    <div class="grilla-montos"><div class="campo"><label for="ag-fecha">Fecha</label><input id="ag-fecha" type="date" value="${esc(it.fecha)}"></div>
      <div class="campo"><label for="ag-hora">Hora (opcional)</label><input id="ag-hora" type="time" value="${esc(it.hora || '')}"></div></div>
    <fieldset class="campo tipo-ag"><legend>Es de</legend>
      <label><input type="radio" name="ag-tipo" value="fen" ${it.tipo !== 'personal' ? 'checked' : ''}> Fën</label>
      <label><input type="radio" name="ag-tipo" value="personal" ${it.tipo === 'personal' ? 'checked' : ''}> Personal <small>solo tú lo ves</small></label></fieldset>
    <div class="campo"><label for="ag-nota">Nota (opcional)</label><textarea id="ag-nota" rows="2" maxlength="500">${esc(it.nota || '')}</textarea></div>
    <div class="error" id="ag-error" role="alert"></div>
    <div class="botones">${item ? `<button type="button" class="btn-sec btn-peligro" id="ag-quitar">Quitar</button><button type="button" class="btn-sec" id="ag-hecho">${item.hecho ? 'Desmarcar hecho' : 'Marcar hecho'}</button>` : ''}
      <button type="button" class="btn-sec" id="ag-cancelar">Cancelar</button><button type="submit" class="btn" id="ag-guardar">Guardar</button></div>
  </form>`);
  const listo = texto => { if (texto) registrar(texto[0], texto[1]); d.close(); refrescarAgenda(); };
  const detalle = (tipo, titulo, fecha) => (tipo === 'personal' ? `personal · ${fechaCaja(fecha)}` : `${titulo} · ${fechaCaja(fecha)}`);
  d.querySelector('#ag-cancelar').onclick = () => d.close();
  d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const tipo = d.querySelector('input[name="ag-tipo"]:checked').value;
    const datos = { titulo: d.querySelector('#ag-titulo').value, fecha: d.querySelector('#ag-fecha').value, hora: d.querySelector('#ag-hora').value, nota: d.querySelector('#ag-nota').value };
    const b = d.querySelector('#ag-guardar'); b.disabled = true;
    try { await Agenda.guardar(item, datos, tipo); listo([item ? 'Cambió la agenda' : 'Agregó a la agenda', detalle(tipo, datos.titulo.trim(), datos.fecha)]); }
    catch (er) { d.querySelector('#ag-error').textContent = er.code === 'permission-denied' ? 'Falta publicar las reglas v1.3.0 de Firestore (ver README).' : (er.message || mensajeError(er)); b.disabled = false; }
  });
  if (item) {
    d.querySelector('#ag-hecho').onclick = async () => { try { await Agenda.marcarHecho(item, !item.hecho); listo(); } catch (er) { d.querySelector('#ag-error').textContent = er.message || mensajeError(er); } };
    d.querySelector('#ag-quitar').onclick = async () => {
      if (!window.confirm(`¿Quitar "${item.titulo}" de la agenda?`)) return;
      try { await Agenda.quitar(item); listo(['Quitó de la agenda', detalle(item.tipo, item.titulo, item.fecha)]); } catch (er) { d.querySelector('#ag-error').textContent = er.message || mensajeError(er); }
    };
  }
  setTimeout(() => d.querySelector('#ag-titulo').focus(), 30);
}
function refrescarAgenda() { const v = vistaDesdeHash(); if (v === 'agenda') pintarAgendaMes(); else if (v === 'hoy') pintarHoy(); else if (v === 'gastos') pintarGastos(subVista()); }

// ── Gastos ─────────────────────────────────────────
const AREAS_GASTO = ['BOL', 'PAN', 'CAF', 'PAS', 'ADMIN', 'VENTAS'];
const montoV = v => (v.multiArea && v.multiArea.length ? v.multiArea.reduce((s, a) => s + (Number(a.monto) || 0), 0) : Number(String(v.montoEstimado || '').replace(/[^0-9]/g, '')) || 0);
const SUBS_GASTOS = [['', 'Vencimientos'], ['obligaciones', 'Obligaciones'], ['registrar', 'Registrar'], ['registrados', 'Registrados'], ['previred', 'Previred'], ['analisis', 'Análisis'], ['sii', 'Cargas del SII'], ['items', 'Ítems']];
function pestanasGastos(sub) {
  const actual = SUBS_GASTOS.some(([k]) => k && k === sub) ? sub : '';
  return `<div class="pestanas" role="tablist" aria-label="Secciones de Gastos">${SUBS_GASTOS.map(([k, t]) => `<a role="tab" href="#gastos${k ? '/' + k : ''}" aria-selected="${k === actual}">${t}</a>`).join('')}</div>`;
}
async function pintarGastos(sub) {
  const el = $('v-gastos');
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Todo lo de la app de Gastos, aquí</p></div>${pestanasGastos(sub)}</div>
    <div class="tarjeta"><div class="vacio" style="border:0">Cargando Gastos…</div></div>`;
  let d;
  try { d = await Gastos.datos(); }
  catch (e) {
    el.querySelector('.tarjeta').innerHTML = `<div class="error">${esc(e.message || mensajeError(e))}</div>${e.code === 'sin_url' || e.code === 'actualizar' ? '<p class="ayuda" style="margin-top:8px"><a href="#ajustes/conexiones">Ir a Conexiones</a></p>' : ''}`;
    return;
  }
  if (vistaDesdeHash() !== 'gastos') return;
  if (sub === 'registrar') pintarRegistrarGasto(el, sub, d);
  else if (sub === 'sii') pintarSII(el, sub, d);
  else if (sub === 'obligaciones') pintarObligaciones(el, sub, d);
  else if (sub === 'registrados') pintarRegistrados(el, sub, d);
  else if (sub === 'analisis') pintarAnalisis(el, sub, d);
  else if (sub === 'items') pintarItems(el, sub, d);
  else if (sub === 'previred') pintarPrevired(el, sub, d);
  else pintarVencimientos(el, sub, d);
}

function pintarVencimientos(el, sub, d) {
  const hoy = Caja.diaLocal(), en7 = Caja.diaLocal(new Date(Date.now() + 7 * 864e5)), finMes = Caja.diaLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const pend = (d.vencimientos || []).filter(v => v.estado !== 'PAGADO').sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const grupos = [
    { t: 'Atrasados', l: pend.filter(v => v.fecha < hoy), rojo: true },
    { t: 'Próximos 7 días', l: pend.filter(v => v.fecha >= hoy && v.fecha <= en7) },
    { t: 'Resto del mes', l: pend.filter(v => v.fecha > en7 && v.fecha <= finMes) },
    { t: 'Más adelante', l: pend.filter(v => v.fecha > finMes && v.fecha > en7) }
  ];
  const pagados = (d.vencimientos || []).filter(v => v.estado === 'PAGADO').sort((a, b) => (b.fechaPago || '').localeCompare(a.fechaPago || ''));
  const fila = (v, rojo) => `<div class="fila-caja"><div class="txt"><b>${esc(v.nombre)}</b>
      <span>${esc(fechaCaja(v.fecha))}${v.area && v.area !== 'MULTI' ? ' · ' + esc(v.area) : v.area === 'MULTI' ? ' · varias áreas' : ''}${v.item && v.item !== v.nombre ? ' · ' + esc(v.item) : ''}</span>${v.obs ? `<span class="nota">${esc(v.obs)}</span>` : ''}</div>
      <div class="acciones"><span class="chip ${rojo ? 'c-rojo' : 'c-gris'}">${montoV(v) ? esc(pesos(montoV(v))) : 'Sin monto'}</span><button type="button" class="btn-sec" data-pagar="${esc(v.id)}">Pagar</button><button type="button" class="btn-sec btn-chico btn-peligro" data-anular-v="${esc(v.id)}" aria-label="Anular ${esc(v.nombre)}">Anular</button></div></div>`;
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Todo lo de la app de Gastos, aquí</p></div>${pestanasGastos(sub)}</div>
    <div class="cifras cifras-4">
      <div class="tarjeta cifra"><span class="rotulo">Atrasado</span><span class="valor">${pesos(grupos[0].l.reduce((s, v) => s + montoV(v), 0))}</span><span class="nota">${grupos[0].l.length} ${grupos[0].l.length === 1 ? 'pago' : 'pagos'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Próximos 7 días</span><span class="valor">${pesos(grupos[1].l.reduce((s, v) => s + montoV(v), 0))}</span><span class="nota">${grupos[1].l.length} ${grupos[1].l.length === 1 ? 'pago' : 'pagos'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Resto del mes ${info('Montos de los vencimientos', 'Es el monto estimado de cada vencimiento (el de su obligación o el de la compra a crédito). Al pagar escribes el monto real.\nLas cuponeras aparecen cuota por cuota, cada una en su fecha.')}</span><span class="valor">${pesos(grupos[2].l.reduce((s, v) => s + montoV(v), 0))}</span><span class="nota">${grupos[2].l.length} ${grupos[2].l.length === 1 ? 'pago' : 'pagos'}</span></div>
    </div>
    ${grupos.filter(g => g.l.length).map((g, i) => `<section class="tarjeta" aria-labelledby="t-venc-${i}"><div class="titulo-fila"><h2 id="t-venc-${i}">${g.t}</h2><span>${g.l.length}</span></div>
      <div data-colapsar="6">${g.l.map(v => fila(v, g.rojo)).join('')}</div></section>`).join('') || '<section class="tarjeta"><div class="vacio">No hay vencimientos por pagar.</div></section>'}
    ${pagados.length ? `<section class="tarjeta" aria-labelledby="t-venc-pag"><div class="titulo-fila"><h2 id="t-venc-pag">Pagados</h2><span>Últimos 7 días</span></div>
      <div data-colapsar="3">${pagados.map(v => `<div class="fila-caja"><div class="txt"><b>${esc(v.nombre)}</b><span>Pagado el ${esc(fechaCaja(v.fechaPago))}${v.urlComprobante ? ' · <a href="' + esc(v.urlComprobante) + '" target="_blank" rel="noopener">comprobante</a>' : ''}</span></div>
        <div class="acciones"><span class="chip c-verde">${esc(pesos(Number(v.montoPago) || 0))}</span></div></div>`).join('')}</div></section>` : ''}
    <p class="nota-i">(i) Pagar aquí hace lo mismo que en la app de Gastos: marca el vencimiento pagado, crea el gasto (o completa el de la compra a crédito) y genera el siguiente si es recurrente. El historial de pagos y las reglas están en Obligaciones. Anular un vencimiento no lo borra: queda ANULADO con su motivo.</p>`;
  el.querySelectorAll('[data-pagar]').forEach(b => b.addEventListener('click', () => abrirPago((d.vencimientos || []).find(v => v.id === b.dataset.pagar))));
  el.querySelectorAll('[data-anular-v]').forEach(b => b.addEventListener('click', () => anularVencimientoUI((d.vencimientos || []).find(v => v.id === b.dataset.anularV))));
  colapsar(el);
}

async function abrirPagoPorId(id) {
  try { const d = await Gastos.datos(); const v = (d.vencimientos || []).find(x => String(x.id) === String(id));
    if (!v) { alert('Ese vencimiento ya no está en Gastos.'); return; }
    if (v.estado === 'PAGADO') { alert(`"${v.nombre}" ya está pagado (${fechaCaja(v.fechaPago)}).`); return; }
    abrirPago(v);
  } catch (e) { alert(e.message || mensajeError(e)); }
}

function chipsTipoMonto(nombre, sel) {
  return `<div class="chips" role="radiogroup" aria-label="Tipo de monto">${[['bruto', 'Bruto (con IVA)'], ['neto', 'Neto (+IVA)'], ['siniva', 'Sin IVA']].map(([k, t]) =>
    `<label class="chip-radio"><input type="radio" name="${nombre}" value="${k}" ${k === sel ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
}
const filaArea = (cls, area = '', monto = '') => `<div class="fila-area"><select class="${cls}-area" aria-label="Área"><option value="">Área</option>${AREAS_GASTO.map(a => `<option ${a === area ? 'selected' : ''}>${a}</option>`).join('')}</select>
  <input class="${cls}-monto" type="number" inputmode="numeric" min="0" step="1" placeholder="$" value="${esc(monto)}" aria-label="Monto"><button type="button" class="btn-icono" data-quitar-area aria-label="Quitar área">×</button></div>`;

function abrirPago(v) {
  if (!v) return;
  const usaAreas = (v.multiArea && v.multiArea.length) || v.area === 'MULTI';
  const hoy = Caja.diaLocal();
  const partes = v.area === 'PRORRATEADO' ? [[v.pArea1, v.pPct1], [v.pArea2, v.pPct2], [v.pArea3, v.pPct3]].filter(([a, p]) => a && p) : [];
  const d = dialogo(`<form class="form-dialogo" novalidate>
    <h2>Registrar pago</h2>
    <p class="ayuda"><b>${esc(v.nombre)}</b>${v.item ? ' · ' + esc(v.item) : ''} · vence ${esc(fechaCaja(v.fecha))}${v.fecha < hoy ? ' <span class="chip c-rojo chip-chico">Atrasado</span>' : ''}</p>
    ${partes.length ? `<p class="ayuda">Se reparte: ${partes.map(([a, p]) => `${esc(a)} ${esc(p)}%`).join(' · ')}</p>` : v.area && v.area !== 'MULTI' ? `<p class="ayuda">Área: ${esc(v.area)}</p>` : ''}
    <div class="campo"><span class="etiqueta">Tipo de monto</span>${chipsTipoMonto('pg-tipo', v.tipoMonto || 'bruto')}</div>
    ${usaAreas ? `<div class="campo"><span class="etiqueta">Monto por área ${info('Monto por área', 'Este pago se reparte entre varias áreas. Escribe lo real de este mes en cada una: el total del pago es la suma.')}</span><div id="pg-areas">${(v.multiArea && v.multiArea.length ? v.multiArea : [{}]).map(a => filaArea('pg', a.area || '', a.monto || '')).join('')}</div>
      <button type="button" class="btn-sec btn-chico" id="pg-mas-area">Agregar área</button></div>` : ''}
    <div class="grilla-montos"><div class="campo"><label for="pg-monto">Monto pagado</label><input id="pg-monto" type="number" inputmode="numeric" min="0" step="1" value="${montoV(v) || ''}" ${usaAreas ? 'readonly' : ''}></div>
      <div class="campo"><label for="pg-fecha">Fecha de pago</label><input id="pg-fecha" type="date" value="${hoy}" max="${hoy}"></div></div>
    <div class="desglose" id="pg-desglose"></div>
    <div class="campo"><label for="pg-archivo">Comprobante (opcional)</label><input id="pg-archivo" type="file" accept="image/*,application/pdf"></div>
    <div class="campo"><label for="pg-obs">Observación (opcional)</label><input id="pg-obs" type="text" maxlength="300"></div>
    <div class="error" id="pg-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="pg-cancelar">Cancelar</button><button type="submit" class="btn" id="pg-guardar">Registrar pago</button></div>
  </form>`);
  const tipo = () => d.querySelector('input[name="pg-tipo"]:checked').value;
  const areas = () => [...d.querySelectorAll('#pg-areas .fila-area')].map(f => ({ area: f.querySelector('.pg-area').value, monto: Number(f.querySelector('.pg-monto').value) || 0 })).filter(a => a.area && a.monto > 0);
  const recalcular = () => {
    if (usaAreas) d.querySelector('#pg-monto').value = areas().reduce((s, a) => s + a.monto, 0) || '';
    const x = Gastos.desglose(d.querySelector('#pg-monto').value, tipo());
    d.querySelector('#pg-desglose').innerHTML = x.total ? `<span>Neto ${pesos(x.neto)}</span>${tipo() !== 'siniva' ? `<span>IVA ${pesos(x.total - x.neto)}</span>` : ''}<b>Total ${pesos(x.total)}</b>` : '';
  };
  d.addEventListener('input', recalcular); d.addEventListener('change', recalcular);
  d.addEventListener('click', e => { if (e.target.closest('[data-quitar-area]')) { e.target.closest('.fila-area').remove(); recalcular(); } });
  if (usaAreas) d.querySelector('#pg-mas-area').onclick = () => { d.querySelector('#pg-areas').insertAdjacentHTML('beforeend', filaArea('pg')); };
  recalcular();
  d.querySelector('#pg-cancelar').onclick = () => d.close();
  let idem = 'pago-' + Gastos.nuevaClave();
  d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = d.querySelector('#pg-error'); err.textContent = '';
    const monto = Number(d.querySelector('#pg-monto').value) || 0, fecha = d.querySelector('#pg-fecha').value;
    if (!(monto > 0)) { err.textContent = 'Escribe el monto pagado.'; return; }
    if (!fecha) { err.textContent = 'Elige la fecha de pago.'; return; }
    const b = d.querySelector('#pg-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      const archivo = await Gastos.prepararArchivo(d.querySelector('#pg-archivo').files[0]);
      await Gastos.pagar({ id: v.id, montoPago: monto, fechaPago: fecha, tipoMonto: tipo(), obsPago: d.querySelector('#pg-obs').value, multiArea: usaAreas ? areas() : [], ...(archivo || {}) }, idem);
      registrar('Pagó un vencimiento', `${v.nombre} · ${pesos(monto)} · ${fechaCaja(fecha)}`);
      d.close(); refrescarAgenda();
    } catch (er) {
      if (er.code && er.code !== 'en_curso') idem = 'pago-' + Gastos.nuevaClave();
      err.textContent = (er.message || mensajeError(er)) + (er.code ? '' : ' Si vuelves a tocar Registrar pago no se duplica.');
      if (er.code === 'pagado') { Gastos.olvidar(); setTimeout(() => { d.close(); refrescarAgenda(); }, 2500); }
      b.disabled = false; b.textContent = 'Registrar pago';
    }
  });
}

function pintarRegistrarGasto(el, sub, d) {
  const items = d.items || [];
  const hoy = Caja.diaLocal();
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Todo lo de la app de Gastos, aquí</p></div>${pestanasGastos(sub)}</div>
    <form class="tarjeta form-gasto" id="form-gasto" novalidate>
      <div class="grilla-montos"><div class="campo"><label for="gs-fecha">Fecha de la compra</label><input id="gs-fecha" type="date" value="${hoy}" max="${hoy}"></div>
        <div class="campo"><span class="etiqueta">Tipo de monto ${info('Tipo de monto', 'Bruto: el total de la boleta, con IVA incluido.\nNeto: el monto sin IVA; al guardar se suma el 19% (31% si es harina).\nSin IVA: documentos exentos o sin IVA; el monto queda tal cual.')}</span>${chipsTipoMonto('gs-tipo', 'bruto')}</div></div>
      <div id="gs-items"></div>
      <button type="button" class="btn-sec" id="gs-mas-item">${icono('mas', 16)} Agregar otro ítem</button>
      <div class="desglose desglose-grande" id="gs-total"></div>
      <div class="campo"><span class="etiqueta">Forma de pago</span><div class="chips" role="radiogroup" aria-label="Forma de pago">${[['contado', 'Contado'], ['tarjeta', 'Tarjeta de crédito'], ['proveedor', 'Crédito proveedor']].map(([k, t]) => `<label class="chip-radio"><input type="radio" name="gs-forma" value="${k}" ${k === 'contado' ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
      <div class="campo oculto" id="gs-campo-fpago"><label for="gs-fpago">Fecha de pago ${info('Crédito', 'Con tarjeta o crédito de proveedor se crea un vencimiento en esa fecha, para pagarlo después desde Vencimientos.')}</label><input id="gs-fpago" type="date" min="${hoy}"></div>
      <div class="campo"><label for="gs-archivo">Foto o archivo de la boleta</label><input id="gs-archivo" type="file" accept="image/*,application/pdf" capture="environment"><span class="ayuda">Obligatoria, como en la app de Gastos. Se guarda en Drive, carpeta "Boletas Gastos".</span></div>
      <div class="campo"><label for="gs-obs">Observación (opcional)</label><input id="gs-obs" type="text" maxlength="300"></div>
      <div class="error" id="gs-error" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn" id="gs-guardar">Registrar gasto</button></div>
    </form>
    <p class="nota-i">(i) Arriendo, luz y las demás obligaciones recurrentes no aparecen aquí: se pagan desde Vencimientos. Para corregir o anular un gasto ya registrado, ve a Registrados. Las facturas del SII se importan en Cargas del SII.</p>`;
  let n = 0;
  const seccion = () => { const id = ++n; return `<fieldset class="item-gasto" data-sec="${id}"><legend class="sr">Ítem ${id}</legend>
    <div class="fila-item"><div class="campo" style="flex:1"><label for="gs-item-${id}">Ítem</label><select id="gs-item-${id}" class="gs-item"><option value="">Elige un ítem</option>${items.map(i => `<option value="${esc(i.item)}">${esc(i.item)}</option>`).join('')}</select></div>
      ${id > 1 ? '<button type="button" class="btn-icono" data-quitar-item aria-label="Quitar este ítem">×</button>' : ''}</div>
    <div class="gs-detalle"></div></fieldset>`; };
  const cont = $('gs-items');
  cont.insertAdjacentHTML('beforeend', seccion());
  const tipo = () => el.querySelector('input[name="gs-tipo"]:checked').value;
  const datosSec = s => {
    const it = items.find(i => i.item === s.querySelector('.gs-item').value); if (!it) return null;
    if (s.querySelector('.gs-detalle').dataset.item !== it.item) return null; // el detalle aún no se dibuja
    const esHarina = !!(s.querySelector('.gs-harina') && s.querySelector('.gs-harina').checked);
    if (it.area === 'SELECCIONAR') { const areas = [...s.querySelectorAll('.fila-area')].map(f => ({ area: f.querySelector('.gs-area').value, monto: Number(f.querySelector('.gs-monto').value) || 0 })).filter(a => a.area && a.monto > 0);
      return { item: it.item, esHarina, areas, montoTotal: areas.reduce((x, a) => x + a.monto, 0) }; }
    if (it.area === 'PRORRATEADO') { const g = k => s.querySelector('.gs-' + k).value;
      return { item: it.item, esHarina, montoTotal: Number(g('mtotal')) || 0, prorrateo: { area1: g('a1'), pct1: parseInt(g('p1')) || 0, area2: g('a2'), pct2: parseInt(g('p2')) || 0, area3: g('a3'), pct3: parseInt(g('p3')) || 0 } }; }
    return { item: it.item, esHarina, montoTotal: Number(s.querySelector('.gs-mfijo').value) || 0 };
  };
  const recalcular = () => {
    let neto = 0, total = 0;
    el.querySelectorAll('.item-gasto').forEach(s => { const x = datosSec(s); if (!x || !x.montoTotal) return; const r = Gastos.desglose(x.montoTotal, tipo(), x.esHarina); neto += r.neto; total += r.total; });
    $('gs-total').innerHTML = total ? `<span>Neto ${pesos(neto)}</span>${tipo() !== 'siniva' ? `<span>IVA${el.querySelector('.gs-harina:checked') ? ' e impuesto harina' : ''} ${pesos(total - neto)}</span>` : ''}<b>Total ${pesos(total)}</b>` : '';
    el.querySelectorAll('.item-gasto').forEach(s => { const h = s.querySelector('.gs-pct-hint'); if (h) { const x = datosSec(s); const sum = (x.prorrateo.pct1 || 0) + (x.prorrateo.pct2 || 0) + (x.prorrateo.area3 ? x.prorrateo.pct3 || 0 : 0); h.textContent = `Suma ${sum}%${sum === 100 ? '' : ' · debe sumar 100%'}`; h.classList.toggle('dif-mal', sum !== 100); } });
  };
  const alElegir = s => {
    const it = items.find(i => i.item === s.querySelector('.gs-item').value), det = s.querySelector('.gs-detalle');
    det.dataset.item = it ? it.item : '';
    if (!it) { det.innerHTML = ''; recalcular(); return; }
    const selA = c => `<select class="gs-${c}" aria-label="Área"><option value="">Área</option>${AREAS_GASTO.map(a => `<option>${a}</option>`).join('')}</select>`;
    det.innerHTML = `<p class="ayuda">${[it.categoria, it.tipo, it.subTipo].filter(Boolean).map(esc).join(' · ')}${['SELECCIONAR', 'PRORRATEADO'].includes(it.area) ? '' : ' · Área ' + esc(it.area)}</p>
      ${it.item === 'MATERIA PRIMA' ? '<label class="check"><input type="checkbox" class="gs-harina"> Es harina (12% adicional)</label>' : ''}
      ${it.area === 'SELECCIONAR' ? `<span class="etiqueta">Monto por área</span><div class="gs-areas">${filaArea('gs')}</div><button type="button" class="btn-sec btn-chico" data-mas-area>Agregar área</button>`
        : it.area === 'PRORRATEADO' ? `<span class="etiqueta">Reparto por área (%)</span><div class="prorrateo">${[1, 2, 3].map(k => `<div class="fila-area">${selA('a' + k)}<input class="gs-p${k}" type="number" min="0" max="100" step="1" placeholder="%" aria-label="Porcentaje área ${k}">${k === 3 ? '<span class="ayuda">opcional</span>' : ''}</div>`).join('')}</div><span class="ayuda gs-pct-hint"></span>
          <div class="campo"><label>Monto total</label><input class="gs-mtotal" type="number" inputmode="numeric" min="0" step="1"></div>`
        : `<div class="campo"><label>Monto</label><input class="gs-mfijo" type="number" inputmode="numeric" min="0" step="1"></div>`}`;
    recalcular();
  };
  $('form-gasto').addEventListener('change', e => { const s = e.target.closest('.item-gasto'); if (e.target.classList.contains('gs-item')) alElegir(s); if (e.target.name === 'gs-forma') $('gs-campo-fpago').classList.toggle('oculto', e.target.value === 'contado'); recalcular(); });
  $('form-gasto').addEventListener('input', recalcular);
  $('form-gasto').addEventListener('click', e => {
    if (e.target.closest('[data-quitar-item]')) { e.target.closest('.item-gasto').remove(); recalcular(); }
    else if (e.target.closest('[data-quitar-area]')) { const f = e.target.closest('.fila-area'); if (f.parentElement.children.length > 1) f.remove(); recalcular(); }
    else if (e.target.closest('[data-mas-area]')) e.target.closest('.item-gasto').querySelector('.gs-areas').insertAdjacentHTML('beforeend', filaArea('gs'));
  });
  $('gs-mas-item').onclick = () => cont.insertAdjacentHTML('beforeend', seccion());
  let idem = 'gasto-' + Gastos.nuevaClave();
  $('form-gasto').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('gs-error'); err.textContent = '';
    const secs = [...el.querySelectorAll('.item-gasto')].map(datosSec);
    if (secs.some(x => !x)) { err.textContent = 'Elige el ítem en cada parte (o quita la que sobra).'; return; }
    for (const x of secs) {
      if (!(x.montoTotal > 0)) { err.textContent = `${x.item}: falta el monto.`; return; }
      if (x.prorrateo) { const q = x.prorrateo, usadas = [q.area1, q.area2, q.area3].filter(Boolean), s = q.pct1 + q.pct2 + (q.area3 ? q.pct3 : 0);
        if (!q.area1 || !q.area2 || s !== 100) { err.textContent = `${x.item}: elige al menos dos áreas y que los % sumen 100.`; return; }
        if (new Set(usadas).size !== usadas.length) { err.textContent = `${x.item}: cada área una sola vez.`; return; } }
    }
    const forma = el.querySelector('input[name="gs-forma"]:checked').value, fpago = $('gs-fpago').value;
    if (forma !== 'contado' && !fpago) { err.textContent = 'Elige la fecha de pago del crédito.'; return; }
    const f = $('gs-archivo').files[0];
    if (!f) { err.textContent = 'Falta la foto o el archivo de la boleta.'; return; }
    const fecha = $('gs-fecha').value; if (!fecha) { err.textContent = 'Elige la fecha de la compra.'; return; }
    const b = $('gs-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      const archivo = await Gastos.prepararArchivo(f);
      const ahora = new Date();
      await Gastos.registrar({ fecha: fecha.split('-').reverse().join('-'), hora: `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`, items: secs, tipoMonto: tipo(), formaPago: forma, fechaPago: forma === 'contado' ? '' : fpago, observacion: $('gs-obs').value, ...archivo }, idem);
      const total = secs.reduce((s, x) => s + Gastos.desglose(x.montoTotal, tipo(), x.esHarina).total, 0);
      registrar('Registró un gasto', `${secs.map(x => x.item).join(' + ')} · ${pesos(total)}`);
      idem = 'gasto-' + Gastos.nuevaClave();
      alert(`Gasto registrado: ${secs.map(x => x.item).join(' + ')} · ${pesos(total)}${forma !== 'contado' ? `\n\nQuedó un vencimiento para el ${fechaCaja(fpago)}.` : ''}`);
      pintarGastos('registrar');
    } catch (er) {
      // Si Gastos respondió (error de datos, ya pagado…), no se guardó nada: el próximo intento es un envío nuevo.
      // Si no hubo respuesta (internet), pudo guardarse: se reintenta con la misma clave, que no duplica.
      if (er.code && er.code !== 'en_curso') idem = 'gasto-' + Gastos.nuevaClave();
      err.textContent = (er.message || mensajeError(er)) + (er.code ? '' : ' Si vuelves a tocar Registrar no se duplica; si cambias algo, revisa antes en Gastos si ya quedó.');
      b.disabled = false; b.textContent = 'Registrar gasto';
    }
  });
}

// ── Gastos · Cargas del SII ────────────────────────
// Lo que está en pantalla (archivo abierto, clasificación) vive aquí mientras la página esté
// abierta: cambiar de pestaña y volver no pierde lo clasificado.
const sii = { facturas: [], formato: '', nombre: '', items: [], busqueda: '', aviso: '', hint: '', idem: null, firma: '',
  cargas: null, errorCargas: '', histBusqueda: '', meses: new Set(), mesesInit: false, docs: new Set(), notaCarga: null };
const FORMATO_SII = {
  xml: 'XML del SII: trae el detalle de productos y la fecha de vencimiento.',
  detalle: 'Documentos recibidos (.xls): trae el detalle de productos, sin fecha de vencimiento.',
  registro: 'Registro de Compras (.csv): trae los totales, sin detalle de productos.'
};
const fechaSii = iso => (iso ? fechaCaja(iso) : 'sin fecha');

async function pintarSII(el, sub, d) {
  sii.items = d.itemsSii || d.items || [];
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Todo lo de la app de Gastos, aquí</p></div>${pestanasGastos(sub)}</div>
    <section class="tarjeta" aria-labelledby="t-sii-subir">
      <div class="titulo-fila"><h2 id="t-sii-subir">Subir un archivo del SII ${info('Archivos del SII', 'Sirven tres archivos del SII (sección compras):\n• XML (Documentos recibidos → Descargar XML): el más completo, con detalle de productos, fecha de vencimiento y forma de pago.\n• XLS (Documentos recibidos): con detalle de productos, sin vencimiento.\n• CSV (Registro de Compras y Ventas): el mes completo, solo totales.\nAl subirlo se marca lo que ya está en Gastos, y una copia del archivo queda en Drive (carpeta "Cargas SII", privada) para volver a abrirlo desde el historial.')}</h2></div>
      <div class="campo"><label for="sii-archivo">Archivo (XML, XLS o CSV)</label><input id="sii-archivo" type="file" accept=".xml,.xls,.xlsx,.csv,.txt,.html,text/xml,application/xml,text/csv"></div>
      <div id="sii-msg" class="ayuda" role="status"></div>
    </section>
    <div id="sii-trabajo"></div>
    <section class="tarjeta" aria-labelledby="t-sii-hist">
      <div class="titulo-fila"><h2 id="t-sii-hist">Cargas anteriores ${info('Cargas anteriores', 'Cada archivo subido queda aquí, agrupado por el mes de sus documentos, con cuántos ya están en Gastos.\n"Reabrir" vuelve a abrir el archivo desde Drive para seguir clasificando donde quedaste.\nLa búsqueda revisa todos los documentos de todas las cargas (folio, RUT o proveedor).\n"Quitar del historial" no borra nada: los gastos quedan igual y el archivo sigue en Drive.')}</h2><span id="sii-hist-resumen"></span></div>
      <div class="campo"><label class="sr" for="sii-hist-buscar">Buscar en las cargas</label><input id="sii-hist-buscar" type="search" placeholder="Buscar folio, RUT o proveedor en todas las cargas" value="${esc(sii.histBusqueda)}"></div>
      <div id="sii-hist"><div class="vacio" style="border:0">Cargando el historial…</div></div>
    </section>`;
  $('sii-archivo').addEventListener('change', e => { const f = e.target.files[0]; if (f) leerArchivoSii(f); e.target.value = ''; });
  $('sii-hist-buscar').addEventListener('input', e => { sii.histBusqueda = e.target.value; pintarHistorialSii(); });
  eventosTrabajoSii($('sii-trabajo'));
  eventosHistorialSii($('sii-hist'));
  pintarTrabajoSii();
  if (sii.cargas) pintarHistorialSii();
  cargarHistorialSii();
}

async function cargarHistorialSii() {
  try { sii.cargas = (await Sii.cargas()).cargas || []; sii.errorCargas = ''; }
  catch (e) { sii.errorCargas = e.message || mensajeError(e); sii.errorCode = e.code; }
  pintarHistorialSii();
}

// ── Abrir un archivo ──
async function leerArchivoSii(file) {
  const msg = $('sii-msg');
  if (file.size > 10 * 1024 * 1024) { msg.textContent = 'El archivo pesa más de 10 MB: no parece un archivo del SII.'; return; }
  let contenido;
  try { contenido = await file.text(); } catch (e) { msg.textContent = 'No se pudo leer el archivo: ' + e.message; return; }
  await procesarSii(contenido, file.name, { guardar: true, tipo: file.type });
}

async function procesarSii(contenido, nombre, { guardar, tipo } = {}) {
  const msg = $('sii-msg');
  const { formato, facturas } = Sii.leer(contenido);
  if (!facturas.length) { if (msg) msg.textContent = 'No se reconocieron documentos en el archivo. Revisa que sea el XML o los Documentos recibidos (.xls) o el Registro de Compras (.csv) del SII.'; return; }
  Object.assign(sii, { facturas, formato, nombre, busqueda: '', aviso: '', hint: '', idem: null, firma: '' });
  if (msg) msg.textContent = 'Revisando qué documentos ya están en Gastos…';
  pintarTrabajoSii(true);
  try {
    const r = await Sii.estado(facturas);
    const ya = new Set(r.importados || []);
    facturas.forEach(f => { const k = Sii.clave(f); f.yaImportada = ya.has(k); f.nota = (r.notas || {})[k] || ''; f.coincidencias = (r.coincidencias || {})[k] || null; });
  } catch (e) {
    if (e.code === 'actualizar' || e.code === 'sin_url') { if (msg) msg.textContent = e.message; sii.facturas = []; pintarTrabajoSii(); return; }
    sii.aviso = `No se pudo revisar qué documentos ya están en Gastos (${e.message}). Puedes clasificar igual: al importar, Gastos revisa los repetidos y no guarda nada dos veces.`;
  }
  Sii.precargarVencimientos(facturas);
  if (sii.facturas !== facturas) return; // mientras tanto se abrió otro archivo
  if (msg) msg.textContent = '';
  pintarTrabajoSii();
  if (!guardar) return;
  try {
    const r = await Sii.registrarCarga(facturas, nombre, tipo, contenido, 'carga-' + Gastos.nuevaClave());
    registrar('Subió un archivo del SII', `${nombre} · ${facturas.length} documentos`);
    if ($('sii-msg') && sii.facturas === facturas) $('sii-msg').textContent = r.conArchivo ? 'El archivo quedó guardado en el historial de cargas.' : 'La carga quedó en el historial, pero la copia en Drive no se pudo guardar.';
  } catch (e) {
    if ($('sii-msg') && sii.facturas === facturas) $('sii-msg').textContent = `El archivo no quedó en el historial (${e.message}). Puedes clasificar e importar igual.`;
  }
  cargarHistorialSii();
}

// ── Archivo abierto: resumen, acciones y documentos ──
function pintarTrabajoSii(revisando) {
  const cont = $('sii-trabajo'); if (!cont) return;
  const F = sii.facturas;
  if (!F.length) { cont.innerHTML = ''; return; }
  if (revisando) { cont.innerHTML = `<section class="tarjeta"><div class="vacio" style="border:0">Revisando ${F.length} documentos…</div></section>`; return; }
  const pend = F.filter(f => !f.yaImportada);
  const nc = pend.filter(f => f.esNotaCredito).length, harina = pend.filter(f => f.esHarina).length;
  cont.innerHTML = `<section class="tarjeta" aria-labelledby="t-sii-arch">
      <div class="titulo-fila"><h2 id="t-sii-arch">${esc(sii.nombre)}</h2><span>${F.length} ${F.length === 1 ? 'documento' : 'documentos'}</span></div>
      <p class="ayuda">${FORMATO_SII[sii.formato] || ''}</p>
      ${sii.aviso ? `<div class="aviso">${esc(sii.aviso)}</div>` : ''}
      <div class="desglose desglose-grande"><span>Por importar <b>${pend.length}</b></span><span>Total <b>${pesos(pend.reduce((s, f) => s + f.total, 0))}</b></span>${F.length - pend.length ? `<span>Ya en Gastos <b>${F.length - pend.length}</b></span>` : ''}${nc ? `<span>Notas de crédito <b>${nc}</b> (restan)</span>` : ''}${harina ? `<span>Con impuesto a la harina <b>${harina}</b></span>` : ''}</div>
      ${pend.length ? `<div class="sii-lote">
          <span class="etiqueta">Aplicar a todas ${info('Aplicar a todas', 'Marca de una vez todas las facturas como pagadas o pendientes, o les pone la misma fecha. Después puedes cambiar cualquiera una por una.\nPagada: el gasto queda pagado en esa fecha.\nPendiente: el gasto queda a crédito y se crea un vencimiento en esa fecha, para pagarlo desde Vencimientos.\nLas notas de crédito no llevan estado: se registran con su fecha.')}</span>
          <div class="chips"><button type="button" class="chip-filtro" data-todas="pagada">Todas pagadas</button><button type="button" class="chip-filtro" data-todas="pendiente">Todas pendientes</button></div>
          <div class="fila-lote"><label for="sii-fecha-lote">Fecha a todas</label><input type="date" id="sii-fecha-lote"><button type="button" class="btn-sec" data-fecha-todas>Aplicar</button></div>
        </div>
        <div class="botones" style="justify-content:flex-start;margin-top:14px"><button type="button" class="btn" data-importar>Importar las clasificadas</button>
          ${info('Importar', 'Se importan solo las facturas que tienen ítem; las demás quedan para después (puedes reabrir el archivo desde el historial).\nCada factura crea sus líneas en Gastos (una por ítem y área), con el folio en la observación y el RUT del proveedor. Si el documento trae detalle, los productos quedan en la hoja "Detalle Compras".\nAntes de guardar, Gastos revisa de nuevo los repetidos: si alguna ya estaba, no guarda nada y te pregunta.')}</div>
        <div id="sii-import-hint" class="sii-hint">${sii.hint}</div>` : `<p class="ayuda">Todos los documentos de este archivo ya están en Gastos.</p>${sii.hint ? `<div class="sii-hint">${sii.hint}</div>` : ''}`}
      <div class="campo" style="margin-top:14px"><label class="sr" for="sii-buscar">Buscar en este archivo</label><input id="sii-buscar" type="search" placeholder="Buscar folio, RUT o proveedor en este archivo" value="${esc(sii.busqueda)}"><span class="ayuda" id="sii-buscar-hint"></span></div>
    </section>
    <div id="sii-docs"></div>`;
  pintarDocsSii();
}

function pintarDocsSii() {
  const cont = $('sii-docs'); if (!cont) return;
  const q = sii.busqueda.trim().toLowerCase();
  const visibles = sii.facturas.map((f, i) => ({ f, i })).filter(({ f }) => !q || f.folio.toLowerCase().includes(q) || f.razonSocial.toLowerCase().includes(q) || f.rut.toLowerCase().includes(q));
  const h = $('sii-buscar-hint');
  if (h) h.textContent = q ? (visibles.length ? `${visibles.length} resultado(s) · ${visibles.filter(x => x.f.yaImportada).length} ya en Gastos` : `Sin resultados para "${sii.busqueda.trim()}"`) : '';
  cont.innerHTML = visibles.map(({ f, i }) => tarjetaSii(f, i)).join('');
}
function repintarDocSii(i) { const el = $('sii-doc-' + i); if (el) el.outerHTML = tarjetaSii(sii.facturas[i], i); }

function bloqueNotaSii(f, i) {
  if (f.editandoNota) return `<div class="bloque-sii nota-sii"><label class="etiqueta" for="sii-nota-txt-${i}">Nota de este documento</label>
    <textarea id="sii-nota-txt-${i}" rows="2" maxlength="500" placeholder="Ej: no sé si el gas es del local o del horno — preguntar">${esc(f.nota || '')}</textarea>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec" data-nota-guardar>Guardar</button><button type="button" class="btn-sec" data-nota-cancelar>Cancelar</button></div>
    <span class="ayuda">Déjala vacía para quitar la nota. Sigue al documento aunque vuelva a aparecer en otro archivo.</span></div>`;
  if (f.nota) return `<div class="aviso aviso-accion"><span>${esc(f.nota)}</span><button type="button" class="btn-sec btn-chico" data-nota>Editar nota</button></div>`;
  return `<button type="button" class="btn-link" data-nota>Dejar una nota o marcar en duda</button>`;
}

function tarjetaSii(f, i) {
  const cab = `<div class="doc-cab"><div class="txt"><b>${esc(f.razonSocial)}</b><span>${esc(f.tipoLabel)} N° ${esc(f.folio)} · ${esc(f.fecha)} · ${esc(f.rut)}</span>${f.dirRecep && !f.yaImportada ? `<span>${esc(f.dirRecep)}</span>` : ''}</div>
    <span class="doc-monto${f.total < 0 ? ' negativo' : ''}">${pesos(f.total)}</span></div>`;
  if (f.yaImportada) {
    const det = f.detalleGuardado;
    return `<article class="tarjeta doc-sii importada" id="sii-doc-${i}" data-i="${i}">${cab}
      <div class="chips-doc"><span class="chip c-verde chip-chico">Ya en Gastos</span></div>
      ${bloqueNotaSii(f, i)}
      <button type="button" class="btn-link" data-ver-det aria-expanded="${!!f.detalleAbierto}">${f.detalleAbierto ? 'Ocultar el detalle' : 'Ver el detalle guardado'}</button>
      ${f.detalleAbierto ? (det === undefined ? '<p class="ayuda">Buscando el detalle…</p>' : listaDetalleSii(det)) : ''}
    </article>`;
  }
  Sii.prepararLineas(f, sii.items);
  const emis = Sii.fechaDDMMYYYYaISO(f.fecha);
  const plazo = f.fechaVencISO && emis ? Math.round((new Date(f.fechaVencISO + 'T00:00:00') - new Date(emis + 'T00:00:00')) / 864e5) : 0;
  const chips = [];
  if (plazo > 0) chips.push(`<span class="chip c-azul chip-chico">Vence ${esc(f.fechaVencimiento)} · ${plazo} días</span>`);
  else if (f.formaPagoSII === '2') chips.push('<span class="chip c-azul chip-chico">A crédito</span>');
  if (f.termPago) chips.push(`<span class="chip c-gris chip-chico">${esc(f.termPago)}</span>`);
  if (f.esNotaCredito) chips.push('<span class="chip c-rojo chip-chico">Nota de crédito</span>');
  if (f.esHarina) chips.push('<span class="chip c-amarillo chip-chico">Harina 12%</span>');
  if (f.tipoDoc === '34') chips.push('<span class="chip c-lila chip-chico">Exenta</span>');
  const tot = Sii.revisarTotal(f);
  const etFecha = f.esNotaCredito ? 'Fecha de la nota de crédito' : f.estado === 'pagada' ? 'Fecha de pago' : f.estado === 'pendiente' ? 'Fecha de vencimiento' : '';
  return `<article class="tarjeta doc-sii" id="sii-doc-${i}" data-i="${i}">${cab}
    <p class="ayuda">Neto ${pesos(f.neto)} · IVA ${pesos(f.iva)}${f.otroImpuesto ? ` · Otro impuesto ${pesos(f.otroImpuesto)}${f.tasaOtroImpuesto ? ` (${f.tasaOtroImpuesto}%)` : ''}` : ''}</p>
    ${chips.length ? `<div class="chips-doc">${chips.join('')}</div>` : ''}
    ${f.descuadre ? `<div class="aviso aviso-rojo">${esc(f.descuadre)}. Revisa este documento antes de importarlo.</div>` : ''}
    ${bloqueNotaSii(f, i)}
    ${f.coincidencias && f.coincidencias.length ? `<div class="bloque-sii coincidencia"><b>¿Ya lo registraste a mano? ${info('Posible coincidencia', 'Hay gastos registrados a mano (sin RUT ni folio) con el mismo monto y una fecha cercana (hasta 5 días).\nSi es la misma compra, tócalo: al gasto se le anota el RUT y el folio y el documento queda como ya importado, sin duplicarlo.\nSi es otra compra, elige "No, es una compra distinta" y clasifícalo normal.')}</b>
      ${f.coincidencias.map((c, ci) => `<div class="fila-caja"><div class="txt"><b>${esc(c.items.filter(Boolean).join(' + ') || 'Sin ítem')}</b>
        <span>${esc(fechaSii(c.fecha))}${c.diasDif ? ` (${c.diasDif} día${c.diasDif > 1 ? 's' : ''} de diferencia)` : ' (misma fecha)'} · ${pesos(c.total)}${c.formaPago ? ' · ' + esc(c.formaPago) : ''}</span>
        ${c.areas && c.areas.length ? `<span>${c.areas.map(a => `${esc(a.area)} ${pesos(a.monto)}`).join(' · ')}</span>` : ''}${c.obs ? `<span class="nota">${esc(c.obs)}</span>` : ''}</div>
        <div class="acciones"><button type="button" class="btn-sec" data-vincular="${ci}">Sí, es este gasto</button></div></div>`).join('')}
      <button type="button" class="btn-link" data-descartar>No, es una compra distinta</button></div>` : ''}
    <div class="clasif-sii">${lineasSii(f, i)}</div>
    ${!(f.detalle && f.detalle.length) ? `<button type="button" class="btn-sec btn-chico" data-dividir>Dividir en otro ítem</button>` : ''}
    ${tot ? `<p class="sii-ok${tot.ok ? '' : ' dif-mal'}" id="sii-total-${i}">${esc(tot.texto)}</p>` : ''}
    ${f.esNotaCredito ? '<p class="ayuda">Una nota de crédito descuenta un cobro anterior: se registra como gasto negativo con la fecha del documento.</p>'
      : `<div class="chips" role="group" aria-label="Estado de pago"><button type="button" class="chip-filtro" data-estado="pagada" aria-pressed="${f.estado === 'pagada'}">Pagada</button><button type="button" class="chip-filtro" data-estado="pendiente" aria-pressed="${f.estado === 'pendiente'}">Pendiente</button></div>`}
    ${etFecha ? `<div class="campo campo-fecha-sii"><label for="sii-fecha-${i}">${etFecha}</label><input id="sii-fecha-${i}" type="date" data-fecha value="${esc(f.fechaEstado || '')}"></div>` : ''}
  </article>`;
}

const opcionesItems = sel => `<option value="">Elige un ítem</option>${sii.items.map(it => `<option value="${esc(it.item)}" ${it.item === sel ? 'selected' : ''}>${esc(it.item)}</option>`).join('')}`;
const opcionesAreas = sel => `<option value="">Área</option>${AREAS_GASTO.map(a => `<option ${a === sel ? 'selected' : ''}>${a}</option>`).join('')}`;
const acumulador = () => `<div class="acumulador"><input type="number" inputmode="numeric" placeholder="Sumar…" aria-label="Monto para sumar"><button type="button" class="btn-sec btn-chico" data-sumar aria-label="Sumar al monto">+</button></div>`;

function lineasSii(f, i) {
  const conDetalle = !!(f.detalle && f.detalle.length), varias = f.lineas.length > 1;
  if (conDetalle) {
    const factor = Sii.factorBruto(f), sinItem = f.detalle.filter(d => !d.item).length;
    const productos = `<div class="bloque-sii"><div class="titulo-fila"><b>Asignar productos ${info('Asignar productos', 'El documento trae el detalle de productos: elige el ítem de cada uno y los montos se calculan solos (los del SII vienen netos y se llevan al total real con IVA e impuestos).\nSi el ítem se reparte por área (por ejemplo MATERIA PRIMA), elige también el área de cada producto.')}</b><span class="${sinItem ? 'dif-mal' : 'sii-ok'}">${sinItem ? `${sinItem} sin ítem` : 'todos con ítem'}</span></div>
      ${f.detalle.map((d, di) => { const it = sii.items.find(x => x.item === d.item);
        return `<div class="producto-sii"><div class="txt"><span class="desc">${esc(d.descripcion)}</span><span>${d.cantidad ? `${esc(Sii.fmtCantidad(d.cantidad, d.unidad))} a ${pesos(Math.abs(d.precioUnitario || 0) * factor)} · ` : ''}${pesos(Math.abs(d.monto) * factor)}${d.descuento ? ` · dto. ${pesos(Math.abs(d.descuento) * factor)}` : ''}</span></div>
          <div class="selects"><select data-det-item="${di}" aria-label="Ítem de ${esc(d.descripcion)}">${opcionesItems(d.item)}</select>
          ${it && it.area === 'SELECCIONAR' ? `<select data-det-area="${di}" aria-label="Área de ${esc(d.descripcion)}">${opcionesAreas(d.area)}</select>` : ''}</div></div>`; }).join('')}
      ${f.detalle.length > 1 ? `<div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-chico" data-todo-det="item">Mismo ítem a todos</button><button type="button" class="btn-sec btn-chico" data-todo-det="area">Misma área a todos</button></div>` : ''}</div>`;
    const repartos = f.lineas.map((ln, li) => {
      const it = sii.items.find(x => x.item === ln.item);
      if (!ln.item || !Sii.necesitaAreas(it)) return '';
      if (ln.areasAuto) return `<div class="bloque-sii"><b>${esc(ln.item)} · ${pesos(ln.monto)}</b>${ln.areas.map(a => `<div class="fila-reparto"><span>${esc(a.area)}</span><b>${pesos(a.valor)}</b></div>`).join('')}<span class="sii-ok">Calculado desde los productos</span></div>`;
      return `<div class="bloque-sii"><b>${esc(ln.item)} · ${pesos(ln.monto)}</b>${repartoSii(f, i, li)}</div>`;
    }).join('');
    return productos + repartos;
  }
  return f.lineas.map((ln, li) => {
    const it = sii.items.find(x => x.item === ln.item);
    return `<div class="${varias ? 'bloque-sii' : ''}">
      ${varias ? `<div class="titulo-fila"><b>Ítem ${li + 1}</b><button type="button" class="btn-icono" data-quitar-linea="${li}" aria-label="Quitar el ítem ${li + 1}">×</button></div>` : ''}
      <div class="campo"><label class="${varias ? 'sr' : 'etiqueta'}" for="sii-item-${i}-${li}">Ítem de gasto</label><select id="sii-item-${i}-${li}" data-linea-item="${li}">${opcionesItems(ln.item)}</select></div>
      ${it && !varias ? `<p class="ayuda">${[it.categoria, it.tipo, it.subTipo].filter(Boolean).map(esc).join(' · ')}${Sii.necesitaAreas(it) ? '' : ' · Área ' + esc(it.area)}</p>` : ''}
      ${varias ? `<div class="con-acum"><label class="etiqueta" for="sii-monto-${i}-${li}">Monto de este ítem</label><input id="sii-monto-${i}-${li}" class="objetivo" type="number" inputmode="numeric" min="0" step="1" data-linea-monto="${li}" value="${esc(ln.monto ?? '')}">${acumulador()}</div>` : ''}
      ${Sii.necesitaAreas(it) ? repartoSii(f, i, li) : ''}
    </div>`;
  }).join('');
}

function repartoSii(f, i, li) {
  const ln = f.lineas[li], modo = ln.modoArea || 'monto', rev = Sii.revisarAreas(f, li);
  return `<div class="reparto-sii"><div class="titulo-fila"><span class="etiqueta">Reparto por área ${info('Reparto por área', 'En $ escribes cuánto va a cada área; en % el porcentaje de cada una (se convierte en pesos al importar).\nEl botón de sugerencia propone porcentajes según las ventas reales del mes anterior de esas áreas. Quedan editables.')}</span>
      <div class="chips"><button type="button" class="chip-filtro chip-mini" data-modo="${li}:monto" aria-pressed="${modo === 'monto'}">$</button><button type="button" class="chip-filtro chip-mini" data-modo="${li}:pct" aria-pressed="${modo === 'pct'}">%</button></div></div>
    ${(ln.areas || []).map((a, ai) => `<div class="con-acum"><div class="fila-area"><select data-area-area="${li}:${ai}" aria-label="Área">${opcionesAreas(a.area)}</select>
      <input class="objetivo" type="number" inputmode="numeric" min="0" step="1" placeholder="${modo === 'pct' ? '%' : '$'}" data-area-valor="${li}:${ai}" value="${esc(a.valor ?? '')}" aria-label="${modo === 'pct' ? 'Porcentaje' : 'Monto'}">
      ${ai > 0 ? `<button type="button" class="btn-icono" data-quitar-area="${li}:${ai}" aria-label="Quitar área">×</button>` : ''}</div>${modo === 'pct' ? '' : acumulador()}</div>`).join('')}
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-chico" data-mas-area="${li}">Agregar área</button>${modo === 'pct' ? `<button type="button" class="btn-sec btn-chico" data-sugerir="${li}">Sugerir % según ventas</button>` : ''}</div>
    ${ln.sugerencia ? `<p class="ayuda">${esc(ln.sugerencia)}</p>` : ''}
    <p class="sii-ok${rev.ok ? '' : ' dif-mal'}" id="sii-hint-${i}-${li}">${esc(rev.texto)}</p></div>`;
}

function listaDetalleSii(det) {
  if (!det || !det.length) return '<p class="ayuda">Este documento no tiene detalle de productos guardado. Pasa cuando se importó desde el Registro de Compras (.csv), que trae solo los totales.</p>';
  const total = det.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0);
  return `<div class="lista-detalle">${det.map(x => `<div class="fila-reparto"><span>${esc(x.descripcion)}<small>${x.cantidad ? `${esc(Sii.fmtCantidad(x.cantidad, x.unidad))} × ${pesos((parseFloat(x.monto) || 0) / (parseFloat(x.cantidad) || 1))}` : ''}${parseFloat(x.descuento) ? ` · dto. ${pesos(x.descuento)}` : ''}${x.item ? ' · ' + esc(x.item) : ''}${x.area ? ' · ' + esc(x.area) : ''}</small></span><b>${pesos(x.monto)}</b></div>`).join('')}
    <div class="fila-reparto total"><span>Total neto</span><b>${pesos(total)}</b></div></div>`;
}

function hintsSii(i) {
  const f = sii.facturas[i];
  f.lineas.forEach((ln, li) => { const el = $(`sii-hint-${i}-${li}`); if (!el) return; const r = Sii.revisarAreas(f, li); el.textContent = r.texto; el.classList.toggle('dif-mal', !r.ok); });
  const t = $('sii-total-' + i), r = Sii.revisarTotal(f);
  if (t && r) { t.textContent = r.texto; t.classList.toggle('dif-mal', !r.ok); }
}
const par = v => String(v).split(':');

function eventosTrabajoSii(cont) {
  cont.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'sii-buscar') { sii.busqueda = t.value; pintarDocsSii(); return; }
    const art = t.closest('.doc-sii'); if (!art) return;
    const i = +art.dataset.i, f = sii.facturas[i];
    if (t.dataset.lineaMonto !== undefined) { f.lineas[+t.dataset.lineaMonto].monto = parseFloat(t.value) || 0; hintsSii(i); }
    else if (t.dataset.areaValor !== undefined) { const [li, ai] = par(t.dataset.areaValor); f.lineas[+li].areas[+ai].valor = parseFloat(t.value) || 0; hintsSii(i); }
  });
  cont.addEventListener('change', e => {
    const t = e.target, art = t.closest('.doc-sii'); if (!art) return;
    const i = +art.dataset.i, f = sii.facturas[i];
    if (t.dataset.lineaItem !== undefined) { const ln = f.lineas[+t.dataset.lineaItem]; ln.item = t.value; ln.sugerencia = ''; repintarDocSii(i); }
    else if (t.dataset.detItem !== undefined || t.dataset.detArea !== undefined) {
      const campo = t.dataset.detItem !== undefined ? 'item' : 'area';
      const d = f.detalle[+(t.dataset.detItem ?? t.dataset.detArea)];
      d[campo] = t.value;
      // El área por producto solo vale para ítems que se reparten producto por producto
      if (campo === 'item') { const it = sii.items.find(x => x.item === d.item); if (!it || it.area !== 'SELECCIONAR') d.area = ''; }
      Sii.sincronizarLineasDesdeDetalle(f, sii.items); repintarDocSii(i);
    }
    else if (t.dataset.areaArea !== undefined) { const [li, ai] = par(t.dataset.areaArea); f.lineas[+li].areas[+ai].area = t.value; hintsSii(i); }
    else if (t.dataset.fecha !== undefined) f.fechaEstado = t.value;
  });
  cont.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('btn-info')) return;
    if (b.dataset.todas) { sii.facturas.forEach(f => Sii.ponerEstado(f, b.dataset.todas)); pintarDocsSii(); return; }
    if (b.hasAttribute('data-fecha-todas')) { const v = $('sii-fecha-lote').value; if (!v) { alert('Elige una fecha primero.'); return; } sii.facturas.forEach(f => { if (!f.yaImportada) f.fechaEstado = v; }); pintarDocsSii(); return; }
    if (b.hasAttribute('data-importar')) { importarSii(false); return; }
    if (b.hasAttribute('data-importar-nuevas')) { importarSii(true); return; }
    if (b.hasAttribute('data-cancelar-dup')) { sii.hint = ''; $('sii-import-hint').innerHTML = ''; return; }
    if (b.hasAttribute('data-sumar')) {
      const box = b.closest('.con-acum'), obj = box.querySelector('.objetivo'), suma = b.parentElement.querySelector('input');
      const n = parseFloat(suma.value) || 0; if (!n) { suma.focus(); return; }
      obj.value = (parseFloat(obj.value) || 0) + n; suma.value = ''; suma.focus();
      obj.dispatchEvent(new Event('input', { bubbles: true })); return;
    }
    const art = b.closest('.doc-sii'); if (!art) return;
    const i = +art.dataset.i, f = sii.facturas[i];
    if (b.dataset.estado) { Sii.ponerEstado(f, b.dataset.estado); repintarDocSii(i); }
    else if (b.hasAttribute('data-dividir')) { Sii.dividir(f); repintarDocSii(i); }
    else if (b.dataset.quitarLinea !== undefined) { f.lineas.splice(+b.dataset.quitarLinea, 1); repintarDocSii(i); }
    else if (b.dataset.modo) { const [li, m] = par(b.dataset.modo); f.lineas[+li].modoArea = m; repintarDocSii(i); }
    else if (b.dataset.masArea !== undefined) { Sii.agregarArea(f, +b.dataset.masArea); repintarDocSii(i); }
    else if (b.dataset.quitarArea !== undefined) { const [li, ai] = par(b.dataset.quitarArea); f.lineas[+li].areas.splice(+ai, 1); repintarDocSii(i); }
    else if (b.dataset.todoDet) {
      const campo = b.dataset.todoDet, primero = f.detalle.find(d => d[campo]);
      if (!primero) { alert(`Asigna primero ${campo === 'item' ? 'un ítem' : 'un área'} a algún producto.`); return; }
      // El área solo se copia a productos cuyo ítem se reparte producto por producto (SELECCIONAR)
      const pideArea = d => { const it = sii.items.find(x => x.item === d.item); return it && it.area === 'SELECCIONAR'; };
      f.detalle.forEach(d => { if (campo === 'item' || pideArea(d)) d[campo] = primero[campo]; });
      if (campo === 'item') f.detalle.forEach(d => { if (!pideArea(d)) d.area = ''; });
      Sii.sincronizarLineasDesdeDetalle(f, sii.items); repintarDocSii(i);
    }
    else if (b.dataset.sugerir !== undefined) sugerirSii(i, +b.dataset.sugerir, b);
    else if (b.hasAttribute('data-nota')) { f.editandoNota = true; repintarDocSii(i); const ta = $('sii-nota-txt-' + i); if (ta) ta.focus(); }
    else if (b.hasAttribute('data-nota-cancelar')) { f.editandoNota = false; repintarDocSii(i); }
    else if (b.hasAttribute('data-nota-guardar')) {
      const texto = $('sii-nota-txt-' + i).value.trim(); b.disabled = true;
      try { await Sii.notaDoc(f, texto); f.nota = texto; f.editandoNota = false; repintarDocSii(i); cargarHistorialSii(); }
      catch (er) { alert('La nota no se guardó: ' + (er.message || er)); b.disabled = false; }
    }
    else if (b.hasAttribute('data-descartar')) { f.coincidencias = null; repintarDocSii(i); }
    else if (b.dataset.vincular !== undefined) {
      const c = f.coincidencias[+b.dataset.vincular];
      if (!confirm(`¿Este documento es el gasto de ${c.items.filter(Boolean).join(' + ') || 'sin ítem'} del ${fechaSii(c.fecha)} (${pesos(c.total)})?\n\nAl gasto se le anota el RUT y el folio, y el documento queda como ya importado.`)) return;
      b.disabled = true;
      try { await Sii.vincular(f, c, 'vinc-' + Gastos.nuevaClave()); f.yaImportada = true; f.coincidencias = null;
        registrar('Vinculó un gasto con un documento del SII', `${f.razonSocial} F.${f.folio} · ${pesos(f.total)}`); repintarDocSii(i); cargarHistorialSii(); }
      catch (er) { alert(er.message || mensajeError(er)); b.disabled = false; }
    }
    else if (b.hasAttribute('data-ver-det')) {
      f.detalleAbierto = !f.detalleAbierto; repintarDocSii(i);
      if (f.detalleAbierto && f.detalleGuardado === undefined) {
        try { f.detalleGuardado = (await Sii.detalle(f.rut, f.folio, f.tipoDoc === '61' ? '61' : '')).detalle || []; } catch (er) { f.detalleGuardado = undefined; f.detalleAbierto = false; alert(er.message || er); }
        repintarDocSii(i);
      }
    }
  });
}

// Porcentajes según las ventas reales del mes anterior (como en la app de Gastos)
async function sugerirSii(i, li, b) {
  const f = sii.facturas[i], ln = f.lineas[li];
  const areas = (ln.areas || []).map(a => a.area).filter(Boolean);
  if (!areas.length) { ln.sugerencia = 'Elige primero las áreas.'; repintarDocSii(i); return; }
  b.disabled = true; b.textContent = 'Calculando…';
  try {
    const d = await Sii.ventas(), v = {};
    (d.areas || []).forEach(a => { if (areas.includes(a.area)) v[a.area] = a.total; });
    const total = Object.values(v).reduce((s, x) => s + x, 0);
    if (!total) ln.sugerencia = 'No hay ventas de esas áreas el mes anterior.';
    else {
      const pcts = areas.map(a => ({ area: a, pct: v[a] ? Math.round(v[a] / total * 100) : 0 }));
      const suma = pcts.reduce((s, p) => s + p.pct, 0); if (suma !== 100) pcts[0].pct += 100 - suma;
      ln.areas.forEach(a => { const p = pcts.find(x => x.area === a.area); if (p) a.valor = p.pct; });
      ln.sugerencia = `Ventas de ${d.mes}: ${pcts.map(p => `${p.area} ${p.pct}%`).join(' · ')}`;
    }
  } catch (e) { ln.sugerencia = 'No se pudo calcular: ' + (e.message || e); }
  repintarDocSii(i);
}

async function importarSii(omitir) {
  const hint = $('sii-import-hint'), btn = document.querySelector('[data-importar]');
  const { listas, problemas } = Sii.prepararParaImportar(sii.facturas, sii.items);
  if (problemas.length) { hint.innerHTML = `<div class="aviso aviso-rojo"><b>Revisa antes de importar:</b><ul>${problemas.slice(0, 8).map(p => `<li>${esc(p)}</li>`).join('')}</ul>${problemas.length > 8 ? `<span>…y ${problemas.length - 8} más</span>` : ''}</div>`; return; }
  if (!listas.length) { hint.innerHTML = '<p class="error">Ninguna factura tiene ítem todavía: clasifica al menos una.</p>'; return; }
  if (!omitir && !confirm(`¿Importar ${listas.length} ${listas.length === 1 ? 'documento' : 'documentos'} a Gastos?`)) return;
  // Misma clave solo para el mismo envío exacto (un reintento tras cortarse internet no duplica)
  const firma = JSON.stringify([listas, !!omitir]);
  if (!sii.idem || sii.firma !== firma) { sii.idem = 'sii-' + Gastos.nuevaClave(); sii.firma = firma; }
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }
  hint.innerHTML = '';
  try {
    const r = await Sii.importar(listas, omitir, sii.idem);
    sii.idem = null;
    listas.forEach(l => { const f = sii.facturas.find(x => Sii.clave(x) === Sii.clave(l)); if (f) f.yaImportada = true; });
    sii.hint = `<p class="sii-ok">Importado: ${r.facturas} ${r.facturas === 1 ? 'documento' : 'documentos'} · ${r.filas} ${r.filas === 1 ? 'línea' : 'líneas'} de gasto${r.vencimientos ? ` · ${r.vencimientos} ${r.vencimientos === 1 ? 'vencimiento' : 'vencimientos'}` : ''}${r.detalle ? ` · ${r.detalle} productos en Detalle Compras` : ''}</p>`;
    registrar('Importó documentos del SII', `${r.facturas} documento(s) · ${sii.nombre}`);
    pintarTrabajoSii(); cargarHistorialSii();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Importar las clasificadas'; }
    if (e.code === 'duplicados') {
      sii.idem = null;
      const d = e.datos || {}, dup = d.duplicados || [];
      hint.innerHTML = `<div class="aviso"><b>No se guardó nada todavía.</b> ${dup.length} ${dup.length === 1 ? 'documento ya estaba' : 'documentos ya estaban'} en Gastos:<ul>${dup.slice(0, 5).map(x => `<li>${esc(x.razonSocial)} F.${esc(x.folio)}</li>`).join('')}</ul>${dup.length > 5 ? `<span>…y ${dup.length - 5} más</span>` : ''}
        <div class="botones" style="justify-content:flex-start">${d.nuevas > 0 ? `<button type="button" class="btn-sec" data-importar-nuevas>Importar solo ${d.nuevas === 1 ? 'la nueva' : `las ${d.nuevas} nuevas`}</button>` : ''}<button type="button" class="btn-sec" data-cancelar-dup>Cancelar</button></div></div>`;
      return;
    }
    // Si se cortó a medias (o no hubo respuesta) se conserva la clave: repetir el mismo envío no duplica
    if (e.code && e.code !== 'en_curso' && e.code !== 'a_medias') sii.idem = null;
    hint.innerHTML = `<p class="error">${esc(e.message || mensajeError(e))}${e.code ? '' : ' Si vuelves a tocar Importar no se duplica.'}</p>`;
  }
}

// ── Historial de cargas ──
function pintarHistorialSii() {
  const cont = $('sii-hist'); if (!cont) return;
  const res = $('sii-hist-resumen');
  if (sii.errorCargas) {
    cont.innerHTML = `<div class="error">${esc(sii.errorCargas)}</div>${sii.errorCode === 'actualizar' || sii.errorCode === 'sin_url' ? '<p class="ayuda"><a href="#ajustes/conexiones">Ir a Conexiones</a></p>' : ''}`;
    return;
  }
  const C = sii.cargas || [];
  const incompletas = C.filter(c => (+c.total || 0) > (+c.importados || 0)).length;
  if (res) res.textContent = C.length ? (incompletas ? `${incompletas} con pendientes` : 'todas completas') : '';
  if (!C.length) { cont.innerHTML = '<div class="vacio">Aún no hay cargas. Sube un archivo del SII para empezar.</div>'; return; }
  const q = sii.histBusqueda.trim();
  if (q) {
    const r = Sii.buscarEnHistorial(C, q);
    cont.innerHTML = r.length ? `<p class="ayuda">${r.length} ${r.length === 1 ? 'documento' : 'documentos'} en ${new Set(r.map(x => x.carga.id)).size} ${new Set(r.map(x => x.carga.id)).size === 1 ? 'carga' : 'cargas'}</p>
      <div data-colapsar="8">${r.map(({ doc: d, carga }) => `<div class="fila-caja"><div class="txt"><b>${esc(d.razonSocial || 'Documento')}</b><span>N° ${esc(d.folio)} · ${esc(d.rut)} · ${d.importado ? 'en Gastos' : 'pendiente'} · carga del ${esc(fechaSii(carga.desde))}</span>${d.nota ? `<span class="nota">${esc(d.nota)}</span>` : ''}</div>
        <div class="acciones">${d.tieneDetalle ? `<button type="button" class="btn-sec btn-chico" data-detalle="${esc(d.rut)}|${esc(d.folio)}|${esc(d.tipo || '')}">Detalle</button>` : ''}<button type="button" class="btn-sec btn-chico" data-ir-carga="${esc(carga.id)}">Ir a la carga</button></div></div>`).join('')}</div>`
      : `<div class="vacio">Ningún documento coincide con "${esc(q)}".</div>`;
    colapsar(cont);
    return;
  }
  const meses = {};
  C.forEach(c => { const k = String(c.desde || c.fechaCarga || '').slice(0, 7) || 'sin-fecha'; (meses[k] = meses[k] || []).push(c); });
  const claves = Object.keys(meses).sort().reverse();
  if (!sii.mesesInit) { sii.mesesInit = true; if (claves.length) sii.meses.add(claves[0]); }
  cont.innerHTML = claves.map(k => {
    const g = meses[k], m = /^(\d{4})-(\d{2})$/.exec(k);
    const nombre = m ? `${MESES_LARGOS[+m[2] - 1].replace(/^./, x => x.toUpperCase())} ${m[1]}` : 'Sin fecha';
    const docs = g.reduce((s, c) => s + (+c.total || 0), 0), pend = g.reduce((s, c) => s + Math.max(0, (+c.total || 0) - (+c.importados || 0)), 0);
    return `<details class="mes-sii" data-mes="${esc(k)}" ${sii.meses.has(k) ? 'open' : ''}><summary><b>${esc(nombre)}</b><span>${g.length} ${g.length === 1 ? 'carga' : 'cargas'} · ${docs} doc.${pend ? ` · ${pend} por importar` : ''}</span></summary>${g.map(tarjetaCargaSii).join('')}</details>`;
  }).join('');
}

function tarjetaCargaSii(c) {
  const total = +c.total || 0, faltan = Math.max(0, total - (+c.importados || 0)), completa = !faltan;
  const periodo = c.desde ? (c.desde === c.hasta || !c.hasta ? fechaSii(c.desde) : `${fechaSii(c.desde)} al ${fechaSii(c.hasta)}`) : 'Sin fecha';
  const fmt = Sii.formatoDeArchivo(c.nombreArchivo);
  return `<div class="carga-sii" id="sii-carga-${esc(c.id)}">
    <div class="titulo-fila"><b>${esc(periodo)}</b><span class="chip ${completa ? 'c-verde' : 'c-amarillo'} chip-chico">${completa ? 'Completa' : `Faltan ${faltan}`}</span></div>
    <p class="ayuda"><span class="chip ${fmt.color} chip-chico">${fmt.etiqueta}</span> ${fmt.nota ? esc(fmt.nota) + ' · ' : ''}${esc(c.nombreArchivo || '')}<br>${total} ${total === 1 ? 'documento' : 'documentos'} · ${+c.importados || 0} en Gastos${c.enDuda ? ` · ${c.enDuda} en duda` : ''} · subida el ${esc(fechaSii(c.fechaCarga))}</p>
    ${sii.notaCarga === c.id ? `<div class="bloque-sii"><label class="etiqueta" for="sii-nota-carga">Nota de la carga</label><textarea id="sii-nota-carga" rows="2" maxlength="1000" placeholder="Ej: alcancé hasta el folio 200, el resto queda para el lunes">${esc(c.nota || '')}</textarea>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-chico" data-guardar-nota-carga="${esc(c.id)}">Guardar nota</button><button type="button" class="btn-sec btn-chico" data-cancelar-nota-carga>Cancelar</button></div></div>`
      : c.nota ? `<p class="nota-carga">${esc(c.nota)}</p>` : ''}
    ${(c.documentos || []).length ? `<details class="docs-carga" data-docs="${esc(c.id)}" ${sii.docs.has(c.id) ? 'open' : ''}><summary>Ver los ${c.documentos.length} documentos</summary>
      ${c.documentos.map(d => `<div class="fila-caja"><div class="txt"><b>${esc(d.razonSocial || 'Documento')}</b><span>N° ${esc(d.folio)}${d.importado ? ' · en Gastos' : ' · pendiente'}</span>${d.nota ? `<span class="nota">${esc(d.nota)}</span>` : ''}</div>
        ${d.tieneDetalle ? `<div class="acciones"><button type="button" class="btn-sec btn-chico" data-detalle="${esc(d.rut)}|${esc(d.folio)}|${esc(d.tipo || '')}">Detalle</button></div>` : ''}</div>`).join('')}</details>` : ''}
    <div class="botones" style="justify-content:flex-start">
      ${c.url ? `<button type="button" class="btn-sec btn-chico" data-reabrir="${esc(c.id)}">${completa ? 'Revisar carga' : 'Reabrir carga'}</button><a class="btn-sec btn-chico btn-enlace" href="${esc(c.url)}" target="_blank" rel="noopener">Archivo en Drive</a>` : ''}
      <button type="button" class="btn-sec btn-chico" data-nota-carga="${esc(c.id)}">${c.nota ? 'Editar nota' : 'Nota'}</button>
      <button type="button" class="btn-sec btn-chico btn-peligro" data-quitar-carga="${esc(c.id)}" data-periodo="${esc(periodo)}">Quitar del historial</button>
    </div></div>`;
}

function eventosHistorialSii(cont) {
  cont.addEventListener('toggle', e => {
    const d = e.target; if (!(d instanceof HTMLDetailsElement)) return;
    const set = d.dataset.mes !== undefined ? sii.meses : d.dataset.docs !== undefined ? sii.docs : null;
    const k = d.dataset.mes ?? d.dataset.docs; if (!set) return;
    if (d.open) set.add(k); else set.delete(k);
  }, true);
  cont.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('btn-info')) return;
    if (b.dataset.detalle) { const [rut, folio, tipo] = b.dataset.detalle.split('|'); verDetalleSii(rut, folio, tipo); }
    else if (b.dataset.irCarga) {
      const c = (sii.cargas || []).find(x => x.id === b.dataset.irCarga); if (!c) return;
      sii.histBusqueda = ''; $('sii-hist-buscar').value = '';
      sii.meses.add(String(c.desde || c.fechaCarga || '').slice(0, 7) || 'sin-fecha'); sii.docs.add(c.id);
      pintarHistorialSii(); const el = $('sii-carga-' + c.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    else if (b.dataset.reabrir) {
      const msg = $('sii-msg'); b.disabled = true; b.textContent = 'Abriendo…';
      try {
        const r = await Sii.archivo(b.dataset.reabrir);
        await procesarSii(r.contenido, r.nombre || 'archivo del SII');
        const t = $('sii-trabajo'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (er) { if (msg) msg.textContent = er.message || mensajeError(er); }
      pintarHistorialSii();
    }
    else if (b.dataset.notaCarga) { sii.notaCarga = b.dataset.notaCarga; pintarHistorialSii(); const t = $('sii-nota-carga'); if (t) t.focus(); }
    else if (b.hasAttribute('data-cancelar-nota-carga')) { sii.notaCarga = null; pintarHistorialSii(); }
    else if (b.dataset.guardarNotaCarga) {
      const nota = $('sii-nota-carga').value.trim(); b.disabled = true;
      try { await Sii.notaCarga(b.dataset.guardarNotaCarga, nota); const c = sii.cargas.find(x => x.id === b.dataset.guardarNotaCarga); if (c) c.nota = nota; sii.notaCarga = null; pintarHistorialSii(); }
      catch (er) { alert('La nota no se guardó: ' + (er.message || er)); b.disabled = false; }
    }
    else if (b.dataset.quitarCarga) {
      if (!confirm(`¿Quitar del historial la carga del ${b.dataset.periodo}?\n\nNo se borra nada: los gastos importados quedan igual, el archivo sigue en Drive y en la planilla la carga queda marcada como quitada. Si vuelves a subir ese mismo archivo, reaparece.`)) return;
      b.disabled = true;
      try { await Sii.quitarCarga(b.dataset.quitarCarga); registrar('Quitó una carga del SII del historial', b.dataset.periodo); await cargarHistorialSii(); }
      catch (er) { alert(er.message || mensajeError(er)); b.disabled = false; }
    }
  });
}

async function verDetalleSii(rut, folio, tipo) {
  const d = dialogo(`<div class="form-dialogo"><h2 id="sii-det-titulo">Detalle del documento</h2><p class="ayuda" id="sii-det-sub">N° ${esc(folio)}</p><div id="sii-det-lista"><p class="ayuda">Cargando…</p></div>
    <div class="botones"><button type="button" class="btn-sec" data-cerrar>Cerrar</button></div></div>`);
  d.querySelector('[data-cerrar]').onclick = () => d.close();
  try {
    const r = await Sii.detalle(rut, folio, tipo);
    if (!d.open) return;
    if (r.razonSocial) d.querySelector('#sii-det-titulo').textContent = r.razonSocial;
    d.querySelector('#sii-det-sub').textContent = `N° ${r.folio || folio}${r.fecha ? ' · ' + fechaSii(Caja.normalizarFechaCaja(r.fecha) || r.fecha) : ''}`;
    d.querySelector('#sii-det-lista').innerHTML = listaDetalleSii(r.detalle);
  } catch (e) { if (d.open) d.querySelector('#sii-det-lista').innerHTML = `<p class="error">${esc(e.message || mensajeError(e))}</p>`; }
}

// ── Gastos · v0.10.0: anular vencimientos, obligaciones, registrados, análisis e ítems ──
const errorGastos = (el, e) => { el.innerHTML = `<div class="error">${esc(e.message || mensajeError(e))}</div>${e.code === 'sin_url' || e.code === 'actualizar' ? '<p class="ayuda"><a href="#ajustes/conexiones">Ir a Conexiones</a></p>' : ''}`; };
const cabGastos = sub => `<div class="cabecera"><div><h1 id="t-gastos">Gastos</h1><p>Todo lo de la app de Gastos, aquí</p></div>${pestanasGastos(sub)}</div>`;
const fechaIso = iso => (iso ? fechaCaja(iso) : '—');
const FRECUENCIAS = { mensual_dia: 'Mensual (día fijo)', mensual_ultimo: 'Mensual (último día)', quincenal: 'Quincenal (días 1 y 15)', variable: 'Fecha específica', cuponera: 'Cuponera / cuotas' };

// Diálogo con motivo obligatorio. Devuelve el texto o null si se cancela.
function pedirMotivo(titulo, detalleHtml, boton) {
  return new Promise(ok => {
    const d = dialogo(`<form class="form-dialogo" novalidate><h2>${esc(titulo)}</h2>${detalleHtml}
      <div class="campo"><label for="mt-txt">Motivo</label><input id="mt-txt" type="text" maxlength="300" placeholder="Ej: factura duplicada"></div>
      <div class="error" id="mt-error" role="alert"></div>
      <div class="botones"><button type="button" class="btn-sec" id="mt-no">Cancelar</button><button type="submit" class="btn btn-peligro-lleno" id="mt-si">${esc(boton)}</button></div></form>`);
    let listo = false;
    d.querySelector('#mt-no').onclick = () => d.close();
    d.addEventListener('close', () => { if (!listo) ok(null); });
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const t = d.querySelector('#mt-txt').value.trim();
      if (t.length < 3) { d.querySelector('#mt-error').textContent = 'Escribe el motivo (queda guardado).'; return; }
      listo = true; d.close(); ok(t);
    });
  });
}

async function anularVencimientoUI(v) {
  const motivo = await pedirMotivo('Anular vencimiento', `<p class="ayuda"><b>${esc(v.nombre)}</b> · vence ${esc(fechaCaja(v.fecha))}${montoV(v) ? ' · ' + esc(pesos(montoV(v))) : ''}</p>
    <p class="ayuda">No se borra: queda como ANULADO en la hoja Vencimientos, con el motivo, y deja de aparecer y de avisar por correo. Úsalo cuando ese pago no corresponde (por ejemplo, un mes que no se cobró). La obligación sigue generando los meses siguientes.</p>`, 'Anular');
  if (!motivo) return;
  try { await Gastos.anularVencimiento(v.id, motivo); registrar('Anuló un vencimiento', `${v.nombre} · ${fechaCaja(v.fecha)} · ${motivo}`); refrescarAgenda(); }
  catch (e) { alert(e.message || mensajeError(e)); }
}

// ── Obligaciones (reglas) ──
async function pintarObligaciones(el, sub, d) {
  el.innerHTML = cabGastos(sub) + `<div class="tarjeta"><div class="vacio" style="border:0">Cargando obligaciones…</div></div>`;
  let P;
  try { P = (await Gastos.plantillas()).plantillas || []; } catch (e) { errorGastos(el.querySelector('.tarjeta'), e); return; }
  if (vistaDesdeHash() !== 'gastos' || subVista() !== 'obligaciones') return;
  const activas = P.filter(p => p.estado === 'ACTIVA').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const archivadas = P.filter(p => p.estado !== 'ACTIVA').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const detalle = p => [FRECUENCIAS[p.frecuencia] || p.frecuencia, p.frecuencia === 'mensual_dia' && p.dia ? 'día ' + p.dia : '', p.frecuencia === 'variable' && p.fechaEsp ? fechaIso(p.fechaEsp) : '',
    Number(p.montoEstimado) ? pesos(Number(p.montoEstimado)) + ' est.' : 'sin monto estimado', p.item ? p.item : '', p.area === 'PRORRATEADO' ? [[p.pArea1, p.pPct1], [p.pArea2, p.pPct2], [p.pArea3, p.pPct3]].filter(x => x[0]).map(x => `${x[0]} ${x[1]}%`).join(' · ') : p.area === 'MULTI' ? (p.multiArea || []).map(a => a.area).join(' + ') : p.area].filter(Boolean).map(esc).join(' · ');
  const fila = (p, activa) => `<div class="fila-caja"><div class="txt"><b>${esc(p.nombre)}</b><span>${detalle(p)}</span>${activa && p.proximaFecha ? `<span>Próxima: ${esc(fechaIso(p.proximaFecha))}</span>` : ''}${p.obs ? `<span class="nota">${esc(p.obs)}</span>` : ''}</div>
    <div class="acciones"><button type="button" class="btn-sec btn-chico" data-editar-obl="${esc(p.id)}">Editar</button><button type="button" class="btn-sec btn-chico" data-archivar-obl="${esc(p.id)}" data-archivar="${activa ? '1' : ''}">${activa ? 'Archivar' : 'Reactivar'}</button></div></div>`;
  const hoy = new Date();
  el.innerHTML = cabGastos(sub) + `
    <section class="tarjeta" aria-labelledby="t-obl"><div class="titulo-fila"><h2 id="t-obl">Obligaciones activas ${info('Obligaciones', 'Son las reglas que crean los vencimientos: arriendo, luz, sueldos, cuotas… Cada una genera su vencimiento 3 días antes de la fecha y aparece en Vencimientos para pagarlo.\nArchivar deja de generar vencimientos nuevos; lo ya generado y pagado queda igual. Reactivar vuelve a generar desde hoy (no los meses que pasaron).\nEn Sistema Fën no se borran: se archivan.')}</h2>
      <button type="button" class="btn" id="obl-nueva">${icono('mas', 16)} Nueva obligación</button></div>
      <div data-colapsar="12">${activas.map(p => fila(p, true)).join('') || '<div class="vacio">No hay obligaciones activas.</div>'}</div></section>
    ${archivadas.length ? `<section class="tarjeta" aria-labelledby="t-obl-arch"><div class="titulo-fila"><h2 id="t-obl-arch">Archivadas</h2><span>${archivadas.length}</span></div><div data-colapsar="3">${archivadas.map(p => fila(p, false)).join('')}</div></section>` : ''}
    <section class="tarjeta" aria-labelledby="t-hist-pagos"><div class="titulo-fila"><h2 id="t-hist-pagos">Historial de pagos ${info('Historial de pagos', 'Los vencimientos pagados, con su fecha de pago y monto real. Vencimientos muestra solo los pagados de los últimos 7 días; aquí están todos.')}</h2></div>
      <div class="filtros"><select id="hp-mes" aria-label="Mes">${MESES_LARGOS.map((m, i) => `<option value="${i + 1}" ${i === hoy.getMonth() ? 'selected' : ''}>${m.replace(/^./, c => c.toUpperCase())}</option>`).join('')}</select>
        <select id="hp-anio" aria-label="Año">${[0, 1, 2].map(k => `<option>${hoy.getFullYear() - k}</option>`).join('')}</select>
        <button type="button" class="btn-sec" id="hp-ver">Ver</button><button type="button" class="btn-sec" id="hp-todo">Ver todo</button></div>
      <div id="hp-lista"></div></section>`;
  colapsar(el);
  $('obl-nueva').onclick = () => abrirObligacion(null, d);
  el.querySelectorAll('[data-editar-obl]').forEach(b => b.onclick = () => abrirObligacion(P.find(p => p.id === b.dataset.editarObl), d));
  el.querySelectorAll('[data-archivar-obl]').forEach(b => b.onclick = async () => {
    const p = P.find(x => x.id === b.dataset.archivarObl), archivar = !!b.dataset.archivar;
    if (!confirm(archivar ? `¿Archivar "${p.nombre}"?\n\nDeja de generar vencimientos nuevos. Los ya generados y el historial quedan igual.` : `¿Reactivar "${p.nombre}"?\n\nVuelve a generar vencimientos desde hoy.`)) return;
    b.disabled = true;
    try { await Gastos.archivarObligacion(p.id, archivar); registrar(archivar ? 'Archivó una obligación' : 'Reactivó una obligación', p.nombre); pintarGastos('obligaciones'); }
    catch (e) { alert(e.message || mensajeError(e)); b.disabled = false; }
  });
  const verHist = async filtro => {
    const cont = $('hp-lista'); cont.innerHTML = '<p class="ayuda">Cargando…</p>';
    try {
      const h = (await Gastos.historialPagos(filtro)).historial || [];
      cont.innerHTML = h.length ? `<div data-colapsar="10">${h.map(v => `<div class="fila-caja"><div class="txt"><b>${esc(v.nombre)}</b><span>Pagado el ${esc(fechaIso(v.fechaPago))}${v.area && v.area !== 'MULTI' && v.area !== 'PRORRATEADO' ? ' · ' + esc(v.area) : ''}${v.urlComprobante ? ` · <a href="${esc(v.urlComprobante)}" target="_blank" rel="noopener">comprobante</a>` : ''}</span></div>
        <div class="acciones"><span class="chip c-verde">${esc(pesos(Number(String(v.montoPago).replace(/[^0-9-]/g, '')) || 0))}</span></div></div>`).join('')}</div>
        <p class="ayuda">${h.length} ${h.length === 1 ? 'pago' : 'pagos'} · ${esc(pesos(h.reduce((s, v) => s + (Number(String(v.montoPago).replace(/[^0-9-]/g, '')) || 0), 0)))}</p>` : '<div class="vacio">Sin pagos en ese período.</div>';
      colapsar(cont);
    } catch (e) { errorGastos(cont, e); }
  };
  $('hp-ver').onclick = () => verHist({ mes: +$('hp-mes').value, anio: +$('hp-anio').value });
  $('hp-todo').onclick = () => verHist({});
  verHist({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
}

function abrirObligacion(p, d) {
  const items = d.itemsSii || d.items || [];
  const it0 = p && p.item ? items.find(i => i.item === p.item) : null;
  const selArea = (c, v) => `<select class="${c}" aria-label="Área"><option value="">Área</option>${AREAS_GASTO.map(a => `<option ${a === v ? 'selected' : ''}>${a}</option>`).join('')}</select>`;
  const dlg = dialogo(`<form class="form-dialogo form-obl" novalidate>
    <h2>${p ? 'Editar obligación' : 'Nueva obligación'}</h2>
    <div class="campo"><label for="ob-nombre">Nombre</label><input id="ob-nombre" type="text" maxlength="80" value="${esc(p ? p.nombre : '')}" placeholder="Ej: Arriendo sala producción"></div>
    <div class="campo"><label for="ob-item">Ítem de gasto ${info('Ítem', 'Al pagar, el gasto se registra con este ítem (categoría, tipo y área salen del ítem). Si el ítem se reparte entre áreas, aquí defines cómo; al pagar puedes ajustar los montos del mes.\nSin ítem, la obligación solo avisa.')}</label>
      <select id="ob-item"><option value="">Sin ítem</option>${items.map(i => `<option value="${esc(i.item)}" ${p && p.item === i.item ? 'selected' : ''}>${esc(i.item)}</option>`).join('')}${p && p.item && !it0 ? `<option selected value="${esc(p.item)}">${esc(p.item)} (ya no está en la lista)</option>` : ''}</select></div>
    <div id="ob-areas"></div>
    <div class="grilla-montos"><div class="campo"><label for="ob-frec">Frecuencia</label><select id="ob-frec">${p ? '' : '<option value="">Elige</option>'}${Object.entries(FRECUENCIAS).filter(([k]) => !p || (k === 'cuponera') === (p.frecuencia === 'cuponera')).map(([k, t]) => `<option value="${k}" ${p && p.frecuencia === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="campo" id="ob-c-dia"><label for="ob-dia">Día del mes</label><input id="ob-dia" type="number" min="1" max="31" step="1" value="${esc(p ? p.dia : '')}"></div>
      <div class="campo" id="ob-c-fecha"><label for="ob-fecha">Fecha</label><input id="ob-fecha" type="date" value="${esc(p ? p.fechaEsp : '')}"></div></div>
    <div id="ob-c-cuotas" class="campo"><span class="etiqueta">Cuotas ${info('Cuponera', 'Cada cuota crea su vencimiento de inmediato, con su fecha y monto. Una cuponera ya creada no cambia sus cuotas aquí: si una cuota no corresponde, anúlala en Vencimientos.')}</span>
      ${p ? '<p class="ayuda">Las cuotas de esta cuponera ya están creadas: para cambiar una, anúlala en Vencimientos.</p>' : `<div id="ob-cuotas"></div><button type="button" class="btn-sec btn-chico" id="ob-mas-cuota">Agregar cuota</button>`}</div>
    <div class="grilla-montos"><div class="campo"><label for="ob-monto">Monto estimado (opcional)</label><input id="ob-monto" type="number" inputmode="numeric" min="0" step="1" value="${esc(p ? p.montoEstimado : '')}"></div>
      <div class="campo"><span class="etiqueta">Tipo de monto al pagar</span><div class="chips" role="radiogroup" aria-label="Tipo de monto">${[['', 'Sin definir'], ['bruto', 'Bruto'], ['neto', 'Neto'], ['siniva', 'Sin IVA']].map(([k, t]) => `<label class="chip-radio"><input type="radio" name="ob-tipo" value="${k}" ${(p ? p.tipoMonto || '' : '') === k ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div></div>
    <div class="campo"><label for="ob-obs">Observación (opcional)</label><input id="ob-obs" type="text" maxlength="300" value="${esc(p ? p.obs : '')}"></div>
    <div class="error" id="ob-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="ob-cancelar">Cancelar</button><button type="submit" class="btn" id="ob-guardar">Guardar</button></div></form>`);
  const q = s => dlg.querySelector(s);
  const pintarAreas = conservar => {
    const it = items.find(i => i.item === q('#ob-item').value), c = q('#ob-areas');
    if (!it) { c.innerHTML = ''; return; }
    if (it.area === 'SELECCIONAR') {
      const filas = conservar && p && p.multiArea && p.multiArea.length ? p.multiArea : [{}];
      c.innerHTML = `<div class="campo"><span class="etiqueta">Monto por área</span><div id="ob-multi">${filas.map(a => filaArea('ob', a.area || '', a.monto || '')).join('')}</div><button type="button" class="btn-sec btn-chico" id="ob-mas-area">Agregar área</button></div>`;
    } else if (it.area === 'PRORRATEADO') {
      const v = conservar && p ? [[p.pArea1, p.pPct1], [p.pArea2, p.pPct2], [p.pArea3, p.pPct3]] : [[], [], []];
      c.innerHTML = `<div class="campo"><span class="etiqueta">Reparto por área (%)</span>${v.map((x, k) => `<div class="fila-area">${selArea('ob-pa' + (k + 1), x[0] || '')}<input class="ob-pp${k + 1}" type="number" min="0" max="100" step="1" placeholder="%" value="${esc(x[1] || '')}" aria-label="Porcentaje área ${k + 1}">${k === 2 ? '<span class="ayuda">opcional</span>' : ''}</div>`).join('')}
        <button type="button" class="btn-sec btn-chico" id="ob-sugerir">Sugerir % según ventas</button><span class="ayuda" id="ob-sug"></span></div>`;
    } else c.innerHTML = `<p class="ayuda">${[it.categoria, it.tipo, it.subTipo].filter(Boolean).map(esc).join(' · ')} · Área ${esc(it.area)}</p>`;
  };
  const pintarFrec = () => { const f = q('#ob-frec').value; q('#ob-c-dia').classList.toggle('oculto', f !== 'mensual_dia'); q('#ob-c-fecha').classList.toggle('oculto', f !== 'variable'); q('#ob-c-cuotas').classList.toggle('oculto', f !== 'cuponera'); };
  const filaCuota = () => `<div class="fila-area"><input type="date" class="ob-cf" aria-label="Fecha de la cuota"><input type="number" class="ob-cm" min="0" step="1" placeholder="$" aria-label="Monto de la cuota"><button type="button" class="btn-icono" data-quitar-area aria-label="Quitar cuota">×</button></div>`;
  if (!p) { q('#ob-cuotas').innerHTML = filaCuota() + filaCuota(); q('#ob-mas-cuota').onclick = () => q('#ob-cuotas').insertAdjacentHTML('beforeend', filaCuota()); }
  pintarAreas(true); pintarFrec();
  q('#ob-item').addEventListener('change', () => pintarAreas(false));
  q('#ob-frec').addEventListener('change', pintarFrec);
  dlg.addEventListener('click', async e => {
    if (e.target.closest('[data-quitar-area]')) { const f = e.target.closest('.fila-area'); if (f.parentElement.children.length > 1) f.remove(); }
    else if (e.target.closest('#ob-mas-area')) q('#ob-multi').insertAdjacentHTML('beforeend', filaArea('ob'));
    else if (e.target.closest('#ob-sugerir')) {
      const areas = [1, 2, 3].map(k => q('.ob-pa' + k).value).filter(Boolean), s = q('#ob-sug');
      if (areas.length < 2) { s.textContent = 'Elige primero las áreas.'; return; }
      s.textContent = 'Calculando…';
      try {
        const v = await Sii.ventas(), m = {}; (v.areas || []).forEach(a => { if (areas.includes(a.area)) m[a.area] = a.total; });
        const tot = Object.values(m).reduce((a, b) => a + b, 0);
        if (!tot) { s.textContent = 'No hay ventas de esas áreas el mes anterior.'; return; }
        const pc = areas.map(a => Math.round((m[a] || 0) / tot * 100)); pc[0] += 100 - pc.reduce((a, b) => a + b, 0);
        [1, 2, 3].forEach(k => { const a = q('.ob-pa' + k).value, i = areas.indexOf(a); if (a && i > -1) q('.ob-pp' + k).value = pc[i]; });
        s.textContent = `Ventas de ${v.mes}`;
      } catch (er) { s.textContent = 'No se pudo calcular: ' + (er.message || er); }
    }
  });
  q('#ob-cancelar').onclick = () => dlg.close();
  let idem = 'obl-' + Gastos.nuevaClave();
  q('form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = q('#ob-error'); err.textContent = '';
    const datos = { id: p ? p.id : '', nombre: q('#ob-nombre').value.trim(), item: q('#ob-item').value, frecuencia: q('#ob-frec').value, dia: q('#ob-dia').value, fechaEsp: q('#ob-fecha').value,
      montoEstimado: q('#ob-monto').value, tipoMonto: (q('input[name="ob-tipo"]:checked') || {}).value || '', obs: q('#ob-obs').value.trim() };
    if (!datos.nombre || !datos.frecuencia) { err.textContent = 'Completa el nombre y la frecuencia.'; return; }
    const it = items.find(i => i.item === datos.item);
    if (it && it.area === 'SELECCIONAR') datos.multiArea = [...dlg.querySelectorAll('#ob-multi .fila-area')].map(f => ({ area: f.querySelector('.ob-area').value, monto: Number(f.querySelector('.ob-monto').value) || 0 })).filter(a => a.area && a.monto > 0);
    if (it && it.area === 'PRORRATEADO') [1, 2, 3].forEach(k => { datos['pArea' + k] = q('.ob-pa' + k).value; datos['pPct' + k] = q('.ob-pp' + k).value; });
    if (!p && datos.frecuencia === 'cuponera') datos.cuotas = [...dlg.querySelectorAll('#ob-cuotas .fila-area')].map(f => ({ fecha: f.querySelector('.ob-cf').value, monto: f.querySelector('.ob-cm').value })).filter(c => c.fecha);
    const b = q('#ob-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      await Gastos.guardarObligacion(datos, idem);
      registrar(p ? 'Editó una obligación' : 'Creó una obligación', `${datos.nombre} · ${FRECUENCIAS[datos.frecuencia]}`);
      dlg.close(); pintarGastos('obligaciones');
    } catch (er) {
      if (er.code && er.code !== 'en_curso') idem = 'obl-' + Gastos.nuevaClave();
      err.textContent = er.message || mensajeError(er); b.disabled = false; b.textContent = 'Guardar';
    }
  });
}

// ── Gastos registrados ──
const reg = { busqueda: '', mes: '', forma: 'todos' };
const mesDe = g => (g.fecha || '').slice(0, 7);
const estadoPagoG = g => {
  if (g.formaPago !== 'tarjeta' && g.formaPago !== 'proveedor') return { t: 'Pagado', c: 'c-verde' };
  if (g.estadoVencimiento === 'PAGADO') return { t: 'Pagado', c: 'c-verde' };
  if (!g.estadoVencimiento) return { t: 'A crédito', c: 'c-gris' };
  if (g.estadoVencimiento === 'ANULADO') return { t: 'Vencimiento anulado', c: 'c-gris' };
  if (g.estadoVencimiento === 'VENCIDA') return { t: 'Vencida', c: 'c-rojo' };
  return { t: 'Por pagar', c: 'c-amarillo' };
};
// Líneas de la misma compra: mismo día y la misma boleta (foto) o el mismo documento del SII.
// Sin boleta ni folio no se agrupa (dos pagos de obligaciones del mismo día no son una compra).
const mismaCompra = (a, b) => a.fecha === b.fecha && a.formaPago === b.formaPago &&
  ((a.urlFoto && a.urlFoto === b.urlFoto && a.hora === b.hora) || (a.folio && a.rut === b.rut && a.folio === b.folio && a.esNC === b.esNC));

async function pintarRegistrados(el, sub, d) {
  el.innerHTML = cabGastos(sub) + `<div class="tarjeta"><div class="vacio" style="border:0">Cargando gastos…</div></div>`;
  let L;
  try { L = (await Gastos.lista()).gastos || []; } catch (e) { errorGastos(el.querySelector('.tarjeta'), e); return; }
  if (vistaDesdeHash() !== 'gastos' || subVista() !== 'registrados') return;
  L = L.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || '') || a.fila - b.fila);
  const meses = [...new Set(L.map(mesDe))].sort().reverse();
  el.innerHTML = cabGastos(sub) + `
    <section class="tarjeta" aria-labelledby="t-reg"><div class="titulo-fila"><h2 id="t-reg">Gastos registrados ${info('Gastos registrados', 'Cada fila de la planilla Registro Gasto: una por ítem y área. Corregir cambia fecha, ítem, área, monto u observación (el neto se recalcula).\nAnular no borra: la fila pasa a la pestaña "Gastos anulados" de la planilla, con fecha, quién y motivo, y deja de sumar en todos lados (análisis, Looker, prorrateo).\nSi la compra tiene varias líneas (áreas o ítems), puedes anular toda la compra de una vez.\nSe muestran desde el 1 de enero del año pasado.')}</h2><span id="reg-cuenta"></span></div>
      <div class="filtros"><input id="reg-buscar" type="search" placeholder="Buscar ítem, área, monto, proveedor, folio u observación" value="${esc(reg.busqueda)}" aria-label="Buscar">
        <select id="reg-mes" aria-label="Mes"><option value="">Todos los meses</option>${meses.map(m => `<option value="${m}" ${reg.mes === m ? 'selected' : ''}>${MESES_LARGOS[+m.slice(5) - 1].replace(/^./, c => c.toUpperCase())} ${m.slice(0, 4)}</option>`).join('')}</select>
        <div class="chips chips-chicos" role="group" aria-label="Forma de pago">${[['todos', 'Todos'], ['credito', 'A crédito'], ['por_pagar', 'Por pagar']].map(([k, t]) => `<button type="button" class="chip-filtro" data-forma="${k}" aria-pressed="${reg.forma === k}">${t}</button>`).join('')}</div></div>
      <div id="reg-lista"></div></section>`;
  const pintarLista = () => {
    const q = reg.busqueda.trim().toLowerCase(), qn = q.replace(/[^0-9]/g, '');
    const F = L.filter(g => (!reg.mes || mesDe(g) === reg.mes)
      && (reg.forma === 'todos' || (reg.forma === 'credito' ? (g.formaPago === 'tarjeta' || g.formaPago === 'proveedor') : ['Por pagar', 'Vencida'].includes(estadoPagoG(g).t)))
      && (!q || [g.item, g.area, g.obs, g.razonSocial, g.rut, g.folio, fechaIso(g.fecha)].join(' ').toLowerCase().includes(q) || (qn.length >= 3 && String(Math.abs(g.monto)).includes(qn))));
    $('reg-cuenta').textContent = `${F.length} ${F.length === 1 ? 'línea' : 'líneas'} · ${pesos(F.reduce((s, g) => s + g.monto, 0))}`;
    const cont = $('reg-lista');
    cont.innerHTML = F.length ? `<div data-colapsar="25">${F.map(g => { const e = estadoPagoG(g);
      return `<div class="fila-caja" data-fila="${g.fila}"><div class="txt"><b>${esc(g.item)}</b>
        <span>${esc(fechaIso(g.fecha))} · ${esc(g.area)}${g.formaPago && g.formaPago !== 'contado' ? ' · ' + (g.formaPago === 'tarjeta' ? 'tarjeta' : 'crédito proveedor') : ''}${g.vencimiento && e.t !== 'Pagado' ? ' · vence ' + esc(fechaIso(g.vencimiento)) : ''}</span>
        ${g.razonSocial || g.folio ? `<span>${esc(g.razonSocial || g.rut)}${g.folio ? ` · ${g.esNC ? 'NC' : 'F.'} ${esc(g.folio)}` : ''}</span>` : ''}${g.obs ? `<span class="nota">${esc(g.obs)}</span>` : ''}</div>
        <div class="acciones"><span class="chip ${e.c} chip-chico">${e.t}</span><span class="chip c-gris">${esc(pesos(g.monto))}</span>
          ${g.urlFoto ? `<a class="btn-sec btn-chico btn-enlace" href="${esc(g.urlFoto)}" target="_blank" rel="noopener">Boleta</a>` : ''}
          ${g.rut && g.folio ? `<button type="button" class="btn-sec btn-chico" data-det-g="${g.fila}">Detalle</button>` : ''}
          <button type="button" class="btn-sec btn-chico" data-corregir="${g.fila}">Corregir</button><button type="button" class="btn-sec btn-chico btn-peligro" data-anular-g="${g.fila}">Anular</button></div></div>`; }).join('')}</div>`
      : '<div class="vacio">No hay gastos con esos filtros.</div>';
    colapsar(cont);
  };
  pintarLista();
  $('reg-buscar').addEventListener('input', e => { reg.busqueda = e.target.value; pintarLista(); });
  $('reg-mes').addEventListener('change', e => { reg.mes = e.target.value; pintarLista(); });
  el.querySelectorAll('[data-forma]').forEach(b => b.onclick = () => { reg.forma = b.dataset.forma; el.querySelectorAll('[data-forma]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); pintarLista(); });
  $('reg-lista').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const g = L.find(x => x.fila === +(b.dataset.corregir || b.dataset.anularG || b.dataset.detG)); if (!g) return;
    if (b.dataset.corregir) corregirGasto(g, d);
    else if (b.dataset.anularG) anularGastoUI(g, L);
    else if (b.dataset.detG) verDetalleSii(g.rut, g.folio, g.esNC ? '61' : '');
  });
}

function corregirGasto(g, d) {
  const items = d.itemsSii || d.items || [];
  const it0 = items.find(i => i.item === g.item);
  const dlg = dialogo(`<form class="form-dialogo" novalidate><h2>Corregir gasto</h2>
    <p class="ayuda">${esc(g.item)} · ${esc(g.area)} · ${esc(pesos(g.monto))} · ${esc(fechaIso(g.fecha))}${g.folio ? ` · ${g.esNC ? 'NC' : 'F.'} ${esc(g.folio)}` : ''}</p>
    <div class="grilla-montos"><div class="campo"><label for="cg-fecha">Fecha</label><input id="cg-fecha" type="date" value="${esc(g.fecha)}"></div>
      <div class="campo"><label for="cg-monto">Monto final${g.monto < 0 ? ' (nota de crédito: negativo)' : ''}</label><input id="cg-monto" type="number" step="1" value="${esc(g.monto)}"></div></div>
    <div class="campo"><label for="cg-item">Ítem</label><select id="cg-item">${it0 ? '' : `<option value="${esc(g.item)}" selected>${esc(g.item)} (ya no está en la lista)</option>`}${items.map(i => `<option value="${esc(i.item)}" ${i.item === g.item ? 'selected' : ''}>${esc(i.item)}</option>`).join('')}</select></div>
    <div class="campo"><label for="cg-area">Área</label><select id="cg-area"></select></div>
    <div class="campo"><label for="cg-obs">Observación</label><input id="cg-obs" type="text" maxlength="500" value="${esc(g.obs)}"></div>
    <p class="ayuda">El neto se recalcula si cambia el monto${g.esHarina ? ' (con el impuesto de la harina)' : ''}.${g.folio ? ' El folio del SII se mantiene en la observación.' : ''} Si la compra tiene otras líneas (otras áreas o ítems), se corrigen una por una.</p>
    <div class="error" id="cg-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="cg-cancelar">Cancelar</button><button type="submit" class="btn" id="cg-guardar">Guardar</button></div></form>`);
  const q = s => dlg.querySelector(s);
  // El área actual de la fila siempre se ofrece (aunque hoy el ítem tenga otra área fija): guardar sin tocarla no la cambia
  const pintarArea = () => {
    const it = items.find(i => i.item === q('#cg-item').value), mismoItem = q('#cg-item').value === g.item;
    const fija = it && !Sii.necesitaAreas(it) ? it.area : null;
    const opciones = [...new Set([...(mismoItem ? [g.area] : []), ...(fija ? [fija] : AREAS_GASTO)])];
    const sel = mismoItem ? g.area : (fija || (AREAS_GASTO.includes(q('#cg-area').value) ? q('#cg-area').value : AREAS_GASTO[0]));
    q('#cg-area').innerHTML = opciones.map(a => `<option value="${esc(a)}" ${a === sel ? 'selected' : ''}>${esc(a || 'Sin área')}</option>`).join('');
  };
  pintarArea();
  q('#cg-item').addEventListener('change', pintarArea);
  q('#cg-cancelar').onclick = () => dlg.close();
  let idem = 'edit-' + Gastos.nuevaClave();
  q('form').addEventListener('submit', async e => {
    e.preventDefault();
    const c = { fecha: q('#cg-fecha').value, item: q('#cg-item').value, area: q('#cg-area').value, monto: Math.round(Number(q('#cg-monto').value) || 0), obs: q('#cg-obs').value.trim() };
    const err = q('#cg-error'); err.textContent = '';
    if (!c.fecha || !c.monto) { err.textContent = 'Completa la fecha y el monto.'; return; }
    const cambios = [['Fecha', fechaIso(g.fecha), fechaIso(c.fecha)], ['Ítem', g.item, c.item], ['Área', g.area, c.area], ['Monto', pesos(g.monto), pesos(c.monto)], ['Observación', g.obs, c.obs]].filter(x => x[1] !== x[2]);
    if (!cambios.length) { dlg.close(); return; }
    const b = q('#cg-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      await Gastos.editar(g, c, idem);
      registrar('Corrigió un gasto', `${g.item} ${fechaIso(g.fecha)} · ${cambios.map(x => `${x[0]}: ${x[1] || '—'} → ${x[2] || '—'}`).join(' · ')}`);
      dlg.close(); pintarGastos('registrados');
    } catch (er) {
      if (er.code && er.code !== 'en_curso' && er.code !== 'a_medias') idem = 'edit-' + Gastos.nuevaClave();
      err.textContent = (er.message || mensajeError(er)) + (er.code ? '' : ' Si vuelves a tocar Guardar no se duplica.');
      if (er.code === 'cambio') setTimeout(() => { dlg.close(); pintarGastos('registrados'); }, 2500);
      b.disabled = false; b.textContent = 'Guardar';
    }
  });
}

// Clave del envío: se mantiene si no hubo respuesta (reintentar no anula otra fila igual)
let idemAnular = null;
async function anularGastoUI(g, L) {
  const hermanas = L.filter(x => x !== g && mismaCompra(x, g));
  const lineas = [g, ...hermanas];
  const todas = await new Promise(ok => {
    if (!hermanas.length) return ok(false);
    const d = dialogo(`<div class="form-dialogo"><h2>Esta compra tiene ${lineas.length} líneas</h2>
      <div class="lista-detalle">${lineas.map(x => `<div class="fila-reparto"><span>${esc(x.item)}<small>${esc(x.area)}</small></span><b>${esc(pesos(x.monto))}</b></div>`).join('')}</div>
      <p class="ayuda">Mismo día, hora y boleta. Si la compra entera no corresponde (por ejemplo, quedó duplicada), anúlala completa.</p>
      <div class="botones"><button type="button" class="btn-sec" data-r="no">Cancelar</button><button type="button" class="btn-sec" data-r="una">Solo ${esc(g.item)} · ${esc(g.area)}</button><button type="button" class="btn" data-r="todas">Toda la compra</button></div></div>`);
    let r = null;
    d.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { r = b.dataset.r; d.close(); });
    d.addEventListener('close', () => ok(r === 'todas' ? true : r === 'una' ? false : null));
  });
  if (todas === null) return;
  const filas = todas ? lineas : [g];
  const motivo = await pedirMotivo(filas.length > 1 ? `Anular ${filas.length} líneas` : 'Anular gasto',
    `<div class="lista-detalle">${filas.map(x => `<div class="fila-reparto"><span>${esc(x.item)}<small>${esc(fechaIso(x.fecha))} · ${esc(x.area)}</small></span><b>${esc(pesos(x.monto))}</b></div>`).join('')}</div>
    <p class="ayuda">No se borra: pasa a la pestaña "Gastos anulados" de la planilla con la fecha, tu cuenta y el motivo, y deja de sumar.${g.folio ? ' Ojo: si era una factura del SII, el documento sigue contando como importado.' : ''}</p>`, 'Anular');
  if (!motivo) return;
  // Solo se repite la clave para exactamente las mismas filas (un reintento); otra anulación lleva clave nueva
  const firma = filas.map(x => x.fila + ':' + x.huella).join(',');
  if (!idemAnular || idemAnular.firma !== firma) idemAnular = { firma, idem: 'anul-' + Gastos.nuevaClave() };
  try {
    const r = await Gastos.anular(filas, motivo, idemAnular.idem);
    idemAnular = null;
    registrar('Anuló un gasto', `${filas.map(x => `${x.item} ${x.area} ${pesos(x.monto)}`).join(' + ')} · ${fechaIso(g.fecha)} · ${motivo}`);
    for (const v of r.pagados || []) {
      if (confirm(`Este gasto era el pago de "${v.nombre}" (vencía el ${fechaIso(v.fecha)}, pagado el ${fechaIso(v.fechaPago)}).\n\n¿Dejar ese vencimiento por pagar de nuevo? Lo que decía el pago queda anotado.`)) {
        try { await Gastos.reabrirVencimiento(v.id, motivo); registrar('Dejó un vencimiento por pagar de nuevo', `${v.nombre} · ${motivo}`); } catch (e) { alert(e.message || mensajeError(e)); }
      }
    }
    for (const v of r.vencimientos || []) {
      if (confirm(`Esta compra era a crédito y tiene su vencimiento por pagar:\n\n${v.nombre} · ${pesos(v.monto)} · vence ${fechaIso(v.fecha)}\n\n¿Anularlo también (con el mismo motivo)?`)) {
        try { await Gastos.anularVencimiento(v.id, motivo); registrar('Anuló un vencimiento', `${v.nombre} · ${motivo}`); } catch (e) { alert(e.message || mensajeError(e)); }
      }
    }
    pintarGastos('registrados');
  } catch (e) {
    if (e.code && e.code !== 'en_curso' && e.code !== 'a_medias') idemAnular = null;
    alert((e.message || mensajeError(e)) + (e.code ? '' : '\n\nNo hubo respuesta: la lista se vuelve a cargar para ver si quedó anulado.'));
    if (e.code === 'cambio' || !e.code) { Gastos.olvidarTodo(); pintarGastos('registrados'); }
  }
}

// ── Análisis ──
const SUBTIPOS_COSTO = ['OPERATIVO', 'COMERCIAL', 'SIN CLASIFICAR'];
const NOTA_SUBTIPO = { 'INVERSIÓN': 'compra de activos, no es costo del mes', 'FINANCIERO': 'deuda: solo los intereses son costo', 'PASIVO': 'pago de algo que ya debías' };
const ana = { mes: '', modo: 'devengado' };
async function pintarAnalisis(el, sub) {
  el.innerHTML = cabGastos(sub) + `<div class="tarjeta"><div class="vacio" style="border:0">Cargando gastos…</div></div>`;
  let L;
  try { L = (await Gastos.lista()).gastos || []; } catch (e) { errorGastos(el.querySelector('.tarjeta'), e); return; }
  if (vistaDesdeHash() !== 'gastos' || subVista() !== 'analisis') return;
  const hoy = Caja.diaLocal().slice(0, 7);
  if (!ana.mes) ana.mes = hoy;
  const fechaDe = g => (ana.modo === 'caja' && g.fechaPago ? g.fechaPago : g.fecha);
  const meses = [...new Set(L.map(g => fechaDe(g).slice(0, 7)).concat([hoy]))].filter(Boolean).sort().reverse();
  const sub_ = g => String(g.subTipo || '').toUpperCase().trim() || 'SIN CLASIFICAR';
  const esCosto = g => SUBTIPOS_COSTO.includes(sub_(g));
  const delMes = L.filter(g => fechaDe(g).slice(0, 7) === ana.mes);
  const costo = delMes.filter(esCosto), fuera = delMes.filter(g => !esCosto(g));
  const suma = l => l.reduce((s, g) => s + g.monto, 0);
  const agrupar = (l, f) => { const m = {}; l.forEach(g => { const k = f(g) || 'Sin dato'; m[k] = (m[k] || 0) + g.monto; }); return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor); };
  const total = suma(costo);
  const [y, m] = ana.mes.split('-').map(Number);
  const evol = [5, 4, 3, 2, 1, 0].map(k => { const dt = new Date(y, m - 1 - k, 1); const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; return { nombre: `${MESES_LARGOS[dt.getMonth()].replace(/^./, c => c.toUpperCase())} ${dt.getFullYear()}`, valor: suma(L.filter(g => esCosto(g) && fechaDe(g).slice(0, 7) === key)) }; });
  const nombreMes = `${MESES_LARGOS[m - 1]} ${y}`;
  el.innerHTML = cabGastos(sub) + `
    <div class="filtros"><select id="an-mes" aria-label="Mes">${meses.map(k => `<option value="${k}" ${k === ana.mes ? 'selected' : ''}>${MESES_LARGOS[+k.slice(5) - 1].replace(/^./, c => c.toUpperCase())} ${k.slice(0, 4)}</option>`).join('')}</select>
      <div class="chips chips-chicos" role="group" aria-label="Fecha que se usa">${[['devengado', 'Por fecha de compra'], ['caja', 'Por fecha de pago']].map(([k, t]) => `<button type="button" class="chip-filtro" data-modo-an="${k}" aria-pressed="${ana.modo === k}">${t}</button>`).join('')}</div>
      ${info('Cómo se calcula', 'Costo operacional: los gastos con subtipo OPERATIVO o COMERCIAL (o sin subtipo). Inversiones, deudas (FINANCIERO) e impuestos por pagar (PASIVO) son salidas de plata pero no costo del mes: se muestran aparte para que los meses se puedan comparar.\nPor fecha de compra: el mes en que se compró (devengado). Por fecha de pago: el mes en que salió la plata (flujo de caja); las compras a crédito cuentan cuando se pagan.\nLos gastos anulados no suman. Montos con IVA (monto final).')}</div>
    <div class="cifras cifras-4">
      <div class="tarjeta cifra"><span class="rotulo">Costo operacional</span><span class="valor">${pesos(total)}</span><span class="nota">${costo.length} ${costo.length === 1 ? 'línea' : 'líneas'} · ${esc(nombreMes)}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Fijos</span><span class="valor">${pesos(suma(costo.filter(g => g.categoria.toUpperCase() === 'FIJO')))}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Variables</span><span class="valor">${pesos(suma(costo.filter(g => g.categoria.toUpperCase() === 'VARIABLE')))}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Fuera del costo</span><span class="valor">${pesos(suma(fuera))}</span><span class="nota">inversión, deuda, impuestos</span></div>
    </div>
    ${costo.length ? `<div class="grilla-an">
      <section class="tarjeta" aria-labelledby="t-an-area"><div class="titulo-fila"><h2 id="t-an-area">Por área</h2></div>${barras(agrupar(costo, g => g.area), total)}</section>
      <section class="tarjeta" aria-labelledby="t-an-item"><div class="titulo-fila"><h2 id="t-an-item">Ítems que más pesan</h2></div>${barras(agrupar(costo, g => g.item).slice(0, 8), total)}</section>
      <section class="tarjeta" aria-labelledby="t-an-tipo"><div class="titulo-fila"><h2 id="t-an-tipo">Directo e indirecto</h2></div>${barras(agrupar(costo, g => g.tipo.toUpperCase()), total)}</section>
      <section class="tarjeta" aria-labelledby="t-an-sub"><div class="titulo-fila"><h2 id="t-an-sub">Por subtipo (todo el mes)</h2></div>${barras(agrupar(delMes, sub_).map(x => ({ ...x, extra: NOTA_SUBTIPO[x.nombre] || '' })), suma(delMes))}</section>
    </div>` : `<section class="tarjeta"><div class="vacio">No hay gastos en ${esc(nombreMes)}.</div></section>`}
    <section class="tarjeta" aria-labelledby="t-an-evol"><div class="titulo-fila"><h2 id="t-an-evol">Costo operacional, últimos 6 meses</h2></div>${barras(evol, 0)}</section>`;
  colapsar(el);
  $('an-mes').addEventListener('change', e => { ana.mes = e.target.value; pintarAnalisis(el, sub); });
  el.querySelectorAll('[data-modo-an]').forEach(b => b.onclick = () => { ana.modo = b.dataset.modoAn; pintarAnalisis(el, sub); });
}

// ── Ítems ──
async function pintarItems(el, sub) {
  el.innerHTML = cabGastos(sub) + `<div class="tarjeta"><div class="vacio" style="border:0">Cargando ítems…</div></div>`;
  let I;
  try { I = (await Gastos.itemsTodos()).items || []; } catch (e) { errorGastos(el.querySelector('.tarjeta'), e); return; }
  if (vistaDesdeHash() !== 'gastos' || subVista() !== 'items') return;
  const activos = I.filter(i => !i.archivado), archivados = I.filter(i => i.archivado);
  const fila = (i, k, n) => `<div class="fila-caja"><div class="txt"><b>${esc(i.item)}</b><span>${[i.categoria, i.tipo, i.subTipo, i.area].filter(Boolean).map(esc).join(' · ')}</span>${i.esObligacionRecurrente ? '<span>Se paga desde Obligaciones</span>' : ''}</div>
    <div class="acciones">${n ? `<button type="button" class="btn-icono" data-mover="${esc(i.item)}" data-dir="arriba" ${k === 0 ? 'disabled' : ''} aria-label="Subir ${esc(i.item)}">${icono('arriba', 16)}</button><button type="button" class="btn-icono" data-mover="${esc(i.item)}" data-dir="abajo" ${k === n - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(i.item)}">${icono('abajo', 16)}</button>` : ''}
      <button type="button" class="btn-sec btn-chico" data-editar-item="${esc(i.item)}">Editar</button><button type="button" class="btn-sec btn-chico" data-archivar-item="${esc(i.item)}" data-archivar="${i.archivado ? '' : '1'}">${i.archivado ? 'Reactivar' : 'Archivar'}</button></div></div>`;
  el.innerHTML = cabGastos(sub) + `<div id="gx-items">
    <section class="tarjeta" aria-labelledby="t-items"><div class="titulo-fila"><h2 id="t-items">Ítems de gasto ${info('Ítems', 'La lista con la que se clasifica cada gasto, en el orden en que aparece al registrar.\nÁrea: una fija (el gasto va entero ahí), SELECCIONAR (se elige el área y el monto al registrar) o PRORRATEADO (se reparte en % entre áreas).\nArchivar lo saca de las listas para registrar; los gastos que ya lo usan no cambian. En Sistema Fën los ítems no se borran.\nCambiar el nombre no cambia los gastos ya registrados ni las obligaciones que lo usan: esos siguen con el nombre anterior.')}</h2>
      <button type="button" class="btn" id="item-nuevo">${icono('mas', 16)} Nuevo ítem</button></div>
      ${activos.map((i, k) => fila(i, k, activos.length)).join('') || '<div class="vacio">No hay ítems.</div>'}</section>
    ${archivados.length ? `<section class="tarjeta" aria-labelledby="t-items-arch"><div class="titulo-fila"><h2 id="t-items-arch">Archivados</h2><span>${archivados.length}</span></div><div data-colapsar="3">${archivados.map(i => fila(i, 0, 0)).join('')}</div></section>` : ''}</div>`;
  colapsar(el);
  $('item-nuevo').onclick = () => editarItem(null);
  $('gx-items').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.editarItem) editarItem(I.find(i => i.item === b.dataset.editarItem));
    else if (b.dataset.mover) { b.disabled = true; try { await Gastos.moverItem(b.dataset.mover, b.dataset.dir); pintarItems(el, sub); } catch (er) { alert(er.message || mensajeError(er)); b.disabled = false; } }
    else if (b.dataset.archivarItem) {
      const archivar = !!b.dataset.archivar, nombre = b.dataset.archivarItem;
      if (archivar && !confirm(`¿Archivar "${nombre}"?\n\nDeja de aparecer para registrar gastos, obligaciones y el SII. Los gastos que ya lo usan no cambian.`)) return;
      b.disabled = true;
      try { await Gastos.archivarItem(nombre, archivar); registrar(archivar ? 'Archivó un ítem' : 'Reactivó un ítem', nombre); pintarItems(el, sub); }
      catch (er) { alert(er.message || mensajeError(er)); b.disabled = false; }
    }
  });
}

function editarItem(i) {
  const sel = (id, opciones, v) => `<select id="${id}"><option value="">Elige</option>${opciones.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  const d = dialogo(`<form class="form-dialogo" novalidate><h2>${i ? 'Editar ítem' : 'Nuevo ítem'}</h2>
    <div class="campo"><label for="it-nombre">Nombre</label><input id="it-nombre" type="text" maxlength="60" value="${esc(i ? i.item : '')}" style="text-transform:uppercase"></div>
    ${i ? '<p class="ayuda">Si cambias el nombre, los gastos ya registrados y las obligaciones que lo usan siguen con el nombre anterior.</p>' : ''}
    <div class="grilla-montos"><div class="campo"><label for="it-cat">Categoría</label>${sel('it-cat', ['FIJO', 'VARIABLE'], i && i.categoria)}</div><div class="campo"><label for="it-tipo">Tipo</label>${sel('it-tipo', ['DIRECTO', 'INDIRECTO'], i && i.tipo)}</div></div>
    <div class="grilla-montos"><div class="campo"><label for="it-sub">Subtipo</label>${sel('it-sub', ['OPERATIVO', 'COMERCIAL', 'INVERSIÓN', 'FINANCIERO', 'PASIVO'], i && i.subTipo)}</div><div class="campo"><label for="it-area">Área</label>${sel('it-area', ['SELECCIONAR', 'PRORRATEADO', ...AREAS_GASTO], i && i.area)}</div></div>
    <div class="error" id="it-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="it-cancelar">Cancelar</button><button type="submit" class="btn" id="it-guardar">Guardar</button></div></form>`);
  const q = s => d.querySelector(s);
  q('#it-cancelar').onclick = () => d.close();
  q('form').addEventListener('submit', async e => {
    e.preventDefault();
    const datos = { nombreOriginal: i ? i.item : '', nombre: q('#it-nombre').value.trim().toUpperCase(), categoria: q('#it-cat').value, tipo: q('#it-tipo').value, subTipo: q('#it-sub').value, area: q('#it-area').value };
    if (!datos.nombre || !datos.categoria || !datos.tipo || !datos.subTipo || !datos.area) { q('#it-error').textContent = 'Completa todos los campos.'; return; }
    const b = q('#it-guardar'); b.disabled = true;
    try { await Gastos.guardarItem(datos); registrar(i ? 'Editó un ítem' : 'Creó un ítem', i && i.item !== datos.nombre ? `${i.item} → ${datos.nombre}` : datos.nombre); d.close(); pintarGastos('items'); }
    catch (er) { q('#it-error').textContent = er.message || mensajeError(er); b.disabled = false; }
  });
}

// ── Gastos · v0.10.1: cotizaciones de Previred ──
const prev = { datos: null, archivo: null, config: {}, yaCargadas: [], idem: null };
const ultimoDia = periodo => { const [a, m] = periodo.split('-').map(Number); const d = new Date(a, m, 0); return Caja.diaLocal(d); };
function itemPorDefecto(area, items) {
  const existe = n => items.some(i => i.item === n);
  if (['PAN', 'BOL', 'CAF', 'PAS'].includes(area) && existe('REMUNERACIONES PRODUCCIÓN')) return 'REMUNERACIONES PRODUCCIÓN';
  if (existe('OTRAS REMUNERACIONES')) return 'OTRAS REMUNERACIONES';
  return '';
}

async function pintarPrevired(el, sub, d) {
  const items = d.itemsSii || d.items || [];
  el.innerHTML = cabGastos(sub) + `
    <section class="tarjeta" aria-labelledby="t-prev"><div class="titulo-fila"><h2 id="t-prev">Cotizaciones de Previred ${info('Cotizaciones de Previred', 'Sube el PDF de "Certificado de Pagos de Cotizaciones Previsionales" que descargas de Previred: el de un trabajador o el lote con todos. Se lee aquí mismo, en tu equipo.\nSe registra un gasto por trabajador (sin IVA, pagado al contado en la fecha de pago de Previred), con el área y el ítem que elijas: se recuerdan para el mes siguiente.\nEl detalle (AFP, salud, AFC y lo que paga la empresa) queda en la hoja "Cotizaciones" de la planilla, y el PDF en Drive como comprobante.\nEl mismo mes no se puede cargar dos veces.')}</h2></div>
      <div class="campo"><label for="prev-archivo">PDF de Previred</label><input id="prev-archivo" type="file" accept="application/pdf,.pdf"></div>
      <div id="prev-msg" class="ayuda" role="status">${esc(prev.mensaje || '')}</div></section>
    <div id="prev-trabajo"></div>
    <section class="tarjeta" aria-labelledby="t-prev-hist"><div class="titulo-fila"><h2 id="t-prev-hist">Meses cargados ${info('Costo de cada sueldo', 'AFP y salud se descuentan del sueldo del trabajador. SIS, seguros sociales y accidentes (ISL o mutual) los paga la empresa. La AFC mezcla las dos partes.\nEl costo real de un sueldo es el líquido que le transfieres más el total de su fila aquí.')}</h2></div>
      <div id="prev-hist"><div class="vacio" style="border:0">Cargando…</div></div></section>`;
  $('prev-archivo').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) leerPrevired(f, items, d); });
  if (prev.datos) pintarPrevTrabajo(items, d);
  try { pintarPrevHist((await Previred.lista()).periodos || []); }
  catch (e) { errorGastos($('prev-hist'), e); }
}

async function leerPrevired(file, items, d) {
  const msg = $('prev-msg'); prev.mensaje = '';
  if (file.size > 8 * 1024 * 1024) { msg.textContent = 'El PDF pesa más de 8 MB: no parece un certificado de Previred.'; return; }
  msg.textContent = 'Leyendo el PDF…';
  try {
    const r = Previred.leer(await Previred.lineasDelPdf(file));
    msg.textContent = 'Revisando si ese mes ya estaba cargado…';
    const e = await Previred.estado(r.periodo, r.trabajadores);
    // Lo ya cargado se deja fuera (por ejemplo, el lote se descargó de nuevo con un trabajador más)
    const ya = new Set(e.yaCargadas || []);
    let fuera = 0;
    r.trabajadores.forEach(t => { const n = t.lineas.length; t.lineas = t.lineas.filter(l => !ya.has(Previred.clave(r.periodo, t, l))); fuera += n - t.lineas.length; t.total = t.lineas.reduce((x, l) => x + l.monto, 0); });
    r.yaCargadasN = fuera;
    r.trabajadores = r.trabajadores.filter(t => t.lineas.length);
    r.trabajadores.forEach(t => {
      const c = (e.config || {})[t.rut.toUpperCase()] || {};
      t.area = c.area || '';
      t.item = c.item && items.some(i => i.item === c.item) ? c.item : itemPorDefecto(t.area, items);
    });
    Object.assign(prev, { datos: r, archivo: file, yaCargadas: e.yaCargadas || [], idem: await Previred.claveDeEnvio(r.periodo, r.trabajadores) });
    prev.fecha = ultimoDia(r.periodo);
    const pend = (d.vencimientos || []).filter(v => v.estado === 'PENDIENTE' || v.estado === 'VENCIDA');
    const sug = pend.find(v => /cotiz|previred|imposic/i.test(`${v.nombre} ${v.item}`));
    prev.vencimientoId = sug && !fuera ? sug.id : '';   // si parte ya estaba cargada, el vencimiento lo eliges tú
    msg.textContent = '';
    pintarPrevTrabajo(items, d);
  } catch (er) { msg.textContent = er.message || mensajeError(er); }
}

function pintarPrevTrabajo(items, d) {
  const cont = $('prev-trabajo'), r = prev.datos;
  if (!cont || !r) return;
  const total = r.trabajadores.reduce((s, t) => s + t.total, 0);
  const pend = (d.vencimientos || []).filter(v => v.estado === 'PENDIENTE' || v.estado === 'VENCIDA');
  const cargado = !r.trabajadores.length, parcial = !cargado && r.yaCargadasN > 0;
  const opcItems = sel => `<option value="">Ítem</option>${items.map(i => `<option value="${esc(i.item)}" ${i.item === sel ? 'selected' : ''}>${esc(i.item)}</option>`).join('')}`;
  cont.innerHTML = `<section class="tarjeta" aria-labelledby="t-prev-mes">
    <div class="titulo-fila"><h2 id="t-prev-mes">${esc(Previred.nombreMes(r.periodo).replace(/^./, c => c.toUpperCase()))}</h2><span>${r.trabajadores.length} ${r.trabajadores.length === 1 ? 'trabajador' : 'trabajadores'}</span></div>
    <div class="desglose desglose-grande"><span>Total pagado <b>${pesos(total)}</b></span><span>Pagado el <b>${esc(fechaIso(r.fechaPago))}</b></span>
      <span>AFP <b>${pesos(r.trabajadores.reduce((s, t) => s + Previred.resumen(t).afp, 0))}</b></span><span>Salud <b>${pesos(r.trabajadores.reduce((s, t) => s + Previred.resumen(t).salud, 0))}</b></span>
      <span>AFC <b>${pesos(r.trabajadores.reduce((s, t) => s + Previred.resumen(t).afc, 0))}</b></span><span>Empresa <b>${pesos(r.trabajadores.reduce((s, t) => s + Previred.resumen(t).empleador, 0))}</b></span></div>
    ${r.avisos.map(a => `<div class="aviso">${esc(a)}</div>`).join('')}
    ${cargado ? `<div class="aviso aviso-rojo">Este mes ya estaba cargado completo: no hay nada nuevo que guardar. Míralo en "Meses cargados".</div>` : ''}
    ${parcial ? `<div class="aviso">${r.yaCargadasN} ${r.yaCargadasN === 1 ? 'línea ya estaba cargada' : 'líneas ya estaban cargadas'} de este mes: se dejan fuera y se registra solo lo nuevo (lo que ves abajo).</div>` : ''}
    ${r.bloquea ? '<div class="aviso aviso-rojo">Hay líneas del PDF que no se pudieron leer (ver arriba): no se puede guardar porque los totales quedarían incompletos. Prueba con el PDF de ese trabajador por separado o avísame.</div>' : ''}
    <div id="prev-filas">${r.trabajadores.map((t, i) => { const s = Previred.resumen(t);
      return `<div class="fila-caja" data-t="${i}"><div class="txt"><b>${esc(t.nombre)}</b>
        <span>Imponible ${pesos(s.imponible)} · AFP ${pesos(s.afp)} · Salud ${pesos(s.salud)} · AFC ${pesos(s.afc)} · Empresa ${pesos(s.empleador)}${s.otro ? ' · Otros ' + pesos(s.otro) : ''}</span></div>
        <div class="acciones"><select data-area="${i}" aria-label="Área de ${esc(t.nombre)}"><option value="">Área</option>${AREAS_GASTO.map(a => `<option ${a === t.area ? 'selected' : ''}>${a}</option>`).join('')}</select>
          <select data-item="${i}" aria-label="Ítem de ${esc(t.nombre)}">${opcItems(t.item)}</select>
          <span class="chip c-gris">${pesos(t.total)}</span></div></div>`; }).join('')}</div>
    <div class="grilla-montos"><div class="campo"><label for="prev-fecha">Fecha del gasto ${info('Fecha del gasto', 'El mes al que corresponde el costo. Por defecto, el último día del mes de las remuneraciones (así queda junto a los sueldos de ese mes en el análisis). La fecha de pago es la de Previred.')}</label><input id="prev-fecha" type="date" value="${esc(prev.fecha)}"></div>
      <div class="campo"><label for="prev-venc">Vencimiento que paga (opcional)</label><select id="prev-venc"><option value="">Ninguno</option>${pend.map(v => `<option value="${esc(v.id)}" ${v.id === prev.vencimientoId ? 'selected' : ''}>${esc(v.nombre)} · ${esc(fechaIso(v.fecha))}</option>`).join('')}</select></div></div>
    <div class="error" id="prev-error" role="alert"></div>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="prev-guardar" ${cargado || r.bloquea ? 'disabled' : ''}>Registrar ${r.trabajadores.length} ${r.trabajadores.length === 1 ? 'gasto' : 'gastos'} · ${pesos(total)}</button><button type="button" class="btn-sec" id="prev-descartar">Descartar</button></div></section>`;
  if (!cont.dataset.escucha) cont.dataset.escucha = '1', cont.addEventListener('change', e => {
    const r = prev.datos; if (!r) return;
    const t = e.target;
    if (t.dataset.area !== undefined) { const w = r.trabajadores[+t.dataset.area]; const antes = itemPorDefecto(w.area, items); w.area = t.value; if (!w.item || w.item === antes) { w.item = itemPorDefecto(w.area, items); const s = cont.querySelector(`[data-item="${t.dataset.area}"]`); if (s) s.value = w.item; } }
    else if (t.dataset.item !== undefined) r.trabajadores[+t.dataset.item].item = t.value;
    else if (t.id === 'prev-fecha') prev.fecha = t.value;
    else if (t.id === 'prev-venc') prev.vencimientoId = t.value;
  });
  $('prev-descartar').onclick = () => { prev.datos = null; cont.innerHTML = ''; };
  $('prev-guardar').onclick = async () => {
    const err = $('prev-error'); err.textContent = '';
    const falta = r.trabajadores.find(t => !t.area || !t.item);
    if (falta) { err.textContent = `${falta.nombre}: elige el área y el ítem.`; return; }
    if (!prev.fecha) { err.textContent = 'Elige la fecha del gasto.'; return; }
    const payload = { periodo: r.periodo, fechaPago: r.fechaPago, fecha: prev.fecha, vencimientoId: prev.vencimientoId || '',
      trabajadores: r.trabajadores.map(t => ({ rut: t.rut, nombre: t.nombre, area: t.area, item: t.item, lineas: t.lineas.map(l => ({ institucion: l.institucion, tipoPago: l.tipoPago, imponible: l.imponible, monto: l.monto, folio: l.folio })) })) };
    const b = $('prev-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      const x = await Previred.registrar(payload, prev.archivo, prev.idem);
      registrar('Cargó cotizaciones de Previred', `${Previred.nombreMes(r.periodo)} · ${x.trabajadores} trabajadores · ${pesos(x.total)}`);
      prev.datos = null;
      prev.mensaje = `Listo: ${x.trabajadores} gastos por ${pesos(x.total)}${x.vencimiento ? ' y el vencimiento quedó pagado' : ''}.${x.conArchivo ? '' : ' (El PDF no se pudo guardar en Drive.)'}`;
      pintarGastos('previred');
    } catch (er) {
      err.textContent = (er.message || mensajeError(er)) + (er.code ? '' : ' Si vuelves a tocar Registrar no se duplica.');
      b.disabled = er.code === 'duplicado'; b.textContent = 'Registrar';
    }
  };
}

function pintarPrevHist(P) {
  const cont = $('prev-hist'); if (!cont) return;
  cont.innerHTML = P.length ? P.map((p, k) => `<details class="mes-sii" ${k === 0 ? 'open' : ''}><summary><b>${esc(Previred.nombreMes(p.periodo).replace(/^./, c => c.toUpperCase()))}</b><span>${p.trabajadores.length} trabajadores · ${pesos(p.total)} · pagado el ${esc(fechaIso(p.fechaPago))}</span></summary>
    ${p.trabajadores.sort((a, b) => b.total - a.total).map(t => `<div class="fila-caja"><div class="txt"><b>${esc(t.nombre)}</b><span>${esc(t.area)} · imponible ${pesos(t.imponible)}</span>
      <span>AFP ${pesos(t.afp)} · Salud ${pesos(t.salud)} · AFC ${pesos(t.afc)} · Empresa ${pesos(t.empleador)}${t.otro ? ' · Otros ' + pesos(t.otro) : ''}</span></div>
      <div class="acciones"><span class="chip c-gris">${pesos(t.total)}</span></div></div>`).join('')}
    ${p.archivo ? `<p class="ayuda"><a href="${esc(p.archivo)}" target="_blank" rel="noopener">PDF en Drive</a></p>` : ''}</details>`).join('')
    : '<div class="vacio">Aún no hay meses cargados.</div>';
}

// Convierte el resumen de cada app en filas de Pendientes (una por tema, sintetizada)
function pendientesApps(estados) {
  const L = [], url = id => (F.APPS.find(a => a.id === id) || {}).url || '#';
  const nombres = (det, n = 3) => (det || []).slice(0, n).map(x => x.nombre).filter(Boolean).join(', ') + ((det || []).length > n ? '…' : '');
  const veces = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const P = id => (estados[id] && estados[id].estado === 'ok' ? estados[id].pendientes : []);
  const de = (id, clave) => P(id).find(x => x.clave === clave);
  // Gastos
  const at = de('gastos', 'atrasados'), se = de('gastos', 'semana'), sii = de('gastos', 'docs_sii');
  if (at && at.cantidad > 0) L.push({ orden: 0, color: 'rojo', icono: 'boleta', chip: 'Pagar', url: '#gastos', origen: 'Gastos', titulo: 'Pagos atrasados',
    detalle: `${veces(at.cantidad, 'pago', 'pagos')} · ${pesos(at.monto)} · ${nombres(at.detalle)}` });
  if (se && se.cantidad > 0) L.push({ orden: 1.5, color: 'amarillo', icono: 'reloj', chip: 'Esta semana', url: '#gastos', origen: 'Gastos', titulo: 'Pagos de los próximos 7 días',
    detalle: `${veces(se.cantidad, 'pago', 'pagos')} · ${pesos(se.monto)} · ${(se.detalle || []).slice(0, 3).map(x => `${x.nombre} ${diaTexto(x.fecha)}`).join(', ')}${se.cantidad > 3 ? '…' : ''}` });
  if (sii && sii.cantidad < 0) L.push({ orden: 5, color: 'gris', icono: 'boleta', chip: 'Revisar', url: '#gastos/sii', origen: 'Gastos', titulo: 'No se pudieron revisar los documentos del SII',
    detalle: 'Los pagos sí se leyeron. Abre Gastos → Cargas del SII para verlos.' });
  if (sii && sii.cantidad > 0) L.push({ orden: 2.5, color: 'azul', icono: 'boleta', chip: 'Revisar', url: '#gastos/sii', origen: 'Gastos', titulo: 'Documentos del SII sin gasto',
    detalle: `${veces(sii.cantidad, 'documento', 'documentos')} por registrar${sii.enDuda ? ` · ${sii.enDuda} con duda anotada` : ''}` });
  // Ventas B2B
  const co = de('b2b', 'cobros'), sf = de('b2b', 'sin_factura');
  if (co && co.cantidad > 0) L.push({ orden: 0.5, color: 'rojo', icono: 'camion', chip: 'Cobrar', url: url('b2b'), origen: 'Ventas B2B', titulo: 'Cobros atrasados',
    detalle: `${pesos(co.monto)} · ${veces(co.clientes, 'cliente', 'clientes')} · ${(co.detalle || []).slice(0, 3).map(x => `${x.nombre} ${pesos(x.valor)}`).join(', ')}${co.clientes > 3 ? '…' : ''}` });
  if (sf && sf.cantidad > 0) L.push({ orden: sf.atrasadas ? 1.2 : 4, color: sf.atrasadas ? 'amarillo' : 'azul', icono: 'camion', chip: 'Facturar', url: url('b2b'), origen: 'Ventas B2B', titulo: 'Órdenes sin factura',
    detalle: `${veces(sf.cantidad, 'orden', 'órdenes')}${sf.atrasadas ? `, ${sf.atrasadas} atrasadas · ${(sf.detalle || []).slice(0, 3).map(x => `${x.nombre} (${x.valor})`).join(', ')}` : ' · todas dentro de su plazo'}` });
  // Producción
  const mp = de('produccion', 'solicitudes_mp'), hb = de('produccion', 'habilitaciones');
  if (mp && mp.cantidad > 0) L.push({ orden: 3.2, color: 'lila', icono: 'libro', chip: 'Aprobar', url: url('produccion'), origen: 'Producción', titulo: 'Materias primas por aprobar',
    detalle: `${veces(mp.cantidad, 'solicitud', 'solicitudes')} · ${(mp.detalle || []).slice(0, 3).map(x => `${x.nombre} (${x.area})`).join(', ')}${mp.cantidad > 3 ? '…' : ''}` });
  if (hb && hb.cantidad > 0) L.push({ orden: 3.3, color: 'lila', icono: 'libro', chip: 'Resolver', url: url('produccion'), origen: 'Producción', titulo: 'Habilitaciones por resolver',
    detalle: `${veces(hb.cantidad, 'solicitud', 'solicitudes')} · ${(hb.detalle || []).slice(0, 3).map(x => `${x.nombre} → ${x.area}`).join(', ')}${hb.cantidad > 3 ? '…' : ''}` });
  return L;
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
          <tbody data-colapsar>${vigentes.map(e => `<tr>
            <td>${nombreEq(e)}</td><td>${esc(e.correo || '')}</td><td>${fechaCorta(e.venceEn)}</td>
            <td><select data-duracion="${e.id}" aria-label="Recordar ${esc(e.nombre)} por">${opcionesDuracion(e.duracion)}</select></td>
            <td style="text-align:right">${boton(e)}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="lista-equipos-cel" data-colapsar>${vigentes.map(e => `<div class="equipo-cel">
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
          <div class="actividad" style="margin-top:8px" data-colapsar>${hist.length ? hist.map(h => `<div><span>${esc(h.accion)}${h.detalle ? ' · ' + esc(h.detalle) : ''}</span><small>${esc(h.equipo || '')} · ${hace(h.en)}</small></div>`).join('') : '<div><small>Sin actividad todavía.</small></div>'}</div>
        </section>
    </div>`;

  colapsar(el);
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
// ── Ventas B2B: base nueva (fen-b2b) ───────────────
// v0.11: conectar la base nueva, copiar la planilla y revisar que todo cuadre.
// La app B2B sigue funcionando igual: la planilla manda hasta que exista la app de logística (v0.12).
const SUBS_B2B = [['', 'Órdenes'], ['solicitudes', 'Solicitudes'], ['conciliacion', 'Conciliación'], ['clientes', 'Clientes'], ['productos', 'Productos'], ['cuenta', 'Estado de cuenta'], ['analisis', 'Análisis'], ['buscar', 'Buscar'], ['base', 'Base nueva']];
const b2b = { prep: null, tot: null, uso: null, copiando: false, msg: '', error: '', activaVista: null, vivo: null, datos: null, errVivo: '', sel: new Set(), planilla: '', cambiando: '' };
function cabB2b(sub) {
  const actual = SUBS_B2B.some(([k]) => k && k === sub) ? sub : '';
  const activa = b2b.datos && b2b.datos.config && b2b.datos.config.activa;
  const nSol = b2b.datos ? b2b.datos.solicitudes.length : 0, nMov = b2b.datos && b2b.datos.movimientos ? b2b.datos.movimientos.length : 0;
  return `<div class="cabecera"><div><h1 id="t-b2b">Ventas B2B</h1><p>${activa ? 'Base nueva en uso · la planilla recibe una copia automática' : 'Base nueva en preparación · la app B2B sigue funcionando igual'}</p></div>
    <div class="pestanas" role="tablist" aria-label="Secciones de Ventas B2B">${SUBS_B2B.map(([k, t]) => `<a role="tab" href="#b2b${k ? '/' + k : ''}" aria-selected="${k === actual}">${t}${k === 'solicitudes' && nSol ? ` <span class="chip c-amarillo">${nSol}</span>` : ''}${k === 'conciliacion' && nMov ? ` <span class="chip c-azul">${nMov}</span>` : ''}</a>`).join('')}</div></div>`;
}
async function pintarB2b(sub) {
  const el = $('v-b2b');
  el.innerHTML = cabB2b(sub) + '<div class="tarjeta"><div class="vacio" style="border:0">Conectando con la base nueva…</div></div>';
  let cx;
  try { cx = await B2b.conexion(); }
  catch (e) { el.querySelector('.tarjeta').innerHTML = `<div class="error">${esc(errorB2b(e))}</div>`; return; }
  if (vistaDesdeHash() !== 'b2b') return;
  if (cx.estado === 'sin_config') return pintarB2bConfig(el, sub);
  if (cx.estado === 'sin_sesion') return pintarB2bEntrar(el, sub, cx);
  if (cx.estado === 'sin_admin') return pintarB2bSinAdmin(el, sub, cx);
  b2bEscuchar(sub);
  if (sub === 'buscar') return pintarB2bOrdenes(el, sub);
  if (sub === 'base') return pintarB2bBase(el, sub, cx);
  if (sub === 'solicitudes') return pintarB2bSolicitudes(el, sub);
  if (sub === 'clientes') return pintarB2bClientes(el, sub);
  if (sub === 'productos') return pintarB2bProductos(el, sub);
  if (sub === 'cuenta') return pintarB2bCuenta(el, sub);
  if (sub === 'conciliacion') return pintarB2bConciliacion(el, sub);
  if (sub === 'analisis') return pintarB2bAnalisis(el, sub);
  pintarB2bAdmin(el, sub);
}
function errorB2b(e) {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return 'La base nueva no dejó leer o guardar: revisa que estén publicadas las reglas de fen-b2b v1.0.0 y que tu cuenta esté en admins (ver README).';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'En fen-b2b no hay una cuenta con tu correo y esa contraseña. Créala en la consola de Firebase del proyecto fen-b2b → Authentication (ver README).';
  if (/invalid-api-key|api-key-not-valid/.test(c)) return 'La configuración guardada no es válida (apiKey). Vuelve a pegarla.';
  if (/failed-precondition/.test(c)) return /index/i.test((e && e.message) || '') ? 'Firestore pide un índice para esta consulta. Avísame con este mensaje: ' + e.message : 'Firestore todavía no está creado en fen-b2b (consola → Firestore Database → Crear base de datos).';
  return (e && e.message) || mensajeError(e);
}

function pintarB2bConfig(el, sub, actual) {
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-cfg">
    <h2 id="t-b2b-cfg">Conectar la base nueva ${info('Base nueva de B2B', 'Es un proyecto de Firebase aparte (fen-b2b), en tu misma cuenta de Google. Tiene su propia cuota gratis, así la caja nunca se queda sin lecturas por culpa de B2B.\nLa configuración que pegas aquí no es secreta: solo dice cuál es el proyecto. Los datos los protegen las reglas y tu cuenta de administración.')}</h2>
    <p class="ayuda">En la consola de Firebase, abre el proyecto <b>fen-b2b</b> → ⚙️ Configuración del proyecto → Tus apps → la app web → copia todo el bloque <code>const firebaseConfig = { … }</code> y pégalo aquí.</p>
    <div class="campo"><label for="b2b-cfg">Configuración web de fen-b2b</label><textarea id="b2b-cfg" rows="8" spellcheck="false" style="font-family:monospace;font-size:13px;padding:12px;border-radius:12px;border:1px solid var(--borde)" placeholder="const firebaseConfig = {&#10;  apiKey: &quot;…&quot;,&#10;  authDomain: &quot;fen-b2b.firebaseapp.com&quot;,&#10;  projectId: &quot;fen-b2b&quot;, …&#10;};">${actual ? esc(JSON.stringify(actual, null, 2)) : ''}</textarea></div>
    <div class="error" id="b2b-cfg-err" role="alert"></div>
    <div class="botones">${actual ? '<button type="button" class="btn-sec" id="b2b-cfg-volver">Volver</button>' : ''}<button type="button" class="btn" id="b2b-cfg-ok">Guardar y conectar</button></div></section>`;
  if (actual) $('b2b-cfg-volver').addEventListener('click', () => pintarB2b(sub));
  $('b2b-cfg-ok').addEventListener('click', async () => {
    const btn = $('b2b-cfg-ok'); $('b2b-cfg-err').textContent = '';
    let cfg; try { cfg = B2b.parsearConfig($('b2b-cfg').value); } catch (e) { $('b2b-cfg-err').textContent = e.message; return; }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await B2b.salir();
      await B2b.guardarConfig(cfg);
      registrar('Conectó la base nueva de B2B', cfg.projectId);
      pintarB2b(sub);
    } catch (e) { $('b2b-cfg-err').textContent = errorB2b(e); btn.disabled = false; btn.textContent = 'Guardar y conectar'; }
  });
}

function pintarB2bEntrar(el, sub, cx) {
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-entrar">
    <h2 id="t-b2b-entrar">Entrar a la base nueva ${info('Por qué pide la contraseña', 'La base nueva es otro proyecto de Firebase y tiene su propia sesión. Usa tu mismo correo y contraseña: se pide una vez en cada equipo (y después cada vez que entres a Sistema Fën se entra solo).\nLa cuenta se crea en la consola del proyecto fen-b2b → Authentication.')}</h2>
    <p class="ayuda">Proyecto <b>${esc(cx.cfg.projectId)}</b> · cuenta <b>${esc(cx.correo)}</b></p>
    <form id="b2b-form-entrar" class="campo" style="max-width:420px">
      <label for="b2b-clave">Tu contraseña de Sistema Fën</label><input type="password" id="b2b-clave" autocomplete="current-password" required>
      <div class="error" id="b2b-entrar-err" role="alert"></div>
      <div class="botones" style="justify-content:flex-start"><button type="submit" class="btn" id="b2b-entrar-ok">Entrar</button><button type="button" class="btn-sec" id="b2b-cambiar-cfg">Cambiar configuración</button></div>
    </form></section>`;
  $('b2b-cambiar-cfg').addEventListener('click', () => pintarB2bConfig(el, sub, cx.cfg));
  $('b2b-form-entrar').addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = $('b2b-entrar-ok'); $('b2b-entrar-err').textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
    try { await B2b.entrar($('b2b-clave').value, (estado.equipo || {}).duracion === 'sesion'); pintarB2b(sub); }
    catch (e) { $('b2b-entrar-err').textContent = errorB2b(e); btn.disabled = false; btn.textContent = 'Entrar'; }
  });
}

function pintarB2bSinAdmin(el, sub, cx) {
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-adm">
    <h2 id="t-b2b-adm">Falta marcar tu cuenta como administración</h2>
    <p class="ayuda">Entraste a <b>${esc(cx.cfg.projectId)}</b> con <b>${esc(cx.correo)}</b>, pero esa cuenta todavía no está en <code>admins</code>. En la consola de Firebase de fen-b2b → Firestore Database → <b>Iniciar colección</b> <code>admins</code> → ID del documento:</p>
    <div class="aviso" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><code id="b2b-uid" style="font-size:15px;word-break:break-all">${esc(cx.uid)}</code><button type="button" class="btn-sec btn-chico" id="b2b-copiar-uid">Copiar</button></div>
    <p class="ayuda" style="margin-top:8px">Agrega un campo <code>ok</code> (booleano, true) y guarda. Después presiona Revisar.</p>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="b2b-revisar">Revisar</button></div></section>`;
  $('b2b-copiar-uid').addEventListener('click', () => { try { navigator.clipboard.writeText(cx.uid); $('b2b-copiar-uid').textContent = 'Copiado'; } catch (e) {} });
  $('b2b-revisar').addEventListener('click', () => pintarB2b(sub));
}

const cuadra = (a, b) => Math.round(Number(a) || 0) === Math.round(Number(b) || 0);
function tablaTotales(planilla, base) {
  const filas = [['Órdenes', planilla.ordenes, base.ordenes, false], ['Total de las órdenes', planilla.total, base.total, true], ['Neto de las órdenes', planilla.neto, base.neto, true],
    ['Abonos', planilla.abonos, base.abonos, false], ['Monto de los abonos', planilla.abonosMonto, base.abonosMonto, true],
    ['Clientes', planilla.clientes, base.clientes, false], ['Productos', planilla.productos, base.productos, false], ['Ediciones de órdenes', planilla.ediciones, base.ediciones, false]];
  const todo = filas.every(f => cuadra(f[1], f[2]));
  return `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">Planilla</th><th scope="col">Base nueva</th><th scope="col"><span class="sr">Cuadra</span></th></tr></thead><tbody>
    ${filas.map(([t, a, b, plata]) => `<tr><td>${t}</td><td>${plata ? pesos(a) : Number(a || 0).toLocaleString('es-CL')}</td><td>${plata ? pesos(b) : Number(b || 0).toLocaleString('es-CL')}</td><td>${cuadra(a, b) ? '<span class="chip c-verde">Cuadra</span>' : '<span class="chip c-rojo">No cuadra</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="${todo ? 'ok-texto' : 'error'}" style="margin-top:8px">${todo ? 'Todo cuadra: la base nueva tiene lo mismo que la planilla.' : 'Hay diferencias. Si recién copiaste, lee la planilla otra vez y copia lo que falte; si siguen, avísame.'}</p>`;
}

function pintarB2bBase(el, sub, cx) {
  const p = b2b.prep, t = b2b.tot;
  const ultima = t && t.ultima;
  const fechaUlt = ultima && ultima.ultima ? `${fechaCorta(ultima.ultima)} · ${hace(ultima.ultima)}` : '';
  let prepHtml = '';
  if (p) {
    const c = p.cambios;
    const enPlanilla = { clientes: p.planilla.clientes, productos: p.planilla.productos, ordenes: p.planilla.ordenes, abonos: p.planilla.abonos, ediciones: p.planilla.ediciones };
    const revisar = Object.values(p.docs.ordenes).filter(o => o.revisar.length);
    prepHtml = `<div class="tabla-b2b" style="margin-top:12px"><table class="tabla-tiempos"><thead><tr><th scope="col">Qué</th><th scope="col">En la planilla</th><th scope="col">Nuevos</th><th scope="col">Cambiaron</th><th scope="col">Ya no están ${info('Ya no están', 'Estaban en la copia anterior y ya no aparecen en la planilla (por ejemplo, una orden eliminada en la app B2B). En la base nueva no se borran: quedan marcados como "quitado de la planilla" y dejan de sumar.')}</th><th scope="col">Iguales</th></tr></thead><tbody>
      ${COLS_B2B.map(k => `<tr><td>${NOMBRES_B2B[k]}</td><td>${enPlanilla[k].toLocaleString('es-CL')}</td><td>${c[k].nuevos.length.toLocaleString('es-CL')}</td><td>${c[k].cambiados.length.toLocaleString('es-CL')}</td><td>${c[k].quitar.length.toLocaleString('es-CL')}</td><td>${c[k].iguales.toLocaleString('es-CL')}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="ayuda" style="margin-top:8px">${p.planilla.ordenes.toLocaleString('es-CL')} órdenes (${p.planilla.archivadas.toLocaleString('es-CL')} archivadas) con ${p.planilla.lineas.toLocaleString('es-CL')} líneas · ${pesos(p.planilla.total)} · ${p.planilla.precios} precios especiales · leída ${hace(new Date(p.leido))}</p>
      ${p.avisos.length ? `<details class="aviso" style="margin-top:10px"><summary><b>${p.avisos.length} ${p.avisos.length === 1 ? 'aviso' : 'avisos'} de la planilla</b> · no frenan la copia ${info('Avisos', 'Son cosas raras en la planilla: filas sin nombre, precios de clientes que no existen, una orden repetida o con el detalle que no suma lo mismo que el resumen. La copia las respeta tal cual (nada se pierde) y cada orden con algo raro queda marcada "para revisar".\nConviene corregirlas en la planilla con calma; no hay apuro.')}</summary>
        <ul>${p.avisos.slice(0, 200).map(a => `<li>${esc(a.hoja)}${a.fila ? ', fila ' + a.fila : ''}: ${esc(a.texto)}</li>`).join('')}${p.avisos.length > 200 ? `<li>… y ${p.avisos.length - 200} más</li>` : ''}</ul></details>` : ''}
      ${revisar.length ? `<p class="ayuda">${revisar.length === 1 ? '1 orden queda marcada' : revisar.length.toLocaleString('es-CL') + ' órdenes quedan marcadas'} para revisar (se ven en "Órdenes en la base nueva").</p>` : ''}
      <div class="botones" style="justify-content:flex-start;margin-top:12px"><button type="button" class="btn" id="b2b-copiar" ${p.porEscribir && !b2b.copiando ? '' : 'disabled'}>${p.porEscribir ? `Copiar ${p.porEscribir.toLocaleString('es-CL')} ${p.porEscribir === 1 ? 'cambio' : 'cambios'} a la base nueva` : 'Todo al día: no hay nada que copiar'}</button></div>
      <div id="b2b-avance" class="ayuda" aria-live="polite"></div>`;
  }
  let usoHtml = '<p class="ayuda">Lee la planilla para calcularlo.</p>';
  if (p) b2b.uso = { u: usoEstimado(p.docs, Caja.diaLocal()), clientes: p.planilla.clientes, productos: p.planilla.productos };
  if (b2b.uso) {
    const u = b2b.uso.u;
    usoHtml = `<p>Al abrir la app de logística se leerían unos <b>${u.porApertura.toLocaleString('es-CL')}</b> documentos (${b2b.uso.clientes} clientes, ${b2b.uso.productos} productos y ${u.ordenesRecientes} órdenes de los últimos 14 días o sin folio).</p>
      <p class="ayuda">Con ${u.aperturasDia} aperturas al día y ${u.ordenesDia === 1 ? 'una orden diaria' : 'unas ' + u.ordenesDia + ' órdenes diarias'}: cerca de <b>${u.lecturasDia.toLocaleString('es-CL')}</b> lecturas de ${u.limiteLecturas.toLocaleString('es-CL')} gratis (${Math.round(u.lecturasDia / u.limiteLecturas * 100)}%) y <b>${u.escriturasDia}</b> escrituras de ${u.limiteEscrituras.toLocaleString('es-CL')}.</p>`;
  }
  el.innerHTML = cabB2b(sub) + `
    <section class="tarjeta" aria-labelledby="t-b2b-cx"><div class="titulo-fila"><h2 id="t-b2b-cx">Conexión</h2><span class="chip c-verde">Conectada</span></div>
      <p class="ayuda">Proyecto <b>${esc(cx.cfg.projectId)}</b> · ${esc(cx.correo)}${fechaUlt ? ` · última copia ${esc(fechaUlt)}${ultima.por ? ' por ' + esc(ultima.por) : ''}` : ' · todavía sin copia'}</p>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-chico" id="b2b-cambiar-cfg">Cambiar configuración</button></div></section>
    ${cambioHtml()}
    <section class="tarjeta" aria-labelledby="t-b2b-copia"><h2 id="t-b2b-copia">Copia desde la planilla ${info('Copia desde la planilla', 'Lee todas las hojas de B2B (clientes, productos, precios, órdenes con su detalle, también las archivadas, abonos y ediciones) y las copia a la base nueva.\nSe puede repetir las veces que quieras: solo escribe lo que cambió desde la copia anterior. La planilla no se toca.\nHasta que exista la app de logística (v0.12), la planilla sigue mandando.')}</h2>
      <p class="ayuda">Primero se lee y se muestra qué cambiaría; recién al confirmar se escribe.</p>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn${p ? '-sec' : ''}" id="b2b-leer" ${b2b.copiando ? 'disabled' : ''}>${p ? 'Leer de nuevo' : 'Leer la planilla'}</button></div>
      <div class="error" id="b2b-error" role="alert">${esc(b2b.error)}</div>${b2b.msg ? `<p class="ok-texto" role="status">${esc(b2b.msg)}</p>` : ''}
      ${prepHtml}</section>
    <section class="tarjeta" aria-labelledby="t-b2b-tot"><h2 id="t-b2b-tot">Control de totales ${info('Control de totales', 'Compara lo que dice la planilla (en la última lectura o copia) con lo que suma Firestore en la base nueva. Las sumas las hace Firestore: cuestan muy poco (una lectura por cada mil documentos).')}</h2>
      <div id="b2b-tot-cont">${t && (p || (ultima && ultima.planilla)) ? tablaTotales(p ? p.planilla : ultima.planilla, t.base) : '<p class="ayuda">Todavía sin revisar.</p>'}</div>
      <div class="botones" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn-sec" id="b2b-totales">Revisar totales</button></div></section>
    <section class="tarjeta" aria-labelledby="t-b2b-pl"><h2 id="t-b2b-pl">Planilla ${info('Planilla de B2B', 'Hojas para Producción: Producción lee de la planilla de B2B las ventas por receta, el total de ventas y los cobros de cada mes. Antes se generaban con botones de la app antigua; ahora el script las genera solo cada noche (una vez instalado, ver README) y aquí puedes generarlas cuando quieras.\nFilas repetidas: órdenes ya archivadas cuyas líneas quedaron también en Detalle Ventas. Primero se cuentan; al sacarlas, el script guarda antes una copia completa de la hoja ("Detalle Ventas respaldo …") y solo saca las que son idénticas a las del histórico.')}</h2>
      <div class="fila-caja"><div class="txt"><b>Hojas para Producción</b><span>${b2b.hojas ? esc(b2b.hojas) : 'Ventas por receta, total de ventas y cobros por mes.'}</span></div><div class="acciones"><button type="button" class="btn-sec btn-chico" id="b2b-hojas">Generar ahora</button></div></div>
      <div class="fila-caja"><div class="txt"><b>Filas repetidas en Detalle Ventas</b><span>${b2b.repetidas ? b2b.repetidas.texto : 'Órdenes archivadas cuyas líneas siguen también en Detalle Ventas.'}</span></div><div class="acciones">${b2b.repetidas && b2b.repetidas.filas && !b2b.repetidas.limpiado ? `<button type="button" class="btn btn-chico" id="b2b-rep-sacar">Sacar ${b2b.repetidas.filas.toLocaleString('es-CL')} filas</button>` : ''}<button type="button" class="btn-sec btn-chico" id="b2b-rep-contar">${b2b.repetidas ? 'Revisar de nuevo' : 'Revisar'}</button></div></div>
      ${b2b.errPlanilla ? `<p class="error">${esc(b2b.errPlanilla)}</p>` : ''}</section>
    <section class="tarjeta" aria-labelledby="t-b2b-uso"><h2 id="t-b2b-uso">Uso estimado de Firebase ${info('Uso estimado', 'Cuánto gastaría la app de logística (v0.12) en el proyecto fen-b2b, que tiene su propia cuota gratis: 50.000 lecturas y 20.000 escrituras al día. La caja no se ve afectada.\nEs una estimación a partir de tus datos; cuando la app esté funcionando lo medimos en la consola de Firebase (Firestore → Uso).')}</h2>
      ${usoHtml}<p class="ayuda">En esta sesión: ${B2b.uso.lecturas.toLocaleString('es-CL')} lecturas y ${B2b.uso.escrituras.toLocaleString('es-CL')} escrituras en fen-b2b.</p></section>`;
  $('b2b-cambiar-cfg').addEventListener('click', () => pintarB2bConfig(el, sub, cx.cfg));
  const repintarBase = () => { if (vistaDesdeHash() === 'b2b' && subVista() === 'base') pintarB2bBase(el, sub, cx); };
  const trabajando = (id, txt) => { const b = $(id); if (b) { b.disabled = true; b.textContent = txt; } b2b.errPlanilla = ''; };
  $('b2b-hojas').addEventListener('click', async () => {
    trabajando('b2b-hojas', 'Generando…');
    try { const r = await B2b.opPlanilla('hojas_produccion'); const err = [r.errorVentas, r.errorTotal, r.errorCobros].filter(Boolean);
      b2b.hojas = err.length ? 'Con errores: ' + err.join(' · ') : `Generadas recién${r.tareaNocturna ? ' · se generan solas cada noche' : r.tareaNocturna === false ? ' · falta instalar la tarea de cada noche (ver README)' : ''}.`; registrar('Generó las hojas de B2B para Producción', ''); }
    catch (e) { b2b.errPlanilla = errorB2b(e); }
    repintarBase();
  });
  $('b2b-rep-contar').addEventListener('click', async () => {
    trabajando('b2b-rep-contar', 'Revisando…');
    try { const r = await B2b.opPlanilla('filas_repetidas'); b2b.repetidas = { filas: r.filas, texto: r.filas ? `${r.filas.toLocaleString('es-CL')} filas de ${r.ordenes.toLocaleString('es-CL')} órdenes archivadas son idénticas a las del histórico y se pueden sacar (de ${r.total.toLocaleString('es-CL')} filas).${r.nDistintas ? ` ${r.nDistintas} órdenes tienen líneas distintas y no se tocan (N° ${r.distintas.join(', ')}${r.nDistintas > r.distintas.length ? '…' : ''}).` : ''}` : `No hay filas repetidas.${r.nDistintas ? ` ${r.nDistintas} órdenes archivadas tienen líneas distintas y no se tocan.` : ''}` }; }
    catch (e) { b2b.errPlanilla = errorB2b(e); }
    repintarBase();
  });
  const bs = $('b2b-rep-sacar');
  if (bs) bs.addEventListener('click', async () => {
    if (!confirm(`Se sacarán ${b2b.repetidas.filas.toLocaleString('es-CL')} filas de Detalle Ventas (ya están en Detalle Ventas Historico).\n\nAntes se guarda una copia completa de la hoja. ¿Seguir?`)) return;
    trabajando('b2b-rep-sacar', 'Sacando…');
    try { const r = await B2b.opPlanilla('filas_repetidas', { limpiar: true }); b2b.repetidas = { filas: 0, limpiado: true, texto: `Listo: se sacaron ${r.filas.toLocaleString('es-CL')} filas; quedan ${r.quedan.toLocaleString('es-CL')}. Respaldo en la hoja "${esc(r.respaldo)}".` }; registrar('Sacó filas repetidas de Detalle Ventas', `${r.filas} filas · respaldo ${r.respaldo}`); }
    catch (e) { b2b.errPlanilla = errorB2b(e); }
    repintarBase();
  });
  conectarCambio(el, sub, cx);
  $('b2b-leer').addEventListener('click', async () => {
    const btn = $('b2b-leer'); btn.disabled = true; btn.textContent = 'Leyendo la planilla… (puede tardar un minuto)';
    b2b.error = ''; b2b.msg = '';
    try { b2b.prep = await B2b.preparar(); } catch (e) { b2b.error = errorB2b(e); }
    if (vistaDesdeHash() === 'b2b' && subVista() === 'base') pintarB2bBase(el, sub, cx);
  });
  $('b2b-totales').addEventListener('click', async () => {
    const btn = $('b2b-totales'); btn.disabled = true; btn.textContent = 'Sumando…';
    try { b2b.tot = await B2b.totales(); b2b.error = ''; } catch (e) { b2b.error = errorB2b(e); }
    if (vistaDesdeHash() === 'b2b' && subVista() === 'base') pintarB2bBase(el, sub, cx);
  });
  const bc = $('b2b-copiar');
  if (bc) bc.addEventListener('click', async () => {
    if (!confirm(`Se escribirán ${p.porEscribir.toLocaleString('es-CL')} documentos en la base nueva (fen-b2b). La planilla no cambia. ¿Seguir?`)) return;
    b2b.copiando = true; bc.disabled = true; $('b2b-leer').disabled = true; b2b.error = '';
    try {
      const r = await B2b.copiar(p, (h, n) => { const a = $('b2b-avance'); if (a) a.textContent = `Copiando… ${h.toLocaleString('es-CL')} de ${n.toLocaleString('es-CL')}`; });
      registrar('Copió la planilla de B2B a la base nueva', `${r.escritos} documentos`);
      b2b.msg = `Listo: ${r.escritos.toLocaleString('es-CL')} documentos copiados.`;
      b2b.prep = null;
    } catch (e) { b2b.error = errorB2b(e) + ' Lo copiado hasta ahí queda; vuelve a leer la planilla y copia lo que falte.'; }
    if (!b2b.error) { try { b2b.tot = await B2b.totales(); } catch (e) { b2b.error = 'La copia terminó bien, pero no se pudieron revisar los totales: ' + errorB2b(e); } }
    b2b.copiando = false;
    if (vistaDesdeHash() === 'b2b' && subVista() === 'base') pintarB2bBase(el, sub, cx);
  });
}

function filaOrdenB2b(o) {
  const chips = [o.quitadoEnPlanilla ? '<span class="chip c-gris">Quitada de la planilla</span>' : '', o.archivada ? '<span class="chip c-gris">Archivada</span>' : '',
    o.folio ? `<span class="chip c-azul">Folio ${esc(o.folio)}</span>` : '<span class="chip c-gris">Sin folio</span>',
    `<span class="chip ${/PAGADO/.test(o.estadoPago) ? 'c-verde' : 'c-gris'}">${esc(o.estadoPago || 'PENDIENTE')}</span>`,
    (o.revisar || []).length ? '<span class="chip c-rojo">Revisar</span>' : ''].join('');
  return `<details class="fila-orden-b2b"><summary class="fila-caja"><div class="txt"><b>N° ${esc(o.n)} · ${esc(o.cliente || '—')}</b><span>${esc(diaTexto(o.fecha))} ${esc((o.fecha || '').slice(0, 4))} · ${pesos(o.total)} · ${(o.lineas || []).length} ${(o.lineas || []).length === 1 ? 'línea' : 'líneas'}</span></div><div class="acciones">${chips}</div></summary>
    <div style="padding:4px 0 12px">
      ${(o.revisar || []).length ? `<div class="aviso aviso-rojo" style="margin-bottom:8px">${o.revisar.map(esc).join(' · ')}</div>` : ''}
      <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio neto</th><th scope="col">Total</th></tr></thead><tbody>
      ${(o.lineas || []).map(l => `<tr><td>${esc(l.producto)}</td><td>${esc(l.cantidad)}</td><td>${pesos(l.precio)}</td><td>${pesos(l.total)}</td></tr>`).join('') || '<tr><td colspan="4">Sin líneas</td></tr>'}
      </tbody></table></div>
      <p class="ayuda" style="margin-top:6px">Neto ${pesos(o.neto)} · IVA ${pesos(o.iva)} · Total ${pesos(o.total)}${o.fechaPago ? ' · pagada ' + esc(o.fechaPago) : ''}${o.obs ? ' · ' + esc(o.obs) : ''} · ${(o.origen || {}).hoja ? `de ${esc(o.origen.hoja)}, fila ${esc(o.origen.fila)}` : (o.creada && o.creada.por ? 'creada en la app de logística por ' + esc(o.creada.por) : 'creada en la app de logística')}${o.estado === 'anulada' && o.anulada ? ` · anulada: ${esc(o.anulada.motivo)}` : ''}</p>
      <div class="botones" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn-sec btn-chico" data-ver-pdf="${o.n}">Ver PDF</button></div>
    </div></details>`;
}
async function pintarB2bOrdenes(el, sub) {
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-ord"><h2 id="t-b2b-ord">Buscar órdenes ${info('Para qué sirve', 'Para revisar que la copia quedó bien: busca una orden y compárala con la planilla o con la app B2B.\nCada búsqueda gasta una lectura por orden que muestra.')}</h2>
    <form id="b2b-buscar" class="fila-filtros" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="campo" style="flex:1 1 220px"><label for="b2b-q">N° de orden, folio o mes (AAAA-MM)</label><input id="b2b-q" inputmode="numeric" placeholder="Ej: 1002, 5512 o 2026-09"></div>
      <button type="submit" class="btn">Buscar</button><button type="button" class="btn-sec" id="b2b-ultimas">Últimas 30</button></form>
    <div class="error" id="b2b-ord-err" role="alert"></div><div id="b2b-ord-lista"><div class="vacio">Cargando…</div></div></section>`;
  const mostrarLista = async (fn) => {
    const cont = $('b2b-ord-lista'); $('b2b-ord-err').textContent = ''; cont.innerHTML = '<div class="vacio">Buscando…</div>';
    try {
      const l = await fn();
      l.forEach(o => b2bVistas.set(String(o.n), o));
      cont.innerHTML = l.length ? `<p class="ayuda">${l.length} ${l.length === 1 ? 'orden' : 'órdenes'}${l.length ? ' · ' + pesos(l.filter(o => !o.quitadoEnPlanilla).reduce((s, o) => s + (o.total || 0), 0)) : ''}</p>` + l.map(filaOrdenB2b).join('') : '<div class="vacio">No hay órdenes con eso.</div>';
    } catch (e) { cont.innerHTML = ''; $('b2b-ord-err').textContent = errorB2b(e); }
  };
  $('b2b-buscar').addEventListener('submit', ev => { ev.preventDefault(); mostrarLista(() => B2b.buscarOrdenes($('b2b-q').value)); });
  $('b2b-ultimas').addEventListener('click', () => mostrarLista(() => B2b.ultimasOrdenes(30)));
  mostrarLista(() => B2b.ultimasOrdenes(30));
}

// ── v0.12 · Ventas B2B: administración sobre la base nueva ──
const b2bVistas = new Map();   // órdenes mostradas en Buscar (para el PDF)
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-ver-pdf]'); if (!b) return;
  ev.preventDefault();
  const n = b.dataset.verPdf;
  let o = (b2b.datos && b2b.datos.ordenes.get(n)) || b2bVistas.get(n);
  if (!o) { try { o = (await B2b.buscarOrdenes(n)).find(x => String(x.n) === String(n)); } catch (e) {} }
  if (!o) { alert('No se encontró la orden.'); return; }
  b.disabled = true; b.textContent = 'Generando…';
  try { const d = await B2b.datosPdf(o); await PdfOrden.descargar(o, d.cliente, d.originales, d.ediciones, true); }
  catch (e) { alert('No se pudo hacer el PDF: ' + (e.message || e)); }
  b.disabled = false; b.textContent = 'Ver PDF';
});
function b2bEscuchar(sub) {
  if (b2b.vivo) return;
  b2b.datos = { ordenes: new Map(), abonos: [], solicitudes: [], config: null, clientes: [], productos: [], movimientos: [] };
  B2b.escuchar((d, e) => {
    b2b.datos = d; b2b.errVivo = e ? errorB2b(e) : '';
    if (vistaDesdeHash() !== 'b2b') return;
    const s = subVista();
    if (document.querySelector('dialog[open]')) return;   // no se repinta con una ventana abierta
    const activa = !!(d.config && d.config.activa);
    if (s === '') pintarB2bAdmin($('v-b2b'), s);
    else if (s === 'solicitudes') pintarB2bSolicitudes($('v-b2b'), s);
    else if (s === 'clientes') pintarB2bClientes($('v-b2b'), s);
    else if (s === 'productos') pintarB2bProductos($('v-b2b'), s);
    else if (s === 'conciliacion') { if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#v-b2b .mov-edit')) b2bConc.repintar = true; else pintarB2bConciliacion($('v-b2b'), s); }
    else if (s === 'analisis' && !document.getElementById('t-an')) pintarB2bAnalisis($('v-b2b'), s);   // solo la primera vez (lee por su cuenta)
    else if (s === 'cuenta' && !b2bCuenta.tocado) pintarB2bCuenta($('v-b2b'), s);
    else if (s === 'base' && b2b.activaVista !== activa && !b2b.cambiando && !b2b.copiando) pintarB2b(s);
    b2b.activaVista = activa;
  }).then(f => { b2b.vivo = f; }).catch(e => { b2b.errVivo = errorB2b(e); b2b.datos = { ordenes: new Map(), abonos: [], solicitudes: [], config: null, clientes: [], productos: [], movimientos: [] }; if (vistaDesdeHash() === 'b2b' && subVista() === '') pintarB2bAdmin($('v-b2b'), ''); });
}
// Ventana con campos; leer(d) devuelve { error } o los valores
function pedirDatos(titulo, html, boton, leer) {
  return new Promise(ok => {
    const d = dialogo(`<form class="form-dialogo" novalidate><h2>${esc(titulo)}</h2>${html}<div class="error" id="pd-error" role="alert"></div>
      <div class="botones"><button type="button" class="btn-sec" id="pd-no">Cancelar</button><button type="submit" class="btn" id="pd-si">${esc(boton)}</button></div></form>`);
    let listo = false;
    d.querySelector('#pd-no').onclick = () => d.close();
    d.addEventListener('close', () => { if (!listo) ok(null); });
    d.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const r = leer(d);
      if (r && r.error) { d.querySelector('#pd-error').textContent = r.error; return; }
      listo = true; d.close(); ok(r);
    });
    const p = d.querySelector('input, select, textarea'); if (p) p.focus();
  });
}
const b2bOrdenes = () => [...((b2b.datos && b2b.datos.ordenes) || new Map()).values()].filter(o => !o.quitadoEnPlanilla && o.estado !== 'anulada' && !o.archivada);
function lineasHtml(o) {
  return `<div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Producto</th><th scope="col">Cant.</th><th scope="col">Precio neto</th><th scope="col">Total</th></tr></thead><tbody>
    ${(o.lineas || []).map(l => `<tr><td>${esc(l.producto)}</td><td>${esc(l.cantidad)}</td><td>${pesos(l.precio)}</td><td>${pesos(l.total)}</td></tr>`).join('')}</tbody></table></div>
    <p class="ayuda" style="margin-top:6px">Neto ${pesos(o.neto)} · IVA ${pesos(o.iva)} · Total ${pesos(o.total)}${o.obs ? ' · ' + esc(o.obs) : ''}${o.creada && o.creada.por ? ' · creada por ' + esc(o.creada.por) : ''}${o.editada ? ` · editada ${o.editada.veces} ${o.editada.veces === 1 ? 'vez' : 'veces'}` : ''}</p>
    <div class="botones" style="justify-content:flex-start;margin:8px 0 12px"><button type="button" class="btn-sec btn-chico" data-ver-pdf="${o.n}">Ver PDF</button></div>`;
}
// Tarjetas de Ventas B2B → Órdenes que se pliegan; se recuerda en este equipo (si el navegador lo permite)
const K_PLEG = 'fen_b2b_plegadas';
let plegadasMem = null;
function plegadas() { if (!plegadasMem) { try { plegadasMem = JSON.parse(localStorage.getItem(K_PLEG) || '{}') || {}; } catch (e) { plegadasMem = {}; } } return plegadasMem; }
const plegada = k => plegadas()[k] !== false;   // cerradas hasta que se abran: así se ve de qué está hecha la sección
function plegar(k, si) { plegadas()[k] = si; try { localStorage.setItem(K_PLEG, JSON.stringify(plegadasMem)); } catch (e) {} }
function pintarB2bAdmin(el, sub) {
  const d = b2b.datos, cfg = d && d.config;
  if (!d || !cfg) { el.innerHTML = cabB2b(sub) + `<section class="tarjeta"><div class="vacio" style="border:0">${b2b.errVivo ? esc(b2b.errVivo) : 'Cargando órdenes…'}</div></section>`; return; }
  if (!cfg.activa) {
    el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-noact"><h2 id="t-b2b-noact">Todavía se usa la app B2B de siempre</h2>
      <p class="ayuda">Aquí vas a asignar folios, registrar pagos y abonos, anular órdenes y responder solicitudes cuando cambies a la base nueva. El cambio se hace en <a href="#b2b/base">Base nueva</a>.</p></section>`;
    return;
  }
  const os = b2bOrdenes();
  const pendPlan = [...d.ordenes.values()].filter(o => o.planillaPendiente).length + (d.clientes || []).filter(c => c.planillaPendiente).length + (d.productos || []).filter(p => p.planillaPendiente).length;
  // Por facturar: sin folio, agrupadas por cliente
  const porFecha = (a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || a.n - b.n;   // por fecha de la orden (no por N° ni por edición)
  const sinFolio = os.filter(o => !o.folio).sort(porFecha);
  const porCliente = {};
  sinFolio.forEach(o => { (porCliente[o.cliente] = porCliente[o.cliente] || []).push(o); });
  // Por cobrar: con folio y sin pagar, agrupadas por folio
  const abonadoFolio = {};
  d.abonos.forEach(a => { abonadoFolio[a.folio] = (abonadoFolio[a.folio] || 0) + (Number(a.monto) || 0); });
  const porFolio = {};
  os.filter(o => o.folio && !/PAGADO/.test(o.estadoPago || '')).forEach(o => { (porFolio[o.folio] = porFolio[o.folio] || []).push(o); });
  Object.values(porFolio).forEach(l => l.sort(porFecha));
  const folios = Object.keys(porFolio).sort((a, b) => porFecha(porFolio[a][0], porFolio[b][0]));
  // Según cómo factura el cliente (Diaria / Semanal / Mensual, en Clientes): las órdenes que ya corresponde facturar
  const norm = t => String(t || '').trim().toLowerCase();
  const cliDe = nombre => { const os1 = porCliente[nombre] || [], id = os1.map(o => o.clienteId).find(Boolean); return (d.clientes || []).find(x => (id && x.id === id) || norm(x.nombre) === norm(nombre)); };
  const modalidad = nombre => { const cl = cliDe(nombre), f = (cl && cl.facturacion) || 'Diaria'; return `Factura ${f.toLowerCase()}${cl && cl.facturacion ? '' : ' (sin modalidad en Clientes)'}`; };
  const tocan = nombre => { const cl = cliDe(nombre); return (porCliente[nombre] || []).filter(o => B2b.correspondeFacturar((cl && cl.facturacion) || 'Diaria', o.fecha)); };
  const sel = [...b2b.sel].filter(n => sinFolio.some(o => String(o.n) === n));
  b2b.sel = new Set(sel);
  el.innerHTML = cabB2b(sub) + `
    <details class="tarjeta plegable" data-plegar="plan" ${plegada('plan') ? '' : 'open'}><summary class="titulo-fila"><h2 id="t-b2b-plan">Copia en la planilla ${info('Copia en la planilla', 'Cada orden nueva, edición, folio, pago, abono y anulación pasa sola a la planilla (Resumen Facturas, Detalle Ventas, Abonos), en general en segundos. Así Looker y Hoy siguen igual.\nSi algo queda pendiente (por ejemplo, sin internet), se reintenta solo; también puedes presionar "Pasar ahora".')}</h2>
      <span class="chip ${pendPlan ? 'c-amarillo' : 'c-verde'}">${pendPlan ? pendPlan + ' por pasar' : 'Al día'}</span></summary>
      <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-chico" id="b2b-pasar">Pasar ahora</button></div>
      ${b2b.planilla ? `<p class="ayuda" role="status">${esc(b2b.planilla)}</p>` : ''}${b2b.errVivo ? `<p class="error">${esc(b2b.errVivo)}</p>` : ''}</details>
    <details class="tarjeta plegable" data-plegar="fact" ${plegada('fact') ? '' : 'open'}><summary class="titulo-fila"><h2 id="t-b2b-fact">Por facturar</h2><span>${Object.keys(porCliente).length} ${Object.keys(porCliente).length === 1 ? 'cliente' : 'clientes'} · ${sinFolio.length} ${sinFolio.length === 1 ? 'orden' : 'órdenes'} · ${pesos(sinFolio.reduce((s, o) => s + o.total, 0))}</span></summary>
      ${Object.keys(porCliente).sort((a, b) => a.localeCompare(b, 'es')).map(c => { const mc = porCliente[c].filter(o => b2b.sel.has(String(o.n))), todas = mc.length === porCliente[c].length; return `<div class="grupo-b2b"><div class="cab-cliente-b2b"><div><b>${esc(c)}</b><span>${porCliente[c].length} · ${pesos(porCliente[c].reduce((s, o) => s + o.total, 0))} · ${esc(modalidad(c).toLowerCase())}</span></div>
        <div class="acciones">${tocan(c).length && tocan(c).length < porCliente[c].length ? `<button type="button" class="btn-sec btn-chico" data-tocan-cli="${esc(c)}" >Marcar las que tocan (${tocan(c).length})</button>` : ''}<button type="button" class="btn-sec btn-chico" data-marcar-cli="${esc(c)}">${todas ? 'Desmarcar' : 'Marcar todas'}</button>${mc.length ? `<button type="button" class="btn-sec btn-chico" data-pdf-cli="${esc(c)}">PDF de ${mc.length}</button><button type="button" class="btn btn-chico" data-folio-cli="${esc(c)}">Asignar folio a ${mc.length} · ${pesos(mc.reduce((s, o) => s + o.total, 0))}</button>` : ''}</div></div>
        ${porCliente[c].map(o => `<details class="fila-orden-b2b"><summary class="fila-caja"><label class="check-b2b" onclick="event.stopPropagation()"><input type="checkbox" data-sel="${o.n}" ${b2b.sel.has(String(o.n)) ? 'checked' : ''} aria-label="Marcar orden ${o.n}"></label><div class="txt"><b>N° ${o.n}</b><span>${esc(diaTexto(o.fecha))} · ${pesos(o.total)}${o.planillaPendiente ? ' · por pasar a la planilla' : ''}</span></div><div class="acciones"><button type="button" class="btn-sec btn-chico btn-peligro" data-anular-o="${o.n}">Anular</button></div></summary>${lineasHtml(o)}</details>`).join('')}</div>`; }).join('') || '<div class="vacio" style="border:0">No hay órdenes sin folio.</div>'}
      ${sinFolio.length ? `<p class="ayuda" style="margin-top:10px">Marca las órdenes que van en la misma factura: el botón "Asignar folio" aparece junto al nombre del cliente. Un folio es de un solo cliente. ${info('Marcar las que tocan', 'Marca solo las órdenes que ya corresponde facturar según cómo factura el cliente (se cambia en Clientes):\nDiaria: las de días anteriores a hoy.\nSemanal: las de semanas anteriores (lunes a domingo).\nMensual: las de meses anteriores.\nSi el cliente no tiene modalidad, se toma como diaria. El botón aparece solo cuando hay órdenes que todavía no tocan.')}</p>` : ''}</details>
    <details class="tarjeta plegable" data-plegar="cob" ${plegada('cob') ? '' : 'open'}><summary class="titulo-fila"><h2 id="t-b2b-cob">Por cobrar</h2><span>${folios.length} ${folios.length === 1 ? 'folio' : 'folios'} · saldo ${pesos(folios.reduce((s, f) => s + Math.max(0, porFolio[f].reduce((x, o) => x + o.total, 0) - (abonadoFolio[f] || 0)), 0))}</span></summary>
      ${folios.map(f => { const l = porFolio[f], tot = l.reduce((s, o) => s + o.total, 0), ab = abonadoFolio[f] || 0; return `<div class="fila-caja"><div class="txt"><b>Folio ${esc(f)} · ${esc([...new Set(l.map(o => o.cliente))].join(', '))}</b><span>${l.length} ${l.length === 1 ? 'orden' : 'órdenes'} (N° ${l.map(o => o.n).join(', ')}) · ${pesos(tot)}${ab ? ` · abonado ${pesos(ab)} · saldo ${pesos(Math.max(0, tot - ab))}` : ''}${l[0].fechaFolio ? ' · folio del ' + esc(diaTexto(l[0].fechaFolio)) : ''}</span></div>
        <div class="acciones">${ab ? '<span class="chip c-amarillo">Parcial</span>' : ''}<button type="button" class="btn-sec btn-chico" data-abono="${esc(f)}">Abono</button><button type="button" class="btn-sec btn-chico" data-pago="${esc(f)}">Pagado</button></div></div>`; }).join('') || '<div class="vacio" style="border:0">No hay folios por cobrar.</div>'}</details>`;
  el.querySelectorAll('details[data-plegar]').forEach(dt => dt.addEventListener('toggle', () => plegar(dt.dataset.plegar, !dt.open)));
  el.querySelectorAll('[data-sel]').forEach(c => c.addEventListener('change', () => { if (c.checked) b2b.sel.add(c.dataset.sel); else b2b.sel.delete(c.dataset.sel); pintarB2bAdmin(el, sub); }));
  $('b2b-pasar').addEventListener('click', async () => {
    const b = $('b2b-pasar'); b.disabled = true; b.textContent = 'Pasando…';
    try { const r = await B2b.pasarAPlanilla(); b2b.planilla = `Listo: ${r.ordenes} ${r.ordenes === 1 ? 'orden' : 'órdenes'}, ${r.abonos} ${r.abonos === 1 ? 'abono' : 'abonos'} y ${r.ediciones} ${r.ediciones === 1 ? 'edición' : 'ediciones'}${r.clientes ? `, ${r.clientes} ${r.clientes === 1 ? 'cliente' : 'clientes'}` : ''}${r.productos ? `, ${r.productos} ${r.productos === 1 ? 'producto' : 'productos'}` : ''} pasaron a la planilla${r.quedan ? ` · ${r.quedan} cambiaron mientras tanto (pasan en la próxima)` : ''}${r.errores && r.errores.length ? ' · ' + r.errores.join(' · ') : ''}.`; }
    catch (e) { b2b.planilla = 'No se pudo: ' + errorB2b(e); }
    pintarB2bAdmin(el, sub);
  });
  el.querySelectorAll('[data-tocan-cli]').forEach(b => b.addEventListener('click', () => {
    (porCliente[b.dataset.tocanCli] || []).forEach(o => b2b.sel.delete(String(o.n)));
    tocan(b.dataset.tocanCli).forEach(o => b2b.sel.add(String(o.n)));
    pintarB2bAdmin(el, sub);
  }));
  el.querySelectorAll('[data-marcar-cli]').forEach(b => b.addEventListener('click', () => {
    const l = porCliente[b.dataset.marcarCli] || [], todas = l.every(o => b2b.sel.has(String(o.n)));
    l.forEach(o => todas ? b2b.sel.delete(String(o.n)) : b2b.sel.add(String(o.n)));
    pintarB2bAdmin(el, sub);
  }));
  // v0.14.2: PDF de las órdenes marcadas (una hoja por orden, o un resumen)
  el.querySelectorAll('[data-pdf-cli]').forEach(bp => bp.addEventListener('click', async () => {
    const lista = (porCliente[bp.dataset.pdfCli] || []).filter(o => b2b.sel.has(String(o.n)));
    if (!lista.length) return;
    const r = await pedirDatos('PDF de las órdenes marcadas', `<p class="ayuda">${lista.length} ${lista.length === 1 ? 'orden' : 'órdenes'} (N° ${lista.map(o => o.n).join(', ')}) · ${esc(bp.dataset.pdfCli)} · <b>${pesos(lista.reduce((s, o) => s + o.total, 0))}</b></p>
      <fieldset class="opciones-pdf"><legend class="sr">Tipo de PDF</legend>
        <label><input type="radio" name="pd-tipo" value="hojas" checked> <span><b>Una hoja por orden</b><small>Cada orden igual a su PDF de siempre, todas en un solo archivo.</small></span></label>
        <label><input type="radio" name="pd-tipo" value="resumen"> <span><b>Resumen</b><small>El detalle de cada orden una tras otra, el total por producto y el total a facturar.</small></span></label></fieldset>`, 'Descargar PDF',
      dd => ({ tipo: dd.querySelector('input[name="pd-tipo"]:checked').value }));
    if (!r) return;
    const txt = bp.textContent; bp.disabled = true; bp.textContent = 'Generando…';
    try {
      const ordenes = lista.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.n - b.n);
      if (r.tipo === 'resumen') {
        const cli = d.clientes.find(x => x.id === ordenes[0].clienteId) || cliDe(bp.dataset.pdfCli) || { nombre: bp.dataset.pdfCli };
        await PdfOrden.resumenOrdenes(ordenes, cli, false);
      } else {
        const datos = [];
        for (const o of ordenes) { const x = await B2b.datosPdf(o); datos.push({ orden: o, ...x }); }
        await PdfOrden.variasOrdenes(datos, false);
      }
      registrar('Descargó PDF de órdenes', `${r.tipo === 'resumen' ? 'Resumen' : 'Una hoja por orden'} · N° ${lista.map(o => o.n).join(', ')}`);
    } catch (e) { alert('No se pudo hacer el PDF: ' + (e.message || e)); }
    bp.disabled = false; bp.textContent = txt;
  }));
  el.querySelectorAll('[data-folio-cli]').forEach(bf => bf.addEventListener('click', async () => {
    const lista = (porCliente[bf.dataset.folioCli] || []).filter(o => b2b.sel.has(String(o.n)));
    const ns = lista.map(o => o.n).sort((a, b) => a - b);
    const totalSel = lista.reduce((s, o) => s + o.total, 0);
    const clientes = [...new Set(lista.map(o => o.cliente))];
    const r = await pedirDatos('Asignar folio', `<p class="ayuda">${ns.length} ${ns.length === 1 ? 'orden' : 'órdenes'} (N° ${ns.join(', ')}) · ${esc(clientes.join(', '))} · <b>${pesos(totalSel)}</b></p>
      <div class="fila-campos"><div class="campo"><label for="pd-folio">Folio SII</label><input id="pd-folio" inputmode="numeric" placeholder="Ej: 5512"></div>
      <div class="campo"><label for="pd-fecha">Fecha del folio</label><input id="pd-fecha" type="date" value="${Caja.diaLocal()}"></div></div>`, 'Asignar folio',
      dd => { const f = dd.querySelector('#pd-folio').value.trim(); if (!/^\d{1,12}$/.test(f)) return { error: 'Escribe el número de folio.' }; return { folio: f, fecha: dd.querySelector('#pd-fecha').value }; });
    if (!r) return;
    try {
      const usado = await B2b.folioUsado(r.folio);
      const mismoCli = u => (u.clienteId && lista[0].clienteId) ? u.clienteId === lista[0].clienteId : String(u.cliente).trim().toLowerCase() === String(lista[0].cliente).trim().toLowerCase();
      if (usado.some(u => !mismoCli(u))) { alert(`El folio ${r.folio} ya es de ${usado[0].cliente} (N° ${usado.map(u => u.n).join(', ')}).\n\nUn folio es de un solo cliente: revisa el número.`); return; }
      if (usado.length && !confirm(`El folio ${r.folio} ya está en ${usado.length === 1 ? 'la orden' : 'las órdenes'} N° ${usado.map(u => u.n).join(', ')} de ${lista[0].cliente}. ¿Agregar estas órdenes al mismo folio?`)) return;
      await B2b.asignarFolio(ns, r.folio, r.fecha);
      registrar('Asignó folio B2B', `Folio ${r.folio} · N° ${ns.join(', ')}`);
      ns.forEach(n => b2b.sel.delete(String(n))); B2b.pasarAPlanilla().catch(() => {});
    } catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-pago]').forEach(b => b.addEventListener('click', async () => {
    const f = b.dataset.pago, l = porFolio[f], tot = l.reduce((s, o) => s + o.total, 0);
    const r = await pedirDatos(`Folio ${f} pagado`, `<p class="ayuda">${l.length} ${l.length === 1 ? 'orden' : 'órdenes'} · ${pesos(tot)}${abonadoFolio[f] ? ` · ya abonado ${pesos(abonadoFolio[f])}` : ''}</p>
      <div class="campo"><label for="pd-fecha">Fecha de pago</label><input id="pd-fecha" type="date" value="${Caja.diaLocal()}"></div>`, 'Marcar pagado', dd => ({ fecha: dd.querySelector('#pd-fecha').value }));
    if (!r) return;
    try { const n = await B2b.registrarPago(f, r.fecha); registrar('Registró pago B2B', `Folio ${f} · ${n} órdenes · ${r.fecha}`); B2b.pasarAPlanilla().catch(() => {}); }
    catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-abono]').forEach(b => b.addEventListener('click', async () => {
    const f = b.dataset.abono, l = porFolio[f], tot = l.reduce((s, o) => s + o.total, 0), ab = abonadoFolio[f] || 0;
    const r = await pedirDatos(`Abono al folio ${f}`, `<p class="ayuda">Total ${pesos(tot)}${ab ? ` · ya abonado ${pesos(ab)}` : ''} · saldo ${pesos(Math.max(0, tot - ab))}</p>
      <div class="fila-campos"><div class="campo"><label for="pd-monto">Monto</label><input id="pd-monto" inputmode="numeric" placeholder="Ej: 50000"></div>
      <div class="campo"><label for="pd-fecha">Fecha</label><input id="pd-fecha" type="date" value="${Caja.diaLocal()}"></div></div>
      <div class="campo"><label for="pd-ref">Referencia</label><input id="pd-ref" placeholder="Ej: transferencia"></div>
      <p class="ayuda">Si con este abono se completa el total, el folio queda pagado.</p>`, 'Registrar abono',
      dd => { const m = Math.round(Number(String(dd.querySelector('#pd-monto').value).replace(/[^\d]/g, ''))); if (!(m > 0)) return { error: 'Escribe el monto.' }; return { monto: m, fecha: dd.querySelector('#pd-fecha').value, ref: dd.querySelector('#pd-ref').value }; });
    if (!r) return;
    try { const x = await B2b.registrarAbono(f, r.monto, r.fecha, r.ref); registrar('Registró abono B2B', `Folio ${f} · ${pesos(r.monto)}${x.pagado ? ' · pagado' : ''}`); B2b.pasarAPlanilla().catch(() => {}); }
    catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-anular-o]').forEach(b => b.addEventListener('click', async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const o = d.ordenes.get(b.dataset.anularO);
    const motivo = await pedirMotivo(`Anular orden N° ${o.n}`, `<p class="ayuda"><b>${esc(o.cliente)}</b> · ${esc(diaTexto(o.fecha))} · ${pesos(o.total)}</p>
      <p class="ayuda">No se borra: queda anulada con el motivo. En la planilla sale de Resumen Facturas y Detalle Ventas y pasa a la pestaña "Ordenes anuladas".</p>`, 'Anular');
    if (!motivo) return;
    try { await B2b.anularOrden(o.n, motivo); registrar('Anuló una orden B2B', `N° ${o.n} · ${motivo}`); b2b.sel.delete(String(o.n)); B2b.pasarAPlanilla().catch(() => {}); }
    catch (e) { alert(errorB2b(e)); }
  }));
}

function pintarB2bSolicitudes(el, sub) {
  const d = b2b.datos;
  const l = d ? [...d.solicitudes].sort((a, b) => ((a.en && a.en.toMillis && a.en.toMillis()) || 0) - ((b.en && b.en.toMillis && b.en.toMillis()) || 0)) : [];
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-sol"><h2 id="t-b2b-sol">Solicitudes de logística ${info('Solicitudes', 'La persona de logística pide un precio especial para un cliente, o agregar a B2B un producto que ya existe en Producción.\nAl aprobar, el precio o el producto aparecen al tiro en su app. Puedes cambiar el precio antes de aprobar.')}</h2>
    ${!d ? '<div class="vacio" style="border:0">Cargando…</div>' : l.map(s => s.tipo === 'anulacion' ? `<div class="fila-caja"><div class="txt"><b>Anular orden N° ${esc(s.n)}${s.cliente ? ' · ' + esc(s.cliente) : ''}</b>
      <span>${pesos(s.precio)} · ${esc(s.por || '')} · "${esc(s.nota || '')}"</span></div>
      <div class="acciones"><button type="button" class="btn-sec btn-chico" data-ver-pdf="${esc(s.n)}">Ver PDF</button><button type="button" class="btn-sec btn-chico" data-rechazar="${esc(s.id)}">Rechazar</button><button type="button" class="btn-sec btn-chico btn-peligro" data-aprobar="${esc(s.id)}">Anular</button></div></div>` : `<div class="fila-caja"><div class="txt"><b>${s.tipo === 'precio' ? 'Precio especial' : 'Producto nuevo'}: ${esc(s.producto)}${s.cliente ? ' · ' + esc(s.cliente) : ''}</b>
      <span>Propone ${pesos(s.precio)} neto${s.area ? ' · ' + esc(s.area) : ''} · ${esc(s.por || '')}${s.nota ? ' · "' + esc(s.nota) + '"' : ''}</span></div>
      <div class="acciones"><button type="button" class="btn-sec btn-chico btn-peligro" data-rechazar="${esc(s.id)}">Rechazar</button><button type="button" class="btn-sec btn-chico" data-aprobar="${esc(s.id)}">Aprobar</button></div></div>`).join('') || '<div class="vacio" style="border:0">No hay solicitudes pendientes.</div>'}</section>`;
  el.querySelectorAll('[data-aprobar]').forEach(b => b.addEventListener('click', async () => {
    const s = l.find(x => x.id === b.dataset.aprobar);
    if (s.tipo === 'anulacion') {
      if (!confirm(`¿Anular la orden N° ${s.n} (${s.cliente || ''})?\n\nMotivo de logística: ${s.nota || '—'}\n\nNo se borra: queda anulada y en la planilla pasa a "Ordenes anuladas".`)) return;
      try { await B2b.aprobarSolicitud(s, 0, 'Anulada'); registrar('Anuló una orden B2B (pedido de logística)', `N° ${s.n} · ${s.nota || ''}`); B2b.pasarAPlanilla().catch(() => {}); }
      catch (e) { alert(errorB2b(e)); }
      return;
    }
    const r = await pedirDatos(s.tipo === 'precio' ? `Precio especial para ${s.cliente}` : `Agregar ${s.producto} a B2B`,
      `<p class="ayuda">${s.tipo === 'precio' ? `<b>${esc(s.producto)}</b> para <b>${esc(s.cliente)}</b>.` : `Queda como producto de B2B con este <b>precio base</b> (para todos los clientes)${s.idReceta ? `, vinculado a la receta ${esc(s.idReceta)}` : ''}.`}</p>
      <div class="campo"><label for="pd-precio">Precio neto</label><input id="pd-precio" inputmode="numeric" value="${esc(s.precio)}"></div>
      <div class="campo"><label for="pd-resp">Respuesta (opcional)</label><input id="pd-resp" placeholder="Ej: aprobado desde el lunes"></div>`, 'Aprobar',
      dd => { const p = Math.round(Number(String(dd.querySelector('#pd-precio').value).replace(/[^\d]/g, ''))); if (!(p > 0)) return { error: 'Escribe el precio.' }; return { precio: p, resp: dd.querySelector('#pd-resp').value }; });
    if (!r) return;
    try { await B2b.aprobarSolicitud(s, r.precio, r.resp); registrar('Aprobó solicitud B2B', `${s.tipo === 'precio' ? 'Precio' : 'Producto'} ${s.producto}${s.cliente ? ' · ' + s.cliente : ''} · ${pesos(r.precio)}`); }
    catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-rechazar]').forEach(b => b.addEventListener('click', async () => {
    const s = l.find(x => x.id === b.dataset.rechazar);
    const motivo = await pedirMotivo('Rechazar solicitud', `<p class="ayuda">${esc(s.producto)}${s.cliente ? ' · ' + esc(s.cliente) : ''} · ${pesos(s.precio)}</p><p class="ayuda">El motivo le llega como respuesta.</p>`, 'Rechazar');
    if (!motivo) return;
    try { await B2b.rechazarSolicitud(s, motivo); registrar('Rechazó solicitud B2B', `${s.producto} · ${motivo}`); }
    catch (e) { alert(errorB2b(e)); }
  }));
}

function cambioHtml() {
  const cfg = b2b.datos && b2b.datos.config;
  if (!cfg) return '';
  return `<section class="tarjeta" aria-labelledby="t-b2b-cambio"><div class="titulo-fila"><h2 id="t-b2b-cambio">Cambio a la base nueva ${info('Cambiar a la base nueva', 'Al cambiar:\n1) La app B2B antigua queda solo para mirar (no deja crear ni cambiar nada).\n2) Se hace una última copia de la planilla.\n3) El N° de orden sigue desde el último.\n4) La app de logística queda activa y tú administras aquí (folios, pagos, abonos, anular, solicitudes).\nDesde ahí la planilla recibe una copia automática.\nSe puede volver atrás: la app antigua vuelve a funcionar con la planilla, que ya tiene todo.')}</h2>
    <span class="chip ${cfg.activa ? 'c-verde' : 'c-gris'}">${cfg.activa ? 'En uso' : 'Todavía no'}</span></div>
    ${cfg.activa
      ? `<p class="ayuda">En uso desde ${esc(fechaCorta(cfg.desde))}${cfg.por ? ' por ' + esc(cfg.por) : ''}. La app antigua está solo para mirar.</p>
         <div class="botones" style="justify-content:flex-start"><button type="button" class="btn-sec btn-peligro" id="b2b-volver" ${b2b.cambiando ? 'disabled' : ''}>Volver a la app antigua</button></div>`
      : `<p class="ayuda">Hazlo cuando nadie esté creando órdenes en la app antigua. Tarda uno o dos minutos.</p>
         <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="b2b-cambiar" ${b2b.cambiando ? 'disabled' : ''}>Cambiar a la base nueva</button></div>`}
    <p class="ayuda" id="b2b-cambio-msg" role="status">${esc(b2b.cambiando)}</p></section>`;
}
function conectarCambio(el, sub, cx) {
  const bc = $('b2b-cambiar'), bv = $('b2b-volver');
  if (bc) bc.addEventListener('click', async () => {
    if (!confirm('¿Cambiar a la base nueva ahora?\n\nLa app B2B antigua quedará solo para mirar, y las órdenes se harán en la app de logística.')) return;
    b2b.cambiando = 'Empezando…'; pintarB2bBase(el, sub, cx);
    try {
      const r = await B2b.cambiarABaseNueva(t => { b2b.cambiando = t; const m = $('b2b-cambio-msg'); if (m) m.textContent = t; });
      registrar('Cambió B2B a la base nueva', `Siguiente N° ${r.siguiente}`);
      b2b.cambiando = ''; b2b.msg = `Listo: la base nueva está en uso. La próxima orden será la N° ${r.siguiente}.`; b2b.prep = null;
    } catch (e) { b2b.cambiando = ''; b2b.error = errorB2b(e); }
    pintarB2bBase(el, sub, cx);
  });
  if (bv) bv.addEventListener('click', async () => {
    if (!confirm('¿Volver a la app B2B antigua?\n\nLa app de logística dejará de crear órdenes y la app antigua volverá a funcionar con la planilla.')) return;
    b2b.cambiando = 'Volviendo…'; pintarB2bBase(el, sub, cx);
    try { await B2b.volverAPlanilla(); registrar('Volvió B2B a la app antigua', ''); b2b.msg = 'Listo: la app antigua vuelve a funcionar como antes.'; }
    catch (e) { b2b.error = errorB2b(e); }
    b2b.cambiando = ''; pintarB2bBase(el, sub, cx);
  });
}

async function nuevoClienteUI() {
    const opc = (id, sel) => ['Diaria', 'Semanal', 'Mensual'].concat(id === 'pd-frec' ? ['30dias'] : []).map(x => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('');
    const r = await pedirDatos('Nuevo cliente', `
      <div class="campo"><label for="pd-nombre">Nombre (como se ve en las órdenes)</label><input id="pd-nombre" placeholder="Ej: Café La Esquina"></div>
      <div class="fila-campos"><div class="campo"><label for="pd-rut">RUT</label><input id="pd-rut" placeholder="12.345.678-9"></div><div class="campo"><label for="pd-razon">Razón social</label><input id="pd-razon"></div></div>
      <div class="fila-campos"><div class="campo"><label for="pd-giro">Giro</label><input id="pd-giro"></div><div class="campo"><label for="pd-dir">Dirección</label><input id="pd-dir"></div></div>
      <div class="fila-campos"><div class="campo"><label for="pd-correo">Correo</label><input id="pd-correo" type="email"></div><div class="campo"><label for="pd-tel">Teléfono</label><input id="pd-tel"></div></div>
      <div class="campo"><label for="pd-contacto">Contacto</label><input id="pd-contacto"></div>
      <div class="fila-campos"><div class="campo"><label for="pd-fact">Facturación</label><select id="pd-fact">${opc('pd-fact', 'Diaria')}</select></div><div class="campo"><label for="pd-frec">Frecuencia de pago</label><select id="pd-frec">${opc('pd-frec', 'Diaria')}</select></div></div>`, 'Crear cliente',
      dd => { const v = id => dd.querySelector('#' + id).value.trim(); if (v('pd-nombre').length < 2) return { error: 'Escribe el nombre.' };
        return { nombre: v('pd-nombre'), rut: v('pd-rut'), razonSocial: v('pd-razon'), giro: v('pd-giro'), direccion: v('pd-dir'), correo: v('pd-correo'), telefono: v('pd-tel'), contacto: v('pd-contacto'), facturacion: v('pd-fact'), frecuenciaPago: v('pd-frec') }; });
    if (!r) return;
    try { await B2b.nuevoCliente(r); registrar('Creó cliente B2B', r.nombre); alert(`Listo: ${r.nombre} ya aparece en la app de logística.`); }
    catch (e) { alert(errorB2b(e)); }
  }

const claveB2b = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// ── v0.13 · Clientes ───────────────────────────────
const b2bCat = { filtroCli: '', archivadosCli: false, abiertoCli: '', filtroProd: '', archivadosProd: false, ordenCli: 'nombre', soloDejo: false, an: null, anCargando: false, anError: '', irA: '' };
const catOk = () => b2b.datos && b2b.datos.config && b2b.datos.config.activa;
function sinActivar(el, sub) { el.innerHTML = cabB2b(sub) + `<section class="tarjeta"><div class="vacio" style="border:0">${b2b.datos && b2b.datos.config ? 'Disponible cuando la base nueva esté en uso (Base nueva → Cambiar).' : (b2b.errVivo ? esc(b2b.errVivo) : 'Cargando…')}</div></section>`; }
async function cargarAnalisisCli(el, sub, forzar) {
  b2bCat.anCargando = true; b2bCat.anError = '';
  if (forzar) pintarB2bClientes(el, sub);
  try { b2bCat.an = await B2b.ordenesParaAnalisis(forzar); }
  catch (e) { b2bCat.anError = 'No se pudieron leer las compras: ' + errorB2b(e); }
  b2bCat.anCargando = false;
  if (vistaDesdeHash() === 'b2b' && subVista() === 'clientes' && !document.querySelector('dialog[open]')) pintarB2bClientes($('v-b2b'), 'clientes');
}
// Cuántos cambios del catálogo faltan por pasar a la planilla (se pasan solos; si se quedan, falta el script v2.5.0)
const chipCat = l => { const n = (l || []).filter(x => x.planillaPendiente).length; return n ? `<span class="chip c-amarillo" title="Se pasan solos a la planilla. Si no bajan, revisa que el script de B2B esté en v2.5.0.">${n} por pasar a la planilla</span>` : ''; };
function pintarB2bClientes(el, sub) {
  if (!catOk()) return sinActivar(el, sub);
  const d = b2b.datos, q = claveB2b(b2bCat.filtroCli);
  // v0.13.2: cuánto aporta y cómo paga (órdenes de 6 meses, leídas una vez cada 6 horas en este equipo)
  if (!b2bCat.an && !b2bCat.anCargando && !b2bCat.anError) cargarAnalisisCli(el, sub, false);
  const an = b2bCat.an ? B2b.analisisClientes([...d.ordenes.values()].concat(b2bCat.an.ordenes), d.abonos, d.clientes) : null;
  const A = c => an && an.porCliente[c.id];
  const destino = (location.hash.split('/')[2] || '');
  if (destino && destino !== b2bCat.irA) { b2bCat.irA = destino; b2bCat.abiertoCli = decodeURIComponent(destino); b2bCat.filtroCli = ''; b2bCat.soloDejo = false; }
  const nDejo = an ? d.clientes.filter(c => B2b.dejoVigente(c, A(c))).length : 0;
  if (!nDejo) b2bCat.soloDejo = false;
  const rangoPago = { verde: 0, amarillo: 1, rojo: 2, gris: -1 };
  const lista = d.clientes.filter(c => (b2bCat.archivadosCli ? c.estado === 'archivado' : c.estado !== 'archivado') && (!q || claveB2b(c.nombre).includes(q) || claveB2b(c.rut).includes(q)) && (!b2bCat.soloDejo || B2b.dejoVigente(c, A(c))))
    .sort((a, b) => b2bCat.ordenCli === 'aporte' && an ? ((A(b) || {}).prom3 || 0) - ((A(a) || {}).prom3 || 0) : b2bCat.ordenCli === 'pago' && an ? (rangoPago[(A(b) || {}).semaforo || 'gris'] - rangoPago[(A(a) || {}).semaforo || 'gris']) || (((A(b) || {}).deuda || 0) - ((A(a) || {}).deuda || 0)) : 0);
  const SEM = { verde: 'Al día', amarillo: 'Paga tarde', rojo: 'Paga a +30 días', gris: 'Sin pagos aún' };
  // El texto dice por qué tiene ese color: cómo paga (historial) o lo que debe hoy
  const semaforo = a => { if (!a) return '';
    const porHoy = a.masAntiguo && rangoPago[a.cHoy] > rangoPago[a.cHist || 'gris'];
    const t = a.semaforo === 'gris' ? 'Sin pagos aún' : porHoy ? `Debe hace ${a.masAntiguo.dias} d` : a.semaforo === 'verde' ? `Al día${a.diasPago != null ? ' · ' + a.diasPago + ' d' : ''}` : `Paga en ${a.diasPago} d`;
    return `<span class="semaforo s-${a.semaforo}" title="${esc(SEM[a.semaforo])}"><i aria-hidden="true"></i>${esc(t)}</span>`; };
  const resumenCli = c => { const a = A(c); if (!an) return b2bCat.anError ? '' : 'Calculando compras…'; if (!a || (!a.prom3 && !a.mesAnt)) return 'Sin compras en los últimos 3 meses';
    return `Mes ant. <b>${pesos(a.mesAnt)}</b> · prom. 3 meses <b>${pesos(a.prom3)}</b>${a.tend ? ` <span class="tend-${a.tend}" aria-label="${a.tend === 'sube' ? 'sube' : 'baja'}">${a.tend === 'sube' ? '↑' : '↓'}</span>` : ''} · ${Math.round(a.peso * 100)}% de B2B`; };
  const detalleCli = c => { const a = A(c); if (!a) return '';
    const L = [];
    L.push(a.diasPago != null ? `<b>Cómo paga:</b> en promedio ${a.diasPago} ${a.diasPago === 1 ? 'día' : 'días'} desde el folio (${a.nFolios} ${a.nFolios === 1 ? 'folio' : 'folios'}, últimos 6 meses)${a.acordado != null ? ` · acordado ${a.acordado ? a.acordado + ' días' : 'al día'}${a.diasPago > a.acordado + 3 ? ' <span class="chip c-amarillo chip-chico">más tarde que lo acordado</span>' : ''}` : ''}` : '<b>Cómo paga:</b> todavía no hay folios pagados con fecha en los últimos 6 meses');
    L.push(a.deuda > 0 ? `<b>Hoy:</b> debe ${pesos(a.deuda)} (con IVA) en ${a.nPendientes} ${a.nPendientes === 1 ? 'folio' : 'folios'}; el más antiguo, folio ${esc(a.masAntiguo.folio)}, hace ${a.masAntiguo.dias} ${a.masAntiguo.dias === 1 ? 'día' : 'días'}` : '<b>Hoy:</b> no debe folios');
    if (a.ultimaCompra) L.push(`<b>Compras:</b> ${a.intervalo != null ? `suele pedir cada ${a.intervalo} ${a.intervalo === 1 ? 'día' : 'días'}; ` : ''}última compra hace ${a.diasSin} ${a.diasSin === 1 ? 'día' : 'días'} (${esc(diaTexto(a.ultimaCompra))})`);
    const dejo = B2b.dejoVigente(c, a);
    return `<div class="analisis-cli">${L.map(x => `<p>${x}</p>`).join('')}
      ${dejo ? `<div class="aviso-dejo"><span><b>Dejó de comprar:</b> lleva ${a.diasSin} días sin pedir (normalmente cada ${a.intervalo}).</span><button type="button" class="btn-sec btn-chico" data-revisado-cli="${esc(c.id)}">Ya lo revisé</button></div>`
        : c.avisoCompra && a.dejo ? `<p class="ayuda">Aviso de "dejó de comprar" revisado el ${esc(String(c.avisoCompra.revisado).slice(0, 10))}${c.avisoCompra.nota ? ': ' + esc(c.avisoCompra.nota) : ''}. Vuelve a avisar si compra y después deja de comprar otra vez.</p>` : ''}</div>`; };
  const prodsActivos = d.productos.filter(p => p.estado !== 'archivado');
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-clis">
    <div class="titulo-fila"><h2 id="t-b2b-clis">Clientes ${info('Clientes', 'Los cambios aparecen al tiro en la app de logística y pasan solos a la planilla (hojas Clientes y Precios).\nEl nombre no se cambia, porque las órdenes y la planilla ubican al cliente por su nombre.\nUn cliente archivado deja de aparecer en logística; sus órdenes quedan igual.')}</h2><div class="acciones">${chipCat(d.clientes)}<button type="button" class="btn-sec btn-chico" id="b2b-nuevo-cli">+ Nuevo cliente</button></div></div>
    <div class="filtros-b2b"><div class="campo"><label for="cli-q">Buscar</label><input id="cli-q" value="${esc(b2bCat.filtroCli)}" placeholder="Nombre o RUT"></div>
      <label class="check-linea"><input type="checkbox" id="cli-arch" ${b2bCat.archivadosCli ? 'checked' : ''}> Ver archivados</label></div>
    <div class="fila-orden-cli"><div class="pastillas" role="group" aria-label="Ordenar por">${[['nombre', 'Nombre'], ['aporte', 'Aporte'], ['pago', 'Pago']].map(([k, t]) => `<button type="button" class="pastilla" data-orden-cli="${k}" aria-pressed="${b2bCat.ordenCli === k}">${t}</button>`).join('')}</div>
      ${nDejo ? `<button type="button" class="chip-filtro" id="cli-dejo" aria-pressed="${b2bCat.soloDejo}">Dejó de comprar (${nDejo})</button>` : ''}
      <span class="ayuda">${b2bCat.anError ? `<span class="error">${esc(b2bCat.anError)}</span> ` : ''}${b2bCat.an ? `Compras en neto · al ${esc(diaTexto(new Date(b2bCat.an.en).toISOString().slice(0, 10)))} ${new Date(b2bCat.an.en).toTimeString().slice(0, 5)}` : ''} <button type="button" class="btn-link" id="cli-act" ${b2bCat.anCargando ? 'disabled' : ''}>${b2bCat.anCargando ? 'Leyendo…' : 'Actualizar'}</button> ${info('Aporte y pago de cada cliente', 'Mes ant.: lo que compró el mes pasado (neto, sin IVA). Prom. 3 meses: el promedio de los 3 meses cerrados (sin el mes en curso). La flecha ↑ o ↓ aparece si el mes pasado fue más de un 20% distinto a los 3 meses anteriores. El % es su parte del total B2B.\nSemáforo: verde, paga hasta 7 días después del folio; amarillo, de 8 a 30; rojo, más de 30. Mira cómo pagó sus folios de los últimos 6 meses (un folio grande pesa más) y también si hoy tiene un folio pendiente de hace más días: toma el peor de los dos. Gris: todavía no hay pagos para medir.\nLos días se cuentan con la fecha que se registra al marcar Pagado o Abono: conviene usar la fecha real de la transferencia.\nDejó de comprar: un cliente que pide seguido y lleva más del doble de su intervalo normal sin pedir (y al menos una semana más). Se quita solo cuando vuelve a comprar, o con "Ya lo revisé".\nLas órdenes se leen una vez cada 6 horas en este equipo; "Actualizar" las vuelve a leer.')}</span></div>
    ${lista.map(c => `<details class="fila-orden-b2b" data-cli="${esc(c.id)}" ${b2bCat.abiertoCli === c.id ? 'open' : ''}><summary class="fila-caja"><div class="txt"><b>${esc(c.nombre)}${B2b.dejoVigente(c, A(c)) ? ' <span class="chip c-amarillo chip-chico">Dejó de comprar</span>' : ''}</b><span>${resumenCli(c)}</span></div><div class="acciones">${c.estado === 'archivado' ? '<span class="chip c-gris">Archivado</span>' : semaforo(A(c))}</div></summary>
      <div style="padding:4px 0 14px;display:flex;flex-direction:column;gap:10px">
        ${detalleCli(c)}
        <p class="ayuda">${esc(c.rut || 'sin RUT')} · factura ${esc(c.facturacion || 'Diaria')} · paga ${esc(c.frecuenciaPago || 'Diaria')} · ${(c.precios || []).length} ${(c.precios || []).length === 1 ? 'precio especial' : 'precios especiales'}<br>${esc(c.razonSocial || '')}${c.giro ? ' · ' + esc(c.giro) : ''}${c.direccion ? ' · ' + esc(c.direccion) : ''}${c.correo ? ' · ' + esc(c.correo) : ''}${c.telefono ? ' · ' + esc(c.telefono) : ''}${c.contacto ? ' · contacto ' + esc(c.contacto) : ''}</p>
        <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Precio especial</th><th scope="col">Precio neto</th><th scope="col">Base</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>
          ${(c.precios || []).map(x => { const p = d.productos.find(y => y.id === x.productoId) || d.productos.find(y => claveB2b(y.nombre) === claveB2b(x.producto)); return `<tr><td>${esc(x.producto)}</td><td>${pesos(x.precio)}</td><td>${p ? pesos(p.precioBase) : '—'}</td><td><button type="button" class="btn-sec btn-chico" data-precio-cli="${esc(c.id)}" data-precio-prod="${esc(x.productoId || '')}" data-precio-nom="${esc(x.producto)}">Cambiar</button></td></tr>`; }).join('') || '<tr><td colspan="4">Sin precios especiales: paga el precio base.</td></tr>'}
        </tbody></table></div>
        <div class="botones" style="justify-content:flex-start">${c.estado !== 'archivado' ? `<button type="button" class="btn-sec btn-chico" data-precio-cli="${esc(c.id)}">+ Precio especial</button><button type="button" class="btn-sec btn-chico" data-editar-cli="${esc(c.id)}">Editar datos</button>` : ''}<button type="button" class="btn-sec btn-chico ${c.estado === 'archivado' ? '' : 'btn-peligro'}" data-archivar-cli="${esc(c.id)}">${c.estado === 'archivado' ? 'Reactivar' : 'Archivar'}</button></div>
        ${(c.historialPrecios || []).length ? `<details><summary class="ayuda" style="cursor:pointer">Historial de precios (${c.historialPrecios.length})</summary><ul class="ayuda">${c.historialPrecios.slice().reverse().slice(0, 30).map(h => `<li>${esc(h.en)} · ${esc(h.producto)}: ${h.antes ? pesos(h.antes) : 'base'} → ${h.despues ? pesos(h.despues) : 'base'} · ${esc(h.por || '')}</li>`).join('')}</ul></details>` : ''}
      </div></details>`).join('') || `<div class="vacio" style="border:0">${b2bCat.archivadosCli ? 'No hay clientes archivados.' : 'No hay clientes con eso.'}</div>`}
  </section>`;
  $('b2b-nuevo-cli').addEventListener('click', nuevoClienteUI);
  $('cli-q').addEventListener('input', e => { b2bCat.filtroCli = e.target.value; const p = e.target.selectionStart; pintarB2bClientes(el, sub); const i = $('cli-q'); i.focus(); i.setSelectionRange(p, p); });
  $('cli-arch').addEventListener('change', e => { b2bCat.archivadosCli = e.target.checked; pintarB2bClientes(el, sub); });
  el.querySelectorAll('[data-orden-cli]').forEach(b => b.addEventListener('click', () => { b2bCat.ordenCli = b.dataset.ordenCli; pintarB2bClientes(el, sub); }));
  if ($('cli-dejo')) $('cli-dejo').addEventListener('click', () => { b2bCat.soloDejo = !b2bCat.soloDejo; pintarB2bClientes(el, sub); });
  $('cli-act').addEventListener('click', () => cargarAnalisisCli(el, sub, true));
  el.querySelectorAll('[data-revisado-cli]').forEach(b => b.addEventListener('click', async () => {
    const c = d.clientes.find(x => x.id === b.dataset.revisadoCli), a = A(c);
    const r = await pedirDatos(`Ya lo revisé · ${c.nombre}`, `<p class="ayuda">El aviso "Dejó de comprar" se quita de Clientes y de Hoy. Vuelve a aparecer solo si el cliente compra de nuevo y después vuelve a dejar de comprar.</p>
      <div class="campo"><label for="pd-nota">Nota (opcional)</label><input id="pd-nota" maxlength="200" placeholder="Ej: cerró por vacaciones hasta el 20"></div>`, 'Listo', dd => ({ nota: dd.querySelector('#pd-nota').value }));
    if (!r) return;
    try { await B2b.revisarDejoDeComprar(c.id, a.ultimaCompra, r.nota); registrar('Revisó cliente que dejó de comprar', c.nombre + (r.nota ? ' · ' + r.nota : '')); } catch (e) { alert(errorB2b(e)); }
  }));
  if (destino && b2bCat.abiertoCli) { const dt = el.querySelector(`details[data-cli="${CSS.escape(b2bCat.abiertoCli)}"]`); if (dt && !dt.dataset.visto) { dt.dataset.visto = '1'; requestAnimationFrame(() => dt.scrollIntoView({ block: 'center' })); } }
  el.querySelectorAll('details[data-cli]').forEach(dt => dt.addEventListener('toggle', () => { if (dt.open) b2bCat.abiertoCli = dt.dataset.cli; else if (b2bCat.abiertoCli === dt.dataset.cli) b2bCat.abiertoCli = ''; }));
  // Si la planilla trae otro valor (ej. "Diario"), se muestra tal cual y no se cambia salvo que se elija otro
  const opc = (lista, sel) => (sel && !lista.includes(sel) ? `<option value="${esc(sel)}" selected>${esc(sel)} (de la planilla)</option>` : '') + lista.map(x => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('');
  el.querySelectorAll('[data-editar-cli]').forEach(b => b.addEventListener('click', async () => {
    const c = d.clientes.find(x => x.id === b.dataset.editarCli);
    const r = await pedirDatos(`Editar ${c.nombre}`, `<p class="ayuda">El nombre no se cambia (las órdenes lo usan).</p>
      <div class="fila-campos"><div class="campo"><label for="pd-rut">RUT</label><input id="pd-rut" value="${esc(c.rut)}"></div><div class="campo"><label for="pd-razon">Razón social</label><input id="pd-razon" value="${esc(c.razonSocial)}"></div></div>
      <div class="fila-campos"><div class="campo"><label for="pd-giro">Giro</label><input id="pd-giro" value="${esc(c.giro)}"></div><div class="campo"><label for="pd-dir">Dirección</label><input id="pd-dir" value="${esc(c.direccion)}"></div></div>
      <div class="fila-campos"><div class="campo"><label for="pd-correo">Correo</label><input id="pd-correo" type="email" value="${esc(c.correo)}"></div><div class="campo"><label for="pd-tel">Teléfono</label><input id="pd-tel" value="${esc(c.telefono)}"></div></div>
      <div class="campo"><label for="pd-contacto">Contacto</label><input id="pd-contacto" value="${esc(c.contacto)}"></div>
      <div class="fila-campos"><div class="campo"><label for="pd-fact">Facturación</label><select id="pd-fact">${opc(B2b.FACTURACION, c.facturacion || 'Diaria')}</select></div><div class="campo"><label for="pd-frec">Frecuencia de pago</label><select id="pd-frec">${opc(B2b.FRECUENCIA, c.frecuenciaPago || 'Diaria')}</select></div></div>`, 'Guardar',
      dd => { const v = id => dd.querySelector('#' + id).value.trim(); return { rut: v('pd-rut'), razonSocial: v('pd-razon'), giro: v('pd-giro'), direccion: v('pd-dir'), correo: v('pd-correo'), telefono: v('pd-tel'), contacto: v('pd-contacto'), facturacion: v('pd-fact'), frecuenciaPago: v('pd-frec') }; });
    if (r && r.facturacion === (c.facturacion || 'Diaria')) delete r.facturacion;
    if (r && r.frecuenciaPago === (c.frecuenciaPago || 'Diaria')) delete r.frecuenciaPago;
    if (!r) return;
    try { await B2b.guardarCliente(c.id, r); registrar('Editó cliente B2B', c.nombre); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-precio-cli]').forEach(b => b.addEventListener('click', async () => {
    const c = d.clientes.find(x => x.id === b.dataset.precioCli);
    const fijo = b.dataset.precioNom ? (prodsActivos.find(p => p.id === b.dataset.precioProd) || d.productos.find(p => claveB2b(p.nombre) === claveB2b(b.dataset.precioNom)) || { id: null, nombre: b.dataset.precioNom, precioBase: 0 }) : null;
    const actual = fijo ? (c.precios || []).find(x => claveB2b(x.producto) === claveB2b(fijo.nombre)) : null;
    const r = await pedirDatos(`Precio especial · ${c.nombre}`, `
      ${fijo ? `<p class="ayuda"><b>${esc(fijo.nombre)}</b>${fijo.precioBase ? ' · base ' + pesos(fijo.precioBase) : ''}</p>` : `<div class="campo"><label for="pd-prod">Producto</label><select id="pd-prod"><option value="">Elige…</option>${prodsActivos.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)} · base ${pesos(p.precioBase)}</option>`).join('')}</select></div>`}
      <div class="campo"><label for="pd-precio">Precio neto para este cliente</label><input id="pd-precio" inputmode="numeric" value="${actual ? esc(actual.precio) : ''}" placeholder="Ej: 2590"></div>
      <p class="ayuda">${fijo ? 'Déjalo vacío o en 0 para quitarlo: el cliente vuelve a pagar el precio base.' : ''} El cambio queda en el historial de precios del cliente.</p>`, 'Guardar',
      dd => { const pid = fijo ? null : dd.querySelector('#pd-prod').value; if (!fijo && !pid) return { error: 'Elige el producto.' }; const p = Math.round(Number(String(dd.querySelector('#pd-precio').value).replace(/[^\d]/g, '')) || 0); if (!fijo && !(p > 0)) return { error: 'Escribe el precio.' }; return { prod: fijo || prodsActivos.find(x => x.id === pid), precio: p }; });
    if (!r) return;
    try { await B2b.precioEspecial(c.id, r.prod, r.precio); registrar('Cambió precio especial B2B', `${c.nombre} · ${r.prod.nombre} · ${r.precio ? pesos(r.precio) : 'precio base'}`); b2bCat.abiertoCli = c.id; B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-archivar-cli]').forEach(b => b.addEventListener('click', async () => {
    const c = d.clientes.find(x => x.id === b.dataset.archivarCli), arch = c.estado !== 'archivado';
    if (!confirm(arch ? `¿Archivar a ${c.nombre}?\n\nDeja de aparecer en la app de logística. Sus órdenes y su historial quedan igual, y se puede reactivar.` : `¿Reactivar a ${c.nombre}?`)) return;
    try { await B2b.archivarCliente(c.id, arch); registrar(arch ? 'Archivó cliente B2B' : 'Reactivó cliente B2B', c.nombre); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  }));
}

// ── v0.13 · Productos ──────────────────────────────
function pintarB2bProductos(el, sub) {
  if (!catOk()) return sinActivar(el, sub);
  const d = b2b.datos, q = claveB2b(b2bCat.filtroProd);
  const lista = d.productos.filter(p => (b2bCat.archivadosProd ? p.estado === 'archivado' : p.estado !== 'archivado') && (!q || claveB2b(p.nombre).includes(q) || claveB2b(p.categoria).includes(q) || claveB2b(p.idReceta).includes(q)));
  const usos = id => d.clientes.filter(c => c.estado !== 'archivado' && (c.precios || []).some(x => x.productoId === id)).length;
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-prods">
    <div class="titulo-fila"><h2 id="t-b2b-prods">Productos ${info('Productos', 'El precio base es el que paga un cliente sin precio especial. Los cambios aparecen al tiro en la app de logística y pasan solos a la hoja Productos.\nEl nombre no se cambia (las órdenes y la planilla lo usan). Un producto archivado deja de ofrecerse en logística; las órdenes que ya lo tienen quedan igual.\nCada cambio de precio base queda en su historial.')}</h2><div class="acciones">${chipCat(d.productos)}<button type="button" class="btn-sec btn-chico" id="b2b-nuevo-prod">+ Nuevo producto</button></div></div>
    <div class="filtros-b2b"><div class="campo"><label for="prod-q">Buscar</label><input id="prod-q" value="${esc(b2bCat.filtroProd)}" placeholder="Nombre, categoría o receta"></div>
      <label class="check-linea"><input type="checkbox" id="prod-arch" ${b2bCat.archivadosProd ? 'checked' : ''}> Ver archivados</label></div>
    <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">Producto</th><th scope="col">Precio base</th><th scope="col">Categoría · área</th><th scope="col">Receta</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>
      ${lista.map(p => `<tr><td><b>${esc(p.nombre)}</b>${usos(p.id) ? `<br><span class="ayuda">${usos(p.id)} con precio especial</span>` : ''}${(p.historialPrecios || []).length ? `<br><span class="ayuda">antes ${pesos(p.historialPrecios[p.historialPrecios.length - 1].antes)} (${esc(String(p.historialPrecios[p.historialPrecios.length - 1].en).slice(0, 10))})</span>` : ''}</td><td>${pesos(p.precioBase)}</td><td>${esc([p.categoria, p.area].filter(Boolean).join(' · ') || '—')}</td><td>${esc(p.idReceta || '—')}</td>
        <td><div class="acciones" style="display:flex;gap:6px;flex-wrap:wrap">${p.estado !== 'archivado' ? `<button type="button" class="btn-sec btn-chico" data-editar-prod="${esc(p.id)}">Editar</button>` : ''}<button type="button" class="btn-sec btn-chico ${p.estado === 'archivado' ? '' : 'btn-peligro'}" data-archivar-prod="${esc(p.id)}">${p.estado === 'archivado' ? 'Reactivar' : 'Archivar'}</button></div></td></tr>`).join('') || `<tr><td colspan="5">${b2bCat.archivadosProd ? 'No hay productos archivados.' : 'No hay productos con eso.'}</td></tr>`}
    </tbody></table></div></section>`;
  $('prod-q').addEventListener('input', e => { b2bCat.filtroProd = e.target.value; const p = e.target.selectionStart; pintarB2bProductos(el, sub); const i = $('prod-q'); i.focus(); i.setSelectionRange(p, p); });
  $('prod-arch').addEventListener('change', e => { b2bCat.archivadosProd = e.target.checked; pintarB2bProductos(el, sub); });
  const form = (p = {}) => `${p.id ? `<p class="ayuda"><b>${esc(p.nombre)}</b> (el nombre no se cambia)</p>` : `<div class="campo"><label for="pd-nombre">Nombre</label><input id="pd-nombre" placeholder="Ej: Pan de molde"></div>`}
    <div class="fila-campos"><div class="campo"><label for="pd-precio">Precio base neto</label><input id="pd-precio" inputmode="numeric" value="${esc(p.precioBase || '')}"></div><div class="campo"><label for="pd-cat">Categoría</label><input id="pd-cat" value="${esc(p.categoria || '')}" placeholder="Ej: PAN"></div></div>
    <div class="fila-campos"><div class="campo"><label for="pd-area">Área</label><input id="pd-area" value="${esc(p.area || '')}" placeholder="Ej: Panadería"></div><div class="campo"><label for="pd-receta">ID de receta (Producción)</label><input id="pd-receta" value="${esc(p.idReceta || '')}" placeholder="Ej: PAN-001"></div></div>`;
  const leer = nuevo => dd => { const v = id => dd.querySelector('#' + id).value.trim(); const pr = Math.round(Number(v('pd-precio').replace(/[^\d]/g, '')) || 0); if (nuevo && v('pd-nombre').length < 2) return { error: 'Escribe el nombre.' }; if (!(pr > 0)) return { error: 'Escribe el precio base.' }; return { nombre: nuevo ? v('pd-nombre') : undefined, precioBase: pr, categoria: v('pd-cat'), area: v('pd-area'), idReceta: v('pd-receta') }; };
  $('b2b-nuevo-prod').addEventListener('click', async () => {
    const r = await pedirDatos('Nuevo producto', form(), 'Crear producto', leer(true)); if (!r) return;
    try { await B2b.guardarProducto(null, r); registrar('Creó producto B2B', `${r.nombre} · ${pesos(r.precioBase)}`); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  });
  el.querySelectorAll('[data-editar-prod]').forEach(b => b.addEventListener('click', async () => {
    const p = d.productos.find(x => x.id === b.dataset.editarProd);
    const r = await pedirDatos(`Editar ${p.nombre}`, form(p), 'Guardar', leer(false)); if (!r) return;
    delete r.nombre;
    try { await B2b.guardarProducto(p.id, r); registrar('Editó producto B2B', `${p.nombre}${r.precioBase !== p.precioBase ? ' · base ' + pesos(p.precioBase) + ' → ' + pesos(r.precioBase) : ''}`); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  }));
  el.querySelectorAll('[data-archivar-prod]').forEach(b => b.addEventListener('click', async () => {
    const p = d.productos.find(x => x.id === b.dataset.archivarProd), arch = p.estado !== 'archivado';
    if (!confirm(arch ? `¿Archivar ${p.nombre}?\n\nDeja de ofrecerse en la app de logística. Las órdenes que ya lo tienen quedan igual, y se puede reactivar.` : `¿Reactivar ${p.nombre}?`)) return;
    try { await B2b.archivarProducto(p.id, arch); registrar(arch ? 'Archivó producto B2B' : 'Reactivó producto B2B', p.nombre); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { alert(errorB2b(e)); }
  }));
}

// ── v0.13 · Estado de cuenta ───────────────────────
const b2bCuenta = { clienteId: '', desde: '', hasta: '', modo: 'orden', res: null, cliente: null, tocado: false, cargando: false };
function pintarB2bCuenta(el, sub) {
  if (!catOk()) return sinActivar(el, sub);
  const d = b2b.datos, s = b2bCuenta, r = s.res;
  const fila = f => `<tr${f.estado === 'PARCIAL' ? ' style="color:var(--amarillo-t)"' : ''}><td>${esc(f.principal)}</td><td>${esc(diaTexto(f.fecha))} ${esc(String(f.fecha || '').slice(0, 4))}</td><td>${esc(f.secundaria)}</td><td>${pesos(f.neto)}</td><td><b>${f.estado === 'PARCIAL' ? `<s style="opacity:.6">${pesos(f.total)}</s> ${pesos(f.saldo)}` : pesos(f.total)}</b></td><td><span class="chip ${f.estado === 'PAGADO' ? 'c-verde' : f.estado === 'PARCIAL' ? 'c-amarillo' : 'c-rojo'}">${esc(f.estado)}</span></td><td>${f.estado === 'PAGADO' ? esc(diaTexto(f.fechaPago || '')) : '—'}</td></tr>`;
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-b2b-ec"><h2 id="t-b2b-ec">Estado de cuenta ${info('Estado de cuenta', 'El mismo de la app B2B: lo comprado, lo pagado y lo pendiente de un cliente, por orden o por folio. Incluye las órdenes archivadas; no incluye las anuladas.\nEl saldo de un folio con abonos se reparte entre sus órdenes, igual que antes.')}</h2>
    <div class="filtros-b2b">
      <div class="campo"><label for="ec-cli">Cliente</label><select id="ec-cli"><option value="">Elige…</option>${d.clientes.map(c => `<option value="${esc(c.id)}" ${c.id === s.clienteId ? 'selected' : ''}>${esc(c.nombre)}${c.estado === 'archivado' ? ' (archivado)' : ''}</option>`).join('')}</select></div>
      <div class="campo"><label for="ec-desde">Desde</label><input id="ec-desde" type="date" value="${esc(s.desde)}"></div>
      <div class="campo"><label for="ec-hasta">Hasta</label><input id="ec-hasta" type="date" value="${esc(s.hasta)}"></div>
    </div>
    <div class="pastillas" role="group" aria-label="Agrupar por" style="margin-top:10px"><button type="button" class="pastilla" data-ec-modo="orden" aria-pressed="${s.modo === 'orden'}">Por orden</button><button type="button" class="pastilla" data-ec-modo="folio" aria-pressed="${s.modo === 'folio'}">Por folio</button></div>
    <div class="botones" style="justify-content:flex-start;margin-top:12px"><button type="button" class="btn" id="ec-generar" ${s.cargando ? 'disabled' : ''}>${s.cargando ? 'Buscando…' : 'Ver estado de cuenta'}</button>${r && r.n ? '<button type="button" class="btn-sec" id="ec-pdf">Descargar PDF</button>' : ''}</div>
    ${r ? (r.n ? `<div class="cifras cifras-3" style="margin-top:14px"><div class="tarjeta cifra"><span class="rotulo">Comprado</span><span class="valor">${pesos(r.comprado)}</span><span class="nota">${r.n} ${r.n === 1 ? 'orden' : 'órdenes'}</span></div><div class="tarjeta cifra"><span class="rotulo">Pagado</span><span class="valor">${pesos(r.pagado)}</span></div><div class="tarjeta cifra"><span class="rotulo">Pendiente</span><span class="valor" style="color:var(--rojo-t)">${pesos(r.pendiente)}</span></div></div>
      <div class="tabla-b2b"><table class="tabla-tiempos"><thead><tr><th scope="col">${s.modo === 'folio' ? 'Folio' : 'N° orden'}</th><th scope="col">Fecha</th><th scope="col">${s.modo === 'folio' ? 'Órdenes' : 'Folio'}</th><th scope="col">Neto</th><th scope="col">Total</th><th scope="col">Estado</th><th scope="col">Pago</th></tr></thead><tbody>${r.filas.map(fila).join('')}</tbody></table></div>` : '<div class="vacio" style="border:0">Ese cliente no tiene órdenes en ese período.</div>') : ''}
  </section>`;
  const tocar = () => { s.tocado = true; s.res = null; };
  $('ec-cli').addEventListener('change', e => { s.clienteId = e.target.value; s.ordenes = null; tocar(); pintarB2bCuenta(el, sub); });
  // Al cambiar las fechas se recalcula con las órdenes ya leídas (sin volver a leer la base)
  const recalcular = () => { s.tocado = true; s.res = s.ordenes && s.cliente && s.cliente.id === s.clienteId ? B2b.estadoDeCuenta(s.ordenes, d.abonos, s.desde, s.hasta, s.modo) : null; pintarB2bCuenta(el, sub); };
  $('ec-desde').addEventListener('change', e => { s.desde = e.target.value; recalcular(); });
  $('ec-hasta').addEventListener('change', e => { s.hasta = e.target.value; recalcular(); });
  el.querySelectorAll('[data-ec-modo]').forEach(b => b.addEventListener('click', () => { s.modo = b.dataset.ecModo; if (s.ordenes) s.res = B2b.estadoDeCuenta(s.ordenes, d.abonos, s.desde, s.hasta, s.modo); pintarB2bCuenta(el, sub); }));
  $('ec-generar').addEventListener('click', async () => {
    if (!s.clienteId) { alert('Elige el cliente.'); return; }
    s.cargando = true; pintarB2bCuenta(el, sub);
    try { s.ordenes = await B2b.ordenesDeCliente(s.clienteId); s.cliente = d.clientes.find(c => c.id === s.clienteId); s.res = B2b.estadoDeCuenta(s.ordenes, d.abonos, s.desde, s.hasta, s.modo); }
    catch (e) { alert(errorB2b(e)); }
    s.cargando = false; pintarB2bCuenta(el, sub);
  });
  const bp = $('ec-pdf');
  if (bp) bp.addEventListener('click', async () => {
    bp.disabled = true; bp.textContent = 'Generando…';
    try { await PdfOrden.estadoCuenta(s.cliente, s.res, s.desde, s.hasta, s.modo); } catch (e) { alert('No se pudo hacer el PDF: ' + (e.message || e)); }
    bp.disabled = false; bp.textContent = 'Descargar PDF';
  });
}

// ── v0.14 · Conciliación bancaria ──────────────────
// Estado de la pantalla: lo que cambiaste a mano en cada movimiento se mantiene aunque lleguen cambios en vivo
const b2bConc = { msg: '', error: '', cargando: false, forzados: {}, edit: {}, abierto: '', ocupado: '', repintar: false, an: null, anPidiendo: false };
function pintarB2bConciliacion(el, sub) {
  if (!catOk()) return sinActivar(el, sub);
  const d = b2b.datos, conf = d.conciliacion;
  b2bConc.repintar = false;
  if (!d.conciliacionLeida) { el.innerHTML = cabB2b(sub) + '<section class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></section>'; return; }
  if (!conf || !conf.importado) return pintarConcInicio(el, sub);
  // Pagos ya registrados (para avisar si un abono parece uno ya anotado a mano): órdenes de 6 meses, con caché
  if (!b2bConc.an && !b2bConc.anPidiendo) { b2bConc.anPidiendo = true; B2b.ordenesParaAnalisis(false).then(a => { b2bConc.an = a; if (subVista() === 'conciliacion' && !document.querySelector('dialog[open]')) pintarB2bConciliacion($('v-b2b'), 'conciliacion'); }).catch(() => {}); }
  const ordenes = [...d.ordenes.values()];
  const props = B2b.proponer(d.movimientos, { clientes: d.clientes, ordenes, abonos: d.abonos, equivalencias: B2b.configConciliacion(conf).equivalencias, forzados: b2bConc.forzados,
    pagados: B2b.pagadosPorFolio(b2bConc.an ? ordenes.concat(b2bConc.an.ordenes) : ordenes, d.clientes) });   // lo vivo primero (más nuevo)
  const porCobrar = B2b.foliosPorCobrar(ordenes, d.abonos, d.clientes);
  const grupos = { auto: [], revisar: [], sinCliente: [] };
  d.movimientos.forEach(m => { const p = props[m.id]; (grupos[b2bConc.edit[m.id] && p.tipo === 'auto' ? 'revisar' : p.tipo] || grupos.revisar).push(m); });
  const cab = m => `<div class="txt"><b>${pesos(m.monto)}${props[m.id].cliente ? ' · ' + esc(props[m.id].cliente) : ''}</b><span>${esc(diaTexto(m.fecha))} · ${esc(m.descripcion)}</span></div>`;
  const folioTxt = a => `folio ${esc(a.folio)} ${pesos(a.monto)}`;
  const optsCli = sel => `<option value="">Elige el cliente…</option>` + d.clientes.filter(c => c.estado !== 'archivado' || c.id === sel).map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  // Editor de un movimiento: cliente, folios por cobrar con el monto de cada uno
  const editor = m => {
    const p = props[m.id], e = b2bConc.edit[m.id] || {}, fol = (p.clienteId && porCobrar[p.clienteId]) || [];
    const val = f => e.montos && f.folio in e.montos ? e.montos[f.folio] : ((p.asignaciones || []).find(a => a.folio === f.folio) || {}).monto || 0;
    const asignado = fol.reduce((s, f) => s + (Number(val(f)) || 0), 0), sobra = m.monto - asignado;
    return `<div class="mov-edit" data-mov="${esc(m.id)}">
      <div class="campo"><label for="mc-${esc(m.id)}">Cliente</label><select id="mc-${esc(m.id)}" data-mov-cli="${esc(m.id)}">${optsCli(p.clienteId)}</select></div>
      ${p.motivo ? `<p class="ayuda">${esc(p.motivo)}</p>` : ''}
      ${p.clienteId ? (fol.length ? `<div class="mov-folios">${fol.map(f => `<label class="mov-folio"><span><b>Folio ${esc(f.folio)}</b><small>${esc(diaTexto(f.fecha))} · saldo ${pesos(f.saldo)}${f.abonado ? ` (abonado ${pesos(f.abonado)})` : ''}</small></span>
          <input inputmode="numeric" data-mov-monto="${esc(m.id)}" data-folio="${esc(f.folio)}" value="${val(f) ? Number(val(f)).toLocaleString('es-CL') : ''}" placeholder="0" aria-label="Monto para el folio ${esc(f.folio)}"></label>`).join('')}</div>
        <p class="mov-suma ${sobra < 0 ? 'error' : ''}">Asignado ${pesos(asignado)} de ${pesos(m.monto)}${sobra > 0 ? ` · quedan ${pesos(sobra)} sin asignar` : sobra < 0 ? ` · te pasaste en ${pesos(-sobra)}` : ' · calza exacto'}</p>`
        : '<p class="ayuda">Este cliente no tiene folios por cobrar.</p>') : ''}
      <div class="botones" style="justify-content:flex-start">${p.clienteId && fol.length ? `<button type="button" class="btn btn-chico" data-mov-ok="${esc(m.id)}" ${asignado <= 0 || sobra < 0 || b2bConc.ocupado ? 'disabled' : ''}>Confirmar${sobra > 0 && asignado > 0 ? ' (con saldo sin asignar)' : ''}</button>` : ''}
        <button type="button" class="btn-sec btn-chico" data-mov-rev="${esc(m.id)}">Ya estaba registrado</button>
        <button type="button" class="btn-sec btn-chico" data-mov-ign="${esc(m.id)}">No es de B2B</button></div></div>`;
  };
  const fila = (m, conEditor) => `<details class="fila-orden-b2b mov" data-movd="${esc(m.id)}" ${conEditor && b2bConc.abierto === m.id ? 'open' : ''}><summary class="fila-caja">${cab(m)}
      <div class="acciones">${props[m.id].tipo === 'auto' && !b2bConc.edit[m.id] ? `<span class="mov-prop">${props[m.id].asignaciones.map(folioTxt).join(' + ')}</span><button type="button" class="btn btn-chico" data-mov-auto="${esc(m.id)}" ${b2bConc.ocupado ? 'disabled' : ''}>Confirmar</button>` : ''}</div></summary>${editor(m)}</details>`;
  const seccion = (k, titulo, l, ayuda, extra = '') => `<details class="tarjeta plegable" data-plegar="c-${k}" ${plegadas()['c-' + k] === true && l.length ? '' : 'open'}><summary class="titulo-fila"><h2>${titulo}</h2><span>${l.length} ${l.length === 1 ? 'abono' : 'abonos'} · ${pesos(l.reduce((s, m) => s + m.monto, 0))}</span></summary>
      ${l.length ? `<p class="ayuda">${ayuda}</p>${extra}${l.map(m => fila(m, true)).join('')}` : '<div class="vacio" style="border:0">Nada aquí.</div>'}</details>`;
  el.innerHTML = cabB2b(sub) + `
    <section class="tarjeta" aria-labelledby="t-conc"><div class="titulo-fila"><h2 id="t-conc">Cargar cartola ${info('Conciliación bancaria', 'Sube la cartola de BancoEstado (Chequera Electrónica) tal como la descargas: la histórica o la en línea. Se pueden subir las dos aunque se repitan días: cada abono se reconoce y no se cuenta dos veces.\nSolo se miran los abonos (lo que entra). Los de Transbank y los que marques "No es de B2B" se ignoran.\nEl cliente se reconoce por lo aprendido antes, por el RUT que trae la descripción o por su nombre o razón social. Cuando lo eliges a mano, se aprende para la próxima.\nAl confirmar, el pago queda con la fecha del banco: si cubre el saldo del folio queda PAGADO; si no, como abono (PARCIAL). Todo pasa solo a la planilla.')}</h2></div>
      <div class="fila-cartola"><label class="btn" for="conc-archivo">${b2bConc.cargando ? 'Leyendo…' : 'Elegir cartola (.xlsx)'}</label><input id="conc-archivo" type="file" accept=".xlsx,.xls" class="sr" ${b2bConc.cargando ? 'disabled' : ''}>
        <span class="ayuda">${d.movimientos.length ? `${d.movimientos.length} ${d.movimientos.length === 1 ? 'abono pendiente' : 'abonos pendientes'} de cartolas anteriores` : 'No hay abonos pendientes.'}</span></div>
      ${b2bConc.msg ? `<p class="ayuda" role="status">${b2bConc.msg}</p>` : ''}${b2bConc.error ? `<p class="error" role="alert">${esc(b2bConc.error)}</p>` : ''}
      <p class="ayuda" style="margin-top:8px">¿Volviste a usar la app antigua un tiempo? <button type="button" class="btn-link" id="conc-reimportar" ${b2bConc.cargando ? 'disabled' : ''}>Traer otra vez lo conciliado allá</button></p></section>
    ${seccion('auto', 'Listos para confirmar', grupos.auto, 'Calzan exacto con folios por cobrar de ese cliente. Revisa y confirma; si alguno no corresponde, ábrelo para cambiarlo.', grupos.auto.length > 1 ? `<div class="botones" style="justify-content:flex-start;margin:4px 0 8px"><button type="button" class="btn btn-chico" id="conc-todos" ${b2bConc.ocupado ? 'disabled' : ''}>Confirmar los ${grupos.auto.length} · ${pesos(grupos.auto.reduce((s, m) => s + m.monto, 0))}</button></div>` : '')}
    ${seccion('revisar', 'Para revisar', grupos.revisar, 'Se reconoce el cliente, pero el monto no calza exacto (pago de varias facturas, abono parcial o un pago que ya estaba anotado). Viene una propuesta: los folios más antiguos primero.')}
    ${seccion('sin', 'Sin cliente', grupos.sinCliente, 'No se reconoció quién pagó. Elige el cliente (se aprende para la próxima) o márcalo "No es de B2B".')}`;
  // ── Acciones ──
  el.querySelectorAll('.mov-edit').forEach(x => x.addEventListener('focusout', () => setTimeout(() => { if (b2bConc.repintar && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#v-b2b .mov-edit')) && subVista() === 'conciliacion') pintarB2bConciliacion($('v-b2b'), 'conciliacion'); }, 0)));
  el.querySelectorAll('details[data-plegar]').forEach(dt => dt.addEventListener('toggle', () => plegar(dt.dataset.plegar, !dt.open)));
  el.querySelectorAll('details[data-movd]').forEach(dt => dt.addEventListener('toggle', () => { if (dt.open) b2bConc.abierto = dt.dataset.movd; else if (b2bConc.abierto === dt.dataset.movd) b2bConc.abierto = ''; }));
  const repintar = () => pintarB2bConciliacion(el, sub);
  $('conc-archivo').addEventListener('change', async ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    b2bConc.cargando = true; b2bConc.msg = ''; b2bConc.error = ''; repintar();
    try {
      await cargarScriptExterno('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => window.XLSX);
      const wb = window.XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const c = B2b.leerCartola(wb, window.XLSX);
      const r = await B2b.cargarCartola(c, b2b.datos.conciliacion);
      b2bConc.msg = `<b>${esc(c.identificador)}</b>: ${r.abonos} ${r.abonos === 1 ? 'abono' : 'abonos'} en la cartola · <b>${r.nuevos} ${r.nuevos === 1 ? 'nuevo' : 'nuevos'}</b> · ${r.yaVistos} ya ${r.yaVistos === 1 ? 'visto' : 'vistos'} antes · ${r.ignorados} ${r.ignorados === 1 ? 'ignorado' : 'ignorados'} (Transbank y otros).`;
      registrar('Cargó cartola', `${c.identificador} · ${r.nuevos} abonos nuevos`);
    } catch (e) { b2bConc.error = 'No se pudo leer la cartola: ' + errorB2b(e); }
    b2bConc.cargando = false; repintar();
  });
  $('conc-reimportar').addEventListener('click', async () => {
    b2bConc.cargando = true; b2bConc.error = ''; b2bConc.msg = ''; repintar();
    try { const r = await B2b.importarConciliacionAntigua(); b2bConc.msg = `Listo: ${r.nuevos} abonos nuevos traídos de la app antigua${r.cerrados ? ` y ${r.cerrados} que allá ya estaban conciliados` : ''}.`; } catch (e) { b2bConc.error = errorB2b(e); }
    b2bConc.cargando = false; repintar();
  });
  const confirmar = async (id, conEdicion) => {
    const m = d.movimientos.find(x => x.id === id), p = props[id], e = b2bConc.edit[id];
    const asign = conEdicion && e && e.montos ? Object.entries(e.montos).map(([folio, monto]) => ({ folio, monto })) : (conEdicion ? ((porCobrar[p.clienteId] || []).map(f => ({ folio: f.folio, monto: ((p.asignaciones || []).find(a => a.folio === f.folio) || {}).monto || 0 }))) : p.asignaciones);
    await B2b.aplicarMovimiento(id, p.clienteId, asign, p.por === 'manual' || p.por === 'nombre-parcial');   // se aprende lo que confirmaste tú
    delete b2bConc.edit[id]; delete b2bConc.forzados[id];
    registrar('Concilió abono', `${pesos(m.monto)} · ${p.cliente} · ${asign.filter(a => Number(a.monto) > 0).map(a => 'folio ' + a.folio).join(', ')}`);
  };
  const ocupado = async (id, fn) => { b2bConc.ocupado = id; b2bConc.error = ''; repintar(); try { await fn(); B2b.pasarAPlanilla().catch(() => {}); } catch (e) { b2bConc.error = errorB2b(e); } b2bConc.ocupado = ''; repintar(); };
  el.querySelectorAll('[data-mov-auto]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); ocupado(b.dataset.movAuto, () => confirmar(b.dataset.movAuto, false)); }));
  el.querySelectorAll('[data-mov-ok]').forEach(b => b.addEventListener('click', () => ocupado(b.dataset.movOk, () => confirmar(b.dataset.movOk, true))));
  if ($('conc-todos')) $('conc-todos').addEventListener('click', () => ocupado('todos', async () => {
    let ok = 0; const errores = [];
    for (const m of grupos.auto) { try { await confirmar(m.id, false); ok++; } catch (e) { errores.push(`${pesos(m.monto)}: ${errorB2b(e)}`); } }
    b2bConc.msg = `Listo: ${ok} ${ok === 1 ? 'abono confirmado' : 'abonos confirmados'}.`;
    if (errores.length) throw new Error(errores.join(' · '));
  }));
  el.querySelectorAll('[data-mov-cli]').forEach(sel => sel.addEventListener('change', () => { const id = sel.dataset.movCli; if (sel.value) b2bConc.forzados[id] = sel.value; else delete b2bConc.forzados[id]; delete b2bConc.edit[id]; b2bConc.abierto = id; repintar(); }));
  el.querySelectorAll('[data-mov-monto]').forEach(inp => {
    inp.addEventListener('input', () => { const id = inp.dataset.movMonto, e = b2bConc.edit[id] || (b2bConc.edit[id] = { montos: {} });
      if (!e.montos) e.montos = {};
      if (!Object.keys(e.montos).length) el.querySelectorAll(`[data-mov-monto="${CSS.escape(id)}"]`).forEach(x => { e.montos[x.dataset.folio] = Math.round(Number(x.value.replace(/[^\d]/g, '')) || 0); });
      e.montos[inp.dataset.folio] = Math.round(Number(inp.value.replace(/[^\d]/g, '')) || 0); });
    inp.addEventListener('change', () => { b2bConc.abierto = inp.dataset.movMonto; repintar(); });
  });
  el.querySelectorAll('[data-mov-rev]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.movRev, m = d.movimientos.find(x => x.id === id);
    const r = await pedirDatos('Ya estaba registrado', `<p class="ayuda">${pesos(m.monto)} · ${esc(m.descripcion)} (${esc(diaTexto(m.fecha))})</p><p class="ayuda">No se registra ningún pago: el abono queda como revisado (por ejemplo, un pago que ya anotaste a mano o un anticipo).</p>
      <div class="campo"><label for="pd-nota">Nota (opcional)</label><input id="pd-nota" maxlength="200" placeholder="Ej: ya registrado el folio 5512"></div>`, 'Marcar revisado', dd => ({ nota: dd.querySelector('#pd-nota').value }));
    if (!r) return;
    ocupado(id, async () => { await B2b.marcarMovimiento(id, 'revisado', r.nota); registrar('Abono de cartola revisado', `${pesos(m.monto)} · ${m.descripcion}`); });
  }));
  el.querySelectorAll('[data-mov-ign]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.movIgn, m = d.movimientos.find(x => x.id === id), patron = B2b.normCartola(m.descripcion).replace(/^(TEF( BANCOESTADO)?( DE)+)\s*/, '');
    const r = await pedirDatos('No es de B2B', `<p class="ayuda">${pesos(m.monto)} · ${esc(m.descripcion)} (${esc(diaTexto(m.fecha))})</p><p class="ayuda">No se registra ningún pago y deja de aparecer aquí.</p>
      <label class="check-linea"><input type="checkbox" id="pd-siempre"> Ignorar siempre los abonos que digan:</label>
      <div class="campo"><label for="pd-patron" class="sr">Texto a ignorar</label><input id="pd-patron" value="${esc(patron)}"></div>
      <div class="campo"><label for="pd-nota">Nota (opcional)</label><input id="pd-nota" maxlength="200" placeholder="Ej: transferencia entre mis cuentas"></div>`, 'No es de B2B',
      dd => { const siempre = dd.querySelector('#pd-siempre').checked, pt = dd.querySelector('#pd-patron').value.trim(); if (siempre && B2b.normCartola(pt).length < 4) return { error: 'Escribe un texto más largo para ignorar.' }; return { nota: dd.querySelector('#pd-nota').value, patron: siempre ? pt : '' }; });
    if (!r) return;
    ocupado(id, async () => { await B2b.marcarMovimiento(id, 'ignorado', r.nota, r.patron); registrar('Abono de cartola ignorado', `${pesos(m.monto)} · ${m.descripcion}${r.patron ? ' · siempre: ' + r.patron : ''}`); });
  }));
}
// Primera vez: traer lo que ya se concilió en la app antigua (así no vuelve a aparecer)
function pintarConcInicio(el, sub) {
  el.innerHTML = cabB2b(sub) + `<section class="tarjeta" aria-labelledby="t-conc-ini"><h2 id="t-conc-ini">Antes de la primera cartola</h2>
    <p>La conciliación de la app antigua tiene guardado lo ya conciliado, los nombres que aprendió (quién paga con qué descripción), lo que se ignora y los abonos que quedaron por revisar. Hay que traerlo <b>una sola vez</b>, para que nada se vuelva a mostrar ni se registre dos veces.</p>
    <p class="ayuda">Necesita el script de B2B v${B2b.VERSION_CONCILIACION}. Solo lee la planilla; no cambia nada en ella.</p>
    <div class="botones" style="justify-content:flex-start"><button type="button" class="btn" id="conc-importar" ${b2bConc.cargando ? 'disabled' : ''}>${b2bConc.cargando ? 'Trayendo…' : 'Traer lo de la app antigua'}</button>
      <button type="button" class="btn-sec" id="conc-sin">Empezar sin historial</button></div>
    ${b2bConc.error ? `<p class="error" role="alert">${esc(b2bConc.error)}</p>` : ''}</section>`;
  $('conc-importar').addEventListener('click', async () => {
    b2bConc.cargando = true; b2bConc.error = ''; pintarConcInicio(el, sub);
    try { const r = await B2b.importarConciliacionAntigua(); b2bConc.msg = `Listo: se trajeron ${r.historial} abonos ya conciliados, ${r.pendientes} por revisar, ${r.equivalencias} nombres aprendidos y ${r.ignorar} textos a ignorar.`; registrar('Trajo la conciliación de la app antigua', b2bConc.msg); }
    catch (e) { b2bConc.error = errorB2b(e); }
    b2bConc.cargando = false; if (subVista() === 'conciliacion') pintarB2bConciliacion($('v-b2b'), 'conciliacion');
  });
  $('conc-sin').addEventListener('click', async () => {
    if (!confirm('¿Empezar sin traer nada?\n\nÚsalo solo si nunca usaste la conciliación en la app antigua: si no, lo ya conciliado volvería a aparecer.')) return;
    try { await B2b.empezarConciliacionSinHistorial(); } catch (e) { b2bConc.error = errorB2b(e); pintarConcInicio(el, sub); }
  });
}
// Carga una librería de cdnjs una sola vez
const scriptsCargados = {};
function cargarScriptExterno(src, listo) {
  if (listo && listo()) return Promise.resolve();
  if (!scriptsCargados[src]) scriptsCargados[src] = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = () => ok(); sc.onerror = () => { delete scriptsCargados[src]; no(new Error('No se pudo cargar el lector de Excel (revisa internet).')); }; document.head.appendChild(sc); });
  return scriptsCargados[src];
}

// ── v0.14.1 · Análisis ─────────────────────────────
const b2bAn = { tipo: 'mes', desde: '', hasta: '', clienteId: '', vista: 'ranking', res: null, clave: '', cargando: false, error: '' };
const PERIODOS_AN = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['semanaAnterior', 'Semana pasada'], ['mes', 'Este mes'], ['mesAnterior', 'Mes pasado'], ['otro', 'Otras fechas']];
function pintarB2bAnalisis(el, sub) {
  if (!catOk()) return sinActivar(el, sub);
  const d = b2b.datos, s = b2bAn;
  const per = B2b.periodoAnalisis(s.tipo, s.desde, s.hasta);
  const clave = [per.desde, per.hasta, per.antes.desde, per.antes.hasta].join('|');
  if (s.clave !== clave && !s.cargando) {
    s.cargando = true; s.error = '';
    Promise.all([B2b.ordenesEntre(per.desde, per.hasta), B2b.ordenesEntre(per.antes.desde, per.antes.hasta), B2b.pagadasEntre(per.desde, per.hasta)])
      .then(([a, b, c]) => { s.datos = { a, b, c }; s.clave = clave; })
      .catch(e => { s.error = errorB2b(e); s.clave = clave; s.datos = null; })
      .finally(() => { s.cargando = false; if (subVista() === 'analisis') pintarB2bAnalisis($('v-b2b'), 'analisis'); });
  }
  const listo = s.clave === clave && s.datos && !s.cargando;
  const r = listo ? B2b.analizarB2b(per, s.datos.a, s.datos.b, s.datos.c, d.abonos, d.productos, s.clienteId, [...d.ordenes.values()]) : null;
  const fd = f => { const [y, m, dd] = String(f).split('-'); return `${Number(dd)} ${MESES[Number(m) - 1]}${y !== String(new Date().getFullYear()) ? ' ' + y : ''}`; };
  const rango = a => a.desde === a.hasta ? fd(a.desde) : `${fd(a.desde)} al ${fd(a.hasta)}`;
  const flecha = v => v == null ? '' : `<span class="${v >= 0 ? 'tend-sube' : 'tend-baja'}">${v >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(v * 100))}%</span>`;
  const cliente = d.clientes.find(c => c.id === s.clienteId);
  const filtros = `<section class="tarjeta" aria-labelledby="t-an"><div class="titulo-fila"><h2 id="t-an">Análisis ${info('Análisis de B2B', 'Resumen: lo vendido en el período (por fecha de la orden), en neto, comparado con el período anterior del mismo largo (este mes se compara con los mismos días del mes pasado). Pendiente de cobro: lo que de esas ventas falta pagar.\nCaja real: lo que efectivamente entró en el período, por fecha de pago (la del banco cuando viene de la conciliación). Un folio con abonos se cuenta por sus abonos, cada uno en su fecha.\nProductos: lo vendido por producto; por día de la semana es el promedio de unidades de ese día en el período.\nNo incluye órdenes anuladas.')}</h2><span>${esc(rango(per))}</span></div>
    <div class="chips chips-chicos" role="group" aria-label="Período">${PERIODOS_AN.map(([k, t]) => `<button type="button" class="chip-filtro" data-an-per="${k}" aria-pressed="${s.tipo === k}">${t}</button>`).join('')}</div>
    <div class="filtros-b2b" style="margin-top:10px">${s.tipo === 'otro' ? `<div class="campo"><label for="an-desde">Desde</label><input id="an-desde" type="date" value="${esc(s.desde || per.desde)}"></div><div class="campo"><label for="an-hasta">Hasta</label><input id="an-hasta" type="date" value="${esc(s.hasta || per.hasta)}"></div>` : ''}
      <div class="campo"><label for="an-cli">Cliente</label><select id="an-cli"><option value="">Todos los clientes</option>${d.clientes.map(c => `<option value="${esc(c.id)}" ${c.id === s.clienteId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div></div>
    ${s.error ? `<p class="error">${esc(s.error)}</p>` : ''}</section>`;
  if (!r) { el.innerHTML = cabB2b(sub) + filtros + `<section class="tarjeta"><div class="vacio" style="border:0">${s.error ? 'No se pudo leer.' : 'Leyendo…'}</div></section>`; conectar(); return; }
  const R = r.resumen, C = r.caja;
  const resumen = `<section class="tarjeta" aria-labelledby="t-an-res"><div class="titulo-fila"><h2 id="t-an-res">Resumen${cliente ? ' · ' + esc(cliente.nombre) : ''}</h2><span>frente a ${esc(rango(per.antes))}</span></div>
    <div class="cifras cifras-an">
      <div class="cifra-an"><span class="rotulo">Ventas (neto)</span><span class="valor">${pesos(R.neto)}</span><span class="nota">${flecha(R.var.neto)} antes ${pesos(R.antes.neto)}</span></div>
      <div class="cifra-an"><span class="rotulo">Órdenes</span><span class="valor">${R.n}</span><span class="nota">${flecha(R.var.n)} antes ${R.antes.n}</span></div>
      <div class="cifra-an"><span class="rotulo">Ticket promedio</span><span class="valor">${pesos(R.ticket)}</span><span class="nota">neto por orden · antes ${pesos(R.antes.ticket)}</span></div>
      <div class="cifra-an"><span class="rotulo">Pendiente de cobro</span><span class="valor" style="color:var(--rojo-t)">${pesos(R.pendiente)}</span><span class="nota">de estas ventas · cobrado ${pesos(R.cobrado)}</span></div>
    </div>
    <p class="ayuda">Total con IVA ${pesos(R.total)} (IVA ${pesos(R.iva)}) · facturado ${pesos(R.facturado)} · sin factura ${pesos(R.total - R.facturado)}</p></section>`;
  const caja = `<section class="tarjeta" aria-labelledby="t-an-caja"><div class="titulo-fila"><h2 id="t-an-caja">Caja real</h2><span>${esc(rango(per))}</span></div>
    ${C.total ? `<div class="filas-caja-an">
      <div><span>Pagos de ventas del período</span><b>${pesos(C.delPeriodo)}</b></div>
      <div><span>Pagos de ventas anteriores</span><b>${pesos(C.anteriores)}</b></div>
      <div><span>Abonos (cada uno en su fecha)</span><b>${pesos(C.abonos)}</b></div>
      <div class="total"><span>Total que entró</span><b>${pesos(C.total)}</b></div></div>
      ${C.origen.length ? `<details class="detalle-an"><summary>De qué meses vienen los pagos anteriores</summary>${C.origen.map(o => `<div><span>${esc(MESES_LARGOS[Number(o.mes.slice(5)) - 1] || o.mes)} ${esc(o.mes.slice(0, 4))} · ${o.n} ${o.n === 1 ? 'orden' : 'órdenes'}</span><b>${pesos(o.total)}</b></div>`).join('')}</details>` : ''}
      ${C.detalleAbonos.length ? `<details class="detalle-an"><summary>Detalle de abonos (${C.detalleAbonos.length})</summary>${C.detalleAbonos.map(a => `<div><span>${esc(diaTexto(a.fecha))} · folio ${esc(a.folio)}${a.referencia ? ' · ' + esc(a.referencia) : ''}</span><b>${pesos(a.monto)}</b></div>`).join('')}</details>` : ''}`
      : '<div class="vacio" style="border:0">No entraron pagos en este período.</div>'}</section>`;
  const vistas = [['ranking', 'Ranking'], ['dias', 'Por día de la semana'], ['precios', 'Precio real'], ...(s.clienteId ? [['cliente', 'Qué dejó de pedir']] : [])];
  if (!vistas.some(([k]) => k === s.vista)) s.vista = 'ranking';
  const top = r.ranking.slice(0, 40);
  const fmtU = u => (Math.round(u * 10) / 10).toLocaleString('es-CL');
  const tabla = {
    ranking: () => `<table class="tabla-tiempos"><thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Neto</th><th scope="col">% del total</th><th scope="col">Frente a antes</th></tr></thead><tbody>
      ${top.map(p => `<tr><td>${esc(p.producto)}${s.clienteId ? '' : `<br><span class="ayuda">${p.clientes} ${p.clientes === 1 ? 'cliente' : 'clientes'}</span>`}</td><td>${fmtU(p.unidades)}</td><td>${pesos(p.neto)}</td><td><span class="barra-an"><i style="width:${Math.max(2, Math.round(p.parte * 100))}%"></i></span> ${Math.round(p.parte * 1000) / 10}%</td><td>${p.nuevo ? '<span class="chip c-azul chip-chico">Nuevo</span>' : flecha(p.varNeto)}</td></tr>`).join('')}</tbody></table>`,
    dias: () => `<table class="tabla-tiempos tabla-dias-an"><thead><tr><th scope="col">Producto</th>${r.diasSemana.map((x, i) => `<th scope="col">${x}${r.nDia[i] ? '' : '*'}</th>`).join('')}</tr></thead><tbody>
      ${top.slice(0, 25).map(p => { const mx = Math.max(...p.porDia.map(v => v || 0)); return `<tr><td>${esc(p.producto)}</td>${p.porDia.map(v => `<td class="${v && v === mx ? 'max-an' : ''}">${v == null ? '—' : v ? fmtU(v) : '·'}</td>`).join('')}</tr>`; }).join('')}</tbody></table>
      <p class="ayuda">Promedio de unidades por día de la semana en el período${r.nDia.some(x => !x) ? ' (* ese día no está en el período)' : ''}. Lo más alto de cada producto va marcado.</p>`,
    precios: () => `<table class="tabla-tiempos"><thead><tr><th scope="col">Producto</th><th scope="col">Precio real</th><th scope="col">Precio base</th><th scope="col">Diferencia</th></tr></thead><tbody>
      ${top.map(p => `<tr><td>${esc(p.producto)}</td><td>${pesos(p.precioReal)}</td><td>${p.precioBase ? pesos(p.precioBase) : '—'}</td><td>${p.descuento == null ? '—' : p.descuento > 0.005 ? `<span class="tend-baja">−${Math.round(p.descuento * 1000) / 10}%</span>` : p.descuento < -0.005 ? `<span class="tend-sube">+${Math.round(-p.descuento * 1000) / 10}%</span>` : 'igual'}</td></tr>`).join('')}</tbody></table>
      <p class="ayuda">Precio real: neto promedio por unidad en el período (con los precios especiales). La diferencia es contra el precio base de hoy.</p>`,
    cliente: () => r.dejados.length ? `<table class="tabla-tiempos"><thead><tr><th scope="col">Producto que pedía</th><th scope="col">Unidades antes</th><th scope="col">Neto antes</th></tr></thead><tbody>${r.dejados.map(p => `<tr><td>${esc(p.producto)}</td><td>${fmtU(p.unidadesAntes)}</td><td>${pesos(p.netoAntes)}</td></tr>`).join('')}</tbody></table>
      <p class="ayuda">Productos que ${esc(cliente ? cliente.nombre : 'el cliente')} pidió en ${esc(rango(per.antes))} y no en este período.</p>` : '<div class="vacio" style="border:0">Pidió todo lo que pedía en el período anterior.</div>'
  };
  const prods = `<section class="tarjeta" aria-labelledby="t-an-prod"><div class="titulo-fila"><h2 id="t-an-prod">Productos${cliente ? ' · ' + esc(cliente.nombre) : ''}</h2><span>${r.ranking.length} ${r.ranking.length === 1 ? 'producto' : 'productos'}</span></div>
    <div class="pastillas" role="group" aria-label="Ver" style="margin-bottom:10px">${vistas.map(([k, t]) => `<button type="button" class="pastilla" data-an-vista="${k}" aria-pressed="${s.vista === k}">${t}</button>`).join('')}</div>
    ${r.ranking.length || s.vista === 'cliente' ? `<div class="tabla-b2b">${tabla[s.vista]()}</div>` : '<div class="vacio" style="border:0">Sin ventas en este período.</div>'}</section>`;
  el.innerHTML = cabB2b(sub) + filtros + resumen + caja + prods;
  conectar();
  function conectar() {
    el.querySelectorAll('[data-an-per]').forEach(b => b.addEventListener('click', () => { s.tipo = b.dataset.anPer; pintarB2bAnalisis(el, sub); }));
    if ($('an-desde')) { $('an-desde').addEventListener('change', e => { s.desde = e.target.value; s.hasta = s.hasta || $('an-hasta').value; pintarB2bAnalisis(el, sub); }); $('an-hasta').addEventListener('change', e => { s.hasta = e.target.value; s.desde = s.desde || $('an-desde').value; pintarB2bAnalisis(el, sub); }); }
    $('an-cli').addEventListener('change', e => { s.clienteId = e.target.value; pintarB2bAnalisis(el, sub); });
    el.querySelectorAll('[data-an-vista]').forEach(b => b.addEventListener('click', () => { s.vista = b.dataset.anVista; pintarB2bAnalisis(el, sub); }));
  }
}

function pintarMenuCelular() {
  const u = estado.user, eq = estado.equipo || {};
  $('v-menu').innerHTML = `
    <div class="cabecera"><div><h1 id="t-menu">Menú</h1></div></div>
    <section class="tarjeta" aria-label="En Sistema Fën">
      <div class="grupo" style="padding:0 0 4px">En Sistema Fën</div>
      <a class="nav-item" href="#hoy">${icono('hoy')}Hoy</a>
      <a class="nav-item" href="#agenda">${icono('calendario')}Agenda</a>
      <a class="nav-item" href="#gastos">${icono('boleta')}Gastos</a>
      <a class="nav-item" href="#b2b">${icono('camion')}Ventas B2B</a>
      <a class="nav-item" href="#caja">${icono('cajon')}Ventas de caja</a>
      <a class="nav-item" href="#ajustes">${icono('ajustes')}Configuración</a>
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

// ── Ventas de caja (administración) ────────────────
// Cierres: cajas sin cerrar, cierres sin pasar a planilla y arqueos de los últimos 60 días.
// Anulaciones: aprobar o rechazar. La lógica está en caja.js (la misma de la caja v2.1.1).
const fechaCaja = f => { const n = Caja.normalizarFechaCaja(f); if (!n) return f || ''; const [y, m, d] = n.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`; };
const signo = n => (n > 0 ? '+' : '') + pesos(n);

function dialogo(html) {
  const d = document.createElement('dialog');
  d.className = 'dialogo';
  d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

function pestanasCaja(sub) {
  return `<div class="pestanas" role="tablist" aria-label="Secciones de Ventas de caja">
    <a role="tab" href="#caja" aria-selected="${!['anulaciones', 'reportes', 'stock'].includes(sub)}">Cierres</a>
    <a role="tab" href="#caja/anulaciones" aria-selected="${sub === 'anulaciones'}">Anulaciones</a>
    <a role="tab" href="#caja/reportes" aria-selected="${sub === 'reportes'}">Reportes</a>
    <a role="tab" href="#caja/stock" aria-selected="${sub === 'stock'}">Merma y stock</a></div>`;
}

async function pintarCaja(sub) {
  const el = $('v-caja');
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    <div class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></div>`;
  try {
    if (sub === 'anulaciones') await pintarAnulaciones(el, sub);
    else if (sub === 'reportes') await pintarReportes(el, sub);
    else if (sub === 'stock') await pintarStock(el, sub);
    else await pintarCierres(el, sub);
  } catch (e) {
    el.querySelector('.tarjeta').innerHTML = `<div class="error">${esc(mensajeError(e))}</div>`;
  }
}

async function pintarCierres(el, sub) {
  const { sinCerrar, sinPlanilla, evaluaciones } = await Caja.leerCierres();
  const filaCaja = (c, botones) => `<div class="fila-caja"><div class="txt"><b>${esc(fechaCaja(c.fecha))} · ${esc(sucursal(c.sucursal))}</b>
      <span>${esc(c.usuario || '')} · ${pesos(c.totalVentas)} vendidos · ${(parseInt(c.nVentas) || 0) === 1 ? '1 venta' : (parseInt(c.nVentas) || 0) + ' ventas'}${c.exportError ? ' · ' + esc(c.exportError) : ''}</span></div>
      <div class="acciones">${botones}</div></div>`;
  // Estado de cada arqueo: por revisar (diferencia sin aceptar) primero, después el resto.
  const estadoEv = e => e.sinArqueo ? 'sin' : (parseInt(e.difTotal) || 0) === 0 ? 'ok' : e.diferenciaAceptada === true ? 'aceptada' : 'revisar';
  evaluaciones.sort((a, b) => (estadoEv(a) === 'revisar' ? 0 : 1) - (estadoEv(b) === 'revisar' ? 0 : 1));
  const porRevisar = evaluaciones.filter(e => estadoEv(e) === 'revisar').length;
  const evFila = e => {
    const dif = parseInt(e.difTotal) || 0, st = estadoEv(e);
    const btnCorregir = `<button type="button" class="btn-sec" data-corregir="${esc(e.id)}">Corregir</button>`;
    const acciones = {
      sin: '<span class="chip c-gris">Sin arqueo</span>' + btnCorregir,
      ok: '<span class="chip c-verde">Cuadrada</span>',
      aceptada: `<span class="chip c-gris">${esc(signo(dif))} · aceptada</span>`,
      revisar: `<span class="chip c-rojo">${esc(signo(dif))}</span>${btnCorregir}<button type="button" class="btn-sec" data-aceptar="${esc(e.id)}">Aceptar diferencia</button>`
    }[st];
    return `<div class="fila-caja"><div class="txt"><b>${esc(fechaCaja(e.fecha))} · ${esc(sucursal(e.sucursal))}</b>
      <span>${e.usuario ? esc(e.usuario) + ' · ' : ''}sistema ${pesos(e.sistTotal)}${e.sinArqueo ? '' : ' · contado ' + pesos(e.manTotal)}${e.corregido ? ' · corregido por ' + esc(e.corregidoPor || '') : ''}${e.cerradoDesde ? ' · cerrada desde ' + esc(e.cerradoDesde) : ''}</span>
      ${e.notaDescuadre ? `<span class="nota">“${esc(e.notaDescuadre)}”</span>` : ''}
      ${st === 'aceptada' ? `<span class="nota">Aceptada por ${esc(e.aceptadaPor || '')}${e.notaAceptacion ? ': “' + esc(e.notaAceptacion) + '”' : ''}</span>` : ''}</div>
      <div class="acciones">${acciones}</div></div>`;
  };
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    ${sinCerrar.length ? `<section class="tarjeta" aria-labelledby="t-sin-cerrar">
      <div class="titulo-fila"><h2 id="t-sin-cerrar">Cajas sin cerrar</h2><span>${sinCerrar.length}</span></div>
      <p class="ayuda" style="margin:0 0 4px">Quedaron abiertas de un día anterior. Ciérralas para que su cierre llegue a la planilla.</p>
      <div data-colapsar>${sinCerrar.map(c => filaCaja(c, `<button type="button" class="btn-sec" data-arqueo="${esc(c.id)}">Cerrar con arqueo</button><button type="button" class="btn-sec" data-sin-arqueo="${esc(c.id)}">Cerrar sin arqueo</button>`)).join('')}</div>
      <p class="nota-i">(i) Sin arqueo: usa solo los totales del sistema, sin conteo de comparación. Úsalo cuando ya no se puede contar el efectivo de ese turno.</p>
    </section>` : ''}
    ${sinPlanilla.length ? `<section class="tarjeta" aria-labelledby="t-sin-planilla">
      <div class="titulo-fila"><h2 id="t-sin-planilla">Cierres sin pasar a planilla</h2><button type="button" class="btn-sec" id="btn-reenviar-todas">Reenviar todas</button></div>
      <div data-colapsar>${sinPlanilla.map(c => filaCaja(c, `<button type="button" class="btn-sec" data-reenviar="${esc(c.id)}">Reenviar</button>`)).join('')}</div>
      <p class="nota-i">(i) Reenviar no duplica filas: si el cierre ya estaba en la planilla, no se vuelve a escribir.</p>
    </section>` : ''}
    <section class="tarjeta" aria-labelledby="t-arqueos">
      <div class="titulo-fila"><h2 id="t-arqueos">Arqueos</h2><span>${porRevisar ? `${porRevisar} por revisar · ` : ''}Últimos ${F.DIAS_HISTORIAL} días</span></div>
      ${evaluaciones.length ? `<div data-colapsar>${evaluaciones.map(evFila).join('')}</div>` : '<div class="vacio">Sin cierres en estos días.</div>'}
      ${porRevisar ? '<p class="nota-i">(i) Corregir: si se contó o anotó mal y tienes el conteo real. Aceptar diferencia: si ya no se puede aclarar; los montos no cambian, queda anotado quién la aceptó y deja de aparecer en Hoy.</p>' : ''}
    </section>`;

  const porId = (lista, id) => lista.find(x => x.id === id);
  el.querySelectorAll('[data-arqueo]').forEach(b => b.addEventListener('click', async () => {
    const c = porId(sinCerrar, b.dataset.arqueo);
    if (await sigueVendiendo(c, b)) return;
    abrirArqueo(c);
  }));
  el.querySelectorAll('[data-sin-arqueo]').forEach(b => b.addEventListener('click', async () => {
    const c = porId(sinCerrar, b.dataset.sinArqueo);
    if (await sigueVendiendo(c, b)) return;
    if (!window.confirm(`¿Cerrar la caja del ${fechaCaja(c.fecha)} (${sucursal(c.sucursal)}) SIN arqueo?\n\nSe usan solo los totales del sistema y el cierre se pasa a la planilla.`)) return;
    b.disabled = true; b.textContent = 'Cerrando…';
    try {
      const r = await Caja.cerrarCajaAnterior(c.id, null);
      registrar('Cerró una caja sin arqueo', `${sucursal(c.sucursal)} · ${fechaCaja(c.fecha)}`);
      avisoResultado(r, 'Caja cerrada');
    } catch (e) { alert(e.message || mensajeError(e)); }
    pintarCaja('');
  }));
  el.querySelectorAll('[data-reenviar]').forEach(b => b.addEventListener('click', async () => {
    const c = porId(sinPlanilla, b.dataset.reenviar);
    b.disabled = true; b.textContent = 'Enviando…';
    const r = await Caja.reenviarCierre(c.id);
    if (r.ok) registrar('Reenvió un cierre a la planilla', `${sucursal(c.sucursal)} · ${fechaCaja(c.fecha)}`);
    avisoResultado(r, 'Cierre enviado a la planilla');
    pintarCaja('');
  }));
  const todas = $('btn-reenviar-todas');
  if (todas) todas.addEventListener('click', async () => {
    todas.disabled = true; todas.textContent = 'Enviando…';
    let ok = 0, mal = 0;
    for (const c of sinPlanilla) { (await Caja.reenviarCierre(c.id)).ok ? ok++ : mal++; }
    if (ok) registrar('Reenvió cierres a la planilla', `${ok} cierres`);
    alert(`Enviados: ${ok}${mal ? ` · con error: ${mal} (quedan en la lista para reintentar)` : ''}`);
    pintarCaja('');
  });
  el.querySelectorAll('[data-corregir]').forEach(b => b.addEventListener('click', () => abrirCorreccion(porId(evaluaciones, b.dataset.corregir))));
  el.querySelectorAll('[data-aceptar]').forEach(b => b.addEventListener('click', () => abrirAceptar(porId(evaluaciones, b.dataset.aceptar))));
  colapsar(el);
}

// ── Reportes de ventas ─────────────────────────────
// Lee los resúmenes de cada cierre (resumenes_caja), no las ventas una por una:
// un mes son ~60 lecturas en vez de miles. Las cajas abiertas no entran hasta cerrarse.
const AREAS_NOMBRE = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería', Otros: 'Otros' };
const MEDIOS_NOMBRE = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia' };
const repEstado = { periodo: 'mes', desde: '', hasta: '', suc: '', area: '' };
const aDia = d => Caja.diaLocal(d);
const sumarDias = (dia, n) => { const [y, m, d] = dia.split('-').map(Number); return aDia(new Date(y, m - 1, d + n)); };
const diasEntre = (a, b) => { const [y, m, d] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y, m - 1, d)) / 864e5); };
function rangoPeriodo(p) {
  const hoy = new Date(), h = aDia(hoy);
  if (p === 'ayer') { const a = sumarDias(h, -1); return [a, a]; }
  if (p === '7d') return [sumarDias(h, -7), sumarDias(h, -1)];
  if (p === 'mes') return [aDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), h];
  if (p === 'mesant') return [aDia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), aDia(new Date(hoy.getFullYear(), hoy.getMonth(), 0))];
  return [repEstado.desde || h, repEstado.hasta || h];
}
const diaCorto = dia => { const [y, m, d] = dia.split('-').map(Number); return `${d} ${MESES[m - 1]}`; };
const pct = (a, t) => (t ? Math.round(a * 100 / t) : 0);

// Suma varios resúmenes en uno
function sumarResumenes(lista) {
  const t = { nVentas: 0, nAnuladas: 0, bruto: 0, porMedio: {}, porArea: {}, porProducto: {}, porDia: {}, porSuc: {} };
  lista.forEach(r => {
    const b = Number(r.totalBruto) || 0;
    t.nVentas += Number(r.nVentas) || 0; t.nAnuladas += Number(r.nAnuladas) || 0; t.bruto += b;
    Object.entries(r.porMedio || {}).forEach(([k, v]) => { t.porMedio[k] = (t.porMedio[k] || 0) + (Number(v) || 0); });
    Object.entries(r.porArea || {}).forEach(([k, v]) => { const a = t.porArea[k] || (t.porArea[k] = { cantidad: 0, bruto: 0 }); a.cantidad += Number(v.cantidad) || 0; a.bruto += Number(v.bruto) || 0; });
    Object.entries(r.porProducto || {}).forEach(([k, v]) => {
      const key = v.nombre || k;
      const p = t.porProducto[key] || (t.porProducto[key] = { nombre: v.nombre || k, area: v.area || 'Otros', cantidad: 0, bruto: 0 });
      p.cantidad += Number(v.cantidad) || 0; p.bruto += Number(v.bruto) || 0;
    });
    const dd = t.porDia[r.fecha] || (t.porDia[r.fecha] = { bruto: 0, nVentas: 0 }); dd.bruto += b; dd.nVentas += Number(r.nVentas) || 0;
    const ss = t.porSuc[r.sucursal] || (t.porSuc[r.sucursal] = { bruto: 0, nVentas: 0 }); ss.bruto += b; ss.nVentas += Number(r.nVentas) || 0;
  });
  return t;
}

// Barras horizontales de un solo color (magnitud). El texto va siempre en tinta, no en el color de la barra.
function barras(filas, total) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  return `<div class="barras" data-colapsar="8">${filas.map(f => `<div class="barra-h">
      <div class="barra-h-txt"><span>${esc(f.nombre)}${f.extra ? ` <small>${esc(f.extra)}</small>` : ''}</span><b>${pesos(f.valor)}${total ? ` <small>${pct(f.valor, total)}%</small>` : ''}</b></div>
      <div class="barra-h-pista"><div class="barra-h-relleno" style="width:${Math.max(0.5, f.valor * 100 / max)}%"></div></div></div>`).join('')}</div>`;
}

async function pintarReportes(el, sub) {
  const preset = (location.hash || '').split('/')[2];
  if (preset && ['ayer', '7d', 'mes', 'mesant'].includes(preset)) { repEstado.periodo = preset; history.replaceState(null, '', '#caja/reportes'); }
  const [desde, hasta] = rangoPeriodo(repEstado.periodo);
  repEstado.desde = desde; repEstado.hasta = hasta;
  const largo = diasEntre(desde, hasta) + 1;
  const prevHasta = sumarDias(desde, -1), prevDesde = sumarDias(desde, -largo);
  const [todos, cajas] = await Promise.all([Caja.leerResumenes(prevDesde, hasta), Caja.cajasDelRango(desde, hasta)]);
  const filtroSuc = r => !repEstado.suc || r.sucursal === repEstado.suc;
  const actuales = todos.filter(r => r.fecha >= desde && filtroSuc(r));
  const previos = todos.filter(r => r.fecha <= prevHasta && filtroSuc(r));
  const t = sumarResumenes(actuales), tp = sumarResumenes(previos);
  const conResumen = new Set(todos.map(r => r.id));
  const cajasSuc = cajas.filter(filtroSuc);
  const faltan = cajasSuc.filter(c => c.estado === 'cerrada' && !conResumen.has(c.id));
  const abiertas = cajasSuc.filter(c => c.estado === 'abierta');
  const neto = Math.round(t.bruto / 1.19);
  const ticket = t.nVentas ? Math.round(t.bruto / t.nVentas) : 0;
  const varPct = tp.bruto ? Math.round((t.bruto - tp.bruto) * 100 / tp.bruto) : null;

  // Días del período (barras verticales); más de 62 días → por mes
  const porMes = largo > 62;
  const columnas = [];
  if (porMes) {
    const meses = {};
    Object.entries(t.porDia).forEach(([d, v]) => { const k = d.slice(0, 7); const m = meses[k] || (meses[k] = { bruto: 0, nVentas: 0 }); m.bruto += v.bruto; m.nVentas += v.nVentas; });
    for (let d = desde.slice(0, 7); d <= hasta.slice(0, 7); ) { const [y, m] = d.split('-').map(Number); columnas.push({ clave: d, rot: MESES[m - 1], titulo: `${MESES_LARGOS[m - 1]} ${y}`, ...(meses[d] || { bruto: 0, nVentas: 0 }) }); d = aDia(new Date(y, m, 1)).slice(0, 7); }
  } else {
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      const [y, m, dd] = d.split('-').map(Number); const dow = new Date(y, m - 1, dd).getDay();
      columnas.push({ clave: d, rot: String(dd), titulo: `${DIAS[dow]} ${dd} ${MESES[m - 1]}`, finde: dow === 0 || dow === 6, ...(t.porDia[d] || { bruto: 0, nVentas: 0 }) });
    }
  }
  const maxCol = Math.max(1, ...columnas.map(c => c.bruto));
  const cadaRot = columnas.length > 16 ? Math.ceil(columnas.length / 12) : 1;

  const areas = Object.entries(t.porArea).sort((a, b) => b[1].bruto - a[1].bruto);
  const prods = Object.values(t.porProducto).filter(p => !repEstado.area || p.area === repEstado.area).sort((a, b) => b.bruto - a.bruto);
  const btnPer = (id, txt) => `<button type="button" class="chip-filtro" data-periodo="${id}" aria-pressed="${repEstado.periodo === id}">${txt}</button>`;
  const titulo = desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} – ${diaCorto(hasta)}`;

  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    <div class="filtros" role="group" aria-label="Período y sucursal">
      <div class="chips">${btnPer('ayer', 'Ayer')}${btnPer('7d', 'Últimos 7 días')}${btnPer('mes', 'Este mes')}${btnPer('mesant', 'Mes anterior')}${btnPer('otro', 'Otras fechas')}</div>
      <div class="filtros-der">
        ${repEstado.periodo === 'otro' ? `<label class="fecha-filtro">Desde <input type="date" id="rep-desde" value="${desde}" max="${aDia(new Date())}"></label><label class="fecha-filtro">Hasta <input type="date" id="rep-hasta" value="${hasta}" max="${aDia(new Date())}"></label>` : ''}
        <select id="rep-suc" aria-label="Sucursal"><option value="">Las dos sucursales</option>${Object.entries(SUCURSALES).map(([k, v]) => `<option value="${k}" ${repEstado.suc === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </div>
    </div>
    ${faltan.length ? `<div class="aviso aviso-accion" role="status"><div><b>Faltan ${faltan.length} ${faltan.length === 1 ? 'resumen' : 'resúmenes'} en este período.</b> Esos cierres no están sumados abajo. Generarlos lee las ventas de esas cajas una vez.</div><button type="button" class="btn-sec" id="rep-generar">Generar ${faltan.length === 1 ? 'el que falta' : 'los que faltan'}</button></div>` : ''}
    <div class="cifras cifras-4">
      <div class="tarjeta cifra"><span class="rotulo">Ventas · ${esc(titulo)} ${info('Ventas del período', 'Suma de lo vendido en caja en los cierres de estos días, con IVA y después de descuentos. No incluye cajas que siguen abiertas ni ventas anuladas.\nEl porcentaje compara con el mismo número de días justo antes (por ejemplo, este mes hasta hoy contra los mismos días anteriores).')}</span><span class="valor">${pesos(t.bruto)}</span><span class="nota">${varPct === null ? 'Bruto, con IVA' : `${varPct >= 0 ? '+' : ''}${varPct}% vs los ${largo} días anteriores`}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Neto (sin IVA) ${info('Neto', 'Las ventas sin el 19% de IVA (bruto / 1,19). Es el monto que usa el costeo y el que se compara con los gastos.')}</span><span class="valor">${pesos(neto)}</span><span class="nota">IVA ${pesos(t.bruto - neto)}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Ventas</span><span class="valor">${t.nVentas.toLocaleString('es-CL')}</span><span class="nota">${t.nAnuladas ? `${t.nAnuladas} anuladas, no suman` : 'Sin anuladas'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Ticket promedio ${info('Ticket promedio', 'Cuánto gasta en promedio cada cliente: ventas brutas divididas por el número de ventas (boletas) del período.\nSirve para ver si la gente compra más por visita, no solo si vienen más.')}</span><span class="valor">${pesos(ticket)}</span><span class="nota">Bruto por venta</span></div>
    </div>
    ${t.nVentas ? `
    <section class="tarjeta" aria-labelledby="t-rep-dias">
      <div class="titulo-fila"><h2 id="t-rep-dias">${porMes ? 'Por mes' : 'Por día'}</h2><span>Bruto · ${actuales.length} ${actuales.length === 1 ? 'cierre' : 'cierres'}</span></div>
      ${columnas.length > 1 ? `<div class="columnas-graf" role="list">${columnas.map((c, i) => `<div class="col-graf${c.finde ? ' finde' : ''}" role="listitem" tabindex="0" data-tip="${esc(c.titulo)}|${esc(pesos(c.bruto))}|${c.nVentas === 1 ? '1 venta' : c.nVentas + ' ventas'}" aria-label="${esc(c.titulo)}: ${esc(pesos(c.bruto))}, ${c.nVentas === 1 ? '1 venta' : c.nVentas + ' ventas'}">
          <div class="col-graf-pista"><div class="col-graf-barra" style="height:${c.bruto ? Math.max(1.5, c.bruto * 100 / maxCol) : 0}%"></div></div>
          <span class="col-graf-rot">${i % cadaRot === 0 ? esc(c.rot) : ''}</span></div>`).join('')}</div>
        <div class="tip-graf" id="tip-graf" hidden></div>
        <p class="nota-i">(i) Toca o pasa el mouse sobre una barra para ver el monto.${porMes ? '' : ' Los sábados y domingos van con la etiqueta en verde.'}</p>` : `<p class="ayuda">Un solo día: ${pesos(t.bruto)} en ${t.nVentas} ventas.</p>`}
    </section>
    <div class="columnas">
      <section class="tarjeta col-ancha" aria-labelledby="t-rep-area">
        <div class="titulo-fila"><h2 id="t-rep-area">Por área</h2><span>Bruto</span></div>
        ${barras(areas.map(([k, v]) => ({ nombre: AREAS_NOMBRE[k] || k, extra: `${Math.round(v.cantidad).toLocaleString('es-CL')} u.`, valor: v.bruto })), t.bruto)}
      </section>
      <section class="tarjeta col-angosta" style="display:block" aria-labelledby="t-rep-medio">
        <div class="titulo-fila"><h2 id="t-rep-medio">Por medio de pago</h2></div>
        ${barras(Object.entries(t.porMedio).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ nombre: MEDIOS_NOMBRE[k] || k, valor: v })), t.bruto)}
        ${!repEstado.suc && Object.keys(t.porSuc).length > 1 ? `<div class="titulo-fila" style="margin-top:16px"><h2>Por sucursal</h2></div>${barras(Object.entries(t.porSuc).sort((a, b) => b[1].bruto - a[1].bruto).map(([k, v]) => ({ nombre: sucursal(k), extra: `${v.nVentas} ventas`, valor: v.bruto })), t.bruto)}` : ''}
      </section>
    </div>
    <section class="tarjeta" aria-labelledby="t-rep-prod">
      <div class="titulo-fila"><h2 id="t-rep-prod">Productos</h2>
        <select id="rep-area" aria-label="Filtrar productos por área"><option value="">Todas las áreas</option>${areas.map(([k]) => `<option value="${esc(k)}" ${repEstado.area === k ? 'selected' : ''}>${esc(AREAS_NOMBRE[k] || k)}</option>`).join('')}</select></div>
      ${prods.length ? `<div class="tabla-prod"><div class="fila-prod enc"><span>Producto</span><span>Unidades</span><span>Bruto</span></div>
        <div data-colapsar="10">${prods.map((p, i) => `<div class="fila-prod"><span><small>${i + 1}</small> ${esc(p.nombre)}${repEstado.area ? '' : ` <small>${esc(AREAS_NOMBRE[p.area] || p.area)}</small>`}</span><span>${Math.round(p.cantidad * 10) / 10}</span><span>${pesos(p.bruto)}</span></div>`).join('')}</div></div>` : '<div class="vacio">Sin productos en esta área.</div>'}
    </section>` : `<section class="tarjeta"><div class="vacio">Sin ventas cerradas en este período${repEstado.suc ? ' para ' + esc(sucursal(repEstado.suc)) : ''}.</div></section>`}
    ${abiertas.length ? `<p class="nota-i">(i) ${abiertas.length === 1 ? 'Hay 1 caja abierta' : `Hay ${abiertas.length} cajas abiertas`} en este período: sus ventas aparecen aquí cuando se cierra${abiertas.length === 1 ? '' : 'n'}.</p>` : ''}
    <p class="nota-i">(i) Bruto = con IVA, después de descuentos. Neto = bruto / 1,19. Lee los resúmenes de cada cierre de la caja, sin las ventas anuladas.</p>`;

  el.querySelectorAll('[data-periodo]').forEach(b => b.addEventListener('click', () => {
    repEstado.periodo = b.dataset.periodo;
    if (b.dataset.periodo === 'otro') { repEstado.desde = desde; repEstado.hasta = hasta; }
    pintarCaja('reportes');
  }));
  const cambiaFecha = () => {
    const d = $('rep-desde').value, h = $('rep-hasta').value;
    if (!d || !h) return;
    repEstado.desde = d <= h ? d : h; repEstado.hasta = d <= h ? h : d;
    if (diasEntre(repEstado.desde, repEstado.hasta) > 366) { alert('Elige hasta un año.'); return; }
    pintarCaja('reportes');
  };
  if ($('rep-desde')) { $('rep-desde').addEventListener('change', cambiaFecha); $('rep-hasta').addEventListener('change', cambiaFecha); }
  $('rep-suc').addEventListener('change', e => { repEstado.suc = e.target.value; pintarCaja('reportes'); });
  if ($('rep-area')) $('rep-area').addEventListener('change', e => { repEstado.area = e.target.value; pintarCaja('reportes'); });
  if ($('rep-generar')) $('rep-generar').addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true;
    const r = await Caja.generarResumenes(faltan, (n, tot) => { b.textContent = `Generando ${n} de ${tot}…`; });
    registrar('Generó resúmenes de caja', `${r.hechos} · ${titulo}`);
    if (r.fallas) alert(`Listos: ${r.hechos}. No se pudieron generar: ${r.fallas}. Intenta de nuevo.`);
    pintarCaja('reportes');
  });
  // Tooltip de las barras por día
  const tip = $('tip-graf');
  if (tip) {
    const graf = el.querySelector('.columnas-graf');
    const mostrar = c => {
      const [a, b, n] = c.dataset.tip.split('|');
      tip.innerHTML = `<b>${esc(b)}</b><span>${esc(a)} · ${esc(n)}</span>`; tip.hidden = false;
      const g = graf.getBoundingClientRect(), r = c.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2 - g.left, 70), g.width - 70);
      tip.style.left = x + 'px';
      el.querySelectorAll('.col-graf.activa').forEach(o => o.classList.remove('activa')); c.classList.add('activa');
    };
    el.querySelectorAll('.col-graf').forEach(c => {
      c.addEventListener('mouseenter', () => mostrar(c)); c.addEventListener('focus', () => mostrar(c)); c.addEventListener('click', () => mostrar(c));
    });
    graf.addEventListener('mouseleave', () => { tip.hidden = true; el.querySelectorAll('.col-graf.activa').forEach(o => o.classList.remove('activa')); });
  }
  colapsar(el);
}

// ── Merma y stock ──────────────────────────────────
const stEstado = { suc: 'barros_arana', area: '', periodo: 'mes' };
const fechaHora = d => d ? `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';

async function pintarStock(el, sub) {
  const [desde, hasta] = rangoPeriodo(stEstado.periodo);
  const [{ filas, merma }, registros, sinPlanilla, resumenes] = await Promise.all([
    Stock.leerStock(), Stock.leerMerma(desde, hasta), Stock.mermaSinPlanilla(), Caja.leerResumenes(desde, hasta)
  ]);
  const deSuc = x => !stEstado.suc || x.sucursal === stEstado.suc;
  const deArea = x => !stEstado.area || x.area === stEstado.area;
  const mermaPend = merma.filter(deSuc).sort((a, b) => b.valor - a.valor);
  const stock = filas.filter(deSuc).filter(deArea);
  const regs = registros.filter(deSuc);
  const ventas = resumenes.filter(deSuc).reduce((a, r) => a + (Number(r.totalBruto) || 0), 0);
  const perdida = regs.reduce((a, r) => a + (Number(r.monto) || 0), 0);
  const vendible = stock.reduce((a, f) => a + f.valor, 0);
  const areasPresentes = [...new Set(filas.filter(deSuc).map(f => f.area))].sort();
  const sucTxt = s => (stEstado.suc ? '' : ` <small>${esc(sucursal(s))}</small>`);
  const btnPer = (id, txt) => `<button type="button" class="chip-filtro" data-st-periodo="${id}" aria-pressed="${stEstado.periodo === id}">${txt}</button>`;

  // Stock por categoría
  const porCat = Stock.CATEGORIAS.map(c => ({ ...c, filas: stock.filter(f => f.categoria === c.key).sort((a, b) => a.nombre.localeCompare(b.nombre)) })).filter(c => c.filas.length);
  // Informe de merma
  const sumar = (lista, clave, valor) => { const o = {}; lista.forEach(x => { const k = clave(x); o[k] = (o[k] || 0) + valor(x); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const mArea = sumar(regs, r => r.area || 'Otros', r => Number(r.monto) || 0);
  const mMotivo = sumar(regs.flatMap(r => (r.motivos && r.motivos.length ? r.motivos : [{ motivo: r.motivo || 'Sin motivo', cantidad: r.cantidad }])), x => x.motivo || 'Sin motivo', x => Number(x.cantidad) || 0);
  const mProd = sumar(regs, r => r.nombreProducto || r.productoId, r => Number(r.monto) || 0);
  const unidades = regs.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);
  const titulo = desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} – ${diaCorto(hasta)}`;

  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    <div class="filtros"><div class="chips" role="group" aria-label="Sucursal">
      ${Object.entries(SUCURSALES).map(([k, v]) => `<button type="button" class="chip-filtro" data-st-suc="${k}" aria-pressed="${stEstado.suc === k}">${esc(v)}</button>`).join('')}
      <button type="button" class="chip-filtro" data-st-suc="" aria-pressed="${!stEstado.suc}">Las dos</button></div></div>

    <section class="tarjeta" aria-labelledby="t-merma-pend">
      <div class="titulo-fila"><h2 id="t-merma-pend">Merma por registrar</h2>${mermaPend.length > 1 ? `<button type="button" class="btn-sec" id="btn-reg-todas">Registrar todas (${mermaPend.length})</button>` : `<span>${mermaPend.length}</span>`}</div>
      ${mermaPend.length ? `<div data-colapsar="5">${mermaPend.map(m => `<div class="fila-caja"><div class="txt">
          <b>${esc(m.nombre)} · ${m.cantidad} u.${sucTxt(m.sucursal)}</b>
          <span>${[m.envio ? 'envió ' + fechaHora(m.envio) : '', m.quien ? m.quien.split('@')[0] : '', m.ingreso ? 'ingresó ' + m.ingreso : ''].filter(Boolean).map(esc).join(' · ')}</span>
          ${m.motivos.length ? `<span class="nota">${esc(m.motivos.join(' · '))}</span>` : ''}</div>
          <div class="acciones"><span class="chip c-rojo">-${esc(pesos(m.valor))}</span>
            <button type="button" class="btn-sec" data-rescatar="${esc(m.stockId)}">Rescatar</button>
            <button type="button" class="btn-sec btn-peligro" data-registrar="${esc(m.stockId)}">Registrar merma</button></div></div>`).join('')}</div>
        <p class="nota-i">(i) Lo envían las cajeras desde Stock en la caja. Registrar lo saca del stock, lo guarda en el informe y lo pasa a la pestaña Merma de la planilla. Rescatar lo devuelve al stock para venderlo (eliges a qué día).</p>`
        : '<div class="vacio">No hay merma por registrar.</div>'}
    </section>

    ${sinPlanilla.filter(deSuc).length ? `<section class="tarjeta" aria-labelledby="t-merma-sp">
      <div class="titulo-fila"><h2 id="t-merma-sp">Merma sin pasar a planilla</h2><span>${sinPlanilla.filter(deSuc).length}</span></div>
      <div data-colapsar>${sinPlanilla.filter(deSuc).map(r => `<div class="fila-caja"><div class="txt"><b>${esc(r.nombreProducto || '')} · ${Number(r.cantidad) || 0} u.${sucTxt(r.sucursal)}</b><span>${esc(r.fechaEnvio || '')}${r.errorPlanilla ? ' · ' + esc(r.errorPlanilla) : ''}</span></div>
        <div class="acciones"><button type="button" class="btn-sec" data-reenviar-merma="${esc(r.id)}">Reenviar</button></div></div>`).join('')}</div>
      <p class="nota-i">(i) Ya está registrada (salió del stock y está en el informe); solo falta la fila en la planilla. Antes de reenviar, mira la pestaña Merma de la planilla: si la fila ya está (a veces llega aunque la respuesta se pierda), no reenvíes. Un reenvío en las próximas horas no se duplica; uno de otro día sí podría.</p>
    </section>` : ''}

    <section class="tarjeta" aria-labelledby="t-stock">
      <div class="titulo-fila"><h2 id="t-stock">Stock ahora</h2>
        <select id="st-area" aria-label="Área"><option value="">Todas las áreas</option>${areasPresentes.map(a => `<option value="${esc(a)}" ${stEstado.area === a ? 'selected' : ''}>${esc(AREAS_NOMBRE[a] || a)}</option>`).join('')}</select></div>
      <div class="cifras cifras-4" style="margin:12px 0 4px">
        <div class="cifra"><span class="rotulo">Valor en stock ${info('Valor en stock', 'Lo que valdría todo el stock vendible si se vendiera hoy, cada lote a su precio del día (hoy, ayer, antes de ayer, cuarto día, última oferta) y los productos sin vencimiento a precio normal.\nNo cuenta la merma ni los productos que no controlan stock (bolsas, por ejemplo).\nEn la caja, "Valor en stock" no suma la última oferta; aquí sí, por eso puede salir mayor.')}</span><span class="valor">${pesos(vendible)}</span><span class="nota">Incluye última oferta</span></div>
        <div class="cifra"><span class="rotulo">Unidades</span><span class="valor">${Math.round(stock.reduce((a, f) => a + f.cantidad, 0)).toLocaleString('es-CL')}</span><span class="nota">${stock.length === 1 ? '1 producto' : stock.length + ' productos'}</span></div>
        <div class="cifra"><span class="rotulo">En última oferta ${info('Última oferta', 'Lotes con 4 días o más desde que se ingresaron (o pasados a mano a última oferta). Se venden al precio más bajo y son los próximos candidatos a merma.')}</span><span class="valor">${pesos(stock.filter(f => f.categoria === 'ultimaOferta').reduce((a, f) => a + f.valor, 0))}</span><span class="nota">4 días o más</span></div>
        <div class="cifra"><span class="rotulo">Merma por registrar</span><span class="valor">${pesos(mermaPend.reduce((a, m) => a + m.valor, 0))}</span><span class="nota">A precio normal</span></div>
      </div>
      ${porCat.length ? porCat.map(c => `<details class="grupo-stock"${c.key === 'ultimaOferta' ? ' open' : ''}>
          <summary><span>${esc(c.nombre)}</span><span>${c.filas.length === 1 ? '1 producto' : c.filas.length + ' productos'} · <b>${pesos(c.filas.reduce((a, f) => a + f.valor, 0))}</b></span></summary>
          <div class="tabla-prod"><div class="fila-prod enc"><span>Producto</span><span>Unidades</span><span>Valor</span></div>
          ${c.filas.map(f => `<div class="fila-prod"><span>${esc(f.nombre)}${sucTxt(f.sucursal)}</span><span>${f.cantidad}</span><span>${pesos(f.valor)}</span></div>`).join('')}</div>
        </details>`).join('') : '<div class="vacio">Sin stock.</div>'}
      <p class="nota-i">(i) Ingresar stock, ajustar cantidades y enviar a merma se siguen haciendo en la caja (es trabajo del mostrador). El valor usa el precio de cada día (hoy, ayer, última oferta…). La caja, en Valor en stock, no suma la última oferta; aquí sí.</p>
    </section>

    <section class="tarjeta" aria-labelledby="t-merma-inf">
      <div class="titulo-fila"><h2 id="t-merma-inf">Merma registrada</h2><span>${esc(titulo)}</span></div>
      <div class="chips" role="group" aria-label="Período" style="margin:8px 0 4px">${btnPer('7d', 'Últimos 7 días')}${btnPer('mes', 'Este mes')}${btnPer('mesant', 'Mes anterior')}</div>
      <div class="cifras cifras-4" style="margin:12px 0 4px">
        <div class="cifra"><span class="rotulo">Pérdida</span><span class="valor">${pesos(perdida)}</span><span class="nota">A precio normal, con IVA</span></div>
        <div class="cifra"><span class="rotulo">Unidades</span><span class="valor">${Math.round(unidades).toLocaleString('es-CL')}</span><span class="nota">${regs.length === 1 ? '1 registro' : regs.length + ' registros'}</span></div>
        <div class="cifra"><span class="rotulo">Merma / ventas ${info('Merma / ventas', 'Pérdida por merma dividida por las ventas de caja del mismo período y sucursal, ambas con IVA.\nEjemplo: 3% quiere decir que por cada $100 vendidos se perdieron $3 en merma. Sirve para comparar meses aunque se venda más o menos.')}</span><span class="valor">${ventas ? (Math.round(perdida * 1000 / ventas) / 10).toLocaleString('es-CL') + '%' : '—'}</span><span class="nota">Ventas de caja ${pesos(ventas)}</span></div>
      </div>
      ${regs.length ? `<div class="columnas" style="margin-top:12px">
        <div class="col-ancha"><h3 class="sub">Por área</h3>${barras(mArea.map(([k, v]) => ({ nombre: AREAS_NOMBRE[k] || k, valor: v })), perdida)}</div>
        <div class="col-angosta"><h3 class="sub">Por motivo</h3><div class="barras">${mMotivo.map(([k, v]) => `<div class="barra-h"><div class="barra-h-txt"><span>${esc(k)}</span><b>${Math.round(v)} u.</b></div><div class="barra-h-pista"><div class="barra-h-relleno" style="width:${Math.max(0.5, v * 100 / (mMotivo[0][1] || 1))}%"></div></div></div>`).join('')}</div></div>
      </div>
      <h3 class="sub" style="margin-top:20px">Productos</h3>
      <div class="tabla-prod"><div class="fila-prod enc"><span>Producto</span><span>% pérdida</span><span>Pérdida</span></div>
        <div data-colapsar="10">${mProd.map(([k, v], i) => `<div class="fila-prod"><span><small>${i + 1}</small> ${esc(k)}</span><span>${pct(v, perdida)}%</span><span>${pesos(v)}</span></div>`).join('')}</div></div>` : '<div class="vacio">Sin merma registrada en este período.</div>'}
      <p class="nota-i">(i) Por día en que se envió a merma desde Stock. Merma / ventas compara con las ventas de caja del mismo período y sucursal.</p>
    </section>`;

  el.querySelectorAll('[data-st-suc]').forEach(b => b.addEventListener('click', () => { stEstado.suc = b.dataset.stSuc; pintarCaja('stock'); }));
  el.querySelectorAll('[data-st-periodo]').forEach(b => b.addEventListener('click', () => { stEstado.periodo = b.dataset.stPeriodo; pintarCaja('stock'); }));
  $('st-area').addEventListener('change', e => { stEstado.area = e.target.value; pintarCaja('stock'); });
  const porStock = id => merma.find(m => m.stockId === id);
  const avisoMerma = (r, nombre) => {
    registrar('Registró merma', `${nombre} · ${r.cantidad} u. · ${pesos(r.monto)}`);
    if (r.malas) alert(`Merma registrada, pero ${r.malas === 1 ? 'un registro no llegó' : r.malas + ' registros no llegaron'} a la planilla (${r.error}).\n\nQuedan en "Merma sin pasar a planilla" para reenviar.`);
  };
  el.querySelectorAll('[data-registrar]').forEach(b => b.addEventListener('click', async () => {
    const m = porStock(b.dataset.registrar);
    if (!window.confirm(`¿Registrar merma de ${m.cantidad} u. de "${m.nombre}" (${sucursal(m.sucursal)})?\n\nSale del stock y pasa a la pestaña Merma de la planilla. Pérdida ${pesos(m.valor)}.`)) return;
    b.disabled = true; b.textContent = 'Registrando…';
    try { avisoMerma(await Stock.registrarMerma(m.stockId), m.nombre); } catch (e) { alert(e.message || mensajeError(e)); }
    pintarCaja('stock');
  }));
  const todas = $('btn-reg-todas');
  if (todas) todas.addEventListener('click', async () => {
    if (!window.confirm(`¿Registrar las ${mermaPend.length} mermas por registrar${stEstado.suc ? ' de ' + sucursal(stEstado.suc) : ''}?\n\nPérdida total ${pesos(mermaPend.reduce((a, m) => a + m.valor, 0))}.`)) return;
    todas.disabled = true;
    let ok = 0, malas = 0; const errores = [];
    for (const m of mermaPend) {
      todas.textContent = `Registrando ${ok + errores.length + 1} de ${mermaPend.length}…`;
      try { const r = await Stock.registrarMerma(m.stockId); ok++; malas += r.malas; } catch (e) { errores.push(`${m.nombre}: ${e.message}`); }
    }
    registrar('Registró merma', `${ok} productos`);
    if (malas || errores.length) alert(`Registradas: ${ok}.${malas ? `\n${malas} no llegaron a la planilla (quedan para reenviar).` : ''}${errores.length ? '\n\nNo se pudieron registrar:\n• ' + errores.join('\n• ') : ''}`);
    pintarCaja('stock');
  });
  el.querySelectorAll('[data-rescatar]').forEach(b => b.addEventListener('click', () => abrirRescatar(porStock(b.dataset.rescatar))));
  el.querySelectorAll('[data-reenviar-merma]').forEach(b => b.addEventListener('click', async () => {
    const r = sinPlanilla.find(x => x.id === b.dataset.reenviarMerma);
    b.disabled = true; b.textContent = 'Enviando…';
    const res = await Stock.enviarMermaAPlanilla(r.id, r);
    if (res.ok) registrar('Reenvió merma a la planilla', `${r.nombreProducto} · ${r.cantidad} u.`); else alert('No llegó a la planilla: ' + res.error);
    pintarCaja('stock');
  }));
  colapsar(el);
}

function abrirRescatar(m) {
  const d = dialogo(`<form method="dialog" class="form-dialogo">
    <h2>Rescatar de merma</h2>
    <p class="ayuda">${esc(m.nombre)} · ${m.cantidad} u. · ${esc(sucursal(m.sucursal))}. Vuelve al stock para venderse. ¿A qué día lo dejas? Define el precio con que se vende.</p>
    <div class="opciones-rescate">${Stock.CATEGORIAS.filter(c => c.key !== 'permanente').map(c => `<button type="button" class="btn-sec" data-destino="${c.key}">${esc(c.nombre)}</button>`).join('')}</div>
    <div class="error" id="re-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="re-cancelar">Cancelar</button></div>
  </form>`);
  d.querySelector('#re-cancelar').onclick = () => d.close();
  d.querySelectorAll('[data-destino]').forEach(b => b.onclick = async () => {
    d.querySelectorAll('button').forEach(x => { x.disabled = true; });
    try {
      const n = await Stock.rescatarMerma(m.stockId, b.dataset.destino);
      registrar('Rescató de merma', `${m.nombre} · ${n} u. → ${b.textContent}`);
      d.close(); pintarCaja('stock');
    } catch (e) { d.querySelector('#re-error').textContent = e.message || mensajeError(e); d.querySelectorAll('button').forEach(x => { x.disabled = false; }); }
  });
}

// ── Configuración del negocio ──────────────────────
let recetasCache = null;
async function pintarAjustes() {
  const el = $('v-ajustes');
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-ajustes">Configuración</h1><p>Ajustes del negocio que usa la caja</p></div></div>
    <div class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></div>`;
  let datos;
  let conexiones = {};
  try { [datos, conexiones] = await Promise.all([Ajustes.leerAjustes(), Apps.leerConexiones()]); }
  catch (e) { el.querySelector('.tarjeta').innerHTML = `<div class="error">${esc(mensajeError(e))}</div>`; return; }
  const { c, areas, productos } = datos;
  const lista = id => (c[id] && Array.isArray(c[id].lista) && c[id].lista.length ? c[id].lista : Ajustes.BASE[id]);
  const usoSub = {}; productos.forEach(p => { if (p.categoria) { const k = (p.area || '') + '|' + p.categoria; usoSub[k] = (usoSub[k] || 0) + 1; } });
  const editor = (id, items, extra = () => '') => `<div class="lista-edit" data-lista="${id}">
      ${items.map((t, i) => `<div class="fila-edit" data-valor="${esc(t)}">
        <input type="text" value="${esc(t)}" aria-label="Nombre" data-renombrar maxlength="60">${extra(t)}
        <button type="button" class="btn-icono" data-mover="-1" aria-label="Subir ${esc(t)}" ${i === 0 ? 'disabled' : ''}>${icono('arriba', 18)}</button>
        <button type="button" class="btn-icono" data-mover="1" aria-label="Bajar ${esc(t)}" ${i === items.length - 1 ? 'disabled' : ''}>${icono('abajo', 18)}</button>
        <button type="button" class="btn-sec btn-peligro btn-chico" data-quitar>Quitar</button></div>`).join('') || '<div class="vacio">Sin elementos todavía.</div>'}
      <form class="fila-nueva" data-agregar><input type="text" placeholder="Agregar…" aria-label="Agregar a la lista" maxlength="60"><button type="submit" class="btn-sec btn-chico">Agregar</button></form>
    </div>`;
  const tp = (c.tiemposPago && c.tiemposPago.ainavillo) || {};
  const per = (c.reconciliacionPeriodos && c.reconciliacionPeriodos.periodos) || {};
  const hoy = new Date();
  const meses = []; for (let m = hoy.getMonth() + 1; m >= 1; m--) meses.push(`${hoy.getFullYear()}-${String(m).padStart(2, '0')}`);
  const ocultas = (c.recetasOcultas && c.recetasOcultas.ids) || [];

  el.innerHTML = `<div class="cabecera"><div><h1 id="t-ajustes">Configuración ${info('Configuración', 'Son los mismos ajustes que antes cambiabas en Configuración y Productos de la caja. Se guardan al tiro en Firebase.\nLa caja los lee al abrirse: cada tablet ve el cambio cuando se abre o se recarga la caja (no hace falta hacer nada más).\nLa impresora y el ancho del papel siguen en la caja, porque son de cada equipo.')}</h1><p>Ajustes del negocio que usa la caja</p></div></div>
    <div class="columnas">
      <section class="tarjeta col-ancha" style="display:block" aria-labelledby="t-motivos">
        <div class="titulo-fila"><h2 id="t-motivos">Motivos de merma ${info('Motivos de merma', 'La lista que elige la cajera al enviar un producto a merma desde Stock. El orden de aquí es el orden en que aparecen.\nCambiar el nombre o quitar un motivo no cambia la merma ya registrada: esos registros guardan el texto que tenían.\nLa lista no puede quedar vacía (la caja volvería a poner los motivos de fábrica).')}</h2><span>${lista('motivosMerma').length}</span></div>
        ${editor('motivosMerma', lista('motivosMerma'))}
      </section>
      <section class="tarjeta col-angosta" style="display:block" aria-labelledby="t-leche">
        <div class="titulo-fila"><h2 id="t-leche">Tipos de leche ${info('Tipos de leche', 'Las opciones que aparecen al vender un café con leche. Se usan en el reporte de la caja "Por tipo de leche".\nCambiar un nombre no cambia las ventas ya hechas.')}</h2><span>${lista('tiposLeche').length}</span></div>
        ${editor('tiposLeche', lista('tiposLeche'))}
      </section>
    </div>

    <section class="tarjeta" aria-labelledby="t-subcat">
      <div class="titulo-fila"><h2 id="t-subcat">Subcategorías ${info('Subcategorías', 'Grupos dentro de cada área para ordenar los productos en la caja (por ejemplo, en Pastelería: Tortas, Kuchen). Se asignan a cada producto en Productos de la caja.\nAl lado de cada una dice cuántos productos la usan.\nCambiar el nombre o quitar una subcategoría NO cambia los productos que ya la tenían: en la caja quedan marcados "fuera de lista" hasta que les asignes otra.')}</h2></div>
      <div class="grilla-areas">${areas.map(a => `<div><h3 class="sub">${esc(a.nombre)} <small>${esc(a.id)}</small></h3>
        ${editor('sub:' + a.id, ((c.subcategorias && c.subcategorias.porArea) || {})[a.id] || [], t => { const n = usoSub[a.id + '|' + t] || 0; return `<span class="uso" title="Productos con esta subcategoría">${n} ${n === 1 ? 'producto' : 'productos'}</span>`; })}</div>`).join('')}</div>
    </section>

    <div class="columnas">
      <section class="tarjeta col-angosta" style="display:block" aria-labelledby="t-tiempos">
        <div class="titulo-fila"><h2 id="t-tiempos">Tiempos de pago ${info('Tiempos de pago', 'Cuántos días pasan desde la venta hasta que la plata de cada medio llega a la cuenta. La caja los usa en "Ventas mensuales hacia fën-producción" para proyectar el flujo de caja.\nBarros Arana está fijo en 0 días (convenio de pago inmediato, confirmado). Si cambia, avísame: hay que cambiarlo también en la caja, porque la caja lo vuelve a dejar en 0 cada vez que guarda.\nAinavillo: pon los días que informe el procesador de pagos.')}</h2></div>
        <form id="form-tiempos"><table class="tabla-tiempos"><thead><tr><th>Medio</th><th>Ainavillo</th><th>Barros Arana</th></tr></thead><tbody>
          ${[['debito', 'Débito'], ['credito', 'Crédito'], ['transferencia', 'Transferencia']].map(([k, n]) => `<tr><td>${n}</td>
            <td><label class="dias"><input type="number" min="0" max="90" step="1" inputmode="numeric" id="tp-${k}" value="${Number(tp[k]) || 0}" aria-label="${n} en Ainavillo, días"> días</label></td><td class="ayuda" style="white-space:nowrap">0 (inmediato)</td></tr>`).join('')}
        </tbody></table>
        <div class="botones" style="justify-content:flex-start;margin-top:12px"><button type="submit" class="btn-sec">Guardar tiempos</button><span class="ayuda" id="tp-estado" role="status"></span></div></form>
      </section>
      <section class="tarjeta col-ancha" style="display:block" aria-labelledby="t-periodos">
        <div class="titulo-fila"><h2 id="t-periodos">Períodos de conciliación ${info('Períodos de conciliación', 'En la caja, "Reconciliación de nombres históricos" deja emparejar nombres antiguos de productos (de ventas y merma pasadas) con su receta de Producción, mes por mes.\nAquí marcas qué meses ya revisaste. Es solo un seguimiento: marcar o desmarcar no cambia ventas ni merma.\nEl emparejamiento en sí se sigue haciendo en la caja.')}</h2><span>${hoy.getFullYear()}</span></div>
        <div data-colapsar="4">${meses.map(m => { const r = per[m] || {}; const [y, mm] = m.split('-').map(Number); return `<div class="fila-caja fila-compacta"><div class="txt"><b>${MESES_LARGOS[mm - 1].replace(/^./, x => x.toUpperCase())} ${y}</b>
          <span>${r.revisado ? `Revisado el ${esc(fechaCaja(r.fecha || ''))}${r.usuario ? ' por ' + esc(r.usuario) : ''}` : 'Pendiente'}</span></div>
          <div class="acciones">${r.revisado ? '<span class="chip c-verde">Revisado</span>' : '<span class="chip c-gris">Pendiente</span>'}<button type="button" class="btn-sec btn-chico" data-periodo-rev="${m}" data-rev="${r.revisado ? '0' : '1'}">${r.revisado ? 'Desmarcar' : 'Marcar revisado'}</button></div></div>`; }).join('')}</div>
      </section>
    </div>

    <section class="tarjeta" aria-labelledby="t-recetas">
      <div class="titulo-fila"><h2 id="t-recetas">Recetas sin producto en la caja ${info('Recetas sin producto en la caja', 'Producción publica su lista de recetas. Las que no tienen un producto vinculado en la caja aparecen como pendientes en la caja (Configuración → Conexión con fën-producción).\nOcultar sirve para las que no se venden en el mostrador (por ejemplo, solo B2B o insumos): dejan de aparecer como pendientes. Se puede deshacer con "Mostrar".\nCrear el producto o vincularlo se sigue haciendo en la caja, hasta que llegue el catálogo nuevo.')}</h2><span id="rec-total"></span></div>
      <div id="rec-lista"><div class="vacio">Cargando la lista de Producción…</div></div>
    </section>

    <section class="tarjeta" aria-labelledby="t-conexiones" id="conexiones">
      <div class="titulo-fila"><h2 id="t-conexiones">Conexiones ${info('Conexiones', 'La dirección del Apps Script de cada app, para que Hoy lea sus pendientes. Es la misma dirección que usa cada app (termina en /exec).\nPara que funcione, cada script necesita la versión con SistemaFen.gs: Gastos v2.1.0, Ventas B2B v2.1.0 y Producción v2.2.0 (ver el README de la v0.6.0). "Probar" pregunta la versión.\nLa de Ventas B2B está en la app B2B, ⚙️ Config, o en Apps Script ▸ Implementar ▸ Gestionar implementaciones.\nEstas direcciones no son secretas: el script solo responde a la cuenta de administración.')}</h2></div>
      ${Apps.APPS.map(a => `<form class="fila-conexion" data-conexion="${a.id}">
        <label for="cx-${a.id}">${esc(a.nombre)}</label>
        <input type="url" id="cx-${a.id}" value="${esc(conexiones[a.id] || '')}" placeholder="https://script.google.com/macros/s/…/exec" spellcheck="false" autocomplete="off">
        <button type="button" class="btn-sec btn-chico" data-probar>Probar</button>
        <button type="submit" class="btn-sec btn-chico">Guardar</button>
        <span class="ayuda estado-cx" role="status">${conexiones[a.id] ? '' : 'Falta la dirección'}</span></form>`).join('')}
    </section>`;

  // Listas
  const trabajar = async (fila, fn, texto) => {
    fila && fila.classList.add('guardando');
    try { await fn(); if (texto) registrar('Cambió la configuración', texto); pintarAjustes(); }
    catch (e) { fila && fila.classList.remove('guardando'); alert(e.message || mensajeError(e)); pintarAjustes(); }
  };
  const ops = id => id.startsWith('sub:')
    ? { area: id.slice(4), agregar: (t) => Ajustes.subAgregar(id.slice(4), t), renombrar: (a, b) => Ajustes.subRenombrar(id.slice(4), a, b), quitar: t => Ajustes.subQuitar(id.slice(4), t), mover: (t, p) => Ajustes.subMover(id.slice(4), t, p), nombre: 'Subcategoría ' + id.slice(4) }
    : { agregar: t => Ajustes.agregar(id, t), renombrar: (a, b) => Ajustes.renombrar(id, a, b), quitar: t => Ajustes.quitar(id, t), mover: (t, p) => Ajustes.mover(id, t, p), nombre: id === 'motivosMerma' ? 'Motivo de merma' : 'Tipo de leche' };
  el.querySelectorAll('[data-lista]').forEach(box => {
    const o = ops(box.dataset.lista);
    box.querySelectorAll('.fila-edit').forEach(f => {
      const v = f.dataset.valor;
      const inp = f.querySelector('[data-renombrar]');
      inp.addEventListener('change', () => { if (inp.value.trim() !== v) trabajar(f, () => o.renombrar(v, inp.value), `${o.nombre}: "${v}" → "${inp.value.trim()}"`); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      f.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => trabajar(f, () => o.mover(v, +b.dataset.mover))));
      f.querySelector('[data-quitar]').addEventListener('click', () => {
        const uso = o.area ? (usoSub[o.area + '|' + v] || 0) : 0;
        if (!window.confirm(`¿Quitar "${v}" de la lista?${uso ? `\n\n${uso} ${uso === 1 ? 'producto la tiene' : 'productos la tienen'} asignada: no cambian solos, en la caja quedan "fuera de lista".` : '\n\nLo ya registrado con este nombre no cambia.'}`)) return;
        trabajar(f, () => o.quitar(v), `${o.nombre}: quitó "${v}"`);
      });
    });
    box.querySelector('[data-agregar]').addEventListener('submit', e => {
      e.preventDefault(); const t = e.target.querySelector('input').value;
      if (t.trim()) trabajar(null, () => o.agregar(t), `${o.nombre}: agregó "${t.trim()}"`);
    });
  });
  // Tiempos de pago
  $('form-tiempos').addEventListener('submit', async e => {
    e.preventDefault();
    const t = { debito: $('tp-debito').value, credito: $('tp-credito').value, transferencia: $('tp-transferencia').value };
    try {
      const r = await Ajustes.guardarTiemposAinavillo(t);
      registrar('Cambió la configuración', `Tiempos de pago Ainavillo: débito ${r.ainavillo.debito}, crédito ${r.ainavillo.credito}, transferencia ${r.ainavillo.transferencia} días`);
      $('tp-estado').textContent = 'Guardado';
    } catch (er) { $('tp-estado').textContent = er.message || mensajeError(er); }
  });
  // Conexiones
  el.querySelectorAll('[data-conexion]').forEach(f => {
    const app = f.dataset.conexion, inp = f.querySelector('input'), est = f.querySelector('.estado-cx');
    f.querySelector('[data-probar]').addEventListener('click', async () => {
      const u = inp.value.trim();
      if (!Apps.URL_VALIDA.test(u)) { est.textContent = 'La dirección no parece de Apps Script (debe terminar en /exec)'; return; }
      est.textContent = 'Probando…';
      try { const a = Apps.APPS.find(x => x.id === app) || {}; const r = await Apps.probar(app, u, a.completa); est.textContent = r.texto; est.classList.toggle('ok', r.ok); }
      catch (e) { est.textContent = 'No respondió: ' + (e.message || e); }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try { await Apps.guardarConexion(app, inp.value); est.textContent = 'Guardada'; registrar('Cambió la configuración', `Conexión de ${app}`); }
      catch (er) { est.textContent = er.message || mensajeError(er); }
    });
  });
  if (subVista() === 'conexiones') setTimeout(() => { const c = $('conexiones'); if (c) c.scrollIntoView({ block: 'start' }); }, 50);
  // Períodos
  el.querySelectorAll('[data-periodo-rev]').forEach(b => b.addEventListener('click', () =>
    trabajar(b.closest('.fila-caja'), () => Ajustes.marcarPeriodo(b.dataset.periodoRev, b.dataset.rev === '1'), `Período ${b.dataset.periodoRev}: ${b.dataset.rev === '1' ? 'revisado' : 'pendiente'}`)));
  colapsar(el);

  // Recetas (lista publicada por Producción; se lee una vez por sesión)
  try {
    if (!recetasCache) recetasCache = await Ajustes.leerRecetasProduccion();
    if (!$('rec-lista')) return;
    const vinculadas = new Set(productos.map(p => p.idRecetaFen).filter(Boolean));
    const sinProd = recetasCache.filter(r => !vinculadas.has(r.id));
    const vis = sinProd.filter(r => !ocultas.includes(r.id)), ocu = sinProd.filter(r => ocultas.includes(r.id));
    const fila = (r, oculta) => `<div class="fila-caja"><div class="txt"><b>${esc(r.nombre || r.id)}</b><span>${esc(r.id)}${r.area ? ' · ' + esc(r.area) : ''}</span></div>
      <div class="acciones"><button type="button" class="btn-sec btn-chico" data-${oculta ? 'mostrar' : 'ocultar'}-receta="${esc(r.id)}">${oculta ? 'Mostrar' : 'Ocultar'}</button></div></div>`;
    $('rec-total').textContent = `${vis.length} pendientes · ${ocu.length} ocultas`;
    $('rec-lista').innerHTML = `${vis.length ? `<div data-colapsar="5">${vis.map(r => fila(r, false)).join('')}</div>` : '<div class="vacio">Todas las recetas tienen producto o están ocultas.</div>'}
      ${ocu.length ? `<details class="grupo-stock"><summary><span>Ocultas</span><span>${ocu.length}</span></summary><div data-colapsar="10">${ocu.map(r => fila(r, true)).join('')}</div></details>` : ''}`;
    $('rec-lista').querySelectorAll('[data-ocultar-receta]').forEach(b => b.addEventListener('click', () => trabajar(b.closest('.fila-caja'), () => Ajustes.ocultarReceta(b.dataset.ocultarReceta), `Ocultó la receta ${b.dataset.ocultarReceta}`)));
    $('rec-lista').querySelectorAll('[data-mostrar-receta]').forEach(b => b.addEventListener('click', () => trabajar(b.closest('.fila-caja'), () => Ajustes.mostrarReceta(b.dataset.mostrarReceta), `Volvió a mostrar la receta ${b.dataset.mostrarReceta}`)));
    colapsar($('rec-lista'));
  } catch (e) {
    if ($('rec-lista')) $('rec-lista').innerHTML = `<div class="error">No se pudo leer la lista de recetas de Producción (${esc(e.message || '')}). Las ${ocultas.length} recetas ocultas siguen ocultas.</div>`;
  }
}

function abrirAceptar(e) {
  const d = dialogo(`<form method="dialog" class="form-dialogo">
    <h2>Aceptar diferencia</h2>
    <p class="ayuda">${esc(fechaCaja(e.fecha))} · ${esc(sucursal(e.sucursal))} · ${esc(e.usuario || '')} · diferencia <b>${esc(signo(parseInt(e.difTotal) || 0))}</b></p>
    <p class="ayuda">Úsalo cuando ya no se puede saber qué pasó. Los montos no cambian: queda anotado que lo revisaste y deja de aparecer en Hoy.</p>
    <div class="campo"><label for="ac-nota">Nota (opcional)</label><textarea id="ac-nota" rows="2" maxlength="300" placeholder="Por ejemplo: no se pudo aclarar"></textarea></div>
    <div class="error" id="ac-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="ac-cancelar">Cancelar</button><button type="button" class="btn" id="ac-guardar">Aceptar diferencia</button></div>
  </form>`);
  d.querySelector('#ac-cancelar').onclick = () => d.close();
  d.querySelector('#ac-guardar').onclick = async () => {
    const b = d.querySelector('#ac-guardar'); b.disabled = true;
    try {
      await Caja.aceptarDiferencia(e.id, d.querySelector('#ac-nota').value);
      registrar('Aceptó una diferencia de caja', `${sucursal(e.sucursal)} · ${fechaCaja(e.fecha)} · ${signo(parseInt(e.difTotal) || 0)}`);
      d.close(); pintarCaja('');
    } catch (er) { d.querySelector('#ac-error').textContent = er.message || mensajeError(er); b.disabled = false; }
  };
}

// (i) Listas largas: muestra las primeras 3 filas y un botón "Ver todas (N)" / "Ver menos".
// Se usa en Ventas de caja y Seguridad. En Hoy no: los pendientes se ven siempre completos.
const FILAS_VISIBLES = 3;
function colapsar(raiz) {
  raiz.querySelectorAll('[data-colapsar]').forEach(cont => {
    const filas = [...cont.children];
    const visibles = parseInt(cont.dataset.colapsar) || FILAS_VISIBLES;
    if (filas.length <= visibles) return;
    const extra = filas.slice(visibles);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-ver-mas';
    let abierto = false;
    const pintar = () => {
      extra.forEach(f => { f.hidden = !abierto; });
      btn.textContent = abierto ? 'Ver menos' : `Ver todas (${filas.length})`;
      btn.setAttribute('aria-expanded', String(abierto));
    };
    btn.addEventListener('click', () => { abierto = !abierto; pintar(); });
    pintar();
    // en una tabla, el botón va después de la tabla (no puede ir dentro del tbody)
    const ancla = cont.tagName === 'TBODY' ? cont.closest('table') : cont;
    ancla.insertAdjacentElement('afterend', btn);
  });
}

// (i) Una caja de otro día que vendió hace poco probablemente sigue abierta en una tablet
// (quedó encendida desde ayer). Cerrarla aquí dejaría esas ventas fuera del cierre.
const MINUTOS_VENDIENDO = 30;
async function sigueVendiendo(c, boton) {
  const texto = boton.textContent; boton.disabled = true; boton.textContent = 'Revisando…';
  let min = null;
  try { min = await Caja.minutosDesdeUltimaVenta(c.id); } catch (e) {}
  boton.disabled = false; boton.textContent = texto;
  if (min === null || min >= MINUTOS_VENDIENDO) return false;
  return !window.confirm(`Esta caja vendió hace ${min} minuto${min === 1 ? '' : 's'}: parece que sigue abierta en una tablet.\n\nLo mejor es cerrarla desde esa tablet. Si la cierras aquí, las ventas que se hagan después en esa tablet no quedarán en este cierre.\n\n¿Cerrarla igual?`);
}

function avisoResultado(r, textoOk) {
  if (r && r.ok) return;
  alert(`${textoOk}, pero el cierre no llegó a la planilla${r && r.error ? ` (${r.error})` : ''}.\n\nQueda en "Cierres sin pasar a planilla" para reenviarlo.`);
}

function camposMontos(prefijo, valores = {}) {
  const campo = (id, rotulo, ayuda) => `<div class="campo"><label for="${prefijo}-${id}">${rotulo}</label>
    <input id="${prefijo}-${id}" type="number" inputmode="numeric" min="0" step="1" value="${esc(valores[id] ?? '')}">${ayuda ? `<span class="ayuda">${ayuda}</span>` : ''}</div>`;
  return campo('efectivo', 'Efectivo contado', 'Todo el efectivo del cajón, incluido el monto inicial') + campo('debito', 'Débito') + campo('credito', 'Crédito') + campo('transfer', 'Transferencia');
}
const leerMontos = (d, prefijo) => ({
  manEfectivo: d.querySelector(`#${prefijo}-efectivo`).value, manDebito: d.querySelector(`#${prefijo}-debito`).value,
  manCredito: d.querySelector(`#${prefijo}-credito`).value, manTransfer: d.querySelector(`#${prefijo}-transfer`).value
});

function abrirArqueo(c) {
  const d = dialogo(`<form method="dialog" class="form-dialogo">
    <h2>Cerrar con arqueo</h2>
    <p class="ayuda">${esc(fechaCaja(c.fecha))} · ${esc(sucursal(c.sucursal))} · ${esc(c.usuario || '')} · monto inicial ${pesos(c.montoInicial)}</p>
    <div class="grilla-montos">${camposMontos('aq')}
      <div class="campo"><label for="aq-retirado">Retirado (opcional)</label><input id="aq-retirado" type="number" inputmode="numeric" min="0" step="1"></div></div>
    <div id="aq-revision"></div>
    <div class="error" id="aq-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="aq-cancelar">Cancelar</button><button type="button" class="btn" id="aq-revisar">Revisar</button></div>
  </form>`);
  let revisado = null;
  d.querySelector('#aq-cancelar').onclick = () => d.close();
  d.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { revisado = null; d.querySelector('#aq-revision').innerHTML = ''; d.querySelector('#aq-revisar').textContent = 'Revisar'; }));
  d.querySelector('#aq-revisar').onclick = async () => {
    const err = d.querySelector('#aq-error'); err.textContent = '';
    const m = { ...leerMontos(d, 'aq'), montoRetirado: d.querySelector('#aq-retirado').value };
    if (!revisado) {
      const a = Caja.calcularArqueo(c, m);
      revisado = { m, a };
      const fila = (n, s, x, dif) => `<tr><td>${n}</td><td>${pesos(s)}</td><td>${pesos(x)}</td><td class="${dif ? 'dif-mal' : ''}">${signo(dif)}</td></tr>`;
      d.querySelector('#aq-revision').innerHTML = `<table class="tabla-arqueo"><thead><tr><th>Medio</th><th>Sistema</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>
        ${fila('Efectivo', a.sistEfectivo, a.manEfectivoNeto, a.difEfectivo)}${fila('Débito', a.sistDebito, a.manDebito, a.difDebito)}
        ${fila('Crédito', a.sistCredito, a.manCredito, a.difCredito)}${fila('Transferencia', a.sistTransfer, a.manTransfer, a.difTransfer)}
        <tr class="total"><td>Total</td><td>${pesos(a.sistTotal)}</td><td>${pesos(a.manTotal)}</td><td class="${a.difTotal ? 'dif-mal' : ''}">${signo(a.difTotal)}</td></tr></tbody></table>
        <p class="ayuda" style="margin-bottom:12px">El efectivo contado ya descuenta el monto inicial.</p>
        ${a.hayDiferencia ? `<div class="campo"><label for="aq-nota">Qué pasó con la diferencia</label><textarea id="aq-nota" rows="3" required></textarea></div>` : ''}`;
      d.querySelector('#aq-revisar').textContent = 'Cerrar caja';
      return;
    }
    const nota = (d.querySelector('#aq-nota') || {}).value || '';
    if (revisado.a.hayDiferencia && !nota.trim()) { err.textContent = 'Escribe qué pasó con la diferencia.'; return; }
    const b = d.querySelector('#aq-revisar'); b.disabled = true; b.textContent = 'Cerrando…';
    try {
      const r = await Caja.cerrarCajaAnterior(c.id, revisado.m, nota);
      registrar('Cerró una caja con arqueo', `${sucursal(c.sucursal)} · ${fechaCaja(c.fecha)} · diferencia ${signo(revisado.a.difTotal)}`);
      d.close();
      avisoResultado(r, 'Caja cerrada');
      pintarCaja('');
    } catch (e) { err.textContent = e.message || mensajeError(e); b.disabled = false; b.textContent = 'Cerrar caja'; }
  };
}

function abrirCorreccion(e) {
  const d = dialogo(`<form method="dialog" class="form-dialogo">
    <h2>Corregir arqueo</h2>
    <p class="ayuda">${esc(fechaCaja(e.fecha))} · ${esc(sucursal(e.sucursal))} · ${esc(e.usuario || '')}. Úsalo si se tipeó mal el conteo; queda marcado como corregido.</p>
    <div class="grilla-montos">${camposMontos('co', { efectivo: e.manEfectivo || 0, debito: e.manDebito || 0, credito: e.manCredito || 0, transfer: e.manTransfer || 0 })}</div>
    <div class="error" id="co-error" role="alert"></div>
    <div class="botones"><button type="button" class="btn-sec" id="co-cancelar">Cancelar</button><button type="button" class="btn" id="co-guardar">Guardar corrección</button></div>
  </form>`);
  d.querySelector('#co-cancelar').onclick = () => d.close();
  d.querySelector('#co-guardar').onclick = async () => {
    const b = d.querySelector('#co-guardar'); b.disabled = true;
    try {
      await Caja.corregirEvaluacion(e.id, leerMontos(d, 'co'));
      registrar('Corrigió un arqueo', `${sucursal(e.sucursal)} · ${fechaCaja(e.fecha)}`);
      d.close(); pintarCaja('');
    } catch (er) { d.querySelector('#co-error').textContent = er.message || mensajeError(er); b.disabled = false; }
  };
}

async function pintarAnulaciones(el, sub) {
  const { pendientes, resueltas } = await Caja.leerAnulaciones();
  const cuando = s => { const f = aFecha(s.fechaSolicitud); return f ? `${f.getDate()} ${MESES[f.getMonth()]} ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}` : ''; };
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    <section class="tarjeta" aria-labelledby="t-anul-pend">
      <div class="titulo-fila"><h2 id="t-anul-pend">Por aprobar</h2><span>${pendientes.length}</span></div>
      ${pendientes.length ? '<div data-colapsar>' + pendientes.map(s => `<div class="fila-caja anulacion"><div class="txt">
          <b>${pesos(s.total)} · ${esc(sucursal(s.sucursal))} · ${esc(cuando(s))}</b>
          <span>${esc(s.lineasResumen || '')}</span>
          <span>Pide ${esc(s.solicitadoPor || '')} · motivo: ${esc(s.motivo || '—')}</span></div>
          <div class="acciones"><button type="button" class="btn-sec" data-rechazar="${esc(s.id)}">Rechazar</button><button type="button" class="btn-sec btn-peligro" data-aprobar="${esc(s.id)}">Aprobar anulación</button></div></div>`).join('') + '</div>'
        : '<div class="vacio">No hay anulaciones por aprobar.</div>'}
      <p class="nota-i">(i) Aprobar anula la venta (no se borra), devuelve el stock al lote del que salió y, si la caja sigue abierta, la descuenta de sus totales. Si la caja ya cerró, rehace su resumen.</p>
    </section>
    <section class="tarjeta" aria-labelledby="t-anul-res">
      <div class="titulo-fila"><h2 id="t-anul-res">Resueltas</h2><span>Últimos ${F.DIAS_HISTORIAL} días</span></div>
      ${resueltas.length ? '<div data-colapsar>' + resueltas.map(s => `<div class="fila-caja"><div class="txt"><b>${pesos(s.total)} · ${esc(sucursal(s.sucursal))} · ${esc(cuando(s))}</b>
          <span>${esc(s.lineasResumen || '')} · ${esc(s.motivo || '')}</span></div>
          <div class="acciones"><span class="chip ${s.estado === 'aprobada' ? 'c-verde' : 'c-gris'}">${s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</span><span class="ayuda">${esc(s.resueltoPor || '')}</span></div></div>`).join('') + '</div>'
        : '<div class="vacio">Sin anulaciones resueltas en estos días.</div>'}
    </section>`;
  const porId = id => pendientes.find(x => x.id === id);
  el.querySelectorAll('[data-aprobar]').forEach(b => b.addEventListener('click', async () => {
    const s = porId(b.dataset.aprobar);
    if (!window.confirm(`¿Aprobar la anulación de ${pesos(s.total)}?\n\nLa venta queda anulada, su stock se devuelve y, si la caja sigue abierta, se descuenta de sus totales.`)) return;
    b.disabled = true; b.textContent = 'Anulando…';
    try {
      const r = await Caja.aprobarAnulacion(s.id);
      registrar('Aprobó una anulación', `${pesos(s.total)} · ${sucursal(s.sucursal)}`);
      if (r.sinDevolver.length) alert('La venta quedó anulada.\n\nNo se sabe de qué lote salieron estos productos (venta anterior a la caja v2.1.1 o de una mesa), así que su stock no se devolvió solo. Ajústalo en Stock si corresponde:\n\n• ' + r.sinDevolver.join('\n• '));
    } catch (e) { alert(e.message || mensajeError(e)); }
    pintarCaja('anulaciones');
  }));
  el.querySelectorAll('[data-rechazar]').forEach(b => b.addEventListener('click', async () => {
    const s = porId(b.dataset.rechazar);
    if (!window.confirm(`¿Rechazar la anulación de ${pesos(s.total)}? La venta sigue vigente.`)) return;
    b.disabled = true;
    try { await Caja.rechazarAnulacion(s.id); registrar('Rechazó una anulación', `${pesos(s.total)} · ${sucursal(s.sucursal)}`); }
    catch (e) { alert(e.message || mensajeError(e)); }
    pintarCaja('anulaciones');
  }));
  colapsar(el);
}
