// ═══════════════════════════════════════════════
//  fën · Cocina — consumo de materias primas, stock de la bodega y proyección (sin pantalla)  v0.10.0
//  La usa Sistema Fën (que lee las cuatro áreas; copia exacta en sistema-fen/cocina/).
//
//  Bodega común: un stock por materia prima.
//  · Consumo = lo HECHO en Cocina, bajado por las recetas (y sus sub recetas) hasta las materias primas:
//      Panadería y Pastelería: las recetas marcadas terminadas (hechos.rec_{id}), con la cantidad del día
//        (Pastelería: dias.cantidades; Panadería: el plan de ese día).
//      Bollería (bitácora): "Elaboré masas" = la masa base y su empaste; "Formé" = lo demás del producto
//        (la masa y el empaste ya se contaron al elaborarlos).
//      Todas: la merma anotada de una materia prima (la de una receta ya se contó al hacerla).
//      Cafetería (v0.8.0): lo VENDIDO en la caja de productos con receta de Cafetería (datos.ventas, lo arma
//        Sistema Fën con los resúmenes de la caja) y los gramos de café de la bitácora de turno (calibraciones,
//        café botado y pruebas) descontados de la materia prima config/CAF.mp_cafe.
//    Una sub receta que es de OTRA área no se baja: la cuenta el área que la hace (la crema pastelera la
//    cuenta Pastelería cuando la termina, no Bollería al rellenar). En Pastelería tampoco se bajan sus propias
//    sub recetas: las marca terminadas aparte (la crema no se cuenta otra vez dentro de la torta).
//    El pie de masa madre no se cuenta.
//  · Stock = último conteo + llegadas − consumo, en orden de hora (dias/{AREA}_{fecha}.bodega).
//      bodega = { id: { tipo: 'llegada'|'conteo', mp, nombre, cantidad (g, ml o un), por, en, anulado } }
//  · Proyección (para avisar antes de quedarse corto): lo planificado de Panadería, las masas por elaborar y
//    las metas de Bollería; Pastelería y Cafetería al ritmo de los últimos 14 días.
//  · Qué materias primas llevan stock (críticas) y su mínimo: stockmp/{mpId} = { critica, seguridad }
//    (la pone Administración); si no hay, lo de la planilla (es_critica, stock_seguridad en kg, l o un).
//    v0.10.0: stockmp/{mpId}.envase = { nombre: 'saco', tamano: 25000 (g, ml o un) } → se cuenta y se recibe en sacos
//    (más lo suelto) y el stock también se muestra en sacos. Sin envase: en kg, litros o unidades.
// ═══════════════════════════════════════════════
import * as M from './modelo.js?v=0.10.0';
import * as B from './bolleria.js?v=0.10.0';
import * as R from './registros.js?v=0.10.0';

const n0 = v => M.num(v);
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ── Materias primas: unidad base y control ──
export const unidadMp = mp => R.unidadDe('mp', mp);                      // 'g' | 'ml' | 'un'
export function control(mp, sm) {
  const u = unidadMp(mp), f = u === 'un' ? 1 : 1000;
  const tiene = sm && typeof sm === 'object';
  return {
    critica: tiene && sm.critica !== undefined ? !!sm.critica : !!(mp && mp.critica),
    seguridad: tiene && sm.seguridad !== undefined && sm.seguridad !== null ? n0(sm.seguridad) : n0(mp && mp.stockSeguridad) * f,
    unidad: u,
    envase: tiene && sm.envase && String(sm.envase.nombre || '').trim() && n0(sm.envase.tamano) > 0 ? { nombre: String(sm.envase.nombre).trim().slice(0, 20), tamano: n0(sm.envase.tamano) } : null
  };
}
// Plural simple para el envase (saco → sacos, caja → cajas, bidón → bidones)
export const envases = (nombre, n) => Math.abs(n0(n)) === 1 ? nombre : /[aeiou]$/i.test(nombre) ? nombre + 's' : /ó?n$/i.test(nombre) ? nombre.replace(/ón$/i, 'ones').replace(/n$/i, 'nes') : nombre + 'es';
// Cantidad con su equivalente en envases: "212 kg · 8,5 sacos"
export function textoEnv(n, u, env) {
  const t = texto(n, u);
  if (!env) return t;
  const k = Math.round(n0(n) / env.tamano * 10) / 10;
  return `${t} · ${k.toLocaleString('es-CL')} ${envases(env.nombre, k)}`;
}
// Cantidad para mostrar: kg o l cuando pasa de 1.000 g / ml
export function texto(n, u) {
  const v = n0(n), a = Math.abs(v), s = v < 0 ? '−' : '';
  if (u === 'un') return `${s}${M.unidades(a)} un`;
  if (a >= 1000) return `${s}${(Math.round(a / 100) / 10).toLocaleString('es-CL')} ${u === 'ml' ? 'l' : 'kg'}`;
  return `${s}${Math.round(a).toLocaleString('es-CL')} ${u === 'ml' ? 'ml' : 'g'}`;
}
// Lo que se escribe al contar o recibir: kg / l (o unidades) → g / ml
export const aBase = (valor, u) => u === 'un' ? n0(valor) : n0(valor) * 1000;
export const deBase = (valor, u) => u === 'un' ? n0(valor) : n0(valor) / 1000;
export const unidadEntrada = u => u === 'un' ? 'un' : u === 'ml' ? 'l' : 'kg';

// Ajuste vigente de una receta en un día (el último período que lo cubre)
export function ajustesDe(ajustes, fecha) {
  const r = {};
  Object.values(ajustes || {}).forEach(a => {
    const ps = (a && a.periodos) || [];
    for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; if (M.tieneAjuste(p) && p.desde <= fecha && (!p.hasta || fecha <= p.hasta)) { r[a.recetaId] = p; break; } }
  });
  return r;
}

// ── Bajar una receta a materias primas ──
// cantidad en la unidad de la receta (unidades o gramos). out: { mpId: cantidad }; sinId: { nombre: g } (ingredientes sin ID)
// parar(rs) → true: esa sub receta no se baja (la cuenta otra área o se contó aparte)
export function bajar(receta, cantidad, ctx, { ajustes = {}, parar = null, out = {}, sinId = {} } = {}) {
  const porNombre = {}; (ctx.mps || []).forEach(m => { porNombre[norm(m.nombre)] = m.id; });
  const sumar = (id, nombre, q) => { if (!(q > 0)) return; if (id) out[id] = (out[id] || 0) + q; else { const k = porNombre[norm(nombre)]; if (k) out[k] = (out[k] || 0) + q; else sinId[nombre] = (sinId[nombre] || 0) + q; } };
  const rec = (r, f, prof) => {
    const ings = M.ingredientesAjustados(r, ajustes[r.id]);
    ings.forEach(i => {
      if (M.esPieMM(i.nombre)) return;
      const g = n0(i.gramos) * f;
      if (!M.esSub(i, ctx)) { sumar(i.id, i.nombre, g); return; }
      const rs = M.recetaDeSub(i.id, i.nombre, ctx);
      if (rs && parar && parar(rs)) return;
      const ingsA = rs ? M.ingredientesAjustados(rs, ajustes[rs.id]) : null;
      if (rs && M.pesoBase(ingsA) > 0 && prof < 6) { rec(rs, M.bajadaSub(i, f, rs, ingsA).f, prof + 1); return; }
      // Sin receta (masa madre, poolish de la configuración): por sus componentes, buscando la materia prima por nombre
      M.desglose(i.id, i.nombre, g, ctx).forEach(c => { if (!c.esPie && !c.esSub) sumar(c.id, c.nombre, c.gramos); });
    });
    // Insumos (envases): por unidad si la receta rinde unidades; por lote si rinde gramos
    (r.insumos || []).forEach(x => sumar(x.id, x.nombre, n0(x.cantidad ?? x.unidades) * (r.unidad === 'g' ? f : f * M.porciones(r))));
  };
  rec(receta, n0(cantidad) / M.porciones(receta), 0);
  return { out, sinId };
}

const recetaPorId = (ctx, id) => (ctx.recetas || []).find(r => r.id === id) || null;
const enDe = (fecha, en) => (typeof en === 'string' && en ? en : fecha + 'T12:00:00.000Z');
// Gramos de una sub receta → cantidad en su unidad (como la tarjeta de Hoy: g × porciones / peso del lote)
const cantDeGramos = (rs, g, aj) => { const pb = M.pesoBase(M.ingredientesAjustados(rs, (aj || {})[rs.id])); return pb > 0 ? g * M.porciones(rs) / pb : 0; };
const empGramosPorMasa = (masaId, ctx) => {
  const ps = B.productos(ctx.recetas, ctx).filter(p => p.masa && p.masa.id === masaId && p.empasteG > 0);
  return ps.length ? { g: ps.reduce((s, p) => s + p.empasteG / p.masas, 0) / ps.length, receta: ps[0].empaste && ps[0].empaste.ingredientes && ps[0].empaste.ingredientes.length ? ps[0].empaste : null } : null;
};

// ── Lo consumido (hecho) ──
// datos: { recetas, mps, config: { AREA: cfg }, ajustes: { AREA: { id: ajuste } }, dias: { AREA: { fecha: doc } }, planes: { 'AREA_lunes': plan } }
// → [{ area, fecha, en, mp, cantidad, origen }] (sin anuladas)
export function consumo(datos, desde = '0000-00-00', hasta = '9999-12-31') {
  const ev = [], sinId = {};
  const ctxDe = area => ({ recetas: datos.recetas || [], mps: datos.mps || [], config: (datos.config || {})[area] || {} });
  const agregar = (area, fecha, en, origen, res) => Object.entries(res.out).forEach(([mp, q]) => { if (q > 0) ev.push({ area, fecha, en: enDe(fecha, en), mp, cantidad: q, origen }); });
  Object.entries(datos.dias || {}).forEach(([area, dias]) => {
    const ctx = ctxDe(area), ajA = (datos.ajustes || {})[area] || {};
    const deOtra = rs => rs.area && rs.area !== area;
    Object.entries(dias || {}).forEach(([fecha, d]) => {
      if (!d || fecha < desde || fecha > hasta) return;
      const aj = ajustesDe(ajA, fecha), op = { ajustes: aj, sinId };
      if (area === 'BOL') {
        const bit = Object.values(d.bitacora || {}).filter(a => a && !a.anulado);
        bit.forEach(a => {
          if (a.tipo === 'elaboro') {
            const m = recetaPorId(ctx, a.masa); if (!m || !(n0(a.n) > 0)) return;
            agregar(area, fecha, a.en, m.nombre, bajar(m, n0(a.n), ctx, { ...op, parar: deOtra }));
            const e = a.conEmpaste === false ? null : empGramosPorMasa(m.id, ctx);
            if (e && e.receta) agregar(area, fecha, a.en, 'Empaste de ' + m.nombre, bajar(e.receta, cantDeGramos(e.receta, e.g * n0(a.n), aj), ctx, { ...op, parar: deOtra }));
          }
          if (a.tipo === 'formo') {
            const p = recetaPorId(ctx, a.producto); if (!p || !(n0(a.n) > 0)) return;
            agregar(area, fecha, a.en, p.nombre, bajar(p, n0(a.n), ctx, { ...op, parar: rs => deOtra(rs) || B.esMasaBase(rs) || B.esEmpaste(rs) }));
          }
        });
      } else {
        const plan = (datos.planes || {})[area + '_' + M.lunesDe(fecha)];
        const parar = area === 'PAS' ? rs => deOtra(rs) || rs.tipo === 'sub_receta' : deOtra;
        Object.entries(d.hechos || {}).forEach(([k, h]) => {
          if (!h || !h.por || !k.startsWith('rec_')) return;
          const r = recetaPorId(ctx, k.slice(4)); if (!r) return;
          const q = d.cantidades && d.cantidades[r.id] !== undefined ? n0(d.cantidades[r.id]) : n0(((plan && plan.filas) || {})[r.id] && plan.filas[r.id]['d' + M.indiceDia(fecha)]);
          if (q > 0) agregar(area, fecha, h.en, r.nombre, bajar(r, q, ctx, { ...op, parar }));
        });
      }
      // Cafetería: el café de la bitácora de turno (calibraciones, café botado, pruebas)
      const mpCafe = area === 'CAF' && ((datos.config || {}).CAF || {}).mp_cafe;
      if (mpCafe) Object.values(d.turno || {}).forEach(a => { if (a && !a.anulado && n0(a.gramos) > 0) ev.push({ area, fecha, en: enDe(fecha, a.en), mp: mpCafe, cantidad: n0(a.gramos), origen: 'Bitácora de turno' }); });
      Object.values(d.merma || {}).forEach(a => { if (a && !a.anulado && a.tipo === 'mp' && n0(a.cantidad) > 0) ev.push({ area, fecha, en: enDe(fecha, a.en), mp: a.item, cantidad: n0(a.cantidad), origen: 'Merma' }); });
    });
  });
  // Cafetería: lo vendido (ventas: [{ fecha, en, receta, cantidad }]); solo recetas de Cafetería (lo demás lo cuenta su área)
  const ctxC = ctxDe('CAF');
  (datos.ventas || []).forEach(v => {
    if (!v || v.fecha < desde || v.fecha > hasta || !(n0(v.cantidad) > 0)) return;
    const r = recetaPorId(ctxC, v.receta); if (!r || r.area !== 'CAF') return;
    const aj = ajustesDe(((datos.ajustes || {}).CAF) || {}, v.fecha);
    agregar('CAF', v.fecha, v.en, r.nombre + ' (venta)', bajar(r, n0(v.cantidad), ctxC, { ajustes: aj, parar: rs => rs.area && rs.area !== 'CAF', sinId }));
  });
  return { eventos: ev.sort((a, b) => a.en.localeCompare(b.en)), sinId };
}

// Suma por materia prima y área: { mp: { total, porArea: { AREA: q } } }
export function porMp(eventos) {
  const r = {};
  (eventos || []).forEach(e => { const x = r[e.mp] || (r[e.mp] = { total: 0, porArea: {} }); x.total += e.cantidad; x.porArea[e.area] = (x.porArea[e.area] || 0) + e.cantidad; });
  return r;
}

// ── Bodega: llegadas y conteos (de todas las áreas y de Administración) ──
export function movimientos(dias) {
  const out = [];
  Object.entries(dias || {}).forEach(([area, ds]) => Object.entries(ds || {}).forEach(([fecha, d]) =>
    Object.entries((d && d.bodega) || {}).forEach(([id, a]) => { if (a && !a.anulado && a.mp) out.push({ ...a, id, area, fecha, en: enDe(fecha, a.en), cantidad: n0(a.cantidad) }); })));
  return out.sort((a, b) => a.en.localeCompare(b.en));
}
// Stock de una materia prima: el último conteo + llegadas − consumo posteriores (null si nunca se contó)
export function stock(mpId, movs, eventos) {
  const ms = (movs || []).filter(m => m.mp === mpId);
  let ini = -1; ms.forEach((m, i) => { if (m.tipo === 'conteo') ini = i; });
  if (ini < 0) return { contado: false, stock: null, conteo: null, llegadas: 0, consumo: 0 };
  const c = ms[ini], llegadas = ms.slice(ini + 1).filter(m => m.tipo === 'llegada').reduce((s, m) => s + m.cantidad, 0);
  const consumo = (eventos || []).filter(e => e.mp === mpId && e.en > c.en).reduce((s, e) => s + e.cantidad, 0);
  // Lo que decía la cuenta justo antes de ese conteo (la diferencia es lo que se pierde sin anotar)
  let antes = null, k = -1; ms.slice(0, ini).forEach((m, i) => { if (m.tipo === 'conteo') k = i; });
  if (k >= 0) {
    const p = ms[k], ll = ms.slice(k + 1, ini).filter(m => m.tipo === 'llegada').reduce((s, m) => s + m.cantidad, 0);
    antes = p.cantidad + ll - (eventos || []).filter(e => e.mp === mpId && e.en > p.en && e.en <= c.en).reduce((s, e) => s + e.cantidad, 0);
  }
  return { contado: true, stock: c.cantidad + llegadas - consumo, conteo: c, llegadas, consumo, teoricoAlContar: antes };
}

// ── Proyección: lo que se espera consumir cada día desde "desde" (incluido), por materia prima ──
// Se llama desde MAÑANA: lo de hoy se descuenta del stock cuando lo marcan hecho (si no, se restaría dos veces).
// datos además: metas: { 'BOL_lunes': meta }, hoy (para el ritmo de Pastelería)
export function proyeccion(datos, desde, dias = 7, eventos = []) {
  const r = {}, sinId = {};
  const add = (f, res) => Object.entries(res.out).forEach(([mp, q]) => { const x = r[f] || (r[f] = {}); x[mp] = (x[mp] || 0) + q; });
  const fechas = []; for (let i = 0; i < dias; i++) fechas.push(M.sumarDias(desde, i));
  const ctxDe = area => ({ recetas: datos.recetas || [], mps: datos.mps || [], config: (datos.config || {})[area] || {} });
  // Panadería (y cualquier área con plan semanal): lo planificado de cada día
  Object.entries(datos.planes || {}).forEach(([id, plan]) => {
    const area = id.split('_')[0]; if (area === 'BOL' || !plan) return;
    const ctx = ctxDe(area), deOtra = rs => rs.area && rs.area !== area;
    fechas.filter(f => M.lunesDe(f) === plan.lunes).forEach(f => {
      const aj = ajustesDe(((datos.ajustes || {})[area]) || {}, f);
      M.planDelDia(plan, f, ctx.recetas).forEach(({ receta, unidades }) => add(f, bajar(receta, unidades, ctx, { ajustes: aj, parar: deOtra, sinId })));
    });
  });
  // Bollería: masas a elaborar (y su empaste) y lo que piden las metas de productos (repartido en la semana)
  const ctxB = ctxDe('BOL'), deOtraB = rs => rs.area && rs.area !== 'BOL';
  fechas.forEach(f => {
    const metaElab = (datos.metas || {})['BOL_' + M.sumarDias(M.lunesDe(f), 7)], idx = M.indiceDia(f);
    Object.entries((metaElab && metaElab.elaboracion) || {}).forEach(([masaId, ds]) => {
      const n = n0((ds || {})['d' + idx]), m = recetaPorId(ctxB, masaId); if (!(n > 0) || !m) return;
      add(f, bajar(m, n, ctxB, { parar: deOtraB, sinId }));
      const e = empGramosPorMasa(m.id, ctxB);
      if (e && e.receta) add(f, bajar(e.receta, cantDeGramos(e.receta, e.g * n), ctxB, { parar: deOtraB, sinId }));
    });
    const meta = (datos.metas || {})['BOL_' + M.lunesDe(f)];
    Object.entries((meta && meta.productos) || {}).forEach(([pid, piezas]) => {
      const p = recetaPorId(ctxB, pid); if (!p || !(n0(piezas) > 0)) return;
      add(f, bajar(p, n0(piezas) / 7, ctxB, { parar: rs => deOtraB(rs) || B.esMasaBase(rs) || B.esEmpaste(rs), sinId }));
    });
  });
  // Pastelería y Cafetería: al ritmo de los últimos 14 días (lo hecho, lo vendido y el café de la bitácora)
  const hoy = datos.hoy || desde, d14 = M.sumarDias(hoy, -14);
  const ritmo = {}; (eventos || []).filter(e => (e.area === 'PAS' || e.area === 'CAF') && e.origen !== 'Merma' && e.fecha >= d14 && e.fecha < hoy).forEach(e => { ritmo[e.mp] = (ritmo[e.mp] || 0) + e.cantidad / 14; });
  fechas.forEach(f => Object.entries(ritmo).forEach(([mp, q]) => { const x = r[f] || (r[f] = {}); x[mp] = (x[mp] || 0) + q; }));
  return { porDia: r, fechas, sinId };
}

// Estado de cada materia prima crítica: stock, mínimo, para cuántos días alcanza y desde qué día queda bajo el mínimo
export function estado(mp, cfg, st, proy) {
  const porDia = proy.fechas.map(f => n0((proy.porDia[f] || {})[mp.id]));
  const prom = porDia.reduce((s, x) => s + x, 0) / (porDia.length || 1);
  if (!st.contado) return { mp, cfg, st, prom, alcanza: null, bajoDesde: null, bajoAhora: false };
  let s = st.stock, bajoDesde = null;
  proy.fechas.forEach((f, i) => { s -= porDia[i]; if (bajoDesde === null && s < cfg.seguridad) bajoDesde = f; });
  return { mp, cfg, st, prom, alcanza: prom > 0 ? Math.max(0, st.stock) / prom : null, bajoDesde, bajoAhora: st.stock < cfg.seguridad, finalSemana: s };
}
