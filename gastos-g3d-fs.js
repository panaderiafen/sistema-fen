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
// ═══════════════════════════════════════════════
import * as FB from './firebase-gastos.js?v=0.58.0';
import * as M from './gastos-g2.js?v=0.58.0';
import * as G3 from './gastos-g3.js?v=0.58.0';
import * as D from './gastos-g3d.js?v=0.58.0';
import { dbBase, todos, catalogo, nuevo, cambio, despues, correo } from './gastos-fs.js?v=0.58.0';

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
  return r;
}
export async function cotLista() { return D.listaCot(await todos('cotizaciones')); }

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
  const dest = D.destinoCertificado(ps, vencs, p.fechaPago);
  const aVenc = !!dest.venc;
  // Vencimiento elegido a mano (solo sin la obligación Cotizaciones): debe seguir por pagar, como en el script
  const vElegido = !aVenc && p.vencimientoId ? vencs.find(x => x.id === s(p.vencimientoId) && !x.d.quitadoEnPlanilla) : null;
  if (!aVenc && p.vencimientoId) {
    if (!vElegido) throw error('Ese vencimiento ya no existe', 'datos');
    if (!['esperando_documento', 'por_pagar'].includes(G3.estadoBase(vElegido.d))) throw error('Ese vencimiento ya está ' + (G3.NOMBRE_ESTADO[G3.estadoBase(vElegido.d)] || '').toLowerCase(), 'datos');
  }
  const escrituras = r.lineas + r.limpios.length * 2 + 2;
  if (escrituras > MAX_ESCRITURAS) throw error('El certificado trae demasiadas líneas para guardarlo de una vez: súbelo por partes (un PDF por trabajador).', 'datos');
  // El PDF a Drive ("Fën · Gastos / Previred / <año del período>", privado)
  let url = '';
  const b64 = s(p.archivoBase64);
  if (b64) { try { url = (await subir({ tipo: 'previred', fecha: '01-' + p.periodo.slice(5, 7) + '-' + p.periodo.slice(0, 4), imageData: b64, mimeType: 'application/pdf', fileName: s(p.nombreArchivo || 'previred.pdf').replace(/[\/\\]/g, '_').slice(0, 120) || 'previred.pdf' })).url || ''; } catch (e) { url = ''; } }
  const quien = correo() || 'Sistema Fën', en = M.ahoraChile().texto, hoy = M.ahoraChile().dia, hora = M.ahoraChile().hora;
  const lineasCot = D.docsCotizacion(p, r.limpios, url, en, quien, { cargadoClave: clave, ...(aVenc ? { vencimientoId: dest.venc.id } : vElegido ? { vencimientoId: vElegido.id } : {}) });
  const trab = r.limpios.map(t => D.docTrabajador(t, hoy));
  const refV = aVenc ? FB.doc(d, 'vencimientos', dest.venc.id) : vElegido ? FB.doc(d, 'vencimientos', vElegido.id) : null;
  const plan = { periodo: p.periodo, fecha: p.fecha, fechaPago: p.fechaPago, trabajadores: D.planTrabajadores(p, r.limpios) };
  const gastosAhora = aVenc ? [] : D.lineasPrevired(plan, p.fechaPago, url, hora, vElegido ? { vencimientoId: vElegido.id } : {});
  const idsG = M.idsLineas('gq', marca, gastosAhora.length);
  const n = await FB.runTransaction(d, async tx => {
    const refsC = lineasCot.map(x => FB.doc(d, 'cotizaciones', x.id)), refsT = trab.map(x => FB.doc(d, 'cotiz_trabajadores', x.id));
    const snC = [], snT = [];
    for (const rf of refsC) snC.push(await tx.get(rf));
    for (const rf of refsT) snT.push(await tx.get(rf));
    const snV = refV ? await tx.get(refV) : null;
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
        const c = G3.completarDocumento(a, D.documentoPrevired(p, r.limpios, url, p.nombreArchivo, clave), quien, en);
        if (c.error) throw error(c.error + ' (' + s(a.nombre) + ')', 'datos');
        if (a.documento) throw error('Ese vencimiento ya tiene su documento', 'datos');
        c.campos.documento = { ...c.campos.documento, clave, previred: plan };
        tx.update(refV, cambio(a, 'recibió el certificado de Previred', c.campos)); k++;
      } else {
        if (!['esperando_documento', 'por_pagar'].includes(G3.estadoBase(a))) throw error('Ese vencimiento ya no está por pagar', 'datos');
        tx.update(refV, cambio(a, 'pagó con Previred', { estado: 'pagado', fechaPago: p.fechaPago, montoPago: String(r.total), urlComprobante: url, obsPago: 'Pagado con Previred ' + D.nombreMes(p.periodo) + ' (gastos por trabajador)', pago: { clave } })); k++;
      }
    }
    lineasCot.forEach((x, i) => { tx.set(refsC[i], nuevo(x.d, 'previred', quien)); k++; });
    trab.forEach((x, i) => { const a = snT[i].exists() ? snT[i].data() : null; if (a) tx.update(refsT[i], cambio(a, 'Previred', x.d)); else tx.set(refsT[i], nuevo(x.d, 'previred', quien)); k++; });
    gastosAhora.forEach((l, i) => { tx.set(FB.doc(d, 'gastos', idsG[i]), nuevo(l, 'previred', quien)); k++; });
    return k;
  });
  if (n === -1) return { ok: true, repetido: true, trabajadores: r.limpios.length, total: r.total, lineas: r.lineas, conArchivo: !!url, vencimiento: false, aVencimiento: aVenc ? { id: dest.venc.id, nombre: s(dest.venc.d.nombre) } : null };
  await despues(n);
  return { ok: true, trabajadores: r.limpios.length, total: r.total, lineas: r.lineas, conArchivo: !!url, vencimiento: !!vElegido,
    aVencimiento: aVenc ? { id: dest.venc.id, nombre: s(dest.venc.d.nombre), fecha: G3.fechaReal(dest.venc.d) } : null, nota: aVenc ? '' : dest.motivo || '' };
}

// ── Clasificar obligaciones ──
export async function datosClasificar() {
  const [ps, vencs, siiDocs, fichas] = await Promise.all([todos('obligaciones'), todos('vencimientos'), todos('sii_docs'), todos('proveedores')]);
  return { ok: true, obligaciones: D.listaClasificar(ps, vencs, D.proveedoresSii(siiDocs, fichas), M.ahoraChile().dia) };
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
      const c = G3.clasificacionDesdeForm({ tipoObligacion: x.tipoObligacion, identificador: x.identificador, diasAviso: x.diasAviso });
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
