// Sistema Fën · Gastos nuevo · Etapa 3: documentos que llegan en PDF (fuera del SII de compras)
// Puro (sin Firebase ni pantalla): lee las líneas que entrega previred.lineasDelPdf (celdas separadas por dos espacios) y arma el documento.
//  · Liquidación de sueldo (la del contador, una por trabajador y mes): lo que se le debe al trabajador = líquido + anticipos (los anticipos
//    ya salieron en otra transferencia: los dos pagos se unen con la misma liquidación). Las cotizaciones entran por Previred; el impuesto
//    único, por el F29. Los datos se buscan por su etiqueta (toleran bonos, colación, transporte y cambios menores de formato).
//  · F29 (formulario completo o certificado): el pago del mes con su reparto por código: IVA y PPM (fuera del resultado), retención de
//    boletas de terceros (costo de los practicantes), impuesto único (costo de los sueldos), multas e intereses (financiero).
import { idDoc, rutN, rutTexto, esIso, mesDe } from './gn-modelo.js?v=0.96.0';

const s = v => (v === null || v === undefined ? '' : String(v));
const celdas = l => s(l).split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
const num = v => { const t = s(v).replace(/[$\s]/g, ''); if (!/^-?[\d.]+(,\d+)?$/.test(t)) return null; const n = Number(t.replace(/\./g, '').replace(',', '.')); return isFinite(n) ? Math.round(n) : null; };
const norm = v => s(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const mesDeTexto = t => { const m = /([A-Za-zÁÉÍÓÚáéíóú]+)\s+(?:DE\s+)?(\d{4})/i.exec(norm(t)); if (!m) return ''; const i = MESES.indexOf(m[1].replace('SETIEMBRE', 'SEPTIEMBRE')); return i < 0 ? '' : `${m[2]}-${String(i + 1).padStart(2, '0')}`; };
const ultimoDia = mes => { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const mesSiguiente = mes => { const [y, m] = mes.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const dmyIso = t => { const m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s(t)); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const textoMes = mes => (/^\d{4}-\d{2}$/.test(mes) ? `${NOMBRE_MES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}` : s(mes));

// ¿Qué PDF es? (las boletas de luz y agua las reconoce boletas.leerBoleta)
export function tipoPdf(lineas) {
  const T = norm((lineas || []).slice(0, 40).join('\n'));
  if (/LIQUIDACION DE (SUELDO|REMUNERACION)/.test(T)) return 'liquidacion';
  if (/FORMULARIO 29|DECLARACION MENSUAL Y PAGO SIMULTANEO/.test(T)) return 'f29';
  return '';
}

// ═══════════════ Liquidación de sueldo ═══════════════
// La celda que sigue a una etiqueta (en cualquier línea desde "desde")
function tras(lineas, re, desde = 0) {
  for (let i = desde; i < lineas.length; i++) { const c = celdas(lineas[i]); const k = c.findIndex(x => re.test(norm(x))); if (k >= 0 && c[k + 1] !== undefined) return c[k + 1]; }
  return '';
}
// El monto de una línea que empieza con su etiqueta (la última celda)
function montoDe(lineas, re) { for (const l of lineas) { const c = celdas(l); if (c.length >= 2 && re.test(norm(c[0]))) { const v = num(c[c.length - 1]); if (v !== null) return v; } } return null; }
// Las líneas con monto entre dos marcas (sin las de subtotal)
function seccion(lineas, ini, fin) {
  const a = lineas.findIndex(l => ini.test(norm(celdas(l)[0] || ''))); if (a < 0) return [];
  const out = [];
  for (let i = a + 1; i < lineas.length; i++) {
    const c = celdas(lineas[i]), et = norm(c[0] || '');
    if (fin.test(et)) break;
    if (c.length < 2 || /^TOTAL|^SUBTOTAL|^IMPONIBLES?$|^NO IMPONIBLES?$/.test(et)) continue;
    const v = num(c[c.length - 1]); if (v === null) continue;
    out.push({ concepto: c.slice(0, -1).join(' ').slice(0, 80), monto: v });
  }
  return out;
}
export function leerLiquidacion(lineas0) {
  const lineas = (lineas0 || []).map(l => s(l).replace(/ /g, ' ')).filter(l => l.trim());
  const r = { tipo: 'liquidacion', nombre: '', rut: '', periodo: '', haberes: [], descuentos: [], totalHaberes: 0, totalDescuentos: 0, liquido: 0, anticipos: 0, impuestoUnico: 0, errores: [], avisos: [] };
  const dt = Math.max(0, lineas.findIndex(l => /DATOS DEL TRABAJADOR/.test(norm(l))));
  r.nombre = tras(lineas, /^NOMBRES?( DEL TRABAJADOR)?$/, dt).slice(0, 100);
  const rt = tras(lineas, /^RUT( TRABAJADOR)?$/, dt); r.rut = /\d/.test(rt) ? rutTexto(rt) : '';
  r.periodo = mesDeTexto(tras(lineas, /^PERIODO$|^MES$/));
  r.haberes = seccion(lineas, /^HABERES$/, /^TOTAL HABERES$/);
  r.descuentos = seccion(lineas, /^DESCUENTOS$/, /^TOTAL DESCUENTOS$/);
  r.totalHaberes = montoDe(lineas, /^TOTAL HABERES$/) || 0;
  r.totalDescuentos = montoDe(lineas, /^TOTAL DESCUENTOS$/) || 0;
  r.liquido = montoDe(lineas, /^(LIQUIDO A PAGAR|ALCANCE LIQUIDO|LIQUIDO A RECIBIR|SUELDO LIQUIDO|LIQUIDO)$/) || 0;
  r.anticipos = r.descuentos.filter(x => /ANTICIPO/.test(norm(x.concepto))).reduce((a, x) => a + x.monto, 0);
  r.impuestoUnico = r.descuentos.filter(x => /IMPUESTO/.test(norm(x.concepto))).reduce((a, x) => a + x.monto, 0);
  if (!r.rut) r.errores.push('No se encontró el RUT del trabajador.');
  if (!r.periodo) r.errores.push('No se encontró el período (mes y año).');
  if (!(r.liquido > 0)) r.errores.push('No se encontró el líquido a pagar.');
  if (r.totalHaberes && r.liquido && Math.abs(r.totalHaberes - r.totalDescuentos - r.liquido) > 2) r.avisos.push(`Total haberes − total descuentos no da el líquido: revise el PDF.`);
  r.bloquea = r.errores.length > 0;
  return r;
}
// Documento: lo que se le debe al trabajador en el mes (líquido + anticipos), en el mes de la liquidación (fecha: su último día)
export function docDeLiquidacion(r, cargaId) {
  const total = r.liquido + r.anticipos, fecha = ultimoDia(r.periodo);
  const detalle = [{ descripcion: 'SUELDO LIQUIDO', cantidad: 0, unidad: '', monto: r.liquido }].concat(r.anticipos ? [{ descripcion: 'ANTICIPOS', cantidad: 0, unidad: '', monto: r.anticipos }] : []);
  return { id: idDoc(r.rut, 'liq', r.periodo.replace('-', '')), origen: 'liquidacion', formato: 'pdf', tipo: 'liq', tipoTexto: 'Liquidación de sueldo', nc: false,
    rut: rutTexto(r.rut), rutN: rutN(r.rut), razon: s(r.nombre).slice(0, 120) || rutTexto(r.rut), folio: '', fecha, mes: r.periodo, neto: total, exento: 0, iva: 0, otroImp: 0, total,
    vence: '', formaPago: '', referencias: [], detalle, descuadre: '', cargaId: s(cargaId), cliente: '', direccion: '', periodo: { desde: r.periodo + '-01', hasta: fecha },
    liquidacion: { haberes: r.haberes.slice(0, 30), descuentos: r.descuentos.slice(0, 30), totalHaberes: r.totalHaberes, totalDescuentos: r.totalDescuentos, liquido: r.liquido, anticipos: r.anticipos, impuestoUnico: r.impuestoUnico } };
}

// ═══════════════ F29 ═══════════════
export const RUT_SII = '60.803.000-K';
// Los ítems del reparto del F29 (Finanzas, Etapa 4: IVA y PPM fuera del resultado; retención = costo de practicantes; impuesto único = sueldos)
export const ITEMS_F29 = { iva: 'IVA (F29)', ppm: 'PPM (F29)', retencion: 'RETENCION BOLETAS DE TERCEROS (F29)', unico: 'IMPUESTO UNICO TRABAJADORES (F29)', otros: 'OTROS IMPUESTOS (F29)', recargos: 'MULTAS E INTERESES (F29)', total: 'IMPUESTOS (F29)' };
export function leerF29(lineas0) {
  const lineas = (lineas0 || []).map(l => s(l).replace(/ /g, ' ')).filter(l => l.trim()), T = norm(lineas.join('\n'));
  const r = { tipo: 'f29', formato: /CERTIFICADO DECLARACION/.test(T) ? 'certificado' : 'formulario', periodo: '', folio: '', presentado: '', codigos: {}, total: 0, errores: [], avisos: [] };
  if (r.formato === 'certificado') {
    for (const l of lineas) { const re = /C[oó]digo\s+(\d{1,4})\s*:\s*([\d.]+)/gi; let m; while ((m = re.exec(l))) r.codigos[Number(m[1])] = num(m[2]); }
    r.periodo = mesDeTexto((/per[ií]odo\s+([A-Za-zÁÉÍÓÚáéíóú]+\s+\d{4})/i.exec(lineas.join(' ')) || [])[1]);
    r.presentado = dmyIso((/presentada con fecha\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(lineas.join(' ')) || [])[1]);
    r.folio = (/Folio Declaraci[oó]n N[°º]?\s*:?\s*(\d{4,})/i.exec(lineas.join(' ')) || [])[1] || '';
  } else {
    lineas.forEach(l => {
      const c = celdas(l);
      for (let i = 0; i < c.length - 1; i++) {
        if (!/^\d{2,4}$/.test(c[i])) continue;
        const cod = Number(c[i]);
        // código · glosa · valor (el valor no puede ser el código de la glosa que sigue)   o   glosa · código · valor
        if (c[i + 2] !== undefined && !/^\d/.test(c[i + 1]) && num(c[i + 2]) !== null && (c[i + 3] === undefined || /^\d{2,4}$/.test(c[i + 3]) || /^[+=-]$/.test(c[i + 3]))) { r.codigos[cod] = num(c[i + 2]); i += 2; }
        else if (i > 0 && !/^\d/.test(c[i - 1]) && num(c[i + 1]) !== null && !/^\[/.test(c[i - 1])) { r.codigos[cod] = num(c[i + 1]); i += 1; }
      }
      const p = /PERIODO\s+\[15\]\s+(\d{6})/.exec(norm(l)); if (p) r.periodo = `${p[1].slice(0, 4)}-${p[1].slice(4)}`;
      const f = /FOLIO\s+\[07\]\s+(\d{4,})/.exec(norm(l)); if (f) r.folio = f[1];
    });
    const fp = lineas.findIndex(l => /FECHA DE PRESENTACION/.test(norm(l))); if (fp >= 0) r.presentado = dmyIso(lineas.slice(fp, fp + 3).join(' '));
  }
  const c = r.codigos;
  r.total = c[91] || c[547] || 0;
  if (!r.periodo) r.errores.push('No se encontró el período del F29.');
  if (!(r.total > 0)) r.errores.push('No se encontró el total a pagar (código 91).');
  r.bloquea = r.errores.length > 0;
  return r;
}
// El reparto del pago por código. Formulario: IVA (089 menos los créditos y anticipos que se imputan: 543), PPM (062), retención (151),
// impuesto único (048), lo demás del subtotal (595) como otros impuestos, y los recargos (93). Certificado: un solo monto.
export function partesF29(r) {
  const c = r.codigos, P = (k, monto) => ({ item: ITEMS_F29[k], area: 'ADMIN', monto: Math.round(monto) });
  if (r.formato === 'certificado' || c[89] === undefined) return [P('total', r.total)];
  const iva = (c[89] || 0) - (c[543] || 0), ppm = c[62] || 0, ret = c[151] || 0, unico = c[48] || 0, recargos = c[93] || ((c[931] || 0) + (c[932] || 0));
  const otros = (c[595] || 0) ? (c[595] - (c[89] || 0) - ppm - ret - unico) : 0;
  const l = [P('iva', iva), P('ppm', ppm), P('retencion', ret), P('unico', unico), P('otros', otros), P('recargos', recargos)].filter(x => x.monto !== 0);
  const dif = r.total - l.reduce((a, x) => a + x.monto, 0);
  if (dif) { const o = l.find(x => x.item === ITEMS_F29.otros); if (o) o.monto += dif; else l.push(P('otros', dif)); r.avisos.push(`El reparto por código no suma el total: ${dif > 0 ? 'faltan' : 'sobran'} $${Math.abs(dif).toLocaleString('es-CL')} (van a "otros impuestos").`); }
  return l;
}
// Documento: el pago del F29 del período. Fecha: la de presentación (si no viene, el 20 del mes siguiente). Ya clasificado (su reparto por código).
export function docDeF29(r, cargaId) {
  const fecha = esIso(r.presentado) ? r.presentado : `${mesSiguiente(r.periodo)}-20`, partes = partesF29(r);
  return { id: idDoc(RUT_SII, 'f29', r.periodo.replace('-', '')), origen: 'f29', formato: r.formato, tipo: 'f29', tipoTexto: 'F29 ' + textoMes(r.periodo), nc: false,
    rut: rutTexto(RUT_SII), rutN: rutN(RUT_SII), razon: 'SII · Formulario 29', folio: s(r.folio), fecha, mes: r.periodo, neto: r.total, exento: 0, iva: 0, otroImp: 0, total: r.total,
    vence: '', formaPago: '', referencias: [], detalle: partes.map(p => ({ descripcion: p.item, cantidad: 0, unidad: '', monto: p.monto })), descuadre: '', cargaId: s(cargaId), cliente: '', direccion: '', periodo: null,
    f29: { codigos: r.codigos, formato: r.formato, presentado: r.presentado },
    clasif: { item: partes.length === 1 ? ITEMS_F29.total : ITEMS_F29.iva, areas: [{ area: 'ADMIN', pct: 100 }], repartoId: '', partes, porLineas: false, separado: partes.length > 1, lineas: [], de: 'sistema' } };
}

// Una carga de un PDF: nueva, ya estaba, ya estaba distinta (no se pisa) o completa (el F29 que estaba como certificado y llega el formulario)
export function planPdf(d, existentes, inicio) {
  const e = (existentes || []).find(x => x.id === d.id);
  if (e) {
    if (d.origen === 'f29' && e.f29 && e.f29.formato === 'certificado' && d.formato === 'formulario') return { que: 'completar', cambios: { f29: d.f29, detalle: d.detalle, clasif: d.clasif, formato: d.formato, folio: d.folio || e.folio } };
    return { que: Math.abs((e.total || 0) - d.total) > 1 ? 'distinta' : 'ya', antes: e.total };
  }
  const ini = esIso(inicio) ? inicio : '2026-10-01', anterior = (Number(ini.slice(0, 4)) - 1) + ini.slice(4, 8) + '01';
  if (!d.fecha) return { que: 'sin_fecha' };
  if (d.fecha < anterior) return { que: 'antigua' };
  return { que: d.fecha < ini ? 'anterior' : 'nueva', doc: d.fecha < ini ? { ...d, anterior: true } : d };
}
export const textoPlanPdf = P => ({ nueva: 'nueva', anterior: 'entró como deuda anterior (es de antes del inicio)', ya: 'ya estaba (no se repite)', distinta: 'ya estaba con otro monto: no se reemplazó (revísela)', completar: 'ya estaba como certificado: se completó con el detalle del formulario', antigua: 'es de hace más de un año (no entra)', sin_fecha: 'no tiene fecha (no entra)' }[P.que] || P.que);
export { mesDe };
