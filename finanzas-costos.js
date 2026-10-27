// ═══════════════════════════════════════════════
//  Sistema Fën — Finanzas · costos (F1 paso 1): reglas puras, sin red  v0.57.0 (edicion: sii null)
//  · parsearContenido: qué trae una unidad de compra ("25kg", "1lt", "saco 25 kg", "10un"…) → { cantidad, unidad: g|ml|un }
//  · resolverContenido: lo mismo, y si es dudoso ("10un": ¿el precio es por 10 o por 1?) lo confirma con el
//    costo_por_gramo de la planilla cuando calza; si no, queda sin contenido y se avisa.
//  · precioPorBase / textoPorBase / variacion: precio neto por g, ml o un; cómo se lee (por kg, l o un); flecha y %.
//  · prepararCarga: qué cambia al traer los precios de MP_maestro (nuevas, cambian, se respetan las manuales/SII).
//  · revisarDatos: lista de lo sospechoso para la revisión de datos.
//  Todo en neto (el IVA va al flujo de caja). Se prueba solo: pruebas/sistemafen/finanzas-f1a.test.js.
// ═══════════════════════════════════════════════
export const IVA = 0.19;
export const MAX_POR_KG = 100000;      // más de $100.000 por kg (o l, o unidad): "revisa"

const sinTildes = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texto = v => (v === null || v === undefined ? '' : String(v).trim());
// "1.234,5" · "1,2" · "1234.5" · 1234 → número (vacío o raro = 0)
export function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const t = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (!t) return 0;
  let s = t;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/,\d+$/.test(s) && /\.\d{3}(,|$)/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/,\d+$/.test(s) && !/\./.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
// v0.112.0 · Las casillas de números (data-decimal) aceptan coma o punto como decimal. Con coma y punto a la vez, el punto es de
// miles ("1.234,5" → 1234.5); con varios puntos y sin coma, también ("1.234.567"). Un solo punto es decimal ("0.250" → 0,25).
export function normalizarDecimal(v) {
  let t = String(v ?? '').replace(/[^\d.,\-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(/,/g, '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const i = t.indexOf('.'); if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
  return t;
}
// Lo escrito en una casilla de número, como número (vacía → ''), para que num() no lea "0.250" como 250 (miles)
export function decimal(v) { const s = String(v ?? '').trim(); if (!s) return ''; const n = Number(normalizarDecimal(s)); return /\d/.test(s) && Number.isFinite(n) ? n : s; }
// El valor de una casilla: si es de número (data-decimal), como número; si no, el texto tal cual
export const casilla = el => (!el ? '' : el.hasAttribute && el.hasAttribute('data-decimal') ? decimal(el.value) : el.value);
const redondear = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

// ── Contenido de una unidad de compra ──
const UNIDADES = [
  [/^(kg|kgs|kilo|kilos|kilogramos?)$/, 'g', 1000],
  [/^(g|gr|grs|gramos?)$/, 'g', 1],
  [/^(l|lt|lts|litros?)$/, 'ml', 1000],
  [/^(ml|cc|mililitros?)$/, 'ml', 1],
  [/^(un|u|und|unid|unids|unidad|unidades)$/, 'un', 1]
];
const unidadDe = u => { const x = UNIDADES.find(([re]) => re.test(u)); return x ? { unidad: x[1], factor: x[2] } : null; };
const UNIDAD_RE = '(kgs?|kilos?|kilogramos?|grs?|gramos?|g|lts?|litros?|l|ml|cc|mililitros?|unidades|unidad|unids?|und|un|u)';

// → { contenido: { cantidad, unidad } | null, dudoso, sugerido, motivo }
export function parsearContenido(unidadCompra) {
  const t = sinTildes(unidadCompra).replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim();
  if (!t) return { contenido: null, dudoso: false, sugerido: null, motivo: 'Sin unidad de compra' };
  if (/\d\s*\/\s*\d/.test(t)) return { contenido: null, dudoso: false, sugerido: null, motivo: 'Tiene una fracción: escribe la cantidad (por ejemplo 500 g)' };
  // "6x1lt", "6 x 1 kg": cajas de varias unidades con peso
  let m = new RegExp('(\\d+(?:\\.\\d+)?)\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*' + UNIDAD_RE + '\\b').exec(t);
  if (m) {
    const u = unidadDe(m[3]);
    if (u && u.unidad !== 'un') return { contenido: { cantidad: redondear(Number(m[1]) * Number(m[2]) * u.factor), unidad: u.unidad }, dudoso: false, sugerido: null, motivo: '' };
  }
  const todos = [...t.matchAll(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIDAD_RE + '(?![a-z])', 'g'))];
  if (todos.length > 1) return { contenido: null, dudoso: false, sugerido: null, motivo: 'Tiene más de una cantidad: no se sabe cuál vale' };
  if (todos.length === 1) {
    m = todos[0];
    const u = unidadDe(m[2]), cant = Number(m[1]);
    if (!u || !(cant > 0)) return { contenido: null, dudoso: false, sugerido: null, motivo: 'Unidad no reconocida' };
    const c = { cantidad: redondear(cant * u.factor), unidad: u.unidad };
    // "10un": puede ser un paquete de 10 con precio por paquete o el precio de 1 unidad
    if (u.unidad === 'un' && cant !== 1) return { contenido: null, dudoso: true, sugerido: c, motivo: `¿El precio es por las ${cant} unidades o por 1?` };
    return { contenido: c, dudoso: false, sugerido: null, motivo: '' };
  }
  if (/\d/.test(t)) return { contenido: null, dudoso: false, sugerido: null, motivo: 'Unidad no reconocida' };
  // Solo la unidad: "kg", "lt", "un"
  const u = unidadDe(t);
  if (u) return { contenido: { cantidad: u.factor, unidad: u.unidad }, dudoso: false, sugerido: null, motivo: '' };
  return { contenido: null, dudoso: false, sugerido: null, motivo: /saco|caja|bolsa|paquete|bandeja|rollo|pack|tarro|frasco|botella|malla/.test(t) ? 'No dice cuánto trae' : 'Unidad no reconocida' };
}

// Como parsearContenido, pero un "10un" dudoso se confirma si el costo_por_gramo de la planilla (con IVA) calza (±3 %):
// con el paquete (precio ÷ 10) o con 1 unidad (precio de 1). → { contenido, problema, nota }
export function resolverContenido(unidadCompra, { precioNeto = 0, ivaPct = 19, impPct = 0, costoPorGramo = 0 } = {}) {
  const p = parsearContenido(unidadCompra);
  if (p.contenido) return { contenido: p.contenido, problema: '', nota: '' };
  if (p.dudoso && precioNeto > 0 && costoPorGramo > 0) {
    const cerca = (a, b) => Math.abs(a - b) / b < 0.03;
    const brutos = [1 + ivaPct / 100, 1 + (ivaPct + impPct) / 100].map(f => precioNeto * f);
    if (brutos.some(b => cerca(b / p.sugerido.cantidad, costoPorGramo))) return { contenido: p.sugerido, problema: '', nota: `Confirmado con la planilla: el precio es por las ${p.sugerido.cantidad} unidades.` };
    if (brutos.some(b => cerca(b, costoPorGramo))) return { contenido: { cantidad: 1, unidad: 'un' }, problema: '', nota: 'Confirmado con la planilla: el precio es por 1 unidad.' };
  }
  return { contenido: null, problema: p.motivo || 'Unidad no reconocida', nota: '' };
}

// Contenido válido: { cantidad > 0, unidad g|ml|un }
export const contenidoValido = c => !!(c && num(c.cantidad) > 0 && ['g', 'ml', 'un'].includes(c.unidad));
// Neto por g, ml o un (null si falta algo)
export function precioPorBase(precioNeto, contenido) {
  const p = num(precioNeto);
  if (!(p > 0) || !contenidoValido(contenido)) return null;
  return redondear(p / num(contenido.cantidad), 8);
}
// Contenido en texto: 25 kg · 1 l · 500 g · 10 un
export function textoContenido(c) {
  if (!contenidoValido(c)) return '—';
  const n = num(c.cantidad), f = x => Number(redondear(x, 3)).toLocaleString('es-CL');
  if (c.unidad === 'g') return n >= 1000 ? `${f(n / 1000)} kg` : `${f(n)} g`;
  if (c.unidad === 'ml') return n >= 1000 ? `${f(n / 1000)} l` : `${f(n)} ml`;
  return `${f(n)} un`;
}
export function pesos(v) {
  const x = Number(v) || 0, abs = Math.abs(x);
  const t = abs < 100 && Math.round(abs) !== abs ? abs.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(abs).toLocaleString('es-CL');
  return (x < 0 ? '-$' : '$') + t;
}
// El precio por base como se lee: por kg (g), por l (ml) o por unidad. → { valor, por, texto }
export function porLectura(ppb, unidad) {
  if (ppb === null || ppb === undefined || !isFinite(ppb)) return null;
  const valor = unidad === 'un' ? ppb : ppb * 1000, por = unidad === 'g' ? 'kg' : unidad === 'ml' ? 'l' : 'un';
  return { valor, por, texto: `${pesos(valor)} / ${por}` };
}
// Cambio contra el precio anterior (por base, así un cambio de contenido no engaña). null si no hay con qué comparar.
export function variacion(actual, anterior) {
  const a = num(actual), b = num(anterior);
  if (!(a > 0) || !(b > 0)) return null;
  const pct = (a - b) / b * 100;
  return { pct: Math.round(pct * 10) / 10, dir: Math.abs(pct) < 0.05 ? 'igual' : pct > 0 ? 'sube' : 'baja' };
}
export const textoVariacion = v => !v ? '' : v.dir === 'igual' ? 'igual' : `${v.dir === 'sube' ? '+' : '−'}${Math.abs(v.pct).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;

// ── Tipo y estado de una materia prima ──
export const tipoMp = (tipo, id) => /sub_?receta/i.test(texto(tipo)) || /^SR/i.test(texto(id)) ? 'sub_receta' : /insumo/i.test(texto(tipo)) ? 'insumo' : 'mp';
export const estadoMp = e => (!texto(e) || /^activ/i.test(texto(e))) ? 'activa' : 'archivada';
export const ID_VALIDO = /^[A-Za-z0-9_-]{1,60}$/;
const ivaDe = v => { const n = num(v); return n > 0 && n < 1 ? n * 100 : n > 0 ? n : 19; };

// Problemas de una materia prima del maestro (las sub recetas no: su costo sale de su receta)
export function problemasMp(m) {
  if (!m || m.tipo === 'sub_receta' || m.estado === 'archivada') return [];
  const r = [];
  if (!(num(m.precioNeto) > 0)) r.push({ clave: 'sin_precio', texto: 'Sin precio' });
  if (!contenidoValido(m.contenido)) r.push({ clave: 'contenido', texto: m.contenidoProblema ? `Contenido: ${m.contenidoProblema}` : 'Contenido no reconocido' });
  const ppb = precioPorBase(m.precioNeto, m.contenido);
  if (num(m.precioNeto) > 0 && contenidoValido(m.contenido) && (!(ppb > 0) || porLectura(ppb, m.contenido.unidad).valor > MAX_POR_KG)) r.push({ clave: 'raro', texto: `Precio raro: ${porLectura(ppb, m.contenido.unidad).texto}` });
  return r;
}

// ── Traer precios desde MP_maestro ──
// filas: lo que entrega el script (op mp_costos); mpsProd: fen-produccion mps [{ id, nombre, tipo, unidad, estado }];
// actuales: costos_mp { id: doc }. → { nuevas, cambian, metadatos, respetadas, iguales, conProblema, sinId }
// Una materia prima que ya tiene precio manual o del SII NO se toca (solo su nombre, tipo y estado si cambiaron).
export function prepararCarga(filas, mpsProd, actuales, { hoy, por } = {}) {
  const plan = { nuevas: [], cambian: [], metadatos: [], respetadas: [], iguales: 0, conProblema: 0, sinId: [] };
  const deP = {}; (filas || []).forEach(f => { const id = texto(f.ID_MP); if (id && !deP[id]) deP[id] = f; });
  const deM = {}; (mpsProd || []).forEach(m => { if (m && m.id) deM[m.id] = m; });
  const ids = [...new Set([...Object.keys(deP), ...Object.keys(deM)])].sort();
  ids.forEach(id => {
    if (!ID_VALIDO.test(id)) { plan.sinId.push(id); return; }
    const f = deP[id] || {}, m = deM[id] || {}, act = (actuales || {})[id];
    const tipo = tipoMp(m.tipo || f.tipo, id);
    const meta = { nombre: texto(m.nombre) || texto(f.nombre) || id, tipo, estado: estadoMp(m.estado || f.estado) };
    const unidadCompra = texto(f.unidad_compra) || texto(m.unidad);
    const ivaPct = ivaDe(f.iva_pct), impPct = num(f.imp_adicional_pct);
    let precioNeto = num(f.costo_neto);
    if (!(precioNeto > 0) && num(f.costo_bruto) > 0) precioNeto = redondear(num(f.costo_bruto) / (1 + (ivaPct + impPct) / 100), 4);
    if (tipo === 'sub_receta') precioNeto = 0;
    const rc = resolverContenido(unidadCompra, { precioNeto, ivaPct, impPct, costoPorGramo: num(f.costo_por_gramo) });
    const precio = {
      unidadCompra, contenido: rc.contenido, contenidoProblema: rc.contenido ? '' : rc.problema, contenidoNota: rc.nota,
      precioNeto: precioNeto > 0 ? precioNeto : null, impAdicionalPct: impPct, ivaPct,
      precioPorBase: precioPorBase(precioNeto, rc.contenido)
    };
    const doc = { ...meta, ...precio };
    if (problemasMp(doc).length) plan.conProblema++;
    if (!act) { plan.nuevas.push({ id, doc: { ...doc, origen: 'planilla', fecha: hoy || '', por: por || '', anterior: null, pesoPorUnidad: null } }); return; }
    const metaCambia = ['nombre', 'tipo', 'estado'].some(k => texto(act[k]) !== texto(meta[k]));
    if ((act.origen || 'planilla') !== 'planilla') {
      const distinto = !(mismoPrecio(act.precioNeto, precio.precioNeto)) || !mismoContenido(act.contenido, precio.contenido);
      if (distinto && tipo !== 'sub_receta') plan.respetadas.push({ id, nombre: meta.nombre, origen: act.origen, actual: act, planilla: precio });
      if (metaCambia) plan.metadatos.push({ id, nombre: meta.nombre, campos: meta, antes: act });
      else if (!distinto) plan.iguales++;
      return;
    }
    const cambiosPrecio = [];
    if (!mismoPrecio(act.precioNeto, precio.precioNeto)) cambiosPrecio.push('precio');
    if (!mismoContenido(act.contenido, precio.contenido)) cambiosPrecio.push('contenido');
    if (texto(act.unidadCompra) !== texto(precio.unidadCompra)) cambiosPrecio.push('unidad de compra');
    if (num(act.impAdicionalPct) !== num(precio.impAdicionalPct)) cambiosPrecio.push('impuesto adicional');
    if (cambiosPrecio.length) {
      plan.cambian.push({ id, nombre: meta.nombre, cambios: cambiosPrecio, antes: act,
        doc: { ...doc, origen: 'planilla', fecha: hoy || '', por: por || '', anterior: { precioNeto: act.precioNeto ?? null, contenido: act.contenido || null, precioPorBase: act.precioPorBase ?? null, fecha: act.fecha || '' } } });
    } else if (metaCambia || texto(act.contenidoProblema) !== texto(precio.contenidoProblema)) plan.metadatos.push({ id, nombre: meta.nombre, campos: { ...meta, contenidoProblema: precio.contenidoProblema, contenidoNota: precio.contenidoNota }, antes: act });
    else plan.iguales++;
  });
  return plan;
}
function mismoPrecio(a, b) { const x = num(a), y = num(b); return Math.abs(x - y) < 0.005; }
export const mismoContenido = (a, b) => (!contenidoValido(a) && !contenidoValido(b)) || (contenidoValido(a) && contenidoValido(b) && a.unidad === b.unidad && Math.abs(num(a.cantidad) - num(b.cantidad)) < 1e-6);

// Lo que se guarda al editar un precio a mano (función pura: arma el documento y su historial)
// datos: { precioNeto, conIva, contenido: { cantidad, unidad: g|kg|ml|l|un }, pesoPorUnidad, motivo }
export function edicion(actual, datos, { hoy, por } = {}) {
  const motivo = texto(datos.motivo);
  if (!motivo) throw new Error('Escribe el motivo del cambio.');
  if (actual && actual.tipo === 'sub_receta') throw new Error('El costo de una sub receta se calcula de su receta: no se edita aquí.');
  let precio = num(datos.precioNeto);
  if (!(precio > 0)) throw new Error('Escribe un precio mayor que cero.');
  if (datos.conIva) precio = redondear(precio / (1 + IVA), 2);
  const u = texto(datos.contenido && datos.contenido.unidad), cant = num(datos.contenido && datos.contenido.cantidad);
  const f = { kg: ['g', 1000], g: ['g', 1], l: ['ml', 1000], ml: ['ml', 1], un: ['un', 1] }[u];
  if (!f || !(cant > 0)) throw new Error('Escribe cuánto trae una unidad de compra (cantidad y unidad).');
  const contenido = { cantidad: redondear(cant * f[1]), unidad: f[0] };
  const peso = num(datos.pesoPorUnidad);
  const ppb = precioPorBase(precio, contenido);
  const anterior = actual ? { precioNeto: actual.precioNeto ?? null, contenido: actual.contenido || null, precioPorBase: actual.precioPorBase ?? null, fecha: actual.fecha || '' } : null;
  const doc = { precioNeto: precio, contenido, precioPorBase: ppb, contenidoProblema: '', contenidoNota: '', pesoPorUnidad: contenido.unidad === 'un' && peso > 0 ? peso : null,
    origen: 'manual', fecha: hoy || '', por: por || '', anterior, sii: null };
  const hist = { mp: actual && actual.id ? actual.id : '', precioNeto: precio, contenido, precioPorBase: ppb, origen: 'manual', motivo, fecha: hoy || '', por: por || '', anterior };
  return { doc, hist };
}

// ── Revisión de datos ──
export const recetaAprobada = r => /^(consolidada|aprobada|activa)$/i.test(texto(r && r.estado));
const nombreDe = (id, costos, mps, recetas, alt) => (costos[id] && costos[id].nombre) || (mps[id] && mps[id].nombre) || (recetas[id] && recetas[id].nombre) || texto(alt) || id;
export const GRUPOS = [
  ['sin_precio', 'Materias primas e insumos sin precio', 'Activas, con precio vacío o 0. Sin precio, nada de lo que las usa se puede costear.'],
  ['contenido', 'Contenido no reconocido', 'No se sabe cuánto trae una unidad de compra (por ejemplo "10un": ¿el precio es por 10 o por 1?, o "saco" sin peso).'],
  ['raro', 'Precio por kg, l o unidad que hay que revisar', `Da $0 o más de ${pesos(MAX_POR_KG)} por kg, l o unidad: casi seguro el precio o el contenido están mal escritos.`],
  ['receta_sin_costo', 'Recetas aprobadas con ingredientes sin costo', 'Ingredientes o insumos que no están en el maestro de costos o no tienen precio.'],
  ['unidad', 'Unidades que no calzan', 'Un ingrediente en unidades de algo que se compra por peso, o en gramos de algo que se compra por unidad sin peso por unidad.'],
  ['rendimiento', 'Recetas sin rendimiento', 'Recetas aprobadas sin porciones (0 o vacío): no se puede saber el costo de una unidad.'],
  ['sub_peso', 'Sub recetas sin peso por unidad', 'Una sub receta que se usa en unidades pero rinde gramos (o al revés) y no tiene peso por unidad.']
];
// datos: { costos: { id: doc }, mps: [ { id, … } ] (fen-produccion), recetas: [ { id, … } ] } → [ { clave, grupo, titulo, detalle, huella, mp?, receta? } ]
export function revisarDatos({ costos = {}, mps = [], recetas = [] } = {}) {
  const items = [], M = {}, R = {};
  mps.forEach(m => { if (m && m.id) M[m.id] = m; });
  recetas.forEach(r => { if (r && r.id) R[r.id] = r; });
  const aprobadas = recetas.filter(recetaAprobada);
  // usos de cada materia prima en recetas aprobadas
  const usos = {};
  aprobadas.forEach(r => [...(r.ingredientes || []), ...(r.insumos || [])].forEach(i => { const id = texto(i && i.id); if (id) (usos[id] || (usos[id] = new Set())).add(r.nombre || r.id); }));
  const usoTxt = id => usos[id] ? ` · se usa en ${usos[id].size} ${usos[id].size === 1 ? 'receta aprobada' : 'recetas aprobadas'}` : '';
  // 1–3: el maestro de costos
  Object.entries(costos).sort((a, b) => texto(a[1].nombre).localeCompare(texto(b[1].nombre), 'es')).forEach(([id, m]) => {
    problemasMp({ ...m, id }).forEach(p => {
      const detalle = p.clave === 'sin_precio' ? `Unidad de compra: ${m.unidadCompra || '—'}${usoTxt(id)}`
        : p.clave === 'contenido' ? `Unidad de compra: "${m.unidadCompra || ''}" · ${m.contenidoProblema || 'no se reconoce'}${usoTxt(id)}`
        : `${pesos(m.precioNeto)} neto por ${textoContenido(m.contenido)} → ${porLectura(m.precioPorBase, m.contenido.unidad).texto}`;
      items.push({ clave: `${p.clave}:${id}`, grupo: p.clave, titulo: m.nombre || id, detalle, mp: id,
        huella: JSON.stringify([m.precioNeto ?? null, m.contenido || null, m.unidadCompra || '']) });
    });
  });
  // 4–5: recetas aprobadas
  aprobadas.forEach(r => {
    const sinCosto = [], unidad = [];
    const revisar = (i, esInsumo) => {
      const id = texto(i && i.id); if (!id) { sinCosto.push(texto(i && i.nombre) || '(sin id)'); return; }
      const c = costos[id];
      const esSub = (c && c.tipo === 'sub_receta') || (M[id] && tipoMp(M[id].tipo, id) === 'sub_receta') || (!c && !M[id] && R[id]);
      if (esSub) return;   // sub receta: su costo sale de su receta (se revisa en "sub recetas sin peso")
      if (!c || c.estado === 'archivada' || !(num(c.precioNeto) > 0)) { sinCosto.push(nombreDe(id, costos, M, R, i.nombre) + (!c ? ' (no está en el maestro)' : c.estado === 'archivada' ? ' (archivada)' : '')); return; }
      if (!contenidoValido(c.contenido)) return;   // ya sale en "Contenido no reconocido"
      const enUnidades = esInsumo || (i.unidades !== null && i.unidades !== undefined && i.unidades !== '' && num(i.unidades) > 0);
      if (enUnidades && c.contenido.unidad !== 'un') unidad.push({ id, texto: `${c.nombre}: va en unidades, pero se compra por ${c.contenido.unidad === 'g' ? 'peso' : 'volumen'}` });
      if (!enUnidades && num(i.gramos) > 0 && c.contenido.unidad === 'un' && !(num(c.pesoPorUnidad) > 0)) unidad.push({ id, texto: `${c.nombre}: va en gramos, pero se compra por unidad y no tiene peso por unidad` });
    };
    (r.ingredientes || []).forEach(i => revisar(i, false));
    (r.insumos || []).forEach(i => revisar(i, true));
    if (sinCosto.length) items.push({ clave: `receta_sin_costo:${r.id}`, grupo: 'receta_sin_costo', titulo: r.nombre || r.id, detalle: `${sinCosto.length} sin costo: ${sinCosto.join(', ')}`, receta: r.id, huella: JSON.stringify(sinCosto) });
    unidad.forEach(u => items.push({ clave: `unidad:${r.id}:${u.id}`, grupo: 'unidad', titulo: `${r.nombre || r.id}`, detalle: u.texto, receta: r.id, mp: u.id, huella: u.texto }));
    if (!(num(r.porciones) > 0)) items.push({ clave: `rendimiento:${r.id}`, grupo: 'rendimiento', titulo: r.nombre || r.id, detalle: `Porciones: ${texto(r.porciones) || 'vacío'}`, receta: r.id, huella: texto(r.porciones) });
  });
  // 6: sub recetas usadas en otra unidad que la que rinden, sin peso por unidad
  const subVistas = {};
  aprobadas.forEach(r => (r.ingredientes || []).forEach(i => {
    const id = texto(i && i.id), c = costos[id], m = M[id];
    if (!((c && c.tipo === 'sub_receta') || (m && tipoMp(m.tipo, id) === 'sub_receta'))) return;
    const origen = R[texto((m && m.recetaOrigen) || '')] || recetas.find(x => x.mpId === id) || null;
    if (!origen || num(origen.pesoUnidad) > 0) return;
    const enUnidades = i.unidades !== null && i.unidades !== undefined && i.unidades !== '' && num(i.unidades) > 0;
    const rinde = origen.unidad === 'g' ? 'g' : 'un';
    if ((enUnidades && rinde === 'g') || (!enUnidades && num(i.gramos) > 0 && rinde === 'un')) {
      const k = `sub_peso:${id}`;
      if (!subVistas[k]) subVistas[k] = { clave: k, grupo: 'sub_peso', titulo: nombreDe(id, costos, M, R), recetas: new Set(), receta: origen.id, mp: id, rinde, enUnidades };
      subVistas[k].recetas.add(r.nombre || r.id);
    }
  }));
  Object.values(subVistas).forEach(s => {
    const lista = [...s.recetas].sort();
    items.push({ clave: s.clave, grupo: 'sub_peso', titulo: s.titulo, receta: s.receta, mp: s.mp,
      detalle: `Rinde ${s.rinde === 'g' ? 'gramos' : 'unidades'} y se usa en ${s.enUnidades ? 'unidades' : 'gramos'} en: ${lista.join(', ')}. Falta el peso por unidad en su receta.`, huella: JSON.stringify(lista) });
  });
  return items;
}
// ¿Sigue en la lista? Sale si se marcó revisado y no cambió desde entonces (misma huella).
export const pendiente = (item, marcas) => { const m = (marcas || {})[idRevision(item.clave)]; return !(m && m.revisado && m.huella === item.huella); };
// Id del documento costos_revision para una clave (sin "/")
export const idRevision = clave => String(clave).replace(/[^A-Za-z0-9_:-]/g, '_').replace(/:/g, '__').slice(0, 140);
