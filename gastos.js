// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos  v0.10.0
//  Habla con el Apps Script de Gastos (v2.2.0+, archivo SistemaFen.gs; registrados, obligaciones, ítems y SII piden v2.4.0)
//  con la sesión de administración de Sistema Fën. El script usa las mismas
//  funciones de la app de Gastos: un pago o un gasto queda igual que si se
//  hubiera hecho allá (mismas hojas, misma carpeta de Drive).
//  Cada envío lleva una clave única (idem): si se repite, no se guarda dos veces.
// ═══════════════════════════════════════════════
import { auth } from './firebase.js?v=0.30.2';
import * as Apps from './apps.js?v=0.30.2';

export const VERSION_MINIMA = '2.2.0';
let urlOk = null, versionOk = '', cacheDatos = null;

// Antes de la primera llamada se pregunta la versión del script: a uno antiguo no se le manda nada nuevo
async function url(minima = VERSION_MINIMA) {
  const u = (await Apps.leerConexiones()).gastos;
  if (!u) throw Object.assign(new Error('Falta la dirección del script de Gastos (Configuración → Conexiones).'), { code: 'sin_url' });
  if (urlOk !== u || !Apps.mayorIgual(versionOk, minima)) {
    const v = await Apps.probar('gastos', u, minima);
    if (!v.ok) throw Object.assign(new Error(v.version ? `El script de Gastos está en v${v.version}: falta actualizarlo a v${minima} (ver README).` : v.texto), { code: 'actualizar' });
    urlOk = u; versionOk = v.version;
  }
  return u;
}
const nuevaClave = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);

// Lecturas chicas que se pueden reintentar por la dirección si Google desvía el envío
const LECTURAS_GET = ['datos', 'sii_cargas', 'sii_detalle', 'sii_ventas', 'sii_archivo', 'cc_lista'];
export async function llamar(op, datos = {}, idem, minima) {
  const u = await url(minima);
  const cuerpo = JSON.stringify({ ...datos, action: 'sistema_fen_gastos', op, idToken: await auth.currentUser.getIdToken(), ...(idem ? { idem } : {}) });
  let r = await (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo })).json();
  if (r && r.code === 'version') {
    // Google desvió el envío. Solo la lectura se reintenta por la dirección: un pago o un gasto
    // no (llevaría la sesión en la dirección y una foto no cabe). No se guardó nada.
    if (!LECTURAS_GET.includes(op)) throw Object.assign(new Error('Google no dejó pasar el envío. Inténtalo de nuevo en un momento (no se guardó nada).'), { code: 'version' });
    r = await (await fetch(u + '?p=' + encodeURIComponent(cuerpo))).json();
  }
  if (!r || !r.ok) throw Object.assign(new Error((r && (r.error || r.msg || r.message)) || 'Respuesta inesperada de Gastos'), { code: r && r.code, datos: r });
  return r;
}

// Vencimientos e ítems. Se guardan 60 segundos en memoria (Hoy, Agenda y Gastos los comparten).
export async function datos(forzar) {
  if (!forzar && cacheDatos && Date.now() - cacheDatos.t < 60000) return cacheDatos.d;
  const d = await llamar('datos');
  cacheDatos = { t: Date.now(), d };
  return d;
}
export const olvidar = () => { cacheDatos = null; };

export async function pagar(pago, idem) { const r = await llamar('pagar', pago, idem); olvidar(); return r; }
export async function registrar(gasto, idem) { const r = await llamar('registrar', gasto, idem); olvidar(); return r; }
export { nuevaClave };

// Archivo para Drive: una foto se achica (lado mayor 1600 px, JPEG) para que suba rápido;
// un PDF va tal cual (hasta 8 MB).
export async function prepararArchivo(file) {
  if (!file) return null;
  if (file.type === 'application/pdf') {
    if (file.size > 8 * 1024 * 1024) throw new Error('El PDF pesa más de 8 MB');
    return { imageData: await base64(file), mimeType: file.type, fileName: file.name };
  }
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name || '')) throw new Error('El archivo debe ser una foto o un PDF');
  // Si el navegador no puede achicarla (por ejemplo una foto HEIC de iPhone en un computador), se sube tal cual
  const original = async () => {
    if (file.size > 8 * 1024 * 1024) throw new Error('La foto pesa más de 8 MB y este navegador no puede achicarla. Prueba con una captura o en formato JPG.');
    return { imageData: await base64(file), mimeType: file.type || 'image/heic', fileName: file.name || 'foto' };
  };
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('no')); i.src = src; });
    const max = 1600, esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * esc)); c.height = Math.max(1, Math.round(img.naturalHeight * esc));
    const ctx = c.getContext('2d'); if (!ctx) return original();
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.82), datos = dataUrl.split(',')[1];
    if (!datos) return original();
    return { imageData: datos, mimeType: 'image/jpeg', fileName: (file.name || 'foto').replace(/\.[a-z0-9]+$/i, '') + '.jpg' };
  } catch (e) { return original(); }
  finally { URL.revokeObjectURL(src); }
}
function base64(file) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); }); }

// Neto / IVA / total como la app de Gastos (harina: 19% + 12% adicional)
export function desglose(monto, tipoMonto, esHarina) {
  const f = esHarina ? 1.31 : 1.19, m = Number(monto) || 0;
  if (tipoMonto === 'neto') return { neto: m, total: Math.round(m * f) };
  if (tipoMonto === 'siniva') return { neto: m, total: m };
  return { neto: Math.round(m / f), total: m };
}

// ── v0.10.0: gastos registrados, obligaciones e ítems (script de Gastos v2.4.0) ──
export const VERSION_COMPLETA = '2.4.0';
const op = (o, d, idem) => llamar(o, d, idem, VERSION_COMPLETA);
let cacheLista = null;
// Gastos desde el 1 de enero del año pasado (alcanza para el análisis). 60 s en memoria.
export async function lista(forzar) {
  if (!forzar && cacheLista && Date.now() - cacheLista.t < 60000) return cacheLista.d;
  const d = await op('g_lista');
  cacheLista = { t: Date.now(), d };
  return d;
}
const olvidarTodo = () => { cacheLista = null; cachePlantillas = null; olvidar(); };
export { olvidarTodo };
export async function editar(g, cambios, idem) { const r = await op('g_editar', { fila: g.fila, huella: g.huella, ...cambios }, idem); olvidarTodo(); return r; }
export async function anular(filas, motivo, idem) { const r = await op('g_anular', { filas: filas.map(g => ({ fila: g.fila, huella: g.huella })), motivo }, idem); olvidarTodo(); return r; }
export const plantillas = () => op('obl_plantillas');
export const historialPagos = filtro => op('obl_historial', filtro || {});
export async function anularVencimiento(id, motivo) { const r = await op('obl_anular_venc', { id, motivo }); olvidarTodo(); return r; }
export async function reabrirVencimiento(id, motivo) { const r = await op('obl_reabrir_venc', { id, motivo }); olvidarTodo(); return r; }
export async function guardarObligacion(d, idem) { const r = await op('obl_guardar', d, idem); olvidarTodo(); return r; }
export async function archivarObligacion(id, archivar) { const r = await op(archivar ? 'obl_archivar' : 'obl_activar', { id }); olvidarTodo(); return r; }
export const itemsTodos = () => op('items_todos');
// v0.16.0 · Agenda: próximos pagos de las obligaciones (60 s en memoria) y copia a Google Calendar (script v2.6.0)
let cachePlantillas = null;
export async function plantillasAgenda() {
  if (cachePlantillas && Date.now() - cachePlantillas.t < 60000) return cachePlantillas.d;
  const d = await plantillas(); cachePlantillas = { t: Date.now(), d }; return d;
}
export const VERSION_CALENDARIO = '2.6.0';
export const calendario = eventos => llamar('calendario', { eventos }, null, VERSION_CALENDARIO);
export async function guardarItem(d) { const r = await op('item_guardar', d); olvidarTodo(); return r; }
export async function moverItem(item, direccion) { const r = await op('item_mover', { item, direccion }); olvidarTodo(); return r; }
export async function archivarItem(nombre, archivar) { const r = await op('item_archivar', { nombre, archivar }); olvidarTodo(); return r; }
