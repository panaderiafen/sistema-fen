// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas · motor de costeo (F1 paso 3): reglas puras, sin red  v0.58.0
//  Costo directo de cada receta con los precios de costos_mp (fen-gastos) y las recetas de fen-produccion.
//  Usa los cálculos compartidos de Cocina (cocina/modelo.js y cocina/bolleria.js, sin cambiarlos):
//   · pesoBase, porciones, esSub, recetaDeSub, esPieMM, desglose (masa madre/poolish sin receta)
//   · bajadaSub: cómo baja una sub receta (por UNIDADES si la sub receta rinde unidades y el ingrediente las trae;
//     si no, por GRAMOS sobre el peso del lote)
//   · bolleria.porPieza / esMasaBase / esEmpaste: qué ingrediente de un producto de Bollería es su masa base y su empaste
//  Fórmulas (todo neto):
//   · Materia prima en gramos: gramos × precio por g. Si se compra por volumen (ml) se usa 1 g = 1 ml (supuesto, queda
//     marcado "supuesto g = ml"). Si se compra por unidad: gramos ÷ peso por unidad × precio por unidad.
//   · Materia prima en unidades: unidades × precio por unidad. Si se compra por peso: unidades × peso por unidad × precio por g.
//   · Sub receta: costo del lote ÷ peso del lote (g) por gramo; en unidades, costo del lote ÷ porciones si rinde unidades,
//     o costo por gramo × peso por unidad si rinde gramos. Encadenadas (recursivo) con detección de ciclos.
//   · Insumos (envases, etiquetas): por unidad si la receta rinde unidades; por lote si rinde gramos (como Cocina).
//   · Merma de laminado (solo productos de Bollería con masa base): (costo de la masa + costo del empaste) × merma % ÷ 100.
//     Es la misma merma que usa la planificación (bolleria.necesidades: masas = exactas × (1 + merma/100)), sin redondear
//     a masas enteras (eso es de la planificación, no del costo de una pieza).
//   · Pie de masa madre: no suma (se repone con la misma masa madre; Cocina tampoco lo descuenta).
//   · Costo por unidad = costo del lote ÷ porciones (rendimiento). Si la receta rinde gramos, es por gramo (se lee por kg).
//  Se prueba solo: pruebas/sistemafen/finanzas-f1c.test.js.
// ═══════════════════════════════════════════════
import * as M from './cocina/modelo.js?v=0.11.0';
import * as B from './cocina/bolleria.js?v=0.11.0';

export const UMBRAL_HIST = 0.5;     // % de cambio que deja una entrada en el historial
export const ALZA_DEFECTO = 5;      // % de alza contra el mes anterior que avisa en Hoy
const MAX_PROF = 12;
const n = v => M.num(v);
const t = v => (v === null || v === undefined ? '' : String(v).trim());
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const red = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;
export const recetaAprobada = r => /^(consolidada|aprobada|activa)$/i.test(t(r && r.estado));
const tieneUn = i => i && i.unidades !== null && i.unidades !== undefined && i.unidades !== '' && n(i.unidades) > 0;
const ORIGEN = { planilla: 'Planilla', manual: 'A mano', sii: 'SII' };
export function origenTexto(c) {
  if (!c) return '';
  if (c.origen === 'sii' && c.sii) return `SII · ${t(c.sii.proveedor) || t(c.sii.rut)} · F.${t(c.sii.folio)}`;
  return ORIGEN[c.origen] || t(c.origen) || '';
}
const contenidoOk = c => !!(c && n(c.cantidad) > 0 && ['g', 'ml', 'un'].includes(c.unidad));
const ppbDe = c => (n(c.precioPorBase) > 0 ? n(c.precioPorBase) : (n(c.precioNeto) > 0 && contenidoOk(c.contenido) ? n(c.precioNeto) / n(c.contenido.cantidad) : 0));

// Costo de una materia prima o insumo con su cantidad. → { costo|null, cantidad, unidad, precioBase, base, origenPrecio, supuesto, motivo }
export function costoMp(c, { gramos = 0, unidades = null } = {}) {
  const enUn = unidades !== null && unidades !== undefined && n(unidades) > 0;
  const out = { cantidad: enUn ? n(unidades) : n(gramos), unidad: enUn ? 'un' : 'g', precioBase: null, base: null, origenPrecio: origenTexto(c), costo: null, supuesto: '', motivo: '' };
  if (!c) return { ...out, motivo: 'no está en el maestro de costos' };
  if (c.tipo === 'sub_receta') return { ...out, motivo: 'es sub receta sin receta' };
  if (c.estado === 'archivada') return { ...out, motivo: 'archivada' };
  if (!(n(c.precioNeto) > 0)) return { ...out, motivo: 'sin precio' };
  if (!contenidoOk(c.contenido)) return { ...out, motivo: 'contenido no reconocido' };
  const ppb = ppbDe(c), base = c.contenido.unidad, peso = n(c.pesoPorUnidad);
  Object.assign(out, { precioBase: ppb, base });
  if (enUn) {
    if (base === 'un') return { ...out, costo: n(unidades) * ppb };
    if (peso > 0) return { ...out, costo: n(unidades) * peso * ppb, supuesto: `1 un = ${peso} ${base === 'ml' ? 'ml' : 'g'}` };
    return { ...out, motivo: `va en unidades y se compra por ${base === 'g' ? 'peso' : 'volumen'} (falta peso por unidad)` };
  }
  if (!(n(gramos) > 0)) return { ...out, costo: 0 };
  if (base === 'g') return { ...out, costo: n(gramos) * ppb };
  if (base === 'ml') return { ...out, costo: n(gramos) * ppb, supuesto: 'g = ml' };
  if (peso > 0) return { ...out, costo: n(gramos) / peso * ppb, supuesto: `1 un = ${peso} g` };
  return { ...out, motivo: 'va en gramos y se compra por unidad (falta peso por unidad)' };
}

// ctx: { recetas, mps (fen-produccion), costos (costos_mp { id: doc }), config: { BOL: {…}, PAN: {…} } }
// → costear(id) con memoria. Cada resultado:
//   { id, nombre, area, tipo, unidad 'un'|'g', porciones, costoTotal, costoUnit, porGramo, pesoLote, desglose, insumos, merma,
//     incompleto: [motivos], ingredientesSinCosto: [nombres], precios: { mpId: precio por base }, recetaHash }
export function crearMotor(ctx) {
  const recetas = ctx.recetas || [], costos = ctx.costos || {}, mps = ctx.mps || [];
  const cctx = { recetas, mps, config: (ctx.config && ctx.config.PAN) || {} };
  const porId = {}; recetas.forEach(r => { if (r && r.id) porId[r.id] = r; });
  const porNombre = {};
  Object.entries(costos).forEach(([id, c]) => { if (c && c.nombre && c.tipo !== 'sub_receta') porNombre[norm(c.nombre)] = porNombre[norm(c.nombre)] || id; });
  mps.forEach(m => { if (m && m.nombre && costos[m.id] && !porNombre[norm(m.nombre)]) porNombre[norm(m.nombre)] = m.id; });
  const mermaLam = n(((ctx.config || {}).BOL || {}).merma_laminado_pct);
  const memo = {}, pila = [];

  function costear(id) {
    if (memo[id]) return memo[id];
    const r = porId[id];
    if (!r) return null;
    if (pila.includes(id)) return { ciclo: [...pila.slice(pila.indexOf(id)), id] };
    pila.push(id);
    const res = calcular(r);
    pila.pop();
    if (!res.cicloAbierto) memo[id] = res;
    return res;
  }

  function lineaSub(i, rs) {
    const nombre = t(i.nombre) || rs.nombre;
    const sub = costear(rs.id);
    const base = { tipo: 'sub', id: t(i.id), ingrediente: nombre, sub: rs.id, origenPrecio: 'Sub receta', costo: null };
    if (!sub) return { ...base, cantidad: n(i.gramos), unidad: 'g', incompleto: 'sub receta sin receta' };
    if (sub.ciclo) return { ...base, cantidad: n(i.gramos), unidad: 'g', incompleto: `ciclo: ${sub.ciclo.map(x => (porId[x] || {}).nombre || x).join(' → ')}`, ciclo: true };
    const pb = sub.pesoLote, u = n(i.unidades), g = n(i.gramos);
    let costo = null, factor = 0, cantidad = g, unidad = 'g', precioBase = sub.porGramo, baseU = 'g', nota = '';
    if (rs.unidad !== 'g' && u > 0) {                       // por unidades (como bajadaSub)
      factor = u / M.porciones(rs); costo = sub.costoTotal * factor; cantidad = u; unidad = 'un'; precioBase = sub.costoTotal / M.porciones(rs); baseU = 'un';
    } else if (g > 0 && pb > 0) {                           // por gramos sobre el peso del lote
      factor = g / pb; costo = sub.costoTotal * factor;
    } else if (u > 0 && n(rs.pesoUnidad) > 0 && pb > 0) {  // rinde gramos, se usa en unidades: peso por unidad
      const gg = u * n(rs.pesoUnidad); factor = gg / pb; costo = sub.costoTotal * factor; cantidad = u; unidad = 'un'; precioBase = sub.porGramo * n(rs.pesoUnidad); baseU = 'un'; nota = `1 un = ${n(rs.pesoUnidad)} g`;
    } else if (u > 0) return { ...base, cantidad: u, unidad: 'un', incompleto: 'sub receta en unidades sin peso por unidad' };
    else if (!(pb > 0)) return { ...base, cantidad: g, unidad: 'g', incompleto: 'sub receta sin ingredientes' };
    else costo = 0;
    const cic = sub.incompleto.find(x => /ciclo: /.test(x));
    return { ...base, cantidad, unidad, precioBase, base: baseU, costo, factor, supuesto: nota, incompleto: cic ? cic.slice(cic.indexOf('ciclo: ')) : sub.incompleto.length ? 'sub receta incompleta' : '', subRes: sub };
  }

  function calcular(r) {
    const ings = r.ingredientes || [], incompleto = [], sinCosto = [], precios = {}, desglose = [];
    let cicloAbierto = false;
    const usar = (id, c) => { if (id && c && n(c.precioNeto) > 0) precios[id] = red(ppbDe(c), 8); };
    ings.forEach(i => {
      const nombre = t(i.nombre) || t(i.id);
      if (M.esPieMM(i.nombre)) { desglose.push({ tipo: 'pie', id: t(i.id), ingrediente: nombre, cantidad: n(i.gramos), unidad: 'g', costo: 0, origenPrecio: '', nota: 'no suma: se repone con la misma masa madre' }); return; }
      if (M.esSub(i, cctx)) {
        const rs = M.recetaDeSub(i.id, i.nombre, cctx);
        if (rs && rs.id !== r.id) {
          const l = lineaSub(i, rs);
          if (l.ciclo) cicloAbierto = true;
          if (l.subRes) { Object.assign(precios, l.subRes.precios); delete l.subRes; }
          if (l.incompleto) { incompleto.push(`${nombre}: ${l.incompleto}`); if (l.costo === null) sinCosto.push(nombre); }
          desglose.push(l); return;
        }
        if (rs && rs.id === r.id) { incompleto.push(`${nombre}: se usa a sí misma`); sinCosto.push(nombre); desglose.push({ tipo: 'sub', id: t(i.id), ingrediente: nombre, cantidad: n(i.gramos), unidad: 'g', costo: null, incompleto: 'ciclo' }); return; }
        // Sin receta (masa madre o poolish de la configuración de Panadería): por sus componentes, buscando la materia prima por nombre
        const comps = M.desglose(i.id, i.nombre, n(i.gramos), cctx).filter(x => !x.esPie && !x.esSub);
        let costo = 0, falta = [];
        comps.forEach(x => { const mid = x.id && costos[x.id] ? x.id : porNombre[norm(x.nombre)]; const c = costos[mid]; const k = costoMp(c, { gramos: x.gramos }); if (k.costo === null) falta.push(x.nombre); else { costo += k.costo; usar(mid, c); } });
        const l = { tipo: 'sub', id: t(i.id), ingrediente: nombre, cantidad: n(i.gramos), unidad: 'g', costo: falta.length === comps.length && comps.length ? null : costo, origenPrecio: 'Configuración de Panadería', nota: `por sus componentes: ${comps.map(x => x.nombre).join(', ')}` };
        if (falta.length) { l.incompleto = `sin costo: ${falta.join(', ')}`; incompleto.push(`${nombre}: ${l.incompleto}`); if (l.costo === null) sinCosto.push(nombre); }
        desglose.push(l); return;
      }
      const mid = t(i.id) && costos[t(i.id)] ? t(i.id) : (t(i.id) ? t(i.id) : porNombre[norm(i.nombre)]);
      const c = costos[mid];
      const k = costoMp(c, { gramos: i.gramos, unidades: tieneUn(i) ? i.unidades : null });
      const l = { tipo: 'mp', id: mid || '', ingrediente: nombre, cantidad: k.cantidad, unidad: k.unidad, precioBase: k.precioBase, base: k.base, costo: k.costo, origenPrecio: k.origenPrecio, fechaPrecio: c ? t(c.fecha) : '', supuesto: k.supuesto };
      if (k.costo === null) { l.incompleto = k.motivo; incompleto.push(`${nombre}: ${k.motivo}`); sinCosto.push(nombre); } else usar(mid, c);
      desglose.push(l);
    });
    // Insumos: por unidad si rinde unidades (× porciones = el lote), por lote si rinde gramos
    const insumos = (r.insumos || []).map(x => {
      const nombre = t(x.nombre) || t(x.id), q = n(x.cantidad ?? x.unidades), lote = q * (r.unidad === 'g' ? 1 : M.porciones(r));
      const mid = t(x.id) && costos[t(x.id)] ? t(x.id) : (t(x.id) || porNombre[norm(x.nombre)]);
      const c = costos[mid], k = costoMp(c, { unidades: lote });
      const l = { tipo: 'insumo', id: mid || '', ingrediente: nombre, cantidad: lote, porUnidad: q, unidad: 'un', precioBase: k.precioBase, base: k.base, costo: k.costo, origenPrecio: k.origenPrecio, fechaPrecio: c ? t(c.fecha) : '', supuesto: k.supuesto };
      if (!(lote > 0)) { l.costo = 0; return l; }
      if (k.costo === null) { l.incompleto = k.motivo; incompleto.push(`${nombre} (insumo): ${k.motivo}`); sinCosto.push(nombre); } else usar(mid, c);
      return l;
    });
    // Merma de laminado: productos de Bollería con masa base (sobre la masa y el empaste)
    let merma = null;
    if (r.area === 'BOL' && r.tipo !== 'sub_receta' && mermaLam > 0) {
      const pp = B.porPieza(r, cctx);
      if (pp.masa) {
        const sobre = desglose.filter(l => l.tipo === 'sub' && l.costo !== null && (l.sub === pp.masa.id || B.esEmpaste(porId[l.sub], l.ingrediente)));
        const baseM = sobre.reduce((s, l) => s + l.costo, 0);
        if (baseM > 0) merma = { tipo: 'merma', ingrediente: `Merma de laminado (${mermaLam.toLocaleString('es-CL')} %)`, pct: mermaLam, sobre: sobre.map(l => l.ingrediente), base: baseM, costo: baseM * mermaLam / 100 };
      }
    }
    const porciones = M.porciones(r);
    if (!(n(r.porciones) > 0)) incompleto.push('Sin rendimiento: falta cuánto rinde (porciones)');
    if (!ings.length) incompleto.push('Sin ingredientes');
    const suma = xs => xs.reduce((s, l) => s + (l.costo || 0), 0);
    const costoTotal = suma(desglose) + suma(insumos) + (merma ? merma.costo : 0);
    const pesoLote = M.pesoBase(ings);
    const recetaHash = hash(JSON.stringify([ings.map(i => [t(i.id), n(i.gramos), tieneUn(i) ? n(i.unidades) : null]), (r.insumos || []).map(x => [t(x.id), n(x.cantidad ?? x.unidades)]), n(r.porciones), r.unidad || 'un', mermaLam]));
    return { id: r.id, nombre: r.nombre || r.id, area: r.area || '', tipo: r.tipo || 'receta', aprobada: recetaAprobada(r), unidad: r.unidad === 'g' ? 'g' : 'un', porciones,
      costoTotal, costoUnit: costoTotal / porciones, porGramo: pesoLote > 0 ? costoTotal / pesoLote : null, pesoLote, pesoUnidad: n(r.pesoUnidad),
      desglose, insumos, merma, incompleto: [...new Set(incompleto)], ingredientesSinCosto: [...new Set(sinCosto)], precios, recetaHash, cicloAbierto };
  }
  return { costear, porId };
}

// Todas las recetas aprobadas (y las que no, si se piden) → { id: resultado }
export function costearTodo(ctx, { soloAprobadas = true } = {}) {
  const m = crearMotor(ctx), out = {};
  // v0.72.0: las archivadas (Catálogo) se siguen costeando (los meses pasados las usan), con aprobada: false (no salen en Productos)
  (ctx.recetas || []).filter(r => r && r.id && (!soloAprobadas || recetaAprobada(r) || r.estado === 'archivada')).forEach(r => { const x = m.costear(r.id); if (x && !x.ciclo) out[r.id] = x; });
  return out;
}

// Costo por unidad de lo que se anota en Merma: tipo 'receta'|'mp', id, unidad 'un'|'g'|'ml' → { neto, incompleto } | null
export function costoUnitario(motor, costos, { tipo, id, unidad }) {
  if (tipo === 'mp') {
    const c = (costos || {})[id];
    if (c && c.tipo !== 'sub_receta') {
      const k = unidad === 'un' ? costoMp(c, { unidades: 1 }) : costoMp(c, { gramos: 1 });
      return k.costo === null ? null : { neto: k.costo, incompleto: false, supuesto: k.supuesto };
    }
    // Sub receta guardada como materia prima (SR…): su receta, por gramo
    const r = (motor.porId && Object.values(motor.porId).find(x => x.mpId === id)) || null;
    if (!r) return null;
    return costoUnitario(motor, costos, { tipo: 'receta', id: r.id, unidad });
  }
  const res = motor.costear(id);
  if (!res || res.ciclo) return null;
  let v = null;
  if (unidad === 'g' || unidad === 'ml') v = res.unidad === 'g' ? res.costoUnit : res.porGramo;
  else v = res.unidad === 'un' ? res.costoUnit : (res.pesoUnidad > 0 && res.porGramo !== null ? res.porGramo * res.pesoUnidad : null);
  return v === null || !isFinite(v) ? null : { neto: v, incompleto: res.incompleto.length > 0 };
}

// ── Lectura: por unidad o por kg ──
export const lectura = res => (res.unidad === 'g' ? { valor: res.costoUnit * 1000, por: 'kg', texto: 'por kg' } : { valor: res.costoUnit, por: 'un', texto: 'por unidad' });

// Hash corto y estable (djb2) de un texto
export function hash(s) { let h = 5381; const x = String(s); for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
export const hashPrecios = p => hash(JSON.stringify(Object.keys(p || {}).sort().map(k => [k, red(n(p[k]), 6)])));
export const pctCambio = (nuevo, anterior) => (n(anterior) > 0 ? (n(nuevo) - n(anterior)) / n(anterior) * 100 : null);

// ── Qué se guarda (costos_recetas) y qué va al historial (costos_recetas_hist) ──
// resultados: { id: resultado }; actuales: costos_recetas { id: doc }; nombres: { mpId: nombre } (para la causa)
// → { docs: [{ id, doc }], hist: [{ … }] }. Solo se escribe lo que cambió. Historial: si el costo por unidad cambia más de
// 0,5 % contra el último valor del historial (o es el primer cálculo), con la causa: las materias primas que cambiaron de precio.
export function planGuardar(resultados, actuales, { hoy, cuando, nombres = {}, umbral = UMBRAL_HIST } = {}) {
  const docs = [], hist = [];
  Object.values(resultados).forEach(res => {
    const act = (actuales || {})[res.id] || null, cu = red(res.costoUnit, 4), hp = hashPrecios(res.precios);
    const u = act && act.ultimoHist ? act.ultimoHist : null;
    const p = u ? pctCambio(cu, u.costoUnit) : null;
    const nuevoHist = !u || (n(u.costoUnit) > 0 ? Math.abs(p) > umbral : cu > 0);
    const base = { area: res.area, nombre: res.nombre, tipo: res.tipo, aprobada: res.aprobada, costoUnit: cu, costoTotal: red(res.costoTotal, 2), unidad: res.unidad, porciones: res.porciones,
      incompleto: res.incompleto.slice(0, 20), sinCosto: res.ingredientesSinCosto.slice(0, 20), preciosUsados: hp, precios: res.precios, recetaHash: res.recetaHash };
    let ultimoHist = u, preciosHist = act ? act.preciosHist || null : null, recetaHashHist = act ? act.recetaHashHist || '' : '';
    if (nuevoHist) {
      const antes = preciosHist || {};
      const causa = u ? Object.keys({ ...antes, ...res.precios }).filter(k => Math.abs(n(antes[k]) - n(res.precios[k])) > 1e-9)
        .map(k => ({ mp: k, nombre: nombres[k] || k, antes: antes[k] ?? null, despues: res.precios[k] ?? null, pct: antes[k] && res.precios[k] ? red(pctCambio(res.precios[k], antes[k]), 1) : null })) : [];
      const recetaCambio = !!u && recetaHashHist !== res.recetaHash;
      hist.push({ receta: res.id, nombre: res.nombre, area: res.area, anterior: u ? u.costoUnit : null, nuevo: cu, pct: u && p !== null ? red(p, 2) : null, unidad: res.unidad,
        causa, recetaCambio, primero: !u, incompleto: res.incompleto.length > 0, fecha: hoy, cuando });
      ultimoHist = { costoUnit: cu, fecha: hoy, cuando, anterior: u ? u.costoUnit : null, pct: u && p !== null ? red(p, 2) : null };
      preciosHist = res.precios; recetaHashHist = res.recetaHash;
    }
    const doc = { ...base, ultimoHist, preciosHist, recetaHashHist };
    const igual = act && act.costoUnit === doc.costoUnit && act.preciosUsados === hp && act.recetaHash === res.recetaHash && JSON.stringify(act.incompleto || []) === JSON.stringify(doc.incompleto)
      && act.nombre === doc.nombre && act.aprobada === doc.aprobada && act.area === doc.area && !nuevoHist;
    if (!igual) docs.push({ id: res.id, doc: { ...doc, calculadoEn: cuando, fecha: hoy } });
  });
  return { docs, hist };
}

// Referencia del mes: el último valor del historial antes del día 1 del mes actual. Si no hay (producto nuevo este mes),
// el valor con que partió el mes: el "anterior" del primer cambio del mes (o su valor, si fue el primer cálculo).
// histDeReceta: entradas de costos_recetas_hist de esa receta → { valor, fecha, incompleto } | null
export function referenciaMensual(histDeReceta, hoy) {
  const ini = String(hoy).slice(0, 8) + '01';
  const xs = (histDeReceta || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.cuando || '').localeCompare(String(b.cuando || '')));
  const antes = xs.filter(h => String(h.fecha) < ini);
  if (antes.length) { const h = antes[antes.length - 1]; return { valor: n(h.nuevo), fecha: h.fecha, incompleto: !!h.incompleto, delMes: false }; }
  const primero = xs[0];
  if (!primero) return null;
  return primero.anterior !== null && primero.anterior !== undefined ? { valor: n(primero.anterior), fecha: ini, incompleto: false, delMes: true } : { valor: n(primero.nuevo), fecha: primero.fecha, incompleto: !!primero.incompleto, delMes: true };
}
// El último cambio real (con valor anterior) → la entrada del historial | null
export function ultimoCambio(histDeReceta) {
  const xs = (histDeReceta || []).filter(h => h.anterior !== null && h.anterior !== undefined)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.cuando || '').localeCompare(String(a.cuando || '')));
  return xs[0] || null;
}
export function variacion(actual, ref) {
  const p = pctCambio(actual, ref); if (p === null) return null;
  return { pct: Math.round(p * 10) / 10, dir: Math.abs(p) < 0.05 ? 'igual' : p > 0 ? 'sube' : 'baja' };
}

// Filas de la tabla Productos: docs de costos_recetas (aprobadas) + historial → con mes anterior y último cambio
export function filasProductos(docsRecetas, hist, hoy) {
  const porReceta = {}; (hist || []).forEach(h => { (porReceta[h.receta] || (porReceta[h.receta] = [])).push(h); });
  return Object.entries(docsRecetas || {}).filter(([, d]) => d && d.aprobada && d.tipo !== 'sub_receta').map(([id, d]) => {
    const hs = porReceta[id] || [], ref = referenciaMensual(hs, hoy), uc = ultimoCambio(hs);
    return { id, ...d, ref, vsMes: ref && !ref.incompleto ? variacion(d.costoUnit, ref.valor) : null, ultimo: uc, vsUltimo: uc ? variacion(d.costoUnit, uc.anterior) : null, hist: hs };
  });
}
// Alzas que avisan en Hoy: costo por unidad sobre la referencia del mes más de "umbral" %, completo hoy y en la referencia,
// y que no se marcó "visto" con este mismo costo (si sube otra vez, vuelve a avisar). vistas: { recetaId: { costoUnit } }
export function alzas(filas, vistas, umbral = ALZA_DEFECTO) {
  return (filas || []).filter(f => f.vsMes && f.vsMes.pct > n(umbral) && !(f.incompleto || []).length)
    .filter(f => { const v = (vistas || {})[f.id]; return !(v && n(v.costoUnit) > 0 && Math.abs(pctCambio(f.costoUnit, v.costoUnit)) <= UMBRAL_HIST); })
    .sort((a, b) => b.vsMes.pct - a.vsMes.pct);
}

// ── v0.63.6 · Recetas por aprobar (Producción → Desde Cocina): propuesta vs vigente con el costo neto de Finanzas ──
// prop: { docId, area, recetaId, datos, vigente }. vinculos: fin_productos (para saber si se vende por unidad).
// → { fuente: 'finanzas', propuesta, vigente|null, vendePorUnidad: { si, motivo } }. Cada lado: { unidad, porciones, unidadNeto,
//   unidadBruto, loteNeto, porGramo, pesoLote, faltan: [], sinPrecio: [ingredientes sin costo], lineas: { ingId: costo|null } }.
export const IVA = 0.19;
export function compararPropuesta(ctx, prop, vinculos = {}) {
  const d = (prop && prop.datos) || {}, area = (prop && prop.area) || '', rid = (prop && prop.recetaId) || '';
  const base = (ctx.recetas || []).filter(r => r && r.id !== rid);
  const lado = (r, id) => {
    const rec = { ...r, id, area: r.area || area, estado: 'aprobada' };
    const res = crearMotor({ ...ctx, recetas: [...base, rec] }).costear(id);
    if (!res || res.ciclo) return null;
    const lineas = {};
    res.desglose.forEach(l => { if (l.id) lineas[l.id] = (lineas[l.id] || 0) + (l.costo === null ? NaN : l.costo); });
    Object.keys(lineas).forEach(k => { if (!isFinite(lineas[k])) lineas[k] = null; });
    return { unidad: res.unidad, porciones: res.porciones, unidadNeto: res.costoUnit, unidadBruto: res.costoUnit * (1 + IVA), loteNeto: res.costoTotal,
      porGramo: res.porGramo, pesoLote: res.pesoLote, faltan: [], sinPrecio: res.ingredientesSinCosto, incompleto: res.incompleto, lineas };
  };
  const propuesta = lado(d, rid || `propuesta:${(prop && prop.docId) || ''}`);
  const vigente = prop && prop.vigente ? lado(prop.vigente, rid || 'vigente') : null;
  return { fuente: 'finanzas', propuesta, vigente, vendePorUnidad: vendePorUnidad(prop, vinculos) };
}
// ¿Rinde gramos pero se vende por unidad? Cafetería, una receta vinculada a un producto de la caja o de B2B (fin_productos),
// o tipo "vendible". → { si, motivo }
export function vendePorUnidad(prop, vinculos = {}) {
  const d = (prop && prop.datos) || {}, v = (prop && prop.vigente) || {};
  if ((d.unidad || v.unidad) !== 'g') return { si: false, motivo: '' };
  if ((prop && prop.area) === 'CAF') return { si: true, motivo: 'es de Cafetería' };
  if (/vendible/i.test(t(d.tipo)) || /vendible/i.test(t(v.tipo))) return { si: true, motivo: 'es tipo vendible' };
  const rid = prop && prop.recetaId;
  const vin = rid ? Object.values(vinculos || {}).find(x => x && x.tipo !== 'ignorar' && !x.ignorar && x.receta === rid) : null;
  if (vin) return { si: true, motivo: `está vinculada a ${t(vin.nombre) || 'un producto'} (${vin.canal === 'b2b' ? 'B2B' : 'caja'})` };
  return { si: false, motivo: '' };
}
// Lote y unidad: lo que se lee primero. → { loteV, loteN, pctLote, unV, unN, pctUn, pctGramo, titular: { pct, que } }
export function resumenPropuesta(c) {
  const n0 = c && c.propuesta, o = c && c.vigente;
  if (!n0) return null;
  const pctLote = o ? pctCambio(n0.loteNeto, o.loteNeto) : null;
  const porUn = x => (x && x.unidad === 'un' ? x.unidadNeto : null);
  const unV = porUn(o), unN = porUn(n0), pctUn = unV !== null && unN !== null ? pctCambio(unN, unV) : null;
  const pg = x => (x ? (x.unidad === 'g' ? x.unidadNeto : (x.porGramo ?? null)) : null);
  const pctGramo = o && pg(o) !== null && pg(n0) !== null ? pctCambio(pg(n0), pg(o)) : null;
  const titular = pctUn !== null ? { pct: pctUn, que: 'por unidad' } : pctLote !== null ? { pct: pctLote, que: 'del lote' } : null;
  return { loteV: o ? o.loteNeto : null, loteN: n0.loteNeto, pctLote, unV, unN, pctUn, pctGramo, titular };
}
