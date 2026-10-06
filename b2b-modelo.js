// ═══════════════════════════════════════════════
//  Sistema Fën — B2B: de las hojas de la planilla a la base nueva (fen-b2b)  v0.11.0
//  Funciones puras (sin Firebase ni pantalla): reciben las hojas tal como las entrega
//  el script de B2B (SistemaFen.gs v1.1.0, op "exportar") y arman los documentos.
//
//  Colecciones de fen-b2b:
//    clientes/{id}     un cliente, con sus precios especiales (precios: [{ producto, productoId, precio }])
//    productos/{id}    un producto
//    ordenes/{N°}      una orden con sus líneas adentro (una lectura trae la orden completa)
//    abonos/{id}       un abono a un folio
//    ediciones/{id}    el historial de ediciones de órdenes
//  Nada se borra: si algo deja de estar en la planilla, el documento queda con
//  quitadoEnPlanilla: true (y deja de sumar en los totales).
// ═══════════════════════════════════════════════

export const COLECCIONES = ['clientes', 'productos', 'ordenes', 'abonos', 'ediciones'];
export const NOMBRES = { clientes: 'Clientes', productos: 'Productos', ordenes: 'Órdenes', abonos: 'Abonos', ediciones: 'Ediciones de órdenes' };

// ── Utilidades ─────────────────────────────────────
const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// Para comparar nombres: sin tildes, sin mayúsculas y con un solo espacio
export const clave = s => sinTildes(s).toLowerCase().replace(/\s+/g, ' ').trim();
// Id de documento a partir de un nombre: "Café Uno" → "cafe-uno"
export const slug = s => clave(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sin-nombre';
// Encabezado de columna: "N° Orden" → "n orden", "ID_receta_fen" → "id receta fen", "Área (fën)" → "area fen"
export const encabezado = h => clave(String(h ?? '').replace(/_/g, ' ')).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const texto = v => (v === null || v === undefined) ? '' : String(v).trim();
// Pesos chilenos: un número se usa tal cual; un texto como "$25.990" usa el punto de miles.
export function numero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const t = texto(v); if (!t) return 0;
  const neg = /^-|^\(\s*\$?\s*\d/.test(t);
  const limpio = t.replace(/[^0-9.,]/g, '');
  let n;
  if (/^\d+,\d+$/.test(limpio)) n = Number(limpio.replace(',', '.'));                 // "1,5" → 1.5
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) n = Number(limpio.replace(/\./g, '').replace(',', '.'));   // "25.990" → 25990
  else if (/^\d+\.\d+$/.test(limpio)) n = Number(limpio);                              // "0.5" → 0.5
  else n = Number(limpio.replace(/[^0-9]/g, ''));
  return isNaN(n) ? 0 : (neg ? -n : n);
}
// Fecha AAAA-MM-DD (el script ya las manda así; también acepta DD/MM/AAAA)
export function dia(v) {
  const t = texto(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
const pendiente = v => !texto(v) || /^pendiente$/i.test(texto(v));
// Huella corta de un texto (para saber si un documento cambió desde la última copia)
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

// Una hoja { c: encabezados, f: [[fila, ...celdas]] } → filas como objetos con los campos conocidos
// y el resto en "extra" (así ninguna columna se pierde, aunque no la conozcamos).
function filas(hoja, campos) {
  if (!hoja || !Array.isArray(hoja.c)) return [];
  // Cada campo conocido toma la columna cuyo nombre aparece primero en su lista
  // (ej. "Fecha edición" antes que "Fecha"); cualquier otra columna va a "extra" con su nombre.
  const usados = {}, nombres = {};
  const mapa = hoja.c.map((h, i) => {
    const e = encabezado(h);
    let campo = null, prio = 1e9;
    Object.keys(campos).forEach(k => { const j = campos[k].indexOf(e); if (j >= 0 && j < prio) { campo = k; prio = j; } });
    let nombre = (texto(h) || `Columna ${i + 1}`).replace(/^__|__$/g, '_');
    nombres[nombre] = (nombres[nombre] || 0) + 1;
    if (nombres[nombre] > 1) nombre += ` (${nombres[nombre]})`;
    return { campo, prio, nombre };
  });
  mapa.forEach((m, i) => { if (m.campo && (!(m.campo in usados) || mapa[usados[m.campo]].prio > m.prio)) usados[m.campo] = i; });
  return (hoja.f || []).map(r => {
    const o = { _fila: r[0], extra: {} };
    mapa.forEach((m, i) => {
      const v = r[i + 1] === undefined || r[i + 1] === null ? '' : r[i + 1];
      if (m.campo && usados[m.campo] === i) o[m.campo] = v;
      else if (texto(v) !== '') o.extra[m.nombre] = typeof v === 'number' ? v : texto(v);
    });
    Object.keys(campos).forEach(k => { if (!(k in o)) o[k] = ''; });
    return o;
  });
}

const C_CLIENTE = { nombre: ['nombre'], rut: ['rut'], razonSocial: ['razon social'], giro: ['giro'], direccion: ['direccion'], correo: ['correo', 'email', 'mail'], telefono: ['telefono', 'fono'], contacto: ['contacto'], facturacion: ['facturacion'], frecuenciaPago: ['frecuencia pago', 'frecuencia de pago'] };
const C_PRODUCTO = { nombre: ['nombre'], precioBase: ['precio base'], categoria: ['categoria'], idReceta: ['id receta fen', 'id receta'], area: ['area fen', 'area'] };
const C_PRECIO = { cliente: ['cliente'], producto: ['producto'], precio: ['precio'] };
const C_ORDEN = { n: ['n orden', 'no orden', 'numero orden', 'n de orden'], fecha: ['fecha'], cliente: ['cliente'], neto: ['total neto', 'neto'], iva: ['iva'], total: ['total'], estadoPago: ['estado pago', 'estado de pago'], fechaPago: ['fecha pago', 'fecha de pago'], folio: ['folio sii', 'folio'], obs: ['observacion', 'observaciones'], fechaFolio: ['fecha folio'] };
const C_DETALLE = { n: C_ORDEN.n, fecha: ['fecha'], cliente: ['cliente'], producto: ['producto'], cantidad: ['cantidad'], precio: ['precio neto unit', 'precio unit', 'precio neto unitario', 'precio'], neto: ['neto total', 'neto'], iva: ['iva'], total: ['total'], estadoPago: C_ORDEN.estadoPago, fechaPago: C_ORDEN.fechaPago, folio: C_ORDEN.folio, obs: C_ORDEN.obs, fechaFolio: C_ORDEN.fechaFolio };
const C_ABONO = { folio: ['folio sii', 'folio'], fecha: ['fecha'], monto: ['monto'], referencia: ['referencia'] };
const C_EDICION = { n: C_ORDEN.n, fecha: ['fecha edicion', 'fecha'], motivo: ['motivo'], resumen: ['resumen'], cambios: ['cambios json', 'cambios'] };

// ── Armar todo ─────────────────────────────────────
// hojas: { 'Clientes': {c,f}, ... } → { docs: { coleccion: { id: datos } }, avisos: [...], planilla: totales }
export function armar(hojas) {
  const avisos = [];
  const aviso = (hoja, fila, txt) => avisos.push({ hoja, fila: fila || null, texto: txt });
  const docs = { clientes: {}, productos: {}, ordenes: {}, abonos: {}, ediciones: {} };
  const faltan = ['Clientes', 'Productos', 'Resumen Facturas', 'Detalle Ventas'].filter(h => !hojas[h]);
  if (faltan.length) throw new Error('La planilla no trae estas hojas: ' + faltan.join(', ') + '. Revisa que el script sea el de B2B.');

  // Productos
  const prodPorClave = {};
  filas(hojas['Productos'], C_PRODUCTO).forEach(r => {
    const nombre = texto(r.nombre);
    if (!nombre) { aviso('Productos', r._fila, 'Fila sin nombre: no se copió.'); return; }
    const k = clave(nombre);
    if (prodPorClave[k]) { aviso('Productos', r._fila, `"${nombre}" está repetido (fila ${docs.productos[prodPorClave[k]].origen.fila}): se usa el primero.`); return; }
    let id = slug(nombre), i = 2; while (docs.productos[id]) id = slug(nombre) + '-' + i++;
    if (id !== slug(nombre)) aviso('Productos', r._fila, `"${nombre}" se parece a otro producto (${docs.productos[slug(nombre)].nombre}): quedó como ${id}. Conviene cambiarle el nombre.`);
    prodPorClave[k] = id;
    docs.productos[id] = { nombre, precioBase: numero(r.precioBase), categoria: texto(r.categoria), idReceta: texto(r.idReceta), area: texto(r.area), estado: 'activo', extra: r.extra, origen: { hoja: 'Productos', fila: r._fila }, quitadoEnPlanilla: false };
  });
  const productoId = nombre => prodPorClave[clave(nombre)] || null;

  // Clientes
  const cliPorClave = {};
  filas(hojas['Clientes'], C_CLIENTE).forEach(r => {
    const nombre = texto(r.nombre);
    if (!nombre) { aviso('Clientes', r._fila, 'Fila sin nombre: no se copió.'); return; }
    const k = clave(nombre);
    if (cliPorClave[k]) { aviso('Clientes', r._fila, `"${nombre}" está repetido (fila ${docs.clientes[cliPorClave[k]].origen.fila}): se usa el primero.`); return; }
    let id = slug(nombre), i = 2; while (docs.clientes[id]) id = slug(nombre) + '-' + i++;
    if (id !== slug(nombre)) aviso('Clientes', r._fila, `"${nombre}" se parece a otro cliente (${docs.clientes[slug(nombre)].nombre}): quedó como ${id}. Conviene cambiarle el nombre.`);
    cliPorClave[k] = id;
    docs.clientes[id] = { nombre, rut: texto(r.rut), razonSocial: texto(r.razonSocial), giro: texto(r.giro), direccion: texto(r.direccion), correo: texto(r.correo), telefono: texto(r.telefono), contacto: texto(r.contacto), facturacion: texto(r.facturacion) || 'Diaria', frecuenciaPago: texto(r.frecuenciaPago) || 'Diaria', precios: [], estado: 'activo', extra: r.extra, origen: { hoja: 'Clientes', fila: r._fila }, quitadoEnPlanilla: false };
  });
  const clienteId = nombre => cliPorClave[clave(nombre)] || null;

  // Precios especiales: dentro de cada cliente
  let preciosSinCliente = 0;
  filas(hojas['Precios'], C_PRECIO).forEach(r => {
    const cli = clienteId(r.cliente);
    if (!texto(r.cliente) && !texto(r.producto)) return;
    if (!cli) { preciosSinCliente++; aviso('Precios', r._fila, `Precio de "${texto(r.producto)}" para "${texto(r.cliente)}": ese cliente no está en Clientes (tampoco lo usa la app). No se copió.`); return; }
    const pid = productoId(r.producto);
    if (!pid) aviso('Precios', r._fila, `Precio de "${texto(r.producto)}" para "${texto(r.cliente)}": ese producto no está en Productos. Se copió igual.`);
    const lista = docs.clientes[cli].precios;
    const previo = lista.find(p => clave(p.producto) === clave(r.producto));
    if (previo) { aviso('Precios', r._fila, `"${texto(r.producto)}" para "${texto(r.cliente)}" está dos veces: se usa la primera ($${previo.precio}).`); return; }
    lista.push({ producto: texto(r.producto), productoId: pid, precio: numero(r.precio) });
  });

  // Órdenes: resumen (actual e histórico) + líneas del detalle (actual e histórico)
  const resumen = [...filas(hojas['Resumen Facturas'], C_ORDEN).map(r => ({ ...r, _hoja: 'Resumen Facturas', _arch: false })),
    ...filas(hojas['Resumen Facturas Historico'], C_ORDEN).map(r => ({ ...r, _hoja: 'Resumen Facturas Historico', _arch: true }))];
  const detalle = [...filas(hojas['Detalle Ventas'], C_DETALLE).map(r => ({ ...r, _hoja: 'Detalle Ventas', _arch: false })),
    ...filas(hojas['Detalle Ventas Historico'], C_DETALLE).map(r => ({ ...r, _hoja: 'Detalle Ventas Historico', _arch: true }))];
  const nDe = v => { const n = numero(v); return n > 0 && Number.isInteger(n) ? n : null; };
  const lineasPor = {};
  detalle.forEach(r => {
    const n = nDe(r.n);
    if (!n) { if (texto(r.producto) || numero(r.total)) aviso(r._hoja, r._fila, `Línea sin N° de orden ("${texto(r.producto)}"): no se copió.`); return; }
    const k = (r._arch ? 'h' : 'a') + n;
    (lineasPor[k] = lineasPor[k] || []).push(r);
  });
  const linea = r => {
    const cantidad = numero(r.cantidad), precio = numero(r.precio);
    const neto = texto(r.neto) !== '' ? numero(r.neto) : cantidad * precio;
    const iva = texto(r.iva) !== '' ? numero(r.iva) : Math.round(neto * 0.19);
    const l = { producto: texto(r.producto), productoId: productoId(r.producto), cantidad, precio, neto, iva, total: texto(r.total) !== '' ? numero(r.total) : neto + iva };
    if (Object.keys(r.extra).length) l.extra = r.extra;
    return l;
  };
  const totalPlanilla = { ordenes: 0, total: 0, neto: 0, lineas: 0, totalLineas: 0, archivadas: 0, sinFolio: 0 };
  const vistas = {};
  resumen.forEach(r => {
    const n = nDe(r.n);
    if (!n) { aviso(r._hoja, r._fila, `Fila sin N° de orden válido ("${texto(r.n)}"): no se copió.`); return; }
    if (vistas[n]) {
      const o = docs.ordenes[String(n)];
      aviso(r._hoja, r._fila, `La orden N° ${n} está repetida (${vistas[n]}). Se usa la primera; esta queda anotada en la orden.`);
      o.duplicados = o.duplicados || [];
      o.duplicados.push({ hoja: r._hoja, fila: r._fila, fecha: dia(r.fecha), cliente: texto(r.cliente), total: numero(r.total), folio: pendiente(r.folio) ? null : texto(r.folio) });
      o.revisar.push('Repetida en la planilla');
      return;
    }
    vistas[n] = `${r._hoja}, fila ${r._fila}`;
    // Las líneas de la misma hoja (actual o histórico); si no hay, las de la otra
    const propia = (r._arch ? 'h' : 'a') + n, otra = (r._arch ? 'a' : 'h') + n;
    const k = lineasPor[propia] ? propia : otra;
    const ls = (lineasPor[k] || []).map(linea);
    delete lineasPor[k];
    const folio = pendiente(r.folio) ? null : texto(r.folio);
    const fecha = dia(r.fecha);
    const o = {
      n, fecha, mes: fecha.slice(0, 7), cliente: texto(r.cliente), clienteId: clienteId(r.cliente),
      lineas: ls, neto: numero(r.neto), iva: numero(r.iva), total: numero(r.total),
      estadoPago: texto(r.estadoPago).toUpperCase() || 'PENDIENTE', fechaPago: pendiente(r.fechaPago) ? null : (dia(r.fechaPago) || texto(r.fechaPago)),
      folio, sinFolio: !folio, fechaFolio: dia(r.fechaFolio) || null, obs: texto(r.obs),
      archivada: r._arch, estado: 'activa', extra: r.extra, revisar: [], origen: { hoja: r._hoja, fila: r._fila }, quitadoEnPlanilla: false
    };
    if (!fecha) { o.revisar.push('Sin fecha válida'); if (texto(r.fecha)) o.fechaTexto = texto(r.fecha); }
    if (texto(r.fechaFolio) && !o.fechaFolio) o.fechaFolioTexto = texto(r.fechaFolio);
    if (typeof r.total === 'string' && texto(r.total) && !/\d/.test(r.total)) o.revisar.push(`Total escrito como texto: "${texto(r.total)}"`);
    if (!o.clienteId) o.revisar.push('Cliente no está en Clientes');
    if (!ls.length) o.revisar.push('Sin líneas en el detalle');
    const sumaLineas = ls.reduce((s, l) => s + l.total, 0);
    if (ls.length && Math.abs(sumaLineas - o.total) > ls.length) o.revisar.push(`El detalle suma $${sumaLineas} y el resumen dice $${o.total}`);
    docs.ordenes[String(n)] = o;
  });
  // Líneas cuya orden no está en ningún resumen: se arma la orden con lo que hay (nada se pierde)
  const repetidas = [];
  Object.keys(lineasPor).forEach(k => {
    const rs = lineasPor[k], r0 = rs[0], n = Number(k.slice(1));
    const id = String(n);
    if (docs.ordenes[id]) {   // la orden ya está: estas líneas vienen de la otra hoja (archivado a medias)
      const firma = ls => ls.map(l => [clave(l.producto), l.cantidad, l.precio, l.total].join('|')).sort().join(';');
      const otras = rs.map(linea);
      if (firma(otras) === firma(docs.ordenes[id].lineas)) {
        // Las mismas líneas, repetidas: el archivado las copió al histórico pero no alcanzó a borrarlas. No se pierde nada.
        docs.ordenes[id].detalleRepetidoEn = r0._hoja;
        repetidas.push({ n, hoja: r0._hoja, filas: rs.map(x => x._fila) });
        return;
      }
      docs.ordenes[id].lineasOtraHoja = otras;
      docs.ordenes[id].revisar.push(`También tiene ${rs.length} ${rs.length === 1 ? 'línea' : 'líneas'} en ${r0._hoja}`);
      aviso(r0._hoja, r0._fila, `La orden N° ${n} tiene líneas en el detalle actual y en el histórico: se guardaron las dos para revisar.`);
      return;
    }
    const ls = rs.map(linea), fecha = dia(r0.fecha), folio = pendiente(r0.folio) ? null : texto(r0.folio);
    aviso(r0._hoja, r0._fila, `La orden N° ${n} tiene ${ls.length} ${ls.length === 1 ? 'línea' : 'líneas'} en el detalle pero no está en el resumen: se copió con los totales del detalle.`);
    docs.ordenes[id] = {
      n, fecha, mes: fecha.slice(0, 7), cliente: texto(r0.cliente), clienteId: clienteId(r0.cliente), lineas: ls,
      neto: ls.reduce((s, l) => s + l.neto, 0), iva: ls.reduce((s, l) => s + l.iva, 0), total: ls.reduce((s, l) => s + l.total, 0),
      estadoPago: texto(r0.estadoPago).toUpperCase() || 'PENDIENTE', fechaPago: pendiente(r0.fechaPago) ? null : (dia(r0.fechaPago) || texto(r0.fechaPago)),
      folio, sinFolio: !folio, fechaFolio: dia(r0.fechaFolio) || null, obs: texto(r0.obs), archivada: r0._arch, estado: 'activa', extra: {},
      revisar: ['No está en el resumen (solo en el detalle)'], soloDetalle: true, origen: { hoja: r0._hoja, fila: r0._fila }, quitadoEnPlanilla: false
    };
  });
  if (repetidas.length) {
    const porHoja = {};
    repetidas.forEach(r => { (porHoja[r.hoja] = porHoja[r.hoja] || []).push(r); });
    Object.entries(porHoja).forEach(([hoja, l]) => {
      const filas = l.reduce((s, r) => s + r.filas.length, 0);
      aviso(hoja, null, `${l.length} órdenes ya archivadas siguen también aquí, con las mismas líneas (${filas} filas, N° ${Math.min(...l.map(r => r.n))} a ${Math.max(...l.map(r => r.n))}). Es un archivado que copió al histórico pero no alcanzó a borrar. Se copió una sola vez y no queda para revisar.`);
    });
  }
  Object.values(docs.ordenes).forEach(o => {
    totalPlanilla.ordenes++; totalPlanilla.total += o.total; totalPlanilla.neto += o.neto;
    totalPlanilla.lineas += o.lineas.length; totalPlanilla.totalLineas += o.lineas.reduce((s, l) => s + l.total, 0);
    if (o.archivada) totalPlanilla.archivadas++;
    if (o.sinFolio) totalPlanilla.sinFolio++;
  });

  // Abonos y ediciones: no tienen número propio; el id sale de su contenido (+ cuántas veces se repite)
  const vecesA = {};
  let abonosMonto = 0;
  filas(hojas['Abonos'], C_ABONO).forEach(r => {
    if (!texto(r.folio) && !numero(r.monto)) return;
    const base = 'a-' + huella([texto(r.folio), dia(r.fecha) || texto(r.fecha), numero(r.monto), texto(r.referencia)].join('|'));
    vecesA[base] = (vecesA[base] || 0) + 1;
    const id = vecesA[base] > 1 ? `${base}-${vecesA[base]}` : base;
    if (!texto(r.folio)) aviso('Abonos', r._fila, 'Abono sin folio: se copió igual.');
    docs.abonos[id] = { folio: texto(r.folio), fecha: dia(r.fecha) || texto(r.fecha) || null, monto: numero(r.monto), referencia: texto(r.referencia), extra: r.extra, origen: { hoja: 'Abonos', fila: r._fila }, quitadoEnPlanilla: false };
    abonosMonto += numero(r.monto);
  });
  const vecesE = {};
  filas(hojas['Ediciones_ordenes'], C_EDICION).forEach(r => {
    const n = nDe(r.n); if (!n) return;
    const base = 'e-' + huella([n, texto(r.fecha), texto(r.motivo), texto(r.resumen), texto(r.cambios)].join('|'));
    vecesE[base] = (vecesE[base] || 0) + 1;
    const id = vecesE[base] > 1 ? `${base}-${vecesE[base]}` : base;
    docs.ediciones[id] = { n, fecha: texto(r.fecha), motivo: texto(r.motivo), resumen: texto(r.resumen), cambios: texto(r.cambios).slice(0, 20000), extra: r.extra, origen: { hoja: 'Ediciones_ordenes', fila: r._fila }, quitadoEnPlanilla: false };
  });

  const planilla = {
    clientes: Object.keys(docs.clientes).length, productos: Object.keys(docs.productos).length,
    precios: Object.values(docs.clientes).reduce((s, c) => s + c.precios.length, 0), preciosSinCliente,
    ...totalPlanilla, abonos: Object.keys(docs.abonos).length, abonosMonto, ediciones: Object.keys(docs.ediciones).length,
    revisar: Object.values(docs.ordenes).filter(o => o.revisar.length).length,
    detalleRepetido: repetidas.length, filasRepetidas: repetidas.reduce((s, r) => s + r.filas.length, 0)
  };
  return { docs, avisos, planilla };
}

// ── Qué cambia respecto de la última copia ─────────
// previas: { coleccion: { id: huella } } (lo que quedó anotado en la última copia)
// → por colección: escribir (nuevos o cambiados), quitar (ya no están en la planilla), iguales
export function cambios(docs, previas) {
  const r = {};
  COLECCIONES.forEach(col => {
    const ant = (previas && previas[col]) || {}, act = docs[col] || {};
    const huellas = {}, nuevos = [], cambiados = [], quitar = [];
    Object.keys(act).forEach(id => {
      const { origen, ...sinOrigen } = act[id];   // la fila de la planilla no cuenta: cambia al archivar u ordenar
      const h = huella(estable(sinOrigen)); huellas[id] = h;
      if (!(id in ant)) nuevos.push(id);
      else if (ant[id] !== h) cambiados.push(id);   // también si volvió después de quitarse
    });
    Object.keys(ant).forEach(id => { if (!(id in act)) { huellas[id] = 'quitado'; if (ant[id] !== 'quitado') quitar.push(id); } });
    r[col] = { nuevos, cambiados, quitar, iguales: Object.keys(act).length - nuevos.length - cambiados.length, huellas };
  });
  return r;
}

// ── Uso estimado de la app de logística (v0.12) ────
// Al abrirla lee: clientes + productos + órdenes de los últimos 14 días + las sin folio más antiguas.
export function usoEstimado(docs, hoy, aperturasDia = 10) {
  const desde = new Date(new Date(hoy + 'T12:00:00').getTime() - 14 * 864e5).toISOString().slice(0, 10);
  const ord = Object.values(docs.ordenes).filter(o => !o.archivada && (o.fecha >= desde || o.sinFolio)).length;
  const porApertura = Object.keys(docs.clientes).length + Object.keys(docs.productos).length + ord;
  const ordenesDia = (() => {
    const d30 = new Date(new Date(hoy + 'T12:00:00').getTime() - 30 * 864e5).toISOString().slice(0, 10);
    return Math.max(1, Math.round(Object.values(docs.ordenes).filter(o => o.fecha >= d30 && o.fecha <= hoy).length / 30));
  })();
  const lecturasDia = porApertura * aperturasDia + ordenesDia * 20;   // + cambios que llegan a los equipos abiertos
  return { porApertura, ordenesRecientes: ord, aperturasDia, ordenesDia, lecturasDia, escriturasDia: ordenesDia * 3, limiteLecturas: 50000, limiteEscrituras: 20000 };
}
