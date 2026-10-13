// ═══════════════════════════════════════════════
//  Sistema Fën — Cartola con la base nueva (fen-gastos), etapa G3 (tercera parte)  v0.50.0 · v0.51.0
//  v0.51.0: pagar con un cargo el vencimiento de Cotizaciones (con su certificado de Previred) crea un gasto por trabajador.
//  Se usa solo cuando config/gastos dice fuente = "base". cartola.js elige: con la planilla, el script como siempre.
//  Lo mismo que cc_cargar, cc_lista, cc_resolver, cc_deshacer y cc_quitar_regla del script (Cartola.gs), en las
//  colecciones cartolas, cartola_cargos y cartola_reglas (forma de la copia G1). Reglas en gastos-cartola.js.
//  · Resolver es UNA transacción por cargo (el cargo, los vencimientos, los gastos y lo aprendido): no queda nada a medias.
//    Cada cargo es independiente e idempotente por su id: confirmar dos veces el mismo cargo no paga dos veces
//    (los ids de lo que crea salen del cargo y de cuántas veces se deshizo).
//  · Abono (nuevo, obligación de tipo libre): agregarAbono(vencId, { monto, fecha, origen: 'cartola', cargoId }).
//    Nunca se cierra solo.
//  · Cada gasto y vencimiento tocado queda con "cartola" (la traza, como la columna Cartola) y "cartolaCargo" (el id).
//  · Deshacer no borra: el cargo vuelve a revisar (con su historial), el vencimiento queda por pagar, un gasto creado
//    aquí queda anulado y un abono sale del vencimiento (queda en abonosQuitados).
//  · El archivo original va a Drive con el script (op archivo_subir, tipo "cartola", v2.16.0).
// ═══════════════════════════════════════════════
import * as FB from './firebase-gastos.js?v=0.60.0';
import * as M from './gastos-g2.js?v=0.60.0';
import * as G3 from './gastos-g3.js?v=0.60.0';
import * as G3D from './gastos-g3d.js?v=0.60.0';
import * as C from './gastos-cartola.js?v=0.60.0';
import { huella } from './gastos-modelo.js?v=0.60.0';
import * as FS from './gastos-fs.js?v=0.60.0';
import * as GB from './gastos-base.js?v=0.60.0';

const { dbBase, todos, catalogo, nuevo, cambio, despues, correo, limpio } = FS;
// Los cargos tienen su propia columna "Historial" (texto, la de Deshacer): el registro de cambios va en "registro"
const nuevoCargo = (datos, por) => limpio({ ...datos, origen: 'cartola', creado: { por: por || correo(), en: FB.serverTimestamp() }, version: 0, registro: [], ...GB.marcaBase(por) });
const cambioCargo = (a, que, campos, extra) => { const por = correo() || 'Sistema Fën', dif = M.diferencias(a, campos); if (dif.historial) dif.historial = { antes: '…', despues: '…' };
  return limpio({ ...campos, version: (Number(a && a.version) || 0) + 1, registro: M.conHistorial(a && a.registro, { que, por, en: ahora(), cambios: dif, ...(extra || {}) }), ...GB.marcaBase() }); };
const s = v => String(v == null ? '' : v);
const error = (msg, code) => Object.assign(new Error(msg), { code });
const ahora = () => M.ahoraChile().texto;
const quien = () => correo() || 'Sistema Fën';
export async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t)));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── Lecturas ──
const reglasTodas = async () => (await todos('cartola_reglas')).map(x => C.vistaRegla(x.id, x.d));
// RUT de cada vencimiento de factura del SII (sii_docs importado.vencimiento)
const rutsSii = docs => { const m = {}; (docs || []).forEach(x => { const im = x.d && x.d.importado; if (im && im.vencimiento) m[im.vencimiento] = C.rutNorm(x.d.rut); }); return m; };
async function abiertos() {
  const [vencs, ps, siiDocs] = await Promise.all([todos('vencimientos'), todos('obligaciones'), todos('sii_docs')]);
  return { vencs, ps, lista: C.vencimientosAbiertos(vencs, ps, rutsSii(siiDocs), M.ahoraChile().dia) };
}

// cc_lista: cargos (por revisar y lo de los últimos N días), cartolas, reglas, vencimientos abiertos y gastos sin cartola
export async function lista(diasP) {
  const hoy = M.ahoraChile().dia, dias = Math.min(400, Math.max(7, Math.round(Number(diasP)) || 60)), corte = G3.sumarDias(hoy, -dias);
  try { await FS.vencimientosAlDia(); } catch (e) {}
  const [cg, ct, reglas, ab, gastos] = await Promise.all([todos('cartola_cargos'), todos('cartolas'), reglasTodas(), abiertos(), todos('gastos', FB.where('fecha', '>=', G3.sumarDias(hoy, -150)))]);
  const cargos = cg.filter(x => !x.d.quitadoEnPlanilla).map(x => C.vistaCargo(x.id, x.d))
    .filter(c => c.id && (c.estado === C.ESTADOS.revisar || c.fecha >= corte || s(c.resueltoEl).slice(0, 10) >= corte))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.monto - a.monto);
  // "Pagado sin factura": gasto nuevo desde la cartola sin documento del SII
  const porCargo = {}; gastos.forEach(x => { const k = s(x.d.cartolaCargo); if (k && x.d.estado === 'vigente') (porCargo[k] = porCargo[k] || []).push(x.d); });
  const sinFactura = cargos.filter(c => c.estado === C.ESTADOS.conciliado && c.accion === 'nuevo' && !(c.detalle && c.detalle.sinFactura) && (porCargo[c.id] || []).length && porCargo[c.id].every(g => !s(g.rutProveedor).trim()))
    .map(c => ({ id: c.id, fecha: c.fecha, monto: c.monto, descripcion: c.descripcion, items: [...new Set(porCargo[c.id].map(g => s(g.itemGasto)))] }));
  return { ok: true, fuente: 'base', cargos, cartolas: ct.filter(x => !x.d.quitadoEnPlanilla).map(x => C.vistaCartola(x.id, x.d)), reglas: reglas.filter(r => !r.quitada && r.veces > 0),
    vencimientos: ab.lista, gastos: C.gastosSinCartola(gastos, hoy), sinFactura, siiSinImportar: {}, dias };
}

// cc_cargar: los cargos nuevos (los ya vistos no se repiten) y la fila de la cartola
export async function cargar(meta, cargos, parte) {
  const L = C.limpiarCarga(meta, cargos);
  if (L.error) throw error(L.error, 'datos');
  for (const x of L.limpios) { x.huella = C.huellaDe(x); x.id = await C.idDe(x.huella, sha256); }
  const d = await dbBase(), t = ahora(), por = correo() || 'Sistema Fën';
  const [cg, ct, reglas] = await Promise.all([todos('cartola_cargos'), todos('cartolas'), reglasTodas()]);
  const plan = C.planCarga(L, cg.map(x => C.vistaCargo(x.id, x.d)), C.mapaReglas(reglas), t, por);
  let n = 0;
  for (let i = 0; i < plan.nuevos.length; i += 200) {
    const parteN = plan.nuevos.slice(i, i + 200);
    n += await FB.runTransaction(d, async tx => {
      const refs = parteN.map(x => FB.doc(d, 'cartola_cargos', x.id)), sns = [];
      for (const r of refs) sns.push(await tx.get(r));
      let k = 0;
      parteN.forEach((x, j) => { if (!sns[j].exists()) { tx.set(refs[j], nuevoCargo(x.doc, por)); k++; } });
      return k;
    });
  }
  // La cartola, una vez por nombre y cuenta
  const prev = ct.find(x => !x.d.quitadoEnPlanilla && s(x.d.cartola) === L.ident && s(x.d.cuenta) === L.cuenta);
  const fila = C.filaCartola(prev ? prev.d : null, meta, L, plan.cuenta, parte, t, por);
  const idC = prev ? prev.id : idCartola(ct, L);
  n += await FB.runTransaction(d, async tx => {
    const ref = FB.doc(d, 'cartolas', idC), sn = await tx.get(ref);
    if (sn.exists()) tx.update(ref, cambio(sn.data(), 'subió de nuevo', fila)); else tx.set(ref, nuevo(fila, 'cartola'));
    return 1;
  });
  await despues(n);
  return { ok: true, ...plan.cuenta };
}
// Id de una cartola nueva: como la copia G1 ("ct-" + huella del nombre); si ese ya es de otra cuenta, con la cuenta
const idCartola = (ct, L) => { const a = 'ct-' + huella(L.ident); return ct.some(x => x.id === a) ? 'ct-' + huella(L.ident + '|' + L.cuenta) : a; };

// El archivo original a Drive (archivo_subir tipo "cartola"); el mismo archivo otra vez no se sube de nuevo
export async function guardarArchivo(meta, a, subir) {
  const L = C.limpiarCarga(meta, []);
  if (L.error) throw error(L.error, 'datos');
  const hu = 'huella:' + (await sha256(a.archivoBase64)).slice(0, 32);
  const ct = await todos('cartolas');
  const prev = ct.find(x => !x.d.quitadoEnPlanilla && s(x.d.cartola) === L.ident && s(x.d.cuenta) === L.cuenta);
  if (prev && s(prev.d.archivo) && s(prev.d.archivoHuella) === hu) return { ok: true, ya: true, url: s(prev.d.archivo) };
  const r = await subir({ tipo: 'cartola', fecha: meta.hasta || meta.desde || '', imageData: a.archivoBase64, mimeType: a.mimeType, fileName: a.nombreArchivo });
  const d = await dbBase(), idC = prev ? prev.id : idCartola(ct, L);
  await FB.runTransaction(d, async tx => {
    const ref = FB.doc(d, 'cartolas', idC), sn = await tx.get(ref), campos = { archivo: r.url || '', archivoHuella: hu };
    if (sn.exists()) tx.update(ref, cambio(sn.data(), 'guardó el archivo', campos));
    else tx.set(ref, nuevo({ ...C.filaCartola(null, meta, L, { cargos: 0, nuevos: 0, yaVistos: 0, ignorados: 0 }, 0, ahora(), quien()), ...campos }, 'cartola'));
  });
  await despues(1);
  return { ok: true, url: r.url || '' };
}

// ── Resolver un cargo ──
async function leerCargo(id) {
  const d = await dbBase(), ref = FB.doc(d, 'cartola_cargos', s(id));
  const sn = await FB.getDoc(ref);
  if (!sn.exists() || sn.data().quitadoEnPlanilla) throw error('Ese cargo ya no está', 'datos');
  return { d, ref, c: C.vistaCargo(sn.id || s(id), sn.data()) };
}
// Lo aprendido, dentro de la transacción: lee la regla de esa clave y la deja al día
async function leerRegla(tx, d, clave) {
  const lista = await todos('cartola_reglas'), x = lista.find(y => s(y.d.clave) === clave);
  const ref = FB.doc(d, 'cartola_reglas', x ? x.id : 'r-' + huella(clave));
  const sn = await tx.get(ref);
  return { ref, sn, act: sn.exists() ? C.vistaRegla(ref.id, sn.data()) : null };
}
function escribirRegla(tx, R, regla, c) {
  if (!regla) return;
  const campos = C.aprender(R.act, c.clave, regla, c.descripcion, ahora(), quien());
  if (R.sn.exists()) tx.update(R.ref, cambio(R.sn.data(), 'aprendió', campos)); else tx.set(R.ref, nuevo(campos, 'cartola'));
}
const aCargo = (c0, a, campos) => cambioCargo(a, 'resolvió', { ...campos, resueltoEl: ahora(), resueltoPor: quien() });
// Revisa el cargo dentro de la transacción: por revisar, misma huella; o ya resuelto con esta misma marca (repetido)
function revisarCargo(sn, c0, clave) {
  if (!sn.exists()) throw error('Ese cargo ya no está', 'datos');
  const c = C.vistaCargo(sn.id, sn.data());
  if (c.huella !== c0.huella) throw error('Ese cargo cambió. Recarga la lista.', 'cambio');
  if (c.estado !== C.ESTADOS.revisar) {
    if (c.detalle && c.detalle.marca === clave) return { repetido: true, c };
    throw error(`Ese cargo ya se había resuelto (${c.accion}, ${c.resueltoEl}). Recarga la lista.`, 'resuelto');
  }
  return { c };
}

// p = { id, huella, accion: 'vencimientos'|'gasto'|'nuevo'|'ignorar'|'abono', pagos, filas, gasto, motivo, siempre, vencId }
export async function resolver(p) {
  const { d, ref, c: c0 } = await leerCargo(p.id);
  if (s(p.huella) !== c0.huella) throw error('Ese cargo cambió. Recarga la lista.', 'cambio');
  const marca = C.marcaDe(c0), clave = marca.t + marca.r, accion = s(p.accion);
  if (c0.estado !== C.ESTADOS.revisar) {
    if (c0.detalle && c0.detalle.marca === clave) return { ok: true, repetido: true, id: c0.id, accion: c0.accion };
    throw error(`Ese cargo ya se había resuelto (${c0.accion}, ${c0.resueltoEl}). Recarga la lista.`, 'resuelto');
  }
  const tr = C.traza(c0), hora = M.ahoraChile().hora;
  let r;
  if (accion === 'vencimientos') r = await resolverVencimientos(d, ref, c0, p.pagos, marca, tr, hora);
  else if (accion === 'gasto') r = await resolverGasto(d, ref, c0, p.filas, marca, tr);
  else if (accion === 'nuevo') r = await resolverNuevo(d, ref, c0, p.gasto || {}, marca, tr, hora);
  else if (accion === 'abono') r = await resolverAbono(d, ref, c0, s(p.vencId), marca, tr);
  else if (accion === 'ignorar') {
    const motivo = C.texto(p.motivo, 80) || 'No es gasto', detalle = { motivo, siempre: !!p.siempre, marca: clave };
    r = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
      const R = p.siempre ? await leerRegla(tx, d, c0.clave) : null;
      tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.ignorado, accion, detalle: JSON.stringify(detalle) }));
      if (R) escribirRegla(tx, R, C.reglaDe('ignorar', c0, { siempre: true, motivo }), c0);
      return { n: 1 + (R ? 1 : 0), detalle, estado: C.ESTADOS.ignorado };
    });
  } else throw error('Acción desconocida', 'datos');
  if (r.repetido) return { ok: true, repetido: true, id: c0.id, accion };
  await despues(r.n);
  if (accion === 'vencimientos') { try { await FS.vencimientosAlDia(); } catch (e) {} }
  return { ok: true, id: c0.id, accion, estado: r.estado || C.ESTADOS.conciliado, traza: tr, detalle: r.detalle };
}

async function resolverVencimientos(d, ref, c0, pagos, marca, tr, hora) {
  const ab = await abiertos(), porId = {}; ab.lista.forEach(v => { porId[v.id] = v; });
  const rp = C.revisarPagos(pagos, c0, porId);
  if (rp.error) throw error(rp.error, rp.code || 'datos');
  // Compras a crédito y facturas del SII: los gastos que ya existen se completan con la fecha de pago (todas las líneas de la factura)
  const creditos = {};
  for (const { v } of rp.pedidos) {
    if (v.plantillaId || v.suelto) continue;
    const vd = (ab.vencs.find(x => x.id === v.id) || {}).d || {};
    let l = [];
    if (v.folio) l = (await todos('gastos', FB.where('folio', '==', v.folio))).filter(x => x.d.estado === 'vigente' && !s(x.d.fechaPago) && ['proveedor', 'tarjeta'].includes(s(x.d.formaPago)) && (!v.razon || C.norm(x.d.razonSocial) === C.norm(v.razon)));
    if (!l.length && v.item) {
      const delItem = (await todos('gastos', FB.where('itemGasto', '==', v.item))).sort((a, b) => s(b.d.fecha).localeCompare(s(a.d.fecha)) || s(b.d.hora).localeCompare(s(a.d.hora)) || b.id.localeCompare(a.id));
      l = M.gastosDelCredito(M.vistaVencimiento(v.id, vd), delItem);
    }
    creditos[v.id] = l.map(x => x.id);
  }
  const clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const refsV = rp.pedidos.map(({ v }) => FB.doc(d, 'vencimientos', v.id)), snV = [];
    for (const r of refsV) snV.push(await tx.get(r));
    const snC = {};
    for (const id of Object.keys(creditos)) { snC[id] = []; for (const gid of creditos[id]) { const rg = FB.doc(d, 'gastos', gid); snC[id].push({ ref: rg, sn: await tx.get(rg) }); } }
    const R = await leerRegla(tx, d, c0.clave);
    let n = 1;
    const pagados = [];
    rp.pedidos.forEach(({ v: v0, monto }, i) => {
      if (!snV[i].exists()) throw error('Un vencimiento ya no existe. Recarga la lista.', 'datos');
      const a = snV[i].data(), eb = G3.estadoBase(a);
      if (!['esperando_documento', 'por_pagar'].includes(eb)) throw error(`"${s(a.nombre)}" ya no está por pagar (${G3.NOMBRE_ESTADO[eb] || eb}). Recarga la lista.`, 'pagado');
      const v = M.vistaVencimiento(v0.id, a), extra = {};
      let ids = [];
      const conLineas = !!(v.plantillaId || v.suelto);
      const multi = v.plantillaId ? C.repartoPago(a.multiArea, monto) : [];
      if (multi.length) { extra.multiArea = JSON.stringify(multi); v.multiArea = multi; }
      if (conLineas) {
        // v0.51.0: con el certificado de Previred, un gasto por trabajador (y con la factura del SII, su RUT y folio)
        const lp = G3D.lineasDelPago(v, a, monto, c0.fecha, tr.slice(0, 500), '', s(a.tipoMonto) === 'siniva' ? 'siniva' : 'bruto', hora);
        if (lp.error) throw error(lp.error, 'datos');
        const lineas = lp.lineas;
        ids = M.idsLineas('gp', { t: marca.t, r: marca.r + 'v' + i }, lineas.length);
        lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, cartola: tr, cartolaCargo: c0.id }, 'obligacion')));
        n += lineas.length;
      } else (snC[v.id] || []).forEach(({ ref: rg, sn: sg }) => {
        if (!sg.exists()) return; const g = sg.data(); if (g.fechaPago || g.estado !== 'vigente') return;
        tx.update(rg, cambio(g, 'pagó con la cartola', { fechaPago: c0.fecha, cartola: tr, cartolaCargo: c0.id }, { vencimiento: v.id })); ids.push(rg.id); n++;
      });
      tx.update(refsV[i], cambio(a, 'pagó con la cartola', { ...extra, estado: 'pagado', fechaPago: c0.fecha, montoPago: String(monto), obsPago: tr.slice(0, 500), cartola: tr, cartolaCargo: c0.id, pago: { clave: clave + 'v' + i, cargoId: c0.id } }));
      pagados.push({ id: v.id, multiAntes: multi.length ? s(a.multiArea) : null, nombre: s(a.nombre), monto, plantillaId: v.plantillaId, folio: v0.folio, razon: v0.razon, rut: v0.rut, filas: ids.length, gastos: ids, conLineas });
    });
    const detalle = { vencimientos: pagados, marca: clave };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'vencimientos', detalle: JSON.stringify(detalle).slice(0, 45000) }));
    escribirRegla(tx, R, C.reglaDe('vencimientos', c0, { pagados }), c0);
    return { n: n + 1, detalle };
  });
}

async function resolverGasto(d, ref, c0, filas, marca, tr) {
  const ids = Array.isArray(filas) ? filas.map(f => s(f && (f.id || f.fila))).filter(Boolean) : [];
  if (!ids.length || ids.length > 40) throw error('Elige el gasto', 'datos');
  const clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const refs = ids.map(id => FB.doc(d, 'gastos', id)), sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    let suma = 0;
    sns.forEach(g => {
      if (!g.exists() || g.data().estado !== 'vigente') throw error('Ese gasto cambió en otro lado: recarga la lista.', 'cambio');
      if (g.data().cartolaCargo || /\[cc[0-9a-f]{10}\]/.test(s(g.data().cartola))) throw error('Ese gasto ya está conciliado con otro cargo.', 'datos');
      suma += M.n(g.data().montoFinal);
    });
    if (Math.abs(suma - c0.monto) > ids.length) throw error(`El gasto suma ${suma} y el cargo es de ${c0.monto}`, 'datos');
    sns.forEach((g, i) => tx.update(refs[i], cambio(g.data(), 'conciliado con la cartola', { cartola: tr, cartolaCargo: c0.id })));
    const g0 = sns[0].data();
    const detalle = { filas: ids.length, ids, items: [...new Set(sns.map(g => s(g.data().itemGasto)))], fecha: s(g0.fecha), monto: suma, marca: clave };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'gasto', detalle: JSON.stringify(detalle) }));
    return { n: ids.length + 1, detalle };
  });
}

async function resolverNuevo(d, ref, c0, gq, marca, tr, hora) {
  const cat = await catalogo(), li = M.limpiarItems(Array.isArray(gq.items) ? gq.items.slice(0, 10) : [], cat.lista.filter(i => !i.archivado));
  if (li.error) throw error(li.error, 'datos');
  if (!li.limpios.length) throw error('Agrega al menos un ítem', 'datos');
  const tipoMonto = ['bruto', 'neto', 'siniva'].includes(gq.tipoMonto) ? gq.tipoMonto : 'bruto';
  const total = li.limpios.reduce((t, it) => t + (tipoMonto === 'neto' ? Math.round(it.montoTotal * M.factorDe(it.esHarina)) : it.montoTotal), 0);
  if (Math.abs(total - c0.monto) > li.limpios.length) throw error(`El gasto suma ${total} y el cargo es de ${c0.monto}`, 'datos');
  const e = { fecha: c0.fecha, hora, tipoMonto, formaPago: 'contado', fechaPago: '', observacion: M.obsLibre(gq.observacion, 300) || M.obsLibre('Cartola: ' + c0.descripcion, 300), archivo: '', urlFoto: '' };
  const lineas = M.lineasCompra(e, li.limpios), ids = M.idsLineas('gc', marca, lineas.length), clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const R = await leerRegla(tx, d, c0.clave);
    lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, cartola: tr, cartolaCargo: c0.id }, 'cartola')));
    const detalle = { items: li.limpios.map(it => it.item), filas: lineas.length, ids, sinFactura: !!gq.sinFactura, tipoMonto, marca: clave };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'nuevo', detalle: JSON.stringify(detalle) }));
    escribirRegla(tx, R, C.reglaDe('nuevo', c0, { it0: li.limpios[0], sinFactura: !!gq.sinFactura }), c0);
    return { n: lineas.length + 2, detalle };
  });
}

// Abono a un vencimiento de tipo libre (sueldo líquido). Primero el abono (idempotente por el cargo), después el cargo.
async function resolverAbono(d, ref, c0, vencId, marca, tr) {
  if (!vencId) throw error('Elige el vencimiento que recibe el abono', 'datos');
  const sv = await FB.getDoc(FB.doc(d, 'vencimientos', vencId));
  if (!sv.exists()) throw error('Ese vencimiento ya no existe', 'datos');
  const v = sv.data();
  if (s(v.tipoObligacion) !== 'libre') throw error('Solo los vencimientos de tipo libre reciben abonos', 'datos');
  const ra = await FS.agregarAbono(vencId, { monto: c0.monto, fecha: c0.fecha, origen: 'cartola', cargoId: c0.id, cartola: tr, obs: '' }, marca, null);
  const clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const snV = await tx.get(FB.doc(d, 'vencimientos', vencId)), a = snV.data(), l = Array.isArray(a.abonos) ? a.abonos : [];
    const k = l.findIndex(y => y.cargoId === c0.id);
    if (k < 0) throw error('El abono no quedó en el vencimiento: vuelve a intentarlo.', 'cambio');
    const R = await leerRegla(tx, d, c0.clave);
    const detalle = { abono: { vencimientoId: vencId, nombre: s(a.nombre), n: k + 1, monto: c0.monto, plantillaId: s(a.plantillaID), gastos: l[k].gastoIds || [] }, marca: clave, repetidoAbono: !!ra.repetido };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'abono', detalle: JSON.stringify(detalle) }));
    if (s(a.plantillaID)) escribirRegla(tx, R, C.reglaDe('abono', c0, { plantillaId: s(a.plantillaID), nombre: s(a.nombre) }), c0);
    return { n: 2, detalle };
  });
}

// ── Deshacer (ccDeshacer) ──
export async function deshacer(id, motivoP) {
  const motivo = C.texto(motivoP, 300);
  if (motivo.length < 3) throw error('Escribe el motivo', 'datos');
  const { d, ref, c: c0 } = await leerCargo(id);
  if (c0.estado === C.ESTADOS.revisar) return { ok: true, yaEstaba: true };
  const refTxt = '[' + c0.id + ']', det = c0.detalle || {};
  // Gastos de este cargo: por su id (hechos en la base) o por la traza (conciliados en la planilla y copiados en G1)
  const g1 = await todos('gastos', FB.where('cartolaCargo', '==', c0.id));
  const g2 = c0.accion === 'ignorar' ? [] : (await todos('gastos', FB.where('fecha', '>=', G3.sumarDias(c0.fecha || M.ahoraChile().dia, -400)))).filter(x => s(x.d.cartola).includes(refTxt));
  const gIds = [...new Set(g1.concat(g2).map(x => x.id))];
  const vIds = c0.accion === 'vencimientos' ? (det.vencimientos || []).map(x => s(x.id)) : c0.accion === 'abono' && det.abono ? [s(det.abono.vencimientoId)] : [];
  const t = ahora(), por = quien(), avisos = [];
  if (c0.estado === C.ESTADOS.aMedias) avisos.push('Estaba a medias: revisa en Registrados que no haya quedado un gasto de este cargo sin la cartola (si lo hay, anúlalo).');
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese cargo ya no está', 'datos');
    const c = C.vistaCargo(sn.id, sn.data()); if (c.estado === C.ESTADOS.revisar) return { yaEstaba: true };
    const refsV = vIds.map(x => FB.doc(d, 'vencimientos', x)), snV = [];
    for (const rv of refsV) snV.push(await tx.get(rv));
    const refsG = gIds.map(x => FB.doc(d, 'gastos', x)), snG = [];
    for (const rg of refsG) snG.push(await tx.get(rg));
    const desap = C.aDesaprender(c), R = desap ? await leerRegla(tx, d, c.clave) : null;
    let n = 1;
    const anulado = { el: t, en: t, por, motivo: `Deshecho en la conciliación de la cartola (${c.id}): ${motivo}`, filaOriginal: '' };
    // Vencimientos pagados con este cargo: vuelven por pagar (con el reparto estimado de antes)
    if (c.accion === 'vencimientos') (det.vencimientos || []).forEach((x, i) => {
      const s0 = snV[i]; if (!s0 || !s0.exists()) { avisos.push(`"${x.nombre}" ya no existe: no se tocó.`); return; }
      const a = s0.data();
      if (G3.estadoBase(a) !== 'pagado' || !(s(a.cartolaCargo) === c.id || s(a.cartola).includes(refTxt))) { avisos.push(`"${x.nombre}" ya no estaba pagado con este cargo: no se tocó.`); return; }
      const espera = s(a.tipoObligacion) === 'documento' && !a.documento;
      tx.update(refsV[i], cambio(a, 'pago deshecho (cartola)', { estado: espera ? 'esperando_documento' : 'por_pagar', fechaPago: '', montoPago: '', cartola: '', cartolaCargo: '', pago: null,
        ...(x.multiAntes != null ? { multiArea: x.multiAntes } : {}), obsPago: (`Pago deshecho ${t.slice(0, 10)} · ${por} · ${motivo} · antes: ${s(a.obsPago)}`).slice(0, 500) }, { motivo }));
      n++;
    });
    // Abono: sale del vencimiento (queda en abonosQuitados)
    if (c.accion === 'abono' && snV[0] && snV[0].exists()) {
      const a = snV[0].data();
      if (G3.estadoBase(a) === 'pagado') throw error(`"${s(a.nombre)}" ya se cerró: déjalo por pagar de nuevo en Vencimientos y vuelve a deshacer.`, 'datos');
      const l = Array.isArray(a.abonos) ? a.abonos : [], fuera = l.filter(y => y.cargoId === c.id), quedan = l.filter(y => y.cargoId !== c.id);
      if (fuera.length) {
        tx.update(refsV[0], cambio(a, 'abono deshecho (cartola)', { abonos: quedan, estado: quedan.length ? 'con_abonos' : 'por_pagar',
          abonosQuitados: (Array.isArray(a.abonosQuitados) ? a.abonosQuitados : []).concat(fuera.map(y => ({ ...y, quitado: { por, en: t, motivo } }))) }, { motivo }));
        n++;
      } else avisos.push(`El abono ya no estaba en "${s(a.nombre)}": no se tocó.`);
    }
    // Gastos: "ya estaba" solo pierde la cartola; a crédito vuelve sin fecha de pago; lo creado aquí queda anulado
    snG.forEach((sg, i) => {
      if (!sg.exists()) return; const g = sg.data(); if (g.estado !== 'vigente') return;
      const forma = s(g.formaPago);
      if (c.accion === 'gasto') tx.update(refsG[i], cambio(g, 'sin cartola (deshecho)', { cartola: '', cartolaCargo: '' }, { motivo }));
      else if (forma === 'proveedor' || forma === 'tarjeta') tx.update(refsG[i], cambio(g, 'pago deshecho (cartola)', { fechaPago: '', cartola: '', cartolaCargo: '' }, { motivo }));
      else tx.update(refsG[i], cambio(g, 'anuló', { estado: 'anulado', anulado }, { motivo: anulado.motivo }));
      n++;
    });
    tx.update(ref, cambioCargo(sn.data(), 'deshizo', { estado: C.ESTADOS.revisar, accion: '', detalle: '', resueltoEl: '', resueltoPor: '', historial: C.conDeshecho(c, motivo, t, por) }, { motivo }));
    if (R && R.sn.exists()) { const x = C.desaprender(R.act, desap, t, por); if (x) { tx.update(R.ref, cambio(R.sn.data(), 'olvidó (deshecho)', x)); n++; } }
    return { n };
  });
  if (r.yaEstaba) return { ok: true, yaEstaba: true };
  await despues(r.n);
  return { ok: true, avisos };
}

// Quitar lo aprendido (en la base no se borra: queda quitada, con quién y cuándo)
export async function quitarRegla(clave) {
  const d = await dbBase(), lista = await todos('cartola_reglas'), x = lista.find(y => s(y.d.clave) === s(clave) && !(y.d.quitada && s(y.d.quitada)));
  if (!x) return { ok: true, yaEstaba: true };
  const ref = FB.doc(d, 'cartola_reglas', x.id);
  await FB.runTransaction(d, async tx => { const sn = await tx.get(ref); tx.update(ref, cambio(sn.data(), 'quitó', { veces: 0, quitada: `${ahora()} · ${quien()}` })); });
  await despues(1);
  return { ok: true };
}
