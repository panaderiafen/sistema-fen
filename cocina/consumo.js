// ═══════════════════════════════════════════════
//  fën · Cocina — consumo de materias primas, stock de las bodegas y proyección (sin pantalla)  v0.17.4
//  La usa Sistema Fën (que lee las cuatro áreas; copia exacta en sistema-fen/cocina/).
//  v0.17.4 · ajustesDe usa modelo.js → ajustesDelDia (incluye el ajuste de sábado): bodega, proyección y Plan de Panadería
//    calculan con el mismo ajuste que ven las jefas en Cocina.
//
//  v0.17.0 · BODEGAS POR ÁREA RESPONSABLE (decisión de Emmanuel, 14-oct): cuatro bodegas, PAN, BOL, PAS y CAF.
//    · Cada materia prima crítica de producción tiene UNA bodega responsable (la harina → PAN). Su stock es uno solo y
//      baja con lo que consume CUALQUIER área (la harina que usan Bollería y Pastelería baja la de Panadería).
//      Puede además ser crítica en CAF (otro stock físico, como en la v0.16.0).
//    · Ruta del consumo (bodegaConsumo): Cafetería → CAF; Panadería, Bollería y Pastelería → la bodega de producción
//      donde esa materia prima es crítica. Si es crítica en más de una de producción (aviso en Sistema Fën): la del área
//      que consume si la tiene; si no, la primera (la responsable).
//    · Se activa al confirmar en Sistema Fën ("Asignar responsables"): config/bodegas = { modo: 'responsable',
//      areas: { PAN: 'PAN', BOL: 'BOL', PAS: 'PAS', CAF: 'CAF' }, responsables: { mpId: 'PAN' | 'BOL' | 'PAS' },
//      confirmado: { por, en (ISO) }, historial: [...] }. Sin confirmar = como la v0.16.0 (PROD para PAN/BOL/PAS).
//    · DATOS COMPATIBLES (nada se mueve ni se borra): el stock de producción de cada materia prima sigue en
//      stockmp/{mpId} y conteosmp/{mpId}; su bodega es la responsable (config/bodegas.responsables; sin ella, PAN).
//      Cambiar la responsable no copia nada: el mismo documento, los mismos conteos y llegadas (continuidad).
//      Si se marca crítica en OTRA bodega de producción va en stockmp/{BODEGA}__{mpId} (como CAF__).
//    · Llegadas y conteos: las de antes (bodega 'PROD' o sin campo) van al stock de siempre (stockmp/{mpId}); las nuevas
//      llevan la bodega del área ('PAN', 'BOL'…). Después de confirmar, un área solo mueve lo suyo (bodegaMov).
//    · Avisos (areasAviso): el correo va a las jefas del área RESPONSABLE (no a las de otras áreas de esa bodega).
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
import * as M from './modelo.js?v=0.17.4';
import * as B from './bolleria.js?v=0.17.4';
import * as R from './registros.js?v=0.17.4';

const n0 = v => M.num(v);

// ── Bodegas (v0.16.0; v0.17.0: por área responsable) ──
export const BODEGA_PRINCIPAL = 'PROD';
export const BODEGAS_DEF = { PROD: 'Producción', CAF: 'Cafetería' };
export const AREA_BODEGA_DEF = { PAN: 'PROD', BOL: 'PROD', PAS: 'PROD', CAF: 'CAF' };
// v0.17.0
export const MODO_RESP = 'responsable';
export const AREAS_PROD = ['PAN', 'BOL', 'PAS'];
export const AREA_BODEGA_RESP = { PAN: 'PAN', BOL: 'BOL', PAS: 'PAS', CAF: 'CAF' };
export const BODEGAS_RESP = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería' };
const esCodigo = v => typeof v === 'string' && /^[A-Z]{2,8}$/.test(v);
const esIdMp = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(v) && !/__/.test(v);
// El mapa vigente (config/bodegas, si existe, sobre lo de siempre):
// { areas: { AREA: BODEGA }, nombres: { BODEGA: nombre }, modo: 'compartida' | 'responsable', responsables: { mpId: BODEGA }, confirmadoEn }
export function mapaBodegas(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}, resp = c.modo === MODO_RESP;
  const areas = { ...(resp ? AREA_BODEGA_RESP : AREA_BODEGA_DEF) }, nombres = { ...BODEGAS_DEF, ...(resp ? BODEGAS_RESP : {}) };
  Object.entries(c.nombres || {}).forEach(([b, n]) => { if (esCodigo(b) && typeof n === 'string' && n.trim()) nombres[b] = n.trim().slice(0, 40); });
  Object.entries(c.areas || {}).forEach(([a, b]) => { if (esCodigo(a) && esCodigo(b)) { areas[a] = b; if (!nombres[b]) nombres[b] = b; } });
  const m = { areas, nombres, modo: resp ? MODO_RESP : 'compartida', responsables: {}, confirmadoEn: '' };
  if (resp) {
    const prod = bodegasProd(m);
    Object.entries(c.responsables || {}).forEach(([mp, b]) => { if (esIdMp(mp) && prod.includes(b)) m.responsables[mp] = b; });
    const en = c.confirmado && c.confirmado.en;
    m.confirmadoEn = typeof en === 'string' ? en : en && typeof en.toDate === 'function' ? en.toDate().toISOString() : '';
  }
  return m;
}
export const esResponsable = mapa => !!mapa && mapa.modo === MODO_RESP;
export const bodegaDe = (area, mapa) => ((mapa || mapaBodegas()).areas[area]) || BODEGA_PRINCIPAL;
export const nombreBodega = (b, mapa) => ((mapa || mapaBodegas()).nombres[b]) || b;
// Las bodegas de producción (las de Panadería, Bollería y Pastelería): ['PROD'] sin confirmar; ['PAN', 'BOL', 'PAS'] con responsables
export const bodegasProd = mapa => { const m = mapa || mapaBodegas(); return [...new Set(AREAS_PROD.map(a => m.areas[a] || BODEGA_PRINCIPAL))]; };
export const esProduccion = (b, mapa) => bodegasProd(mapa).includes(b);
// Las bodegas en uso (las que tienen al menos un área). Sin confirmar: Producción primero (como v0.16.0); con responsables: PAN, BOL, PAS, CAF
export const listaBodegas = mapa => {
  const m = mapa || mapaBodegas();
  return esResponsable(m) ? [...new Set([...bodegasProd(m), ...Object.values(m.areas)])] : [...new Set([BODEGA_PRINCIPAL, ...Object.values(m.areas)])];
};
export const areasDeBodega = (b, mapa) => Object.entries((mapa || mapaBodegas()).areas).filter(([, x]) => x === b).map(([a]) => a);
// v0.17.0: a quién avisar (jefas) de una bodega. Con responsables: solo el área responsable (la del mismo código o, si no hay,
// la primera área de esa bodega), nunca las otras áreas mapeadas a la misma bodega. Sin confirmar: todas las áreas de la bodega.
export function areasAviso(b, mapa) {
  const m = mapa || mapaBodegas(), todas = areasDeBodega(b, m);
  if (!esResponsable(m)) return todas;
  return todas.includes(b) ? [b] : todas.slice(0, 1);
}
// v0.17.0: la bodega RESPONSABLE de una materia prima (la que lleva su stock de producción en stockmp/{mpId}).
// Sin confirmar: PROD. Con responsables: la elegida en Sistema Fën; si no se eligió, la primera de producción (PAN).
export const principalDe = (mpId, mapa) => { const m = mapa || mapaBodegas(); return esResponsable(m) ? (m.responsables[mpId] || bodegasProd(m)[0]) : BODEGA_PRINCIPAL; };
export const tieneResponsable = (mpId, mapa) => !!(mapa && esResponsable(mapa) && mapa.responsables[mpId]);
// Id del documento en stockmp y conteosmp: PROD = el id de la materia prima (como siempre); otra = "CAF__MP090"
export const idStock = (bodega, mpId) => !bodega || bodega === BODEGA_PRINCIPAL ? String(mpId) : bodega + '__' + mpId;
// v0.17.0: el id donde vive el stock de una materia prima en una bodega: en su responsable, {mpId} (el de siempre); en otra, {BODEGA}__{mpId}
export const idStockEn = (bodega, mpId, mapa) => !bodega || bodega === principalDe(mpId, mapa) ? String(mpId) : bodega + '__' + mpId;
export function deIdStock(id) { const m = /^([A-Z]{2,8})__(.+)$/.exec(String(id || '')); return m ? { bodega: m[1], mp: m[2] } : { bodega: BODEGA_PRINCIPAL, mp: String(id || '') }; }
// v0.17.0: la bodega (lógica) de un documento de stockmp / conteosmp: {mpId} = la responsable; {BODEGA}__{mpId} = esa
export function bodegaDocId(id, mapa) {
  const x = deIdStock(id);
  if (!/__/.test(String(id || ''))) return { bodega: principalDe(x.mp, mapa), mp: x.mp, principal: true };
  return { ...x, principal: false };
}
// stockmp de una bodega: { mpId: doc }. v0.17.0: con mapa (responsables), {mpId} va a su responsable; un {BODEGA}__{mpId}
// que repite la responsable no cuenta (manda el de siempre)
export function stockDe(stockmp, bodega, mapa) {
  const r = {}, b = bodega || BODEGA_PRINCIPAL;
  Object.entries(stockmp || {}).forEach(([id, d]) => {
    const x = bodegaDocId(id, mapa); if (x.bodega !== b) return;
    if (!x.principal && esResponsable(mapa) && principalDe(x.mp, mapa) === b) return;
    if (x.principal || !r[x.mp]) r[x.mp] = d;
  });
  return r;
}
// Crítica y mínimo en una bodega: en la responsable (PROD sin confirmar), si Sistema Fën no la configuró, vale la planilla;
// en las demás, solo Sistema Fën
export function controlEn(bodega, mp, sm, mapa) {
  if (!bodega || bodega === principalDe(mp && mp.id, mapa)) return control(mp, sm);
  return control({ ...(mp || {}), critica: false, stockSeguridad: 0 }, sm);
}
// v0.17.0: todas las críticas de todas las bodegas: [{ bodega, mp, cfg, docId, sm }] (activas, sin sub recetas)
export function puestos(mps, stockmp, mapa) {
  const m = mapa || mapaBodegas(), out = [];
  const activas = (mps || []).filter(x => x && (x.estado || 'activa') === 'activa' && x.tipo !== 'sub_receta');
  listaBodegas(m).forEach(b => {
    const docs = stockDe(stockmp, b, m);
    activas.forEach(x => { const cfg = controlEn(b, x, docs[x.id], m); if (cfg.critica) out.push({ bodega: b, mp: x, cfg, docId: idStockEn(b, x.id, m), sm: docs[x.id] || null }); });
  });
  return out;
}
// v0.17.0: por materia prima, las bodegas de producción donde es crítica (la responsable primero): { mpId: ['PAN', 'BOL'] }
export function rutas(ps, mapa) {
  const m = mapa || mapaBodegas(), r = {}, orden = bodegasProd(m);
  (ps || []).filter(p => orden.includes(p.bodega)).forEach(p => { const id = p.mp.id || p.mp; (r[id] || (r[id] = [])).push(p.bodega); });
  Object.entries(r).forEach(([id, l]) => { const pr = principalDe(id, m); r[id] = [...new Set(l)].sort((a, b) => (b === pr) - (a === pr) || orden.indexOf(a) - orden.indexOf(b)); });
  return r;
}
// v0.17.0: las que son críticas en más de una bodega de producción (aviso en Sistema Fën): [{ mp, bodegas }]
export const repetidasProd = (ps, mapa) => Object.entries(rutas(ps, mapa)).filter(([, l]) => l.length > 1).map(([mp, bodegas]) => ({ mp, bodegas }));
// v0.17.0: a qué bodega va lo que consume un área de una materia prima
export function bodegaConsumo(area, mpId, rts, mapa) {
  const m = mapa || mapaBodegas(), propia = bodegaDe(area, m);
  if (!esResponsable(m) || !AREAS_PROD.includes(area) || !esProduccion(propia, m)) return propia;
  const l = (rts || {})[mpId] || [];
  if (!l.length) return principalDe(mpId, m);
  return l.length > 1 && l.includes(propia) ? propia : l[0];
}
// v0.17.0: las rutas de unos datos (con datos.stockmp = { id: doc }); se calculan una vez por objeto de datos
const rutasCache = new WeakMap();
function rutasDatos(datos, mapa) {
  if (!esResponsable(mapa)) return {};
  if (datos && typeof datos === 'object' && rutasCache.has(datos)) return rutasCache.get(datos);
  const r = rutas(puestos(datos.mps, datos.stockmp || {}, mapa), mapa);
  if (datos && typeof datos === 'object') rutasCache.set(datos, r);
  return r;
}
// La bodega de una llegada o conteo: la anotada (sin el campo = PROD, lo anterior a v0.16.0). Un área solo mueve la suya:
// si anotó otra, no vale (null). Administración (ADM) puede cualquiera.
// v0.17.0 (con responsables): 'PROD' o sin campo = el stock de siempre (stockmp/{mpId}) → su responsable. Lo anterior a la
// confirmación vale siempre (historia); una tablet que siga anotando 'PROD' después, solo si su área es la responsable.
// Lo nuevo lleva la bodega del área ('PAN', 'BOL'…) y solo vale si es la del área. Además lleva el documento de stock
// (a.stock = '{mpId}' o '{BODEGA}__{mpId}'): si después cambia la responsable, la anotación sigue con su stock (continuidad).
export function destinoMov(area, a, mapa) {
  const m = mapa || mapaBodegas(), cod = esCodigo(a && a.bodega) ? a.bodega : BODEGA_PRINCIPAL, mp = a && a.mp;
  if (!esResponsable(m)) {
    const b = area === 'ADM' || cod === bodegaDe(area, m) || (!(a && a.bodega) && cod === BODEGA_PRINCIPAL) ? cod : null;
    return b ? { bodega: b, docId: idStock(b, mp) } : null;
  }
  const legado = cod === BODEGA_PRINCIPAL;
  const doc = a && typeof a.stock === 'string' && (a.stock === String(mp) || a.stock === cod + '__' + mp) ? a.stock : null;
  const docId = legado ? String(mp) : doc || idStockEn(cod, mp, m), destino = bodegaDocId(docId, m).bodega;
  if (area === 'ADM') return { bodega: destino, docId };
  if (legado) {
    if (!(a && a.bodega)) return { bodega: destino, docId };              // antes de la v0.16.0 (bodega común)
    if (!AREAS_PROD.includes(area)) return null;
    return !m.confirmadoEn || String((a && a.en) || '') < m.confirmadoEn || destino === bodegaDe(area, m) ? { bodega: destino, docId } : null;
  }
  return cod === bodegaDe(area, m) ? { bodega: destino, docId } : null;
}
export const bodegaMov = (area, a, mapa) => { const d = destinoMov(area, a, mapa); return d ? d.bodega : null; };
// v0.17.0: propuesta de responsable por uso (pantalla "Asignar responsables" de Sistema Fën)
// uso: { PAN: g, BOL: g, PAS: g }. Las harinas (nombre que empieza con "harina") → PAN (se comparten); si no, el área que
// más la usa; sin uso, PAN. → { propuesta, pct: { PAN, BOL, PAS }, motivo: 'harina' | 'uso' | 'sin uso' }
export function proponerResponsable(mp, uso) {
  const u = uso || {}, tot = AREAS_PROD.reduce((s, a) => s + Math.max(0, n0(u[a])), 0);
  const pct = Object.fromEntries(AREAS_PROD.map(a => [a, tot > 0 ? Math.round(Math.max(0, n0(u[a])) * 100 / tot) : 0]));
  if (/^harina/.test(norm(mp && mp.nombre))) return { propuesta: 'PAN', pct, motivo: 'harina' };
  if (!(tot > 0)) return { propuesta: 'PAN', pct, motivo: 'sin uso' };
  const mx = AREAS_PROD.reduce((x, a) => (n0(u[a]) > n0(u[x]) ? a : x), 'PAN');
  return { propuesta: mx, pct, motivo: 'uso' };
}
// Uso por área de producción de cada materia prima: lo consumido (eventos) o, si no hay, las recetas (un lote de cada una)
export function usoPorArea(eventos, datos) {
  const ev = {}, rec = {};
  (eventos || []).forEach(e => { if (!AREAS_PROD.includes(e.area)) return; const x = ev[e.mp] || (ev[e.mp] = {}); x[e.area] = (x[e.area] || 0) + n0(e.cantidad); });
  const d = datos || {}, ctx = { recetas: d.recetas || [], mps: d.mps || [], config: {} };
  (d.recetas || []).filter(r => r && AREAS_PROD.includes(r.area) && r.estado !== 'anulada').forEach(r => {
    let res; try { res = bajar(r, M.porciones(r), { ...ctx, config: (d.config || {})[r.area] || {} }, { parar: rs => rs.area && rs.area !== r.area }); } catch (e) { return; }
    Object.entries(res.out).forEach(([mp, q]) => { const x = rec[mp] || (rec[mp] = {}); x[r.area] = (x[r.area] || 0) + q; });
  });
  return { eventos: ev, recetas: rec, de: mp => { const e = ev[mp]; return e && Object.values(e).some(v => v > 0) ? { uso: e, fuente: 'consumo' } : rec[mp] ? { uso: rec[mp], fuente: 'recetas' } : { uso: {}, fuente: '' }; } };
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

// Ajuste que vale para cada receta un día. v0.17.4: la misma regla que Cocina (modelo.js → ajusteDelDia):
// "solo este día" > ajuste de sábado (los sábados) > el último período que cubre el día
export function ajustesDe(ajustes, fecha) { return M.ajustesDelDia(ajustes, fecha); }

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
// v0.17.0: con responsables, bodega = bodegaConsumo (la de producción donde esa materia prima es crítica); necesita
// datos.stockmp = { id: doc } (si no viene, solo vale lo crítico de la planilla)
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
  const mapa = mapaBodegas((datos.config || {}).bodegas), rts = rutasDatos(datos, mapa);
  ev.forEach(e => { e.bodega = bodegaConsumo(e.area, e.mp, rts, mapa); });
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
// v0.17.0: con responsables, la bodega lógica (PAN, BOL…) y docId (el documento de stock: {mpId} en la responsable)
export function movimientos(dias, mapa) {
  const out = [], m = mapa || mapaBodegas();
  Object.entries(dias || {}).forEach(([area, ds]) => Object.entries(ds || {}).forEach(([fecha, d]) =>
    Object.entries((d && d.bodega) || {}).forEach(([id, a]) => {
      if (!a || a.anulado || !a.mp) return;
      const d = destinoMov(area, a, m); if (!d) return;
      out.push({ ...a, id, area, bodega: d.bodega, docId: d.docId, fecha, en: enDe(fecha, a.en), cantidad: n0(a.cantidad) });
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
// v0.17.0: con responsables, lo de cada área va a la bodega de cada materia prima (bodegaConsumo), como el consumo
export function proyeccion(datos, desde, dias = 7, eventos = [], bodega = null) {
  const r = {}, sinId = {}, mapa = mapaBodegas((datos.config || {}).bodegas), rts = rutasDatos(datos, mapa);
  const resp = esResponsable(mapa), va = area => !bodega || resp || bodegaDe(area, mapa) === bodega;
  const vaMp = (area, mp) => !bodega || bodegaConsumo(area, mp, rts, mapa) === bodega;
  const add = (f, res, area) => Object.entries(res.out).forEach(([mp, q]) => { if (!vaMp(area, mp)) return; const x = r[f] || (r[f] = {}); x[mp] = (x[mp] || 0) + q; });
  const fechas = []; for (let i = 0; i < dias; i++) fechas.push(M.sumarDias(desde, i));
  const ctxDe = area => ({ recetas: datos.recetas || [], mps: datos.mps || [], config: (datos.config || {})[area] || {} });
  // Panadería (y cualquier área con plan semanal): lo planificado de cada día
  Object.entries(datos.planes || {}).forEach(([id, plan]) => {
    const area = id.split('_')[0]; if (area === 'BOL' || !plan || !va(area)) return;
    const ctx = ctxDe(area), deOtra = rs => rs.area && rs.area !== area;
    fechas.filter(f => M.lunesDe(f) === plan.lunes).forEach(f => {
      const aj = ajustesDe(((datos.ajustes || {})[area]) || {}, f);
      M.planDelDia(plan, f, ctx.recetas).forEach(({ receta, unidades }) => add(f, bajar(receta, unidades, ctx, { ajustes: aj, parar: deOtra, sinId }), area));
    });
  });
  // Bollería: masas a elaborar y lo que piden las metas de productos (repartido en la semana). v0.14.0: el empaste
  // va con los productos de la meta (se hace la semana en que se lamina), ya no con la masa
  const ctxB = ctxDe('BOL'), deOtraB = rs => rs.area && rs.area !== 'BOL';
  if (va('BOL')) fechas.forEach(f => {
    const metaElab = (datos.metas || {})['BOL_' + M.sumarDias(M.lunesDe(f), 7)], idx = M.indiceDia(f);
    Object.entries((metaElab && metaElab.elaboracion) || {}).forEach(([masaId, ds]) => {
      const n = n0((ds || {})['d' + idx]), m = recetaPorId(ctxB, masaId); if (!(n > 0) || !m) return;
      add(f, bajar(m, n, ctxB, { parar: deOtraB, sinId }), 'BOL');
    });
    const meta = (datos.metas || {})['BOL_' + M.lunesDe(f)];
    Object.entries((meta && meta.productos) || {}).forEach(([pid, piezas]) => {
      const p = recetaPorId(ctxB, pid); if (!p || !(n0(piezas) > 0)) return;
      add(f, bajar(p, n0(piezas) / 7, ctxB, { parar: rs => deOtraB(rs) || B.esMasaBase(rs), sinId }), 'BOL');
    });
  });
  // Pastelería y Cafetería: al ritmo de los últimos 14 días (lo hecho, lo vendido y el café de la bitácora)
  const hoy = datos.hoy || desde, d14 = M.sumarDias(hoy, -14);
  const ritmo = {}; (eventos || []).filter(e => (e.area === 'PAS' || e.area === 'CAF') && (e.bodega && bodega ? e.bodega === bodega : va(e.area) && vaMp(e.area, e.mp)) && e.origen !== 'Merma' && e.fecha >= d14 && e.fecha < hoy).forEach(e => { ritmo[e.mp] = (ritmo[e.mp] || 0) + e.cantidad / 14; });
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
