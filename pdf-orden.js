// ═══════════════════════════════════════════════
//  Sistema Fën — PDF de la orden de venta (el mismo de la app de logística)  v0.12.2
//  El mismo formato de la app B2B. Las librerías (html2canvas y jsPDF) se cargan
//  desde cdnjs solo la primera vez que se pide un PDF.
// ═══════════════════════════════════════════════
const CDN = { h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' };
const cargados = {};
function script(url) {
  if (!cargados[url]) cargados[url] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = url; s.onload = ok;
    s.onerror = () => { delete cargados[url]; no(new Error('No se pudo cargar el generador de PDF (revisa internet).')); };
    document.head.appendChild(s);
  });
  return cargados[url];
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clp = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaES = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : (f || ''); };

// orden: { n, fecha, lineas, neto, iva, total, obs, folio, estadoPago }, cliente: { nombre, razonSocial, rut, direccion }
// originales: { producto: cantidad antes de editar } · ediciones: [{ fecha, motivo, resumen }]
export function html(orden, cliente, originales = {}, ediciones = []) {
  const E = (window.FEN_LOG || window.FEN_SIS).DATOS_EMPRESA;
  const num = String(orden.n).padStart(4, '0');
  // El cambio se compara por producto (total de sus líneas) y se muestra una vez, en su primera línea
  const ahora = {}, vistos = new Set();
  (orden.lineas || []).forEach(l => { ahora[l.producto] = (ahora[l.producto] || 0) + l.cantidad; });
  const marca = (antes, despues) => {
    if (typeof antes === 'undefined' || antes === despues) return null;
    return { cant: `<span style="text-decoration:line-through;color:#999">${antes}</span> &rarr; <strong>${despues}</strong>`,
      nota: `<div style="font-size:9px;color:${despues < antes ? '#c0392b' : '#1D9E75'};margin-top:2px">&#8618; ${despues < antes ? 'Devuelto' : 'Agregado'}: ${Math.abs(antes - despues)} unid.</div>` };
  };
  const filas = (orden.lineas || []).map(l => {
    const primera = !vistos.has(l.producto); vistos.add(l.producto);
    const unica = (orden.lineas || []).filter(x => x.producto === l.producto).length === 1;
    const m = primera ? marca(originales[l.producto], ahora[l.producto]) : null;
    const cant = m ? (unica ? m.cant : `${l.cantidad}`) : l.cantidad;
    return `<tr><td>${esc(l.producto)}${m ? m.nota : ''}</td><td style="text-align:center">${cant}</td><td style="text-align:right">${clp(l.precio)}</td><td style="text-align:right">${clp(l.neto)}</td></tr>`;
  }).join('') + Object.keys(originales).filter(p => !(p in ahora) && originales[p] > 0).map(p =>
    `<tr><td style="color:#999">${esc(p)}<div style="font-size:9px;color:#c0392b;margin-top:2px">&#8618; Devuelto: ${originales[p]} unid.</div></td><td style="text-align:center"><span style="text-decoration:line-through;color:#999">${originales[p]}</span> &rarr; <strong>0</strong></td><td></td><td style="text-align:right">$0</td></tr>`).join('');
  const anulada = orden.estado === 'anulada', an = orden.anulada || {};
  return `<div class="od${anulada ? ' od-anulada' : ''}">
  ${anulada ? `<div class="od-sello" aria-hidden="true">ANULADA</div><div class="od-franja">ORDEN ANULADA${an.en ? ' el ' + esc(an.en) : ''}${an.motivo ? ' · ' + esc(an.motivo) : ''} — no vale como pedido</div>` : ''}
  <div class="od-cab"><img class="od-logo" src="logo-orden.png" alt="Fën">
    <div class="od-tit"><div class="od-t1">Orden de Venta</div><div class="od-t2">N° ${num}</div><div class="od-info">${esc(E.direccion)}<br>${esc(E.telefono)}<br>${esc(E.correo)}</div></div></div>
  <hr class="od-hr">
  <div class="od-dos">
    <div class="od-caja"><div class="od-et">Cliente</div><div class="od-val"><strong>${esc(cliente.nombre || orden.cliente || '—')}</strong><br>${esc(cliente.razonSocial || '')}<br>RUT: ${esc(cliente.rut || '—')}<br>${esc(cliente.direccion || '')}</div></div>
    <div class="od-caja"><div class="od-et">Detalle</div><div class="od-val"><strong>Fecha:</strong> ${esc(fechaES(orden.fecha))}<br><strong>Estado:</strong> ${anulada ? '<span style="color:#c0392b;font-weight:800">ANULADA</span>' : esc(orden.estadoPago || 'PENDIENTE')}<br><strong>Folio SII:</strong> ${esc(orden.folio || 'Pendiente')}</div></div>
  </div>
  ${orden.obs ? `<div class="od-notas"><strong>Notas:</strong> ${esc(orden.obs)}</div>` : ''}
  <table class="od-tabla"><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Neto Unit.</th><th style="text-align:right">Neto Total</th></tr></thead><tbody>${filas}</tbody></table>
  <div class="od-tot"><div class="od-tr"><span>Neto</span><span>${clp(orden.neto)}</span></div><div class="od-tr"><span>IVA (19%)</span><span>${clp(orden.iva)}</span></div><div class="od-total"><span>TOTAL</span><span>${clp(orden.total)}</span></div></div>
  ${ediciones.length ? `<div class="od-hist"><div class="od-et">Historial de ediciones</div>${ediciones.map(e => `<div class="od-ed"><div style="color:#8a9bb0;font-size:10px">${esc(e.fecha)}</div><div style="font-style:italic;margin:2px 0">"${esc(e.motivo)}"</div><div style="white-space:pre-line;color:#666">${esc(e.resumen)}</div></div>`).join('')}</div>` : ''}
  <div class="od-pie"><span><strong>FËN</strong> · PANADERÍA MASA MADRE · CAFETERÍA</span><span>${esc(E.web)}</span></div>
  <p class="od-nota">Documento interno de pedido — no válido como comprobante tributario.</p>
</div>`;
}
const CSS = `.od{width:720px;padding:40px 48px;background:#fff;color:#1a1a2e;font-family:'Arial Narrow',Arial,sans-serif;box-sizing:border-box}
.od *{box-sizing:border-box}.od-cab{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.od-logo{width:110px;height:auto}
.od-tit{text-align:right}.od-t1{font-size:26px;font-weight:900;color:#003a79;letter-spacing:2px;text-transform:uppercase}.od-t2{font-size:20px;font-weight:700;color:#003a79;margin-top:2px}
.od-info{font-size:12px;color:#555;margin-top:6px;line-height:1.9;font-family:Arial,sans-serif}.od-hr{border:none;border-top:2px solid #003a79;margin:18px 0}
.od-dos{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}.od-caja{border:1px solid #dde4ef;border-radius:6px;padding:14px 16px;background:#fafbff}
.od-et{font-size:9px;font-weight:800;color:#003a79;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}.od-val{font-size:13px;color:#222;line-height:1.85;font-family:Arial,sans-serif}
.od-val strong{font-size:15px}.od-tabla{width:100%;border-collapse:collapse;margin-bottom:16px}
.od-tabla th{background:#003a79;padding:10px 12px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;text-align:left}
.od-tabla td{padding:11px 12px;font-size:13px;font-family:Arial,sans-serif;border-bottom:1px solid #eef0f5}
.od-tot{width:230px;margin-left:auto;margin-top:4px}.od-tr{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#444;font-family:Arial,sans-serif}
.od-total{display:flex;justify-content:space-between;font-size:20px;font-weight:900;color:#003a79;border-top:2px solid #003a79;padding-top:9px;margin-top:6px}
.od-notas{background:#f5f7ff;border-left:3px solid #003a79;padding:10px 14px;margin-bottom:16px;font-size:12px;font-family:Arial,sans-serif;color:#444}
.od-hist{margin-top:22px}.od-ed{background:#f7f9fc;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:11px;font-family:Arial,sans-serif;color:#444}
.od-pie{display:flex;justify-content:space-between;font-size:10px;color:#777;margin-top:32px;border-top:1px solid #e0e0e0;padding-top:14px;font-family:Arial,sans-serif;letter-spacing:.5px}
.od-pie strong{color:#003a79}
.od-anulada{position:relative;overflow:hidden}.od-sello{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-30deg);font-size:150px;font-weight:900;letter-spacing:12px;color:rgba(192,57,43,.22);border:12px solid rgba(192,57,43,.22);padding:0 30px;border-radius:24px;white-space:nowrap;pointer-events:none;z-index:2;font-family:Arial,sans-serif}
.od-franja{background:#c0392b;color:#fff;font-family:Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;text-align:center;padding:9px 12px;border-radius:6px;margin-bottom:18px}.od-nota{font-size:10px;color:#999;margin-top:18px;text-align:center;font-family:Arial,sans-serif}`;

// Arma el PDF (tamaño carta) y lo descarga. Si el contenido es más alto que una hoja, sigue en la siguiente.
// abrir: true → se muestra en otra pestaña (para revisar) en vez de descargarse
// Pasa un bloque HTML (.od) a PDF tamaño carta. Si no cabe en una hoja, corta entre filas de tabla.
async function aPdf(htmlInterno, nombre, ventana, css = CSS) {
  await Promise.all([script(CDN.h2c), script(CDN.jspdf)]);
  const caja = document.createElement('div');
  caja.style.cssText = 'position:absolute;top:0;left:-99999px;width:720px;z-index:-1';
  caja.innerHTML = `<style>${css}</style>` + htmlInterno;
  document.body.appendChild(caja);
  try {
    const img = caja.querySelector('.od-logo');
    if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000); });
    const raiz = caja.querySelector('.od'), base = raiz.getBoundingClientRect().top;
    const cortes = [...raiz.querySelectorAll('tr, h3, .od-bloque')].map(e => Math.round((e.getBoundingClientRect().bottom - base) * 2)).sort((a, b) => a - b);
    const canvas = await window.html2canvas(raiz, { scale: 2, backgroundColor: '#ffffff', width: 720, windowWidth: 720 });
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
    const margen = 36, anchoUtil = 612 - margen * 2, altoUtil = 792 - margen * 2;
    let escala = anchoUtil / canvas.width;
    // Si se pasa por poco de una hoja, se achica un poco para que quepa en una (sin hoja en blanco)
    if (canvas.height * escala > altoUtil && canvas.height * escala <= altoUtil * 1.3) escala = altoUtil / canvas.height;
    const altoFranja = Math.max(50, Math.floor(altoUtil / escala));
    for (let y = 0, pag = 0; y < canvas.height; pag++) {
      let fin = Math.min(y + altoFranja, canvas.height);
      if (fin < canvas.height) { const c = cortes.filter(x => x > y + 100 && x <= fin).pop(); if (c) fin = c; }
      const alto = fin - y;
      if (pag && alto < 40) break;   // un resto mínimo (solo margen) no hace otra hoja
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = alto;
      c.getContext('2d').drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto);
      if (pag) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', margen + (anchoUtil - canvas.width * escala) / 2, margen, canvas.width * escala, alto * escala);
      y = fin;
    }
    if (ventana) { ventana.location.href = pdf.output('bloburl'); return nombre; }
    pdf.save(nombre);
    return nombre;
  } catch (e) { if (ventana) ventana.close(); throw e; }
  finally { caja.remove(); }
}
export async function descargar(orden, cliente, originales, ediciones, abrir) {
  const ventana = abrir ? window.open('', '_blank') : null;
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px">Generando el PDF…</p>');
  const nombre = (orden.estado === 'anulada' ? 'ANULADA_' : '') + 'Orden_' + String(orden.n).padStart(4, '0') + '_' + String(cliente.nombre || orden.cliente || 'cliente').replace(/[^a-zA-Z0-9]+/g, '_') + '.pdf';
  return aPdf(html(orden, cliente, originales || {}, ediciones || []), nombre, ventana);
}

// ── Estado de cuenta (el mismo formato de la app B2B) ──
const fechaCortaEC = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(f || '—'); };
export function htmlEstadoCuenta(cliente, r, desde, hasta, modo) {
  const E = (window.FEN_LOG || window.FEN_SIS).DATOS_EMPRESA;
  const periodo = (desde || hasta) ? `${desde ? 'Desde ' + fechaCortaEC(desde) : ''}${desde && hasta ? ' al ' : ''}${hasta ? (desde ? '' : 'Hasta ') + fechaCortaEC(hasta) : ''}` : 'Todo el período';
  const c1 = modo === 'folio' ? 'Folio SII' : 'N° Orden', c2 = modo === 'folio' ? 'Órdenes' : 'Folio SII';
  const tabla = (lista, titulo, color) => !lista.length ? '' : `<h3 style="font-size:13px;font-weight:800;color:${color};margin:18px 0 8px;text-transform:uppercase;letter-spacing:1px">${titulo}</h3>
    <table class="od-tabla"><thead><tr><th>${c1}</th><th>Fecha</th><th>${c2}</th><th style="text-align:right">Neto</th><th style="text-align:right">Total</th><th>Fecha pago</th></tr></thead><tbody>
    ${lista.map(f => `<tr${f.estado === 'PARCIAL' ? ' style="color:#9a5b00"' : ''}><td>${esc(f.principal)}</td><td>${fechaCortaEC(f.fecha)}</td><td>${esc(f.secundaria)}</td><td style="text-align:right">${clp(f.neto)}</td>
      <td style="text-align:right;font-weight:700">${f.estado === 'PARCIAL' ? `<span style="font-size:10px;color:#999;text-decoration:line-through">${clp(f.total)}</span><br><span style="color:#c0392b">${clp(f.saldo)}</span>` : clp(f.total)}</td><td>${f.estado === 'PAGADO' ? fechaCortaEC(f.fechaPago) : '—'}</td></tr>
      ${f.estado === 'PARCIAL' && f.abonado > 0 ? `<tr><td colspan="6" style="padding:0 12px 8px;font-size:10px;color:#9a5b00">Abonado: ${clp(f.abonado)}${f.ultimoAbono ? ' el ' + fechaCortaEC(f.ultimoAbono) : ''}</td></tr>` : ''}`).join('')}</tbody></table>`;
  const hoyTxt = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })();
  return `<div class="od">
  <div class="od-cab"><img class="od-logo" src="logo-orden.png" alt="Fën"><div class="od-tit"><div class="od-t1">Estado de Cuenta</div><div class="od-info">${esc(periodo)}<br>${esc(E.direccion)} · ${esc(E.correo)}</div></div></div>
  <hr class="od-hr">
  <div class="od-dos">
    <div class="od-caja"><div class="od-et">Cliente</div><div class="od-val"><strong>${esc(cliente.nombre)}</strong><br>${esc(cliente.razonSocial || '')}<br>RUT: ${esc(cliente.rut || '—')}<br>${esc(cliente.direccion || '')}</div></div>
    <div class="od-caja"><div class="od-et">Resumen</div><div class="od-val"><strong>Período:</strong> ${esc(periodo)}<br><strong>N° de órdenes:</strong> ${r.n}<br><strong>Generado:</strong> ${hoyTxt}</div></div>
  </div>
  <div class="od-bloque" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">
    <div style="text-align:center;border-radius:8px;padding:14px;border:1px solid #dde4ef;background:#f0f7ff"><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Total comprado</div><div style="font-size:20px;font-weight:900;color:#003a79">${clp(r.comprado)}</div></div>
    <div style="text-align:center;border-radius:8px;padding:14px;border:1px solid #dde4ef;background:#f0fff4"><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Total pagado</div><div style="font-size:20px;font-weight:900;color:#1D9E75">${clp(r.pagado)}</div></div>
    <div style="text-align:center;border-radius:8px;padding:14px;border:1px solid #dde4ef;background:#fff5f5"><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Pendiente de pago</div><div style="font-size:20px;font-weight:900;color:#c0392b">${clp(r.pendiente)}</div></div>
  </div>
  ${tabla(r.filas.filter(f => f.estado !== 'PAGADO'), 'Pendientes de pago', '#c0392b')}
  ${tabla(r.filas.filter(f => f.estado === 'PAGADO'), 'Pagadas', '#1D9E75')}
  <div class="od-pie"><span><strong>FËN</strong> · PANADERÍA MASA MADRE · CAFETERÍA</span><span>${esc(E.web)}</span></div>
</div>`;
}
export async function estadoCuenta(cliente, r, desde, hasta, modo) {
  if (r.filas.length > 400) throw new Error(`Son ${r.filas.length} filas: acota las fechas para que el PDF no quede tan largo.`);
  const hoy = new Date(), f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return aPdf(htmlEstadoCuenta(cliente, r, desde, hasta, modo), `EstadoCuenta_${String(cliente.nombre).replace(/[^a-zA-Z0-9]+/g, '_')}_${f}.pdf`, null);
}
