// ═══════════════════════════════════════════════
//  fën · Cocina — cálculos de Bollería (sin pantalla)  v0.9.0
//  Metas semanales de productos → masas base y empastes que hay que elaborar la semana
//  ANTERIOR, en masas enteras, y tandas según la amasadora.
//
//  Cómo están armadas las recetas (planilla de Producción):
//  · Masa base: sub receta con clasificación "masa_base" y "aparece en la grilla" (planificable).
//    1 unidad = 1 masa (ej. Masa Base de 1.600 g; lleva Poolish Masa Base dentro).
//  · Empaste: sub receta en gramos que NO va a la grilla (mantequilla).
//  · Producto: receta del área que lleva una masa base. Ej. Croissant XL = 0,1 un de Masa Base
//    (1 masa rinde 10) + 30 g de Empaste (300 g por masa).
// ═══════════════════════════════════════════════
import * as M from './modelo.js?v=0.9.0';

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// (el empaste y el poolish no son masas base aunque en la planilla tengan esa clasificación)
export const esMasaBase = r => !!r && r.clasificacion === 'masa_base' && r.planificable !== false && !/empaste|poolish/.test(norm(r.nombre));
export const esEmpaste = (r, nombre) => (!!r && r.clasificacion === 'masa_base' && r.planificable === false) || /empaste/.test(norm(nombre || (r && r.nombre)));

// Peso de 1 masa (g): el "peso por unidad" de la receta o, si no está, el lote ÷ rendimiento
export const pesoMasa = r => M.num(r && r.pesoUnidad) > 1 ? M.num(r.pesoUnidad) : M.pesoBase(r && r.ingredientes) / M.porciones(r);

// Masas base del área, por nombre
export function masasBase(recetas, area = 'BOL') {
  return (recetas || []).filter(r => r.area === area && esMasaBase(r)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Lo que lleva 1 pieza de un producto: qué masa base (en masas) y cuánto empaste (en gramos)
export function porPieza(r, ctx) {
  const p = M.porciones(r), out = { masa: null, masas: 0, empaste: null, empasteG: 0 };
  (r.ingredientes || []).forEach(i => {
    const rs = M.recetaDeSub(i.id, i.nombre, ctx);
    if (rs && esMasaBase(rs) && !out.masa) {
      out.masa = rs;
      out.masas = M.num(i.unidades) > 0 ? M.num(i.unidades) / p : (pesoMasa(rs) > 0 ? M.num(i.gramos) / p / pesoMasa(rs) : 0);
    } else if (esEmpaste(rs, i.nombre) && (rs || M.esSub(i, ctx))) {
      out.empaste = out.empaste || rs || { id: i.id, nombre: i.nombre, ingredientes: [] };
      out.empasteG += M.num(i.unidades) > 0 && rs ? M.num(i.unidades) * M.pesoBase(rs.ingredientes) / M.porciones(rs) / p : M.num(i.gramos) / p;
    }
  });
  return out;
}

// Productos con meta: recetas (no sub recetas) del área que llevan una masa base
export function productos(recetas, ctx, area = 'BOL') {
  return (recetas || []).filter(r => r.area === area && r.tipo !== 'sub_receta')
    .map(r => ({ receta: r, ...porPieza(r, ctx) })).filter(x => x.masa && x.masas > 0)
    .sort((a, b) => a.receta.nombre.localeCompare(b.receta.nombre, 'es'));
}

// Capacidad de la amasadora en masas enteras por tanda: por kg (si está) o por masas (configuración antigua)
export function masasPorTanda(masa, cfg) {
  const c = cfg || {}, kg = M.num(c.amasadora_kg), pm = pesoMasa(masa);
  if (kg > 0 && pm > 0) return Math.max(1, Math.floor(kg * 1000 / pm + 1e-9));
  return Math.max(1, Math.round(M.num(c.amasadora_max_por_tanda) || 16));
}
export const tandasPorDia = cfg => Math.max(1, Math.round(M.num((cfg || {}).amasadora_tandas_dia) || 2));
// Tandas de N masas: las menos posibles, parejas (6 + 6 + 5)
export function tandasMasas(n, porTanda) {
  const N = Math.round(M.num(n)); if (N <= 0) return [];
  return M.dividir(N, Math.ceil(N / Math.max(1, porTanda)));
}

// Lo necesario para unas metas { recetaId: piezas }:
// por masa base → masas exactas, masas enteras a elaborar (con la merma de laminado), empastes y de qué productos sale
export function necesidades(metas, ctx, cfg) {
  const merma = M.num((cfg || {}).merma_laminado_pct);
  const porMasa = {}, avisos = [];
  productos(ctx.recetas, ctx).forEach(p => {
    const n = M.num((metas || {})[p.receta.id]); if (!(n > 0)) return;
    const m = porMasa[p.masa.id] || (porMasa[p.masa.id] = { masa: p.masa, exactas: 0, empasteG: 0, empaste: null, productos: [], ratios: [] });
    m.exactas += n * p.masas;
    m.empasteG += n * p.empasteG;
    if (p.empaste) m.empaste = m.empaste || p.empaste;
    m.productos.push({ receta: p.receta, piezas: n, masas: n * p.masas, rinde: 1 / p.masas });
    if (p.empasteG > 0) m.ratios.push({ nombre: p.receta.nombre, g: p.empasteG / p.masas });
  });
  const lista = Object.values(porMasa).map(m => {
    const masas = Math.ceil(m.exactas * (1 + merma / 100) - 1e-9);
    const gEmp = m.exactas > 0 ? m.empasteG / m.exactas : 0;
    const distintos = m.ratios.filter(x => Math.abs(x.g - gEmp) > gEmp * 0.01);
    if (distintos.length) avisos.push(`${m.masa.nombre}: los productos piden distinto empaste por masa (${m.ratios.map(x => `${x.nombre} ${Math.round(x.g)} g`).join(', ')}). Se usa el promedio, ${Math.round(gEmp)} g.`);
    return { ...m, masas, kg: masas * pesoMasa(m.masa) / 1000, empastes: m.empasteG > 0 ? masas : 0, gPorEmpaste: gEmp, merma };
  }).sort((a, b) => a.masa.nombre.localeCompare(b.masa.nombre, 'es'));
  return { masas: lista, avisos };
}

// Reparte N masas parejo entre los días dados (índices 0 = lunes), en masas enteras
export function repartir(n, dias) {
  const ds = dias && dias.length ? dias : [0, 1, 2, 3, 4];
  const r = M.dividir(Math.max(0, Math.round(M.num(n))), ds.length), out = {};
  ds.forEach((d, i) => { if (r[i]) out['d' + d] = r[i]; });
  return out;
}
export const sumaDias = obj => Object.values(obj || {}).reduce((s, v) => s + M.num(v), 0);

// ═══════════════ Bitácora (P2b) ═══════════════
// Cada día de Bollería guarda en dias/BOL_{fecha}.bitacora = { id: anotación }. Nada se borra: se anula.
// Anotaciones:
//  · inventario { masas: {masa: n}, empastes: {masa: n}, productos: {producto: n} } → el congelado contado (reemplaza todo)
//  · elaboro    { masa, n }            → +n masas y +n empastes congelados (cada masa lleva su empaste)
//  · descongelo { masa, n }            → −n masas y −n empastes (el empaste sale con su masa)
//  · formo      { producto, n, congelar } → +congelar productos congelados; los demás (n − congelar) se hornean ese día
//  · horneo     { producto, n }        → −n productos congelados (salen del congelador al horno)
//  · v0.6.0: la merma del día (dias.merma) marcada "se perdió congelado" baja el stock: −n masas (su empaste
//    queda) o −n productos. La que no está marcada no toca el stock: lo descongelado o sacado al horno ya salió.
// El stock parte del último inventario y suma lo que vino después, día por día, en orden de anotación.
export const TIPOS = {
  inventario: 'Inventario del congelador', elaboro: 'Elaboré masas', descongelo: 'Descongelé masas',
  formo: 'Formé', horneo: 'Horneé desde el congelador'
};
// diasDocs: { 'AAAA-MM-DD': docDelDia } → lista de anotaciones vigentes ordenadas (fecha, hora)
export function anotaciones(diasDocs, hasta) {
  const out = [];
  Object.entries(diasDocs || {}).forEach(([f, d]) => {
    if (hasta && f > hasta) return;
    Object.entries((d && d.bitacora) || {}).forEach(([id, a]) => { if (a && !a.anulado) out.push({ ...a, id, fecha: f }); });
    Object.entries((d && d.merma) || {}).forEach(([id, a]) => {
      if (a && !a.anulado && a.congelado && a.item) out.push({ tipo: 'merma', id: 'merma_' + id, fecha: f, en: a.en, n: M.num(a.cantidad), [a.congeladoDe === 'masa' ? 'masa' : 'producto']: a.item });
    });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.en || '').localeCompare(String(b.en || '')));
}
const sumar = (o, k, n) => { if (!k) return; o[k] = (o[k] || 0) + M.num(n); };
// Congelado al final de un día (incluido)
export function stock(diasDocs, hasta) {
  const lista = anotaciones(diasDocs, hasta);
  let ini = -1; lista.forEach((a, i) => { if (a.tipo === 'inventario') ini = i; });
  const s = { masas: {}, empastes: {}, productos: {}, desde: ini >= 0 ? lista[ini].fecha : null, conInventario: ini >= 0 };
  if (ini >= 0) { const a = lista[ini]; ['masas', 'empastes', 'productos'].forEach(k => Object.entries(a[k] || {}).forEach(([id, n]) => sumar(s[k], id, n))); }
  lista.slice(ini + 1).forEach(a => {
    if (a.tipo === 'elaboro') { sumar(s.masas, a.masa, a.n); if (a.conEmpaste !== false) sumar(s.empastes, a.masa, a.n); }
    if (a.tipo === 'descongelo') { sumar(s.masas, a.masa, -a.n); if (a.conEmpaste !== false) sumar(s.empastes, a.masa, -a.n); }
    if (a.tipo === 'formo') sumar(s.productos, a.producto, a.congelar);
    if (a.tipo === 'horneo') sumar(s.productos, a.producto, -a.n);
    if (a.tipo === 'merma') { if (a.masa) sumar(s.masas, a.masa, -a.n); else sumar(s.productos, a.producto, -a.n); }
  });
  return s;
}
// Lo horneado en una semana (lunes a domingo), por producto: lo formado y horneado el mismo día + lo horneado desde el congelador
export function horneado(diasDocs, lunes) {
  const fin = M.sumarDias(lunes, 6), r = {};
  anotaciones(diasDocs, fin).filter(a => a.fecha >= lunes).forEach(a => {
    if (a.tipo === 'formo') sumar(r, a.producto, Math.max(0, M.num(a.n) - M.num(a.congelar)));
    if (a.tipo === 'horneo') sumar(r, a.producto, a.n);
  });
  return r;
}
// Rendimiento real de una semana por masa: masas descongeladas vs piezas formadas (en masas según la receta)
export function rendimiento(diasDocs, lunes, ctx) {
  const fin = M.sumarDias(lunes, 6), prods = productos(ctx.recetas, ctx), r = {};
  anotaciones(diasDocs, fin).filter(a => a.fecha >= lunes).forEach(a => {
    if (a.tipo === 'descongelo') { const x = r[a.masa] || (r[a.masa] = { masas: 0, esperadas: 0 }); x.masas += M.num(a.n); }
    if (a.tipo === 'formo') { const p = prods.find(y => y.receta.id === a.producto); if (p) { const x = r[p.masa.id] || (r[p.masa.id] = { masas: 0, esperadas: 0 }); x.esperadas += M.num(a.n) * p.masas; } }
  });
  return r;
}
export const cajas = (n, porCaja) => M.num(porCaja) > 0 ? Math.ceil(Math.max(0, M.num(n)) / M.num(porCaja) - 1e-9) : null;
