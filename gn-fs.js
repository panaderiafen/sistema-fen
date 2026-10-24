// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos nuevo (desde cero), base fen-gastos  v0.90.0 · Etapa 1: base y carga
//  Colecciones nuevas, que nacen vacías: gn_documentos, gn_movimientos y gn_cargas (reglas en gn-modelo.js).
//  Lo de antes (gastos, vencimientos, cartola_cargos, sii_docs…) no se toca ni se lee aquí.
//  · Todo pasa por fs-gastos.js (memoria de la sesión y cuidado de la cuota): abrir la Bandeja otra vez no vuelve a leer todo.
//  · Escribir es "agregar lo que falta" (set con merge de los campos que vienen del archivo): si otro equipo ya lo había
//    guardado, no se pierde nada de lo que se le agregó después (clasificación, pagos, notas). Nada se borra.
//  · Sin la marca de la planilla (planillaPendiente): lo nuevo ya no se copia a la planilla de Google.
//  v0.91.0 · Etapa 2: gn_pagos (lo único que crea Confirmar), gn_proveedores (la clasificación que recuerda cada proveedor) y
//  gn_config/sugerencias (lo que sugiere el Gastos anterior, armado UNA vez leyendo sus gastos; después se lee un solo documento).
//  Cada cambio en un documento o movimiento queda en su "historial" (qué, quién, cuándo). Deshacer no borra: el pago queda "deshecho".
// ═══════════════════════════════════════════════
import * as FB from './fs-gastos.js?v=0.92.1';
import { dbBase, correo } from './gastos-fs.js?v=0.92.1';
import { ahoraChile } from './gastos-g2.js?v=0.92.1';
import * as GN from './gn-modelo.js?v=0.92.1';
import * as GB from './gn-bandeja.js?v=0.92.1';

const quien = () => correo() || 'Sistema Fën';
const todos = async col => { const d = await dbBase(); return (await FB.getDocs(FB.collection(d, col))).docs.map(x => ({ id: x.id, ...x.data() })); };
function limpio(v) {
  if (Array.isArray(v)) return v.map(limpio);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { const o = {}; Object.entries(v).forEach(([k, x]) => { if (x !== undefined) o[k] = limpio(x); }); return o; }
  return v;
}
const inicio = () => (typeof window !== 'undefined' && window.FEN_SIS && window.FEN_SIS.INICIO) || '2026-10-01';

// ── Lecturas ──
export async function leer() {
  const [docs, movs, cargas, pagos, provs, cfg, items] = await Promise.all([todos(GN.COL.docs), todos(GN.COL.movs), todos(GN.COL.cargas), todos(GN.COL.pagos), todos(GN.COL.provs), todos(GN.COL.config), todos('items').catch(() => [])]);
  let sug = cfg.find(x => x.id === 'sugerencias');
  if (!sug) { try { sug = await armarSugerencias(); } catch (e) { sug = { porProveedor: {} }; } }
  return { docs, movs, cargas: cargas.sort((a, b) => String(b.en || '').localeCompare(String(a.en || ''))), pagos, provs: Object.fromEntries(provs.map(p => [p.id, p])),
    sugeridas: (sug && sug.porProveedor) || {}, items: itemsDe(items), inicio: inicio() };
}
// El catálogo de ítems de siempre (Configuración → Ítems): los vivos, en su orden
const itemsDe = l => l.filter(x => x.item && !x.archivado && !x.quitadoEnPlanilla && x.estado !== 'ARCHIVADO').sort((a, b) => (Number(a.orden) || 999) - (Number(b.orden) || 999)).map(x => ({ item: String(x.item), area: String(x.area || '') }))
  .filter((x, i, a) => a.findIndex(y => y.item === x.item) === i);
// Las sugerencias del Gastos anterior: se leen sus gastos UNA vez y se guarda el resumen (un documento)
async function armarSugerencias() {
  const g = await todos('gastos'), porProveedor = GB.sugerenciasDeAnterior(g.filter(x => !x.quitadoEnPlanilla));
  const d = await dbBase(), b = FB.writeBatch(d);
  b.set(FB.doc(d, GN.COL.config, 'sugerencias'), { porProveedor, n: Object.keys(porProveedor).length, de: g.length, armado: ahoraChile().texto });
  await b.commit();
  return { porProveedor };
}

// ── Escrituras ──
async function escribir(col, lista, extra) {
  const d = await dbBase();
  for (let i = 0; i < lista.length; i += 400) {
    const b = FB.writeBatch(d);
    lista.slice(i, i + 400).forEach(x => { const { id, ...resto } = x; b.set(FB.doc(d, col, id), limpio({ ...resto, ...extra }), { merge: true }); });
    await b.commit();
  }
}
async function guardarCarga(k) {
  const d = await dbBase(), b = FB.writeBatch(d);
  b.set(FB.doc(d, GN.COL.cargas, k.id), limpio({ ...k, id: undefined, creadoEn: FB.serverTimestamp() }));
  await b.commit();
}
const nuevoExtra = (cargaId, por, en) => ({ estado: 'vigente', creado: { por, en, carga: cargaId }, version: 0 });

// Compras del SII ya leídas (sii.leer): { facturas, omitidas, formato }
export async function cargarSii(L, archivo) {
  const ya = await todos(GN.COL.docs), por = quien(), en = ahoraChile().texto, id = GN.idCarga('sii');
  const P = GN.planDocs(L.facturas, ya, inicio(), id);
  await escribir(GN.COL.docs, P.nuevos.map(d => ({ ...d, formato: L.formato || '' })), nuevoExtra(id, por, en));
  if (P.completar.length) await escribir(GN.COL.docs, P.completar, {});   // v0.90.2: solo el detalle (y lo que faltaba): nada más se toca
  const fechas = (L.facturas || []).map(f => GN.aIso(f.fecha)).filter(Boolean).sort();
  const k = { id, tipo: 'sii', archivo: String(archivo.nombre || '').slice(0, 120), tamano: Number(archivo.tamano) || 0, formato: L.formato || '', desde: fechas[0] || '', hasta: fechas[fechas.length - 1] || '',
    leidos: P.leidos, nuevos: P.nuevos.length, yaEstaban: P.yaEstaban, completados: P.completar.length, anteriores: P.anteriores, antiguos: P.antiguos, guias: (L.omitidas || []).length, por, en };
  await guardarCarga(k);
  return { ...k, plan: P };
}
// Movimientos ya armados (GN.movsDeCartola / GN.movsDeMP) con el id de su carga
export async function cargarMovs(tipo, movs, meta) {
  const ya = await todos(GN.COL.movs), por = quien(), en = ahoraChile().texto;
  const P = GN.planMovs(movs, ya, inicio());
  await escribir(GN.COL.movs, P.nuevos, nuevoExtra(meta.id, por, en));
  const k = { id: meta.id, tipo, archivo: String(meta.archivo || '').slice(0, 120), tamano: Number(meta.tamano) || 0, identificador: String(meta.identificador || '').slice(0, 120),
    desde: meta.desde || '', hasta: meta.hasta || '', cuentas: [...new Set(movs.map(m => m.cuenta))], leidos: P.leidos, nuevos: P.nuevos.length, yaEstaban: P.yaEstaban,
    parecidos: P.parecidos.length, parecidosLista: P.parecidos.slice(0, 50), antes: P.antes, traspasos: P.nuevos.filter(m => m.naturaleza === 'traspaso').length, por, en };
  await guardarCarga(k);
  return { ...k, plan: P };
}

// ═══════════════ v0.91.0 · Etapa 2: unir, clasificar y lo que no va ═══════════════
const marca = (que, extra) => ({ que, por: quien(), en: ahoraChile().texto, ...(extra || {}) });
const conHist = (a, h) => (Array.isArray(a && a.historial) ? a.historial : []).concat([h]).slice(-40);
const error = (msg, code) => Object.assign(new Error(msg), { code });
// Lee lo último de cada documento y movimiento tocado (dentro de una transacción) para no pisar un cambio de otra pestaña
async function enTransaccion(fn) { const d = await dbBase(); return FB.runTransaction(d, tx => fn(tx, d)); }
// La seña aprendida en la ficha del proveedor: una vez cada seña; recuerda con qué movimiento se aprendió (para olvidarla al deshacer)
function conGlosa(prev, doc, sena, movId, h) {
  const gl = (prev && Array.isArray(prev.glosas) ? prev.glosas : []).filter(g => g && g.sena);
  const base = prev ? {} : { rut: doc.rut || '', razon: doc.razon || '' };
  if (gl.some(g => g.sena === sena)) return { ...base, glosas: gl };
  return { ...base, glosas: gl.concat([{ sena, movId, por: h.por, en: h.en }]).slice(-20) };
}
const idPago = (docId, ref, n) => 'p_' + GN.hash(docId + '|' + ref) + (n ? '_' + n : '');

// Pagar: partes = [{ docId, monto }], con un movimiento (movId) o un medio sin banco (efectivo, personal) y su fecha.
export async function pagar({ partes, movId = '', medio = 'cargo', fecha = '', nota = '' }) {
  if (!partes || !partes.length) throw error('Nada que pagar.', 'datos');
  const pagosAntes = await todos(GN.COL.pagos);
  return enTransaccion(async (tx, d) => {
    const refs = partes.map(p => FB.doc(d, GN.COL.docs, p.docId)), sn = [];
    for (const r of refs) sn.push(await tx.get(r));
    let mov = null; const mref = movId ? FB.doc(d, GN.COL.movs, movId) : null;
    if (mref) { const ms = await tx.get(mref); if (!ms.exists()) throw error('Ese movimiento ya no está.', 'cambio'); mov = ms.data(); if (mov.naturaleza || mov.estado === 'no_va') throw error('Ese movimiento ya se marcó como "no es gasto".', 'cambio'); }
    sn.forEach((x, i) => { if (!x.exists()) throw error('Un documento ya no está.', 'cambio'); if (x.data().estado === 'no_va') throw error(`El documento N° ${x.data().folio || ''} se marcó "Esto no va".`, 'cambio'); });
    // v0.91.2 · Regla: cada documento pagado tiene que estar clasificado (por sí mismo o por su proveedor)
    const claves = [...new Set(sn.map(x => GB.claveProveedor(x.data())))], provs = {};
    for (const k of claves) { const ps = await tx.get(FB.doc(d, GN.COL.provs, k)); if (ps.exists()) provs[k] = ps.data(); }
    const falta = GB.faltaClasificar(sn.map(x => ({ id: x.id, ...x.data() })), provs);
    if (falta.length) throw error(`Primero clasifique: ${falta.map(x => x.razon || x.folio).join(', ')}.`, 'clasificar');
    // v0.91.1 · El proveedor aprende cómo aparece en el banco (solo si todos los documentos son del mismo proveedor y la glosa tiene seña propia)
    const sena = mov ? GB.senaDe(mov.glosa) : '';
    const aprende = sena && claves.length === 1 ? { ref: FB.doc(d, GN.COL.provs, claves[0]), dato: sn[0].data(), prev: provs[claves[0]] || null } : null;
    const h = marca(movId ? 'pagado con un movimiento' : 'pagado sin banco', { medio, movId, nota: String(nota || '').slice(0, 200) });
    partes.forEach((p, i) => {
      const ref = movId || (medio + '|' + fecha), n = pagosAntes.filter(x => x.id === idPago(p.docId, ref) || x.id.startsWith(idPago(p.docId, ref) + '_')).length;
      tx.set(FB.doc(d, GN.COL.pagos, idPago(p.docId, ref, n)), limpio({ docId: p.docId, movId, medio: movId ? 'cargo' : medio, monto: Math.round(Number(p.monto) || 0), fecha: movId ? mov.fecha : fecha,
        cuenta: mov ? mov.cuenta : '', nota: String(nota || '').slice(0, 200), estado: 'vigente', creado: { por: h.por, en: h.en } }));
      tx.update(refs[i], { historial: conHist(sn[i].data(), h) });
    });
    if (mref) tx.update(mref, { historial: conHist(mov, marca('unido a ' + partes.length + (partes.length === 1 ? ' documento' : ' documentos'), { docs: partes.map(p => p.docId) })) });
    if (aprende) tx.set(aprende.ref, conGlosa(aprende.prev, aprende.dato, sena, movId, h), { merge: true });
    return { pagos: partes.length, sena: aprende ? sena : '' };
  });
}
// Deshacer un pago: queda "deshecho" (con quién, cuándo y por qué); el documento y el movimiento vuelven a estar abiertos
export async function deshacerPago(pagoId, motivo) {
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.pagos, pagoId), sn = await tx.get(ref);
    if (!sn.exists() || sn.data().estado === 'deshecho') throw error('Ese pago ya no está vigente.', 'cambio');
    const p = sn.data(), h = marca('pago deshecho', { pagoId, motivo: String(motivo || '').slice(0, 200) });
    const dref = FB.doc(d, GN.COL.docs, p.docId), ds = await tx.get(dref), mref = p.movId ? FB.doc(d, GN.COL.movs, p.movId) : null, ms = mref ? await tx.get(mref) : null;
    const pref = p.movId && ds.exists() ? FB.doc(d, GN.COL.provs, GB.claveProveedor(ds.data())) : null, ps = pref ? await tx.get(pref) : null;
    tx.update(ref, { estado: 'deshecho', deshecho: { por: h.por, en: h.en, motivo: h.motivo } });
    if (ds.exists()) tx.update(dref, { historial: conHist(ds.data(), h) });
    if (ms && ms.exists()) tx.update(mref, { historial: conHist(ms.data(), h) });
    if (ps && ps.exists() && (ps.data().glosas || []).some(g => g.movId === p.movId)) tx.update(pref, { glosas: ps.data().glosas.filter(g => g.movId !== p.movId) });   // v0.91.1: se olvida lo aprendido con ese pago
  });
}
// Esto no va (documento): repetido, no es de la empresa o no es una compra. Volver a la Bandeja lo deshace.
export async function noVa(docId, motivo, nota) {
  if (!GB.MOTIVOS_NO_VA[motivo]) throw error('Elija el motivo.', 'datos');
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.docs, docId), sn = await tx.get(ref), a = sn.data();
    const h = marca('esto no va: ' + GB.MOTIVOS_NO_VA[motivo], { nota: String(nota || '').slice(0, 200) });
    tx.update(ref, { estado: 'no_va', noVa: { motivo, nota: h.nota, por: h.por, en: h.en }, historial: conHist(a, h) });
  });
}
export async function volverDoc(docId) {
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.docs, docId), sn = await tx.get(ref), a = sn.data();
    tx.update(ref, { estado: 'vigente', noVa: null, historial: conHist(a, marca('vuelve a la Bandeja')) });
  });
}
// No es gasto (movimiento): traspaso, retiro del dueño, pago de la tarjeta de crédito u otro. Volver lo deshace.
export async function noEsGasto(movId, tipo, nota) {
  if (!GB.NO_GASTO[tipo]) throw error('Elija qué es.', 'datos');
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.movs, movId), sn = await tx.get(ref), a = sn.data();
    const h = marca('no es gasto: ' + GB.NO_GASTO[tipo], { nota: String(nota || '').slice(0, 200) });
    tx.update(ref, { naturaleza: tipo, naturalezaNota: h.nota, historial: conHist(a, h) });
  });
}
export async function volverMov(movId) {
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.movs, movId), sn = await tx.get(ref), a = sn.data();
    tx.update(ref, { naturaleza: '', naturalezaNota: '', historial: conHist(a, marca('vuelve a la Bandeja')) });
  });
}
// Clasificar: ítem y reparto en el documento; "recordar" lo deja en su proveedor para los que vienen
// Clasificar (v0.92.0, por partes). clasif = { general: { item, areas }, partes?, lineas? } o lo simple { item, areas } (lo sugerido).
//  · general: lo de "toda la factura" (lo que el proveedor recuerda para las próximas).
//  · partes: [{ item, area, monto }] que suman la base del documento (si no vienen, salen de general).
//  · lineas: [{ descripcion, item, area }] cuando se separó por líneas: el proveedor recuerda cada producto.
export async function clasificar(doc, clasif, recordar = true) {   // recordar: 'fijo' | 'item' | false (true = 'fijo')
  const modo = recordar === 'item' ? 'item' : 'fijo';
  const gen = clasif.general || { item: clasif.item, areas: clasif.areas };
  const err = GB.repartoValido(gen.areas); if (err) throw error(err, 'datos');
  if (!String(gen.item || '').trim()) throw error('Elija el ítem.', 'datos');
  const general = { item: String(gen.item).trim(), areas: gen.areas.map(a => ({ area: String(a.area), pct: Math.round(Number(a.pct) * 100) / 100 })) };
  const base = GB.baseDe(doc), partes = (clasif.partes && clasif.partes.length ? clasif.partes : GB.partesSimple(base, general.item, general.areas))
    .map(x => ({ item: String(x.item).trim(), area: String(x.area), monto: Math.round(Number(x.monto) || 0) }));
  const e2 = GB.partesValidas(partes, base); if (e2) throw error(e2, 'datos');
  const lineas = (clasif.lineas || []).filter(l => l && l.descripcion && l.item && l.area);
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.docs, doc.id), sn = await tx.get(ref), a = sn.data(), h = marca('clasificado', { clasificacion: GB.textoPartes(partes) });
    const pref = recordar ? FB.doc(d, GN.COL.provs, GB.claveProveedor(doc)) : null, ps = pref ? await tx.get(pref) : null, prev = ps && ps.exists() ? ps.data() : null;
    tx.update(ref, { clasif: { item: general.item, areas: general.areas, partes, porLineas: lineas.length > 0, lineas: lineas.map(l => ({ descripcion: String(l.descripcion).slice(0, 120), item: l.item, area: l.area })), por: h.por, en: h.en }, historial: conHist(a, h) });
    if (pref) {
      // En modo "solo el ítem", ningún producto guarda área (tampoco los que la tenían de antes)
      const antes = Object.fromEntries(Object.entries((prev && prev.productos) || {}).map(([k, v]) => [k, modo === 'item' ? { item: v.item } : v]));
      const productos = { ...antes, ...GB.productosARecordar(lineas, modo) };
      tx.set(pref, limpio({ rut: doc.rut || '', razon: doc.razon || '', item: general.item, modo, por: h.por, en: h.en, historial: conHist(prev, h) }), { merge: true });
      tx.update(pref, { areas: modo === 'fijo' ? general.areas : [], productos: limpio(productos) });   // estos dos se reemplazan enteros (merge mezclaría lo de antes)
    }
  });
}
// Registrar a mano desde un movimiento: boleta en papel o pago sin documento. Nace el documento ya pagado con ese movimiento.
export async function registrarAMano(mov, p) {
  const err = GB.repartoValido(p.areas); if (err) throw error(err, 'datos');
  if (!String(p.proveedor || '').trim()) throw error('Escriba a quién se le pagó.', 'datos');
  if (!String(p.item || '').trim()) throw error('Elija el ítem.', 'datos');
  const monto = Math.round(Number(p.monto) || 0); if (!(monto > 0) || monto > mov.libre) throw error('El monto debe ser mayor que cero y no más que lo libre del movimiento.', 'datos');
  const tipo = p.tipo === 'boleta' ? '39m' : 'sd', docId = `d_mano_${mov.id}_${GN.hash(String(Date.now()))}`, h = marca('registrado a mano', { movId: mov.id });
  const rut = GN.rutN(p.rut);
  const doc = { origen: 'mano', tipo, tipoTexto: p.tipo === 'boleta' ? 'Boleta' : 'Sin documento', nc: false, rut: rut ? GN.rutTexto(rut) : '', rutN: rut, razon: String(p.proveedor).trim().slice(0, 120), folio: String(p.folio || '').slice(0, 30),
    fecha: mov.fecha, mes: mov.fecha.slice(0, 7), neto: 0, exento: 0, iva: 0, otroImp: 0, total: monto, vence: '', formaPago: '', referencias: [], detalle: p.nota ? [{ descripcion: String(p.nota).slice(0, 120), cantidad: 1, unidad: '', monto }] : [],
    estado: 'vigente', clasif: { item: String(p.item).trim(), areas: p.areas, partes: GB.partesSimple(monto, String(p.item).trim(), p.areas), por: h.por, en: h.en }, creado: { por: h.por, en: h.en, mov: mov.id }, version: 0, historial: [h] };
  return enTransaccion(async (tx, d) => {
    const mref = FB.doc(d, GN.COL.movs, mov.id), ms = await tx.get(mref), m = ms.data();
    const pref = p.recordar !== false ? FB.doc(d, GN.COL.provs, GB.claveProveedor(doc)) : null, ps = pref ? await tx.get(pref) : null;
    tx.set(FB.doc(d, GN.COL.docs, docId), limpio(doc));
    tx.set(FB.doc(d, GN.COL.pagos, idPago(docId, mov.id)), { docId, movId: mov.id, medio: 'cargo', monto, fecha: mov.fecha, cuenta: mov.cuenta, nota: '', estado: 'vigente', creado: { por: h.por, en: h.en } });
    tx.update(mref, { historial: conHist(m, marca('registrado a mano: ' + doc.razon, { docs: [docId] })) });
    if (pref) { const sena = GB.senaDe(mov.glosa), prev = ps && ps.exists() ? ps.data() : null;
      tx.set(pref, limpio({ rut: doc.rut, razon: doc.razon, item: doc.clasif.item, modo: (prev && prev.modo) || 'fijo', areas: prev && prev.modo === 'item' ? [] : p.areas, por: h.por, en: h.en, historial: conHist(prev, h), ...(sena ? { glosas: conGlosa(prev, doc, sena, mov.id, h).glosas } : {}) }), { merge: true }); }
    return { docId };
  });
}

// v0.91.1 · Olvidar una seña aprendida (desde el par que la muestra)
export async function olvidarSena(provKey, sena) {
  return enTransaccion(async (tx, d) => {
    const ref = FB.doc(d, GN.COL.provs, provKey), sn = await tx.get(ref); if (!sn.exists()) return;
    const a = sn.data(); tx.update(ref, { glosas: (a.glosas || []).filter(g => g.sena !== sena), historial: conHist(a, marca('olvidó la glosa ' + sena)) });
  });
}
