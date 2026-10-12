// ═══════════════════════════════════════════════
//  fën · Cocina — consumo de materias primas, stock de las bodegas y proyección (sin pantalla)  v0.16.0
//  La usa Sistema Fën (que lee las cuatro áreas; copia exacta en sistema-fen/cocina/).
//
//  v0.16.0 · BODEGAS SEPARADAS (decisión de Emmanuel, 12-oct): el stock es por BODEGA (lugar físico), no por área.
//    · Hoy: "PROD" (Producción: Panadería, Bollería y Pastelería, como siempre) y "CAF" (Cafetería).
//    · Qué área usa qué bodega: config/bodegas = { areas: { PAN: 'PROD', … }, nombres: { PROD: 'Producción', … } }
//      (opcional; vacío = PAN/BOL/PAS → PROD, CAF → CAF). Una bodega nueva (por ejemplo una por área con las harinas
//      compartidas) es solo cambiar ese mapa: los datos ya van por bodega.
//    · stockmp: la bodega PROD sigue en stockmp/{mpId} (lo de antes no se migra: todo lo existente es PROD);
//      las demás en stockmp/{BODEGA}__{mpId} (ej. stockmp/CAF__MP090), con { bodega, mp, critica, seguridad, envase, estado }.
//      Lo mismo conteosmp: conteosmp/{mpId} (PROD) y conteosmp/{BODEGA}__{mpId}. idStock() / deIdStock().
//    · La planilla (es_critica, stock_seguridad) solo vale para PROD: en otra bodega se marca en Sistema Fën.
//    · Cada evento de consumo lleva su bodega (la del área que consume): lo de Cafetería (caja, calibración diaria y
//      extra, derramado, merma) va a CAF; lo de Panadería, Bollería y Pastelería a PROD. Si una materia prima no es
//      crítica en esa bodega, simplemente no se sigue ahí.
//    · Cada llegada o conteo lleva su bodega (bodega: 'CAF'); sin el campo (todo lo anterior a v0.16.0) es PROD. Un
//      área solo mueve su bodega: lo anotado por un área con la bodega de otra no se cuenta (Administración, todas).
//
//  Antes (hasta v0.15.0) era una bodega común: un stock por materia prima.
//  · Consumo = lo HECHO en Cocina, bajado por las recetas (y sus sub recetas) hasta las materias primas:
//      Panadería y Pastelería: las recetas marcadas terminadas (hechos.rec_{id}), con la cantidad del día
//        (Pastelería: dias.cantidades; Panadería: el plan de ese día).
//      Bollería (bitácora): "Elaboré masas" = la masa base; "Hice empastes" = los empastes (gramos por empaste
//        de las recetas × cantidad); "Formé" = lo demás del producto (la masa y el empaste ya se contaron).
//        v0.14.0: los empastes se hacen la semana en que se laminan (no con la masa). Las "Elaboré" nuevas llevan
//        conEmpaste: false; las antiguas (sin esa marca) siguen contando su empaste, como cuando se anotaron.
//      Todas: la merma anotada de una materia prima (la de una receta ya se contó al hacerla).
//      Cafetería (v0.8.0): lo VENDIDO en la caja de productos con receta de Cafetería (datos.ventas, lo arma
//        Sistema Fën con los resúmenes de la caja) y los gramos de café de la bitácora de turno (calibraciones,
//        café botado y pruebas) descontados de la materia prima config/CAF.mp_cafe.
//      Cafetería (v0.15.0):
//        · CALIBRACIÓN DIARIA automática: cada día que Cafetería vende en la caja se cuentan N shots
//          (config/CAF.shots_calibracion_diarios; vacío = 6) × gramos por shot (config/CAF.gramos_por_shot; vacío = 14).
//          Si ese día la editaron (dias/CAF_{fecha}.calibracionDiaria = { shots, gPorShot, por, en, historial }),
//          vale lo editado (0 = no se calibró). Los días automáticos (sin edición) cuentan solo DESDE que se instaló
//          la v0.15.0: config/CAF.calibracion_desde si Administración lo puso; si no, la fecha que Cocina deja en
//          cada día de Cafetería (dias/CAF_{fecha}.calibracionDesde, la primera vez que la abre; se arrastra a los
//          días siguientes para que no se pierda aunque Sistema Fën lea solo los últimos 120 días). Nunca hacia atrás.
//          Días con venta: datos.diasVentaCaf (fechas) o, si no viene, las fechas de datos.ventas. Sin ningún dato
//          de ventas (Cocina, o la caja no se pudo leer): todos los días menos el domingo.
//          Las calibraciones anotadas a mano en la bitácora ("Calibración extra") se suman aparte, como siempre.
//        · DERRAMADO (merma con derramado: true, desde la bitácora de turno): la preparación se hizo y no se vendió,
//          así que se baja entera por su receta (café, leche, vaso…). La demás merma de recetas no se baja (ya se
//          contó al hacerla).
//    Una sub receta que es de OTRA área no se baja: la cuenta el área que la hace (la crema pastelera la
//    cuenta Pastelería cuando la termina, no Bollería al rellenar). En Pastelería tampoco se bajan sus propias
//    sub recetas: las marca terminadas aparte (la crema no se cuenta otra vez dentro de la torta).
//    El pie de masa madre no se cuenta.
//  · Stock = último conteo + llegadas − consumo (dias/{AREA}_{fecha}.bodega).
//    v0.11.0: el conteo vale como CIERRE DE SU DÍA (regla de Fën: se cuenta después de la producción). Lo hecho ese
//    día —antes o después de contar— ya está en el conteo; se descuenta lo de los días siguientes. Las llegadas van
//    por hora (lo que llega después de contar se suma).
//      bodega = { id: { tipo: 'llegada'|'conteo', mp, nombre, cantidad (g, ml o un), por, en, anulado } }
//  · Proyección (para avisar antes de quedarse corto): lo planificado de Panadería, las masas por elaborar y
//    las metas de Bollería; Pastelería y Cafetería al ritmo de los últimos 14 días.
//  · Qué materias primas llevan stock (críticas) y su mínimo: stockmp/{mpId} = { critica, seguridad }
//    (la pone Administración); si no hay, lo de la planilla (es_critica, stock_seguridad en kg, l o un).
//    v0.10.0: stockmp/{mpId}.envase = { nombre: 'saco', tamano: 25000 (g, ml o un) } → se cuenta y se recibe en sacos
//    (más lo suelto) y el stock también se muestra en sacos. Sin envase: en kg, litros o unidades.
// ═══════════════════════════════════════════════
import * as M from './modelo.js?v=0.11.0';
import * as B from './bolleria.js?v=0.11.0';
import * as R from './registros.js?v=0.11.0';

const n0 = v => M.num(v);

// ── Bodegas (v0.16.0) ──
export const BODEGA_PRINCIPAL = 'PROD';
export const BODEGAS_DEF = { PROD: 'Producción', CAF: 'Cafetería' };
export const AREA_BODEGA_DEF = { PAN: 'PROD', BOL: 'PROD', PAS: 'PROD', CAF: 'CAF' };
const esCodigo = v => typeof v === 'string' && /^[A-Z]{2,8}$/.test(v);
// El mapa vigente (config/bodegas, si existe, sobre lo de siempre): { areas: { AREA: BODEGA }, nombres: { BODEGA: nombre } }
export function mapaBodegas(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}, areas = { ...AREA_BODEGA_DEF }, nombres = { ...BODEGAS_DEF };
  Object.entries(c.nombres || {}).forEach(([b, n]) => { if (esCodigo(b) && typeof n === 'string' && n.trim()) nombres[b] = n.trim().slice(0, 40); });
  Object.entries(c.areas || {}).forEach(([a, b]) => { if (esCodigo(a) && esCodigo(b)) { areas[a] = b; if (!nombres[b]) nombres[b] = b; } });
  return { areas, nombres };
}
export const bodegaDe = (area, mapa) => ((mapa || mapaBodegas()).areas[area]) || BODEGA_PRINCIPAL;
export const nombreBodega = (b, mapa) => ((mapa || mapaBodegas()).nombres[b]) || b;
// Las bodegas en uso (las que tienen al menos un área), Producción primero
export const listaBodegas = mapa => { const m = mapa || mapaBodegas(); return [...new Set([BODEGA_PRINCIPAL, ...Object.values(m.areas)])]; };
export const areasDeBodega = (b, mapa) => Object.entries((mapa || mapaBodegas()).areas).filter(([, x]) => x === b).map(([a]) => a);
// Id del documento en stockmp y conteosmp: PROD = el id de la materia prima (como siempre); otra = "CAF__MP090"
export const idStock = (bodega, mpId) => !bodega || bodega === BODEGA_PRINCIPAL ? String(mpId) : bodega + '__' + mpId;
export function deIdStock(id) { const m = /^([A-Z]{2,8})__(.+)$/.exec(String(id || '')); return m ? { bodega: m[1], mp: m[2] } : { bodega: BODEGA_PRINCIPAL, mp: String(id || '') }; }
// stockmp de una bodega: { mpId: doc }
export function stockDe(stockmp, bodega) {
  const r = {}; Object.entries(stockmp || {}).forEach(([id, d]) => { const x = deIdStock(id); if (x.bodega === (bodega || BODEGA_PRINCIPAL)) r[x.mp] = d; });
  return r;
}
// Crítica y mínimo en una bodega: en PROD, si Sistema Fën no la configuró, vale la planilla; en las demás, solo Sistema Fën
export function controlEn(bodega, mp, sm) {
  if (!bodega || bodega === BODEGA_PRINCIPAL) return control(mp, sm);
  return control({ ...(mp || {}), critica: false, stockSeguridad: 0 }, sm);
}
// La bodega de una llegada o conteo: la anotada (sin el campo = PROD, lo anterior a v0.16.0). Un área solo mueve la suya:
// si anotó otra, no vale (null). Administración (ADM) puede cualquiera.
export function bodegaMov(area, a, mapa) {
  const b = esCodigo(a && a.bodega) ? a.bodega : BODEGA_PRINCIPAL;
  if (area === 'ADM') return b;
  return b === bodegaDe(area, mapa) || (!(a && a.bodega) && b === BODEGA_PRINCIPAL) ? b : null;
}
// Lo que hay "ahora" para la tablet: el último cálculo de Sistema Fën (stockmp.estado) o, si después se contó, ese conteo;
// más las llegadas posteriores que ve la tablet. → { hay, desde: 'calculo'|'conteo', en } o null (sin datos)
export function stockAhora(estado, conteo, llegadas) {
  const e = estado && estado.contado && typeof estado.stock === 'number' ? estado : null;
  const c = conteo && !conteo.anulado && typeof conteo.cantidad === 'number' && conteo.en ? conteo : null;
  let base = null;
  if (c && (!e || !e.en || String(c.en) > String(e.en))) base = { hay: c.cantidad, desde: 'conteo', en: String(c.en) };
  else if (e) base = { hay: e.stock, desde: 'calculo', en: String(e.en || '') };
  if (!base) return null;
  (llegadas || []).forEach(l => { if (l && !l.anulado && String(l.en || '') > base.en) base.hay += n0(l.cantidad); });
  return base;
}
// Alerta de stock bajo el mínimo (por bodega y materia prima): hay < mínimo (con mínimo > 0)
export const bajoMinimo = (hay, minimo) => typeof hay === 'number' && isFinite(hay) && n0(minimo) > 0 && hay < n0(minimo);
// Clave para no repetir el aviso por correo: uno por día, bodega y materia prima
export const claveAlerta = (fecha, bodega, mpId) => `${fecha}|${bodega || BODEGA_PRINCIPAL}|${mpId}`;

// ── Cafetería: calibración diaria (v0.15.0) ──
export const SHOTS_CALIBRACION = 6;   // si config/CAF.shots_calibracion_diarios está vacío
const esFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Shots por defecto (0 vale: "no calibramos")
export function shotsCalibracionDef(cfg) {
  const v = (cfg || {}).shots_calibracion_diarios;
  if (typeof v === 'number' && isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) return Number(v);
  return SHOTS_CALIBRACION;
}
export const gPorShotCaf = cfg => n0((cfg || {}).gramos_por_shot) || R.GRAMOS_SHOT;
// Desde qué día se cuentan los días automáticos: la configuración o la primera marca que dejó Cocina (null: todavía no)
export function inicioCalibracion(cfg, diasCaf) {
  if (esFecha((cfg || {}).calibracion_desde)) return cfg.calibracion_desde;
  return Object.values(diasCaf || {}).map(d => d && d.calibracionDesde).filter(esFecha).sort()[0] || null;
}
// Lo editado de un día ({ shots, gPorShot, por, en, historial }) o null
export function calibracionEditada(dia) {
  const c = dia && dia.calibracionDiaria;
  return c && typeof c.shots === 'number' && isFinite(c.shots) && c.shots >= 0 ? c : null;
}
// La calibración de un día: { fecha, shots, gPorShot, gramos, auto, editada }
export function calibracionDelDia(fecha, dia, cfg) {
  const e = calibracionEditada(dia), gps = e && n0(e.gPorShot) > 0 ? n0(e.gPorShot) : gPorShotCaf(cfg);
  const shots = e ? Math.round(e.shots) : shotsCalibracionDef(cfg);
  return { fecha, shots, gPorShot: gps, gramos: Math.round(shots * gps * 10) / 10, auto: !e, editada: e, en: e && typeof e.en === 'string' ? e.en : null };
}
// Días de Cafetería con calibración en [desde, hasta] (nunca después de hoy): los editados siempre; los automáticos
// desde el inicio y solo los días con venta (o, sin datos de ventas, de lunes a sábado)
export function calibracionesDiarias(datos, desde = '0000-00-00', hasta = '9999-12-31') {
  const cfg = (datos.config || {}).CAF || {}, dias = (datos.dias || {}).CAF || {};
  const hoy = esFecha(datos.hoy) ? datos.hoy : M.hoyTxt(), fin = hasta < hoy ? hasta : hoy;
  const out = [];
  Object.entries(dias).forEach(([f, d]) => { if (f >= desde && f <= fin && calibracionEditada(d)) out.push(calibracionDelDia(f, d, cfg)); });
  const ini = inicioCalibracion(cfg, dias);
  if (ini) {
    const conVenta = new Set([...(datos.diasVentaCaf || []), ...(datos.ventas || []).filter(v => v && n0(v.cantidad) > 0).map(v => v.fecha)].filter(esFecha));
    const abierto = f => conVenta.size ? conVenta.has(f) : M.indiceDia(f) !== 6;
    let f = [ini, desde, esFecha(datos.desde) ? datos.desde : ''].sort().pop();
    for (let i = 0; f <= fin && i < 800; i++, f = M.sumarDias(f, 1))
      if (!calibracionEditada(dias[f]) && abierto(f)) out.push(calibracionDelDia(f, dias[f], cfg));
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
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
    envase: tiene && sm.envase && String(sm.envase.nombre || '').trim() && n0(sm.envase.tamano) > 0 ? { nombre: singular(sm.envase.nombre).slice(0, 20), tamano: n0(sm.envase.tamano) } : null
  };
}
// El envase en singular, aunque lo hayan escrito en plural (sacos → saco, bidones → bidón, barriles → barril)
export function singular(nombre) {
  const t = String(nombre || '').trim().toLowerCase();
  if (/ones$/.test(t)) return t.replace(/ones$/, 'ón');
  if (/[lrndzj]es$/.test(t)) return t.slice(0, -2);            // barriles → barril
  if (/[aeiouáéíóú]s$/.test(t)) return t.slice(0, -1);         // sacos → saco, paquetes → paquete
  return t;
}
// Singular o plural según la cantidad (saco / sacos, caja / cajas, bidón / bidones, barril / barriles)
export function envases(nombre, n) {
  const s = singular(nombre);
  if (Math.abs(n0(n)) === 1) return s;
  if (/ón$/.test(s)) return s.replace(/ón$/, 'ones');
  return /[aeiouáéíóú]$/.test(s) ? s + 's' : s + 'es';
}
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
// Gramos de empaste que lleva 1 masa (promedio de sus productos) y la receta del empaste: { g, receta } o null
export const empGramosPorMasa = (masaId, ctx) => {
  const ps = B.productos(ctx.recetas, ctx).filter(p => p.masa && p.masa.id === masaId && p.empasteG > 0);
  return ps.length ? { g: ps.reduce((s, p) => s + p.empasteG / p.masas, 0) / ps.length, receta: ps[0].empaste && ps[0].empaste.ingredientes && ps[0].empaste.ingredientes.length ? ps[0].empaste : null } : null;
};

// ── Lo consumido (hecho) ──
// datos: { recetas, mps, config: { AREA: cfg }, ajustes: { AREA: { id: ajuste } }, dias: { AREA: { fecha: doc } }, planes: { 'AREA_lunes': plan } }
// → [{ area, bodega, fecha, en, mp, cantidad, origen }] (sin anuladas). v0.16.0: bodega = la del área (config/bodegas)
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
          // v0.14.0: "Hice empastes" { masa, n } → n empastes de esa masa (gramos por empaste × n, por la receta del empaste)
          if (a.tipo === 'empaste') {
            const m = recetaPorId(ctx, a.masa), e = n0(a.n) > 0 ? empGramosPorMasa(a.masa, ctx) : null;
            if (e && e.receta) agregar(area, fecha, a.en, 'Empastes de ' + (m ? m.nombre : a.masa), bajar(e.receta, cantDeGramos(e.receta, e.g * n0(a.n), aj), ctx, { ...op, parar: deOtra }));
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
      // v0.15.0: Cafetería, lo derramado (se hizo y no se vendió): la preparación entera, por su receta
      if (area === 'CAF') Object.values(d.merma || {}).forEach(a => {
        if (!a || a.anulado || !a.derramado || a.tipo !== 'receta' || !(n0(a.cantidad) > 0)) return;
        const r = recetaPorId(ctx, a.item); if (r) agregar(area, fecha, a.en, r.nombre + ' (derramado)', bajar(r, n0(a.cantidad), ctx, { ...op, parar: deOtra }));
      });
    });
  });
  // v0.15.0: Cafetería, la calibración diaria (automática o editada), descontada del café de la bodega
  const mpCafeC = ((datos.config || {}).CAF || {}).mp_cafe;
  if (mpCafeC) calibracionesDiarias(datos, desde, hasta).forEach(c => { if (c.gramos > 0) ev.push({ area: 'CAF', fecha: c.fecha, en: enDe(c.fecha, c.en), mp: mpCafeC, cantidad: c.gramos, origen: 'Calibración diaria' }); });
  // Cafetería: lo vendido (ventas: [{ fecha, en, receta, cantidad }]); solo recetas de Cafetería (lo demás lo cuenta su área)
  const ctxC = ctxDe('CAF');
  (datos.ventas || []).forEach(v => {
    if (!v || v.fecha < desde || v.fecha > hasta || !(n0(v.cantidad) > 0)) return;
    const r = recetaPorId(ctxC, v.receta); if (!r || r.area !== 'CAF') return;
    const aj = ajustesDe(((datos.ajustes || {}).CAF) || {}, v.fecha);
    agregar('CAF', v.fecha, v.en, r.nombre + ' (venta)', bajar(r, n0(v.cantidad), ctxC, { ajustes: aj, parar: rs => rs.area && rs.area !== 'CAF', sinId }));
  });
  const mapa = mapaBodegas((datos.config || {}).bodegas);
  ev.forEach(e => { e.bodega = bodegaDe(e.area, mapa); });
  return { eventos: ev.sort((a, b) => a.en.localeCompare(b.en)), sinId };
}

// Suma por materia prima y área: { mp: { total, porArea: { AREA: q } } }
export function porMp(eventos) {
  const r = {};
  (eventos || []).forEach(e => { const x = r[e.mp] || (r[e.mp] = { total: 0, porArea: {} }); x.total += e.cantidad; x.porArea[e.area] = (x.porArea[e.area] || 0) + e.cantidad; });
  return r;
}

// ── Bodega: llegadas y conteos (de todas las áreas y de Administración) ──
// v0.16.0: cada uno con su bodega (bodegaMov); los de un área con la bodega de otra no se cuentan
export function movimientos(dias, mapa) {
  const out = [], m = mapa || mapaBodegas();
  Object.entries(dias || {}).forEach(([area, ds]) => Object.entries(ds || {}).forEach(([fecha, d]) =>
    Object.entries((d && d.bodega) || {}).forEach(([id, a]) => {
      if (!a || a.anulado || !a.mp) return;
      const bodega = bodegaMov(area, a, m); if (!bodega) return;
      out.push({ ...a, id, area, bodega, fecha, en: enDe(fecha, a.en), cantidad: n0(a.cantidad) });
    })));
  return out.sort((a, b) => a.en.localeCompare(b.en));
}
// Stock de una materia prima: el último conteo + llegadas − consumo posteriores (null si nunca se contó)
// v0.16.0: bodega (opcional) = solo los movimientos y el consumo de esa bodega
export function stock(mpId, movs, eventos, bodega) {
  if (bodega) { movs = (movs || []).filter(m => (m.bodega || BODEGA_PRINCIPAL) === bodega); eventos = (eventos || []).filter(e => (e.bodega || BODEGA_PRINCIPAL) === bodega); }
  const ms = (movs || []).filter(m => m.mp === mpId);
  let ini = -1; ms.forEach((m, i) => { if (m.tipo === 'conteo') ini = i; });
  if (ini < 0) return { contado: false, stock: null, conteo: null, llegadas: 0, consumo: 0 };
  const c = ms[ini], llegadas = ms.slice(ini + 1).filter(m => m.tipo === 'llegada').reduce((s, m) => s + m.cantidad, 0);
  const consumo = (eventos || []).filter(e => e.mp === mpId && e.fecha > c.fecha).reduce((s, e) => s + e.cantidad, 0);   // desde el día siguiente
  // Lo que decía la cuenta justo antes de ese conteo (la diferencia es lo que se pierde sin anotar)
  let antes = null, k = -1; ms.slice(0, ini).forEach((m, i) => { if (m.tipo === 'conteo') k = i; });
  if (k >= 0) {
    const p = ms[k], ll = ms.slice(k + 1, ini).filter(m => m.tipo === 'llegada').reduce((s, m) => s + m.cantidad, 0);
    antes = p.cantidad + ll - (eventos || []).filter(e => e.mp === mpId && e.fecha > p.fecha && e.fecha <= c.fecha).reduce((s, e) => s + e.cantidad, 0);
  }
  return { contado: true, stock: c.cantidad + llegadas - consumo, conteo: c, llegadas, consumo, teoricoAlContar: antes };
}

// ── Proyección: lo que se espera consumir cada día desde "desde" (incluido), por materia prima ──
// Se llama desde MAÑANA: lo de hoy se descuenta del stock cuando lo marcan hecho (si no, se restaría dos veces).
// datos además: metas: { 'BOL_lunes': meta }, hoy (para el ritmo de Pastelería)
// v0.16.0: bodega (opcional) = solo las áreas de esa bodega
export function proyeccion(datos, desde, dias = 7, eventos = [], bodega = null) {
  const r = {}, sinId = {}, mapa = mapaBodegas((datos.config || {}).bodegas), va = area => !bodega || bodegaDe(area, mapa) === bodega;
  const add = (f, res) => Object.entries(res.out).forEach(([mp, q]) => { const x = r[f] || (r[f] = {}); x[mp] = (x[mp] || 0) + q; });
  const fechas = []; for (let i = 0; i < dias; i++) fechas.push(M.sumarDias(desde, i));
  const ctxDe = area => ({ recetas: datos.recetas || [], mps: datos.mps || [], config: (datos.config || {})[area] || {} });
  // Panadería (y cualquier área con plan semanal): lo planificado de cada día
  Object.entries(datos.planes || {}).forEach(([id, plan]) => {
    const area = id.split('_')[0]; if (area === 'BOL' || !plan || !va(area)) return;
    const ctx = ctxDe(area), deOtra = rs => rs.area && rs.area !== area;
    fechas.filter(f => M.lunesDe(f) === plan.lunes).forEach(f => {
      const aj = ajustesDe(((datos.ajustes || {})[area]) || {}, f);
      M.planDelDia(plan, f, ctx.recetas).forEach(({ receta, unidades }) => add(f, bajar(receta, unidades, ctx, { ajustes: aj, parar: deOtra, sinId })));
    });
  });
  // Bollería: masas a elaborar y lo que piden las metas de productos (repartido en la semana). v0.14.0: el empaste
  // va con los productos de la meta (se hace la semana en que se lamina), ya no con la masa
  const ctxB = ctxDe('BOL'), deOtraB = rs => rs.area && rs.area !== 'BOL';
  if (va('BOL')) fechas.forEach(f => {
    const metaElab = (datos.metas || {})['BOL_' + M.sumarDias(M.lunesDe(f), 7)], idx = M.indiceDia(f);
    Object.entries((metaElab && metaElab.elaboracion) || {}).forEach(([masaId, ds]) => {
      const n = n0((ds || {})['d' + idx]), m = recetaPorId(ctxB, masaId); if (!(n > 0) || !m) return;
      add(f, bajar(m, n, ctxB, { parar: deOtraB, sinId }));
    });
    const meta = (datos.metas || {})['BOL_' + M.lunesDe(f)];
    Object.entries((meta && meta.productos) || {}).forEach(([pid, piezas]) => {
      const p = recetaPorId(ctxB, pid); if (!p || !(n0(piezas) > 0)) return;
      add(f, bajar(p, n0(piezas) / 7, ctxB, { parar: rs => deOtraB(rs) || B.esMasaBase(rs), sinId }));
    });
  });
  // Pastelería y Cafetería: al ritmo de los últimos 14 días (lo hecho, lo vendido y el café de la bitácora)
  const hoy = datos.hoy || desde, d14 = M.sumarDias(hoy, -14);
  const ritmo = {}; (eventos || []).filter(e => (e.area === 'PAS' || e.area === 'CAF') && va(e.area) && e.origen !== 'Merma' && e.fecha >= d14 && e.fecha < hoy).forEach(e => { ritmo[e.mp] = (ritmo[e.mp] || 0) + e.cantidad / 14; });
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
