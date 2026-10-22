// ═══════════════════════════════════════════════
//  Sistema Fën — Etapa 1: la base de Cocina (fen-produccion) es la maestra de recetas y materias primas  v0.73.0
//  Reglas puras (sin red), para aprobar recetas y resolver materias primas pedidas escribiendo SOLO en Firestore.
//  La planilla de Producción ya no se escribe (decisión del dueño, 21-oct-2026): queda como estaba (historial).
//  · ID de receta nueva: ÁREA + id de la propuesta (pid), en mayúsculas y solo letras y números (igual que hacía el script:
//    sfpAprobar → idNuevo.toUpperCase().replace(/[^A-Z0-9]/g, '')). Un reintento usa el mismo ID: no duplica.
//  · ID de sub receta (su entrada en mps, para usarla como ingrediente): 'SR' + hora en base 36 + 2 al azar, en mayúsculas
//    (igual que aprobarReceta de Code.gs). Una sub receta que ya tenía SR lo conserva.
//  · ID de materia prima / insumo: MP### / IN### = el mayor número con ese prefijo en mps + 1 (igual que solicitarMP).
//    v0.76.0: la misma regla (y la misma transacción, produccion.js crearEnMps) para las que creas en Finanzas → Costos.
//  · Documento de receta: los mismos campos que armaba produccion-modelo.js desde la fila de la planilla (sin costos).
// ═══════════════════════════════════════════════
const t = v => (v === null || v === undefined ? '' : String(v).trim());
export const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const x = Number(String(v ?? '').trim().replace(',', '.')); return isFinite(x) ? x : 0; };
const norm = v => t(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const idReceta = (area, pid) => (t(area) + t(pid)).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const idValidoReceta = (id, area) => !!id && id.indexOf(t(area)) === 0 && id.length >= 6;
export const idSR = (ahora = Date.now(), azar = Math.random()) => 'SR' + ahora.toString(36).toUpperCase() + azar.toString(36).substring(2, 4).toUpperCase().padEnd(2, '0');

// El siguiente ID de materia prima (MP) o insumo (IN): max + 1 del prefijo, 3 dígitos (MP007 → MP008; MP999 → MP1000)
export function siguienteIdMp(mps, tipo, saltar = []) {
  const pre = tipo === 'insumo' ? 'IN' : 'MP';
  const usados = new Set([...(mps || []).map(m => t(m && m.id)), ...saltar]);
  const nums = [...usados].filter(id => id.startsWith(pre)).map(id => parseInt(id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  let n = nums.length ? Math.max(...nums) + 1 : 1, id = pre + String(n).padStart(3, '0');
  while (usados.has(id)) { n++; id = pre + String(n).padStart(3, '0'); }
  return id;
}

// Ingredientes e insumos de una propuesta que no están en la base de Cocina (ni como materia prima ni como receta)
export function faltantes(datos, mps, recetas) {
  const ids = new Set([...(mps || []).map(m => t(m.id)), ...(recetas || []).map(r => t(r.id))]);
  const f = [];
  [...((datos && datos.ingredientes) || []), ...((datos && datos.insumos) || [])].forEach(i => { if (i && t(i.id) && !ids.has(t(i.id))) f.push(t(i.nombre) || t(i.id)); });
  return [...new Set(f)];
}
// Una sub receta no puede llamarse igual que una materia prima comprada (como en el script)
export function choqueNombre(datos, mps, recetaId) {
  if (!datos || datos.tipo !== 'sub_receta') return null;
  const n = norm(datos.nombre);
  return (mps || []).find(m => norm(m.nombre) === n && t(m.recetaOrigen) !== t(recetaId) && t(m.tipo) !== 'sub_receta' && !/^SR/i.test(t(m.id))) || null;
}

// La entrada de la sub receta en mps (si ya tenía una: por mpId de la receta o por recetaOrigen)
export function srDe(id, vig, mps) {
  const porId = {}; (mps || []).forEach(m => { porId[m.id] = m; });
  if (vig && t(vig.mpId) && porId[vig.mpId]) return porId[vig.mpId];
  return (mps || []).find(m => t(m.recetaOrigen) === t(id)) || null;
}

// Documento de la receta aprobada. p: la propuesta { area, pid, datos, creadaPor }; vig: la receta vigente (o null)
// ctx: { id, version, por, hoy, mpId }. Los campos que no maneja Cocina (procedimiento, variante, vende directo) quedan como estaban.
export function docReceta(p, vig, { id, version, por, hoy, mpId = '' }) {
  const d = (p && p.datos) || {}, area = t(p && p.area), pan = area === 'PAN', sub = d.tipo === 'sub_receta';
  const ingredientes = (d.ingredientes || []).map(i => ({
    id: t(i.id), nombre: t(i.nombre), gramos: num(i.gramos),
    unidades: i.unidades === null || i.unidades === undefined || i.unidades === '' ? null : num(i.unidades),
    pct: pan && i.pct !== null && i.pct !== undefined && i.pct !== '' ? num(i.pct) : 0
  }));
  const insumos = (d.insumos || []).map(i => ({ id: t(i.id), nombre: t(i.nombre), unidades: num(i.cantidad ?? i.unidades), cantidad: num(i.cantidad ?? i.unidades) }));
  const v = vig || {};
  const { id: _x, ...resto } = v;
  return {
    ...resto,
    area, nombre: t(d.nombre), estado: 'consolidada', tipo: sub ? 'sub_receta' : 'receta',
    porciones: num(d.porciones) || 1, unidad: d.unidad === 'g' ? 'g' : 'un', harinaTotal: pan ? num(d.harinaTotal) : 0,
    ingredientes, insumos, pasos: (d.pasos || []).map(x => t(typeof x === 'object' && x ? x.texto : x)).filter(Boolean),
    procedimiento: t(v.procedimiento), notas: t(d.notas), clasificacion: t(d.clasificacion), pesoUnidad: num(d.pesoUnidad) || 0,
    planificable: d.planificable !== false, vendeDirecto: vig ? v.vendeDirecto !== false : !sub, varianteDe: t(v.varianteDe),
    seCongela: !!d.seCongela, unidadesPorCaja: num(d.unidadesPorCaja) || 0, version: Number(version) || 1,
    aprobadaPor: t(por), aprobadaEn: t(hoy), mpId: sub ? t(mpId) : t(v.mpId), creadaPor: t(v.creadaPor) || t(p && p.creadaPor),
    propuesta: t(p && p.pid), origen: { base: 'sistema-fen', propuesta: t(p && p.pid), id }
  };
}
// La entrada de una sub receta en mps (para usarla como ingrediente). prev: la que ya tenía (o null)
export function docSR(receta, id, prev) {
  const x = prev || {};
  const areas = [...new Set([...(Array.isArray(x.areas) ? x.areas : []), receta.area].filter(Boolean))];
  const { id: _y, ...resto } = x;
  return { ...resto, nombre: receta.nombre, categoria: t(x.categoria) || 'Sub recetas', tipo: 'sub_receta', unidad: t(x.unidad) || 'kg', estado: 'activa', areas, recetaOrigen: id,
    reemplazadaPor: t(x.reemplazadaPor), critica: !!x.critica, stockSeguridad: num(x.stockSeguridad), solicitadaPor: t(x.solicitadaPor), origen: x.origen || { base: 'sistema-fen', receta: id } };
}
// Materia prima o insumo nuevo en mps (sin precio: el precio va a fen-gastos costos_mp). datos: { nombre, tipo, categoria, unidad, area }
// v0.76.0: también la que creas en Finanzas → Costos: datos.areas (lista; vacía = todas las áreas), origen e historial propios.
export function docMp(datos, { solicitud = '', por = '', hoy = '', origen = null, historial = null } = {}) {
  const areas = Array.isArray(datos.areas) ? [...new Set(datos.areas.map(t).filter(Boolean))] : [t(datos.area)].filter(Boolean);
  return { nombre: t(datos.nombre), categoria: t(datos.categoria) || 'Pendiente', tipo: datos.tipo === 'insumo' ? 'insumo' : 'mp', unidad: t(datos.unidad).toLowerCase() || (datos.tipo === 'insumo' ? 'un' : 'kg'),
    estado: 'activa', areas, recetaOrigen: '', reemplazadaPor: '', critica: false, stockSeguridad: 0, solicitadaPor: t(datos.area),
    origen: origen || { base: 'sistema-fen', solicitud }, creadaPor: t(por), creadaEn: t(hoy), ...(historial ? { historial } : {}) };
}
export const conArea = (m, area) => [...new Set([...(Array.isArray(m && m.areas) ? m.areas : []), area].filter(Boolean))];
