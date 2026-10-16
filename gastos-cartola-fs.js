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
//    v0.63.1: con el área de ESE abono (areas, fuenteArea) y el destinatario (glosa y RUT del cargo): se recuerda.
//    Nunca se cierra solo.
//  · Cada gasto y vencimiento tocado queda con "cartola" (la traza, como la columna Cartola) y "cartolaCargo" (el id).
//  · Deshacer no borra: el cargo vuelve a revisar (con su historial), el vencimiento queda por pagar, un gasto creado
//    aquí queda anulado y un abono sale del vencimiento (queda en abonosQuitados).
//  · El archivo original va a Drive con el script (op archivo_subir, tipo "cartola", v2.16.0).
//  · v0.63.1: "Traspaso entre cuentas propias" (no crea gasto, se aprende). "Ya está en Gastos" ofrece también lo pagado por
//    banco a mano (esperaCargo), las facturas del SII ya cargadas sin cargo y los pagos de vencimientos sin cargo
//    (gastos-banco.js: candidatosGastos); al vincular, el gasto deja de esperar su cargo, una factura a crédito queda con su
//    fecha de pago y el vencimiento pagado a mano queda con la cartola. Deshacer lo devuelve como estaba.
// ═══════════════════════════════════════════════
import * as FB from './fs-gastos.js?v=0.65.3';
import * as M from './gastos-g2.js?v=0.65.3';
import * as G3 from './gastos-g3.js?v=0.65.3';
import * as G3D from './gastos-g3d.js?v=0.65.3';
import * as C from './gastos-cartola.js?v=0.65.3';
import * as B from './gastos-banco.js?v=0.65.3';
import { huella } from './gastos-modelo.js?v=0.65.3';
import * as FS from './gastos-fs.js?v=0.65.3';
import * as GB from './gastos-base.js?v=0.65.3';
import * as TE from './tef-enviadas.js?v=0.65.3';
import * as P from './proveedores.js?v=0.65.3';

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
  const [cg, ct, reglas, ab, gastos, dAb, tefs, provs, dPl] = await Promise.all([todos('cartola_cargos'), todos('cartolas'), reglasTodas(), abiertos(), todos('gastos', FB.where('fecha', '>=', G3.sumarDias(hoy, -150))), FS.datosAbono().catch(() => ({ destinatarios: [], trabajadores: [] })),
    todos('tef_enviadas').catch(() => []), todos('proveedores').catch(() => []), datosPlanillas()]);
  const cargos = cg.filter(x => !x.d.quitadoEnPlanilla).map(x => C.vistaCargo(x.id, x.d))
    .filter(c => c.id && (c.estado === C.ESTADOS.revisar || c.fecha >= corte || s(c.resueltoEl).slice(0, 10) >= corte))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.monto - a.monto);
  // v0.64.0 · Transferencias enviadas (a quién pagaste) y el proveedor de cada cargo: todo desde la memoria, nunca por cargo
  const enviadas = tefs.map(x => TE.vistaEnviada(x.id, x.d)).filter(x => x.fecha >= G3.sumarDias(hoy, -TE.DIAS_GUARDAR - 10));
  const fichas = provs.map(x => P.vistaFicha(x.id, x.d)).filter(f => !f.archivado);
  const asig = TE.asignarEnviadas(cargos, enviadas);
  cargos.forEach(c => {
    const tf = asig.get(c.id) || null;
    if (tf) { c.tef = tf; if (!c.rut && tf.rut) { c.rut = tf.rut; c.rutDe = 'tef'; } }
    const pr = P.buscar(fichas, { rut: c.rut, nombre: tf ? tf.nombre : '', descripcion: c.descripcion });
    if (pr) c.proveedor = { id: pr.ficha.id, nombre: pr.ficha.nombre || pr.ficha.razonSocial, rut: pr.ficha.rut, por: pr.por, resumen: P.resumen(pr.ficha), item: pr.ficha.item, area: pr.ficha.area, manual: pr.ficha.manual };
  });
  // "Pagado sin factura": gasto nuevo desde la cartola sin documento del SII
  const porCargo = {}; gastos.forEach(x => { const k = s(x.d.cartolaCargo); if (k && x.d.estado === 'vigente') (porCargo[k] = porCargo[k] || []).push(x.d); });
  const sinFactura = cargos.filter(c => c.estado === C.ESTADOS.conciliado && c.accion === 'nuevo' && !(c.detalle && c.detalle.sinFactura) && (porCargo[c.id] || []).length && porCargo[c.id].every(g => !s(g.rutProveedor).trim()))
    .map(c => ({ id: c.id, fecha: c.fecha, monto: c.monto, descripcion: c.descripcion, items: [...new Set(porCargo[c.id].map(g => s(g.itemGasto)))] }));
  // v0.65.1 · Planillas de Previred ya registradas (meses cargados) con sus pagos del banco unidos
  const planillas = armarPlanillas(dPl, ab, cg);
  return { ok: true, fuente: 'base', planillas, cargos, cartolas: ct.filter(x => !x.d.quitadoEnPlanilla).map(x => C.vistaCartola(x.id, x.d)), reglas: reglas.filter(r => !r.quitada && r.veces > 0),
    vencimientos: ab.lista, gastos: B.candidatosGastos(gastos, hoy, new Set(ab.lista.filter(v => !v.plantillaId && v.folio).map(v => B.claveFactura(v.folio, v.razon)))), sinFactura, siiSinImportar: {}, dias,
    abonoDest: dAb.destinatarios, trabajadores: dAb.trabajadores,   // v0.63.1: para "Área de este abono"
    enviadas: { n: enviadas.length, hasta: enviadas.map(x => x.fecha).sort().pop() || '', subidas: [...new Set(enviadas.map(x => x.subida.slice(0, 10)))].sort().slice(-3) } };
}

// v0.65.1 · Las planillas de Previred: meses cargados (cotizaciones, ya en memoria) y sus pagos unidos (previred_planillas,
// un documento por mes: pocos). Sin lecturas por cargo.
async function datosPlanillas() {
  const [cot, pl] = await Promise.all([todos('cotizaciones').catch(() => []), todos(COL_PLANILLAS).catch(() => [])]);
  return { periodos: G3D.listaCot(cot).periodos, docs: Object.fromEntries(pl.map(x => [x.id, x.d])) };
}
const armarPlanillas = (dPl, ab, cg) => C.planillasPrevired(dPl.periodos, dPl.docs, new Set(ab.lista.map(v => v.id)),
  cg.filter(x => !x.d.quitadoEnPlanilla && x.d.accion === C.PREVIRED).map(x => C.vistaCargo(x.id, x.d)));
export const COL_PLANILLAS = 'previred_planillas';
// La planilla de Previred unida no pasa a la planilla de Google (como tef_enviadas y proveedores): sin la marca de copia
const sinPlanilla = o => { const x = { ...o }; delete x.planillaPendiente; delete x.hechoEnBase; return x; };
export async function planillas() {
  const [dPl, ab, cg] = await Promise.all([datosPlanillas(), abiertos(), todos('cartola_cargos')]);
  return armarPlanillas(dPl, ab, cg);
}

// cc_cargar: los cargos nuevos (los ya vistos no se repiten) y la fila de la cartola
export async function cargar(meta, cargos, parte) {
  const L = C.limpiarCarga(meta, cargos);
  if (L.error) throw error(L.error, 'datos');
  for (const x of L.limpios) { x.huella = C.huellaDe(x); x.id = await C.idDe(x.huella, sha256); }
  const d = await dbBase(), t = ahora(), por = correo() || 'Sistema Fën';
  L.fuente = C.fuenteDeCarga(meta, t);   // v0.64.0: de qué archivo salió cada cargo
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
  // v0.64.0 · El mismo cargo que ya estaba (de la en línea) llega en la histórica: se le anota la fuente nueva (sin tocar lo demás)
  for (let i = 0; i < plan.masFuentes.length; i += 200) {
    const b = FB.writeBatch(d);
    plan.masFuentes.slice(i, i + 200).forEach(x => b.update(FB.doc(d, 'cartola_cargos', x.id), { fuentes: x.fuentes }));
    await b.commit();
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

// p = { id, huella, accion: 'vencimientos'|'gasto'|'nuevo'|'ignorar'|'abono'|'pago_tarjeta'|'traspaso', pagos, filas, gasto, motivo, siempre, vencId, tarjeta, nota }
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
  else if (accion === 'abono') r = await resolverAbono(d, ref, c0, s(p.vencId), marca, tr, p);
  else if (accion === C.ABONO_PARCIAL) r = await resolverAbonoParcial(d, ref, c0, s(p.vencId), marca, tr);
  else if (accion === C.PREVIRED) return resolverPrevired(c0, p, marca, tr);
  else if (accion === C.PREVIRED_PLANILLA) return unirPlanilla(c0, p, marca);
  else if (accion === 'ignorar') {
    const motivo = C.texto(p.motivo, 80) || 'No es gasto', detalle = { motivo, siempre: !!p.siempre, marca: clave };
    r = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
      const R = p.siempre ? await leerRegla(tx, d, c0.clave) : null;
      tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.ignorado, accion, detalle: JSON.stringify(detalle) }));
      if (R) escribirRegla(tx, R, C.reglaDe('ignorar', c0, { siempre: true, motivo }), c0);
      return { n: 1 + (R ? 1 : 0), detalle, estado: C.ESTADOS.ignorado };
    });
  } else if (accion === C.PAGO_TARJETA) {
    // v0.62.0 · Pago de la tarjeta de crédito: no crea gasto (las compras con tarjeta ya entraron por el SII); es un movimiento de flujo
    const tarjeta = C.texto(p.tarjeta, 80), detalle = { movimiento: 'flujo', tipo: C.PAGO_TARJETA, tarjeta, marca: clave };
    r = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
      const R = await leerRegla(tx, d, c0.clave);
      tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion, detalle: JSON.stringify(detalle) }));
      escribirRegla(tx, R, C.reglaDe(C.PAGO_TARJETA, c0, { tarjeta }), c0);
      return { n: 2, detalle, estado: C.ESTADOS.conciliado };
    });
  } else if (accion === C.TRASPASO) {
    // v0.63.1 · Traspaso entre cuentas propias (chequera ↔ cuenta corriente): no crea gasto; movimiento de flujo que se aprende
    const nota = C.texto(p.nota, 80), detalle = { movimiento: 'flujo', tipo: C.TRASPASO, nota, marca: clave };
    r = await FB.runTransaction(d, async tx => {
      const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
      const R = await leerRegla(tx, d, c0.clave);
      tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion, detalle: JSON.stringify(detalle) }));
      escribirRegla(tx, R, C.reglaDe(C.TRASPASO, c0, { nota }), c0);
      return { n: 2, detalle, estado: C.ESTADOS.conciliado };
    });
  } else throw error('Acción desconocida', 'datos');
  if (r.repetido) return { ok: true, repetido: true, id: c0.id, accion };
  await despues(r.n);
  // v0.64.0 · Lo aprendido del proveedor: la glosa de este cargo queda en su ficha (si se sabe quién es)
  try { await aprenderGlosa(c0, p, r.detalle); } catch (e) {}
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
        const od = { tipo: 'vencimiento', vencimientoId: v0.id, obligacion: s(a.nombre), periodo: s(a.fechaVencimiento).slice(0, 10), cartola: true, cargoId: c0.id, por: quien(), en: ahora() };
        lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, cartola: tr, cartolaCargo: c0.id, origenDetalle: od }, 'obligacion')));
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
  // v0.63.1: el vencimiento pagado a mano de esos gastos (si lo hay) también queda con la cartola
  const pre = await Promise.all(ids.map(id => FB.getDoc(FB.doc(d, 'gastos', id))));
  const vIds = [...new Set(pre.filter(x => x.exists()).map(x => s(x.data().vencimientoId)).filter(Boolean))].slice(0, 5);
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const refs = ids.map(id => FB.doc(d, 'gastos', id)), sns = [];
    for (const r of refs) sns.push(await tx.get(r));
    const refsV = vIds.map(id => FB.doc(d, 'vencimientos', id)), snV = [];
    for (const r of refsV) snV.push(await tx.get(r));
    let suma = 0;
    sns.forEach(g => {
      if (!g.exists() || g.data().estado !== 'vigente') throw error('Ese gasto cambió en otro lado: recarga la lista.', 'cambio');
      if (g.data().cartolaCargo || /\[cc[0-9a-f]{10}\]/.test(s(g.data().cartola))) throw error('Ese gasto ya está conciliado con otro cargo.', 'datos');
      suma += M.n(g.data().montoFinal);
    });
    if (Math.abs(suma - c0.monto) > ids.length) throw error(`El gasto suma ${suma} y el cargo es de ${c0.monto}`, 'datos');
    const esperaban = [], conFecha = [], vLigados = [];
    sns.forEach((g, i) => {
      const a = g.data(), campos = { cartola: tr, cartolaCargo: c0.id };
      if (a.esperaCargo === true) { campos.esperaCargo = false; esperaban.push(refs[i].id); }
      // Una factura a crédito (sin vencimiento por pagar) que se paga con este cargo: queda con su fecha de pago
      if (['proveedor', 'tarjeta'].includes(s(a.formaPago)) && !s(a.fechaPago)) { campos.fechaPago = c0.fecha; conFecha.push(refs[i].id); }
      tx.update(refs[i], cambio(a, 'conciliado con la cartola', campos));
    });
    snV.forEach((v, i) => {
      if (!v.exists()) return; const a = v.data();
      if (G3.estadoBase(a) !== 'pagado' || s(a.cartolaCargo)) return;
      tx.update(refsV[i], cambio(a, 'confirmado con la cartola', { cartola: tr, cartolaCargo: c0.id }));
      vLigados.push(refsV[i].id);
    });
    const g0 = sns[0].data();
    const detalle = { filas: ids.length, ids, items: [...new Set(sns.map(g => s(g.data().itemGasto)))], fecha: s(g0.fecha), monto: suma, marca: clave,
      ...(esperaban.length ? { esperaban } : {}), ...(conFecha.length ? { conFechaPago: conFecha } : {}), ...(vLigados.length ? { vencimientosLigados: vLigados } : {}) };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'gasto', detalle: JSON.stringify(detalle) }));
    return { n: ids.length + 1 + vLigados.length, detalle };
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
    const od = { tipo: 'cartola', cargoId: c0.id, descripcion: c0.descripcion, fecha: c0.fecha, cuenta: c0.cuenta, por: quien(), en: ahora() };
    // v0.64.0: el SII de ese mes no estaba cargado: el gasto espera su factura (en la carga del SII se ofrece vincularla)
    const espera = gq.esperaFactura === true && !gq.sinFactura;
    lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, cartola: tr, cartolaCargo: c0.id, origenDetalle: od, ...(espera ? { esperaFactura: true } : {}) }, 'cartola')));
    const detalle = { items: li.limpios.map(it => it.item), filas: lineas.length, ids, sinFactura: !!gq.sinFactura, tipoMonto, marca: clave, ...(espera ? { esperaFactura: true } : {}) };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'nuevo', detalle: JSON.stringify(detalle) }));
    escribirRegla(tx, R, C.reglaDe('nuevo', c0, { it0: li.limpios[0], sinFactura: !!gq.sinFactura }), c0);
    return { n: lineas.length + 2, detalle };
  });
}

// Abono a un vencimiento de tipo libre (sueldo líquido). Primero el abono (idempotente por el cargo), después el cargo.
// v0.63.1 · con el área del abono (areas, fuenteArea) y el destinatario (la glosa y el RUT del cargo; nombre opcional)
async function resolverAbono(d, ref, c0, vencId, marca, tr, p = {}) {
  if (!vencId) throw error('Elige el vencimiento que recibe el abono', 'datos');
  const sv = await FB.getDoc(FB.doc(d, 'vencimientos', vencId));
  if (!sv.exists()) throw error('Ese vencimiento ya no existe', 'datos');
  const v = sv.data();
  if (s(v.tipoObligacion) !== 'libre') throw error('Solo los vencimientos de tipo libre reciben abonos', 'datos');
  const ra = await FS.agregarAbono(vencId, { monto: c0.monto, fecha: c0.fecha, origen: 'cartola', cargoId: c0.id, cartola: tr, obs: '',
    ...(Array.isArray(p.areas) && p.areas.length ? { areas: p.areas, fuenteArea: s(p.fuenteArea) } : {}), destinatario: { rut: c0.rut || (P.rutValido(p.rutDestino) ? P.rutNorm(p.rutDestino) : ''), descripcion: c0.descripcion, nombre: C.texto(p.nombre, 80) } }, marca, null);
  const clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const snV = await tx.get(FB.doc(d, 'vencimientos', vencId)), a = snV.data(), l = Array.isArray(a.abonos) ? a.abonos : [];
    const k = l.findIndex(y => y.cargoId === c0.id);
    if (k < 0) throw error('El abono no quedó en el vencimiento: vuelve a intentarlo.', 'cambio');
    const R = await leerRegla(tx, d, c0.clave);
    const detalle = { abono: { vencimientoId: vencId, nombre: s(a.nombre), n: k + 1, monto: c0.monto, plantillaId: s(a.plantillaID), gastos: l[k].gastoIds || [], ...(Array.isArray(l[k].areas) ? { areas: l[k].areas } : {}) }, marca: clave, repetidoAbono: !!ra.repetido };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: 'abono', detalle: JSON.stringify(detalle) }));
    if (s(a.plantillaID)) escribirRegla(tx, R, C.reglaDe('abono', c0, { plantillaId: s(a.plantillaID), nombre: s(a.nombre) }), c0);
    return { n: 2, detalle };
  });
}

// v0.64.0 · Abono (pago parcial) a un vencimiento no libre: el abono primero (idempotente por el cargo), después el cargo
async function resolverAbonoParcial(d, ref, c0, vencId, marca, tr) {
  if (!vencId) throw error('Elige el vencimiento que recibe el abono', 'datos');
  const ra = await FS.abonoParcial(vencId, { monto: c0.monto, fecha: c0.fecha, origen: 'cartola', cargoId: c0.id, cartola: tr }, marca);
  const clave = marca.t + marca.r;
  return FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), x = revisarCargo(sn, c0, clave); if (x.repetido) return { repetido: true };
    const snV = await tx.get(FB.doc(d, 'vencimientos', vencId)), a = snV.data(), l = Array.isArray(a.abonos) ? a.abonos : [];
    const k = l.findIndex(y => y.cargoId === c0.id);
    if (k < 0) throw error('El abono no quedó en el vencimiento: vuelve a intentarlo.', 'cambio');
    const detalle = { abonoParcial: { vencimientoId: vencId, nombre: s(a.nombre), n: k + 1, monto: c0.monto, total: G3.totalVenc(a), saldo: G3.saldoVenc(a), final: G3.estadoBase(a) === 'pagado', gastos: l[k].gastoIds || [] }, marca: clave, repetidoAbono: !!ra.repetido };
    tx.update(ref, aCargo(c0, sn.data(), { estado: C.ESTADOS.conciliado, accion: C.ABONO_PARCIAL, detalle: JSON.stringify(detalle) }));
    return { n: 1, detalle };
  });
}
// v0.64.0 · Pago de Previred (cotizaciones) con varios cargos: suman el total del certificado (±$10) o se confirma con un motivo.
// Paga el vencimiento de Cotizaciones como siempre (un gasto por trabajador con su área: lo devengado del certificado) y deja
// todos los cargos conciliados, cada uno con el grupo. p = { vencId, cargos: [{ id, huella }], motivo }
async function resolverPrevired(c0, p, marca, tr) {
  const d = await dbBase(), vencId = s(p.vencId);
  const lista = (Array.isArray(p.cargos) ? p.cargos : []).map(x => ({ id: s(x && x.id), huella: s(x && x.huella) })).filter(x => x.id);
  if (!lista.some(x => x.id === c0.id)) lista.unshift({ id: c0.id, huella: c0.huella });
  if (lista.length > 12) throw error('Son demasiados cargos para un pago de Previred (máximo 12)', 'datos');
  if (new Set(lista.map(x => x.id)).size !== lista.length) throw error('Un cargo está repetido', 'datos');
  if (!vencId) throw error('Falta el vencimiento de Cotizaciones', 'datos');
  const refV = FB.doc(d, 'vencimientos', vencId), refsC = lista.map(x => FB.doc(d, 'cartola_cargos', x.id));
  const clave = marca.t + marca.r, hora = M.ahoraChile().hora, motivo = C.texto(p.motivo, 200);
  const r = await FB.runTransaction(d, async tx => {
    const snC = []; for (const rf of refsC) snC.push(await tx.get(rf));
    const cs = snC.map((sn, i) => { if (!sn.exists()) throw error('Un cargo ya no está. Recarga la lista.', 'datos'); const c = C.vistaCargo(sn.id, sn.data()); if (lista[i].huella && c.huella !== lista[i].huella) throw error('Un cargo cambió. Recarga la lista.', 'cambio'); return c; });
    const c00 = cs.find(c => c.id === c0.id);
    if (c00.estado !== C.ESTADOS.revisar) { if (c00.detalle && c00.detalle.marca === clave) return { repetido: true }; throw error(`Ese cargo ya se había resuelto (${c00.accion}). Recarga la lista.`, 'resuelto'); }
    const otro = cs.find(c => c.estado !== C.ESTADOS.revisar); if (otro) throw error(`El cargo de ${otro.monto} (${otro.descripcion}) ya se había resuelto. Recarga la lista.`, 'resuelto');
    const snV = await tx.get(refV); if (!snV.exists()) throw error('Ese vencimiento ya no existe', 'datos');
    const a = snV.data(), eb = G3.estadoBase(a);
    if (!['esperando_documento', 'por_pagar'].includes(eb)) throw error(`"${s(a.nombre)}" ya no está por pagar. Recarga la lista.`, 'pagado');
    if (!G3.esPrevired(a)) throw error('Ese vencimiento no tiene el certificado de Previred: súbelo primero (Conciliación → Previred).', 'datos');
    const Rs = [], leidas = {};
    for (const c of cs) { if (!leidas[c.clave]) leidas[c.clave] = await leerRegla(tx, d, c.clave); Rs.push(leidas[c.clave]); }
    const total = (a.documento.previred.trabajadores || []).reduce((x, t) => x + (Number(t.total) || 0), 0), suma = cs.reduce((x, c) => x + c.monto, 0);
    const q = C.cuadraPrevired(suma, total);
    if (!q.igual && motivo.length < 3) throw error(`Los cargos suman ${suma} y el certificado ${total} (diferencia ${q.dif}): escribe el motivo para confirmar igual.`, 'diferencia');
    const fecha = cs.map(c => c.fecha).sort().pop();
    const lp = G3D.lineasDelPago(M.vistaVencimiento(vencId, a), a, total, fecha, tr.slice(0, 500), '', 'siniva', hora);
    if (lp.error) throw error(lp.error, 'datos');
    const ids = M.idsLineas('gp', { t: marca.t, r: marca.r + 'p' }, lp.lineas.length);
    const od = { tipo: 'vencimiento', vencimientoId: vencId, obligacion: s(a.nombre), periodo: s(a.fechaVencimiento).slice(0, 10), cartola: true, cargoId: c0.id, cargos: cs.map(c => c.id), por: quien(), en: ahora() };
    lp.lineas.forEach((l, k) => tx.set(FB.doc(d, 'gastos', ids[k]), nuevo({ ...l, cartola: tr, cartolaCargo: c0.id, origenDetalle: od }, 'obligacion')));
    const grupo = { vencimientoId: vencId, nombre: s(a.nombre), total, suma, diferencia: q.dif, motivo: q.igual ? '' : motivo, cargos: cs.map(c => ({ id: c.id, monto: c.monto, descripcion: c.descripcion, fecha: c.fecha })), gastos: ids, principal: c0.id };
    tx.update(refV, cambio(a, 'pagó con la cartola (Previred)', { estado: 'pagado', fechaPago: fecha, montoPago: String(suma), obsPago: (`Previred con ${cs.length} cargos · ${tr}` + (q.igual ? '' : ` · diferencia ${q.dif}: ${motivo}`)).slice(0, 500), cartola: tr, cartolaCargo: c0.id,
      pago: { clave, cargoId: c0.id, cargos: cs.map(c => c.id), diferencia: q.dif, motivo: q.igual ? '' : motivo } }));
    cs.forEach((c, i) => {
      const detalle = { previred: grupo, marca: clave };
      tx.update(refsC[i], aCargo(c, snC[i].data(), { estado: C.ESTADOS.conciliado, accion: C.PREVIRED, detalle: JSON.stringify(detalle).slice(0, 45000) }));
    });
    const vistos = new Set();
    cs.forEach((c, i) => { if (vistos.has(c.clave)) return; vistos.add(c.clave); escribirRegla(tx, Rs[i], C.reglaDe(C.PREVIRED, c), c); });
    return { n: 1 + lp.lineas.length + cs.length * 2, detalle: { previred: grupo } };
  });
  if (r.repetido) return { ok: true, repetido: true, id: c0.id, accion: C.PREVIRED };
  await despues(r.n);
  try { await FS.vencimientosAlDia(); } catch (e) {}
  return { ok: true, id: c0.id, accion: C.PREVIRED, estado: C.ESTADOS.conciliado, detalle: r.detalle };
}
// v0.65.1 · Unir cargos del banco a una planilla de Previred ya registrada (mes cargado, gastos por trabajador ya creados):
// NO crea gastos. Una transacción: los cargos (por revisar, misma huella) quedan conciliados con accion 'previred_planilla' y
// la planilla (previred_planillas/{AAAA-MM}) suma sus pagos vinculados. Lo unido no puede pasarse del total (±$10).
// p = { planillaId: 'AAAA-MM', cargos: [{ id, huella }] }
async function unirPlanilla(c0, p, marca) {
  const d = await dbBase(), per = s(p.planillaId).slice(0, 7);
  const lista = (Array.isArray(p.cargos) ? p.cargos : []).map(x => ({ id: s(x && x.id), huella: s(x && x.huella) })).filter(x => x.id);
  if (!lista.some(x => x.id === c0.id)) lista.unshift({ id: c0.id, huella: c0.huella });
  if (lista.length > 12) throw error('Son demasiados cargos de una vez (máximo 12)', 'datos');
  if (new Set(lista.map(x => x.id)).size !== lista.length) throw error('Un cargo está repetido', 'datos');
  const pl = (await planillas()).find(x => x.periodo === per);
  if (!pl) throw error('Esa planilla de Previred ya no está (Conciliación → Previred)', 'datos');
  if (pl.vencAbierto) throw error('Esa planilla tiene su vencimiento de Cotizaciones por pagar: págalo con "Pago de Previred" en vez de unir.', 'datos');
  const clave = marca.t + marca.r, t = ahora(), por = quien();
  const refP = FB.doc(d, COL_PLANILLAS, per), refsC = lista.map(x => FB.doc(d, 'cartola_cargos', x.id));
  const r = await FB.runTransaction(d, async tx => {
    const snC = []; for (const rf of refsC) snC.push(await tx.get(rf));
    const snP = await tx.get(refP);
    const cs = snC.map((sn, i) => { if (!sn.exists()) throw error('Un cargo ya no está. Recarga la lista.', 'datos'); const c = C.vistaCargo(sn.id, sn.data()); if (lista[i].huella && c.huella !== lista[i].huella) throw error('Un cargo cambió. Recarga la lista.', 'cambio'); return c; });
    const c00 = cs.find(c => c.id === c0.id);
    if (c00.estado !== C.ESTADOS.revisar) { if (c00.detalle && c00.detalle.marca === clave) return { repetido: true }; throw error(`Ese cargo ya se había resuelto (${c00.accion}). Recarga la lista.`, 'resuelto'); }
    const otro = cs.find(c => c.estado !== C.ESTADOS.revisar); if (otro) throw error(`El cargo de ${otro.monto} (${otro.descripcion}) ya se había resuelto. Recarga la lista.`, 'resuelto');
    const a = snP.exists() ? snP.data() : null, antes = Array.isArray(a && a.pagos) ? a.pagos : [];
    if (cs.some(c => antes.some(x => s(x.cargoId) === c.id))) throw error('Un cargo ya estaba unido a esta planilla. Recarga la lista.', 'resuelto');
    // Lo unido: lo del documento (al día, dentro de la transacción) y lo pagado con la cartola por su vencimiento (v0.64.0)
    const previo = antes.reduce((x, y) => x + (Number(y.monto) || 0), 0) + pl.pagos.filter(x => x.porVencimiento).reduce((x, y) => x + y.monto, 0);
    const suma = cs.reduce((x, c) => x + c.monto, 0), q = C.revisarUnion({ ...pl, unido: previo }, suma);
    if (q.error) throw error(q.error, 'datos');
    const nuevos = cs.map(c => ({ cargoId: c.id, monto: c.monto, fecha: c.fecha, descripcion: C.texto(c.descripcion, 120), cuenta: s(c.cuenta), cuentaN: s(c.cuentaN), por, en: t, marca: clave }));
    const campos = { periodo: per, total: pl.total, fechaPago: pl.fechaPago, trabajadores: pl.n, pagos: antes.concat(nuevos), unido: q.avance.unido, falta: q.avance.falta,
      estado: q.avance.completa ? 'pagada_conciliada' : 'parcial', ...(q.avance.completa ? { conciliadaEl: t, conciliadaPor: por } : { conciliadaEl: '', conciliadaPor: '' }) };
    if (a) tx.update(refP, sinPlanilla(cambio(a, `unió ${cs.length} ${cs.length === 1 ? 'cargo' : 'cargos'} del banco`, campos))); else tx.set(refP, sinPlanilla(nuevo({ ...campos, pagosQuitados: [] }, 'previred')));
    const grupo = { planillaId: per, nombre: pl.nombre, total: pl.total, fechaPago: pl.fechaPago, cargos: cs.map(c => ({ id: c.id, monto: c.monto, fecha: c.fecha, descripcion: c.descripcion })), suma, unido: q.avance.unido, falta: q.avance.falta, completa: q.avance.completa, principal: c0.id };
    cs.forEach((c, i) => tx.update(refsC[i], aCargo(c, snC[i].data(), { estado: C.ESTADOS.conciliado, accion: C.PREVIRED_PLANILLA, detalle: JSON.stringify({ previredPlanilla: grupo, marca: clave }).slice(0, 45000) })));
    return { n: 1 + cs.length, detalle: { previredPlanilla: grupo } };
  });
  if (r.repetido) return { ok: true, repetido: true, id: c0.id, accion: C.PREVIRED_PLANILLA };
  await despues(r.n);
  return { ok: true, id: c0.id, accion: C.PREVIRED_PLANILLA, estado: C.ESTADOS.conciliado, detalle: r.detalle };
}
// v0.65.1 · Deshacer UN cargo unido a una planilla: sale de sus pagos (queda en pagosQuitados con el motivo), la planilla
// recalcula lo unido (deja de estar "pagada y conciliada" si falta) y el cargo vuelve a revisar. Los demás cargos siguen unidos.
async function deshacerUnion(d, c0, motivo) {
  const g = (c0.detalle && c0.detalle.previredPlanilla) || {}, per = s(g.planillaId).slice(0, 7), t = ahora(), por = quien(), avisos = [];
  const ref = FB.doc(d, 'cartola_cargos', c0.id), refP = per ? FB.doc(d, COL_PLANILLAS, per) : null;
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref); if (!sn.exists()) throw error('Ese cargo ya no está', 'datos');
    const snP = refP ? await tx.get(refP) : null;
    const c = C.vistaCargo(sn.id, sn.data()); if (c.estado === C.ESTADOS.revisar) return { yaEstaba: true };
    let n = 1;
    if (snP && snP.exists()) {
      const a = snP.data(), l = Array.isArray(a.pagos) ? a.pagos : [], fuera = l.filter(x => s(x.cargoId) === c.id), quedan = l.filter(x => s(x.cargoId) !== c.id);
      if (fuera.length) {
        const av = C.avancePlanilla(Number(a.total) || 0, quedan.reduce((x, y) => x + (Number(y.monto) || 0), 0));
        tx.update(refP, sinPlanilla(cambio(a, 'quitó un cargo del banco (deshecho)', { pagos: quedan, pagosQuitados: (Array.isArray(a.pagosQuitados) ? a.pagosQuitados : []).concat(fuera.map(x => ({ ...x, quitado: { por, en: t, motivo } }))),
          unido: av.unido, falta: av.falta, estado: av.completa ? 'pagada_conciliada' : quedan.length ? 'parcial' : 'sin_pagos', ...(av.completa ? {} : { conciliadaEl: '', conciliadaPor: '' }) }, { motivo })));
        n++;
      } else avisos.push('El cargo ya no estaba en la planilla: no se tocó.');
    } else avisos.push('La planilla ya no está: solo vuelve el cargo.');
    tx.update(ref, cambioCargo(sn.data(), 'deshizo', { estado: C.ESTADOS.revisar, accion: '', detalle: '', resueltoEl: '', resueltoPor: '', historial: C.conDeshecho(c, motivo, t, por) }, { motivo }));
    return { n };
  });
  if (r.yaEstaba) return { ok: true, yaEstaba: true };
  await despues(r.n);
  return { ok: true, avisos };
}
// v0.64.0 · La glosa del cargo queda en la ficha del proveedor (de la factura pagada, del gasto o el que se mostró). Sin lecturas
// nuevas: las fichas ya están en memoria. Una escritura solo si la glosa todavía no estaba.
async function aprenderGlosa(c0, p, det) {
  const k = P.claveGlosa(c0.descripcion);
  if (k.length < 6 || P.deGlosa(c0.descripcion).rut) return;
  const fichas = (await todos('proveedores')).map(x => P.vistaFicha(x.id, x.d));
  let f = p && p.proveedorId ? fichas.find(x => x.id === s(p.proveedorId)) : null;
  if (!f && det) {
    const ruts = [].concat((det.vencimientos || []).map(v => s(v.rut)), det.rut ? [s(det.rut)] : []).map(P.rutNorm).filter(Boolean);
    if (ruts.length && ruts.every(r => r === ruts[0])) f = fichas.find(x => x.rut === ruts[0]);
  }
  if (!f || f.glosas.includes(k)) return;
  const d = await dbBase();
  await FB.updateDoc(FB.doc(d, 'proveedores', f.id), { glosas: f.glosas.concat([k]).slice(-12), glosaAprendida: { glosa: k, cargo: c0.id, por: quien(), en: ahora() } });
}
// v0.64.0 · Transferencias enviadas (BancoEstado): tef_enviadas/{cuenta}_{operación}, solo los últimos 180 días; subir el
// mismo archivo otra vez no repite. L = TE.leerEnviadas(…). No pasa a la planilla (es solo para reconocer los cargos).
export async function guardarEnviadas(L, nombreArchivo) {
  if (!L || !Array.isArray(L.filas)) throw error('El archivo no trae transferencias', 'datos');
  const hoy = M.ahoraChile().dia, corte = G3.sumarDias(hoy, -TE.DIAS_GUARDAR), t = ahora(), por = quien();
  const filas = L.filas.filter(x => x.fecha >= corte), cu = L.cuenta || {};
  const ya = new Set((await todos('tef_enviadas')).map(x => x.id));
  const nuevas = filas.map(x => ({ id: TE.idEnviada(cu.numero, x), x })).filter(y => !ya.has(y.id));
  const d = await dbBase();
  for (let i = 0; i < nuevas.length; i += 400) {
    const b = FB.writeBatch(d);
    nuevas.slice(i, i + 400).forEach(({ id, x }) => b.set(FB.doc(d, 'tef_enviadas', id), limpio({ ...x, cuentaNum: s(cu.numero), cuentaTipo: cu.tipo || 'chequera', cuentaFin: s(cu.fin), cuentaTexto: s(cu.texto), archivo: C.texto(nombreArchivo, 120), subida: t, por, creado: FB.serverTimestamp() })));
    await b.commit();
  }
  return { ok: true, leidas: L.filas.length, nuevas: nuevas.length, viejas: L.filas.length - filas.length, cuenta: cu, desde: L.desde, hasta: L.hasta };
}

// ── Deshacer (ccDeshacer) ──
export async function deshacer(id, motivoP) {
  const motivo = C.texto(motivoP, 300);
  if (motivo.length < 3) throw error('Escribe el motivo', 'datos');
  const { d, ref, c: c0 } = await leerCargo(id);
  if (c0.estado === C.ESTADOS.revisar) return { ok: true, yaEstaba: true };
  if (c0.accion === C.PREVIRED) return deshacerPrevired(d, c0, motivo);
  if (c0.accion === C.PREVIRED_PLANILLA) return deshacerUnion(d, c0, motivo);
  const refTxt = '[' + c0.id + ']', det = c0.detalle || {};
  // Gastos de este cargo: por su id (hechos en la base) o por la traza (conciliados en la planilla y copiados en G1)
  const g1 = await todos('gastos', FB.where('cartolaCargo', '==', c0.id));
  const g2 = c0.accion === 'ignorar' ? [] : (await todos('gastos', FB.where('fecha', '>=', G3.sumarDias(c0.fecha || M.ahoraChile().dia, -400)))).filter(x => s(x.d.cartola).includes(refTxt));
  const gIds = [...new Set(g1.concat(g2).map(x => x.id))];
  const vIds = c0.accion === 'vencimientos' ? (det.vencimientos || []).map(x => s(x.id)) : c0.accion === 'abono' && det.abono ? [s(det.abono.vencimientoId)] : c0.accion === C.ABONO_PARCIAL && det.abonoParcial ? [s(det.abonoParcial.vencimientoId)] : c0.accion === 'gasto' ? (det.vencimientosLigados || []).map(s) : [];
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
    // v0.63.1: el vencimiento pagado a mano que solo se confirmó con este cargo: pierde la cartola (sigue pagado)
    if (c.accion === 'gasto') snV.forEach((s0, i) => { if (!s0 || !s0.exists()) return; const a = s0.data(); if (s(a.cartolaCargo) !== c.id) return; tx.update(refsV[i], cambio(a, 'sin cartola (deshecho)', { cartola: '', cartolaCargo: '' }, { motivo })); n++; });
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
    // v0.64.0 · Abono parcial: sale del vencimiento (queda en abonosQuitados); si era el primero, su gasto completo se anula
    if (c.accion === C.ABONO_PARCIAL && snV[0] && snV[0].exists()) {
      const a = snV[0].data(), q = G3.quitarAbonoParcial(a, c.id, { por, en: t, motivo });
      if (q.error === 'El abono ya no estaba') avisos.push(`El abono ya no estaba en "${s(a.nombre)}": no se tocó.`);
      else if (q.error) throw error(q.error, 'datos');
      else { tx.update(refsV[0], cambio(a, 'abono parcial deshecho (cartola)', q.campos, { motivo })); n++; }
    }
    // Gastos: "ya estaba" solo pierde la cartola; a crédito vuelve sin fecha de pago; lo creado aquí queda anulado
    snG.forEach((sg, i) => {
      if (!sg.exists()) return; const g = sg.data(); if (g.estado !== 'vigente') return;
      const forma = s(g.formaPago);
      // v0.63.1: lo que esperaba su cargo vuelve a esperarlo; la fecha de pago puesta al vincular se quita
      if (c.accion === 'gasto') tx.update(refsG[i], cambio(g, 'sin cartola (deshecho)', { cartola: '', cartolaCargo: '', ...((det.esperaban || []).includes(refsG[i].id) ? { esperaCargo: true } : {}), ...((det.conFechaPago || []).includes(refsG[i].id) ? { fechaPago: '' } : {}) }, { motivo }));
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

// v0.64.0 · Deshacer un pago de Previred: vuelven a revisar TODOS los cargos del grupo, el vencimiento queda por pagar y los gastos
// por trabajador quedan anulados (no se borran)
async function deshacerPrevired(d, c0, motivo) {
  const g = (c0.detalle && c0.detalle.previred) || {}, ids = [...new Set([c0.id].concat((g.cargos || []).map(x => s(x.id))))].slice(0, 12);
  const t = ahora(), por = quien(), avisos = [];
  const r = await FB.runTransaction(d, async tx => {
    const refsC = ids.map(x => FB.doc(d, 'cartola_cargos', x)), snC = [];
    for (const rf of refsC) snC.push(await tx.get(rf));
    const refV = g.vencimientoId ? FB.doc(d, 'vencimientos', s(g.vencimientoId)) : null, snV = refV ? await tx.get(refV) : null;
    const refsG = (g.gastos || []).map(x => FB.doc(d, 'gastos', s(x))), snG = [];
    for (const rg of refsG) snG.push(await tx.get(rg));
    const cs = snC.map(sn => (sn.exists() ? C.vistaCargo(sn.id, sn.data()) : null));
    const Rs = []; for (const c of cs) Rs.push(c && c.accion === C.PREVIRED ? await leerRegla(tx, d, c.clave) : null);
    let n = 0;
    const anulado = { el: t, en: t, por, motivo: `Deshecho en la conciliación de la cartola (Previred ${c0.id}): ${motivo}`, filaOriginal: '' };
    snG.forEach((sg, i) => { if (!sg.exists() || sg.data().estado !== 'vigente') return; tx.update(refsG[i], cambio(sg.data(), 'anuló', { estado: 'anulado', anulado }, { motivo: anulado.motivo })); n++; });
    if (snV && snV.exists()) {
      const a = snV.data();
      if (G3.estadoBase(a) === 'pagado' && s(a.cartolaCargo) && ids.includes(s(a.cartolaCargo))) { tx.update(refV, cambio(a, 'pago deshecho (cartola, Previred)', { estado: 'por_pagar', fechaPago: '', montoPago: '', cartola: '', cartolaCargo: '', pago: null, obsPago: (`Pago deshecho ${t.slice(0, 10)} · ${por} · ${motivo}`).slice(0, 500) }, { motivo })); n++; }
      else avisos.push(`"${s(a.nombre)}" ya no estaba pagado con estos cargos: no se tocó.`);
    }
    const olvidadas = new Set();
    cs.forEach((c, i) => {
      if (!c || c.estado === C.ESTADOS.revisar || c.accion !== C.PREVIRED) return;
      tx.update(refsC[i], cambioCargo(snC[i].data(), 'deshizo', { estado: C.ESTADOS.revisar, accion: '', detalle: '', resueltoEl: '', resueltoPor: '', historial: C.conDeshecho(c, motivo, t, por) }, { motivo })); n++;
      const R = Rs[i]; if (R && R.sn.exists() && !olvidadas.has(c.clave)) { olvidadas.add(c.clave); const x = C.desaprender(R.act, C.PREVIRED, t, por); if (x) { tx.update(R.ref, cambio(R.sn.data(), 'olvidó (deshecho)', x)); n++; } }
    });
    return { n };
  });
  await despues(r.n);
  return { ok: true, avisos: [`Volvieron a revisar ${ids.length} ${ids.length === 1 ? 'cargo' : 'cargos'} del pago de Previred.`].concat(avisos) };
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

// ═══════════════════════════════════════════════
//  v0.64.0 · Proveedores (Conciliación → Proveedores): lista, detalle y fichas a mano. Todo desde la memoria.
// ═══════════════════════════════════════════════
export async function proveedoresLista() {
  const hoy = M.ahoraChile().dia;
  const [provs, ab, gastos, cg, cat] = await Promise.all([todos('proveedores'), abiertos(), todos('gastos', FB.where('fecha', '>=', G3.sumarDias(hoy, -400))), todos('cartola_cargos'), FS.catalogo()]);
  const fichas = provs.map(x => P.vistaFicha(x.id, x.d)).filter(f => !f.archivado);
  const cargos = cg.filter(x => !x.d.quitadoEnPlanilla).map(x => C.vistaCargo(x.id, x.d)), porCargo = {};
  cargos.forEach(c => { porCargo[c.id] = c; });
  // Gastos por RUT de proveedor (los vinculados a un cargo son los pagos por banco)
  const gPorRut = {};
  gastos.forEach(({ id, d }) => { if (d.estado !== 'vigente') return; const r = P.rutNorm(d.rutProveedor); if (r) (gPorRut[r] = gPorRut[r] || []).push({ id, d }); });
  const out = fichas.map(f => {
    const q = P.loQueLeCompras(f, 5), pend = ab.lista.filter(v => !v.plantillaId && f.rut && v.rut === f.rut);
    const ligados = new Map();
    (gPorRut[f.rut] || []).forEach(({ d }) => { const k = s(d.cartolaCargo); if (k && porCargo[k] && !ligados.has(k)) ligados.set(k, porCargo[k]); });
    cargos.forEach(c => { if (c.estado === C.ESTADOS.revisar || ligados.has(c.id)) return; const det = c.detalle || {};
      if ((f.rut && ((det.vencimientos || []).some(v => P.rutNorm(v.rut) === f.rut) || P.deGlosa(c.descripcion).rut === f.rut)) || f.glosas.includes(P.claveGlosa(c.descripcion))) ligados.set(c.id, c); });
    const pagos = [...ligados.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12).map(c => ({ id: c.id, fecha: c.fecha, monto: c.monto, descripcion: c.descripcion, accion: c.accion }));
    return { ...f, filas: undefined, prods: undefined, nFacturas: P.ultimasFacturas(f, 999).length, facturas: P.ultimasFacturas(f, 8), pendientes: pend.map(v => ({ id: v.id, nombre: v.nombre, fecha: v.fecha, monto: v.monto, saldo: v.saldo, estadoBase: v.estadoBase, folio: v.folio })),
      productos: q.productos, items: q.items, pagos, resumen: P.resumen(f) };
  }).sort((a, b) => s(b.ultima).localeCompare(s(a.ultima)) || a.nombre.localeCompare(b.nombre));
  return { ok: true, proveedores: out, items: cat.lista.filter(i => !i.archivado).map(i => i.item), areas: M.AREAS.slice() };
}
// Crear o editar una ficha a mano: { id (al editar), nombre, rut, glosas (texto o lista), item, area }. No pasa a la planilla.
export async function guardarFicha(p) {
  const cat = await FS.catalogo(), x = P.limpiarFicha(p || {}, cat.lista.filter(i => !i.archivado).map(i => i.item), M.AREAS);
  if (x.error) throw error(x.error, 'datos');
  const d = await dbBase(), id = s(p.id) || P.idFicha(x.campos.rut, x.campos.nombre), ref = FB.doc(d, 'proveedores', id), t = ahora(), por = quien();
  const r = await FB.runTransaction(d, async tx => {
    const sn = await tx.get(ref), a = sn.exists() ? sn.data() : null;
    if (!a && p.id) throw error('Esa ficha ya no está', 'datos');
    if (!a && !p.id && sn.exists()) throw error('Ya hay una ficha con ese nombre: ábrela y edítala', 'datos');
    const campos = { ...x.campos, ...(a && a.razonSocial ? {} : { razonSocial: x.campos.nombre }), ...(a && !x.campos.rut && a.rut ? { rut: a.rut, rutTexto: a.rutTexto || '' } : {}) };
    const h = M.conHistorial(a && a.historial, { que: a ? 'editó (a mano)' : 'creó (a mano)', por, en: t, cambios: M.diferencias(a, campos) });
    if (a) tx.update(ref, limpio({ ...campos, version: (Number(a.version) || 0) + 1, historial: h, actualizado: { en: FB.serverTimestamp(), por, que: 'editó a mano' } }));
    else tx.set(ref, limpio({ ...campos, filas: [], prods: [], creado: { por, en: FB.serverTimestamp() }, version: 0, historial: h, actualizado: { en: FB.serverTimestamp(), por, que: 'creó a mano' } }));
    return { nuevo: !a };
  });
  return { ok: true, id, ...r };
}
