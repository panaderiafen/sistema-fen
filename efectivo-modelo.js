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
    ['anticipo', 'Anticipo de sueldo', 'trabajador'],   // v0.124.9: queda por unir a la liquidación del mes
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
  if (tipo === 'conteo') {
    mov.motivo = 'conteo';
    // v0.122.0 · Un conteo que corrige uno anterior mal hecho: la diferencia es un error de conteo, no un faltante
    if (f.corrige) {
      if (!DIA.test(String(f.corrigeDia || ''))) return { error: 'No se encontró el conteo que se corrige.' };
      mov.corrige = { dia: f.corrigeDia, inicial: !!f.corrigeInicial };
    }
    return { mov };
  }
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
  // v0.124.9 · Anticipo de sueldo: el trabajador de Gastos → Equipo; espera la liquidación de ese mes
  if (m[2] === 'trabajador') {
    const t = f.trabajador || {};
    if (!limpio(t.nombre, 120) || !limpio(t.clave, 60)) return { error: 'Elija el trabajador.' };
    mov.detalle = limpio(t.nombre, 120); mov.trabajador = { clave: limpio(t.clave, 60), rutN: limpio(t.rutN, 20), nombre: mov.detalle };
    mov.mesSueldo = dia.slice(0, 7); mov.estado = 'por_unir';
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

// v0.124.9 · Cómo se llega a lo que debería haber, mes a mes (Emmanuel, 4 nov). fin = lo que debería haber al terminar el mes (o hoy).
// inicio = fin − lo que entró + lo que salió − las diferencias de los conteos del mes. Lo anulado no cuenta (su saldo ya se devolvió).
export const TEXTO_ENTRA = { retiro_caja: 'Retiros de las cajas', efectivo_b2b: 'Efectivo de clientes B2B', aporte_dueno: 'Aporte del dueño', otro_ingreso: 'Otros ingresos' };
export const TEXTO_SALE = { deposito: 'Depósitos al banco', pago: 'Pagos en efectivo', anticipo: 'Anticipos de sueldo', sencillo_caja: 'Sencillo a las cajas', retiro_dueno: 'Retiro del dueño', faltante: 'Faltó al recibir', otro_salida: 'Otras salidas' };
export function cuadreMes(movs, fin) {
  const ent = {}, sal = {}; let entro = 0, salio = 0, conteos = 0, faltante = 0, nFalt = 0, ult = null, inicial = false;
  (movs || []).forEach(m => {
    if (!m || m.anulado) return;
    const n = Math.round(Number(m.monto) || 0);
    if (m.tipo === 'conteo') { conteos += Math.round(Number(m.diferencia) || 0); if (m.inicial) inicial = true; if (!ult || (m.dia || '') > ult.dia || ((m.dia || '') === ult.dia && ms(m.creado) >= ms(ult.creado))) ult = m; return; }
    if (m.tipo === 'ingreso') { entro += n; const k = TEXTO_ENTRA[m.motivo] ? m.motivo : 'otro_ingreso'; ent[k] = (ent[k] || 0) + n; }
    else if (m.tipo === 'salida') { salio += n; const k = TEXTO_SALE[m.motivo] ? m.motivo : 'otro_salida'; sal[k] = (sal[k] || 0) + n; if (m.motivo === 'faltante') { faltante += n; nFalt++; } }
  });
  const f = Math.round(Number(fin) || 0);
  const orden = (o, T) => Object.keys(T).filter(k => o[k]).map(k => [T[k], o[k]]);
  return { inicio: f - entro + salio - conteos, fin: f, entro, salio, conteos, conteoInicial: inicial, entradas: orden(ent, TEXTO_ENTRA), salidas: orden(sal, TEXTO_SALE), faltante, nFalt,
    ultimoConteo: ult ? { dia: ult.dia, monto: Math.round(Number(ult.monto) || 0), diferencia: Math.round(Number(ult.diferencia) || 0) } : null };
}
// Meses (del más nuevo al más antiguo) con su cuadre, encadenados desde lo que debería haber hoy. porMes: { 'aaaa-mm': [movs] }
export function cuadreMeses(porMes, meses, saldoHoy) {
  let fin = Math.round(Number(saldoHoy) || 0); const out = [];
  [...meses].sort().reverse().forEach(k => { const c = cuadreMes(porMes[k] || [], fin); out.push({ mes: k, ...c }); fin = c.inicio; });
  return out;
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
  if (m.tipo === 'conteo' && m.corrige) p.push(`corrige el conteo${m.corrige.inicial ? ' inicial' : ''} del ${m.corrige.dia.split('-').reverse().join('-')} ${m.diferencia != null ? ` · error de conteo ${m.diferencia > 0 ? '+' : ''}${Math.round(m.diferencia).toLocaleString('es-CL')} (no es faltante)` : ''}`);
  else if (m.tipo === 'conteo') p.push(m.inicial ? 'conteo inicial' : `diferencia ${m.diferencia > 0 ? '+' : ''}${Math.round(m.diferencia || 0).toLocaleString('es-CL')}`);
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
// v0.122.0 · Lo que había antes de un movimiento, dado el saldo que quedó después
export const saldoAntesDe = (m, despues) => (m.tipo === 'conteo' ? Math.round(Number(m.saldoAntes) || 0) : despues - efecto(m));
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

// v0.124.6 · "folio 3538" u "orden N° 2815" (pagada por orden, antes de tener folio)
export const refB2b = x => (x && !x.folio && x.orden ? `orden N° ${x.orden}` : `folio ${(x && x.folio) || ''}`);
// v0.120.0 · Efectivo de un cliente B2B que queda por recibir (efectivo_por_recibir), desde Cobranza.
export function movDesdePendiente(x) {
  if (!x || x.anulado) return null;
  const monto = Math.round(Number(x.monto) || 0);
  if (!(monto > 0) || !DIA.test(String(x.dia || ''))) return null;
  if (x.origen !== 'b2b') return null;
  return { tipo: 'ingreso', motivo: 'efectivo_b2b', monto, dia: x.dia, mes: x.dia.slice(0, 7),
    detalle: limpio(`${x.cliente || 'Cliente B2B'} · ${refB2b(x)}`, 120), nota: limpio(x.nota, 200),
    origen: { pendienteId: String(x.id || ''), folio: String(x.folio || ''), ...(x.orden ? { orden: String(x.orden) } : {}), por: String(x.por || '') } };
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

// ═══════════════════════════════════════════════
//  v0.123.0 · Unir cada pago en efectivo a su documento en Gastos, cada depósito a su abono de la cartola, y Retiros por semana.
//  Aprobado por Emmanuel el 1 nov (boceto). Puro: lo usan la pantalla y las pruebas.
// ═══════════════════════════════════════════════
// Lo que la caja anota cuando un cierre no cuadra (los mismos de la caja v3.0.0, efectivo-caja.js)
export const MOTIVOS_DESCUADRE = { vuelto: 'Vuelto mal dado', retiro_sin_anotar: 'Retiro sin anotar', venta_sin_registrar: 'Venta sin registrar', no_se: 'No sé', otro: 'Otro' };
export const textoDescuadre = k => MOTIVOS_DESCUADRE[k] || (k ? String(k) : 'Sin motivo anotado');
export const META_FONDO = 25000;   // el fondo que queda en cada caja al cerrar (FONDO_SUGERIDO de la caja)
const DIA_OK = d => DIA.test(String(d || ''));
export const diasEntre = (a, b) => (DIA_OK(a) && DIA_OK(b) ? Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5) : NaN);
export const sumarDias = (d, k) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + k)).toISOString().slice(0, 10);
// "DD-MM-AAAA" (cajas antiguas) o "AAAA-MM-DD" → "AAAA-MM-DD"
export const diaNormal = f => { const t = String(f || ''); if (DIA.test(t)) return t; const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

// ── 1. Pagos por unir a su documento ──
// Un pago a proveedor que espera su boleta o factura: de la caja de administración (Salida · Pago en efectivo) o de una caja de
// venta (retiro "Pago a proveedor", caja_movimientos). m.col dice de dónde viene ('caja_movimientos' o nada).
export const esDeCaja = m => !!m && m.col === 'caja_movimientos';
export const esPagoPorUnir = m => !!m && !m.anulado && m.estado === 'por_unir' && (esDeCaja(m) ? m.tipo === 'retiro' && m.motivo === 'pago_proveedor' : m.tipo === 'salida' && (m.motivo === 'pago' || m.motivo === 'anticipo'));
export const esAnticipo = m => !!m && !esDeCaja(m) && m.tipo === 'salida' && m.motivo === 'anticipo';
// De qué efectivo salió (va al pago en Gastos)
export const origenEfectivo = m => (esDeCaja(m) ? 'caja_' + String(m.sucursal || '') : CUENTA);
export const textoOrigenEfectivo = m => (esDeCaja(m) ? 'Caja ' + (textoSucursal(m.sucursal) || '') : 'Caja de administración');
// La clave del pago en Gastos: sale del movimiento (dos clics o un reintento no pagan dos veces)
export const claveUnion = m => 'ef_' + (esDeCaja(m) ? 'cm_' : '') + String(m.id || '');
// "Boleta 4471" · "Factura 1203" · "Sin documento"
export function textoDocumento(d) {
  if (!d) return '';
  const t = String(d.tipoTexto || '').trim() || 'Documento', f = String(d.folio || '').trim();
  return f ? `${t} ${f}` : t;
}
const N = t => String(t == null ? '' : t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const digitos = t => String(t == null ? '' : t).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const VACIAS = new Set(['SPA', 'LTDA', 'EIRL', 'LIMITADA', 'SOCIEDAD', 'COMERCIAL', 'COMERCIALIZADORA', 'EMPRESA', 'EMPRESAS', 'SERVICIOS', 'CHILE', 'DEL', 'LOS', 'LAS', 'CIA']);
const palabras = t => N(t).split(' ').filter(w => w.length >= 3 && !VACIAS.has(w));
// ¿El texto anotado ("A quién se le pagó") es del proveedor del documento? Por su RUT o por una palabra del nombre.
export function mismoProveedor(texto, d) {
  const rut = digitos(String((d && (d.rutN || d.rut)) || '').toUpperCase().replace(/K$/, '')), dt = digitos(texto);
  if (rut.length >= 7 && dt.includes(rut.slice(0, -1))) return true;
  const a = palabras(texto), b = new Set(palabras(d && d.razon));
  return a.some(w => b.has(w)) || (N(texto).length >= 4 && N(d && d.razon).includes(N(texto)));
}
// docs: los de Gastos para unir (gn-fs.docsParaEfectivo): { id, razon, rut, folio, tipoTexto, fecha, total, saldo, estado: 'pendiente' | 'pagado_efectivo', pagoId?, pagoMonto? }
// → [{ d, calza, mismo, folioOk, dias, puede, monto }] lo más probable primero. Sin búsqueda: los del mismo proveedor o N°, y los que
// calzan por monto (±$5) en el mes. Con búsqueda: lo que diga el texto (nombre, RUT, N° o tipo).
export const TOL_UNIR = 5;
export function candidatosUnir(mov, docs, q = '') {
  const monto = Math.round(Number(mov && mov.monto) || 0), folio = digitos(mov && mov.documento);
  // v0.124.9 · Un anticipo de sueldo va a la liquidación de ese trabajador: calza si es la del mes y trae anticipos que lo cubren
  if (esAnticipo(mov) && !String(q || '').trim()) {
    const rut = String((mov.trabajador && mov.trabajador.rutN) || '');
    return (docs || []).filter(d => d.origen === 'liquidacion' && d.estado === 'pendiente' && (rut ? String(d.rutN || '') === rut : mismoProveedor(mov.detalle, d))).map(d => {
      const base = Math.round(Number(d.saldo) || 0), ant = Math.round(Number(d.anticipos) || 0), delMes = String(d.fecha || '').slice(0, 7) === mov.mesSueldo;
      const calza = delMes && ant > 0 && monto <= ant + TOL_UNIR && monto <= base + TOL_UNIR;
      return { d, calza, mismo: true, folioOk: false, dias: Math.abs(diasEntre(d.fecha, mov.dia)) || 0, puede: monto <= base + TOL_UNIR, monto: Math.min(monto, base), sinAnticipo: delMes && !ant };
    }).sort((a, b) => (b.calza - a.calza) || a.dias - b.dias);
  }
  const l = (docs || []).map(d => {
    const base = d.estado === 'pagado_efectivo' ? Math.round(Number(d.pagoMonto) || 0) : Math.round(Number(d.saldo) || 0);
    const calza = Math.abs(base - monto) <= TOL_UNIR, dias = Math.abs(diasEntre(d.fecha, mov.dia));
    // Lo que se paga: lo del movimiento (sin pasarse de lo que falta del documento)
    const puede = d.estado === 'pagado_efectivo' ? calza : monto <= base + TOL_UNIR;
    return { d, calza, mismo: mismoProveedor(mov && mov.detalle, d), folioOk: !!folio && digitos(d.folio) === folio, dias: isNaN(dias) ? 999 : dias, puede, monto: d.estado === 'pagado_efectivo' ? base : Math.min(monto, base) };
  });
  const t = N(q), tq = /^[\d.\s-]+$/.test(String(q || '').trim()) ? digitos(q) : '';   // un N° escrito con o sin ceros adelante
  const pasa = t ? (x => N([x.d.razon, x.d.rut, x.d.folio, x.d.tipoTexto].join(' ')).includes(t) || (!!tq && digitos(x.d.folio) === tq))
    : (x => x.mismo || x.folioOk || (x.calza && x.dias <= 31));
  const peso = x => (x.calza && (x.mismo || x.folioOk) ? 4 : 0) + (x.folioOk ? 2 : 0) + (x.calza ? 1.5 : 0) + (x.mismo ? 1 : 0);
  return l.filter(pasa).sort((a, b) => peso(b) - peso(a) || a.dias - b.dias || String(a.d.razon).localeCompare(String(b.d.razon))).slice(0, 40);
}
// El texto "Unido · boleta 4471" de un movimiento unido
export const textoUnido = m => (m && m.unido ? 'Unido · ' + (m.unido.cartolaMovId ? `abono del ${String(m.unido.abonoDia || '').split('-').reverse().slice(0, 2).join('-')}` : String(m.unido.documento || 'su documento').toLowerCase()) : '');

// ── 2. Depósitos que se unen solos con la cartola ──
export const esDepositoAbierto = m => !!m && !m.anulado && m.tipo === 'salida' && m.motivo === 'deposito' && (m.estado === 'por_unir' || m.estado === 'uniendo');
export const CUENTA_DEL_BANCO = { bancoestado_cc: 'cc', bancoestado_chequera: 'chequera' };
export const DIAS_DEPOSITO = 3;   // el banco lo muestra el mismo día o hasta 3 días después
// ¿Este abono de la cartola (B2B → Conciliación) es este depósito? Mismo monto, la misma cuenta y de 0 a 3 días después.
export function calzaDeposito(abono, dep) {
  if (!abono || !esDepositoAbierto(dep) || Math.round(Number(abono.monto) || 0) !== Math.round(Number(dep.monto) || 0)) return false;
  const c = CUENTA_DEL_BANCO[dep.banco];
  if (c && (abono.cuenta || 'chequera') !== c) return false;
  const d = diasEntre(dep.dia, String(abono.fecha || '').slice(0, 10));
  return d >= 0 && d <= DIAS_DEPOSITO;
}
const diceDeposito = a => /\bDEP(OSITO)?S?\b/.test(N(a && a.descripcion));
// Cada depósito con a lo más un abono (y al revés): primero los que ya se estaban uniendo; después el que dice DEPOSITO y la fecha más cercana.
// → { abonoId: depósito }
export function parearDepositos(abonos, deps) {
  const out = {}, usados = new Set(), libres = (abonos || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  (deps || []).filter(d => esDepositoAbierto(d) && d.estado === 'uniendo' && d.unido && d.unido.cartolaMovId).forEach(d => {
    if (libres.some(a => a.id === d.unido.cartolaMovId) && !out[d.unido.cartolaMovId]) { out[d.unido.cartolaMovId] = d; usados.add(d.id); }
  });
  libres.filter(a => !out[a.id]).forEach(a => {
    const c = (deps || []).filter(d => !usados.has(d.id) && d.estado === 'por_unir' && calzaDeposito(a, d))
      .sort((x, y) => diasEntre(x.dia, a.fecha) - diasEntre(y.dia, a.fecha));
    if (c.length && (c.length === 1 || diceDeposito(a) || diasEntre(c[0].dia, a.fecha) < diasEntre(c[1].dia, a.fecha))) { out[a.id] = c[0]; usados.add(c[0].id); }
  });
  return out;
}

// ── 3. Retiros por semana (de lunes a domingo) ──
export function lunesDe(dia) { const d = new Date(Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10))), k = (d.getUTCDay() + 6) % 7; return sumarDias(dia, -k); }
// evals: evaluacion_caja de la semana; cmovs: caja_movimientos de la semana (por su día). → { porSuc: { barros_arana, ainavillo }, motivos }
export function resumirSemana(evals, cmovs, lunes) {
  const fin = sumarDias(lunes, 6), en = d => d >= lunes && d <= fin;
  const vacia = () => ({ cierres: 0, retiroCierre: 0, retirosAbierta: { monto: 0, n: 0 }, pagos: { monto: 0, n: 0 }, sencillo: { monto: 0, n: 0 }, descuadres: { n: 0, suma: 0 }, fondo: { enMeta: 0, n: 0 } });
  const porSuc = { barros_arana: vacia(), ainavillo: vacia() }, motivos = [];
  // Un cierre por caja (si se corrigió o se cerró dos veces, el último)
  const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0));
  const ult = {};
  (evals || []).forEach(e => { const k = e.cajaId || e.id; if (!ult[k] || ms(e.cierre) >= ms(ult[k].cierre)) ult[k] = e; });
  Object.values(ult).forEach(e => {
    const dia = diaNormal(e.fecha), s = porSuc[e.sucursal]; if (!s || !en(dia)) return;
    s.cierres++;
    s.retiroCierre += Math.round(Number(e.montoRetirado) || 0);
    const fondo = e.fondo != null ? e.fondo : e.saldoSiguiente;
    if (fondo != null && !e.sinArqueo) { s.fondo.n++; if (Math.round(Number(fondo) || 0) === META_FONDO) s.fondo.enMeta++; }
    const dif = Math.round(Number(e.difEfectivo) || 0);
    if (dif && !e.sinArqueo) { s.descuadres.n++; s.descuadres.suma += dif; motivos.push({ motivo: e.motivoDescuadre || '', texto: textoDescuadre(e.motivoDescuadre), sucursal: e.sucursal, dia, monto: dif, nota: String(e.notaDescuadre || '') }); }
  });
  (cmovs || []).forEach(x => {
    const s = porSuc[x.sucursal]; if (!s || x.anulado || !en(String(x.dia || ''))) return;
    const n = Math.round(Number(x.monto) || 0);
    if (x.tipo === 'retiro' && x.motivo === 'caja_admin') { s.retirosAbierta.monto += n; s.retirosAbierta.n++; }
    else if (x.tipo === 'retiro' && x.motivo === 'pago_proveedor') { s.pagos.monto += n; s.pagos.n++; }
    else if (x.tipo === 'ingreso' && x.motivo === 'sencillo_admin') { s.sencillo.monto += n; s.sencillo.n++; }
  });
  motivos.sort((a, b) => a.texto.localeCompare(b.texto, 'es') || a.dia.localeCompare(b.dia) || a.sucursal.localeCompare(b.sucursal));
  return { lunes, domingo: fin, porSuc, motivos };
}
