// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo (desde cero), base fen-gastos  v0.90.0 · Etapa 1: base y carga
//  Colecciones nuevas, que nacen vacías: gn_documentos, gn_movimientos y gn_cargas (reglas en gn-modelo.js).
//  Lo de antes (gastos, vencimientos, cartola_cargos, sii_docs…) no se toca ni se lee aquí.
//  · Todo pasa por fs-gastos.js (memoria de la sesión y cuidado de la cuota): abrir la Bandeja otra vez no vuelve a leer todo.
//  · Escribir es "agregar lo que falta" (set con merge de los campos que vienen del archivo): si otro equipo ya lo había
//    guardado, no se pierde nada de lo que se le agregó después (clasificación, pagos, notas). Nada se borra.
//  · Sin la marca de la planilla (planillaPendiente): lo nuevo ya no se copia a la planilla de Google.
// ═══════════════════════════════════════════════
import * as FB from './fs-gastos.js?v=0.90.0';
import { dbBase, correo } from './gastos-fs.js?v=0.90.0';
import { ahoraChile } from './gastos-g2.js?v=0.90.0';
import * as GN from './gn-modelo.js?v=0.90.0';

const quien = () => correo() || 'Sistema Fën';
const todos = async col => { const d = await dbBase(); return (await FB.getDocs(FB.collection(d, col))).docs.map(x => ({ id: x.id, ...x.data() })); };
function limpio(v) {
  if (Array.isArray(v)) return v.map(limpio);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { const o = {}; Object.entries(v).forEach(([k, x]) => { if (x !== undefined) o[k] = limpio(x); }); return o; }
  return v;
}
const inicio = () => (typeof window !== 'undefined' && window.FEN_SIS && window.FEN_SIS.INICIO) || '2026-10-01';

// ── Lecturas ──
export async function leer() {
  const [docs, movs, cargas] = await Promise.all([todos(GN.COL.docs), todos(GN.COL.movs), todos(GN.COL.cargas)]);
  return { docs, movs, cargas: cargas.sort((a, b) => String(b.en || '').localeCompare(String(a.en || ''))), inicio: inicio() };
}

// ── Escrituras ──
async function escribir(col, lista, extra) {
  const d = await dbBase();
  for (let i = 0; i < lista.length; i += 400) {
    const b = FB.writeBatch(d);
    lista.slice(i, i + 400).forEach(x => { const { id, ...resto } = x; b.set(FB.doc(d, col, id), limpio({ ...resto, ...extra }), { merge: true }); });
    await b.commit();
  }
}
async function guardarCarga(k) {
  const d = await dbBase(), b = FB.writeBatch(d);
  b.set(FB.doc(d, GN.COL.cargas, k.id), limpio({ ...k, id: undefined, creadoEn: FB.serverTimestamp() }));
  await b.commit();
}
const nuevoExtra = (cargaId, por, en) => ({ estado: 'vigente', creado: { por, en, carga: cargaId }, version: 0 });

// Compras del SII ya leídas (sii.leer): { facturas, omitidas, formato }
export async function cargarSii(L, archivo) {
  const ya = await todos(GN.COL.docs), por = quien(), en = ahoraChile().texto, id = GN.idCarga('sii');
  const P = GN.planDocs(L.facturas, ya, inicio(), id);
  await escribir(GN.COL.docs, P.nuevos, nuevoExtra(id, por, en));
  const fechas = (L.facturas || []).map(f => GN.aIso(f.fecha)).filter(Boolean).sort();
  const k = { id, tipo: 'sii', archivo: String(archivo.nombre || '').slice(0, 120), tamano: Number(archivo.tamano) || 0, formato: L.formato || '', desde: fechas[0] || '', hasta: fechas[fechas.length - 1] || '',
    leidos: P.leidos, nuevos: P.nuevos.length, yaEstaban: P.yaEstaban, anteriores: P.anteriores, antiguos: P.antiguos, guias: (L.omitidas || []).length, por, en };
  await guardarCarga(k);
  return { ...k, plan: P };
}
// Movimientos ya armados (GN.movsDeCartola / GN.movsDeMP) con el id de su carga
export async function cargarMovs(tipo, movs, meta) {
  const ya = await todos(GN.COL.movs), por = quien(), en = ahoraChile().texto;
  const P = GN.planMovs(movs, ya, inicio());
  await escribir(GN.COL.movs, P.nuevos, nuevoExtra(meta.id, por, en));
  const k = { id: meta.id, tipo, archivo: String(meta.archivo || '').slice(0, 120), tamano: Number(meta.tamano) || 0, identificador: String(meta.identificador || '').slice(0, 120),
    desde: meta.desde || '', hasta: meta.hasta || '', cuentas: [...new Set(movs.map(m => m.cuenta))], leidos: P.leidos, nuevos: P.nuevos.length, yaEstaban: P.yaEstaban,
    parecidos: P.parecidos.length, parecidosLista: P.parecidos.slice(0, 50), antes: P.antes, traspasos: P.nuevos.filter(m => m.naturaleza === 'traspaso').length, por, en };
  await guardarCarga(k);
  return { ...k, plan: P };
}
