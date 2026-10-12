// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos en la base nueva (etapa G3, cuarta parte): reglas puras  v0.51.0
//  · Previred con la base nueva (lo mismo que SistemaFen.gs: cot_estado, cot_registrar, cot_lista) y la regla acordada:
//    el certificado COMPLETA el vencimiento de la obligación "Cotizaciones" del período (tipo documento con identificador
//    "previred", o cuyo nombre o ítem dice cotizaciones). Los gastos por trabajador se crean al PAGAR ese vencimiento
//    (Pagar o la cartola), no al subir el certificado. Sin esa obligación o sin su vencimiento abierto: como hoy (los
//    gastos al subir) y una nota que sugiere crear la obligación.
//  · Clasificar obligaciones (el fin de semana del cambio): una propuesta de tipo e identificador para cada obligación.
//  · Arreglo "siniva" (opcional, una vez): gastos de 2026 nacidos de pagar una obligación "Sin IVA" que quedaron como
//    bruto (neto = final / 1,19) → neto = final.
//  Sin red: se prueba sola. Fechas aaaa-mm-dd (hora de Chile).
// ═══════════════════════════════════════════════
import { dia, huella, idLimpio } from './gastos-modelo.js?v=0.51.0';
import * as M from './gastos-g2.js?v=0.51.0';
import * as G3 from './gastos-g3.js?v=0.51.0';

const s = v => String(v == null ? '' : v);
const sinTildes = t => s(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const mayus = t => sinTildes(t).toUpperCase();
const n = v => M.n(v);
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// ═══ Previred ═══
export const ID_PREVIRED = 'previred';
export const esIdentPrevired = v => /^\s*previred\s*$/i.test(s(v));
export const RE_COTIZ = /COTIZ|PREVIRED|IMPOSIC/;
const pareceCotiz = d => RE_COTIZ.test(mayus(s(d.nombre) + ' ' + s(d.item)));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = periodo => { const [a, m] = s(periodo).split('-'); return MESES[+m - 1] ? `${MESES[+m - 1]} ${a}` : s(periodo); };
// Igual que sfCotTipo (SistemaFen.gs) y previred.js
export function tipoLinea(inst) {
  const t = s(inst).toUpperCase();
  if (/SEGURO SOCIAL|\(SIS\)/.test(t)) return { tipo: 'Seguro social', cargo: 'Empleador' };
  if (/SEGURIDAD LABORAL|\bISL\b|MUTUAL|ACHS|\bIST\b/.test(t)) return { tipo: 'Accidentes', cargo: 'Empleador' };
  if (/\(AFC\)|CESANT/.test(t)) return { tipo: 'AFC', cargo: 'Mixto' };
  if (/FONASA|ISAPRE|SALUD|BANMEDICA|COLMENA|CONSALUD|CRUZ BLANCA|MASVIDA|VIDA TRES|ESENCIAL/.test(t)) return { tipo: 'Salud', cargo: 'Trabajador' };
  if (/COTIZACION OBLIGATORIA|AHORRO|APV|CUENTA 2|VOLUNTARI/.test(t)) return { tipo: 'AFP', cargo: 'Trabajador' };
  return { tipo: 'Otro', cargo: 'Otro' };
}
export const claveLinea = (periodo, rut, inst, tipoPago, folio) => [periodo, s(rut).toUpperCase(), s(inst).toUpperCase(), tipoPago, folio].join('|');
// Ids como la copia G1 (gastos-modelo.js): así lo copiado de la planilla y lo nuevo se reconocen igual
export const idCotizacion = clave => 'c-' + huella(s(clave));
const rutClave = r => s(r).trim().toUpperCase().replace(/[^0-9K-]/g, '');
export const idTrabajador = rut => idLimpio(rutClave(rut));
const rutOk = r => /^\d{1,2}\.?\d{3}\.?\d{3}-[\dK]$/.test(s(r).trim().toUpperCase());
const periodoDe = v => { const t = s(v).trim(); if (/^\d{4}-\d{2}$/.test(t)) return t; const d = dia(t); return d ? d.slice(0, 7) : ''; };

// cot_estado: áreas e ítems recordados (por RUT) y qué claves pedidas ya estaban cargadas
export function estadoCot(cotizaciones, trabajadores, claves) {
  const config = {};
  (trabajadores || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.rut)).forEach(({ d }) => { config[s(d.rut).toUpperCase()] = { nombre: s(d.nombre), area: s(d.area), item: s(d.item) }; });
  const ya = new Set((cotizaciones || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.clave)).map(x => s(x.d.clave)));
  return { ok: true, config, yaCargadas: (Array.isArray(claves) ? claves.slice(0, 2000).map(String) : []).filter(k => ya.has(k)) };
}

// cot_registrar: revisa como sfCotRegistrar. items: ítems vigentes (lista). Devuelve { error, code } o { limpios, total, lineas }
export function revisarRegistro(p, items, cotizaciones) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s(p.periodo))) return { error: 'Falta el período', code: 'datos' };
  if (!M.esIso(p.fechaPago) || !M.esIso(p.fecha)) return { error: 'Faltan las fechas', code: 'datos' };
  const T = Array.isArray(p.trabajadores) ? p.trabajadores : [];
  if (!T.length || T.length > 80) return { error: 'El PDF no trae trabajadores', code: 'datos' };
  const lista = {}; (items || []).forEach(i => { lista[i.item] = i; });
  const ya = new Set((cotizaciones || []).filter(x => x.d && !x.d.quitadoEnPlanilla).map(x => s(x.d.clave)));
  const limpios = [], repetidos = [], vistas = new Set();
  for (const t of T) {
    const rut = s(t && t.rut).trim().toUpperCase(), nombre = M.texto(t && t.nombre, 80);
    if (!rutOk(rut) || !nombre) return { error: 'Trabajador no válido', code: 'datos' };
    if (!M.AREAS.includes(s(t.area))) return { error: nombre + ': elige el área', code: 'datos' };
    const ref = lista[s(t.item)];
    if (!ref) return { error: nombre + ': el ítem no está en la lista de ítems', code: 'datos' };
    const L = Array.isArray(t.lineas) ? t.lineas : [];
    if (!L.length || L.length > 40) return { error: nombre + ': sin líneas', code: 'datos' };
    const lineas = [];
    for (const l of L) {
      const inst = M.texto(l && l.institucion, 80), tp = s(l && l.tipoPago), folio = s(l && l.folio), monto = Math.round(n(l && l.monto)), imp = Math.round(n(l && l.imponible));
      if (!inst || !['REM', 'GRA', 'RET', 'LEY'].includes(tp) || !/^\d{1,20}$/.test(folio) || !(monto >= 0) || !(imp >= 0)) return { error: nombre + ': una línea no es válida', code: 'datos' };
      const clave = claveLinea(p.periodo, rut, inst, tp, folio);
      if (vistas.has(clave)) return { error: nombre + ': una línea viene dos veces', code: 'datos' };
      vistas.add(clave);
      if (ya.has(clave) && !repetidos.includes(nombre)) repetidos.push(nombre);
      lineas.push({ institucion: inst, tipoPago: tp, folio, monto, imponible: imp, clave, ...tipoLinea(inst) });
    }
    limpios.push({ rut, nombre, area: s(t.area), ref, lineas, total: lineas.reduce((x, l) => x + l.monto, 0) });
  }
  if (repetidos.length) return { error: 'Ese período ya estaba cargado para: ' + repetidos.join(', ') + '. No se guardó nada.', code: 'duplicado' };
  return { limpios, total: limpios.reduce((x, t) => x + t.total, 0), lineas: limpios.reduce((x, t) => x + t.lineas.length, 0) };
}
// La observación del gasto de cada trabajador (como el script)
export function obsTrabajador(periodo, t) {
  const suma = tipo => t.lineas.filter(l => l.tipo === tipo).reduce((x, l) => x + l.monto, 0);
  const emp = t.lineas.filter(l => l.cargo === 'Empleador').reduce((x, l) => x + l.monto, 0);
  return 'Previred ' + nombreMes(periodo) + ' · ' + t.nombre + ' · AFP $' + suma('AFP') + ' · Salud $' + suma('Salud') + ' · AFC $' + suma('AFC') + ' · Empleador $' + emp + (suma('Otro') ? ' · Otros $' + suma('Otro') : '');
}
// Documentos de la hoja "Cotizaciones" (una por línea), con los nombres de campo de la copia G1
export const docsCotizacion = (p, limpios, url, en, por, extra = {}) => limpios.flatMap(t => t.lineas.map(l => ({ id: idCotizacion(l.clave), d: {
  periodo: p.periodo, fechaPago: p.fechaPago, rut: t.rut, nombre: t.nombre, institucion: l.institucion, tipo: l.tipo, cargo: l.cargo, tipoPago: l.tipoPago,
  imponible: l.imponible, monto: l.monto, folioPlanilla: l.folio, area: t.area, item: t.ref.item, archivo: s(url), cargadoEl: s(en), cargadoPor: s(por) || 'Sistema Fën', clave: l.clave, ...extra } })));
export const docTrabajador = (t, hoy) => ({ id: idTrabajador(t.rut), d: { rut: t.rut, nombre: t.nombre, area: t.area, item: t.ref.item, actualizado: s(hoy) } });
// El plan de gastos por trabajador que guarda el vencimiento (se usan al pagarlo)
export const planTrabajadores = (p, limpios) => limpios.map(t => ({ rut: t.rut, nombre: t.nombre, area: t.area, item: t.ref.item, categoria: s(t.ref.categoria), tipo: s(t.ref.tipo), subTipo: s(t.ref.subTipo), total: t.total, obs: obsTrabajador(p.periodo, t) }));
// Un gasto por trabajador (sin IVA, contado). plan = documento.previred = { periodo, fecha, trabajadores }
export function lineasPrevired(plan, fechaPago, url, hora, extra = {}) {
  return (plan.trabajadores || []).map(t => M.docGasto({ fecha: plan.fecha, hora, itemGasto: t.item, categoria: t.categoria, tipo: t.tipo, subTipo: t.subTipo, area: t.area,
    tipoMonto: 'siniva', montoNeto: n(t.total), montoFinal: n(t.total), esHarina: 'No', formaPago: 'contado', fechaPago, archivo: '', observacion: t.obs, urlFoto: s(url) },
  { ...extra, previred: { periodo: s(plan.periodo), rut: s(t.rut) } }));
}

// La obligación "Cotizaciones": activa, de tipo documento, con identificador "previred" (primero) o con cotizaciones en el
// nombre o el ítem. Devuelve { obl } o { motivo } (ninguna o más de una).
export function obligacionCotizaciones(plantillas) {
  const act = (plantillas || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.estado || 'ACTIVA') === 'ACTIVA');
  const conId = act.filter(x => esIdentPrevired(x.d.identificador));
  if (conId.length === 1) return { obl: conId[0] };
  if (conId.length > 1) return { motivo: `Hay ${conId.length} obligaciones con identificador Previred` };
  const porNombre = act.filter(x => s(x.d.tipoObligacion) === 'documento' && pareceCotiz(x.d));
  if (porNombre.length === 1) return { obl: porNombre[0] };
  if (porNombre.length > 1) return { motivo: `Hay ${porNombre.length} obligaciones de cotizaciones según documento` };
  return { motivo: 'No hay una obligación de Cotizaciones según documento' };
}
export const DIAS_VENTANA = 45;   // el vencimiento debe estar a menos de 45 días de la fecha de pago del certificado
// El vencimiento que completa el certificado: abierto, sin documento ni abonos, el más cercano a la fecha de pago
export function destinoCertificado(plantillas, vencs, fechaPago) {
  const o = obligacionCotizaciones(plantillas);
  if (!o.obl) return { motivo: o.motivo };
  const pid = s(o.obl.d.id) || o.obl.id, v = G3.elegirVencimiento(vencs, pid, fechaPago);
  if (!v || Math.abs(diasEntre(dia(v.d.fechaVencimiento) || fechaPago, fechaPago)) > DIAS_VENTANA)
    return { obl: o.obl, motivo: `"${s(o.obl.d.nombre)}" no tiene un vencimiento por completar cerca del ${fechaPago.split('-').reverse().join('-')}` };
  return { obl: o.obl, venc: v };
}
// Lo que el certificado deja en el vencimiento (completarDocumento con tipo "previred")
export function documentoPrevired(p, limpios, url, nombreArchivo, clave) {
  return { tipo: 'previred', monto: limpios.reduce((x, t) => x + t.total, 0), fechaVencimiento: p.fechaPago, url: s(url), nombreArchivo: s(nombreArchivo), numero: nombreMes(p.periodo), clave: s(clave) };
}
// Al pagar: las líneas de un vencimiento. Con el certificado de Previred, un gasto por trabajador (el total debe ser el del
// certificado); si no, las de siempre (con la factura del SII, si la tiene). v: vistaVencimiento; a: el documento de la base.
export function lineasDelPago(v, a, monto, fechaPago, obs, url, tipoMonto, hora) {
  const doc = a && a.documento;
  if (doc && doc.tipo === 'previred' && doc.previred && Array.isArray(doc.previred.trabajadores)) {
    const total = doc.previred.trabajadores.reduce((x, t) => x + n(t.total), 0);
    if (Math.round(n(monto)) !== total) return { error: `El pago de Previred debe ser el total del certificado ($${total.toLocaleString('es-CL')}).` };
    return { lineas: lineasPrevired(doc.previred, fechaPago, url, hora, { vencimientoId: v.id }) };
  }
  return { lineas: G3.conDocumentoSii(M.lineasPago(v, monto, fechaPago, obs, url, tipoMonto, hora), a) };
}

// cot_lista: períodos cargados (últimos 24), con el costo por trabajador (como sfCotLista)
export function listaCot(cotizaciones) {
  const per = {};
  (cotizaciones || []).filter(x => x.d && !x.d.quitadoEnPlanilla).forEach(({ d }) => {
    const pk = periodoDe(d.periodo); if (!pk) return;
    const P = per[pk] || (per[pk] = { periodo: pk, fechaPago: dia(d.fechaPago) || s(d.fechaPago), archivo: s(d.archivo), total: 0, trabajadores: {}, vencimientoId: '' });
    if (!P.archivo && d.archivo) P.archivo = s(d.archivo);
    if (d.vencimientoId) P.vencimientoId = s(d.vencimientoId);
    const rut = s(d.rut), T = P.trabajadores[rut] || (P.trabajadores[rut] = { rut, nombre: s(d.nombre), area: s(d.area), imponible: 0, afp: 0, salud: 0, afc: 0, empleador: 0, otro: 0, total: 0 });
    const m = n(d.monto), tipo = s(d.tipo), cargo = s(d.cargo);
    T.total += m; P.total += m; T.imponible = Math.max(T.imponible, n(d.imponible));
    if (tipo === 'AFP') T.afp += m; else if (tipo === 'Salud') T.salud += m; else if (tipo === 'AFC') T.afc += m; else if (cargo === 'Empleador') T.empleador += m; else T.otro += m;
  });
  return { ok: true, periodos: Object.keys(per).sort().reverse().slice(0, 24).map(k => ({ ...per[k], trabajadores: Object.values(per[k].trabajadores) })) };
}

// ═══ Clasificar obligaciones ═══
const RE_SUELDO = /REMUNERAC|SUELDO|LIQUIDO|HONORARIO/;
const RE_SERVICIO = /\bLUZ\b|\bAGUA\b|\bGAS\b|INTERNET|TELEFON|CELULAR|\bCGE\b|ESSBIO|\bENEL\b|CHILQUINTA|SAESA|FRONTEL|METROGAS|LIPIGAS|ABASTIBLE|GASCO|MOVISTAR|ENTEL|\bCLARO\b|\bVTR\b|\bWOM\b|\bGTD\b|TELSUR|ELECTRIC|NUEVOSUR|AGUAS /;
// Palabras que no sirven para reconocer un proveedor
const GENERICAS = new Set(['SPA', 'LTDA', 'LIMITADA', 'SOCIEDAD', 'EMPRESA', 'EMPRESAS', 'CHILE', 'SERVICIOS', 'SERVICIO', 'COMERCIAL', 'COMERCIALIZADORA', 'INVERSIONES', 'ANONIMA', 'DISTRIBUIDORA', 'DISTRIBUCION', 'PAGO', 'CUENTA', 'MENSUAL', 'PRUEBA', 'CUOTA', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'S', 'A', 'SA', 'EIRL']);
const palabras = t => mayus(t).replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !GENERICAS.has(w) && !/^\d+$/.test(w));
// Números del nombre que parecen N° de cliente (5 o más dígitos; "2.020.220" cuenta como 2020220)
export function numerosDelNombre(nombre) {
  const out = [];
  (s(nombre).match(/\d[\d.\-]{3,}\d/g) || []).forEach(x => { const d = x.replace(/[.\-]/g, ''); if (d.length >= 5 && d.length <= 20 && !out.includes(d)) out.push(d); });
  return out;
}
// Proveedores del SII cuyo nombre calza con el de la obligación (una palabra distintiva en común)
export function proveedoresQueCalzan(p, proveedores) {
  const mias = new Set(palabras(s(p.nombre) + ' ' + s(p.item)));
  if (!mias.size) return [];
  return (proveedores || []).filter(x => s(x.rut) && palabras(x.razonSocial).some(w => mias.has(w)));
}
// pagos: [{ fecha, monto }] del más reciente al más antiguo. Devuelve { tipo, identificador, opciones, motivo, segura }
export function proponer(p, pagos, proveedores) {
  const txt = mayus(s(p.nombre) + ' ' + s(p.item)), montos = (pagos || []).map(x => Math.round(n(x.monto))).filter(x => x > 0);
  const nums = numerosDelNombre(p.nombre), actual = s(p.identificador).trim();
  const conActual = l => (actual && !l.includes(actual) ? [actual].concat(l) : l);
  if (RE_COTIZ.test(txt)) return { tipo: 'documento', identificador: ID_PREVIRED, opciones: [ID_PREVIRED], motivo: 'Cotizaciones: el certificado de Previred completa su vencimiento', segura: true };
  if (RE_SUELDO.test(txt)) return { tipo: 'libre', identificador: '', opciones: [], motivo: 'Sueldo: se paga con abonos (transferencias)', segura: true };
  if (RE_SERVICIO.test(txt)) {
    const prov = proveedoresQueCalzan(p, proveedores), ops = conActual(nums.concat(prov.map(x => s(x.rut))).filter((x, i, a) => a.indexOf(x) === i));
    return { tipo: 'documento', identificador: actual || ops[0] || '', opciones: ops, motivo: 'Cuenta de servicio (luz, agua, gas, internet o teléfono)' + (ops.length > 1 ? ': elige el N° de cliente' : !ops.length ? ': falta el N° de cliente' : ''), segura: true };
  }
  const prov = proveedoresQueCalzan(p, proveedores);
  if (prov.length) {
    const ops = conActual(prov.map(x => s(x.rut)));
    return { tipo: 'documento', identificador: actual || ops[0], opciones: ops, motivo: `El SII tiene facturas de ${prov.map(x => s(x.razonSocial)).slice(0, 2).join(', ')}`, segura: prov.length === 1 };
  }
  const u3 = montos.slice(0, 3);
  if (u3.length === 3 && u3.every(x => x === u3[0])) return { tipo: 'fijo', identificador: '', opciones: [], motivo: `Los últimos 3 pagos fueron de $${u3[0].toLocaleString('es-CL')}`, segura: true };
  if (montos.length >= 3) {
    const prom = montos.reduce((a, b) => a + b, 0) / montos.length, var_ = Math.max(...montos) / Math.min(...montos);
    if (var_ >= 1.5 || montos.some(x => Math.abs(x - prom) / prom > 0.3)) return { tipo: 'libre', identificador: '', opciones: [], motivo: 'Los montos pagados cambian mucho', segura: false };
    return { tipo: 'documento', identificador: actual || nums[0] || '', opciones: conActual(nums), motivo: 'Los montos cambian un poco cada mes (como una cuenta)', segura: false };
  }
  return { tipo: 'fijo', identificador: '', opciones: nums, motivo: montos.length ? 'Pocos pagos para comparar' : 'Sin pagos para comparar', segura: false };
}
// Pagos de cada obligación (vencimientos pagados), del más reciente al más antiguo
export function pagosPorObligacion(vencs) {
  const out = {};
  (vencs || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.plantillaID) && G3.estadoBase(x.d) === 'pagado').forEach(({ d }) => {
    const m = Math.round(n(d.montoPago)); if (!(m > 0)) return;
    (out[s(d.plantillaID)] = out[s(d.plantillaID)] || []).push({ fecha: dia(d.fechaPago) || dia(d.fechaVencimiento), monto: m });
  });
  Object.values(out).forEach(l => l.sort((a, b) => s(b.fecha).localeCompare(s(a.fecha))));
  return out;
}
// Proveedores del SII (de sii_docs y de las fichas), sin repetir RUT
export function proveedoresSii(siiDocs, fichas) {
  const m = new Map();
  (siiDocs || []).forEach(({ d }) => { const r = s(d && (d.rut || d.rutProveedor)).trim(); if (r && !m.has(r.toUpperCase())) m.set(r.toUpperCase(), { rut: r, razonSocial: s(d.razonSocial) }); });
  (fichas || []).forEach(({ id, d }) => { const r = s(d && d.rutTexto) || id; if (r && !m.has(r.toUpperCase())) m.set(r.toUpperCase(), { rut: r, razonSocial: s(d && d.razonSocial) }); });
  return [...m.values()];
}
// Lista para la pantalla: obligaciones activas con sus pagos y la propuesta
export function listaClasificar(plantillas, vencs, proveedores, hoy) {
  const pagos = pagosPorObligacion(vencs);
  return (plantillas || []).filter(x => x.d && !x.d.quitadoEnPlanilla && s(x.d.estado || 'ACTIVA') === 'ACTIVA').map(x => {
    const v = M.vistaPlantilla(x.id, x.d, vencs, hoy), pg = pagos[v.id] || [];
    return { id: v.id, nombre: v.nombre, item: v.item, montoEstimado: n(v.montoEstimado), tipoMonto: v.tipoMonto, tipoObligacion: s(x.d.tipoObligacion), identificador: s(x.d.identificador), diasAviso: x.d.diasAviso === undefined ? '' : x.d.diasAviso,
      sinClasificar: G3.sinClasificar(x.d), pagos: pg.slice(0, 6), propuesta: proponer(v, pg, proveedores) };
  }).sort((a, b) => (a.sinClasificar === b.sinClasificar ? 0 : a.sinClasificar ? -1 : 1) || a.nombre.localeCompare(b.nombre));
}

// ═══ Arreglo "siniva" (opcional, una vez, después del cambio) ═══
// Gastos de un año (2026) nacidos de pagar una obligación con Tipo Monto "siniva" que quedaron como bruto:
// tipo "bruto" y neto = round(final / 1,19). Se reconocen por su vencimiento (vencimientoId) o, lo copiado de la planilla
// (la app antigua no guardaba el vencimiento), por el vencimiento pagado de esa obligación con el mismo ítem, la misma
// fecha (la del vencimiento) y la misma fecha de pago, sin pasarse de su monto pagado.
export function planSiniva(gastos, vencs, plantillas, anio = 2026) {
  const obl = {}; (plantillas || []).filter(x => x.d && !x.d.quitadoEnPlanilla).forEach(x => { obl[s(x.d.id) || x.id] = x.d; });
  const venc = {}; (vencs || []).filter(x => x.d && !x.d.quitadoEnPlanilla).forEach(x => { venc[x.id] = x.d; if (s(x.d.id)) venc[s(x.d.id)] = x.d; });
  const esSiniva = v => v && s(v.plantillaID) && (s((obl[s(v.plantillaID)] || {}).tipoMonto) === 'siniva');
  const candidato = g => g.estado === 'vigente' && !g.quitadoEnPlanilla && s(g.fecha).slice(0, 4) === String(anio) && s(g.tipoMonto || 'bruto') === 'bruto' && s(g.esHarina) !== 'Sí'
    && n(g.montoFinal) > 0 && n(g.montoNeto) === Math.round(n(g.montoFinal) / 1.19) && n(g.montoNeto) !== n(g.montoFinal) && s(g.formaPago || 'contado') === 'contado';
  const out = [], usados = {};
  // Vencimientos pagados de obligaciones sin IVA, por ítem + fecha + fecha de pago (para lo copiado de la planilla)
  const porClave = {};
  Object.entries(venc).forEach(([id, v]) => {
    if (!esSiniva(v) || G3.estadoBase(v) !== 'pagado' || id !== (s(v.id) || id)) return;
    const k = mayus(v.item) + '|' + dia(v.fechaVencimiento) + '|' + dia(v.fechaPago);
    (porClave[k] = porClave[k] || []).push({ id, v, resto: Math.round(n(v.montoPago)) });
  });
  (gastos || []).slice().sort((a, b) => a.id.localeCompare(b.id)).forEach(({ id, d: g }) => {
    if (!candidato(g)) return;
    let v = null, vid = '';
    if (s(g.vencimientoId)) { vid = s(g.vencimientoId); v = venc[vid]; if (!esSiniva(v)) return; }
    else {
      const l = porClave[mayus(g.itemGasto) + '|' + dia(g.fecha) + '|' + dia(g.fechaPago)] || [];
      const x = l.find(y => y.resto >= Math.round(n(g.montoFinal)));
      if (!x) return;
      x.resto -= Math.round(n(g.montoFinal)); v = x.v; vid = x.id;
    }
    if (usados[id]) return; usados[id] = true;
    const final = Math.round(n(g.montoFinal));
    out.push({ id, fecha: dia(g.fecha), item: s(g.itemGasto), area: s(g.area), obligacion: s((obl[s(v.plantillaID)] || {}).nombre || v.nombre), vencimientoId: vid,
      montoFinal: final, netoAntes: Math.round(n(g.montoNeto)), netoNuevo: final, diferencia: final - Math.round(n(g.montoNeto)), version: Number(g.version) || 0 });
  });
  return { lista: out, total: out.reduce((x, y) => x + y.diferencia, 0), n: out.length };
}
// Los campos que cambia el arreglo en un gasto (si sigue igual que en la vista previa)
export function camposSiniva(g) {
  const final = Math.round(n(g.montoFinal));
  if (s(g.tipoMonto || 'bruto') !== 'bruto' || n(g.montoNeto) !== Math.round(final / 1.19)) return null;
  return { tipoMonto: 'siniva', montoNeto: final };
}
