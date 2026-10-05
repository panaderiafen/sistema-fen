// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos  v0.8.0
//  Habla con el Apps Script de Gastos (v2.2.0, archivo SistemaFen.gs v1.1.0)
//  con la sesión de administración de Sistema Fën. El script usa las mismas
//  funciones de la app de Gastos: un pago o un gasto queda igual que si se
//  hubiera hecho allá (mismas hojas, misma carpeta de Drive).
//  Cada envío lleva una clave única (idem): si se repite, no se guarda dos veces.
// ═══════════════════════════════════════════════
import { auth } from './firebase.js?v=0.8.0';
import * as Apps from './apps.js?v=0.8.0';

export const VERSION_MINIMA = '2.2.0';
let urlOk = null, cacheDatos = null;

async function url() {
  const u = (await Apps.leerConexiones()).gastos;
  if (!u) throw Object.assign(new Error('Falta la dirección del script de Gastos (Configuración → Conexiones).'), { code: 'sin_url' });
  if (urlOk !== u) {
    const v = await Apps.probar('gastos', u, VERSION_MINIMA);
    if (!v.ok) throw Object.assign(new Error(v.version ? `El script de Gastos está en v${v.version}: falta actualizarlo a v${VERSION_MINIMA} (ver README).` : v.texto), { code: 'actualizar' });
    urlOk = u;
  }
  return u;
}
const nuevaClave = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60);

async function llamar(op, datos = {}, idem) {
  const u = await url();
  const cuerpo = JSON.stringify({ ...datos, action: 'sistema_fen_gastos', op, idToken: await auth.currentUser.getIdToken(), ...(idem ? { idem } : {}) });
  let r = await (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo })).json();
  if (r && r.code === 'version') {
    // Google desvió el envío. Solo la lectura se reintenta por la dirección: un pago o un gasto
    // no (llevaría la sesión en la dirección y una foto no cabe). No se guardó nada.
    if (op !== 'datos') throw Object.assign(new Error('Google no dejó pasar el envío. Inténtalo de nuevo en un momento (no se guardó nada).'), { code: 'version' });
    r = await (await fetch(u + '?p=' + encodeURIComponent(cuerpo))).json();
  }
  if (!r || !r.ok) throw Object.assign(new Error((r && (r.error || r.msg || r.message)) || 'Respuesta inesperada de Gastos'), { code: r && r.code });
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
