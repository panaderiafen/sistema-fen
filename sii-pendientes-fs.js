// ═══════════════════════════════════════════════
//  Sistema Fën — Documentos del SII por clasificar y pagos sin banco, con la base nueva (fen-gastos)  v0.66.0
//  Reglas en sii-pendientes.js. Aquí solo lo que lee y escribe:
//  · sii_docs/{id}.porClasificar: el documento tal como vino del archivo (montos, fechas, forma de pago y productos), guardado
//    al subirlo. Sin "lineas" ni "notas": la copia a la planilla no agrega nada a "Detalle Compras" hasta que se clasifica
//    (al importar, sus productos entran como siempre). Un documento ya importado no se toca.
//  · Clasificar (al conciliar, en Pagos sin banco o en Cargas del SII): se importa con lo de siempre (gastos-sii-fs.js: un
//    gasto por ítem y área con la fecha de la factura, el vencimiento si es a crédito, la ficha del proveedor aprendida).
//  · Pagos en efectivo o con tarjeta: el gasto queda con su fecha de pago y medio, y un registro en sii_pagos/{doc} para el
//    flujo de caja (F4). sii_pagos no pasa a la planilla (como tef_enviadas y proveedores).
//  · "Todavía por pagar": un vencimiento con la fecha esperada (Agenda y Hoy); se puede reagendar.
//  · config/sii_pagos = { dias }: desde cuántos días después de la factura se pregunta (10 si no se cambia).
//  · Revisar automáticas: los gastos clasificados solos al subir, hasta que se revisan (autoRevisada), se corrigen o se anulan.
//  Lecturas: sii_docs y gastos salen de la memoria de fs-gastos.js (paquetes): ninguna lectura por documento.
// ═══════════════════════════════════════════════
import * as FB from './fs-gastos.js?v=0.66.0';
import * as M from './gastos-g2.js?v=0.66.0';
import * as S from './gastos-sii.js?v=0.66.0';
import * as SP from './sii-pendientes.js?v=0.66.0';
import * as G3 from './gastos-g3.js?v=0.66.0';
import { dbBase, todos, catalogo, nuevo, nuevoVenc, cambio, despues, limpio, correo } from './gastos-fs.js?v=0.66.0';

const s = v => String(v == null ? '' : v);
const error = (msg, code) => Object.assign(new Error(msg), { code });
const ahora = () => M.ahoraChile().texto;
const hoy = () => M.ahoraChile().dia;
const SIIF = () => import('./gastos-sii-fs.js?v=0.66.0');
export const COL_PAGOS = 'sii_pagos';

// ── Configuración (días) ──
let cfg = null;
export async function config(forzar) {
  if (cfg && !forzar) return cfg;
  try { const d = await dbBase(), sn = await FB.getDoc(FB.doc(d, 'config', 'sii_pagos')); const x = sn.exists() ? sn.data() : {}; cfg = { dias: Number(x.dias) > 0 ? Number(x.dias) : SP.DIAS_SIN_PAGO, migrado: s(x.migrado) }; }
  catch (e) { cfg = { dias: SP.DIAS_SIN_PAGO, migrado: '' }; }
  return cfg;
}
export async function guardarConfig(dias) {
  const n = Math.round(Number(dias));
  if (!(n >= 1 && n <= 90)) throw error('Escribe un número de días entre 1 y 90', 'datos');
  const d = await dbBase();
  await FB.setDoc(FB.doc(d, 'config', 'sii_pagos'), { dias: n, por: correo(), en: ahora() }, { merge: true });
  cfg = null;
  return config(true);
}

// ── Lecturas ──
export async function pendientes() { return SP.pendientesDe(await todos('sii_docs')); }
async function pagos() { try { return (await todos(COL_PAGOS)).filter(x => !x.d.quitado).map(x => ({ id: x.id, ...x.d })); } catch (e) { return []; } }
// Lo que muestra la pestaña "Pagos sin banco"
export async function datos() {
  const [pend, gs, pg, c, vencs] = await Promise.all([pendientes(), todos('gastos', FB.where('esperaPago', '==', true)).catch(() => []), pagos(), config(), todos('vencimientos')]);
  const lista = SP.pagosSinBanco({ pendientes: pend, gastos: gs, pagos: pg, hoy: hoy(), dias: c.dias });
  // "Todavía por pagar" ya registrados: vencimientos abiertos de facturas del SII (para reagendar)
  const porPagar = vencs.filter(x => x.d && !x.d.quitadoEnPlanilla && x.d.porPagarSinBanco === true && G3.abierto(x.d))
    .map(x => ({ id: x.id, nombre: s(x.d.nombre), fecha: G3.fechaReal(x.d), monto: Number(x.d.montoEstimado) || 0 })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { lista, pagos: pg, config: c, porPagar, pendientes: pend };
}
// Hoy: conteos desde la memoria
export async function conteosHoy() {
  const [pend, gs, pg, c] = await Promise.all([pendientes(), todos('gastos', FB.where('esperaPago', '==', true)).catch(() => []), pagos(), config()]);
  return SP.conteosHoy(pend, SP.pagosSinBanco({ pendientes: pend, gastos: gs, pagos: pg, hoy: hoy(), dias: c.dias }));
}
// Las pestañas de Conciliación (los números junto al nombre): todo desde la memoria
export async function conteos() {
  const [pend, gs, pg, c, ga] = await Promise.all([pendientes(), todos('gastos', FB.where('esperaPago', '==', true)).catch(() => []), pagos(), config(), todos('gastos', FB.where('clasificacionAutomatica', '==', true)).catch(() => [])]);
  return { porClasificar: pend.filter(v => !v.esNC).length, sinBanco: SP.pagosSinBanco({ pendientes: pend, gastos: gs, pagos: pg, hoy: hoy(), dias: c.dias }).length, automaticas: SP.automaticasDe(ga).length };
}
// Cargas del SII → "Por clasificar" y "Revisar automáticas"
export async function documentos() {
  const [pend, ga] = await Promise.all([pendientes(), todos('gastos', FB.where('clasificacionAutomatica', '==', true)).catch(() => [])]);
  return { pendientes: pend.filter(v => !v.esNC || v.total), automaticas: SP.automaticasDe(ga) };
}
// "Está bien": la automática revisada sale de la lista (queda en su historial)
export async function revisarAutomatica(ids) {
  const d = await dbBase(), refs = (ids || []).map(id => FB.doc(d, 'gastos', s(id)));
  if (!refs.length) throw error('Faltan los gastos', 'datos');
  await FB.runTransaction(d, async tx => {
    const sns = []; for (const r of refs) sns.push(await tx.get(r));
    sns.forEach((g, i) => { if (!g.exists()) throw error('Ese gasto ya no está. Recarga.', 'cambio'); const a = g.data(); if (a.autoRevisada === true) return; tx.update(refs[i], cambio(a, 'revisó la clasificación automática', { autoRevisada: true })); });
  });
  await despues(refs.length);
  return { ok: true };
}

// Fichas de proveedores a mano con su ítem (y área): { rut sin puntos ni guion → { item, area } }
export async function fichasManuales() {
  const out = {};
  (await todos('proveedores')).forEach(x => { const f = x.d || {}; if (f.archivado || !f.item) return; const r = SP.rutNorm(f.rutTexto || f.rut || x.id); if (r) out[r] = { item: s(f.item), area: s(f.area), manual: !!f.manual }; });
  return out;
}
// ── Al subir: guardar los documentos que quedan por clasificar ──
// lista: [{ f (documento leído del archivo), motivo }]; origen: { cargaId, formato, archivo }
export async function guardarPendientes(lista, origen = {}) {
  const docs = await todos('sii_docs'), porId = new Map(docs.map(x => [x.id, x.d])), d = await dbBase(), por = correo(), en = ahora();
  const escribir = [];
  (lista || []).forEach(({ f, motivo }) => {
    if (!f || !S.rutOk(f.rut) || !S.folioOk(f.folio)) return;
    const es61 = s(f.tipoDoc) === '61', id = S.idDoc(f.rut, f.folio, es61), prev = porId.get(id);
    if (prev && (prev.importado || prev.porClasificar) && !prev.quitadoEnPlanilla) return;   // ya está (importado o por clasificar)
    const pc = SP.datosPendiente(f, { ...origen, motivo }, en, por);
    if (!pc.fecha) return;
    escribir.push({ id, prev, campos: { porClasificar: pc } });
  });
  for (let i = 0; i < escribir.length; i += 200) {
    const b = FB.writeBatch(d);
    escribir.slice(i, i + 200).forEach(x => {
      const ref = FB.doc(d, 'sii_docs', x.id), f0 = (lista.find(y => y.f && S.idDoc(y.f.rut, y.f.folio, s(y.f.tipoDoc) === '61') === x.id) || {}).f;
      if (x.prev) b.update(ref, cambio(x.prev, 'quedó por clasificar', x.campos));
      else b.set(ref, nuevo({ ...S.docSiiVacio(f0.rut, f0.folio, s(f0.tipoDoc) === '61', f0.razonSocial), ...x.campos, posPlanilla: 'p' + Date.now() }, 'sii'));
    });
    await b.commit();
  }
  await despues(escribir.length);
  return { ok: true, guardados: escribir.length };
}

// ── Clasificar e importar un documento por clasificar ──
// lineas: [{ item, area, monto }]; pago: { estado, fechaEstado, esperaPago?, formaPago?, pagoSinBanco? }
// → { ok, gastos: [ids], vencimiento, ya? }
export async function clasificar(docId, lineas, pago, opc = {}) {
  const d = await dbBase(), ref = FB.doc(d, 'sii_docs', s(docId));
  const sn = await FB.getDoc(ref);
  if (!sn.exists()) throw error('Ese documento ya no está', 'datos');
  const a = sn.data();
  if (a.importado) return { ok: true, ya: true, gastos: a.importado.gastos || [], vencimiento: a.importado.vencimiento || '' };
  if (!a.porClasificar) throw error('Ese documento no está por clasificar', 'datos');
  const v = SP.vistaPendiente(sn.id || docId, a), cat = await catalogo(), items = cat.lista.filter(i => !i.archivado);
  const AREAS = M.AREAS || [];
  const err = SP.revisarLineas(lineas, v.total, items, AREAS);
  if (err) throw error(err, 'datos');
  const f = SP.facturaClasificada(v, lineas, items, pago, !!opc.auto);
  const SF = await SIIF();
  await SF.importar([f], false, opc.marca || M.marcaNueva(), { formato: v.formato, archivo: v.archivo, cargaId: v.cargaId });
  const sn2 = await FB.getDoc(ref), im = (sn2.exists() && sn2.data().importado) || {};
  try { import('./finanzas.js?v=0.66.0').then(F => F.preciosTrasImportar()).catch(() => {}); } catch (e) {}
  return { ok: true, gastos: im.gastos || [], vencimiento: im.vencimiento || '' };
}

// ── Pagos sin banco ──
const idPago = docId => 'sp-' + s(docId).replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 120);
// x: fila de pagosSinBanco; medio: 'efectivo' | 'tarjeta'; fecha aaaa-mm-dd; lineas (si está por clasificar)
export async function marcarPago(x, medio, fecha, lineas, origen) {
  if (!['efectivo', 'tarjeta'].includes(medio)) throw error('Elige cómo se pagó', 'datos');
  if (!M.esIso(fecha)) throw error('Elige la fecha del pago', 'datos');
  let org = {};
  if (medio === 'efectivo') { const r = SP.revisarOrigen(origen || {}); if (r.error) throw error(r.error, 'datos'); org = r.limpio; }
  const d = await dbBase(), por = correo(), en = ahora();
  let ids = x.gastos || [];
  if (x.porClasificar) {
    const r = await clasificar(x.docId, lineas, { estado: 'pagada', fechaEstado: fecha, formaPago: medio === 'tarjeta' ? 'tarjeta' : '', pagoSinBanco: { medio, fecha, ...org } });
    ids = r.gastos;
  } else {
    if (!ids.length) throw error('Esa factura no tiene gastos', 'datos');
    await FB.runTransaction(d, async tx => {
      const refs = ids.map(id => FB.doc(d, 'gastos', id)), sns = [];
      for (const r of refs) sns.push(await tx.get(r));
      sns.forEach((g, i) => {
        if (!g.exists()) throw error('Un gasto de esa factura ya no está. Recarga.', 'cambio');
        const a = g.data();
        if (a.estado !== 'vigente' || a.cartolaCargo || s(a.fechaPago)) throw error('Esa factura ya tiene su pago registrado (otro equipo o la cartola). Recarga.', 'cambio');
        tx.update(refs[i], cambio(a, medio === 'efectivo' ? 'pagada en efectivo' : 'pagada con tarjeta de crédito', { fechaPago: fecha, esperaPago: false, medioPago: medio, formaPago: medio === 'tarjeta' ? 'tarjeta' : 'contado', pagoSinBanco: { medio, fecha, ...org, por, en } }));
      });
    });
    await despues(ids.length);
  }
  const reg = { docId: s(x.docId), rut: s(x.rut), folio: s(x.folio), razonSocial: s(x.razonSocial), monto: Math.round(Number(x.total) || 0), fecha, mes: fecha.slice(0, 7), medio, ...org, gastos: ids, fechaFactura: s(x.fecha), por, en,
    historial: [{ que: medio === 'efectivo' ? `pagada en efectivo (${SP.textoOrigen(org)})` : 'pagada con tarjeta de crédito', por, en }] };
  await FB.setDoc(FB.doc(d, COL_PAGOS, idPago(x.docId)), limpio(reg));
  return { ok: true, gastos: ids };
}
// "Todavía por pagar": un vencimiento con la fecha esperada. Por clasificar: se clasifica e importa a crédito (crea su vencimiento).
export async function porPagar(x, fecha, lineas) {
  if (!M.esIso(fecha)) throw error('Elige la fecha en que esperas pagarla', 'datos');
  if (x.porClasificar) {
    const r = await clasificar(x.docId, lineas, { estado: 'pendiente', fechaEstado: fecha });
    if (r.vencimiento) await marcarVencSinBanco(r.vencimiento);
    return { ok: true, vencimiento: r.vencimiento, gastos: r.gastos };
  }
  const ids = x.gastos || [];
  if (!ids.length) throw error('Esa factura no tiene gastos', 'datos');
  const d = await dbBase(), marca = M.marcaNueva(), vid = S.idVencSii(marca, 0);
  await FB.runTransaction(d, async tx => {
    const refs = ids.map(id => FB.doc(d, 'gastos', id)), sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    const gs = sns.map((g, i) => {
      if (!g.exists()) throw error('Un gasto de esa factura ya no está. Recarga.', 'cambio');
      const a = g.data();
      if (a.estado !== 'vigente' || a.cartolaCargo || s(a.fechaPago)) throw error('Esa factura ya tiene su pago registrado. Recarga.', 'cambio');
      return { ref: refs[i], a };
    });
    const todas = gs.map(({ a }) => ({ area: s(a.area), monto: Math.round(Number(a.montoFinal) || 0) })), a0 = gs[0].a;
    const venc = M.docVencimiento({ id: vid, plantillaID: '', nombre: '📋 ' + s(a0.razonSocial) + ' F.' + s(a0.folio), item: s(a0.itemGasto), periodoKey: fecha.slice(0, 7), fechaVencimiento: fecha,
      montoEstimado: todas.reduce((t0, y) => t0 + y.monto, 0), obs: 'F.' + s(a0.folio), area: todas.length === 1 ? todas[0].area : 'MULTI', categoria: s(a0.categoria), tipo: s(a0.tipo), subTipo: s(a0.subTipo),
      multiArea: todas.length > 1 ? JSON.stringify(todas) : '', estado: 'PENDIENTE', fechaCompra: s(a0.fecha).split('-').reverse().join('-') });
    tx.set(FB.doc(d, 'vencimientos', vid), nuevoVenc({ ...venc, porPagarSinBanco: true }, 'sii'));
    gs.forEach(({ ref, a }) => tx.update(ref, cambio(a, 'todavía por pagar', { formaPago: 'proveedor', esperaPago: false, fechaPago: '' }, { vencimiento: vid })));
    if (a0.siiDoc && a0.siiDoc.id) {
      const rd = FB.doc(d, 'sii_docs', s(a0.siiDoc.id)), sd = await tx.get(rd);
      if (sd.exists() && sd.data().importado) tx.update(rd, cambio(sd.data(), 'todavía por pagar', { importado: { ...sd.data().importado, vencimiento: vid, estado: 'pendiente', fechaEstado: fecha } }));
    }
  });
  await despues(ids.length + 2);
  return { ok: true, vencimiento: vid };
}
async function marcarVencSinBanco(id) {
  const d = await dbBase(), ref = FB.doc(d, 'vencimientos', s(id)), sn = await FB.getDoc(ref);
  if (!sn.exists()) return;
  await FB.updateDoc(ref, cambio(sn.data(), 'todavía por pagar', { porPagarSinBanco: true }));
  await despues(1);
}
// Reagendar la fecha esperada de pago (un vencimiento por pagar, sin abonos)
export async function reagendar(vencId, fecha) {
  if (!M.esIso(fecha)) throw error('Elige la fecha nueva', 'datos');
  const d = await dbBase(), ref = FB.doc(d, 'vencimientos', s(vencId));
  await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const v = sn.data();
    if (!G3.abierto(v)) throw error('Ese vencimiento ya no está por pagar', 'datos');
    if (G3.estadoBase(v) === 'con_abonos') throw error('Tiene abonos: usa "Reagendar saldo" en Gastos → Vencimientos', 'datos');
    tx.update(ref, cambio(v, 'reagendó', { fechaVencimiento: fecha, periodoKey: fecha.slice(0, 7) }));
  });
  await despues(1);
  return { ok: true };
}

// ── Migración (una vez): los documentos de cargas anteriores que no se importaron quedan "por clasificar" ──
// Sin clasificarse solos. Lo ya importado queda igual. Solo se leen (de Drive, con el script) las cargas que tienen documentos
// sin importar que todavía no están por clasificar. leerCarga(id) → { contenido }; leer(contenido) → { formato, facturas } (sii.js);
// filtrar(facturas) → las que siguen sin importar y no van al vencimiento de una obligación "según documento".
export async function migrarCargas(cargas, leerCarga, leer, filtrar = async f => f, avance = () => {}) {
  let n = 0, cargasN = 0, errores = 0;
  const ya = new Set((await pendientes()).map(v => `${v.rut}|${v.folio}${v.tipo === '61' ? '|61' : ''}`));
  const conPend = (cargas || []).filter(c => c.url && (c.documentos || []).some(z => !z.importado && !ya.has(z.clave)));
  for (const c of conPend) {
    avance(`Pasando a "por clasificar" lo que quedó sin importar: ${c.nombreArchivo || 'carga'} (${cargasN + 1} de ${conPend.length})…`);
    try {
      const r = await leerCarga(c.id), contenido = typeof r === 'string' ? r : (r && r.contenido) || '';
      const { formato, facturas } = leer(contenido);
      const pend = new Set(c.documentos.filter(z => !z.importado && !ya.has(z.clave)).map(z => z.clave));
      const quedan = await filtrar(facturas.filter(f => pend.has(`${f.rut}|${f.folio}${s(f.tipoDoc) === '61' ? '|61' : ''}`)));
      n += (await guardarPendientes(quedan.map(f => ({ f, motivo: 'De una carga anterior' })), { cargaId: c.id, formato, archivo: c.nombreArchivo })).guardados;
    } catch (e) { errores++; }
    cargasN++;
  }
  if (!errores) { try { const d = await dbBase(); await FB.setDoc(FB.doc(d, 'config', 'sii_pagos'), { migrado: ahora(), migradoPor: correo() }, { merge: true }); cfg = null; } catch (e) {} }
  return { ok: true, documentos: n, cargas: cargasN, errores };
}
