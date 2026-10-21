// ═══════════════════════════════════════════════
//  Sistema Fën — Catálogo · Reventa (lo que se compra hecho y se vende tal cual): reglas puras, sin red  v0.73.0
//  La reventa vive en Sistema Fën y la ingresa el dueño (no Cocina). Se guarda en fen-gastos:
//    cat_reventa/{id} = { id, nombre, costoNeto (por unidad, sin IVA), unidad ('un'…), proveedor { rut, razon } | null,
//                         estado 'activo' | 'archivado', creadoEn, creadoPor, editadoEn, editadoPor, origen 'planilla' | 'manual', historial [] }
//  IDs: los de la planilla se conservan (REV###, para que la caja y B2B sigan calzando); los nuevos, REV + el número que sigue (3 dígitos).
//  Nada se borra: archivar se deshace con "Reactivar".
// ═══════════════════════════════════════════════
const t = v => (v === null || v === undefined ? '' : String(v).trim());
export const norm = v => t(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
export const num = v => { if (typeof v === 'number') return isFinite(v) ? v : NaN; const s = t(v).replace(/\$|\s/g, ''); if (!s) return NaN; const x = Number(/^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s.replace(',', '.')); return isFinite(x) ? x : NaN; };
export const UNIDADES = ['un', 'kg', 'g', 'lt', 'ml', 'caja', 'paquete'];
export const ESTADOS = { activo: 'Activo', archivado: 'Archivado' };
export const ID_RE = /^REV\d{3,}$/;

export function siguienteId(lista, saltar = []) {
  const nums = [...(lista || []).map(x => t(x && x.id)), ...saltar].filter(id => /^REV\d+$/i.test(id)).map(id => parseInt(id.slice(3), 10));
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return 'REV' + String(n).padStart(3, '0');
}
const rutLimpio = r => t(r).toUpperCase().replace(/[^0-9K]/g, '');
export function rutValido(r) {
  const x = rutLimpio(r); if (x.length < 2) return false;
  const cuerpo = x.slice(0, -1), dv = x.slice(-1); if (!/^\d+$/.test(cuerpo)) return false;
  let s = 0, m = 2; for (let i = cuerpo.length - 1; i >= 0; i--) { s += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const r2 = 11 - (s % 11), esp = r2 === 11 ? '0' : r2 === 10 ? 'K' : String(r2);
  return esp === dv;
}
export const rutTexto = r => { const x = rutLimpio(r); if (x.length < 2) return t(r); const c = x.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return `${c}-${x.slice(-1)}`; };

// Valida lo escrito en el diálogo → { nombre, costoNeto, unidad, proveedor } (lanza Error con un texto para la pantalla)
export function validar(d, lista = [], idPropio = '') {
  const nombre = t(d.nombre).replace(/\s+/g, ' ').slice(0, 120);
  if (!nombre) throw new Error('Escribe el nombre.');
  const otro = (lista || []).find(x => x.id !== idPropio && norm(x.nombre) === norm(nombre));
  if (otro) throw new Error(`Ya existe "${otro.nombre}" (${otro.id}${otro.estado === 'archivado' ? ', archivado: reactívalo' : ''}).`);
  let c = num(d.costoNeto);
  if (!(c >= 0)) throw new Error('Costo neto: escribe un número (sin IVA), por ejemplo 1250.');
  if (d.conIva) c = Math.round(c / 1.19 * 100) / 100;
  const unidad = t(d.unidad).toLowerCase() || 'un';
  if (unidad.length > 20) throw new Error('Unidad: corta, por ejemplo "un", "kg" o "caja".');
  const rut = t(d.rut), razon = t(d.razon).slice(0, 120);
  if (rut && !rutValido(rut)) throw new Error('El RUT del proveedor no es válido (revisa el dígito verificador).');
  return { nombre, costoNeto: Math.round(c * 100) / 100, unidad, proveedor: rut || razon ? { rut: rut ? rutTexto(rut) : '', razon } : null };
}
// Una entrada de historial (lo que cambió: antes → después)
export function cambiosDe(antes, despues) {
  const campos = ['nombre', 'costoNeto', 'unidad', 'proveedor', 'estado'], out = {};
  campos.forEach(k => { const a = JSON.stringify(antes ? antes[k] ?? null : null), b = JSON.stringify(despues[k] ?? null); if (a !== b && k in despues) out[k] = { antes: antes ? antes[k] ?? null : null, despues: despues[k] ?? null }; });
  return out;
}
export const conHistorial = (h, e) => [...(Array.isArray(h) ? h : []), e].slice(-30);

// ── "Traer reventa de la planilla" (una vez): filas de la lista publicada (CSV) con código de área REV ──
// filasCsv: [{ id, nombre, area }] (ajustes.leerRecetasProduccion); vinculos: fin_productos; cat: { caja, b2b } productos (para el ID de catálogo);
// existentes: cat_reventa. → [{ id, nombre, costoNeto|null, costoDe, ya }] (ya = ese ID ya está en cat_reventa: no se vuelve a traer)
export function candidatosPlanilla(filasCsv, vinculos, cat, existentes = []) {
  const ya = new Set((existentes || []).map(x => x.id));
  const rev = (filasCsv || []).filter(f => /^rev/i.test(t(f.area)) && t(f.id));
  const vs = Object.values(vinculos || {}).filter(v => v && v.tipo === 'reventa');
  const prod = (canal, id) => ((cat && cat[canal]) || {})[id] || null;
  const vistos = new Set();
  return rev.filter(f => { const k = t(f.id).toUpperCase(); if (vistos.has(k)) return false; vistos.add(k); return true; }).map(f => {
    const id = t(f.id).toUpperCase(), n = norm(f.nombre);
    // El costo: de un vínculo de Finanzas de tipo reventa del mismo producto (por el ID del catálogo de la caja o de B2B, o por el nombre)
    const conCosto = vs.filter(v => v.costoReventaNeto !== null && v.costoReventaNeto !== undefined && isFinite(Number(v.costoReventaNeto)));
    const porId = conCosto.find(v => v.reventaId === id) || conCosto.find(v => { const p = prod(v.canal === 'b2b' ? 'b2b' : 'caja', v.productoId); return p && t(p.idRecetaFen || p.idReceta).toUpperCase() === id; });
    const porNombre = !porId && conCosto.find(v => norm(v.nombre) === n || norm(String(v.nombre || '').replace(/\s+b2b$/i, '')) === n);
    const v = porId || porNombre || null;
    return { id, nombre: t(f.nombre), costoNeto: v ? Number(v.costoReventaNeto) : null, costoDe: v ? `${v.canal === 'b2b' ? 'B2B' : 'caja'}: ${t(v.nombre)}${porId ? '' : ' (mismo nombre)'}` : '', ya: ya.has(id) };
  });
}

// Qué productos de venta llevan a cada reventa: vínculo de Finanzas con reventaId, o ID del catálogo de la caja (idRecetaFen) o B2B (idReceta)
export function usos(lista, vinculos, cat) {
  const out = {}; (lista || []).forEach(r => { out[r.id] = []; });
  Object.entries(vinculos || {}).forEach(([clave, v]) => { if (v && v.tipo === 'reventa' && v.reventaId && out[v.reventaId]) out[v.reventaId].push({ clave, nombre: v.nombre || v.productoId, canal: v.canal === 'b2b' ? 'b2b' : 'caja' }); });
  ['caja', 'b2b'].forEach(canal => Object.values((cat && cat[canal]) || {}).forEach(p => {
    const rid = t(p.idRecetaFen || p.idReceta).toUpperCase(), clave = `${canal}_${p.id}`;
    if (rid && out[rid] && !out[rid].some(x => x.clave === clave)) out[rid].push({ clave, nombre: p.nombre || p.id, canal });
  }));
  return out;
}
export function filtrar(lista, filtro, q) {
  const nq = norm(q);
  return (lista || []).filter(x => filtro === 'todo' || (filtro === 'archivado' ? x.estado === 'archivado' : x.estado !== 'archivado'))
    .filter(x => !nq || norm(`${x.nombre} ${x.id} ${(x.proveedor && (x.proveedor.razon + ' ' + x.proveedor.rut)) || ''}`).includes(nq))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
export const resumen = lista => ({ activos: (lista || []).filter(x => x.estado !== 'archivado').length, archivados: (lista || []).filter(x => x.estado === 'archivado').length });
