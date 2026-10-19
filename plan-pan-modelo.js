// ═══════════════════════════════════════════════
//  Sistema Fën — Plan de Panadería, Etapa 1: cálculos (sin Firebase ni pantalla)  v0.71.0
//  Todo es función pura: recibe lo ya leído y devuelve tablas. Sin imports (Cocina se pasa como parámetro
//  en la masa madre), así se prueba en Node tal cual.
//
//  Decisiones del dueño (19-oct-2026):
//  · Opción A: solo datos exactos. Fresco y rebajado SOLO en los días con caja v2.2.0 (porTarjeta). Nunca se estima por precio.
//  · B2B: la fecha de la orden es el día de entrega = día de horneado.
//  · Plan de Cocina (planes/PAN_{lunes}.filas.{recetaId}.d0..d6): cada d es el día de AMASADO; se hornea al día siguiente (d+1).
//  · Masa madre: día 0 a las 19:00 para lo que se amasa el día 1 y se hornea el día 2.
//  · Ainavillo todavía no ingresa a su caja el pan que recibe: tabla fija editable (config con historial).
//
//  Tipo de pan = receta de Panadería. Un producto de la caja o de B2B va a su receta por el vínculo de Finanzas
//  (fin_productos/{canal}_{productoId}: tipo 'receta', area 'PAN', receta, unidadesPorVenta). Sin vínculo: "sin asociar".
//
//  Contabilidad por lote (exacta): un lote = lo que se recibió en la tienda un día (stockMovimientos tipo ingreso, fechaKey).
//    vendido del lote = recibido − merma del lote − lo que aún queda del lote (stock.entradas.AAAAMMDD).
//    La merma registrada dice su lote (fechaIngreso; si se juntaron varios lotes, el más antiguo): si pasa de lo que ese
//    lote tenía, lo que sobra se corre al lote siguiente del mismo producto (y se marca).
//    La merma enviada en la caja y todavía no registrada (entradas.merma_AAAAMMDD) cuenta como merma de ese lote.
// ═══════════════════════════════════════════════

export const VERSION = '0.71.0';
export const SUCS = ['barros', 'ainavillo'];
export const NOMBRE_SUC = { barros: 'Barros Arana', ainavillo: 'Ainavillo' };
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Desde cuándo hay datos de la caja y de las tiendas en Firebase: la referencia "hace un año" se muestra solo si su día es
// igual o posterior (o sea, desde junio de 2027) y además hay datos de ese día.
export const DATOS_DESDE = '2026-06-01';
export const SEMANAS_REF = 4;          // últimas 4 semanas (mismo día)
export const SEMANAS_TENDENCIA = 6;    // tendencia semanal

const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const s = v => (v === null || v === undefined ? '' : String(v));
const r1 = x => Math.round(x * 10) / 10;

// ── Fechas (texto AAAA-MM-DD, en UTC para no correrse con el horario de verano) ──
const aUTC = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
const deUTC = ms => new Date(ms).toISOString().slice(0, 10);
export const esFecha = t => /^\d{4}-\d{2}-\d{2}$/.test(s(t));
export const sumarDias = (t, n) => deUTC(aUTC(t) + n * 864e5);
export const indiceDia = t => (new Date(aUTC(t)).getUTCDay() + 6) % 7;   // 0 = lunes
export const lunesDe = t => sumarDias(t, -indiceDia(t));
export const diasEntre = (a, b) => Math.round((aUTC(b) - aUTC(a)) / 864e5);
export const claveDeFecha = t => s(t).replace(/-/g, '');
export const fechaDeClave = k => (/^\d{8}$/.test(s(k)) ? `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}` : '');
export const dmyAIso = f => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s(f)); return m ? `${m[3]}-${m[2]}-${m[1]}` : esFecha(s(f).slice(0, 10)) ? s(f).slice(0, 10) : ''; };
export const fechaCorta = t => `${DIAS_CORTOS[indiceDia(t)]} ${+t.slice(8, 10)} ${MESES[+t.slice(5, 7) - 1]}`;
export const fechaLarga = t => `${DIAS[indiceDia(t)]} ${+t.slice(8, 10)} de ${MESES[+t.slice(5, 7) - 1]}`;
export const semanaTxt = lunes => { const d = sumarDias(lunes, 6); return `${+lunes.slice(8, 10)} ${MESES[+lunes.slice(5, 7) - 1]} al ${+d.slice(8, 10)} ${MESES[+d.slice(5, 7) - 1]}`; };
export const semanaDe = lunes => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
// El mismo día de la semana en la misma semana del mes (1.er lunes, 2.º lunes…) de otro mes; si ese mes no tiene un 5.º, el último
export function mismoDiaDelMes(t, mesesAtras) {
  const y = +t.slice(0, 4), m = +t.slice(5, 7) - 1, ord = Math.floor((+t.slice(8, 10) - 1) / 7), w = indiceDia(t);
  const d0 = new Date(Date.UTC(y, m - mesesAtras, 1)), ini = deUTC(d0.getTime());
  const primero = sumarDias(ini, (w - indiceDia(ini) + 7) % 7);
  let f = sumarDias(primero, ord * 7);
  if (f.slice(0, 7) !== ini.slice(0, 7)) f = sumarDias(f, -7);
  return f;
}
// Los N últimos días iguales (mismo día de la semana) antes de t que ya pasaron (≤ hasta)
export function mismosDiasAntes(t, n, hasta) {
  const out = []; let f = sumarDias(t, -7);
  while (f > hasta) f = sumarDias(f, -7);
  for (let i = 0; i < n; i++) { out.push(f); f = sumarDias(f, -7); }
  return out;
}
// Ventana de datos que necesita la propuesta de la semana que parte el lunes L (y la tendencia)
export function ventana(lunesProx, hoy) {
  const ultimoDia = sumarDias(hoy, -1);
  const refs = semanaDe(lunesProx).flatMap(t => [...mismosDiasAntes(t, SEMANAS_REF, ultimoDia), mismoDiaDelMes(t, 1)]);
  const desde = [lunesDe(sumarDias(hoy, -7 * SEMANAS_TENDENCIA)), ...refs].sort()[0];
  return { desde, hasta: hoy };
}
export const mediana = arr => { const a = arr.filter(x => isFinite(x)).slice().sort((x, y) => x - y); if (!a.length) return null; const k = Math.floor(a.length / 2); return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2; };

// ── Sucursales ──
export const sucDe = x => (/ainavillo/i.test(s(x)) ? 'ainavillo' : 'barros');

// ── Vínculos de Finanzas → tipo de pan ──
// vinculos: { clave: doc } (fin_productos). → { 'caja_pid' | 'b2b_pid': { receta, upv, nombre } } solo los de Panadería;
// otros: claves con vínculo a otra cosa (otra área, reventa, "no es un producto"): no son pan.
export function mapaProductos(vinculos) {
  const pan = {}, otros = new Set();
  Object.entries(vinculos || {}).forEach(([clave, v]) => {
    if (!v) return;
    if (v.tipo === 'receta' && v.receta && s(v.area).toUpperCase() === 'PAN') pan[clave] = { receta: s(v.receta), upv: num(v.unidadesPorVenta) > 0 ? num(v.unidadesPorVenta) : 1, nombre: s(v.nombre) };
    else otros.add(clave);
  });
  return { pan, otros };
}
const idDoc = t => s(t).replace(/\//g, '_').replace(/^\.+$/, '_').slice(0, 300) || '_';
export const claveProducto = (canal, pid) => `${canal}_${idDoc(pid)}`;

// Productos sin asociar que parecen de Panadería: de la caja con área PAN en su catálogo (vendidos o ingresados en la ventana)
// y de B2B pedidos en la ventana (B2B no trae área: todo lo pedido sin vínculo).
// fuentes: { caja: [{ productoId, nombre, area, cantidad }], b2b: [{ productoId, nombre, cantidad }] }
export function sinAsociar(fuentes, mapa) {
  const out = {};
  const ver = (canal, x, esPan) => {
    const clave = claveProducto(canal, x.productoId);
    if (mapa.pan[clave] || mapa.otros.has(clave) || !esPan) return;
    const o = out[clave] || (out[clave] = { clave, canal, productoId: s(x.productoId), nombre: s(x.nombre) || s(x.productoId), cantidad: 0 });
    o.cantidad += num(x.cantidad);
    if (!o.nombre && x.nombre) o.nombre = s(x.nombre);
  };
  (fuentes.caja || []).forEach(x => ver('caja', x, s(x.area).toUpperCase() === 'PAN'));
  (fuentes.b2b || []).forEach(x => ver('b2b', x, true));
  return Object.values(out).sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
}

// ── Producido (Cocina): plan de Panadería, d = día de amasado → se hornea d+1 ──
// planes: [{ id: 'PAN_lunes', area, lunes, filas }]; dias: [{ area, fecha, hechos, cantidades }] (los de PAN)
// → { fechaHorneo: { recetaId: { cant, hecho } } }
export function producidoPorDia(planes, dias) {
  const out = {}, diaPan = {};
  (dias || []).forEach(d => { if (d && (d.area || 'PAN') === 'PAN' && esFecha(d.fecha)) diaPan[d.fecha] = d; });
  (planes || []).forEach(p => {
    if (!p || (p.area && p.area !== 'PAN') || !esFecha(p.lunes)) return;
    Object.entries(p.filas || {}).forEach(([rid, ds]) => {
      for (let i = 0; i < 7; i++) {
        const amasado = sumarDias(p.lunes, i), dia = diaPan[amasado];
        const cant = dia && dia.cantidades && dia.cantidades[rid] !== undefined ? num(dia.cantidades[rid]) : num((ds || {})['d' + i]);
        if (!(cant > 0)) continue;
        const horneo = sumarDias(amasado, 1), x = (out[horneo] || (out[horneo] = {}));
        x[rid] = { cant: (x[rid] ? x[rid].cant : 0) + cant, hecho: !!(dia && dia.hechos && dia.hechos['rec_' + rid] && dia.hechos['rec_' + rid].por), amasado };
      }
    });
  });
  return out;
}

// ── Lotes de las tiendas (exacto) ──
// ingresos: [{ sucursal, productoId, fechaKey: 'AAAAMMDD', cantidad }]; mermas: [{ sucursal, productoId, cantidad, fechaIngreso, fechaEnvio, monto }]
// stocks: { 'suc_pid' (id del documento): { sucursal, productoId, entradas } }
// → { porProducto: { 'suc|pid|fecha': lote }, porReceta: { suc: { fecha: { receta: lote } } }, sinLote, corridas }
//   lote = { recibido, merma, mermaPend, quedo, vendido, abierto, corrida }  (en unidades de la receta)
export function lotes({ ingresos, mermas, stocks, mapa }) {
  const P = {}, sinLote = [];
  const k = (suc, pid, f) => `${suc}|${pid}|${f}`;
  const lote = (suc, pid, f) => P[k(suc, pid, f)] || (P[k(suc, pid, f)] = { suc, pid, fecha: f, recibido: 0, merma: 0, mermaPend: 0, quedo: 0, corrida: 0 });
  (ingresos || []).forEach(x => {
    const f = fechaDeClave(s(x.fechaKey)); if (!f || !(num(x.cantidad) > 0)) return;
    lote(sucDe(x.sucursal), s(x.productoId), f).recibido += num(x.cantidad);
  });
  const fechasDe = (suc, pid) => Object.values(P).filter(l => l.suc === suc && l.pid === pid).map(l => l.fecha).sort();
  // Lo que aún queda (y la merma enviada sin registrar) de cada lote conocido
  Object.values(stocks || {}).forEach(st => {
    if (!st) return;
    const suc = sucDe(st.sucursal), pid = s(st.productoId);
    Object.entries(st.entradas || {}).forEach(([key, q]) => {
      const c = num(q); if (!(c > 0)) return;
      if (/^\d{8}$/.test(key)) { const f = fechaDeClave(key); if (P[k(suc, pid, f)]) P[k(suc, pid, f)].quedo += c; return; }
      const m = /^merma_(\d{8})$/.exec(key);
      if (m) { const f = fechaDeClave(m[1]); if (P[k(suc, pid, f)]) P[k(suc, pid, f)].mermaPend += c; return; }
      if (/^ultimaoferta_/.test(key)) sinLote.push({ suc, pid, clave: key, cantidad: c });
    });
  });
  // Merma registrada → a su lote (fechaIngreso); si no calza con un lote recibido en la ventana, al lote más cercano anterior
  (mermas || []).forEach(m => {
    const suc = sucDe(m.sucursal), pid = s(m.productoId), c = num(m.cantidad); if (!(c > 0)) return;
    const f = dmyAIso(m.fechaIngreso) || dmyAIso(m.fechaEnvio); if (!f) return;
    if (P[k(suc, pid, f)]) { P[k(suc, pid, f)].merma += c; return; }
    const fs = fechasDe(suc, pid).filter(x => x <= f);
    if (fs.length) P[k(suc, pid, fs[fs.length - 1])].merma += c; else sinLote.push({ suc, pid, merma: c, fecha: f });
  });
  // Merma que pasa de lo que tenía su lote → al lote siguiente del mismo producto
  const grupos = {};
  Object.values(P).forEach(l => { (grupos[l.suc + '|' + l.pid] || (grupos[l.suc + '|' + l.pid] = [])).push(l); });
  let corridas = 0;
  Object.values(grupos).forEach(ls => {
    ls.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    let arrastre = 0;
    ls.forEach(l => {
      const propia = l.merma + l.mermaPend, cabe = Math.max(0, l.recibido - l.quedo);
      const propiaVa = Math.min(propia, cabe), entra = Math.min(arrastre, cabe - propiaVa);
      arrastre = (propia - propiaVa) + (arrastre - entra);
      l.mermaPend = Math.min(l.mermaPend, propiaVa);
      l.merma = propiaVa - l.mermaPend + entra;
      l.corrida = entra; if (entra > 0) corridas++;
    });
    if (arrastre > 0) sinLote.push({ suc: ls[0].suc, pid: ls[0].pid, merma: arrastre, fecha: ls[ls.length - 1].fecha, sobra: true });
  });
  Object.values(P).forEach(l => { l.vendido = Math.max(0, l.recibido - l.merma - l.mermaPend - l.quedo); l.abierto = l.quedo > 0 || l.mermaPend > 0; });
  // A recetas
  const porReceta = {};
  Object.values(P).forEach(l => {
    const v = mapa.pan[claveProducto('caja', l.pid)]; if (!v) return;
    const x = ((porReceta[l.suc] || (porReceta[l.suc] = {}))[l.fecha] || (porReceta[l.suc][l.fecha] = {}));
    const y = x[v.receta] || (x[v.receta] = { recibido: 0, merma: 0, mermaPend: 0, quedo: 0, vendido: 0, abierto: false, corrida: 0 });
    ['recibido', 'merma', 'mermaPend', 'quedo', 'vendido', 'corrida'].forEach(c => { y[c] += l[c] * v.upv; });
    y.abierto = y.abierto || l.abierto;
  });
  return { porProducto: P, porReceta, sinLote, corridas };
}

// ── Tarjetas (caja v2.2.0): fresco, rebajado y agotado por lote ──
// filas: Caja.tarjetasDeResumenes(resumenes) → [{ fecha, sucursal, productoId, cantidad, registrado, porTarjeta, agotadoHoy, reagotadoHoy }]
// → { suc: { fecha: { receta: { registrado, fresco, agotado, reagotado, vendidoDia } } } }
//   fresco = lo vendido con tarjeta "hoy" ese día (= del lote de ese día). Registrado solo si TODOS los cierres del día
//   (de los productos de esa receta) traen porTarjeta.
export function tarjetasPorLote(filas, mapa) {
  const out = {};
  (filas || []).forEach(f => {
    const v = mapa.pan[claveProducto('caja', f.productoId)]; if (!v || !esFecha(f.fecha)) return;
    const suc = sucDe(f.sucursal), x = ((out[suc] || (out[suc] = {}))[f.fecha] || (out[suc][f.fecha] = {}));
    const y = x[v.receta] || (x[v.receta] = { registrado: true, fresco: 0, vendidoDia: 0, agotado: '', reagotado: '' });
    y.registrado = y.registrado && !!f.registrado;
    y.fresco += num(f.porTarjeta && f.porTarjeta.hoy && f.porTarjeta.hoy.cant) * v.upv;
    y.vendidoDia += num(f.cantidad) * v.upv;
    if (f.agotadoHoy && (!y.agotado || f.agotadoHoy < y.agotado)) y.agotado = f.agotadoHoy;
    if (f.reagotadoHoy && (!y.reagotado || f.reagotadoHoy > y.reagotado)) y.reagotado = f.reagotadoHoy;
  });
  return out;
}

// Un lote con su parte fresca y rebajada (solo si el día tiene caja v2.2.0)
export function detalleLote(lote, tarj) {
  const l = lote || { recibido: 0, merma: 0, mermaPend: 0, quedo: 0, vendido: 0, abierto: false, corrida: 0 };
  const merma = l.merma + l.mermaPend;
  const out = { recibido: l.recibido, merma, mermaPend: l.mermaPend, quedo: l.quedo, vendido: l.vendido, abierto: l.abierto, corrida: l.corrida,
    mermaPct: l.recibido > 0 ? merma / l.recibido * 100 : null, registrado: false, fresco: null, rebajado: null, rebajadoPct: null, agotado: '', reagotado: '' };
  if (tarj && tarj.registrado) {
    out.registrado = true;
    out.fresco = Math.min(tarj.fresco, l.vendido);
    out.rebajado = Math.max(0, l.vendido - out.fresco);
    out.rebajadoPct = l.vendido > 0 ? out.rebajado / l.vendido * 100 : null;
    out.agotado = tarj.agotado || ''; out.reagotado = tarj.reagotado || '';
  }
  return out;
}

// ── B2B por día de horneado (= fecha de la orden) ──
// ordenes: [{ fecha, clienteId, cliente, lineas: [{ productoId, producto, cantidad }] }] (sin anuladas ni quitadas)
// → { fecha: { receta: unidades } } y por cliente { fecha: { cliente: { receta: unidades } } }
export function b2bPorDia(ordenes, mapa) {
  const porDia = {}, porCliente = {}, nombres = {}, sin = [];
  (ordenes || []).forEach(o => {
    if (!o || !esFecha(s(o.fecha).slice(0, 10))) return;
    const f = s(o.fecha).slice(0, 10), cli = s(o.clienteId) || s(o.cliente) || 'sin-cliente';
    nombres[cli] = s(o.cliente) || nombres[cli] || cli;
    (o.lineas || []).forEach(l => {
      const v = mapa.pan[claveProducto('b2b', l.productoId)], c = num(l.cantidad);
      if (!(c > 0)) return;
      if (!v) { sin.push({ productoId: s(l.productoId), nombre: s(l.producto), cantidad: c }); return; }
      const u = c * v.upv;
      const d = porDia[f] || (porDia[f] = {}); d[v.receta] = (d[v.receta] || 0) + u;
      const pc = ((porCliente[f] || (porCliente[f] = {}))[cli] || (porCliente[f][cli] = {})); pc[v.receta] = (pc[v.receta] || 0) + u;
    });
  });
  return { porDia, porCliente, nombres, sin };
}

// Estimado de B2B para un día t (por receta), con los 4 mismos días anteriores ya pasados (≤ hasta)
// Por cliente y receta: f = en cuántos de los 4 días pidió, q = cantidad usual (mediana de los días que pidió).
//   estimado = Σ (f ≥ 3 ? q : f/4 × q)
// Activos = clientes con al menos una orden (de pan) en los 28 días anteriores a "hasta" (cualquier día).
export function estimarB2B(b2b, t, hasta) {
  const refs = mismosDiasAntes(t, SEMANAS_REF, hasta);
  const activos = new Set();
  const desde28 = sumarDias(hasta, -27);
  Object.entries(b2b.porCliente).forEach(([f, cs]) => { if (f >= desde28 && f <= hasta) Object.keys(cs).forEach(c => activos.add(c)); });
  const clientes = {};
  refs.forEach((f, i) => Object.entries(b2b.porCliente[f] || {}).forEach(([cli, rs]) => {
    const c = clientes[cli] || (clientes[cli] = { id: cli, nombre: b2b.nombres[cli] || cli, dias: [false, false, false, false], porReceta: {} });
    c.dias[i] = true;
    Object.entries(rs).forEach(([rid, q]) => { const r = c.porReceta[rid] || (c.porReceta[rid] = [null, null, null, null]); r[i] = q; });
  }));
  const porReceta = {};
  const lista = Object.values(clientes).map(c => {
    const veces = c.dias.filter(Boolean).length;
    const recetas = Object.entries(c.porReceta).map(([rid, qs]) => {
      const pidio = qs.filter(q => q !== null), f = pidio.length, q = mediana(pidio) || 0;
      const est = f >= 3 ? q : f / SEMANAS_REF * q;
      porReceta[rid] = (porReceta[rid] || 0) + est;
      return { receta: rid, veces: f, usual: q, estimado: est, cantidades: qs };
    });
    return { id: c.id, nombre: c.nombre, veces, seguro: veces >= 3, recetas };
  }).sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'));
  Object.keys(porReceta).forEach(r => { porReceta[r] = Math.round(porReceta[r]); });
  return { fecha: t, refs, activos: activos.size, esperados: lista.filter(c => c.seguro).length, clientes: lista, porReceta };
}

// ── B2C Barros: mediana de lo vendido por lote en los 4 mismos días de horneado, con ajustes ──
// Ajustes (solo con datos exactos; se suman y quedan entre −20 % y +20 %):
//   merma alta: mediana del % de merma de las referencias > 10 % → −5 %; > 20 % → −10 %
//   rebajado (solo días con caja v2.2.0, al menos 2): mediana del % rebajado > 15 % → −5 %; > 30 % → −10 %
//   agotado (solo días con caja v2.2.0): se agotó en 2 o más de las referencias → +10 %; si 2 o más antes de las 13:00 → +15 %
export const REGLAS_B2C = { mermaAlta: [[20, -10], [10, -5]], rebajado: [[30, -10], [15, -5]], agotado: 10, agotadoTemprano: 15, horaTemprano: '13:00', tope: 20 };
export function estimarB2C(ref, t, hasta, opciones = {}) {
  // ref(fecha) → detalleLote | null (null = sin datos ese día)
  const fechas = mismosDiasAntes(t, SEMANAS_REF, hasta);
  const cuatro = fechas.map(f => ({ fecha: f, ...(ref(f) || { sinDatos: true }) }));
  const con = cuatro.filter(x => !x.sinDatos && x.recibido > 0);
  const base = mediana(con.map(x => x.vendido));
  const mesF = mismoDiaDelMes(t, 1), mes = ref(mesF);
  const anioF = mismoDiaDelMes(t, 12), anio = anioF >= DATOS_DESDE ? ref(anioF) : null;
  const ajustes = [];
  if (base !== null) {
    const mm = mediana(con.map(x => x.mermaPct).filter(x => x !== null));
    if (mm !== null) { const r = REGLAS_B2C.mermaAlta.find(([u]) => mm > u); if (r) ajustes.push({ tipo: 'merma', pct: r[1], texto: `Merma alta (${r1(mm).toLocaleString('es-CL')} % mediana)` }); }
    const reg = con.filter(x => x.registrado);
    if (reg.length >= 2) {
      const rb = mediana(reg.map(x => x.rebajadoPct).filter(x => x !== null));
      if (rb !== null) { const r = REGLAS_B2C.rebajado.find(([u]) => rb > u); if (r) ajustes.push({ tipo: 'rebajado', pct: r[1], texto: `Se vendió rebajado (${r1(rb).toLocaleString('es-CL')} % mediana)` }); }
      const ag = reg.filter(x => x.agotado), temprano = ag.filter(x => x.agotado < REGLAS_B2C.horaTemprano);
      if (temprano.length >= 2) ajustes.push({ tipo: 'agotado', pct: REGLAS_B2C.agotadoTemprano, texto: `Se agotó antes de las ${REGLAS_B2C.horaTemprano} (${temprano.length} de ${reg.length})` });
      else if (ag.length >= 2) ajustes.push({ tipo: 'agotado', pct: REGLAS_B2C.agotado, texto: `Se agotó (${ag.length} de ${reg.length})` });
    }
  }
  const pct = Math.max(-REGLAS_B2C.tope, Math.min(REGLAS_B2C.tope, ajustes.reduce((a, x) => a + x.pct, 0)));
  const estimado = base === null ? null : Math.round(base * (1 + pct / 100));
  const pasada = cuatro[0] && !cuatro[0].sinDatos ? cuatro[0] : null;
  const comparaMes = base !== null && mes && mes.recibido > 0 && mes.vendido > 0 ? (base - mes.vendido) / mes.vendido * 100 : null;
  return { fecha: t, base, ajustes, pct, estimado, cuatro, pasada, mes: mes ? { fecha: mesF, ...mes } : { fecha: mesF, sinDatos: true },
    anio: anio && anio.recibido > 0 ? { fecha: anioF, ...anio } : null, comparaMes, conDatos: con.length, ...opciones };
}

// ── Configuración: tabla fija de Ainavillo y pisos (con historial) ──
// cfg = { ainavillo: { d0..d6: { recetaId: n } }, pisos: { barros: { d0..: { recetaId: n } }, ainavillo: {...} }, historial: [...] }
// cambios: [{ tipo: 'ainavillo' | 'piso', suc, dia (0..6), receta, valor (número ≥ 0, o null = sin piso) }]
// → { cfg (nuevo), entradas (solo lo que cambió) }. Nada se borra: un piso quitado queda como null y en el historial.
export function aplicarCambios(cfg, cambios, por, en) {
  const c = JSON.parse(JSON.stringify(cfg || {}));
  c.ainavillo = c.ainavillo || {}; c.pisos = c.pisos || {}; c.historial = Array.isArray(c.historial) ? c.historial : [];
  const entradas = [];
  (cambios || []).forEach(x => {
    const d = 'd' + Math.max(0, Math.min(6, Math.floor(num(x.dia))));
    let valor = x.valor === null || x.valor === '' || x.valor === undefined ? null : Math.max(0, Math.round(num(x.valor)));
    let tabla;
    if (x.tipo === 'ainavillo') { tabla = c.ainavillo[d] || (c.ainavillo[d] = {}); if (valor === null) valor = 0; }
    else if (x.tipo === 'piso') { const suc = x.suc === 'ainavillo' ? 'ainavillo' : 'barros'; c.pisos[suc] = c.pisos[suc] || {}; tabla = c.pisos[suc][d] || (c.pisos[suc][d] = {}); }
    else return;
    const antes = tabla[x.receta] === undefined ? (x.tipo === 'ainavillo' ? 0 : null) : tabla[x.receta];
    if (antes === valor) return;
    tabla[x.receta] = valor;
    entradas.push({ tipo: x.tipo, suc: x.tipo === 'ainavillo' ? 'ainavillo' : (x.suc === 'ainavillo' ? 'ainavillo' : 'barros'), dia: +d.slice(1), receta: s(x.receta), antes, despues: valor, por: s(por), en: s(en) });
  });
  c.historial = c.historial.concat(entradas);
  return { cfg: c, entradas };
}
export const fijoAinavillo = (cfg, dia, receta) => num((((cfg || {}).ainavillo || {})['d' + dia] || {})[receta]);
export const pisoDe = (cfg, suc, dia, receta) => { const v = ((((cfg || {}).pisos || {})[suc] || {})['d' + dia] || {})[receta]; return v === null || v === undefined || v === '' ? null : num(v); };

// Sugerencia sobre un piso (Barros): con las 4 referencias (detalleLote)
//   subir: en 2 o más se vendió todo lo recibido (sin merma ni sobrante) o se agotó, y lo recibido no pasó del piso
//   bajar: el piso pasa la mediana de lo vendido y en 3 o más la merma fue de 20 % o más
export function sugerenciaPiso(piso, cuatro) {
  if (piso === null || piso === undefined) return null;
  const con = (cuatro || []).filter(x => x && !x.sinDatos && x.recibido > 0);
  if (con.length < 2) return { accion: '', texto: 'Faltan datos para revisar el piso.' };
  const med = mediana(con.map(x => x.vendido));
  const todo = con.filter(x => (x.agotado || (x.vendido >= x.recibido && x.merma === 0 && x.quedo === 0)) && x.recibido <= piso);
  if (todo.length >= 2) return { accion: 'subir', texto: `Se vendió todo en ${todo.length} de ${con.length} días con ${piso} o menos: conviene subirlo (mediana vendida ${Math.round(med)}).`, sugerido: Math.max(piso + 1, Math.ceil(med * 1.1)) };
  const altas = con.filter(x => x.mermaPct !== null && x.mermaPct >= 20);
  if (piso > med && altas.length >= 3) return { accion: 'bajar', texto: `Merma de 20 % o más en ${altas.length} de ${con.length} días y el piso pasa lo vendido (mediana ${Math.round(med)}): conviene bajarlo.`, sugerido: Math.max(0, Math.round(med)) };
  return { accion: '', texto: 'El piso calza con lo que muestran los datos.' };
}

// ── Propuesta de la semana (por día de horneado y tipo de pan) ──
// datos: { b2b (b2bPorDia), refBarros (receta, fecha) → detalleLote | null, cfg, recetas: [{ id, nombre }], hoy }
export function propuestaSemana(lunesProx, datos) {
  const hasta = sumarDias(datos.hoy, -1), dias = semanaDe(lunesProx);
  return dias.map(t => {
    const i = indiceDia(t), b2b = estimarB2B(datos.b2b, t, datos.hoy);
    const filas = datos.recetas.map(r => {
      const bar = estimarB2C(f => datos.refBarros(r.id, f), t, hasta);
      const pisoB = pisoDe(datos.cfg, 'barros', i, r.id), pisoA = pisoDe(datos.cfg, 'ainavillo', i, r.id);
      const barros = bar.estimado === null ? (pisoB === null ? 0 : pisoB) : (pisoB !== null ? Math.max(bar.estimado, pisoB) : bar.estimado);
      const fijo = fijoAinavillo(datos.cfg, i, r.id), aina = pisoA !== null ? Math.max(fijo, pisoA) : fijo;
      // Si ya hay órdenes para ese día (pedidas con anticipación), manda lo pedido cuando es más que lo estimado
      const est = num(b2b.porReceta[r.id]), pedido = num((datos.b2b.porDia[t] || {})[r.id]), b = Math.max(est, pedido);
      return { receta: r.id, nombre: r.nombre, b2b: b, b2bEstimado: est, b2bPedido: pedido, barros, ainavillo: aina, fijo, total: b + barros + aina, detalleBarros: bar,
        pisoBarros: pisoB, pisoAinavillo: pisoA, porPisoBarros: pisoB !== null && (bar.estimado === null || pisoB > bar.estimado), sugerencia: sugerenciaPiso(pisoB, bar.cuatro) };
    }).filter(f => f.total > 0 || f.detalleBarros.base !== null || f.fijo > 0 || f.pisoBarros !== null);
    return { fecha: t, indice: i, amasado: sumarDias(t, -1), masaMadre: sumarDias(t, -2), b2b, filas, total: filas.reduce((a, f) => a + f.total, 0) };
  });
}

// Masa madre del día 0 para lo propuesto (se amasa el día 1 y se hornea el día 2), con la lógica de Cocina sin tocarla:
// pieMasaMadre de cocina/modelo.js con todos los días como días de elaboración, sin reserva y sin las materias primas de
// "pie" (así cuenta toda la masa madre, no solo el pie), para el día de amasado (fecha + 1).
// CM: { pieMasaMadre }, ajustesDe(fecha) → { recetaId: ajuste }
export function masaMadre(semana, { recetas, mps, config }, CM, ajustesDe) {
  if (!CM || typeof CM.pieMasaMadre !== 'function') return { disponible: false, porDia: {} };
  const planes = {};
  semana.forEach(d => d.filas.forEach(f => {
    if (!(f.total > 0)) return;
    const am = d.amasado, lun = lunesDe(am), p = planes[lun] || (planes[lun] = { area: 'PAN', lunes: lun, filas: {} });
    const fila = p.filas[f.receta] || (p.filas[f.receta] = {}); fila['d' + indiceDia(am)] = (fila['d' + indiceDia(am)] || 0) + f.total;
  }));
  const pc = (config && config.pie_mm) || {};
  const ctx = { recetas: recetas || [], mps: (mps || []).filter(m => !/pie de mm|pie de masa madre/.test(s(m.nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())),
    config: { ...(config || {}), pie_mm: { mm_madura_pct: 20, agua_pct: 90, ...pc, dias_elaboracion: [0, 1, 2, 3, 4, 5, 6], reserva_pct: 0 } } };
  const porDia = {};
  semana.forEach(d => {
    let r = null;
    try { r = CM.pieMasaMadre(d.masaMadre, planes, ajustesDe, ctx); } catch (e) { r = null; }
    porDia[d.fecha] = { fecha: d.masaMadre, blanca: r ? Math.round(r.blanca.total) : 0, integral: r ? Math.round(r.integral.total) : 0 };
  });
  return { disponible: true, porDia };
}

// ── "Cómo nos fue": una semana (lunes) por tipo de pan y tienda ──
// datos: { lotes (lotes().porReceta), tarjetas (tarjetasPorLote), producido (producidoPorDia), b2b (b2bPorDia), costos: { receta: costoUnit } }
export function semanaPasada(lunes, datos) {
  const dias = semanaDe(lunes), recetas = new Set();
  dias.forEach(f => {
    SUCS.forEach(suc => Object.keys(((datos.lotes[suc] || {})[f]) || {}).forEach(r => recetas.add(r)));
    Object.keys(datos.producido[f] || {}).forEach(r => recetas.add(r));
    Object.keys(datos.b2b.porDia[f] || {}).forEach(r => recetas.add(r));
  });
  const costo = r => num((datos.costos || {})[r]);
  const filas = [...recetas].map(r => {
    const porDia = dias.map(f => {
      const tiendas = {};
      SUCS.forEach(suc => { const l = ((datos.lotes[suc] || {})[f] || {})[r]; const tj = (((datos.tarjetas || {})[suc] || {})[f] || {})[r]; tiendas[suc] = l ? detalleLote(l, tj) : null; });
      const p = (datos.producido[f] || {})[r];
      return { fecha: f, producido: p ? p.cant : null, hecho: p ? p.hecho : false, b2b: num((datos.b2b.porDia[f] || {})[r]), tiendas };
    });
    const tot = { producido: 0, b2b: 0, tiendas: {} };
    SUCS.forEach(suc => { tot.tiendas[suc] = { recibido: 0, merma: 0, quedo: 0, vendido: 0, fresco: 0, rebajado: 0, vendidoReg: 0, diasReg: 0, agotados: 0, dias: 0 }; });
    porDia.forEach(d => {
      tot.producido += num(d.producido); tot.b2b += d.b2b;
      SUCS.forEach(suc => { const x = d.tiendas[suc], T = tot.tiendas[suc]; if (!x) return; T.dias++; T.recibido += x.recibido; T.merma += x.merma; T.quedo += x.quedo; T.vendido += x.vendido;
        if (x.registrado) { T.diasReg++; T.fresco += x.fresco; T.rebajado += x.rebajado; T.vendidoReg += x.vendido; if (x.agotado) T.agotados++; } });
    });
    SUCS.forEach(suc => { const T = tot.tiendas[suc]; T.mermaPct = T.recibido > 0 ? T.merma / T.recibido * 100 : null; T.rebajadoPct = T.vendidoReg > 0 ? T.rebajado / T.vendidoReg * 100 : null; });
    const mermaU = SUCS.reduce((a, suc) => a + tot.tiendas[suc].merma, 0);
    tot.costoProducido = costo(r) * tot.producido; tot.costoMerma = costo(r) * mermaU; tot.conCosto = costo(r) > 0;
    return { receta: r, porDia, tot };
  });
  const T = { recibido: 0, merma: 0, vendido: 0, rebajado: 0, vendidoReg: 0, costoMerma: 0, costoProducido: 0, producido: 0, b2b: 0, hayReg: false };
  filas.forEach(f => { T.producido += f.tot.producido; T.b2b += f.tot.b2b; T.costoMerma += f.tot.costoMerma; T.costoProducido += f.tot.costoProducido;
    SUCS.forEach(suc => { const x = f.tot.tiendas[suc]; T.recibido += x.recibido; T.merma += x.merma; T.vendido += x.vendido; T.rebajado += x.rebajado; T.vendidoReg += x.vendidoReg; if (x.diasReg) T.hayReg = true; }); });
  T.mermaPct = T.recibido > 0 ? T.merma / T.recibido * 100 : null;
  T.rebajadoPct = T.vendidoReg > 0 ? T.rebajado / T.vendidoReg * 100 : null;
  return { lunes, dias, filas, total: T };
}
// Tendencia: % de merma y % rebajado (donde se sabe) por semana, de la más antigua a la más nueva
export function tendencia(lunesLista, datos) {
  return lunesLista.map(l => { const x = semanaPasada(l, datos).total; return { lunes: l, mermaPct: x.mermaPct, rebajadoPct: x.hayReg ? x.rebajadoPct : null, recibido: x.recibido }; });
}

// ── Texto para copiar (WhatsApp, correo) ──
export function textoPropuesta(semana, nombres, mm) {
  const L = [`Propuesta de Panadería · semana del ${semanaTxt(semana[0].fecha)}`];
  semana.forEach(d => {
    L.push('', `${fechaLarga(d.fecha)} (se amasa ${fechaCorta(d.amasado)})`);
    if (!d.filas.length) { L.push('  Sin pan propuesto'); return; }
    d.filas.forEach(f => L.push(`  ${nombres[f.receta] || f.nombre || f.receta}: ${f.total} (B2B ${f.b2b} · Barros ${f.barros} · Ainavillo ${f.ainavillo})`));
    L.push(`  Total: ${d.total}`);
    const m = mm && mm.porDia && mm.porDia[d.fecha];
    if (m && (m.blanca || m.integral)) L.push(`  Masa madre ${fechaCorta(m.fecha)} 19:00: ${m.blanca ? `blanca ${Math.round(m.blanca).toLocaleString('es-CL')} g` : ''}${m.blanca && m.integral ? ' · ' : ''}${m.integral ? `integral ${Math.round(m.integral).toLocaleString('es-CL')} g` : ''}`);
  });
  return L.join('\n');
}
