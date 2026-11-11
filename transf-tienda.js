// ═══════════════════════════════════════════════
//  Sistema Fën — Transferencias de la tienda  v0.125.0
//  Une los abonos de la cartola que son ventas de la tienda cobradas por transferencia con su venta de la caja,
//  y arma el cuadre de cada día (lo que la caja cobró por transferencia contra lo que llegó al banco).
//  Solo cálculo: no lee ni escribe nada (las lecturas están en caja.js y b2b.js). Pedido por Emmanuel el 10 nov.
//  · Una venta cuenta como transferencia si se cobró con ese medio, o la parte en transferencia de un pago dividido.
//  · El abono se busca entre las ventas del mismo día y de hasta 3 días antes (lo transferido tarde, o en fin de
//    semana, llega después). Listo = una sola venta con el monto exacto (o el nombre de quien transfiere en la glosa).
//  · Una venta por transferencia sin su abono espera 3 días; después queda "sin abono" en el cuadre.
// ═══════════════════════════════════════════════

export const NAT_TIENDA = 'venta_tienda';
export const DIAS_ANTES = 3;     // un abono puede ser de una venta de hasta 3 días antes
export const DIAS_ESPERA = 3;    // una venta sin abono espera 3 días antes de quedar "sin abono"

const ent = v => Math.round(Number(v) || 0);
const dos = n => String(n).padStart(2, '0');
export const diaDe = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
// La fecha de una venta (Timestamp de Firestore, Date, milisegundos o texto) → 'AAAA-MM-DD' local
export function diaVenta(v) {
  const f = v && v.fecha;
  if (!f) return '';
  if (typeof f === 'string') return /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : '';
  const d = typeof f.toDate === 'function' ? f.toDate() : f instanceof Date ? f : typeof f.seconds === 'number' ? new Date(f.seconds * 1000) : typeof f === 'number' ? new Date(f) : null;
  return d && !isNaN(d) ? diaDe(d) : '';
}
export function horaVenta(v) {
  const f = v && v.fecha; if (!f || typeof f === 'string') return '';
  const d = typeof f.toDate === 'function' ? f.toDate() : f instanceof Date ? f : typeof f.seconds === 'number' ? new Date(f.seconds * 1000) : null;
  return d && !isNaN(d) ? `${dos(d.getHours())}:${dos(d.getMinutes())}` : '';
}
const ms = dia => { const [y, m, d] = String(dia).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); };
export const diasEntre = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);   // b − a, en días
export const sumarDias = (dia, n) => { const [y, m, d] = String(dia).split('-').map(Number); return diaDe(new Date(y, m - 1, d + n)); };

// Lo cobrado por transferencia en una venta (0 si no tiene, o si está anulada)
export function montoTransfer(v) {
  if (!v || v.anulada) return 0;
  if (Array.isArray(v.pagos) && v.pagos.length) return v.pagos.filter(p => p && p.medio === 'transferencia').reduce((a, p) => a + ent(p.monto), 0);
  return v.medioPago === 'transferencia' ? ent(v.total) : 0;
}
export const esDividida = v => !!(v && Array.isArray(v.pagos) && v.pagos.length);

// Palabras de un texto, sin tildes ni signos (para comparar el nombre de quien transfiere con la glosa)
export const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'TEF', 'TRANSFERENCIA', 'DESDE', 'BANCO', 'BANCOESTADO', 'SPA', 'LTDA']);
// El nombre anotado en la caja aparece en la glosa: al menos 2 de sus palabras (o la única, si tiene una de 4+ letras)
export function nombreEnGlosa(nombre, glosa) {
  const pal = norm(nombre).split(' ').filter(p => p.length >= 3 && !VACIAS.has(p));
  if (!pal.length) return false;
  const g = new Set(norm(glosa).split(' '));
  const n = pal.filter(p => g.has(p)).length;
  return pal.length === 1 ? pal[0].length >= 4 && n === 1 : n >= 2;
}

// La venta tal como se guarda en el abono (lo justo para mostrarla sin volver a leer la caja)
export const fotoVenta = v => ({ ventaId: String(v.id), dia: diaVenta(v), hora: horaVenta(v), sucursal: String(v.sucursal || ''), monto: montoTransfer(v),
  cajaId: String(v.cajaId || ''), usuario: String(v.usuario || ''), nombre: String(v.transferNombre || '').slice(0, 60) });

// Las ventas que pueden ser este abono: por transferencia, sin otro abono, del mismo día o de hasta 3 días antes.
// unidas: Set de ventaId ya unidas a otro abono. Orden: el nombre en la glosa, el monto exacto, la diferencia, el día más cercano.
export function candidatas(abono, ventas, unidas = new Set()) {
  const dA = String(abono && abono.fecha || '').slice(0, 10), mA = ent(abono && abono.monto);
  if (!dA) return [];
  return (ventas || []).filter(v => montoTransfer(v) > 0 && !unidas.has(String(v.id)))
    .map(v => { const dia = diaVenta(v), atras = dia ? diasEntre(dia, dA) : 99, monto = montoTransfer(v);
      return { v, dia, atras, monto, dif: mA - monto, exacto: monto === mA, nombre: !!v.transferNombre && nombreEnGlosa(v.transferNombre, abono.descripcion) }; })
    .filter(c => c.atras >= 0 && c.atras <= DIAS_ANTES)
    .sort((a, b) => (b.nombre - a.nombre) || (b.exacto - a.exacto) || (Math.abs(a.dif) - Math.abs(b.dif)) || (a.atras - b.atras) || String(a.v.id).localeCompare(String(b.v.id)));
}
// La propuesta: { clase: 'listo' | 'revisar' | '', c (la candidata), motivo }
//  · listo: el nombre en la glosa con el monto exacto, o una sola venta con el monto exacto en esos días;
//  · revisar: una venta exacta entre varias iguales, o una parecida (±$5.000 o 20%), para elegir a mano.
export function propuesta(abono, ventas, unidas) {
  const l = candidatas(abono, ventas, unidas);
  if (!l.length) return { clase: '', c: null, motivo: '' };
  const c = l[0], exactas = l.filter(x => x.exacto);
  if (c.exacto && (c.nombre || exactas.length === 1)) return { clase: 'listo', c, motivo: c.nombre ? 'el nombre de quien transfirió está en la glosa y el monto es exacto' : 'es la única venta por transferencia de ese monto en esos días' };
  if (c.exacto) return { clase: 'revisar', c, motivo: `hay ${exactas.length} ventas por transferencia de ese monto en esos días: elija cuál` };
  const tope = Math.max(5000, Math.round(ent(abono.monto) * 0.2));
  if (Math.abs(c.dif) <= tope) return { clase: 'revisar', c, motivo: `difiere en ${c.dif > 0 ? '+' : '−'}$${Math.abs(c.dif).toLocaleString('es-CL')}` };
  return { clase: '', c: null, motivo: '' };
}

// ── El cuadre ──
// ventas: las ventas de la caja (se usan las que tienen transferencia). abonos: los abonos marcados "venta de tienda"
// (con ventaTienda = fotoVenta, o null si no se unió a ninguna). hoy: 'AAAA-MM-DD'. desde/hasta: el período (días de la venta).
// Devuelve { dias: [{ dia, caja, banco, dif, estado }], ventasSinAbono, diferencias, abonosSinVenta, esperando, totales }.
export function cuadre({ ventas = [], abonos = [], hoy, desde, hasta }) {
  const enRango = d => !!d && (!desde || d >= desde) && (!hasta || d <= hasta);
  const porVenta = new Map(); abonos.forEach(a => { const t = a.ventaTienda; if (t && t.ventaId) porVenta.set(String(t.ventaId), a); });
  const D = {}, dia = d => (D[d] = D[d] || { dia: d, caja: 0, banco: 0, fuera: 0, nCaja: 0, nBanco: 0, sinAbono: 0, conDif: 0, sinVenta: 0, esperando: 0 });
  const ventasSinAbono = [], diferencias = [], abonosSinVenta = [], esperando = [], fueraDelBanco = [];
  ventas.forEach(v => {
    const m = montoTransfer(v), d = diaVenta(v); if (!m || !enRango(d)) return;
    const x = dia(d); x.caja += m; x.nCaja++;
    const a = porVenta.get(String(v.id));
    if (a) { x.banco += ent(a.monto); x.nBanco++; if (ent(a.monto) !== m) { x.conDif++; diferencias.push({ venta: v, abono: a, dif: ent(a.monto) - m }); } }
    else if (v.transfRevision && v.transfRevision.estado) { x.fuera += m; fueraDelBanco.push(v); }   // llegó a otra cuenta: resuelta, no espera abono
    else if (hoy && diasEntre(d, hoy) <= DIAS_ESPERA) { x.esperando++; esperando.push(v); }
    else { x.sinAbono++; ventasSinAbono.push(v); }
  });
  abonos.forEach(a => {
    const t = a.ventaTienda;
    if (t && t.ventaId && ventas.some(v => String(v.id) === String(t.ventaId))) return;   // ya contado con su venta
    const d = t && t.dia ? t.dia : String(a.fecha || '').slice(0, 10); if (!enRango(d)) return;
    const x = dia(d); x.banco += ent(a.monto); x.nBanco++;
    if (!t || !t.ventaId) { x.sinVenta++; abonosSinVenta.push(a); }
  });
  // dif = lo que llegó (al banco o, anotado, a otra cuenta) − lo que la caja cobró por transferencia; lo que espera no cuenta como diferencia
  const espM = d => esperando.filter(v => diaVenta(v) === d).reduce((s, v) => s + montoTransfer(v), 0);
  const dias = Object.values(D).filter(x => x.nCaja || x.nBanco).sort((a, b) => b.dia.localeCompare(a.dia)).map(x => ({ ...x, dif: x.banco + x.fuera + espM(x.dia) - x.caja,
    estado: x.sinAbono ? 'sin_abono' : x.sinVenta ? 'sin_venta' : x.conDif ? 'con_dif' : x.esperando ? 'esperando' : 'cuadra' }));
  const sum = k => dias.reduce((s, x) => s + x[k], 0);
  const totales = { caja: sum('caja'), banco: sum('banco'), fuera: sum('fuera'), nCaja: sum('nCaja'), nBanco: sum('nBanco') };
  return { dias, ventasSinAbono, diferencias, abonosSinVenta, esperando, fueraDelBanco, totales, noCuadran: ventasSinAbono.length + abonosSinVenta.length };
}
export const ESTADO_DIA = { cuadra: ['Cuadra', 'c-verde'], con_dif: ['Cuadra con diferencia', 'c-amarillo'], esperando: ['Esperando el banco', 'c-gris'], sin_abono: ['Venta sin abono', 'c-rojo'], sin_venta: ['Abono sin venta', 'c-amarillo'] };
