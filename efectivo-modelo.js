// ═══════════════════════════════════════════════
//  Sistema Fën — Efectivo · modelo (sin Firestore)  v0.120.0
//  La caja de administración (cuenta 1.1.6 del plan de gestión): el efectivo que sale de las cajas al cerrar
//  y el de los clientes B2B; sale a depósitos al banco y a pagos en efectivo. Aprobado por Emmanuel el 30 oct.
//  Cada movimiento: { tipo 'ingreso' | 'salida' | 'conteo', motivo, monto (siempre positivo), dia 'AAAA-MM-DD',
//  mes 'AAAA-MM', sucursal?, detalle?, documento?, banco?, estado? ('por_unir'), diferencia? (conteo) }.
//  El saldo vive en efectivo/caja_admin y cambia en la misma transacción que el movimiento.
// ═══════════════════════════════════════════════

export const CUENTA = 'caja_admin';
export const MAX_MONTO = 50000000;

// [clave, texto, pide]  pide: 'sucursal' | 'proveedor' | 'banco' | ''
export const MOTIVOS = {
  ingreso: [
    ['retiro_caja', 'Retiro de una caja (cierre)', 'sucursal'],
    ['efectivo_b2b', 'Efectivo de un cliente B2B', 'detalle'],
    ['aporte_dueno', 'Aporte del dueño', ''],
    ['otro_ingreso', 'Otro', 'detalle'],
  ],
  salida: [
    ['deposito', 'Depósito al banco', 'banco'],
    ['pago', 'Pago en efectivo', 'proveedor'],
    ['sencillo_caja', 'Sencillo a una caja', 'sucursal'],
    ['retiro_dueno', 'Retiro del dueño', ''],
    ['otro_salida', 'Otro', 'detalle'],
  ],
};
export const SUCURSALES = [['barros_arana', 'Barros Arana'], ['ainavillo', 'Ainavillo']];
export const BANCOS = [['bancoestado_cc', 'BancoEstado cuenta corriente'], ['bancoestado_chequera', 'BancoEstado chequera']];

const motivoDe = (tipo, k) => (MOTIVOS[tipo] || []).find(m => m[0] === k);
// v0.120.0 · Motivos que solo nacen al recibir (no están en los botones de Ingreso o Salida)
export const MOTIVOS_RECEPCION = { faltante: 'Faltante al recibir' };
export const textoMotivo = (tipo, k) => (tipo === 'conteo' ? 'Conteo' : ((motivoDe(tipo, k) || [])[1] || MOTIVOS_RECEPCION[k] || k || ''));
export const textoSucursal = k => (SUCURSALES.find(s => s[0] === k) || [])[1] || '';
export const textoBanco = k => (BANCOS.find(s => s[0] === k) || [])[1] || '';

// Lo que el movimiento suma (+) o resta (−) al saldo. El conteo no suma: deja el saldo en lo contado.
export function efecto(m) {
  if (!m || m.anulado) return 0;
  const n = Math.round(Number(m.monto) || 0);
  return m.tipo === 'ingreso' ? n : m.tipo === 'salida' ? -n : 0;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const limpio = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
// Acepta "18.500", "$18500", "18500"
export function leerMonto(t) {
  const s = String(t == null ? '' : t).replace(/[$\s.]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(Number(s));
}

// Revisa lo que viene del formulario → { error } o { mov } listo para guardar (sin quién ni cuándo)
export function revisar(f, hoy) {
  const tipo = f.tipo;
  if (!['ingreso', 'salida', 'conteo'].includes(tipo)) return { error: 'Tipo de movimiento desconocido.' };
  const monto = leerMonto(f.monto);
  if (!(monto >= 0) || (tipo !== 'conteo' && monto <= 0)) return { error: tipo === 'conteo' ? 'Escriba cuánto contó (puede ser 0).' : 'Escriba un monto mayor que 0.' };
  if (monto > MAX_MONTO) return { error: 'El monto es demasiado grande. Revíselo.' };
  const dia = f.dia || hoy;
  if (!DIA.test(dia)) return { error: 'La fecha no es válida.' };
  if (hoy && dia > hoy) return { error: 'La fecha no puede ser futura.' };
  const mov = { tipo, monto, dia, mes: dia.slice(0, 7), nota: limpio(f.nota, 200) };
  if (tipo === 'conteo') { mov.motivo = 'conteo'; return { mov }; }
  const m = motivoDe(tipo, f.motivo);
  if (!m) return { error: 'Elija el motivo.' };
  mov.motivo = m[0];
  if (m[2] === 'sucursal') {
    if (!SUCURSALES.some(s => s[0] === f.sucursal)) return { error: 'Elija de qué caja.' };
    mov.sucursal = f.sucursal;
  }
  if (m[2] === 'banco') {
    if (!BANCOS.some(s => s[0] === f.banco)) return { error: 'Elija la cuenta del banco.' };
    mov.banco = f.banco; mov.estado = 'por_unir';
  }
  if (m[2] === 'proveedor') {
    const p = limpio(f.detalle, 120);
    if (p.length < 2) return { error: 'Escriba a quién se le pagó.' };
    mov.detalle = p; mov.documento = limpio(f.documento, 40); mov.estado = 'por_unir';
  }
  if (m[2] === 'detalle') {
    const d = limpio(f.detalle, 120);
    if (m[0].startsWith('otro') && d.length < 2) return { error: 'Escriba de qué se trata.' };
    if (d) mov.detalle = d;
  }
  return { mov };
}

// Suma de un mes (sin anulados ni conteos): { entro, salio, n, porMotivo: { clave: monto } }
export function resumirMes(movs) {
  const r = { entro: 0, salio: 0, n: 0, porMotivo: {} };
  (movs || []).forEach(m => {
    if (!m || m.anulado || m.tipo === 'conteo') return;
    const n = Math.round(Number(m.monto) || 0);
    if (m.tipo === 'ingreso') r.entro += n; else r.salio += n;
    r.n++;
    r.porMotivo[m.motivo] = (r.porMotivo[m.motivo] || 0) + n;
  });
  return r;
}

// Orden para mostrar: del más nuevo al más antiguo (día y luego hora de registro)
const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
export function ordenar(movs) {
  return (movs || []).slice().sort((a, b) => (b.dia || '').localeCompare(a.dia || '') || ms(b.creado) - ms(a.creado));
}

// Texto de la línea de detalle de un movimiento
export function detalleTexto(m) {
  const p = [];
  if (m.sucursal) p.push(textoSucursal(m.sucursal));
  if (m.banco) p.push(textoBanco(m.banco));
  if (m.detalle) p.push(m.detalle);
  if (m.documento) p.push('N° ' + m.documento);
  if (m.tipo === 'conteo') p.push(m.inicial ? 'conteo inicial' : `diferencia ${m.diferencia > 0 ? '+' : ''}${Math.round(m.diferencia || 0).toLocaleString('es-CL')}`);
  if (m.nota) p.push(m.nota);
  return p.join(' · ');
}

// Meses a elegir: desde octubre 2026 hasta el mes de hoy (el más nuevo primero)
export function mesesHasta(hoy, desde = '2026-10') {
  const r = [];
  let [y, mm] = hoy.slice(0, 7).split('-').map(Number);
  for (let i = 0; i < 36; i++) {
    const k = `${y}-${String(mm).padStart(2, '0')}`;
    if (k < desde) break;
    r.push(k);
    mm--; if (mm === 0) { mm = 12; y--; }
  }
  return r;
}

// v0.119.0 (caja v3.0.0) · Lo que llega de una caja de venta (caja_movimientos):
//  - un retiro "A la caja de administración" o el retiro del cierre → Ingreso · Retiro de una caja;
//  - un ingreso "Sencillo de la caja de administración" → Salida · Sencillo a una caja.
// → el movimiento de la caja de administración (sin quién ni cuándo), o null si no le corresponde.
export const TEXTO_CAJA = { cierre: 'Retiro al cerrar la caja', caja_admin: 'Retiro con la caja abierta', sencillo_admin: 'Sencillo para la caja' };
export function movDesdeCaja(x) {
  if (!x || x.anulado) return null;
  const monto = Math.round(Number(x.monto) || 0);
  if (!(monto > 0) || !DIA.test(String(x.dia || ''))) return null;
  if (!SUCURSALES.some(s => s[0] === x.sucursal)) return null;
  const base = { monto, dia: x.dia, mes: x.dia.slice(0, 7), sucursal: x.sucursal,
    nota: limpio([TEXTO_CAJA[x.motivo], x.nota].filter(Boolean).join(' · '), 200),
    origen: { cajaMovId: String(x.id || ''), cajaId: String(x.cajaId || ''), por: String(x.por || '') } };
  if (x.tipo === 'retiro' && (x.motivo === 'cierre' || x.motivo === 'caja_admin')) return { tipo: 'ingreso', motivo: 'retiro_caja', ...base };
  if (x.tipo === 'ingreso' && x.motivo === 'sencillo_admin') return { tipo: 'salida', motivo: 'sencillo_caja', ...base };
  return null;
}

// v0.119.1 · El saldo que quedó después de cada movimiento, como en una cartola.
// Se calcula hacia atrás desde el saldo de hoy, en el orden en que se registraron (creado):
// un anulado no mueve el saldo (no lleva saldo); un conteo deja el saldo en lo contado y antes estaba en saldoAntes.
// movs: los del mes que se mira y todos los de los meses siguientes. → { id: saldo }
export function saldosDespues(movs, saldoHoy) {
  const r = {};
  let s = Math.round(Number(saldoHoy) || 0);
  ordenarPorRegistro(movs).reverse().forEach(m => {
    if (m.anulado) return;
    r[m.id] = s;
    s = m.tipo === 'conteo' ? Math.round(Number(m.saldoAntes) || 0) : s - efecto(m);
  });
  return r;
}
const msReg = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
export const ordenarPorRegistro = movs => (movs || []).slice().sort((a, b) => msReg(a.creado) - msReg(b.creado));

// v0.120.0 · Efectivo de un cliente B2B que queda por recibir (efectivo_por_recibir), desde Cobranza.
export function movDesdePendiente(x) {
  if (!x || x.anulado) return null;
  const monto = Math.round(Number(x.monto) || 0);
  if (!(monto > 0) || !DIA.test(String(x.dia || ''))) return null;
  if (x.origen !== 'b2b') return null;
  return { tipo: 'ingreso', motivo: 'efectivo_b2b', monto, dia: x.dia, mes: x.dia.slice(0, 7),
    detalle: limpio(`${x.cliente || 'Cliente B2B'} · folio ${x.folio || ''}`, 120), nota: limpio(x.nota, 200),
    origen: { pendienteId: String(x.id || ''), folio: String(x.folio || ''), por: String(x.por || '') } };
}
// Lo que llega a la caja de administración desde una caja o desde un cobro B2B
export const movPorRecibir = x => (x && x.origen === 'b2b' ? movDesdePendiente(x) : movDesdeCaja(x));

// v0.120.0 · Recibir lo que dejó una caja o un cobro B2B, cuando llega menos (decidido por Emmanuel el 31 oct).
// La diferencia se explica: con pagos en efectivo que se hicieron con esa plata (proveedor y N°; quedan "Por unir"
// a su documento en Gastos) o, si no se sabe, como faltante con su motivo.
// r: { llego, usos: [{ tipo: 'pago', proveedor, documento, monto } | { tipo: 'faltante', detalle, monto }] }
// → { error } o { movs: [el ingreso completo, y una salida por cada uso], falta } (sin quién ni cuándo)
export function revisarRecepcion(base, r) {
  if (!base) return { error: 'Ese movimiento no va a la caja de administración.' };
  const esperado = base.monto;
  const llego = leerMonto(r && r.llego);
  if (!(llego >= 0)) return { error: 'Escriba cuánto llegó (puede ser 0).' };
  if (llego > esperado) return { error: `Llegó más de lo esperado ($${esperado.toLocaleString('es-CL')}). Reciba lo esperado y anote lo que sobra como un Ingreso aparte.` };
  const falta = esperado - llego;
  const usos = (r.usos || []).filter(u => u && (String(u.monto || '').trim() !== '' || String(u.proveedor || u.detalle || '').trim() !== ''));
  const salidas = [];
  for (const u of usos) {
    const monto = leerMonto(u.monto);
    if (!(monto > 0)) return { error: 'Cada parte de la diferencia necesita un monto mayor que 0.' };
    const comun = { tipo: 'salida', monto, dia: base.dia, mes: base.mes, nota: limpio(`Al recibir: ${base.detalle || base.nota || ''}`, 200) };
    if (u.tipo === 'pago') {
      const p = limpio(u.proveedor, 120);
      if (p.length < 2) return { error: 'Escriba a quién se le pagó con esa plata.' };
      salidas.push({ ...comun, motivo: 'pago', detalle: p, documento: limpio(u.documento, 40), estado: 'por_unir' });
    } else if (u.tipo === 'faltante') {
      const d = limpio(u.detalle, 120);
      if (d.length < 2) return { error: 'Escriba qué cree que pasó con lo que falta.' };
      salidas.push({ ...comun, motivo: 'faltante', detalle: d });
    } else return { error: 'Elija en qué se usó cada parte de la diferencia.' };
  }
  const explicado = salidas.reduce((a, m) => a + m.monto, 0);
  if (explicado !== falta) return { error: explicado > falta ? `Lo explicado ($${explicado.toLocaleString('es-CL')}) es más que lo que falta ($${falta.toLocaleString('es-CL')}).` : `Faltan por explicar $${(falta - explicado).toLocaleString('es-CL')} (de $${falta.toLocaleString('es-CL')}).`, falta, explicado };
  return { movs: [base, ...salidas], falta };
}
