// ═══════════════════════════════════════════════
//  Sistema Fën — app  v0.2.0
//  Etapa 1: entrada por equipo, Seguridad, Hoy, menú y la administración de la caja
//  (cierres y anulaciones).
// ═══════════════════════════════════════════════
import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp
} from './firebase.js?v=0.3.0';
import * as Caja from './caja.js?v=0.3.0';

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
const VISTAS = ['hoy', 'caja', 'seguridad', 'menu'];
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
    <div class="marca"><img class="logo" src="logo-fen.png?v=0.3.0" alt="Fën"><span>Sistema de administración</span></div>
    <a class="nav-item" href="#hoy" data-vista="hoy">${icono('hoy')}Hoy</a>
    <a class="nav-item" href="#caja" data-vista="caja">${icono('cajon')}Ventas de caja</a>
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
  if (v === 'menu') pintarMenuCelular();
  window.scrollTo(0, 0);
}

// ── Hoy ────────────────────────────────────────────
// Lee de la caja (mismo proyecto de Firebase) y los resuelve en "Ventas de caja". Gastos, B2B y Producción se conectan después.
function itemPendiente(p) {
  const fuera = /^https?:/.test(p.url) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="pendiente" href="${esc(p.url)}"${fuera}>
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
      <a class="tarjeta cifra enlace-cifra" href="#caja/reportes/ayer"><span class="rotulo">Ventas de ayer en caja</span><span class="valor" id="c-ventas">…</span><span class="nota" id="c-ventas-n">Bruto, con IVA</span><span class="ver-mas-cifra">Ver reporte</span></a>
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
    q('cajas', where('apertura', '>=', Caja.haceDias(F.DIAS_HISTORIAL))),
    q('solicitudes_anulacion', where('estado', '==', 'pendiente')),
    q('resumenes_caja', where('fecha', '==', ayer))
  ]);
  if (!$('lista-pend')) return; // se cambió de vista mientras cargaba
  const docs = i => (r[i].status === 'fulfilled' ? r[i].value.docs.map(d => ({ id: d.id, ...d.data() })) : []);
  const cajaOk = r.every(x => x.status === 'fulfilled');
  const pend = [];

  docs(0).filter(e => Math.abs(Number(e.difTotal) || 0) > 0 && e.diferenciaAceptada !== true).forEach(e => pend.push({
    orden: 0, color: 'rojo', icono: 'alerta', chip: 'Atención', url: '#caja', titulo: 'Descuadre de caja',
    detalle: `${sucursal(e.sucursal)} · ${diaTexto(e.fecha)} · diferencia ${pesos(e.difTotal)}`
  }));
  const abiertas = docs(1);
  abiertas.filter(c => (c.fecha || '') < hoy).forEach(c => pend.push({
    orden: 1, color: 'amarillo', icono: 'reloj', chip: 'Cerrar', url: '#caja', titulo: 'Caja anterior sin cerrar',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · ${c.usuario || ''}`
  }));
  docs(2).filter(c => c.estado === 'cerrada' && c.exportadaSheets !== true && (parseInt(c.nVentas) || 0) > 0).forEach(c => pend.push({
    orden: 2, color: 'amarillo', icono: 'cajon', chip: 'Reenviar', url: '#caja', titulo: 'Cierre sin pasar a planilla',
    detalle: `${sucursal(c.sucursal)} · ${diaTexto(c.fecha)} · ${pesos(c.totalVentas)}`
  }));
  docs(3).forEach(s => pend.push({
    orden: 3, color: 'lila', icono: 'anular', chip: 'Revisar', url: '#caja/anulaciones', titulo: 'Anulación por aprobar',
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
    + ['Gastos', 'Ventas B2B', 'Producción'].map(n => fila(n, 'Próximamente', 'gris')).join('');
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
function pintarMenuCelular() {
  const u = estado.user, eq = estado.equipo || {};
  $('v-menu').innerHTML = `
    <div class="cabecera"><div><h1 id="t-menu">Menú</h1></div></div>
    <section class="tarjeta" aria-label="En Sistema Fën">
      <div class="grupo" style="padding:0 0 4px">En Sistema Fën</div>
      <a class="nav-item" href="#hoy">${icono('hoy')}Hoy</a>
      <a class="nav-item" href="#caja">${icono('cajon')}Ventas de caja</a>
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
    <a role="tab" href="#caja" aria-selected="${sub !== 'anulaciones' && sub !== 'reportes'}">Cierres</a>
    <a role="tab" href="#caja/anulaciones" aria-selected="${sub === 'anulaciones'}">Anulaciones</a>
    <a role="tab" href="#caja/reportes" aria-selected="${sub === 'reportes'}">Reportes</a></div>`;
}

async function pintarCaja(sub) {
  const el = $('v-caja');
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-caja">Ventas de caja</h1><p>Lo que antes hacías como administrador en la caja</p></div>${pestanasCaja(sub)}</div>
    <div class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></div>`;
  try {
    if (sub === 'anulaciones') await pintarAnulaciones(el, sub);
    else if (sub === 'reportes') await pintarReportes(el, sub);
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
      <div class="barra-h-txt"><span>${esc(f.nombre)}${f.extra ? ` <small>${esc(f.extra)}</small>` : ''}</span><b>${pesos(f.valor)} <small>${pct(f.valor, total)}%</small></b></div>
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
      <div class="tarjeta cifra"><span class="rotulo">Ventas · ${esc(titulo)}</span><span class="valor">${pesos(t.bruto)}</span><span class="nota">${varPct === null ? 'Bruto, con IVA' : `${varPct >= 0 ? '+' : ''}${varPct}% vs los ${largo} días anteriores`}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Neto (sin IVA)</span><span class="valor">${pesos(neto)}</span><span class="nota">IVA ${pesos(t.bruto - neto)}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Ventas</span><span class="valor">${t.nVentas.toLocaleString('es-CL')}</span><span class="nota">${t.nAnuladas ? `${t.nAnuladas} anuladas, no suman` : 'Sin anuladas'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Ticket promedio</span><span class="valor">${pesos(ticket)}</span><span class="nota">Bruto por venta</span></div>
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
