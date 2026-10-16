// ═══════════════════════════════════════════════
//  Sistema Fën — Gastos con la base nueva (fen-gastos), etapa G3 (cuarta parte)  v0.51.0
//  Se usa solo cuando config/gastos dice fuente = "base". Reglas en gastos-g3d.js.
//  · Previred: cot_estado, cot_registrar y cot_lista con las colecciones cotizaciones (una por línea del certificado, id
//    "c-<huella de su Clave>", como la copia G1) y cotiz_trabajadores (área e ítem recordados por RUT). Mismas respuestas
//    que el script (previred.js elige uno u otro). El PDF va a Drive con el script (archivo_subir tipo "previred",
//    "Fën · Gastos / Previred / <año>", privado: script v2.17.0).
//    Regla acordada: si existe la obligación "Cotizaciones" (según documento, identificador Previred) con su vencimiento
//    abierto, el certificado lo COMPLETA (montoDocumento = total, documento { tipo: 'previred', archivo, plan por
//    trabajador }, estado por_pagar) y los gastos por trabajador se crean al pagarlo (Pagar o la cartola: lineasDelPago).
//    Si no, como hoy: un gasto por trabajador al subir (y, si se eligió, el vencimiento queda pagado).
//  · Clasificar obligaciones: la lista con la propuesta y guardar el tipo y el identificador de varias (cada una por su
//    lado, con las reglas de la v0.49.0 para sus vencimientos abiertos).
//  · Arreglo "siniva": vista previa y aplicar (cada gasto con su historial "ajuste siniva" y la marca para la planilla).
//  · v0.67.0 · Comprobante de pago de Previred (con intereses y multas). Mes nuevo: cot_registrar con el comprobante (los
//    trabajadores como siempre + un gasto "Multas e intereses Previred <mes>", o ambos al pagar el vencimiento). Mes que ya
//    tiene sus cotizaciones (certificado): cot_comprobante (solo las multas e intereses, sin repetir los trabajadores). El
//    comprobante queda en previred_planillas/{AAAA-MM}.comprobante y el total de la planilla pasa a ser lo pagado. Quitarlo
//    (cot_quitar_comprobante) anula el gasto de multas e intereses y deja el comprobante en comprobantesQuitados.
//    El aviso de vencimiento (Hoy y Agenda) sale de la memoria: cotizaciones (paquete) y previred_planillas (pocos documentos).
// ═══════════════════════════════════════════════
import * as FB from './fs-gastos.js?v=0.67.4';
import * as M from './gastos-g2.js?v=0.67.4';
import * as G3 from './gastos-g3.js?v=0.67.4';
import * as D from './gastos-g3d.js?v=0.67.4';
import * as C from './gastos-cartola.js?v=0.67.4';
import { dbBase, todos, catalogo, nuevo, cambio, despues, correo } from './gastos-fs.js?v=0.67.4';

const error = (msg, code) => Object.assign(new Error(msg), { code });
const s = v => String(v == null ? '' : v);
const MAX_ESCRITURAS = 450;   // una transacción de Firestore acepta hasta 500

// ── Previred ──
// p = { claves, periodo?, fechaPago? }: además de lo del script, a dónde va el certificado (destino)
export async function cotEstado(p) {
  const [cot, trab, ps, vencs] = await Promise.all([todos('cotizaciones'), todos('cotiz_trabajadores'), todos('obligaciones'), todos('vencimientos')]);
  const r = D.estadoCot(cot, trab, p && p.claves);
  if (p && M.esIso(p.fechaPago)) {
    const x = D.destinoCertificado(ps, vencs, p.fechaPago);
    r.destino = x.venc ? { vencimientoId: x.venc.id, nombre: s(x.venc.d.nombre), fecha: G3.fechaReal(x.venc.d), obligacion: s(x.obl.d.nombre) } : { nota: x.motivo };
  }
  // v0.67.0 · Lo del mes (para el comprobante): ¿ya tiene cotizaciones?, ¿por certificado o por comprobante?, su comprobante y los ítems
  // para las multas e intereses (todo de la memoria: cotizaciones, items y fin_items en los paquetes; previred_planillas son pocos)
  if (p && /^\d{4}-(0[1-9]|1[0-2])$/.test(s(p.periodo))) {
    const [pl, fin, cat] = await Promise.all([todos(COL_PL).catch(() => []), todos('fin_items').catch(() => []), catalogo()]);
    const del = delMes(cot, p.periodo), doc = (pl.find(x => x.id === p.periodo) || {}).d || null, comp = compVigente(doc);
    const vid = s((del.find(x => x.d.vencimientoId) || { d: {} }).d.vencimientoId), v = vid ? vencs.find(x => x.id === vid) : null;
    const dif = D.difVigente(doc);
    r.mes = { cargado: del.length > 0, lineas: del.length, total: del.reduce((t, x) => t + M.n(x.d.monto), 0), porComprobante: del.some(x => s(x.d.deComprobante)),
      porCsv: del.some(x => !!x.d.deCsv), fechaPago: del.length ? s(del[0].d.fechaPago) : '', trabajadores: new Set(del.map(x => s(x.d.rut).toUpperCase())).size,
      difMultas: dif ? { monto: M.n(dif.monto), fecha: s(dif.fecha), gastoId: s(dif.gastoId) } : null,
      cotizaciones: del.map(x => ({ rut: s(x.d.rut), nombre: s(x.d.nombre), monto: M.n(x.d.monto) })), vencimientoId: vid, vencAbierto: !!(v && G3.abierto(v.d) && G3.esPrevired(v.d)), vencNombre: v ? s(v.d.nombre) : '',
      comprobante: comp ? { clave: s(comp.clave), totalPagado: M.n(comp.totalPagado), totalRecargos: M.n(comp.totalRecargos), fechaPago: s(comp.fechaPago), cargadoEl: s(comp.cargadoEl) } : null };
    const finM = Object.fromEntries(fin.map(x => [x.id, x.d]));
    r.recargos = { ...D.itemsRecargos(cat.lista, finM), area: D.areaRecargos(), avisos: D.avisosRecargos(cat.lista, finM) };   // v0.67.1: dónde arreglar el tipo
  }
  return r;
}
const COL_PL = 'previred_planillas';
const delMes = (cot, per) => (cot || []).filter(x => x.d && !x.d.quitadoEnPlanilla && D.periodoCot(x.d.periodo) === per);
const compVigente = doc => (doc && doc.comprobante && !doc.comprobante.quitado ? doc.comprobante : null);
// La planilla del mes no pasa a la planilla de Google (como en gastos-cartola-fs.js): sin la marca de copia
const sinPlanilla = o => { const x = { ...o }; delete x.planillaPendiente; delete x.hechoEnBase; return x; };
const subirPdf = async (subir, p) => {
  const b64 = s(p.archivoBase64);
  if (!b64) return '';
  // v0.67.3: también el CSV de la nómina (text/csv; el script v2.18.0 lo guarda en la misma carpeta, con su nombre)
  try { return (await subir({ tipo: 'previred', fecha: '01-' + p.periodo.slice(5, 7) + '-' + p.periodo.slice(0, 4), imageData: b64, mimeType: p.csv ? 'text/csv' : 'application/pdf', fileName: s(p.nombreArchivo || 'previred.pdf').replace(/[\/\\]/g, '_').slice(0, 120) || 'previred.pdf' })).url || ''; } catch (e) { return ''; }
};
// v0.65.1: cada mes con sus pagos del banco unidos (previred_planillas y, si su vencimiento se pagó con la cartola, esos cargos)
export async function cotLista() {
  const [cot, pl, vencs, cg] = await Promise.all([todos('cotizaciones'), todos('previred_planillas').catch(() => []), todos('vencimientos'), todos('cartola_cargos').catch(() => [])]);
  const r = D.listaCot(cot);
  const abiertos = new Set(vencs.filter(x => x.d && !x.d.quitadoEnPlanilla && G3.abierto(x.d)).map(x => x.id));
  const pls = C.planillasPrevired(r.periodos, Object.fromEntries(pl.map(x => [x.id, x.d])), abiertos, cg.filter(x => !x.d.quitadoEnPlanilla && x.d.accion === C.PREVIRED).map(x => C.vistaCargo(x.id, x.d)));
  const porPer = Object.fromEntries(pls.map(x => [x.periodo, x]));
  r.periodos.forEach(P => { const x = porPer[P.periodo]; if (x) Object.assign(P, { pagos: x.pagos, unido: x.unido, falta: x.falta, conciliada: x.conciliada, vencAbierto: x.vencAbierto, quitados: x.quitados }); });
  // v0.67.0 · El comprobante del mes (si lo tiene): cotizaciones + multas e intereses = pagado; el total de la planilla es lo pagado
  const docs = Object.fromEntries(pl.map(x => [x.id, x.d]));
  r.periodos.forEach(P => {
    const c = compVigente(docs[P.periodo]), q = (docs[P.periodo] || {}).comprobantesQuitados;
    P.cotizaciones = P.total;
    if (c) Object.assign(P, { comprobante: { totalCotizaciones: M.n(c.totalCotizaciones), totalRecargos: M.n(c.totalRecargos), totalPagado: M.n(c.totalPagado), fueraDePlazo: !!c.fueraDePlazo, fechaPago: s(c.fechaPago),
      archivo: s(c.archivo), instituciones: c.instituciones || [], gastoRecargosId: s(c.gastoRecargosId), cargadoEl: s(c.cargadoEl), folios: c.folios || [] }, total: M.n(c.totalPagado) });
    if (Array.isArray(q) && q.length) P.comprobantesQuitados = q.length;
    // v0.67.3 · Sin comprobante: la diferencia del banco registrada como multas e intereses (el total es lo del banco)
    const dif = !c ? D.difVigente(docs[P.periodo]) : null;
    if (dif) Object.assign(P, { difMultas: { monto: M.n(dif.monto), fecha: s(dif.fecha), gastoId: s(dif.gastoId), item: s(dif.item), banco: M.n(dif.banco) }, total: P.cotizaciones + M.n(dif.monto) });
    if (P.porCsv) P.origenDoc = 'csv';
  });
  return r;
}
// v0.67.3 · Quitar la diferencia del banco registrada como multas e intereses: el gasto se anula (no se borra), la planilla la
// deja en difMultasQuitadas (con quién, cuándo y por qué) y su total vuelve a ser el de las cotizaciones. Los cargos unidos siguen.
// p = { periodo, motivo }
export async function cotQuitarDifMultas(p) {
  const d = await dbBase(), per = s(p && p.periodo), motivo = M.texto(p && p.motivo, 300);
  if (motivo.length < 3) throw error('Escribe el motivo', 'datos');
  const [cot, pl] = await Promise.all([todos('cotizaciones'), todos(COL_PL).catch(() => [])]);
  const d0 = D.difVigente((pl.find(x => x.id === per) || {}).d);
  if (!d0) throw error('Ese mes no tiene una diferencia registrada como multas e intereses', 'datos');
  const refP = FB.doc(d, COL_PL, per), refG = s(d0.gastoId) ? FB.doc(d, 'gastos', s(d0.gastoId)) : null;
  const quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto, cotTotal = delMes(cot, per).reduce((t, x) => t + M.n(x.d.monto), 0);
  const r = await FB.runTransaction(d, async tx => {
    const snP = await tx.get(refP), snG = refG ? await tx.get(refG) : null;
    const a = snP.exists() ? snP.data() : null, dif = D.difVigente(a);
    if (!dif || s(dif.gastoId) !== s(d0.gastoId)) return { yaEstaba: true };
    let k = 0;
    if (snG && snG.exists() && snG.data().estado === 'vigente') { tx.update(refG, cambio(snG.data(), 'anuló', { estado: 'anulado', anulado: { el: en, en, por: quien, motivo: 'Diferencia de Previred quitada: ' + motivo, filaOriginal: '' } }, { motivo })); k++; }
    const pagos = Array.isArray(a.pagos) ? a.pagos : [], unido = pagos.reduce((t, x) => t + M.n(x.monto), 0), falta = Math.round(cotTotal - unido), completa = unido > 0 && Math.abs(falta) <= 10;
    tx.update(refP, sinPlanilla(cambio(a, 'quitó la diferencia registrada como multas e intereses', { difMultas: null, difMultasQuitadas: (Array.isArray(a.difMultasQuitadas) ? a.difMultasQuitadas : []).concat([{ ...dif, quitado: { por: quien, en, motivo } }]),
      total: cotTotal, unido, falta, estado: completa ? 'pagada_conciliada' : unido ? 'parcial' : 'sin_pagos', ...(completa ? {} : { conciliadaEl: '', conciliadaPor: '' }) }, { motivo })));
    k++;
    return { k };
  });
  if (r.yaEstaba) return { ok: true, yaEstaba: true };
  await despues(r.k);
  return { ok: true };
}

// p = { periodo, fechaPago, fecha, vencimientoId, trabajadores, archivoBase64, nombreArchivo }; marca fija por envío
export async function cotRegistrar(p, marca, subir) {
  const d = await dbBase(), clave = marca.t + marca.r;
  const [cot, cat, ps, vencs] = await Promise.all([todos('cotizaciones'), catalogo(), todos('obligaciones'), todos('vencimientos')]);
  // ¿Ya quedó (un reintento del mismo envío)?
  const mio = cot.find(x => x.d.cargadoClave === clave);
  if (mio) {
    const del = cot.filter(x => x.d.cargadoClave === clave);
    return { ok: true, repetido: true, trabajadores: new Set(del.map(x => x.d.rut)).size, total: del.reduce((t, x) => t + M.n(x.d.monto), 0), lineas: del.length, conArchivo: !!mio.d.archivo, vencimiento: false, aVencimiento: mio.d.vencimientoId ? { id: mio.d.vencimientoId } : null };
  }
  const r = D.revisarRegistro(p, cat.lista.filter(i => !i.archivado), cot);
  if (r.error) throw error(r.error, r.code);
  // v0.67.0 · Con el comprobante de pago: revisado, y el mes no puede tener cotizaciones (sus líneas tienen otros nombres que las
  // del certificado: se cuida por el mes). Un certificado de un mes registrado con el comprobante tampoco entra.
  const del = delMes(cot, p.periodo);
  let comp = null;
  if (p.comprobante) {
    comp = D.revisarComprobante(p.comprobante, cat.lista.filter(i => !i.archivado), p.periodo);
    if (comp.error) throw error(comp.error, comp.code);
    if (comp.limpio.totalCotizaciones !== r.total) throw error('El detalle por trabajador no suma las cotizaciones del comprobante. No se guardó nada.', 'datos');
    if (del.length) throw error('Ese mes ya tiene cotizaciones cargadas: vuelve a subir el comprobante para agregar solo las multas e intereses. No se guardó nada.', 'duplicado');
  } else if (p.csv) {
    // v0.67.3 · El CSV de la nómina solo registra un mes sin cotizaciones (si ya tiene, solo se compara en la pantalla)
    if (del.length) throw error('Ese mes ya tiene sus cotizaciones cargadas: el CSV solo se compara, no agrega nada. No se guardó nada.', 'duplicado');
  } else if (del.some(x => s(x.d.deComprobante))) throw error('Ese mes ya se registró con el comprobante de pago (que trae todo lo pagado): el certificado no agrega nada. No se guardó nada.', 'duplicado');
  else if (del.some(x => !!x.d.deCsv)) throw error('Ese mes ya se registró con el CSV de la nómina (el detalle exacto por trabajador): el certificado no agrega nada. Para las multas e intereses, sube el comprobante de pago. No se guardó nada.', 'duplicado');
  const dest = D.destinoCertificado(ps, vencs, p.fechaPago);
  const aVenc = !!dest.venc;
  // Vencimiento elegido a mano (solo sin la obligación Cotizaciones): debe seguir por pagar, como en el script
  const vElegido = !aVenc && p.vencimientoId ? vencs.find(x => x.id === s(p.vencimientoId) && !x.d.quitadoEnPlanilla) : null;
  if (!aVenc && p.vencimientoId) {
    if (!vElegido) throw error('Ese vencimiento ya no existe', 'datos');
    if (!['esperando_documento', 'por_pagar'].includes(G3.estadoBase(vElegido.d))) throw error('Ese vencimiento ya está ' + (G3.NOMBRE_ESTADO[G3.estadoBase(vElegido.d)] || '').toLowerCase(), 'datos');
  }
  const escrituras = r.lineas + r.limpios.length * 2 + 2 + (comp ? 2 : 0);
  if (escrituras > MAX_ESCRITURAS) throw error('El certificado trae demasiadas líneas para guardarlo de una vez: súbelo por partes (un PDF por trabajador).', 'datos');
  // El PDF a Drive ("Fën · Gastos / Previred / <año del período>", privado)
  const url = await subirPdf(subir, p);
  const quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto, hoy = M.ahoraChile().dia, hora = M.ahoraChile().hora;
  const lineasCot = D.docsCotizacion(p, r.limpios, url, en, quien, { cargadoClave: clave, ...(aVenc ? { vencimientoId: dest.venc.id } : vElegido ? { vencimientoId: vElegido.id } : {}), ...(comp ? { deComprobante: comp.limpio.clave } : {}), ...(p.csv && !comp ? { deCsv: true } : {}) });
  const trab = r.limpios.map(t => D.docTrabajador(t, hoy));
  const refV = aVenc ? FB.doc(d, 'vencimientos', dest.venc.id) : vElegido ? FB.doc(d, 'vencimientos', vElegido.id) : null;
  const rec = comp && comp.rec ? { ...comp.rec, url, nombreArchivo: s(p.nombreArchivo) } : null;
  const plan = { periodo: p.periodo, fecha: p.fecha, fechaPago: p.fechaPago, trabajadores: D.planTrabajadores(p, r.limpios), ...(rec && aVenc ? { recargos: rec } : {}) };
  // Sin vencimiento de Cotizaciones: los gastos por trabajador y el de multas e intereses ahora (con el vencimiento, al pagarlo)
  const gastosAhora = aVenc ? [] : D.lineasPrevired(plan, p.fechaPago, url, hora, vElegido ? { vencimientoId: vElegido.id } : {});
  const idsG = M.idsLineas('gq', marca, gastosAhora.length);
  const idR = rec && !aVenc ? M.idsLineas('gr', marca, 1)[0] : '';
  const refP = comp ? FB.doc(d, COL_PL, p.periodo) : null;
  const n = await FB.runTransaction(d, async tx => {
    const refsC = lineasCot.map(x => FB.doc(d, 'cotizaciones', x.id)), refsT = trab.map(x => FB.doc(d, 'cotiz_trabajadores', x.id));
    const snC = [], snT = [];
    for (const rf of refsC) snC.push(await tx.get(rf));
    for (const rf of refsT) snT.push(await tx.get(rf));
    const snV = refV ? await tx.get(refV) : null, snP = refP ? await tx.get(refP) : null;
    if (snC.some(x => x.exists() && !x.data().quitadoEnPlanilla)) {
      if (snC.every(x => x.exists() && x.data().cargadoClave === clave)) return -1;
      throw error('Ese período ya estaba cargado (otra pestaña o equipo). No se guardó nada.', 'duplicado');
    }
    let k = 0;
    if (refV) {
      if (!snV.exists()) throw error('Ese vencimiento ya no existe', 'datos');
      const a = snV.data();
      if (aVenc) {
        // El certificado completa el vencimiento de Cotizaciones (los gastos, al pagarlo)
        const c = G3.completarDocumento(a, D.documentoPrevired(p, r.limpios, url, p.nombreArchivo, clave, rec), quien, en);
        if (c.error) throw error(c.error + ' (' + s(a.nombre) + ')', 'datos');
        if (a.documento) throw error('Ese vencimiento ya tiene su documento', 'datos');
        c.campos.documento = { ...c.campos.documento, clave, previred: plan };
        tx.update(refV, cambio(a, 'recibió el certificado de Previred', c.campos)); k++;
      } else {
        if (!['esperando_documento', 'por_pagar'].includes(G3.estadoBase(a))) throw error('Ese vencimiento ya no está por pagar', 'datos');
        tx.update(refV, cambio(a, 'pagó con Previred', { estado: 'pagado', fechaPago: p.fechaPago, montoPago: String(r.total + (rec ? rec.monto : 0)), urlComprobante: url, obsPago: 'Pagado con Previred ' + D.nombreMes(p.periodo) + ' (gastos por trabajador' + (rec ? ' y multas e intereses' : '') + ')', pago: { clave } })); k++;
      }
    }
    // v0.67.0 · El comprobante en la planilla del mes (y el gasto de multas e intereses, si va ahora)
    if (refP) {
      const a = snP.exists() ? snP.data() : null, ya = compVigente(a);
      if (ya && s(ya.clave) !== comp.limpio.clave) throw error('Ese mes ya tiene otro comprobante de pago guardado. No se guardó nada.', 'duplicado');
      const campos = D.planillaConComprobante(a, D.docComprobante(comp.limpio, url, p.nombreArchivo, en, quien, idR, aVenc ? { recargosEnVencimiento: dest.venc.id } : {}), p.periodo, r.limpios.length, p.fechaPago);
      if (a) tx.update(refP, sinPlanilla(cambio(a, 'recibió el comprobante de Previred', campos))); else tx.set(refP, sinPlanilla(nuevo({ ...campos, pagos: [], pagosQuitados: [] }, 'previred', quien)));
      k++;
      if (idR) { tx.set(FB.doc(d, 'gastos', idR), nuevo({ ...D.lineaRecargos(rec, url, hora, vElegido ? { vencimientoId: vElegido.id } : {}), origenDetalle: { tipo: 'previred', recargos: true, periodo: p.periodo, por: quien, en } }, 'previred', quien)); k++; }
    }
    lineasCot.forEach((x, i) => { tx.set(refsC[i], nuevo(x.d, 'previred', quien)); k++; });
    trab.forEach((x, i) => { const a = snT[i].exists() ? snT[i].data() : null; if (a) tx.update(refsT[i], cambio(a, 'Previred', x.d)); else tx.set(refsT[i], nuevo(x.d, 'previred', quien)); k++; });
    gastosAhora.forEach((l, i) => { tx.set(FB.doc(d, 'gastos', idsG[i]), nuevo(l, 'previred', quien)); k++; });
    return k;
  });
  if (n === -1) return { ok: true, repetido: true, trabajadores: r.limpios.length, total: r.total, lineas: r.lineas, conArchivo: !!url, vencimiento: false, aVencimiento: aVenc ? { id: dest.venc.id, nombre: s(dest.venc.d.nombre) } : null };
  await despues(n);
  return { ok: true, trabajadores: r.limpios.length, total: r.total, lineas: r.lineas, conArchivo: !!url, vencimiento: !!vElegido,
    aVencimiento: aVenc ? { id: dest.venc.id, nombre: s(dest.venc.d.nombre), fecha: G3.fechaReal(dest.venc.d) } : null, nota: aVenc ? '' : dest.motivo || '',
    recargos: rec ? rec.monto : 0, gastoRecargosId: idR, totalPagado: comp ? comp.limpio.totalPagado : r.total };
}

// v0.67.0 · Mes que YA tiene sus cotizaciones (del certificado): no se repiten los trabajadores. Se guarda el comprobante en la
// planilla del mes y se crea el gasto de multas e intereses (o, si el vencimiento de Cotizaciones de ese mes sigue por pagar, se
// suma a su plan: se crea al pagarlo). Subir el mismo comprobante otra vez no repite nada (clave: período + folios).
// p = { periodo, comprobante: { clave, instituciones, totales, fechaPago, fueraDePlazo, recargos: { item, area } }, archivoBase64, nombreArchivo }
export async function cotComprobante(p, marca, subir) {
  const d = await dbBase(), per = s(p && p.periodo);
  const [cot, cat, vencs, pl] = await Promise.all([todos('cotizaciones'), catalogo(), todos('vencimientos'), todos(COL_PL).catch(() => [])]);
  const comp = D.revisarComprobante(p && p.comprobante, cat.lista.filter(i => !i.archivado), per);
  if (comp.error) throw error(comp.error, comp.code);
  const del = delMes(cot, per);
  if (!del.length) throw error('Ese mes no tiene cotizaciones cargadas: regístralo con el comprobante completo (los trabajadores y las multas e intereses).', 'datos');
  const repetido = x => ({ ok: true, repetido: true, recargos: M.n(x.totalRecargos), totalPagado: M.n(x.totalPagado), gastoRecargosId: s(x.gastoRecargosId), conArchivo: !!x.archivo });
  const ya0 = compVigente((pl.find(x => x.id === per) || {}).d);
  if (ya0) { if (s(ya0.clave) === comp.limpio.clave) return repetido(ya0); throw error('Ese mes ya tiene su comprobante de pago guardado. Para cambiarlo, quítalo primero (Conciliación → Previred → Meses cargados).', 'duplicado'); }
  const vid = s((del.find(x => x.d.vencimientoId) || { d: {} }).d.vencimientoId), v0 = vid ? vencs.find(x => x.id === vid) : null;
  const aVenc = !!(comp.rec && v0 && G3.abierto(v0.d) && G3.esPrevired(v0.d) && v0.d.documento && v0.d.documento.previred);
  const url = await subirPdf(subir, p);
  const quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto, hora = M.ahoraChile().hora;
  const rec = comp.rec ? { ...comp.rec, url, nombreArchivo: s(p.nombreArchivo) } : null;
  const idR = rec && !aVenc ? M.idsLineas('gr', marca, 1)[0] : '';
  const refP = FB.doc(d, COL_PL, per), refV = aVenc ? FB.doc(d, 'vencimientos', vid) : null, refG = idR ? FB.doc(d, 'gastos', idR) : null;
  const nTrab = new Set(del.map(x => s(x.d.rut).toUpperCase())).size, fpCert = s(del[0].d.fechaPago);
  // v0.67.3 · Mes cargado con el CSV de la nómina: el comprobante trae la fecha de pago de verdad. La planilla toma la del
  // comprobante y los gastos por trabajador (vigentes, de la memoria) que tenían la fecha puesta a mano, también.
  const porCsv = del.some(x => !!x.d.deCsv), fpComp = comp.limpio.fechaPago, fpPl = porCsv ? fpComp : fpCert;
  const gFecha = porCsv && fpCert && fpCert !== fpComp ? (await todos('gastos', FB.where('fechaPago', '==', fpCert))).filter(x => x.d.estado === 'vigente' && x.d.previred && !x.d.previred.recargos && s(x.d.previred.periodo) === per).map(x => x.id).slice(0, 80) : [];
  const refsF = gFecha.map(id => FB.doc(d, 'gastos', id));
  // v0.67.3 · Si la diferencia del banco ya se había registrado como multas e intereses, la reemplaza el comprobante (se anula)
  const dif0 = D.difVigente((pl.find(x => x.id === per) || {}).d), refD = dif0 && s(dif0.gastoId) ? FB.doc(d, 'gastos', s(dif0.gastoId)) : null;
  const r = await FB.runTransaction(d, async tx => {
    const snP = await tx.get(refP), snV = refV ? await tx.get(refV) : null, snG = refG ? await tx.get(refG) : null;
    const snF = []; for (const rf of refsF) snF.push(await tx.get(rf));
    const snD = refD ? await tx.get(refD) : null;
    const a = snP.exists() ? snP.data() : null, ya = compVigente(a);
    if (ya) { if (s(ya.clave) === comp.limpio.clave) return { repetido: ya }; throw error('Ese mes ya tiene su comprobante de pago guardado. Para cambiarlo, quítalo primero.', 'duplicado'); }
    if (snG && snG.exists()) return { repetido: { ...comp.limpio, gastoRecargosId: idR, archivo: url } };
    let k = 0, fechas = 0, difAnulada = 0;
    snF.forEach((sn, i) => { if (!sn.exists() || sn.data().estado !== 'vigente' || s(sn.data().fechaPago) !== fpCert) return; tx.update(refsF[i], cambio(sn.data(), 'tomó la fecha de pago del comprobante de Previred', { fechaPago: fpComp })); k++; fechas++; });
    const dif = D.difVigente(a);
    if (dif && snD && snD.exists() && snD.data().estado === 'vigente') { tx.update(refD, cambio(snD.data(), 'anuló', { estado: 'anulado', anulado: { el: en, en, por: quien, motivo: 'Reemplazado por el comprobante de pago de Previred', filaOriginal: '' } }, { motivo: 'Reemplazado por el comprobante de pago' })); k++; difAnulada = M.n(dif.monto); }
    if (refV) {
      if (!snV.exists()) throw error('El vencimiento de Cotizaciones ya no existe. Recarga y vuelve a subir el comprobante.', 'datos');
      const v = snV.data();
      if (!G3.abierto(v) || !(v.documento && v.documento.previred)) throw error('El vencimiento de Cotizaciones cambió. Recarga y vuelve a subir el comprobante.', 'cambio');
      const plan = { ...v.documento.previred, recargos: rec }, monto = D.totalPlan(plan);
      tx.update(refV, cambio(v, 'recibió el comprobante de Previred (multas e intereses)', { montoDocumento: monto, documento: { ...v.documento, monto, previred: plan } }));
      k++;
    }
    const campos = D.planillaConComprobante(a, D.docComprobante(comp.limpio, url, p.nombreArchivo, en, quien, idR, aVenc ? { recargosEnVencimiento: vid } : {}), per, nTrab, fpPl);
    if (porCsv) campos.fechaPago = fpComp;
    if (dif) Object.assign(campos, { difMultas: null, difMultasQuitadas: (Array.isArray(a.difMultasQuitadas) ? a.difMultasQuitadas : []).concat([{ ...dif, quitado: { por: quien, en, motivo: 'Reemplazado por el comprobante de pago' } }]) });
    if (a) tx.update(refP, sinPlanilla(cambio(a, 'recibió el comprobante de Previred', campos))); else tx.set(refP, sinPlanilla(nuevo({ ...campos, pagos: [], pagosQuitados: [] }, 'previred', quien)));
    k++;
    if (refG) { tx.set(refG, nuevo({ ...D.lineaRecargos(rec, url, hora), origenDetalle: { tipo: 'previred', recargos: true, periodo: per, por: quien, en } }, 'previred', quien)); k++; }
    return { k, fechas, difAnulada };
  });
  if (r.repetido) return repetido(r.repetido);
  await despues(r.k);
  return { ok: true, recargos: rec ? rec.monto : 0, gastoRecargosId: idR, aVencimiento: aVenc ? { id: vid, nombre: s(v0.d.nombre) } : null, totalPagado: comp.limpio.totalPagado, conArchivo: !!url,
    porCsv, fechasCorregidas: r.fechas, difAnulada: r.difAnulada };
}
// v0.67.0 · Quitar el comprobante de un mes (para cambiarlo): queda en comprobantesQuitados (con quién, cuándo y por qué), el gasto
// de multas e intereses se anula (no se borra) y, si estaba en el plan de un vencimiento por pagar, sale de ahí. Los trabajadores
// y los cargos del banco unidos no cambian. p = { periodo, motivo }
export async function cotQuitarComprobante(p) {
  const d = await dbBase(), per = s(p && p.periodo), motivo = M.texto(p && p.motivo, 300);
  if (motivo.length < 3) throw error('Escribe el motivo', 'datos');
  const [cot, pl, vencs] = await Promise.all([todos('cotizaciones'), todos(COL_PL).catch(() => []), todos('vencimientos')]);
  const c0 = compVigente((pl.find(x => x.id === per) || {}).d);
  if (!c0) throw error('Ese mes no tiene comprobante guardado', 'datos');
  // El gasto de multas e intereses: el guardado o, si se creó al pagar el vencimiento, el del mismo comprobante (de la memoria)
  let ids = s(c0.gastoRecargosId) ? [s(c0.gastoRecargosId)] : [];
  if (!ids.length) ids = (await todos('gastos', FB.where('fecha', '==', s(c0.fechaPago)))).filter(x => x.d.previred && x.d.previred.recargos && s(x.d.previred.clave) === s(c0.clave) && x.d.estado === 'vigente').map(x => x.id).slice(0, 5);
  const vid = s(c0.recargosEnVencimiento), v0 = vid ? vencs.find(x => x.id === vid) : null;
  const refP = FB.doc(d, COL_PL, per), refsG = ids.map(id => FB.doc(d, 'gastos', id)), refV = v0 && G3.abierto(v0.d) ? FB.doc(d, 'vencimientos', vid) : null;
  const quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto, cotTotal = delMes(cot, per).reduce((t, x) => t + M.n(x.d.monto), 0);
  const r = await FB.runTransaction(d, async tx => {
    const snP = await tx.get(refP), snG = []; for (const rf of refsG) snG.push(await tx.get(rf));
    const snV = refV ? await tx.get(refV) : null;
    const a = snP.exists() ? snP.data() : null, c = compVigente(a);
    if (!c || s(c.clave) !== s(c0.clave)) return { yaEstaba: true };
    let k = 0, anulados = 0;
    snG.forEach((sn, i) => { if (!sn.exists() || sn.data().estado !== 'vigente') return; tx.update(refsG[i], cambio(sn.data(), 'anuló', { estado: 'anulado', anulado: { el: en, en, por: quien, motivo: 'Comprobante de Previred quitado: ' + motivo, filaOriginal: '' } }, { motivo })); k++; anulados++; });
    if (snV && snV.exists() && G3.abierto(snV.data()) && snV.data().documento && snV.data().documento.previred && snV.data().documento.previred.recargos) {
      const v = snV.data(), plan = { ...v.documento.previred }; delete plan.recargos;
      const monto = D.totalPlan(plan);
      tx.update(refV, cambio(v, 'quitó las multas e intereses del comprobante de Previred', { montoDocumento: monto, documento: { ...v.documento, monto, previred: plan } }, { motivo })); k++;
    }
    const pagos = Array.isArray(a.pagos) ? a.pagos : [], unido = pagos.reduce((t, x) => t + M.n(x.monto), 0), falta = Math.round(cotTotal - unido), completa = unido > 0 && Math.abs(falta) <= 10;
    tx.update(refP, sinPlanilla(cambio(a, 'quitó el comprobante de Previred', { comprobante: null, comprobantesQuitados: (Array.isArray(a.comprobantesQuitados) ? a.comprobantesQuitados : []).concat([{ ...c, quitado: { por: quien, en, motivo } }]),
      total: cotTotal, unido, falta, estado: completa ? 'pagada_conciliada' : unido ? 'parcial' : 'sin_pagos', ...(completa ? {} : { conciliadaEl: '', conciliadaPor: '' }) }, { motivo })));
    k++;
    return { k, anulados };
  });
  if (r.yaEstaba) return { ok: true, yaEstaba: true };
  await despues(r.k);
  return { ok: true, anulados: r.anulados };
}
// v0.67.0 · El aviso de vencimiento de Previred para Hoy y Agenda (de la memoria: sin lecturas por mes)
export async function avisosPreviredHoy() {
  const [cot, pl] = await Promise.all([todos('cotizaciones').catch(() => []), todos(COL_PL).catch(() => [])]);
  const reg = new Set(cot.filter(x => x.d && !x.d.quitadoEnPlanilla).map(x => D.periodoCot(x.d.periodo)).filter(Boolean));
  pl.forEach(x => { if (compVigente(x.d)) reg.add(x.id); });
  return D.avisosPrevired(M.ahoraChile().dia, [...reg]);
}

// ── Clasificar obligaciones ──
export async function datosClasificar() {
  // v0.63.1: los gastos del último año pagados desde un vencimiento, para proponer "Se paga por"
  const [ps, vencs, siiDocs, fichas, gastos] = await Promise.all([todos('obligaciones'), todos('vencimientos'), todos('sii_docs'), todos('proveedores'),
    todos('gastos', FB.where('fecha', '>=', G3.sumarDias(M.ahoraChile().dia, -365))).then(l => l.filter(x => x.d && x.d.vencimientoId)).catch(() => [])]);
  return { ok: true, obligaciones: D.listaClasificar(ps, vencs, D.proveedoresSii(siiDocs, fichas), M.ahoraChile().dia, gastos) };
}
// lista = [{ id, tipoObligacion, identificador, diasAviso }]. Cada una por su lado: { ok: [ids], errores: [{ id, error }] }
export async function clasificar(lista, avance = () => {}) {
  const d = await dbBase(), [ps, vencs] = await Promise.all([todos('obligaciones'), todos('vencimientos')]);
  const ok = [], errores = [];
  let k = 0;
  for (const x of (Array.isArray(lista) ? lista : [])) {
    k++; avance(k, lista.length);
    try {
      const o = ps.find(y => (s(y.d.id) || y.id) === s(x.id) && !y.d.quitadoEnPlanilla);
      if (!o) throw error('Esa obligación ya no existe', 'datos');
      const c = G3.clasificacionDesdeForm({ tipoObligacion: x.tipoObligacion, identificador: x.identificador, diasAviso: x.diasAviso, sePagaPor: x.sePagaPor });
      if (c.error) throw error(c.error, 'datos');
      const pid = s(o.d.id) || o.id, ref = FB.doc(d, 'obligaciones', o.id);
      const recl = c.campos.tipoObligacion !== s(o.d.tipoObligacion) || (c.campos.tipoObligacion === 'documento' && String(c.campos.diasAviso) !== String(o.d.diasAviso)) ? G3.reclasificar(vencs, pid, c.campos) : [];
      const n = await FB.runTransaction(d, async tx => {
        const sn = await tx.get(ref); if (!sn.exists()) throw error('Esa obligación ya no existe', 'datos');
        const refsV = recl.map(v => FB.doc(d, 'vencimientos', v.id)), snV = [];
        for (const rv of refsV) snV.push(await tx.get(rv));
        const a = sn.data(); let j = 0;
        if (Object.keys(M.diferencias(a, c.campos)).length) { tx.update(ref, cambio(a, 'clasificó', c.campos)); j++; }
        recl.forEach((v, i) => { if (snV[i].exists() && !snV[i].data().documento) { tx.update(refsV[i], cambio(snV[i].data(), 'tomó el tipo de su obligación', v.campos)); j++; } });
        return j;
      });
      await despues(n);
      ok.push(s(x.id));
    } catch (e) { errores.push({ id: s(x.id), error: e.message || String(e) }); }
  }
  return { ok, errores };
}

// ── Arreglo "siniva" ──
export async function previaSiniva() {
  const [gs, vencs, ps] = await Promise.all([todos('gastos', FB.where('fecha', '>=', '2026-01-01')), todos('vencimientos'), todos('obligaciones')]);
  return D.planSiniva(gs, vencs, ps, 2026);
}
// ids: los de la vista previa. De a 100 por transacción; un gasto que cambió desde la vista previa no se toca.
export async function aplicarSiniva(ids, avance = () => {}) {
  const d = await dbBase(), plan = await previaSiniva(), porId = new Map(plan.lista.map(x => [x.id, x]));
  const elegidos = (Array.isArray(ids) ? ids : []).filter(id => porId.has(id));
  let hechos = 0, total = 0;
  for (let i = 0; i < elegidos.length; i += 100) {
    const parte = elegidos.slice(i, i + 100);
    const r = await FB.runTransaction(d, async tx => {
      const refs = parte.map(id => FB.doc(d, 'gastos', id)), sns = [];
      for (const rf of refs) sns.push(await tx.get(rf));
      let h = 0, t = 0;
      sns.forEach((sn, j) => {
        if (!sn.exists()) return;
        const g = sn.data(), c = D.camposSiniva(g);
        if (!c || g.estado !== 'vigente') return;
        tx.update(refs[j], cambio(g, 'ajuste siniva', c, { motivo: 'Pago de una obligación sin IVA registrado como bruto: el neto es el monto final' }));
        h++; t += c.montoNeto - M.n(g.montoNeto);
      });
      return { h, t };
    });
    hechos += r.h; total += r.t;
    await despues(r.h);
    avance(Math.min(i + 100, elegidos.length), elegidos.length);
  }
  return { ok: true, ajustados: hechos, diferencia: total };
}
