// ═══════════════════════════════════════════════
//  Sistema Fën — Cotizaciones de Previred  v0.10.1
//  Lee en el navegador el PDF de "Certificado de Pagos de Cotizaciones Previsionales"
//  (uno o el lote con todos los trabajadores). El PDF no sale del equipo hasta que se
//  guarda: entonces va al Apps Script de Gastos (SistemaFen.gs v1.4.0), que lo revisa
//  y lo deja en Drive como comprobante.
//  Lectura del PDF: pdf.js 3.11.174 (cdnjs), solo texto (isEvalSupported: false).
//  v0.51.0: con Gastos en la base nueva, estado, registrar y lista van a fen-gastos (gastos-g3d-fs.js), con las mismas
//  respuestas. El estado dice además a dónde va el certificado (destino): al vencimiento de la obligación "Cotizaciones"
//  (los gastos por trabajador se crean al pagarlo) o, si no hay, como siempre (los gastos al guardar) con una nota.
//  v0.67.0: también el "Comprobante de pago" de Previred (CtrlPdf: una sección por institución, con su resumen y su detalle por
//  trabajador): leerComprobante() da los trabajadores con la misma forma que leer() y, además, lo que pagó la empresa por
//  institución (cotización, intereses y multas) y si se pagó fuera de plazo. Las páginas giradas (apaisadas) se leen
//  derechas: lineasDelPdf usa la posición en la página como se ve (con su giro), igual que antes en las no giradas.
// ═══════════════════════════════════════════════
import * as Gastos from './gastos.js?v=0.67.2';
import { venceDe } from './gastos-g3d.js?v=0.67.2';

export const VERSION_MINIMA = '2.5.0';
// v0.51.0: con la base nueva, a fen-gastos (las escrituras antiguas de Previred en la planilla las rechaza el script v2.17.0)
const llamar = async (op, datos, idem) => ((await Gastos.enBase()) ? Gastos.cotBase(op, datos, idem) : Gastos.llamar(op, datos, idem, VERSION_MINIMA));
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let cargaPdfjs = null;
function pdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!cargaPdfjs) cargaPdfjs = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { cargaPdfjs = null; no(new Error('No se pudo cargar el lector de PDF (revisa internet).')); };
    document.head.appendChild(s);
  });
  return cargaPdfjs;
}

// Texto del PDF en líneas: se agrupan los trozos por altura y se ordenan de izquierda a derecha.
// Las celdas quedan separadas por dos espacios, como en la tabla.
// v0.67.0: la posición es la de la página como se ve (con su giro: el comprobante de Previred viene apaisado). En una página sin
// giro es lo mismo de antes (la altura se mide desde arriba en vez de desde abajo).
const porMatriz = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export function lineasDePagina(items, vista) {
  const filas = [];
  (items || []).filter(i => i.str && i.str.trim()).forEach(i => {
    const t = vista ? porMatriz(vista, i.transform) : [1, 0, 0, 1, i.transform[4], -i.transform[5]], y = t[5], x = t[4];
    let f = filas.find(r => Math.abs(r.y - y) < 2.5);
    if (!f) { f = { y, celdas: [] }; filas.push(f); }
    f.celdas.push({ x, t: i.str.trim() });
  });
  return filas.sort((a, b) => a.y - b.y).map(f => f.celdas.sort((a, b) => a.x - b.x).map(c => c.t).join('  '));
}
export async function lineasDelPdf(file) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const lineas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pag = await doc.getPage(p);
    lineasDePagina((await pag.getTextContent()).items, pag.getViewport({ scale: 1 }).transform).forEach(l => lineas.push(l));
  }
  return lineas;
}

// Qué es cada línea y quién la paga (igual que el servidor, sfCotTipo)
export function tipoDe(inst) {
  const t = String(inst || '').toUpperCase();
  if (/SEGURO SOCIAL|\(SIS\)/.test(t)) return { tipo: 'Seguro social', cargo: 'Empleador' };
  if (/SEGURIDAD LABORAL|\bISL\b|MUTUAL|ACHS|\bIST\b/.test(t)) return { tipo: 'Accidentes', cargo: 'Empleador' };
  if (/\(AFC\)|CESANT/.test(t)) return { tipo: 'AFC', cargo: 'Mixto' };
  if (/FONASA|ISAPRE|SALUD|BANMEDICA|COLMENA|CONSALUD|CRUZ BLANCA|MASVIDA|VIDA TRES|ESENCIAL/.test(t)) return { tipo: 'Salud', cargo: 'Trabajador' };
  if (/COTIZACION OBLIGATORIA|AHORRO|APV|CUENTA 2|VOLUNTARI/.test(t)) return { tipo: 'AFP', cargo: 'Trabajador' };
  return { tipo: 'Otro', cargo: 'Otro' };
}

const pesosNum = s => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;
const RE_LINEA = /^(.+?)\s{2,}([A-Za-zÁÉÍÓÚáéíóú]+\s+\d{4})\s+(REM|GRA|RET|LEY)\s+\$\s*([\d.]+)\s+\$\s*([\d.]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{6,20})\s*$/;

// De las líneas a { periodo, fechaPago, trabajadores: [{ rut, nombre, lineas: [...] }], avisos }
export function leer(lineas) {
  const texto = lineas.join('\n');
  if (!/Certificado de Pagos de Cotizaciones Previsionales/i.test(texto)) throw new Error('No parece un certificado de cotizaciones de Previred.');
  const bloques = texto.split(/Certificado de Pagos de Cotizaciones Previsionales/i).slice(1);
  const porRut = {}, avisos = [], periodos = new Set(), fechas = new Set();
  bloques.forEach((b, n) => {
    const m = b.replace(/\s+/g, ' ').match(/Sr\.\(a\)\s+(.+?),\s*Rut:\s*([\d.]+-[\dkK])/);
    if (!m) { avisos.push(`Certificado ${n + 1}: no se encontró el nombre y RUT del trabajador.`); return; }
    const rut = m[2].toUpperCase(), nombre = m[1].trim();
    const t = porRut[rut] || (porRut[rut] = { rut, nombre, lineas: [] });
    let tabla = 0, leidas = 0;
    b.split('\n').forEach(l => {
      const r = l.trim().match(RE_LINEA);
      if (/\$/.test(l) && /\d{2}\/\d{2}\/\d{4}/.test(l)) tabla++;   // toda línea con montos y fecha cuenta, se lea o no
      if (!r) return;
      leidas++;
      const [mesTxt, anio] = r[2].toLowerCase().split(/\s+/);
      const mes = MESES.indexOf(mesTxt.normalize('NFD').replace(/[̀-ͯ]/g, ''));
      if (mes < 0) { avisos.push(`${nombre}: mes "${r[2]}" no reconocido.`); return; }
      const periodo = `${anio}-${String(mes + 1).padStart(2, '0')}`, [d, mm, y] = r[6].split('/');
      periodos.add(periodo); fechas.add(`${y}-${mm}-${d}`);
      t.lineas.push({ institucion: r[1].replace(/\s+/g, ' ').trim(), periodo, tipoPago: r[3], imponible: pesosNum(r[4]), monto: pesosNum(r[5]), fechaPago: `${y}-${mm}-${d}`, folio: r[7], ...tipoDe(r[1]) });
    });
    // Cada línea de la tabla con montos debe haberse leído: si no, se avisa (nunca se descarta en silencio)
    if (tabla !== leidas) avisos.push(`${nombre}: el PDF tiene ${tabla} líneas con montos y se leyeron ${leidas}. Revisa este trabajador.`);
  });
  const trabajadores = Object.values(porRut).map(t => ({ ...t, total: t.lineas.reduce((s, l) => s + l.monto, 0) })).filter(t => t.lineas.length);
  if (!trabajadores.length) throw new Error('No se encontraron líneas de cotizaciones en el PDF.');
  if (periodos.size > 1) throw new Error(`El PDF trae varios períodos (${[...periodos].join(', ')}): descarga uno por mes.`);
  if (fechas.size > 1) avisos.push(`Hay varias fechas de pago (${[...fechas].join(', ')}); se usa la más reciente.`);
  // bloquea: cualquier aviso menos el de varias fechas de pago (ahí solo se usa la más reciente)
  return { periodo: [...periodos][0], fechaPago: [...fechas].sort().pop(), trabajadores, avisos, bloquea: avisos.some(a => !/varias fechas de pago/.test(a)) };
}

// ═══ v0.67.0 · Comprobante de pago de Previred (lo que pagó la empresa, con intereses y multas) ═══
// Secciones (cada una empieza con su título): resumen y detalle del ISL; planilla y anexo de FONASA; resumen y detalle de cada
// AFP (fondo de pensiones y seguro de cesantía); formulario y detalle del Seguro Social. Las cifras se leen por su rótulo.
const TITULOS = [
  ['afpDet', /DETALLE DE PAGO DE COTIZACIONES PREVISIONALES\s+FONDO DE PENSIONES/i],
  ['afpRes', /COMPROBANTE DE PAGO DE COTIZACIONES PREVISIONALES\s+FONDO DE PENSIONES/i],
  ['islDet', /DETALLE DE COMPROBANTE PAGO DE COTIZACIONES PREVISIONALES/i],
  ['islRes', /COMPROBANTE DE PAGO DE COTIZACIONES PREVISIONALES/i],
  ['fonasa', /PLANILLA DE DECLARACION Y PAGO SIMULTANEO DE OBLIGACIONES PREVISIONALES/i],
  ['ss', /FORMULARIO DE COTIZACIONES PREVISIONALES\s*\S?\s*SEGURO SOCIAL PREVISIONAL/i]
];
const tituloDe = l => (TITULOS.find(([, re]) => re.test(l)) || [])[0] || '';
export const esComprobante = lineas => { const t = (lineas || []).join('\n'); return !/Certificado de Pagos de Cotizaciones Previsionales/i.test(t) && (lineas || []).some(l => tituloDe(l)); };
export const esCertificado = lineas => /Certificado de Pagos de Cotizaciones Previsionales/i.test((lineas || []).join('\n'));
const RE_RUT = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;
const RE_NUM = /^\$?\s?(\d{1,3}(?:\.\d{3})+|\d+)$/;
const esNum = c => RE_NUM.test(String(c).trim());
const aNum = c => Number(String(c).replace(/[^0-9]/g, '')) || 0;
const NUM = String.raw`\$?[ \t]*(\d{1,3}(?:\.\d{3})+|\d+)(?![\d,%/:])`;
const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// La cifra de un rótulo: el rótulo al inicio de la línea o después de dos espacios (otra celda), y el primer número que le sigue
// en la misma línea. null si no está.
function cifra(txt, rotulo) {
  const r = typeof rotulo === 'string' ? escRe(rotulo) : rotulo.source;
  const m = String(txt || '').match(new RegExp(String.raw`(?:^|[ \t]{2})(?:${r})[^\n\d$]*?[ \t]` + NUM, 'im'));
  return m ? aNum(m[1]) : null;
}
// El trozo entre dos rótulos (incluida la línea del segundo)
function tramo(txt, desde, hasta) {
  const i = txt.search(desde); if (i < 0) return '';
  const resto = txt.slice(i), j = resto.search(hasta); if (j < 0) return '';
  const fin = resto.indexOf('\n', j);
  return resto.slice(0, fin < 0 ? resto.length : fin);
}
const MES_RE = new RegExp(String.raw`\b(${MESES.join('|')})\s+(\d{4})\b`, 'i');
const sinTildesT = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
function periodoDe(txt) {
  let m = txt.match(/Per[ií]odo de Remuneraciones:\s*(\d{2})\/(\d{4})/i) || txt.match(/\bPeriodo\s+(\d{2})\/(\d{4})/i) || txt.match(/PERIODO DE REMUNERACI[ÓO]N\s+(\d{2})\s+(\d{4})/i)
    || txt.match(/^(0[1-9]|1[0-2])\s+(20\d{2})\s+\|/m);
  if (m) return `${m[2]}-${m[1]}`;
  m = sinTildesT(txt).match(MES_RE);
  return m ? `${m[2]}-${String(MESES.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}` : '';
}
// La fecha y hora del pago (el timbre de Previred): una fecha con una hora "8:12 PM" en la misma línea o hasta dos líneas después
function pagosDe(lineas) {
  const out = [];
  lineas.forEach((l, i) => {
    const f = l.match(/(\d{2})\/(\d{2})\/(\d{4})(?!.*\d{2}\/\d{2}\/\d{4})/);
    if (!f) return;
    const cerca = [l.slice(l.indexOf(f[0]) + f[0].length)].concat(lineas.slice(i + 1, i + 3)).join('\n'), h = cerca.match(/(\d{1,2}:\d{2})\s*([AP]M)/i);
    if (h) out.push({ fecha: `${f[3]}-${f[2]}-${f[1]}`, hora: `${h[1]} ${h[2].toUpperCase()}` });
  });
  return out;
}
const folioDe = txt => { const m = txt.match(/N[úu]mero de Folio:\s*(\d{6,20})/i) || txt.match(/N[ÚU]MERO DE SERIE:\s*(\d{6,20})/i); return m ? m[1] : ''; };
const afpDe = lineas => { for (const l of lineas) { const m = l.match(/^(AFP\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s[A-Za-zÁÉÍÓÚÑáéíóúñ]+)*?)(?:\s{2,}|$)/); if (m) return m[1].trim(); } return ''; };
const mayusSin = t => sinTildesT(t).toUpperCase().replace(/\s+/g, ' ').trim();
// Una fila de trabajador: el RUT (primera o segunda celda), el nombre (las celdas de texto) y lo que sigue. null si no es fila.
function filaDe(l) {
  const c = String(l).split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
  const k = c.findIndex(x => RE_RUT.test(x));
  if (k < 0 || k > 1 || (k === 1 && !/^\d{1,3}$/.test(c[0]))) return null;   // la segunda celda solo con el N° de fila antes
  const resto = c.slice(k + 1), j = resto.findIndex(esNum);
  if (j < 1) return { rut: c[k].toUpperCase(), nombre: '', celdas: resto, malo: true };
  return { rut: c[k].toUpperCase(), nombre: resto.slice(0, j).join(' ').replace(/\s+/g, ' ').trim(), celdas: resto.slice(j) };
}
const numsHastaTexto = celdas => { const out = []; for (const c of celdas) { if (!esNum(c)) break; out.push(aNum(c)); } return out; };

// De las líneas del comprobante a { tipoDoc: 'comprobante', periodo, fechaPago, horaPago, vence, fueraDePlazo, fueraDePlazoPor,
// instituciones: [{ clave, nombre, tipo, folio, cotizacion, intereses, multas, compensacion, total, trabajadores }],
// trabajadores (la forma de leer()), totalCotizaciones, totalRecargos, totalPagado, folios, avisos, bloquea }
// intereses incluye los reajustes; multas incluye recargos y costas de cobranza. Cada cruce que no calza es un aviso que bloquea.
export function leerComprobante(lineas) {
  const L = (lineas || []).map(l => String(l || ''));
  if (!esComprobante(L)) throw new Error('No parece un comprobante de pago de Previred.');
  const secs = [];
  L.forEach(l => { const t = tituloDe(l); if (t) secs.push({ tipo: t, lineas: [l] }); else if (secs.length) secs[secs.length - 1].lineas.push(l); });
  secs.forEach(x => {
    x.texto = x.lineas.join('\n');
    if (x.tipo === 'fonasa') x.tipo = /ANEXOS DE DETALLE/i.test(x.texto) ? 'fonasaDet' : 'fonasaRes';
    if (x.tipo === 'ss') x.tipo = /Identificaci[óo]n del Trabajador/i.test(x.texto) ? 'ssDet' : 'ssRes';
    x.folio = folioDe(x.texto); x.periodo = periodoDe(x.texto);
  });
  const avisos = [], bloquean = [], inst = [], periodos = new Set(), pagos = [];
  const blo = t => { avisos.push(t); bloquean.push(t); };
  secs.forEach(x => { if (x.periodo) periodos.add(x.periodo); pagosDe(x.lineas).forEach(p => pagos.push(p)); });
  const porRut = {};
  const trab = (f) => { const t = porRut[f.rut] || (porRut[f.rut] = { rut: f.rut, nombre: f.nombre, lineas: [] }); if (f.nombre.length > t.nombre.length) t.nombre = f.nombre; return t; };
  const ag = (i, f, institucion, monto, imponible) => { i.det.push({ rut: f.rut, monto }); if (monto > 0) trab(f).lineas.push({ institucion, monto, imponible, folio: i.folio, inst: i.clave }); else trab(f); };
  const nueva = (clave, nombre, tipo, folio, x) => { const i = { clave, nombre, tipo, folio, det: [], filas: 0, leidas: 0, ...x }; inst.push(i); return i; };
  const leerFilas = (sec, i, fn, min, nombreSec) => {
    sec.lineas.forEach(l => {
      const f = filaDe(l); if (!f) return;
      i.filas++;
      const ok = !f.malo && fn(f);
      if (ok) i.leidas++; else blo(`${nombreSec}: no se pudo leer la fila del RUT ${f.rut}.`);
    });
  };
  const resumenFalta = n => blo(`${n}: no se encontraron todas sus cifras (cotización, intereses, multas y total).`);
  // ISL
  secs.filter(x => x.tipo === 'islRes').forEach(x => {
    const n = 'Instituto de Seguridad Laboral (ISL)', cot = cifra(x.texto, 'SUBTOTAL A PAGAR A LA MUTUAL'), re = cifra(x.texto, 'Reajustes'), int = cifra(x.texto, 'Intereses'), mu = cifra(x.texto, 'Multas'), tot = cifra(x.texto, 'TOTAL PAGAR A LA MUTUAL');
    if ([cot, int, mu, tot].some(v => v === null)) resumenFalta(n);
    const i = nueva('isl-' + x.folio, n, 'Accidentes', x.folio, { cotizacion: cot || 0, intereses: (re || 0) + (int || 0), multas: mu || 0, total: tot || 0 });
    secs.filter(y => y.tipo === 'islDet' && y.folio === x.folio).forEach(y => leerFilas(y, i, f => { const v = numsHastaTexto(f.celdas); if (v.length < 2) return false; ag(i, f, 'INSTITUTO DE SEGURIDAD LABORAL (ISL)', v[1], v[0]); return true; }, 2, n));
  });
  // FONASA
  secs.filter(x => x.tipo === 'fonasaRes').forEach(x => {
    const n = 'FONASA', cot = cifra(x.texto, 'Cotiz. Legal'), re = cifra(x.texto, /Reajuste/), int = cifra(x.texto, /Inter[ée]s/), mu = cifra(x.texto, 'Multas'), sub = cifra(x.texto, 'SUB TOTAL FONASA'), comp = cifra(x.texto, /Compensaci[óo]n Asignaci[óo]n Familiar/), tot = cifra(x.texto, 'MONTO PAGADO');
    if ([cot, int, mu, tot].some(v => v === null)) resumenFalta(n);
    if (comp) blo(`FONASA descuenta ${fmtP(comp)} de compensación de asignación familiar: Sistema Fën todavía no la registra. Avísame para agregarla.`);
    const i = nueva('fonasa-' + x.folio, n, 'Salud', x.folio, { cotizacion: cot || 0, intereses: (re || 0) + (int || 0), multas: mu || 0, compensacion: comp || 0, total: tot || 0, subtotal: sub });
    secs.filter(y => y.tipo === 'fonasaDet' && y.folio === x.folio).forEach(y => leerFilas(y, i, f => {
      const c = f.celdas; if (!esNum(c[0])) return false;
      const r = esNum(c[1]) ? c.slice(1) : c.slice(2), v = numsHastaTexto(r);
      if (v.length < 2) return false; ag(i, f, 'FONASA', v[1], v[0]); return true; }, 2, n));
  });
  // Cada AFP: fondo de pensiones y seguro de cesantía (dos instituciones)
  secs.filter(x => x.tipo === 'afpRes').forEach(x => {
    const afp = afpDe(x.lineas) || 'AFP', A = mayusSin(afp);
    const ces = tramo(x.texto, /RESUMEN DE REAJUSTE E INTERESES FONDO DE CESANTIA/i, /TOTAL A PAGAR AL FONDO DE CESANTIA/i);
    const pen = tramo(x.texto, /RESUMEN DE REAJUSTE E INTERESES DEL FONDO DE PENSIONES/i, /TOTAL A PAGAR FONDO DE PENSIONES/i);
    const cotP = cifra(x.texto, /Sub TOTAL A PAGAR FONDO DE PENSIONES/i), totP = cifra(pen, /TOTAL A PAGAR FONDO DE PENSIONES/i);
    const intP = ['Reajustes', /Inter[ée]s y Recargo Beneficio Afiliado/i, /Inter[ée]s - Reajuste/i].map(r => cifra(pen, r)), mulP = [/Recargo/, /Costas Cobranza/].map(r => cifra(pen, r));
    const cotC = cifra(x.texto, /Sub TOTAL A PAGAR AL FONDO DE CESANTIA/i), totC = cifra(ces, /TOTAL A PAGAR AL FONDO DE CESANTIA/i);
    const intC = cifra(ces, /Inter[ée]s - Reajuste/i), mulC = [/Recargo/, /Costas Cobranza/].map(r => cifra(ces, r));
    if (!pen || [cotP, totP, intP[2], mulP[0]].some(v => v === null)) resumenFalta(afp + ' (fondo de pensiones)');
    if (!ces || [cotC, totC, intC, mulC[0]].some(v => v === null)) resumenFalta(afp + ' (seguro de cesantía)');
    const suma = l => l.reduce((t, v) => t + (v || 0), 0);
    const iP = nueva('afp-' + x.folio, afp + ' · fondo de pensiones', 'AFP', x.folio, { afp, cotizacion: cotP || 0, intereses: suma(intP), multas: suma(mulP), total: totP || 0 });
    const iC = nueva('afc-' + x.folio, afp + ' · seguro de cesantía', 'AFC', x.folio, { afp, cotizacion: cotC || 0, intereses: intC || 0, multas: suma(mulC), total: totC || 0 });
    secs.filter(y => y.tipo === 'afpDet' && y.folio === x.folio).forEach(y => leerFilas(y, iP, f => {
      let v = numsHastaTexto(f.celdas);
      if (v.length >= 11) v = v.slice(0, 4).concat(v.slice(5));   // con N° de contrato APVI
      if (v.length < 9) return false;
      const [rem, obl, sis, apvi, conv, aho, impC, afil, emp] = v;
      ag(iP, f, `${A} COTIZACION OBLIGATORIA`, obl, rem);
      if (sis > 0) ag(iP, f, `${A} (SIS)`, sis, rem);
      if (apvi + conv + aho > 0) ag(iP, f, `${A} AHORRO VOLUNTARIO`, apvi + conv + aho, rem);
      ag(iC, f, `${A} SEGURO DE CESANTIA (AFC)`, afil + emp, impC);
      return true;
    }, 9, afp));
    iC.filas = iP.filas; iC.leidas = iP.leidas;
  });
  // Seguro Social
  secs.filter(x => x.tipo === 'ssRes').forEach(x => {
    const n = 'Seguro Social', cot = cifra(x.texto, /Subtotal:?/), int = cifra(x.texto, /Inter[ée]s - Reajuste/i), mu = [/Recargo/, /Costas Cobranza/].map(r => cifra(x.texto, r)), tot = cifra(x.texto, 'MONTO PAGADO');
    if ([cot, int, mu[0], tot].some(v => v === null)) resumenFalta(n);
    const i = nueva('ss-' + x.folio, n, 'Seguro social', x.folio, { cotizacion: cot || 0, intereses: int || 0, multas: (mu[0] || 0) + (mu[1] || 0), total: tot || 0,
      seguroSocial: cifra(x.texto, 'Seguro Social Previsional'), rentabilidad: cifra(x.texto, 'Rentabilidad Protegida'), sis: cifra(x.texto, /Seguro de Invalidez y Sobrevivencia/) });
    secs.filter(y => y.tipo === 'ssDet' && y.folio === x.folio).forEach(y => leerFilas(y, i, f => {
      const v = numsHastaTexto(f.celdas); if (v.length < 5) return false;
      const [imp, impAnt, ss, rent, sis] = v; ag(i, f, 'SEGURO SOCIAL PREVISIONAL', ss + rent + sis, imp || impAnt); return true; }, 5, n));
  });
  // Detalles sin su resumen (no se descarta nada en silencio)
  secs.filter(x => /Det$/.test(x.tipo)).forEach(y => { const res = { islDet: 'islRes', fonasaDet: 'fonasaRes', afpDet: 'afpRes', ssDet: 'ssRes' }[y.tipo]; if (!secs.some(x => x.tipo === res && x.folio === y.folio)) blo(`Hay un detalle sin su resumen (folio ${y.folio || 'sin folio'}): descarga el comprobante completo.`); });
  if (!inst.length) throw new Error('No se encontraron instituciones en el comprobante.');
  // Cruces: el detalle por trabajador suma la cotización; cotización + intereses + multas (− compensación) = total
  inst.forEach(i => {
    const sd = i.det.reduce((t, x) => t + x.monto, 0);
    if (sd !== i.cotizacion) blo(`${i.nombre}: el detalle por trabajador suma ${fmtP(sd)} y la cotización dice ${fmtP(i.cotizacion)}.`);
    if (i.cotizacion + i.intereses + i.multas - (i.compensacion || 0) !== i.total) blo(`${i.nombre}: cotización ${fmtP(i.cotizacion)} + intereses ${fmtP(i.intereses)} + multas ${fmtP(i.multas)} no da el total ${fmtP(i.total)}.`);
    if (i.cotizacion > 0 && !i.filas) blo(`${i.nombre}: no se encontró su detalle por trabajador.`);
    i.trabajadores = new Set(i.det.map(x => x.rut)).size;
  });
  if (periodos.size !== 1) blo(periodos.size ? `El comprobante trae varios períodos (${[...periodos].sort().join(', ')}): descarga uno por mes.` : 'No se encontró el período de remuneraciones.');
  const fechas = [...new Set(pagos.map(p => p.fecha))].sort();
  if (!fechas.length) blo('No se encontró la fecha de pago.');
  if (fechas.length > 1) avisos.push(`Hay varias fechas de pago (${fechas.join(', ')}); se usa la más reciente.`);
  const periodo = [...periodos].sort().pop() || '', fechaPago = fechas[fechas.length - 1] || '', horaPago = (pagos.filter(p => p.fecha === fechaPago)[0] || {}).hora || '';
  const vence = periodo ? venceDe(periodo) : '', etiqueta = /FUERA DE PLAZO/i.test(L.join('\n'));
  const trabajadores = Object.values(porRut).map(t => ({ rut: t.rut, nombre: t.nombre, lineas: t.lineas.map(l => ({ institucion: l.institucion, periodo, tipoPago: 'REM', imponible: l.imponible, monto: l.monto, fechaPago, folio: l.folio, ...tipoDe(l.institucion) })) }))
    .map(t => ({ ...t, total: t.lineas.reduce((x, l) => x + l.monto, 0) }));
  trabajadores.filter(t => !t.lineas.length).forEach(t => blo(`${t.nombre || t.rut}: aparece en el comprobante sin ningún monto.`));
  const tot = k => inst.reduce((t, i) => t + (i[k] || 0), 0);
  const instituciones = inst.map(({ det, filas, leidas, ...i }) => ({ ...i, recargos: i.intereses + i.multas }));
  return { tipoDoc: 'comprobante', periodo, fechaPago, horaPago, vence, fueraDePlazo: etiqueta || (!!vence && !!fechaPago && fechaPago > vence), fueraDePlazoPor: etiqueta ? 'etiqueta' : (vence && fechaPago > vence ? 'fecha' : ''),
    instituciones, trabajadores: trabajadores.filter(t => t.lineas.length), totalCotizaciones: tot('cotizacion'), totalRecargos: tot('intereses') + tot('multas'), totalPagado: tot('total'),
    folios: [...new Set(inst.map(i => i.folio).filter(Boolean))].sort(), avisos, bloquea: bloquean.length > 0 };
}
const fmtP = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
// Certificado o comprobante, según el PDF
export function leerPdf(lineas) {
  if (esCertificado(lineas)) return { tipoDoc: 'certificado', ...leer(lineas) };
  if (esComprobante(lineas)) return leerComprobante(lineas);
  throw new Error('No parece un certificado de cotizaciones de Previred ni un comprobante de pago. Sirven el "Comprobante de pago" (recomendado) o el "Certificado de Pagos de Cotizaciones Previsionales".');
}
// Clave del comprobante: el período y sus folios (el mismo PDF descargado de nuevo da la misma)
export async function claveComprobante(r) {
  const txt = 'comp#' + r.periodo + '#' + (r.folios || []).slice().sort().join(',');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return 'pc-' + [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const nombreMes = periodo => { const [a, m] = String(periodo).split('-'); return `${MESES[+m - 1]} ${a}`; };
export const resumen = t => {
  const s = f => t.lineas.filter(f).reduce((x, l) => x + l.monto, 0);
  return { afp: s(l => l.tipo === 'AFP'), salud: s(l => l.tipo === 'Salud'), afc: s(l => l.tipo === 'AFC'), empleador: s(l => l.cargo === 'Empleador'), otro: s(l => l.tipo === 'Otro'), imponible: Math.max(0, ...t.lineas.map(l => l.imponible)) };
};
export const clave = (periodo, t, l) => [periodo, t.rut.toUpperCase(), l.institucion.toUpperCase(), l.tipoPago, l.folio].join('|');

const base64 = file => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); });
// v0.51.0: también el período y la fecha de pago (con la base nueva, para saber a qué vencimiento va; el script los ignora)
export const estado = (periodo, trabajadores, fechaPago) => llamar('cot_estado', { claves: trabajadores.flatMap(t => t.lineas.map(l => clave(periodo, t, l))), periodo, fechaPago: fechaPago || '' });
// Clave del envío según el contenido: el mismo lote siempre lleva la misma (reabrirlo no la cambia)
export async function claveDeEnvio(periodo, trabajadores) {
  const txt = periodo + '#' + trabajadores.flatMap(t => t.lineas.map(l => clave(periodo, t, l))).sort().join(';');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return 'prev-' + [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function registrar(datos, file, idem) {
  const r = await llamar('cot_registrar', { ...datos, archivoBase64: file && file.size <= 8 * 1024 * 1024 ? await base64(file) : '', nombreArchivo: file ? file.name : '' }, idem);
  Gastos.olvidarTodo();
  return r;
}
export const lista = () => llamar('cot_lista');
// v0.67.0 · Mes que ya tiene sus cotizaciones (certificado): solo las multas e intereses y el comprobante en la planilla (solo con la base nueva)
export async function registrarComprobante(datos, file, idem) {
  if (!(await Gastos.enBase())) throw new Error('El comprobante de Previred se guarda con Gastos en la base nueva.');
  const r = await Gastos.cotBase('cot_comprobante', { ...datos, archivoBase64: file && file.size <= 8 * 1024 * 1024 ? await base64(file) : '', nombreArchivo: file ? file.name : '' }, idem);
  Gastos.olvidarTodo();
  return r;
}
export async function quitarComprobante(periodo, motivo, idem) { const r = await Gastos.cotBase('cot_quitar_comprobante', { periodo, motivo }, idem); Gastos.olvidarTodo(); return r; }
