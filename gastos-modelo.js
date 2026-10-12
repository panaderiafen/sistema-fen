// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos: de la planilla a la base nueva (fen-gastos)  v0.43.0 (etapa G1)
//  v0.45.0: la columna "ID base" (copia de la base a la planilla, G2) no se copia: no cambia ningún documento.
//  Arma los documentos desde las hojas que entrega el script de Gastos (v2.9.0, op "exportar").
//  · Ninguna columna se pierde: cada una queda con un nombre limpio ("Monto Neto" → montoNeto).
//    Si un valor se normaliza (fecha en texto, monto con "$"), lo escrito en la planilla queda en "original".
//  · Ids estables: copiar dos veces nunca duplica. Donde la hoja tiene ID se usa ese; los gastos
//    (Registro Gasto no tiene ID) llevan una huella de su contenido más un contador de repetidos.
//  · Nada se borra: los anulados se copian con estado "anulado", quién, cuándo y por qué.
//  Función pura (sin red): se puede probar sola.
// ═══════════════════════════════════════════════
export const COLECCIONES = ['gastos', 'items', 'obligaciones', 'vencimientos', 'sii_cargas', 'sii_docs', 'cotizaciones', 'cotiz_trabajadores', 'cartolas', 'cartola_cargos', 'cartola_reglas'];
export const NOMBRES = {
  gastos: 'Gastos (vigentes y anulados)', items: 'Ítems', obligaciones: 'Obligaciones', vencimientos: 'Vencimientos',
  sii_cargas: 'Cargas del SII', sii_docs: 'Documentos del SII (detalle y notas)', cotizaciones: 'Cotizaciones de Previred',
  cotiz_trabajadores: 'Trabajadores de Previred', cartolas: 'Cartolas', cartola_cargos: 'Cargos de la cartola', cartola_reglas: 'Reglas de la cartola'
};
export const ANIO = 2026;
export const COL_ID_BASE = 'ID base';   // última columna de cada hoja después del cambio (la escribe el script v2.11.0)

// ── Utilidades ─────────────────────────────────────
const texto = v => (v === null || v === undefined) ? '' : String(v).trim();
const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Encabezado → nombre de campo: "Monto Neto" → montoNeto, "Ítem Gasto" → itemGasto, "URLComprobante" → urlComprobante,
// "PArea1" → pArea1, "N° Operación" → nOperacion, "RUT Proveedor" → rutProveedor
export function campo(h) {
  const palabras = sinTildes(h).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return palabras.map((w, i) => {
    let x = /^[A-Z0-9]+$/.test(w) ? w.toLowerCase() : w.replace(/^[A-Z]+(?=[A-Z][a-z])/, m => m.toLowerCase());
    x = i === 0 ? x.charAt(0).toLowerCase() + x.slice(1) : x.charAt(0).toUpperCase() + x.slice(1);
    return x;
  }).join('');
}
// Pesos chilenos: un número se usa tal cual; un texto como "$25.990" usa el punto de miles (igual que el script)
export function numero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const t = texto(v); if (!t) return 0;
  const neg = /^-|^\(\s*\$?\s*\d|^\$\s*-/.test(t);
  const limpio = t.replace(/[^0-9.,]/g, '');
  let n;
  if (/^\d+,\d+$/.test(limpio)) n = Number(limpio.replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) n = Number(limpio.replace(/\./g, '').replace(',', '.'));
  else if (/^\d+\.\d+$/.test(limpio)) n = Number(limpio);
  else n = Number(limpio.replace(/[^0-9]/g, ''));
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}
// Día "aaaa-mm-dd" (de "aaaa-mm-dd…", "dd-mm-aaaa" o "dd/mm/aaaa"); '' si no se entiende
export function dia(v) {
  const s = texto(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
// Huella corta (64 bits) de un texto: la misma entrada da siempre la misma salida
export function huella(t) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
}
// JSON con las llaves ordenadas: el mismo documento siempre da la misma huella
export const estable = v => Array.isArray(v) ? '[' + v.map(estable).join(',') + ']'
  : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estable(v[k])).join(',') + '}'
  : JSON.stringify(v === undefined ? null : v);
// Id de documento a partir de un texto de la planilla (sin "/" ni caracteres raros)
export const idLimpio = s => { const x = sinTildes(texto(s)).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120); return /^_*$/.test(x) ? '' : x; };
const slug = s => idLimpio(s).toLowerCase();
const rutClave = r => texto(r).toUpperCase().replace(/[^0-9K-]/g, '');
const RE_FOLIO_OBS = /(?:^|[^A-Za-z])(NC|F)\.(\d+)/;   // igual que el script: "F.123" factura, "NC.123" nota de crédito

// Una hoja { c, f: [[fila, …celdas]] } → filas { fila, datos } con nombres limpios. Ninguna columna se pierde:
// sin encabezado → col<N> (si tiene algo); nombre repetido o reservado → nombre_2, …
function filasDe(hoja, nombreHoja, aviso, reservados = ['hoja', 'fila']) {
  if (!hoja || !Array.isArray(hoja.c)) return [];
  const usados = new Set(reservados), nombres = hoja.c.map((h, j) => {
    // v0.45.0: "ID base" la escribe la copia de la base a la planilla (G2): no es un dato del gasto
    if (texto(h) === COL_ID_BASE) return null;
    let n = campo(h); const vacio = !n;
    if (vacio) n = 'col' + (j + 1);
    if (usados.has(n)) { let k = 2; while (usados.has(n + '_' + k)) k++; if (!vacio) aviso(nombreHoja, null, `La columna "${h}" se repite o choca con otra: queda como ${n}_${k}.`); n = n + '_' + k; }
    usados.add(n);
    return { n, vacio };
  });
  return (hoja.f || []).map(r => {
    const datos = {};
    nombres.forEach((x, j) => {
      if (!x) return;
      const { n, vacio } = x;
      let v = r[j + 1];
      if (v === undefined || v === null) v = '';
      if (vacio && v === '') return;
      datos[n] = v;
    });
    return { fila: r[0], datos };
  });
}

export function armar(exp) {
  const hojas = (exp && exp.hojas) || {}, anio = Number(exp && exp.anio) || ANIO;
  const avisos = [];
  const aviso = (hoja, fila, t) => avisos.push({ hoja, fila: fila || null, texto: t });
  const col = {}; COLECCIONES.forEach(c => { col[c] = {}; });
  if (!hojas['Registro Gasto']) throw new Error('La planilla no trajo "Registro Gasto". Revisa que el script sea el de Gastos v2.9.0.');
  // Guarda un documento; si el id ya existe (ID repetido en la hoja), no se pierde: queda como id-2, id-3…
  const poner = (c, base, doc, hoja, fila) => {
    let id = base || ('sin-id-' + huella(estable(doc))), k = 2;
    if (col[c][id]) {
      while (col[c][id + '-' + k]) k++;
      aviso(hoja, fila, base ? `El ID "${base}" se repite (fila ${col[c][id].fila}): esta fila queda como ${id}-${k}.` : `Fila igual a la fila ${col[c][id].fila}: se copian las dos.`);
      id = id + '-' + k;
    }
    col[c][id] = { ...doc, hoja, fila };
    return id;
  };
  // Para hojas con ID propio
  const conId = (c, nombreHoja, campoId, extra) => filasDe(hojas[nombreHoja], nombreHoja, aviso).forEach(({ fila, datos }) => {
    const base = idLimpio(datos[campoId]);
    if (!base) aviso(nombreHoja, fila, 'Fila sin ID: se copia igual, con un id armado con su contenido.');
    poner(c, base, extra ? extra(datos) : datos, nombreHoja, fila);
  });

  // ── Gastos: Registro Gasto (vigentes) y Gastos anulados ──
  const RESERVADOS_G = ['estado', 'anulado', 'mes', 'anio', 'folio', 'esNC', 'origen', 'original', 'hoja', 'fila'];
  const veces = {};
  const totales = { gastos: { vigentes: 0, anulados: 0, porMes: {} } };
  const gasto = (datos, nombreHoja, fila, anulado) => {
    const d = { ...datos }, original = {};
    ['fecha', 'fechaPago'].forEach(k => { if (!(k in d)) return; const n = dia(d[k]); if (n && n !== d[k]) { original[k] = d[k]; d[k] = n; } });
    if ('hora' in d) { const m = texto(d.hora).match(/^(\d{1,2}):(\d{2})/); if (m && `${m[1].padStart(2, '0')}:${m[2]}` !== d.hora) { original.hora = d.hora; d.hora = `${m[1].padStart(2, '0')}:${m[2]}`; } }
    ['montoNeto', 'montoFinal'].forEach(k => { if (!(k in d) || typeof d[k] === 'number') return; original[k] = d[k]; d[k] = numero(d[k]); });
    const f = dia(d.fecha);
    if (!f) aviso(nombreHoja, fila, `Gasto sin fecha legible ("${texto(datos.fecha)}"): se copia igual, sin mes.`);
    const obs = texto(d.observacion), m = obs.match(RE_FOLIO_OBS);
    const doc = { ...d, estado: anulado ? 'anulado' : 'vigente', mes: f ? f.slice(0, 7) : '', anio: f ? Number(f.slice(0, 4)) : null,
      folio: m ? m[2] : '', esNC: m ? (m[1] === 'NC' || Number(d.montoFinal) < 0) : false };
    // Origen solo cuando se sabe seguro: las filas de Previred las escribe Sistema Fën con ese texto y sin IVA
    if (/^Previred /.test(obs) && d.tipoMonto === 'siniva') doc.origen = 'Previred';
    if (anulado) {
      doc.anulado = { el: d.anuladoEl ?? '', por: d.anuladoPor ?? '', motivo: d.motivo ?? '', filaOriginal: d.filaOriginal ?? '' };
      ['anuladoEl', 'anuladoPor', 'motivo', 'filaOriginal'].forEach(k => { delete doc[k]; });
    }
    if (Object.keys(original).length) doc.original = original;
    // Id: huella de lo que no cambia al pagar, vincular o conciliar (no la observación, el RUT, la foto ni la columna Cartola)
    // + cuántas veces apareció antes ese mismo gasto (dos compras iguales el mismo día son dos documentos)
    const clave = [doc.fecha, doc.hora, doc.itemGasto, doc.area, doc.tipoMonto, doc.montoNeto, doc.montoFinal, doc.esHarina, doc.formaPago, doc.archivo].map(x => texto(x)).join('|');
    const h = huella(clave), n = (veces[h] = (veces[h] || 0) + 1);
    poner('gastos', `g-${h}-${n}`, doc, nombreHoja, fila);
    if (anulado) totales.gastos.anulados++;
    else {
      totales.gastos.vigentes++;
      const t = totales.gastos.porMes[doc.mes || 'sin-fecha'] || (totales.gastos.porMes[doc.mes || 'sin-fecha'] = { n: 0, neto: 0, final: 0 });
      t.n++; t.neto += Number(doc.montoNeto) || 0; t.final += Number(doc.montoFinal) || 0;
    }
  };
  // Vigentes de abajo hacia arriba (las filas nuevas entran arriba: así un gasto antiguo conserva su número),
  // después los anulados en su orden: si se anula uno de dos gastos iguales, el otro sigue con su id.
  filasDe(hojas['Registro Gasto'], 'Registro Gasto', aviso, RESERVADOS_G).slice().reverse().forEach(({ fila, datos }) => gasto(datos, 'Registro Gasto', fila, false));
  filasDe(hojas['Gastos anulados'], 'Gastos anulados', aviso, RESERVADOS_G).forEach(({ fila, datos }) => gasto(datos, 'Gastos anulados', fila, true));

  // ── Hojas con ID ──
  conId('obligaciones', 'Obligaciones', 'id');
  conId('vencimientos', 'Vencimientos', 'id');
  conId('sii_cargas', 'Cargas SII', 'id');
  conId('cartola_cargos', 'Cartola Cargos', 'id');

  // ── Ítems (el nombre es su ID) ──
  filasDe(hojas['Items Gasto'], 'Items Gasto', aviso, ['archivado', 'hoja', 'fila']).forEach(({ fila, datos }) => {
    const base = slug(datos.item);
    if (!base) aviso('Items Gasto', fila, 'Ítem sin nombre: se copia igual.');
    poner('items', base, { ...datos, archivado: texto(datos.estado).toUpperCase() === 'ARCHIVADO' }, 'Items Gasto', fila);
  });

  // ── Documentos del SII: Detalle Compras + Notas Documentos, por RUT, folio y tipo (61 = nota de crédito) ──
  const lineas = filasDe(hojas['Detalle Compras'], 'Detalle Compras', aviso);
  const sinTipo = {};   // filas antiguas sin Tipo Doc: si el documento suma negativo, era nota de crédito (como el script)
  lineas.forEach(({ datos }) => { if (!texto(datos.tipoDoc)) { const k = rutClave(datos.rutProveedor) + '|' + texto(datos.folio); sinTipo[k] = (sinTipo[k] || 0) + numero(datos.montoNeto); } });
  const docSii = (rut, folio, es61, ej) => {
    const r = rutClave(rut), id = idLimpio(`${r || 'sin-rut'}_${texto(folio) || 'sin-folio'}${es61 ? '_61' : ''}`);
    return col.sii_docs[id] || (col.sii_docs[id] = { rut: texto(rut), folio: texto(folio), tipo: es61 ? '61' : '', clave: `${texto(rut)}|${texto(folio)}${es61 ? '|61' : ''}`,
      razonSocial: texto(ej.razonSocial), fecha: '', totalNeto: 0, tiposDoc: [], lineas: [], notas: [], hoja: 'Detalle Compras', fila: null });
  };
  lineas.forEach(({ fila, datos }) => {
    if (!texto(datos.rutProveedor) || !texto(datos.folio)) aviso('Detalle Compras', fila, 'Línea sin RUT o sin folio: se copia igual.');
    const t = texto(datos.tipoDoc), es61 = t ? t === '61' : (sinTipo[rutClave(datos.rutProveedor) + '|' + texto(datos.folio)] || 0) < 0;
    const d = docSii(datos.rutProveedor, datos.folio, es61, datos);
    d.lineas.push({ ...datos, fila });
    d.totalNeto += numero(datos.montoNeto);
    if (t && !d.tiposDoc.includes(t)) d.tiposDoc.push(t);
    const f = dia(datos.fecha); if (f && (!d.fecha || f < d.fecha)) d.fecha = f;
    if (d.fila === null) d.fila = fila;
    if (!d.razonSocial && texto(datos.razonSocial)) d.razonSocial = texto(datos.razonSocial);
  });
  filasDe(hojas['Notas Documentos'], 'Notas Documentos', aviso).forEach(({ fila, datos }) => {
    const partes = texto(datos.clave).split('|');
    const rut = partes[0] || datos.rutProveedor, folio = partes[1] || datos.folio;
    if (!texto(rut) || !texto(folio)) aviso('Notas Documentos', fila, 'Nota sin RUT o sin folio: se copia igual.');
    const d = docSii(rut, folio, partes[2] === '61', datos);
    if (!d.lineas.length && d.fila === null) { d.hoja = 'Notas Documentos'; d.fila = fila; }
    d.notas.push({ ...datos, fila });
  });
  Object.values(col.sii_docs).forEach(d => { d.totalNeto = Math.round(d.totalNeto * 100) / 100; });

  // ── Cotizaciones de Previred (Clave única por período, RUT, institución, tipo y planilla) ──
  filasDe(hojas['Cotizaciones'], 'Cotizaciones', aviso).forEach(({ fila, datos }) => {
    const k = texto(datos.clave);
    if (!k) aviso('Cotizaciones', fila, 'Línea sin Clave: se copia igual, con un id armado con su contenido.');
    poner('cotizaciones', k ? 'c-' + huella(k) : '', datos, 'Cotizaciones', fila);
  });
  filasDe(hojas['Cotizaciones Trabajadores'], 'Cotizaciones Trabajadores', aviso).forEach(({ fila, datos }) => poner('cotiz_trabajadores', idLimpio(rutClave(datos.rut)), datos, 'Cotizaciones Trabajadores', fila));
  // ── Cartola ──
  filasDe(hojas['Cartolas'], 'Cartolas', aviso).forEach(({ fila, datos }) => poner('cartolas', texto(datos.cartola) ? 'ct-' + huella(texto(datos.cartola)) : '', datos, 'Cartolas', fila));
  filasDe(hojas['Cartola Reglas'], 'Cartola Reglas', aviso).forEach(({ fila, datos }) => poner('cartola_reglas', texto(datos.clave) ? 'r-' + huella(texto(datos.clave)) : '', datos, 'Cartola Reglas', fila));

  totales.porColeccion = {}; COLECCIONES.forEach(c => { totales.porColeccion[c] = Object.keys(col[c]).length; });
  return { anio, colecciones: col, avisos, totales };
}

// ── Qué cambió desde la última copia ─────────────────
// previas[col][id] = huella guardada en la base (migracion/). La fila y la hoja no cuentan: cambian cuando entra un gasto arriba.
export function cambios(colecciones, previas) {
  const r = {};
  COLECCIONES.forEach(c => {
    const ant = (previas && previas[c]) || {}, act = colecciones[c] || {};
    const huellas = {}, nuevos = [], cambiados = [], quitar = [];
    Object.keys(act).forEach(id => {
      const h = huellaDoc(act[id]); huellas[id] = h;
      if (!(id in ant)) nuevos.push(id);
      else if (ant[id] !== h) cambiados.push(id);   // también si volvió después de quitarse
    });
    Object.keys(ant).forEach(id => { if (!(id in act)) { huellas[id] = 'quitado'; if (ant[id] !== 'quitado') quitar.push(id); } });
    r[c] = { nuevos, cambiados, quitar, iguales: Object.keys(act).length - nuevos.length - cambiados.length, huellas };
  });
  return r;
}
export function huellaDoc(d) {
  const { hoja, fila, ...resto } = d;
  if (Array.isArray(resto.lineas)) resto.lineas = resto.lineas.map(({ fila: _f, ...x }) => x);
  if (Array.isArray(resto.notas)) resto.notas = resto.notas.map(({ fila: _f, ...x }) => x);
  return huella(estable(resto));
}

// ── Control de totales: planilla (lo armado) contra la base nueva ─────────
// base = { porColeccion: {col: n sin los quitados}, gastos: { vigentes, anulados, porMes } }
export function comparar(planilla, base) {
  const filas = [], dif = [];
  const fila = (grupo, que, a, b, pesos) => { const ok = Math.round(a * 100) === Math.round(b * 100); filas.push({ grupo, que, planilla: a, base: b, ok, pesos: !!pesos }); if (!ok) dif.push({ que, planilla: a, base: b, pesos: !!pesos }); };
  COLECCIONES.forEach(c => fila('colecciones', NOMBRES[c], planilla.porColeccion[c] || 0, (base.porColeccion || {})[c] || 0));
  fila('gastos', 'Gastos vigentes', planilla.gastos.vigentes, (base.gastos || {}).vigentes || 0);
  fila('gastos', 'Gastos anulados', planilla.gastos.anulados, (base.gastos || {}).anulados || 0);
  const pm = planilla.gastos.porMes, bm = (base.gastos || {}).porMes || {};
  [...new Set([...Object.keys(pm), ...Object.keys(bm)])].sort().forEach(m => {
    const a = pm[m] || { n: 0, neto: 0, final: 0 }, b = bm[m] || { n: 0, neto: 0, final: 0 }, et = m === 'sin-fecha' ? 'sin fecha' : m;
    fila('mes', `${et} · cantidad`, a.n, b.n); fila('mes', `${et} · monto neto`, a.neto, b.neto, true); fila('mes', `${et} · monto final`, a.final, b.final, true);
  });
  return { ok: !dif.length, filas, diferencias: dif };
}
// Totales de los gastos de la base (sin los quitados de la planilla)
export function totalesGastos(docs) {
  const t = { vigentes: 0, anulados: 0, porMes: {} };
  docs.forEach(d => {
    if (d.quitadoEnPlanilla) return;
    if (d.estado === 'anulado') { t.anulados++; return; }
    t.vigentes++;
    const k = d.mes || 'sin-fecha', m = t.porMes[k] || (t.porMes[k] = { n: 0, neto: 0, final: 0 });
    m.n++; m.neto += Number(d.montoNeto) || 0; m.final += Number(d.montoFinal) || 0;
  });
  return t;
}
