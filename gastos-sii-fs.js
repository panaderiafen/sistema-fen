// ═══════════════════════════════════════════════
//  Sistema Fën — Cargas del SII con la base nueva (fen-gastos), etapa G3  v0.48.0
//  Se usa solo cuando config/gastos dice fuente = "base". Mismas respuestas que el script de Gastos
//  (sii_estado, sii_cargas, sii_archivo, sii_detalle, sii_carga, sii_importar, sii_vincular, sii_nota_doc,
//  sii_nota_carga, sii_quitar_carga, sii_clasif): sii.js elige uno u otro.
//  · El archivo del SII sigue yendo a Drive con el script ("Fën · Gastos / Cargas SII / año", privado: op archivo_subir)
//    y se vuelve a abrir con el script (op sii_archivo con su enlace). La carga y sus documentos quedan en la base:
//    sii_cargas (una por archivo) y sii_docs (cada documento con su detalle de productos y sus notas).
//  · Importar crea los gastos como el script (gastos-sii.js), con origen "sii" y el documento (siiDoc: rut, tipo, folio),
//    y deja al día la ficha de cada proveedor (proveedores/{rut}) con lo aprendido para sugerir la próxima vez.
//  · Cada escritura lleva marcaBase() (pasa sola a la planilla: Registro Gasto, Vencimientos, Detalle Compras,
//    Cargas SII y Notas Documentos) y después notarEscritura() + la copia a la planilla. Nada se borra:
//    quitar una carga la marca "quitada" (quién y cuándo) y no toca sus gastos, como el script.
// ═══════════════════════════════════════════════
import * as FB from './firebase-gastos.js?v=0.49.0';
import * as GB from './gastos-base.js?v=0.49.0';
import * as M from './gastos-g2.js?v=0.49.0';
import * as S from './gastos-sii.js?v=0.49.0';
import { dbBase, todos, catalogo, nuevo, nuevoVenc, despues, limpio, correo } from './gastos-fs.js?v=0.49.0';

const error = (msg, code, datos) => Object.assign(new Error(msg), { code, ...(datos ? { datos } : {}) });
const s = v => String(v == null ? '' : v);
const hoy = () => M.ahoraChile().dia;
// Cambio sin copiar listas enteras al historial (las líneas de un documento pueden ser cientos)
const cambioLigero = (a, que, campos, extra, por) => limpio({ ...campos, version: (Number(a && a.version) || 0) + 1,
  historial: M.conHistorial(a && a.historial, { que, por: por || correo(), en: M.ahoraChile().texto, ...(extra || {}) }), ...GB.marcaBase(por) });
const leer = () => Promise.all([todos('gastos'), todos('sii_docs')]);

// ── Al abrir un archivo ──
export async function estado(documentos) {
  const docs = S.docsValidos(documentos);
  if (!docs) throw error('El archivo no trae documentos válidos', 'datos');
  const [gastos, siiDocs] = await leer();
  return S.estado(docs, gastos, siiDocs);
}

// ── Historial de cargas ──
export async function cargas() {
  const [c, gastos, siiDocs] = await Promise.all([todos('sii_cargas'), todos('gastos'), todos('sii_docs')]);
  return { ok: true, cargas: S.vistaCargas(c, gastos, siiDocs), fuente: 'base' };
}

// ── Subir un archivo: a Drive con el script; la carga, a la base. El mismo archivo otra vez actualiza la misma carga. ──
const TIPOS_ARCHIVO = ['text/xml', 'application/xml', 'text/csv', 'text/plain', 'text/html', 'application/vnd.ms-excel', 'application/octet-stream'];
export async function registrarCarga(p, subir) {
  const docs = S.docsValidos(p.documentos);
  if (!docs) throw error('El archivo no trae documentos válidos', 'datos');
  const nombre = S.sfTexto(s(p.nombreArchivo || 'archivo-sii.txt').replace(/[/\\]/g, '_'), 120) || 'archivo-sii.txt';
  const tipo = TIPOS_ARCHIVO.includes(s(p.mimeType)) ? s(p.mimeType) : 'text/plain';
  const b64 = typeof p.archivoBase64 === 'string' ? p.archivoBase64 : '';
  if (b64.length > 14 * 1024 * 1024) throw error('El archivo es demasiado grande (más de 10 MB)', 'datos');
  const c = S.datosCarga(docs);
  if (c.claveDocs.length > 49000) throw error('El archivo trae demasiados documentos para el historial (divídelo en dos períodos)', 'datos');
  let url = '';
  if (b64) { try { url = (await subir({ tipo: 'sii', fecha: c.hasta || c.desde || '', imageData: b64, mimeType: tipo, fileName: nombre })).url || ''; } catch (e) { /* como el script: la carga queda igual */ } }
  const d = await dbBase(), lista = await todos('sii_cargas');
  const ya = lista.find(x => !x.d.quitadoEnPlanilla && s(x.d.documentos) === c.claveDocs);
  const id = ya ? ya.id : S.idCarga(c.claveDocs), ref = FB.doc(d, 'sii_cargas', id);
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref);
    if (sn.exists()) {
      const a = sn.data(), campos = {};
      if (url) campos.urlArchivo = url;
      if (s(a.quitada).trim()) { campos.quitada = ''; campos.quitadaPor = null; }   // vuelve a cargarse: deja de estar quitada
      if (Object.keys(campos).length) tx.update(ref, cambioLigero(a, 'volvió a subirse', campos));
      return { ok: true, id: s(a.id || id), actualizada: true, conArchivo: !!url, n: Object.keys(campos).length ? 1 : 0 };
    }
    tx.set(ref, nuevo({ id, fechaCarga: hoy(), periodoDesde: c.desde, periodoHasta: c.hasta, nombreArchivo: nombre, urlArchivo: url, totalDocs: docs.length,
      documentos: c.claveDocs, nota: '', quitada: '', posPlanilla: 'c' + Date.now().toString().padStart(13, '0') }, 'sii'));
    return { ok: true, id, conArchivo: !!url, n: 1 };
  });
  await despues(r.n);
  delete r.n;
  return r;
}

// ── Reabrir: el archivo lo lee el script desde Drive con su enlace ──
export async function archivo(id, leerEnlace) {
  const lista = await todos('sii_cargas');
  const x = lista.find(y => !y.d.quitadoEnPlanilla && s(y.d.id || y.id) === s(id));
  if (!x) throw error('Carga no encontrada', 'datos');
  if (!s(x.d.urlArchivo)) throw error('Esta carga no tiene archivo guardado', 'datos');
  return leerEnlace(s(x.d.urlArchivo));
}

export async function detalle(rut, folio, tipo) {
  if (!S.rutOk(rut) || !S.folioOk(folio)) throw error('Documento no válido', 'datos');
  const r = S.detalleDocumento(await todos('sii_docs'), rut, folio, tipo === undefined ? undefined : (s(tipo) === '61' ? '61' : ''));
  return { ok: true, ...r };
}

// ── Importar ──
// marca: fija por envío (gastos.js): un reintento usa los mismos ids y no repite lo que ya quedó.
const LOTE = 400;
export async function importar(facturas, omitirRepetidas, marca) {
  const cat = await catalogo();
  const l = S.limpiarFacturas(facturas, cat.lista.filter(i => !i.archivado));
  if (l.error) throw error(l.error, 'datos');
  const limpias = l.limpias, hora = M.ahoraChile().hora;
  const planes = limpias.map((f, k) => S.planFactura(f, k, limpias.length, marca, hora));
  const [gastos, siiDocs] = await leer();
  const existentes = new Set(gastos.map(x => x.id));
  // Lo que ya quedó de este mismo envío (se cortó y se reintenta) no se repite ni cuenta como repetido
  const hechos = planes.filter(p => existentes.has(p.gastos[0].id)), faltan = planes.filter(p => !existentes.has(p.gastos[0].id));
  const resumen = ps => ({ filas: ps.reduce((x, p) => x + p.gastos.length, 0), vencimientos: ps.filter(p => p.venc).length, detalle: ps.reduce((x, p) => x + p.detalle.length, 0) });
  if (!faltan.length) return { ok: true, ...resumen(planes), facturas: limpias.length, repetido: true };
  const claves = S.clavesImportadas(gastos, siiDocs);
  const rep = S.repetidas(faltan.map(p => p.f), claves);
  let aEscribir = faltan;
  if (rep.length && !omitirRepetidas) {
    throw error(rep.length + ' documento(s) ya estaban importados. No se guardó nada.', 'duplicados',
      { duplicados: rep.map(f => ({ rut: f.rut, folio: f.folio, razonSocial: f.razonSocial, total: f.total })), nuevas: faltan.length - rep.length });
  }
  if (omitirRepetidas) {
    const r = new Set(rep.map(f => S.claveDocumento(f.rut, f.folio, f.tipoDoc)));
    aEscribir = faltan.filter(p => !r.has(p.clave));
    if (!aEscribir.length && !hechos.length) throw error('Todas las facturas ya estaban importadas', 'datos');
  }
  // Por partes de hasta ~400 escrituras, de la última factura a la primera: en la planilla quedan en el orden del archivo
  const partes = [];
  let parte = [], n = 0;
  aEscribir.slice().reverse().forEach(p => {
    const w = p.gastos.length + (p.venc ? 1 : 0) + 2;
    if (parte.length && n + w > LOTE) { partes.push(parte); parte = []; n = 0; }
    parte.push(p); n += w;
  });
  if (parte.length) partes.push(parte);
  const d = await dbBase(), dia = hoy(), clave = marca.t + marca.r, por = correo();
  let escritos = 0, hechas = 0;
  try {
    for (const ps of partes) {
      escritos += await FB.runTransaction(d, async tx => {
        const refsD = ps.map(p => FB.doc(d, 'sii_docs', p.docId)), refsG = ps.map(p => FB.doc(d, 'gastos', p.gastos[0].id));
        const ruts = [...new Set(ps.flatMap(p => p.gastos.map(g => S.rutProv(g.d.rutProveedor)).concat(p.detalle.map(x => S.rutProv(x.rutProveedor)))).filter(Boolean))];
        const refsP = ruts.map(r => FB.doc(d, 'proveedores', r));
        const sD = [], sG = [], sP = [];
        for (const r of refsD) sD.push(await tx.get(r));
        for (const r of refsG) sG.push(await tx.get(r));
        for (const r of refsP) sP.push(await tx.get(r));
        const nuevasFilas = {}, nuevosProds = {};
        let k = 0;
        ps.forEach((p, i) => {
          if (sG[i].exists()) return;   // ya quedó (otra pestaña con el mismo envío)
          const prev = sD[i].exists() ? sD[i].data() : null;
          if (prev && prev.importado && prev.importado.clave === p.clave && prev.importado.marca !== clave && !prev.quitadoEnPlanilla)
            throw error(`${p.f.razonSocial} F.${p.f.folio}: otro equipo lo acaba de importar. No se guardó nada de esta parte.`, 'duplicados', { duplicados: [{ rut: p.f.rut, folio: p.f.folio, razonSocial: p.f.razonSocial, total: p.f.total }], nuevas: 0 });
          p.gastos.forEach(g => tx.set(FB.doc(d, 'gastos', g.id), nuevo(g.d, 'sii')));
          if (p.venc) tx.set(FB.doc(d, 'vencimientos', p.venc.id), nuevoVenc(p.venc, 'sii'));   // v0.49.0: estado nuevo (por_pagar)
          const base = prev && Array.isArray(prev.lineas) ? prev.lineas.length : 0;
          const docN = S.docSiiImportado(prev, p, { marca: clave, en: M.ahoraChile().texto, por });
          const campos = Object.fromEntries(Object.entries(docN).filter(([kk]) => !['origen', 'creado', 'version', 'historial', 'planillaPendiente', 'hechoEnBase', 'editado'].includes(kk)));
          if (prev) tx.update(refsD[i], cambioLigero(prev, 'importó', campos, { gastos: p.gastos.length, productos: p.detalle.length }));
          else tx.set(refsD[i], nuevo(campos, 'sii'));
          k += p.gastos.length + (p.venc ? 1 : 0) + 1;
          p.gastos.forEach(g => { const x = S.filaGasto(g.id, g.d); if (x) (nuevasFilas[x.r] = nuevasFilas[x.r] || []).push(x); });
          p.detalle.forEach((ln, j) => { const x = S.filaProducto(p.docId, base + j, ln); if (x) (nuevosProds[x.r] = nuevosProds[x.r] || []).push(x); });
        });
        ruts.forEach((r, i) => {
          if (!nuevasFilas[r] && !nuevosProds[r]) return;
          const prev = sP[i].exists() ? sP[i].data() : null;
          const fi = S.fichaCon(prev, r, nuevasFilas[r] || [], nuevosProds[r] || [], dia);
          if (!fi.rutTexto) fi.rutTexto = (ps.find(p => S.rutProv(p.f.rut) === r) || { f: {} }).f.rut || '';
          tx.set(refsP[i], limpio({ ...fi, actualizado: { en: FB.serverTimestamp(), por, que: 'importó' } }));
        });
        return k;
      });
      hechas++;
    }
  } catch (e) {
    if (!hechas) throw e;
    await despues(escritos);
    throw error(`La importación se cortó a medias (${e.message}). Vuelve a presionar Importar: lo que ya quedó no se repite.`, 'a_medias');
  }
  await despues(escritos);
  try { await FB.setDoc(FB.doc(d, 'config', 'proveedores'), { actualizado: FB.serverTimestamp(), por, que: 'importó' }, { merge: true }); } catch (e) {}
  const r = resumen(aEscribir.concat(hechos));
  return { ok: true, ...r, facturas: limpias.length };
}

// ── Vincular un gasto registrado a mano con un documento ("filas" = ids de los gastos que sugirió estado()) ──
export async function vincular(p) {
  const rut = s(p.rut).trim(), folio = s(p.folio).trim();
  if (!S.rutOk(rut) || !S.folioOk(folio)) throw error('Documento no válido', 'datos');
  const ids = Array.isArray(p.filas) ? p.filas.map(s) : [];
  if (!ids.length || ids.length > 60 || ids.some(x => !/^[A-Za-z0-9_-]{1,150}$/.test(x))) throw error('Faltan las filas del gasto', 'datos');
  if (!S.esIso(p.fecha)) throw error('Falta la fecha del gasto', 'datos');
  const tipo = s(p.tipo) === '61' ? '61' : '', razon = S.sfTexto(p.razonSocial, 200);
  const [gastos, siiDocs] = await leer();
  if (S.clavesImportadas(gastos, siiDocs)[S.claveDocumento(rut, folio, tipo)]) throw error('Ese documento ya quedó en Gastos (otro equipo lo importó o vinculó).', 'datos');
  const d = await dbBase(), refs = ids.map(id => FB.doc(d, 'gastos', id)), rp = S.rutProv(rut), refP = FB.doc(d, 'proveedores', rp);
  const CAMBIO = 'La planilla cambió desde que se buscó la coincidencia. Vuelve a abrir el archivo para buscarla de nuevo.';
  const docId = S.idDoc(rut, folio, tipo === '61');
  await FB.runTransaction(d, async tx => {
    const sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    const sp = await tx.get(refP);
    let suma = 0;
    sns.forEach(sn => {
      const g = sn.exists() ? sn.data() : null;
      if (!g || g.estado !== 'vigente' || g.quitadoEnPlanilla || s(g.rutProveedor).trim() || s(g.fecha).slice(0, 10) !== p.fecha) throw error(CAMBIO, 'cambio');
      suma += parseFloat(g.montoFinal) || 0;
    });
    if (Math.round(suma) !== Math.round(Number(p.total))) throw error(CAMBIO, 'cambio');
    const filas = [];
    sns.forEach((sn, i) => {
      const g = sn.data(), obs = S.obsVinculada(g.observacion, folio, tipo), m = obs.match(S.RE_FOLIO_OBS);
      const campos = { rutProveedor: rut, razonSocial: razon, observacion: obs, folio: m ? m[2] : '', esNC: m ? (m[1] === 'NC' || Number(g.montoFinal) < 0) : false, siiDoc: { id: docId, rut, folio, tipo } };
      tx.update(refs[i], cambioLigero(g, 'vinculó', campos, { documento: S.claveDocumento(rut, folio, tipo) }));
      const x = S.filaGasto(ids[i], { ...g, ...campos }); if (x) filas.push(x);
    });
    if (filas.length) {
      const fi = S.fichaCon(sp.exists() ? sp.data() : null, rp, filas, [], hoy());
      if (!fi.rutTexto) fi.rutTexto = rut;
      tx.set(refP, limpio({ ...fi, actualizado: { en: FB.serverTimestamp(), por: correo(), que: 'vinculó' } }));
    }
  });
  await despues(ids.length);
  return { ok: true, filas: ids.length };
}

// ── Notas ──
export async function notaDoc(p) {
  const rut = s(p.rut).trim(), folio = s(p.folio).trim();
  if (!S.rutOk(rut) || !S.folioOk(folio)) throw error('Documento no válido', 'datos');
  const es61 = s(p.tipo) === '61', clave = S.claveDocumento(rut, folio, es61 ? '61' : ''), nota = S.sfTexto(p.nota, 500), razon = S.sfTexto(p.razonSocial, 200);
  const d = await dbBase(), ref = FB.doc(d, 'sii_docs', S.idDoc(rut, folio, es61));
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), a = sn.exists() ? sn.data() : null;
    const x = S.notasConNota(a ? a.notas : [], { clave, rut, folio, razonSocial: razon, nota, fecha: hoy() });
    if (!x.cambio) return { ok: true, borrada: x.borrada, n: 0 };
    if (a) tx.update(ref, cambioLigero(a, nota ? 'nota' : 'borró la nota', { notas: x.notas }, { nota }));
    else tx.set(ref, nuevo({ ...S.docSiiVacio(rut, folio, es61, razon), notas: x.notas, posPlanilla: 'n' + Date.now() }, 'sii'));
    return { ok: true, borrada: x.borrada, n: 1 };
  });
  await despues(r.n);
  return { ok: true, borrada: !!r.borrada };
}
async function cargaPorId(id) {
  if (!/^[0-9a-zA-Z-]{8,64}$/.test(s(id))) throw error('Falta la carga', 'datos');
  const d = await dbBase();
  const sn = await FB.getDoc(FB.doc(d, 'sii_cargas', s(id)));
  if (sn.exists() && !sn.data().quitadoEnPlanilla) return { d, ref: FB.doc(d, 'sii_cargas', s(id)) };
  const x = (await todos('sii_cargas')).find(y => !y.d.quitadoEnPlanilla && s(y.d.id) === s(id));
  if (!x) throw error('Carga no encontrada', 'datos');
  return { d, ref: FB.doc(d, 'sii_cargas', x.id) };
}
export async function notaCarga(id, nota) {
  const { d, ref } = await cargaPorId(id), texto = S.sfTexto(nota, 1000);
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Carga no encontrada', 'datos');
    const a = sn.data(); if (s(a.nota) === texto) return 0;
    tx.update(ref, cambioLigero(a, 'nota de la carga', { nota: texto }, { nota: texto }));
    return 1;
  });
  await despues(n);
  return { ok: true };
}
// No se borra: queda "quitada" con la fecha y quién (como el script). Los gastos importados no se tocan.
export async function quitarCarga(id) {
  const { d, ref } = await cargaPorId(id), por = correo() || 'Sistema Fën';
  const n = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Carga no encontrada', 'datos');
    const a = sn.data(); if (s(a.quitada).trim()) return 0;
    tx.update(ref, cambioLigero(a, 'quitó del historial', { quitada: hoy() + ' · ' + por, quitadaPor: { por, en: M.ahoraChile().texto } }));
    return 1;
  });
  await despues(n);
  return { ok: true };
}

// ── Proveedores ──
export async function clasif() {
  const l = await todos('proveedores'), fichas = {};
  l.forEach(x => { fichas[x.id] = { ...x.d, rut: x.d.rut || x.id }; });
  return S.clasifDesdeFichas(fichas, hoy());
}
// Una vez (Gastos → Base nueva): arma la ficha de cada proveedor con lo copiado de la planilla y lo hecho en la base
export async function armarProveedores(avance = () => {}) {
  avance('Leyendo gastos y documentos del SII…');
  const [gastos, siiDocs, prev] = await Promise.all([todos('gastos'), todos('sii_docs'), todos('proveedores')]);
  const fichas = S.armarFichas(gastos, siiDocs, hoy()), d = await dbBase(), por = correo();
  const ids = Object.keys(fichas), conDatos = ids.length;
  // Las que ya no tienen nada en los últimos 2 años quedan vacías (no se borran)
  prev.forEach(x => { if (!fichas[x.id]) { fichas[x.id] = { ...x.d, filas: [], prods: [], documentos: 0, productos: 0 }; ids.push(x.id); } });
  let hechos = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const b = FB.writeBatch(d);
    ids.slice(i, i + 200).forEach(id => b.set(FB.doc(d, 'proveedores', id), limpio({ ...fichas[id], actualizado: { en: FB.serverTimestamp(), por, que: 'armó las fichas' } })));
    await b.commit();
    hechos = Math.min(ids.length, i + 200);
    avance(`Guardando fichas… ${hechos} de ${ids.length}`);
  }
  await FB.setDoc(FB.doc(d, 'config', 'proveedores'), { armadas: FB.serverTimestamp(), actualizado: FB.serverTimestamp(), por, n: conDatos, que: 'armó las fichas' }, { merge: true });
  return { ok: true, proveedores: conDatos, total: ids.length };
}
// Para "Gastos → Base nueva": cuántas fichas hay y cuándo se actualizaron
export async function resumenProveedores() {
  const d = await dbBase();
  const [n, c, l] = await Promise.all([FB.getAggregateFromServer(FB.collection(d, 'proveedores'), { n: FB.count() }), FB.getDoc(FB.doc(d, 'config', 'proveedores')), todos('proveedores')]);
  const lista = l.map(x => ({ rut: x.d.rutTexto || x.id, razonSocial: x.d.razonSocial || '', documentos: Number(x.d.documentos) || 0, productos: Number(x.d.productos) || 0, ultima: x.d.ultima || '' }))
    .sort((a, b) => b.documentos - a.documentos || a.razonSocial.localeCompare(b.razonSocial));
  return { n: Number(n.data().n) || 0, meta: c.exists() ? c.data() : null, lista };
}
