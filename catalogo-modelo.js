// ═══════════════════════════════════════════════
//  Sistema Fën — Catálogo, Etapa 0 "Qué está vivo" (reglas puras)  v0.72.0
//  Sin red ni pantalla: se prueba sola (pruebas/sistemafen/catalogo-v0720.test.js).
//  Hoy Fën produce solo lo base (pan, croissant, pan de chocolate, café) y algo de reventa. Pastelería y los croissants
//  rellenos están en pausa. Antes de armar un solo catálogo de productos se marca lo que está vivo y se archiva el resto
//  (sin perder historia: archivar se deshace).
//  · Recetas (fen-produccion recetas): archivada = estado 'archivada' (con estadoAntes, archivadaEn, archivadaPor).
//  · Productos de la caja (fen-ventas productos): archivado = activo === false (lo de siempre de la caja).
//  · Productos B2B (fen-b2b productos): archivado = estado 'archivado' (lo de siempre de B2B).
//  · "Vivo" (lo decide el dueño): fen-gastos cat_revision/{recetas|caja|b2b}_{id} = { decision: 'vivo', en, por }.
//  · Sugerido archivar: un producto sin ventas en 60 días; una receta que no usa ninguna receta viva y que no se vendió
//    (por ningún producto) en 60 días. Una sub receta que solo usan recetas también sugeridas, también se sugiere.
// ═══════════════════════════════════════════════
export const DIAS = 60;
export const AREAS = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería' };
export const ORDEN_AREAS = ['PAN', 'BOL', 'PAS', 'CAF'];
export const ESTADOS_RECETA = {
  consolidada: 'Aprobada', aprobada: 'Aprobada', en_prueba: 'En prueba', borrador: 'Borrador',
  'pendiente_aprobación': 'En revisión', pendiente_aprobacion: 'En revisión', anulada: 'Anulada', archivada: 'Archivada'
};
export const DECISIONES = { por_decidir: 'Por decidir', vivo: 'Vivo', archivado: 'Archivado' };
export const FILTROS = [['por_decidir', 'Por decidir'], ['vivo', 'Vivo'], ['archivado', 'Archivado'], ['todo', 'Todo']];

const s = v => String(v ?? '').trim();
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const red = (n, d = 2) => { const f = 10 ** d; return Math.round(num(n) * f) / f; };
export const normalizar = t => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Igual que finanzas-ventas.js (idDoc): un id que sirve como id de documento de Firestore
export const idDoc = t => s(t).replace(/\//g, '_').replace(/^\.+$/, '_').slice(0, 300) || '_';
export const claveRevision = (tipo, id) => `${tipo}_${idDoc(id)}`;   // tipo: 'recetas' | 'caja' | 'b2b'
export const claveVinculo = (canal, id) => `${canal}_${idDoc(id)}`;   // fin_productos (igual que finanzas-ventas.claveProducto)

const AREA_TXT = { panaderia: 'PAN', pan: 'PAN', bolleria: 'BOL', bol: 'BOL', pasteleria: 'PAS', pas: 'PAS', chocolateria: 'PAS', cafeteria: 'CAF', caf: 'CAF', sandwiches: 'PAN', reventa: 'REVENTA' };
export const areaDe = a => AREA_TXT[normalizar(a)] || (AREAS[s(a).toUpperCase()] ? s(a).toUpperCase() : '');
export const nombreArea = a => { const c = areaDe(a); return c === 'REVENTA' ? 'Reventa' : AREAS[c] || s(a); };

// ── Estados en las fuentes ──
export const recetaArchivada = r => !!r && r.estado === 'archivada';
// Viva = puede proteger a sus sub recetas (no archivada ni anulada)
export const recetaViva = r => !!r && !['archivada', 'anulada'].includes(s(r.estado));
export const cajaArchivado = p => !!p && p.activo === false;
export const b2bArchivado = p => !!p && p.estado === 'archivado';

// ── Fechas ──
const txt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function desdeDias(hoy, dias = DIAS) { const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() - (dias - 1)); return txt(d); }   // incluye hoy: 60 días

// ── Ventas de los últimos 60 días ──
// Caja: resúmenes de cierre (resumenes_caja, uno por cierre, las dos sucursales) → { productoId: { cantidad, neto, ultima } }
export function ventasCaja(resumenes, desde, hasta) {
  const V = {};
  (resumenes || []).forEach(r => {
    const f = s(r && r.fecha); if (!f || f < desde || f > hasta) return;
    Object.entries((r && r.porProducto) || {}).forEach(([pid, pp]) => {
      if (!pp) return;
      const c = num(pp.cantidad); if (!c) return;
      const x = V[pid] || (V[pid] = { cantidad: 0, neto: 0, ultima: '' });
      x.cantidad = red(x.cantidad + c); x.neto += pp.neto !== undefined && pp.neto !== null ? num(pp.neto) : Math.round(num(pp.bruto) / 1.19);
      if (f > x.ultima) x.ultima = f;
    });
  });
  Object.values(V).forEach(x => { x.neto = Math.round(x.neto); });
  return V;
}
// B2B: órdenes (sin anuladas ni quitadas) → { productoId: { cantidad, neto, ultima } }
export const idProductoB2b = l => s(l && l.productoId) || 'n-' + normalizar(l && l.producto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function ventasB2b(ordenes, desde, hasta) {
  const V = {};
  (ordenes || []).forEach(o => {
    if (!o || o.estado === 'anulada' || o.quitadoEnPlanilla) return;
    const f = s(o.fecha); if (!f || f < desde || f > hasta) return;
    (o.lineas || []).forEach(l => {
      const c = num(l.cantidad); if (!c) return;
      const pid = idProductoB2b(l), x = V[pid] || (V[pid] = { cantidad: 0, neto: 0, ultima: '' });
      x.cantidad = red(x.cantidad + c); x.neto += l.neto !== undefined && l.neto !== null && l.neto !== '' ? num(l.neto) : Math.round(c * num(l.precio));
      if (f > x.ultima) x.ultima = f;
    });
  });
  Object.values(V).forEach(x => { x.neto = Math.round(x.neto); });
  return V;
}

// ── Uso entre recetas ──
// Una receta usa a otra si un ingrediente tiene su id o su mpId (sub receta guardada como materia prima: SR…).
// → { recetaId: [ids de las recetas VIVAS que la usan] }
export function usos(recetas) {
  const porClave = {};
  (recetas || []).forEach(r => { if (!r || !r.id) return; porClave[r.id] = r.id; if (s(r.mpId)) porClave[s(r.mpId)] = r.id; });
  const U = {};
  (recetas || []).forEach(r => {
    if (!recetaViva(r)) return;
    (r.ingredientes || []).forEach(i => {
      const t = porClave[s(i && i.id)];
      if (!t || t === r.id) return;
      const l = U[t] || (U[t] = []);
      if (!l.includes(r.id)) l.push(r.id);
    });
  });
  return U;
}
// Las recetas vivas que (directa o indirectamente) usan a esta, más ella: para "archivar junto"
export function conUsuarios(id, recetas, U = usos(recetas)) {
  const set = new Set([id]), cola = [id];
  while (cola.length) { const x = cola.shift(); (U[x] || []).forEach(u => { if (!set.has(u)) { set.add(u); cola.push(u); } }); }
  return [...set];
}
// Bloqueos al archivar un grupo de recetas: una sub receta que usa una receta viva que NO se archiva junto.
// → [{ id, nombre, usan: [nombres] }] (vacío = se puede)
export function bloqueos(ids, recetas, U = usos(recetas)) {
  const set = new Set(ids), porId = {}; (recetas || []).forEach(r => { if (r && r.id) porId[r.id] = r; });
  return [...set].map(id => {
    const fuera = (U[id] || []).filter(u => !set.has(u) && recetaViva(porId[u]));
    return fuera.length ? { id, nombre: s((porId[id] || {}).nombre) || id, usan: fuera.map(u => s(porId[u].nombre) || u) } : null;
  }).filter(Boolean);
}
export const textoBloqueo = b => `La usa: ${b.usan.join(', ')} — archívalas primero o junto.`;

// ── Vínculo producto → receta ──
// fin_productos (lo decidido en Finanzas) manda; si no hay, el ID de receta del catálogo (caja idRecetaFen, B2B idReceta)
export function vinculoDe(canal, p, vinculos) {
  const v = (vinculos || {})[claveVinculo(canal, p.id)] || null;
  const cat = s(canal === 'b2b' ? p.idReceta : p.idRecetaFen);
  if (v && v.tipo === 'receta' && s(v.receta)) return { tipo: 'receta', receta: s(v.receta), nombre: s(v.recetaNombre), upv: num(v.unidadesPorVenta) > 0 ? num(v.unidadesPorVenta) : 1, origen: 'finanzas', catalogo: cat };
  if (v && v.tipo === 'reventa') return { tipo: 'reventa', receta: null, upv: num(v.unidadesPorVenta) > 0 ? num(v.unidadesPorVenta) : 1, origen: 'finanzas', catalogo: cat };
  if (v && v.tipo === 'ignorar') return { tipo: 'ignorar', receta: null, upv: 1, origen: 'finanzas', catalogo: cat };
  return { tipo: 'sin', receta: null, upv: 1, origen: '', catalogo: cat };
}
export function textoVinculo(vin, porId = {}) {
  if (vin.tipo === 'receta') return s((porId[vin.receta] || {}).nombre) || vin.nombre || vin.receta;
  if (vin.tipo === 'reventa') return 'Reventa';
  if (vin.tipo === 'ignorar') return 'No es producto';
  return 'Sin asociar';
}

// ── Todo junto ──
// datos: { recetas: [], caja: [productos fen-ventas], b2b: [productos fen-b2b], vinculos: fin_productos { clave: doc },
//          ventasCaja, ventasB2b: { productoId: { cantidad, ultima } }, revision: cat_revision { id: doc } }
// → { recetas: [fila], caja: [fila], b2b: [fila], resumen: { por_decidir, vivo, archivado }, sugeridas: { recetas, caja, b2b } }
export function armar(datos) {
  const recetas = (datos.recetas || []).filter(r => r && r.id);
  const porId = {}; recetas.forEach(r => { porId[r.id] = r; });
  const rev = datos.revision || {}, U = usos(recetas);
  const decision = (tipo, id) => { const d = rev[claveRevision(tipo, id)]; return d && d.decision === 'vivo' ? d : null; };
  const estadoFila = (archivado, viv) => archivado ? 'archivado' : viv ? 'vivo' : 'por_decidir';
  // Productos
  const filaProd = canal => p => {
    const ventas = ((canal === 'b2b' ? datos.ventasB2b : datos.ventasCaja) || {})[p.id] || null;
    const archivado = canal === 'b2b' ? b2bArchivado(p) : cajaArchivado(p), viv = decision(canal, p.id), vin = vinculoDe(canal, p, datos.vinculos);
    const cantidad = ventas ? num(ventas.cantidad) : 0;
    return {
      grupo: canal, id: p.id, clave: claveRevision(canal, p.id), nombre: s(p.nombre) || p.id, area: areaDe(p.area || p.categoria), areaTxt: s(p.area || p.categoria),
      vinculo: vin, vinculoTxt: textoVinculo(vin, porId), reventa: vin.tipo === 'reventa', cantidad, ultima: ventas ? ventas.ultima : '',
      archivado, decision: viv, estado: estadoFila(archivado, viv), sugerido: !archivado && !viv && cantidad <= 0,
      archivadoInfo: canal === 'b2b' ? (archivado ? { en: p.cambiadoEn || null, por: s(p.cambiadoPor) } : null) : null
    };
  };
  const caja = (datos.caja || []).filter(p => p && p.id).map(filaProd('caja'));
  const b2b = (datos.b2b || []).filter(p => p && p.id && !p.quitadoEnPlanilla).map(filaProd('b2b'));
  // Recetas: se venden como (los productos que llevan a ella) y cuánto (unidades de la receta = cantidad × unidades por venta)
  const vende = {};
  [...caja, ...b2b].forEach(f => {
    const ids = new Set();
    if (f.vinculo.tipo === 'receta') ids.add(f.vinculo.receta);
    if (f.vinculo.catalogo && f.vinculo.tipo !== 'reventa' && f.vinculo.tipo !== 'ignorar' && (f.vinculo.tipo !== 'receta' || f.vinculo.receta === f.vinculo.catalogo)) ids.add(f.vinculo.catalogo);
    ids.forEach(rid => {
      const upv = f.vinculo.tipo === 'receta' && f.vinculo.receta === rid ? f.vinculo.upv : 1;
      (vende[rid] || (vende[rid] = [])).push({ grupo: f.grupo, id: f.id, clave: f.clave, nombre: f.nombre, cantidad: f.cantidad, unidades: red(f.cantidad * upv), archivado: f.archivado, ultima: f.ultima });
    });
  });
  const filasR = recetas.map(r => {
    const archivado = recetaArchivada(r), viv = decision('recetas', r.id);
    const prods = (vende[r.id] || []).sort((a, b) => b.unidades - a.unidades || a.nombre.localeCompare(b.nombre, 'es'));
    const usadaEn = (U[r.id] || []).map(id => ({ id, nombre: s(porId[id].nombre) || id }));
    const unidades = red(prods.reduce((x, p) => x + p.unidades, 0));
    return {
      grupo: 'recetas', id: r.id, clave: claveRevision('recetas', r.id), nombre: s(r.nombre) || r.id, area: areaDe(r.area) || s(r.area), sub: r.tipo === 'sub_receta', mpId: s(r.mpId),
      estadoReceta: s(r.estado), estadoTxt: ESTADOS_RECETA[s(r.estado)] || s(r.estado).replace(/_/g, ' ') || 'Sin estado', estadoAntes: s(r.estadoAntes),
      usadaEn, seVende: prods, unidades, ultima: prods.reduce((m, p) => (p.ultima > m ? p.ultima : m), ''),
      archivado, decision: viv, estado: estadoFila(archivado, viv), candidata: !archivado && !viv && unidades <= 0,
      archivadoInfo: archivado ? { en: r.archivadaEn || null, por: s(r.archivadaPor) } : null
    };
  });
  // Sugeridas (el mayor conjunto estable): una candidata se sugiere si todas las recetas vivas que la usan también se sugieren
  const sug = new Set(filasR.filter(f => f.candidata).map(f => f.id));
  let cambio = true;
  while (cambio) { cambio = false; [...sug].forEach(id => { if ((U[id] || []).some(u => !sug.has(u))) { sug.delete(id); cambio = true; } }); }
  filasR.forEach(f => { f.sugerido = sug.has(f.id); });
  const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const ordenR = (a, b) => (ORDEN_AREAS.indexOf(a.area) + 1 || 9) - (ORDEN_AREAS.indexOf(b.area) + 1 || 9) || (a.sub - b.sub) || orden(a, b);
  const todas = [...filasR, ...caja, ...b2b];
  const resumen = { por_decidir: 0, vivo: 0, archivado: 0 };
  todas.forEach(f => { resumen[f.estado]++; });
  return {
    recetas: filasR.sort(ordenR), caja: caja.sort(orden), b2b: b2b.sort(orden), resumen,
    sugeridas: { recetas: filasR.filter(f => f.sugerido), caja: caja.filter(f => f.sugerido), b2b: b2b.filter(f => f.sugerido) },
    nSugeridas: todas.filter(f => f.sugerido).length, usos: U
  };
}

// Filtro de la pantalla: estado (por_decidir | vivo | archivado | todo) y texto (nombre o ID, sin tildes)
export function filtrar(filas, filtro = 'por_decidir', q = '') {
  const t = normalizar(q);
  return (filas || []).filter(f => (filtro === 'todo' || f.estado === filtro) && (!t || normalizar(`${f.nombre} ${f.id} ${f.mpId || ''}`).includes(t)));
}

// Productos activos vinculados a una receta (para avisar al archivarla y ofrecer archivarlos también)
export function productosActivos(fila) { return (fila && fila.seVende || []).filter(p => !p.archivado); }

// ── Lo que se escribe en la receta (fen-produccion) ──
// Archivar: estado 'archivada' + estadoAntes, archivadaEn, archivadaPor; su historial de archivo (nada se borra).
// Reactivar: vuelve a estadoAntes (si no hay: 'consolidada') y limpia los campos (null); el historial sigue.
export function cambioArchivo(r, archivar, { por = '', en = '' } = {}) {
  const hist = [...(Array.isArray(r.historialArchivo) ? r.historialArchivo : [])];
  if (archivar) {
    if (recetaArchivada(r)) return null;
    hist.push({ accion: 'archivada', estadoAntes: s(r.estado), por, en });
    return { estado: 'archivada', estadoAntes: s(r.estado), archivadaPor: por, historialArchivo: hist.slice(-40) };
  }
  if (!recetaArchivada(r)) return null;
  const vuelve = s(r.estadoAntes) && s(r.estadoAntes) !== 'archivada' ? s(r.estadoAntes) : 'consolidada';
  hist.push({ accion: 'reactivada', estado: vuelve, por, en });
  return { estado: vuelve, estadoAntes: null, archivadaEn: null, archivadaPor: null, reactivadaPor: por, historialArchivo: hist.slice(-40) };
}
// "Copiar desde la planilla" (y mover de área, aprobar) escriben la receta entera (set sin merge): una receta archivada en
// Firestore sigue archivada, con sus campos; el historial de archivo de una reactivada también se conserva.
export const CAMPOS_ARCHIVO = ['estadoAntes', 'archivadaEn', 'archivadaPor', 'historialArchivo', 'reactivadaEn', 'reactivadaPor'];
export function conArchivo(nuevo, actual) {
  if (!actual) return nuevo;
  const out = { ...nuevo };
  CAMPOS_ARCHIVO.forEach(k => { if (actual[k] !== undefined) out[k] = actual[k]; });
  if (recetaArchivada(actual)) { out.estado = 'archivada'; out.estadoAntes = s(actual.estadoAntes) || s(nuevo.estado); }
  return out;
}
