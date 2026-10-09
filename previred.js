// ═══════════════════════════════════════════════
//  Sistema Fën — Cotizaciones de Previred  v0.10.1
//  Lee en el navegador el PDF de "Certificado de Pagos de Cotizaciones Previsionales"
//  (uno o el lote con todos los trabajadores). El PDF no sale del equipo hasta que se
//  guarda: entonces va al Apps Script de Gastos (SistemaFen.gs v1.4.0), que lo revisa
//  y lo deja en Drive como comprobante.
//  Lectura del PDF: pdf.js 3.11.174 (cdnjs), solo texto (isEvalSupported: false).
// ═══════════════════════════════════════════════
import * as Gastos from './gastos.js?v=0.24.0';

export const VERSION_MINIMA = '2.5.0';
const llamar = (op, datos, idem) => Gastos.llamar(op, datos, idem, VERSION_MINIMA);
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
export async function lineasDelPdf(file) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const lineas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter(i => i.str && i.str.trim());
    const filas = [];
    items.forEach(i => {
      const y = i.transform[5], x = i.transform[4];
      let f = filas.find(r => Math.abs(r.y - y) < 2.5);
      if (!f) { f = { y, celdas: [] }; filas.push(f); }
      f.celdas.push({ x, t: i.str.trim() });
    });
    filas.sort((a, b) => b.y - a.y).forEach(f => lineas.push(f.celdas.sort((a, b) => a.x - b.x).map(c => c.t).join('  ')));
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

export const nombreMes = periodo => { const [a, m] = String(periodo).split('-'); return `${MESES[+m - 1]} ${a}`; };
export const resumen = t => {
  const s = f => t.lineas.filter(f).reduce((x, l) => x + l.monto, 0);
  return { afp: s(l => l.tipo === 'AFP'), salud: s(l => l.tipo === 'Salud'), afc: s(l => l.tipo === 'AFC'), empleador: s(l => l.cargo === 'Empleador'), otro: s(l => l.tipo === 'Otro'), imponible: Math.max(0, ...t.lineas.map(l => l.imponible)) };
};
export const clave = (periodo, t, l) => [periodo, t.rut.toUpperCase(), l.institucion.toUpperCase(), l.tipoPago, l.folio].join('|');

const base64 = file => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); });
export const estado = (periodo, trabajadores) => llamar('cot_estado', { claves: trabajadores.flatMap(t => t.lineas.map(l => clave(periodo, t, l))) });
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
