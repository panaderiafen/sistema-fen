// ═══════════════════════════════════════════════
//  Sistema Fën — Proveedores: quién es el destinatario de un cargo y qué le compras  v0.64.0 (reglas puras, sin red)
//  · De la glosa del cargo: "TEF A RUT 77718322-2" (el RUT, con su dígito verificador), "TEF A <NOMBRE>", "TRANSF A <NOMBRE>".
//    Con la transferencia enviada (tef-enviadas.js) se usa su RUT y su nombre completo.
//  · La ficha proveedores/{rut} (armada desde el SII: razón social, líneas de gasto `filas` y productos `prods`) dice qué le
//    compras (productos del detalle del SII y los ítems de gasto de siempre) y sus últimas facturas.
//  · Fichas a mano (sin factura: el maestro, el de los huevos): proveedores/pm-… { manual, nombre, rut opcional, glosas,
//    item, area }. También una ficha del SII puede llevar glosas, item y area puestos a mano.
//  · Lo aprendido: la glosa del cargo (normalizada, sin números largos) queda en `glosas` de la ficha al confirmar.
//  Todo se calcula con las fichas ya en memoria: nunca una lectura por cargo.
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v);
export const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const rutNorm = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');
const dv = n => { let x = 0, m = 2; const t = s(n); for (let i = t.length - 1; i >= 0; i--) { x += Number(t[i]) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (x % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };
export const rutValido = r => { const x = rutNorm(r); return x.length >= 8 && dv(x.slice(0, -1)) === x.slice(-1); };
export const rutTexto = r => { const x = rutNorm(r); if (x.length < 2) return s(r); return x.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + x.slice(-1); };
const fmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const dma = f => (/^\d{4}-\d{2}-\d{2}/.test(s(f)) ? s(f).slice(8, 10) + '-' + s(f).slice(5, 7) : s(f));

// La clave de una glosa (la misma idea que lo aprendido de la cartola): mayúsculas, sin tildes, números largos fuera
export const claveGlosa = desc => norm(desc).replace(/\d{5,}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
// Palabras que no dicen quién es
const RELLENO = new Set(['TEF', 'A', 'DE', 'RUT', 'TRANSF', 'TRANSFERENCIA', 'PAGO', 'BANCOESTADO', 'BCO', 'CTA', 'CTE', 'OTROS', 'BANCOS', 'EN', 'LINEA', 'INTERNET', 'N', 'NRO']);
// Lo que dice la glosa: { rut, nombre }. "TEF A RUT 77718322-2" → rut; "TEF A JUAN PEREZ" / "TRANSF A PANIFICADORA SUR" → nombre
export function deGlosa(desc) {
  const t = s(desc);
  let rut = '';
  const re = /(?:^|[^0-9])(\d{1,2}\.?\d{3}\.?\d{3})-?([0-9kK])(?![0-9])/g; let m;
  while ((m = re.exec(t))) { const x = m[1].replace(/\./g, '') + m[2].toUpperCase(); if (rutValido(x)) { rut = x; break; } }
  const n = norm(t);
  const mm = /^(?:TEF|TRANSF(?:ERENCIA)?|PAGO)(?: (?:BANCOESTADO|ELECTRONICA|EN LINEA))?(?: A| DE PAGO A)? (.+)$/.exec(n);
  let nombre = '';
  if (mm) nombre = mm[1].split(' ').filter(w => !RELLENO.has(w) && !/\d/.test(w)).join(' ').trim();
  return { rut, nombre: nombre.length >= 4 ? nombre : '' };
}
// ¿La glosa trae poca información? (la cartola en línea corta todo: "TEF A", "TRANSF A 1234…")
export function glosaPobre(desc) {
  const g = deGlosa(desc);
  if (g.rut) return false;
  const palabras = norm(desc).split(' ').filter(w => w.length >= 3 && !RELLENO.has(w) && !/\d/.test(w));
  return palabras.length < 2 || norm(desc).length < 14;
}
// Vista de una ficha (proveedores/{id})
export function vistaFicha(id, d) {
  const x = d || {};
  const rut = rutNorm(x.rut || (/^\d+[0-9K]$/.test(id) ? id : ''));
  return { id, rut, rutTexto: rut ? rutTexto(rut) : s(x.rutTexto), nombre: s(x.nombre || x.razonSocial), razonSocial: s(x.razonSocial),
    manual: x.manual === true, glosas: Array.isArray(x.glosas) ? x.glosas.map(s) : [], item: s(x.item), area: s(x.area), ultima: s(x.ultima), primera: s(x.primera),
    filas: Array.isArray(x.filas) ? x.filas : [], prods: Array.isArray(x.prods) ? x.prods : [], archivado: x.archivado === true, version: Number(x.version) || 0 };
}
// Lo que le compras: los productos más comprados (detalle del SII) y los ítems de gasto de siempre
export function loQueLeCompras(f, max = 3) {
  const cuenta = (l, k) => { const m = {}; l.forEach(x => { const v = s(x[k]).trim(); if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([v]) => v); };
  const productos = cuenta(f.prods || [], 'd').map(x => x.charAt(0).toUpperCase() + x.slice(1));
  const items = cuenta(f.filas || [], 'it');
  if (f.item && !items.includes(f.item)) items.unshift(f.item);
  return { productos, items: items.slice(0, max) };
}
// Sus últimas facturas (de las líneas de gasto): [{ folio, fecha, total }]
export function ultimasFacturas(f, max = 3) {
  const m = {};
  (f.filas || []).forEach(x => { const k = s(x.fo) || s(x.f); if (!k) return; const y = m[k] || (m[k] = { folio: s(x.fo), fecha: s(x.f), total: 0 }); y.total += Number(x.m) || 0; if (s(x.f) > y.fecha) y.fecha = s(x.f); });
  return Object.values(m).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, max);
}
// "Proveedor · le compras: harina, levadura · últimas facturas: F.123 (12-10) $45.000 · …"
export function resumen(f) {
  if (!f) return '';
  const q = loQueLeCompras(f), u = ultimasFacturas(f, 2);
  const que = q.productos.length ? q.productos.join(', ') : q.items.join(', ');
  return [f.nombre || f.razonSocial || 'Proveedor', que ? 'le compras: ' + que.toLowerCase() : '', u.length ? 'últimas facturas: ' + u.map(x => `${x.folio ? 'F.' + x.folio + ' ' : ''}(${dma(x.fecha)}) ${fmt(x.total)}`).join(' · ') : (f.manual ? 'sin factura' : '')].filter(Boolean).join(' · ');
}
// El proveedor de un cargo, con lo que haya: el RUT (de la transferencia enviada o de la glosa), lo aprendido de la glosa o el
// nombre (una sola ficha que calce con 2 palabras, o con la única palabra propia de 5+ letras). fichas: vistaFicha[].
// Devuelve { ficha, por: 'rut'|'glosa'|'nombre' } o null.
const GENERICAS = new Set(['SOCIEDAD', 'COMERCIAL', 'COMERCIALIZADORA', 'EMPRESA', 'EMPRESAS', 'LIMITADA', 'LTDA', 'CHILE', 'SERVICIOS', 'INVERSIONES', 'DISTRIBUIDORA', 'ALIMENTOS', 'INDUSTRIAL', 'COMPANIA', 'IMPORTADORA', 'SPA', 'EIRL']);
export function buscar(fichas, { rut, nombre, descripcion } = {}) {
  const L = (fichas || []).filter(f => !f.archivado);
  const r = rutNorm(rut) || deGlosa(descripcion).rut;
  if (r) { const f = L.find(x => x.rut === r); if (f) return { ficha: f, por: 'rut' }; }
  const k = descripcion ? claveGlosa(descripcion) : '';
  if (k) { const l = L.filter(f => f.glosas.includes(k)); if (l.length === 1) return { ficha: l[0], por: 'glosa' }; }
  const n = norm(nombre || deGlosa(descripcion).nombre);
  if (n.length >= 4) {
    const pal = n.split(' ').filter(w => w.length >= 4 && !GENERICAS.has(w));
    if (pal.length) {
      const l = L.filter(f => { const fx = ' ' + norm(f.nombre + ' ' + f.razonSocial) + ' '; const c = pal.filter(w => fx.includes(' ' + w)).length; return c >= Math.min(2, pal.length); });
      if (l.length === 1) return { ficha: l[0], por: 'nombre' };
    }
  }
  return null;
}
// Id de una ficha a mano: el RUT si lo tiene (se junta con la del SII); si no, pm-<letras del nombre>
export const idFicha = (rut, nombre) => (rutValido(rut) ? rutNorm(rut) : 'pm-' + norm(nombre).replace(/ /g, '-').slice(0, 60));
// Revisa una ficha a mano: { error } | { campos }
export function limpiarFicha(p, items, areas) {
  const nombre = s(p.nombre).replace(/[\u0000-\u001f]/g, '').trim().replace(/^[=+\-@\s]+/, '').slice(0, 80);
  if (nombre.length < 3) return { error: 'Escribe el nombre del proveedor' };
  const rut = s(p.rut).trim();
  if (rut && !rutValido(rut)) return { error: 'El RUT no es válido (revisa el dígito verificador)' };
  const glosas = [...new Set((Array.isArray(p.glosas) ? p.glosas : s(p.glosas).split(/\n|;/)).map(claveGlosa).filter(x => x.length >= 4))].slice(0, 12);
  const item = s(p.item).trim();
  if (item && items && !items.includes(item)) return { error: 'Ese ítem no existe' };
  const area = s(p.area).trim();
  if (area && areas && !areas.includes(area)) return { error: 'Área no válida' };
  return { campos: { nombre, rut: rut ? rutNorm(rut) : '', rutTexto: rut ? rutTexto(rut) : '', glosas, item, area, manual: true } };
}
// Las facturas pendientes de ese proveedor primero (en "Paga vencimientos"): orden estable
export const primeroDelProveedor = (vencs, rut) => (vencs || []).map((v, i) => ({ v, i })).sort((a, b) => ((rut && b.v.rut === rut) - (rut && a.v.rut === rut)) || a.i - b.i).map(x => x.v);
