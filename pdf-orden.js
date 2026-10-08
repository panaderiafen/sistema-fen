// ═══════════════════════════════════════════════
//  Sistema Fën — PDF de la orden de venta (el mismo de la app de logística)  v0.15.2 (diseño compacto)
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

// v0.15.2 · Diseño compacto (elegido el 7-oct): total grande arriba, productos en un recuadro, lectura fácil en el celular
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaLarga = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); if (!m) return f || ''; const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); const t = `${DIAS[d.getDay()]} ${fechaES(f)}`; return t.charAt(0).toUpperCase() + t.slice(1); };
const fechaCorta = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1].slice(0, 3)}` : esc(f || '—'); };
const pieEmpresa = E => `Fën · ${esc(E.direccion)} · ${esc(E.telefono)} · ${esc(E.correo)} · panaderiafen.cl`;
const cabecera = (titulo, sub) => `<div class="od-cab"><img class="od-logo" src="logo-orden.png" alt="Fën"><div><div class="od-t1">${titulo}</div><div class="od-t2">${sub}</div></div></div>`;
const banda = (etiqueta, valor, detalle) => `<div class="od-banda od-bloque"><div><div class="od-banda-et">${etiqueta}</div><div class="od-banda-v">${valor}</div></div><div class="od-banda-d">${detalle}</div></div>`;
const fila = (nombre, sub, valor, clase = '') => `<div class="od-fila od-bloque ${clase}"><div><div class="od-fila-n">${nombre}</div>${sub ? `<div class="od-fila-s">${sub}</div>` : ''}</div><div class="od-fila-v">${valor}</div></div>`;
const caja = (izq, der, cuerpo) => `<div class="od-caja"><div class="od-caja-cab od-bloque"><span>${izq}</span><span>${der}</span></div>${cuerpo}</div>`;
const estadoPagoTxt = e => { const x = String(e || 'PENDIENTE').toUpperCase(); return x.includes('PAGADO') ? 'Pagada' : x === 'PARCIAL' ? 'Pago parcial' : 'Pago pendiente'; };

// orden: { n, fecha, lineas, neto, iva, total, obs, folio, estadoPago }, cliente: { nombre, razonSocial, rut, direccion }
// originales: { producto: cantidad antes de editar } · ediciones: [{ fecha, motivo, resumen }]
export function html(orden, cliente, originales = {}, ediciones = []) {
  const E = (window.FEN_LOG || window.FEN_SIS).DATOS_EMPRESA;
  const num = String(orden.n).padStart(4, '0');
  // El cambio se compara por producto (total de sus líneas) y se muestra una vez, en su primera línea
  const ahora = {}, vistos = new Set();
  (orden.lineas || []).forEach(l => { ahora[l.producto] = (ahora[l.producto] || 0) + l.cantidad; });
  const cambio = (antes, despues) => {
    if (typeof antes === 'undefined' || antes === despues) return '';
    const d = Math.abs(antes - despues);
    return ` · <span class="od-cambio">${antes === 1 ? 'era' : 'eran'} ${antes}, se ${despues < antes ? (d === 1 ? 'devolvió' : 'devolvieron') : (d === 1 ? 'agregó' : 'agregaron')} ${d}</span>`;
  };
  const filas = (orden.lineas || []).map(l => {
    const primera = !vistos.has(l.producto); vistos.add(l.producto);
    return fila(esc(l.producto), `${esc(l.cantidad)} × ${clp(l.precio)}${primera ? cambio(originales[l.producto], ahora[l.producto]) : ''}`, clp(l.neto));
  }).join('') + Object.keys(originales).filter(p => !(p in ahora) && originales[p] > 0).map(p =>
    fila(esc(p), `<span class="od-cambio">${originales[p] === 1 ? 'era 1, se devolvió' : `eran ${originales[p]}, se devolvieron todos`}</span>`, '$0', 'od-quitado')).join('');
  const nProd = new Set((orden.lineas || []).map(l => l.producto)).size;
  const anulada = orden.estado === 'anulada', an = orden.anulada || {};
  const cambios = ediciones.map(e => `${esc(e.fecha)}: ${esc(e.resumen).replace(/\n/g, '; ')}${e.motivo ? ` ("${esc(e.motivo)}")` : ''}`);
  const notas = [orden.obs ? esc(orden.obs) : ''].concat(cambios).filter(Boolean);
  return `<div class="od${anulada ? ' od-anulada' : ''}">
  ${anulada ? `<div class="od-sello" aria-hidden="true">ANULADA</div><div class="od-franja">ORDEN ANULADA${an.en ? ' el ' + esc(an.en) : ''}${an.motivo ? ' · ' + esc(an.motivo) : ''} — no vale como pedido</div>` : ''}
  ${cabecera(`Orden de venta N° ${num}`, `${esc(fechaLarga(orden.fecha))} · ${esc(cliente.nombre || orden.cliente || '—')}`)}
  ${banda('Total con IVA', clp(orden.total), `Neto ${clp(orden.neto)} · IVA ${clp(orden.iva)}<br>${orden.folio ? 'Folio SII ' + esc(orden.folio) : 'Folio SII pendiente'} · ${anulada ? '<b style="color:#b42318">Anulada</b>' : estadoPagoTxt(orden.estadoPago)}`)}
  ${caja(`${nProd} ${nProd === 1 ? 'producto' : 'productos'}`, 'Neto', filas || fila('Sin productos', '', ''))}
  <div class="od-info od-bloque"><div><b>Cliente</b>${esc(cliente.razonSocial || cliente.nombre || orden.cliente || '')}<br>RUT ${esc(cliente.rut || '—')}${cliente.direccion ? '<br>' + esc(cliente.direccion) : ''}</div>
    ${notas.length ? `<div><b>${orden.obs && cambios.length ? 'Notas y cambios' : orden.obs ? 'Notas' : 'Cambios'}</b>${notas.join('<br>')}</div>` : '<div></div>'}</div>
  <div class="od-pie od-bloque">${pieEmpresa(E)}<br>Documento interno de pedido. No es comprobante tributario.</div>
</div>`;
}
const CSS = `.od{width:720px;padding:44px 52px 36px;background:#fff;color:#171c22;font-family:Manrope,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums;box-sizing:border-box}
.od *{box-sizing:border-box}.od-cab{display:flex;align-items:center;gap:18px}.od-logo{width:76px;height:auto;flex:none}
.od-t1{font-size:22px;font-weight:800;line-height:1.15}.od-t2{font-size:14px;color:#4f5965;margin-top:4px}
.od-banda{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-top:26px;padding:18px 22px;border-radius:12px;background:#f1f4f8}
.od-banda-et{font-size:12px;font-weight:600;color:#4f5965}.od-banda-v{font-size:36px;font-weight:800;color:#0b3a75;line-height:1.1;margin-top:2px;white-space:nowrap}
.od-banda-d{text-align:right;font-size:13px;line-height:1.7;color:#4f5965}
.od-caja{margin-top:22px;border:1px solid #d5dbe3;border-radius:12px;padding:4px 20px 2px}.od-caja+.od-caja{margin-top:16px}
.od-caja-cab{display:flex;justify-content:space-between;gap:16px;padding:12px 0 8px;border-bottom:1px solid #d5dbe3;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4f5965}
.od-fila{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid #e4e8ee}.od-fila:last-child{border-bottom:0}
.od-fila-n{font-size:16px;font-weight:600}.od-fila-s{font-size:13px;color:#4f5965;margin-top:2px;line-height:1.5}.od-fila-v{font-size:16px;font-weight:600;white-space:nowrap}
.od-cambio{color:#8a4b00;font-weight:600}.od-quitado .od-fila-n{color:#8b939e;text-decoration:line-through}
.od-grupo{padding:10px 0;border-bottom:1px solid #e4e8ee}.od-grupo:last-child{border-bottom:0}
.od-grupo-cab{display:flex;justify-content:space-between;gap:16px;font-size:15px;font-weight:700}.od-grupo-l{display:flex;justify-content:space-between;gap:16px;font-size:13px;color:#4f5965;margin-top:3px}
.od-info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;margin-top:26px;font-size:13px;line-height:1.6;color:#4f5965}.od-info b{display:block;font-weight:700;color:#171c22}
.od-linea{margin-top:22px;font-size:13px;line-height:1.6;color:#4f5965}.od-linea b{font-weight:700;color:#171c22}
.od-pie{font-size:11px;line-height:1.6;color:#4f5965;border-top:1px solid #e4e8ee;padding-top:12px;margin-top:32px}
.od-anulada{position:relative;overflow:hidden}.od-sello{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-30deg);font-size:150px;font-weight:900;letter-spacing:12px;color:rgba(180,35,24,.2);border:12px solid rgba(180,35,24,.2);padding:0 30px;border-radius:24px;white-space:nowrap;pointer-events:none;z-index:2}
.od-franja{background:#b42318;color:#fff;font-size:13px;font-weight:700;letter-spacing:.5px;text-align:center;padding:9px 12px;border-radius:8px;margin-bottom:18px}`;
// La letra del PDF (Manrope, de Google Fonts) se carga una vez; si no hay internet, queda una parecida del equipo
let letraLista = null;
function cargarLetra() {
  if (!letraLista) letraLista = new Promise(ok => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap';
    const listo = () => Promise.all(['400', '600', '700', '800'].map(w => document.fonts.load(`${w} 16px Manrope`).catch(() => null))).then(ok, ok);
    l.onload = listo; l.onerror = () => ok(); setTimeout(ok, 4000);
    document.head.appendChild(l);
  });
  return letraLista;
}

// Arma el PDF (tamaño carta) y lo descarga. Si el contenido es más alto que una hoja, sigue en la siguiente.
// abrir: true → se muestra en otra pestaña (para revisar) en vez de descargarse
// Pasa uno o varios bloques HTML (.od) a un PDF tamaño carta. Cada bloque empieza en una hoja nueva;
// si un bloque no cabe en una hoja, se corta entre filas de tabla.
async function aPdf(bloques, nombre, ventana, css = CSS) {
  await Promise.all([script(CDN.h2c), script(CDN.jspdf), cargarLetra()]);
  const lista = Array.isArray(bloques) ? bloques : [bloques];
  const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const margen = 36, anchoUtil = 612 - margen * 2, altoUtil = 792 - margen * 2;
  let hojas = 0;
  try {
    for (const htmlInterno of lista) {
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
          if (hojas) pdf.addPage();
          pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', margen + (anchoUtil - canvas.width * escala) / 2, margen, canvas.width * escala, alto * escala);
          hojas++; y = fin;
        }
      } finally { caja.remove(); }
    }
    if (ventana) { ventana.location.href = pdf.output('bloburl'); return nombre; }
    pdf.save(nombre);
    return nombre;
  } catch (e) { if (ventana) ventana.close(); throw e; }
}
export async function descargar(orden, cliente, originales, ediciones, abrir) {
  const ventana = abrir ? window.open('', '_blank') : null;
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px">Generando el PDF…</p>');
  const nombre = (orden.estado === 'anulada' ? 'ANULADA_' : '') + 'Orden_' + String(orden.n).padStart(4, '0') + '_' + String(cliente.nombre || orden.cliente || 'cliente').replace(/[^a-zA-Z0-9]+/g, '_') + '.pdf';
  return aPdf(html(orden, cliente, originales || {}, ediciones || []), nombre, ventana);
}

// ── Estado de cuenta (v0.15.2: diseño compacto) ──
const fechaCortaEC = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(f || '—'); };
const listaN = t => { const l = String(t || '').split(/,\s*/).filter(Boolean); return l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l.join(''); };
export function htmlEstadoCuenta(cliente, r, desde, hasta, modo) {
  const E = (window.FEN_LOG || window.FEN_SIS).DATOS_EMPRESA;
  const periodo = (desde || hasta) ? `${desde ? 'Del ' + fechaES(desde) : ''}${desde && hasta ? ' al ' : ''}${hasta ? (desde ? '' : 'Hasta el ') + fechaES(hasta) : ''}`.replace(/^Del (\d+) de (\w+) de (\d+) al (\d+) de \2 de \3$/, 'Del $1 al $4 de $2 de $3') : 'Todo el período';
  const hoy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const porFolio = modo === 'folio';
  const nombre = f => porFolio ? (f.principal === 'Sin folio' ? `Orden N° ${esc(f.secundaria)}` : `Folio ${esc(f.principal)}`) : `Orden N° ${esc(f.principal)}`;
  const sub = f => {
    const partes = porFolio
      ? (f.principal === 'Sin folio' ? [`Pedido del ${fechaCorta(f.fecha)}`, 'sin factura todavía'] : [`Factura del ${fechaCorta(f.fecha)}`, `${String(f.secundaria).includes(',') ? 'órdenes' : 'orden'} N° ${esc(listaN(f.secundaria))}`])
      : [`Pedido del ${fechaCorta(f.fecha)}`, f.secundaria && f.secundaria !== 'Pendiente' ? `folio ${esc(f.secundaria)}` : 'sin factura todavía'];
    if (f.estado === 'PAGADO') partes.push(`pagada el ${fechaCorta(f.fechaPago)}`);
    else if (f.estado === 'PARCIAL') partes.push(`total ${clp(f.total)}`);
    return partes.join(' · ') + (f.estado === 'PARCIAL' && f.abonado > 0 ? `<br><span class="od-cambio">Abonado ${clp(f.abonado)}${f.ultimoAbono ? ' el ' + fechaCorta(f.ultimoAbono) : ''}</span>` : '');
  };
  const cuenta = l => { if (!porFolio) return `${l.length} ${l.length === 1 ? 'orden' : 'órdenes'}`; const sf = l.filter(f => f.principal === 'Sin folio').length, fa = l.length - sf;
    return [fa ? `${fa} ${fa === 1 ? 'factura' : 'facturas'}` : '', sf ? `${sf} ${sf === 1 ? 'orden' : 'órdenes'} sin factura` : ''].filter(Boolean).join(' y '); };
  const pend = r.filas.filter(f => f.estado !== 'PAGADO'), pag = r.filas.filter(f => f.estado === 'PAGADO').slice().reverse();
  return `<div class="od">
  ${cabecera(`Estado de cuenta · ${esc(cliente.nombre)}`, `${esc(periodo)} · generado el ${esc(fechaES(hoy))}`)}
  ${banda('Pendiente de pago', clp(r.pendiente), `Comprado ${clp(r.comprado)} · Pagado ${clp(r.pagado)}<br>${r.n} ${r.n === 1 ? 'orden' : 'órdenes'}`)}
  ${pend.length ? caja(`Por pagar · ${cuenta(pend)}`, 'Saldo', pend.map(f => fila(nombre(f), sub(f), clp(f.saldo))).join('')) : ''}
  ${pag.length ? caja(`Pagadas · ${cuenta(pag)}`, 'Total', pag.map(f => fila(nombre(f), sub(f), clp(f.total))).join('')) : ''}
  ${!r.filas.length ? caja('Sin órdenes en este período', '', '') : ''}
  <div class="od-linea od-bloque"><b>Cliente</b> · ${esc(cliente.razonSocial || cliente.nombre)} · RUT ${esc(cliente.rut || '—')}${cliente.direccion ? ' · ' + esc(cliente.direccion) : ''}</div>
  <div class="od-pie od-bloque">${pieEmpresa(E)}<br>Montos con IVA. Si ya pagaste algo de lo pendiente, avísanos y lo revisamos.</div>
</div>`;
}
export async function estadoCuenta(cliente, r, desde, hasta, modo) {
  if (r.filas.length > 400) throw new Error(`Son ${r.filas.length} filas: acota las fechas para que el PDF no quede tan largo.`);
  const hoy = new Date(), f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return aPdf(htmlEstadoCuenta(cliente, r, desde, hasta, modo), `EstadoCuenta_${String(cliente.nombre).replace(/[^a-zA-Z0-9]+/g, '_')}_${f}.pdf`, null);
}

// ── v0.14.2 · Varias órdenes en un PDF ──
const archivo = t => String(t || 'cliente').replace(/[^a-zA-Z0-9]+/g, '_');
const hoyArchivo = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Una hoja (o más) por orden, igual a la de cada orden. lista: [{ orden, cliente, originales, ediciones }]
export async function variasOrdenes(lista, abrir) {
  if (!lista.length) throw new Error('Marca al menos una orden.');
  const ventana = abrir ? window.open('', '_blank') : null;
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px">Generando el PDF…</p>');
  const ns = lista.map(x => x.orden.n).sort((a, b) => a - b);
  return aPdf(lista.map(x => html(x.orden, x.cliente, x.originales || {}, x.ediciones || [])), `Ordenes_${ns[0]}-${ns[ns.length - 1]}_${archivo(lista[0].cliente.nombre || lista[0].orden.cliente)}.pdf`, ventana);
}
const fechaDMY = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(f || '—'); };
export function htmlResumenOrdenes(ordenes, cliente) {
  const E = (window.FEN_LOG || window.FEN_SIS).DATOS_EMPRESA;
  const os = ordenes.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.n - b.n);
  const fs = os.map(o => o.fecha).filter(Boolean).sort();
  const periodo = !fs.length ? '' : fs[0] === fs[fs.length - 1] ? `Pedido del ${fechaES(fs[0])}` : `Pedidos del ${fechaES(fs[0])} al ${fechaES(fs[fs.length - 1])}`.replace(/del (\d+) de (\w+) de (\d+) al (\d+) de \2 de \3$/, 'del $1 al $4 de $2 de $3');
  const P = {};
  os.forEach(o => (o.lineas || []).forEach(l => { const k = l.producto; const p = P[k] || (P[k] = { producto: k, cantidad: 0, neto: 0, precios: new Set() }); p.cantidad += Number(l.cantidad) || 0; p.precios.add(Number(l.precio) || 0); p.neto += Number(l.neto) || Math.round((Number(l.cantidad) || 0) * (Number(l.precio) || 0)); }));
  const neto = os.reduce((s, o) => s + (Number(o.neto) || 0), 0), total = os.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const ns = os.map(o => o.n), folios = [...new Set(os.map(o => o.folio).filter(Boolean))];
  const lineaNeto = l => Number(l.neto) || (Number(l.cantidad) || 0) * (Number(l.precio) || 0);
  return `<div class="od">
  ${cabecera(`Resumen de ${os.length} ${os.length === 1 ? 'orden' : 'órdenes'} · ${esc(cliente.nombre)}`, `${esc(periodo)} · ${ns.length === 1 ? 'orden' : 'órdenes'} N° ${esc(listaN(ns.join(', ')))}`)}
  ${banda('Total con IVA', clp(total), `Neto ${clp(neto)} · IVA ${clp(total - neto)}<br>${folios.length ? 'Folio SII ' + esc(folios.join(', ')) : 'Folio SII pendiente'}`)}
  ${caja('Total por producto', 'Neto', Object.values(P).sort((a, b) => a.producto.localeCompare(b.producto, 'es')).map(p => fila(esc(p.producto), p.precios.size === 1 ? `${p.cantidad.toLocaleString('es-CL')} × ${clp([...p.precios][0])}` : `${p.cantidad.toLocaleString('es-CL')} unidades (con precios distintos)`, clp(p.neto))).join(''))}
  ${caja('Detalle por orden', 'Neto', os.map(o => `<div class="od-grupo od-bloque"><div class="od-grupo-cab"><span>N° ${o.n} · ${esc(fechaLarga(o.fecha).replace(/ de \d{4}$/, '').replace(/ de (\w+)$/, (m, mes) => ' ' + mes.slice(0, 3)).replace(/^(\w)/, c => c.toLowerCase()))}</span><span>${clp(o.neto)}</span></div>
    ${(o.lineas || []).map(l => `<div class="od-grupo-l"><span>${esc(l.cantidad)} × ${esc(l.producto)} (${clp(l.precio)})</span><span>${clp(lineaNeto(l))}</span></div>`).join('')}</div>`).join(''))}
  <div class="od-pie od-bloque">${pieEmpresa(E)}<br>${esc(cliente.razonSocial || cliente.nombre)} · RUT ${esc(cliente.rut || '—')} · Documento interno de pedido. No es comprobante tributario.</div>
</div>`;
}
export async function resumenOrdenes(ordenes, cliente, abrir) {
  if (!ordenes.length) throw new Error('Marca al menos una orden.');
  const ventana = abrir ? window.open('', '_blank') : null;
  if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px">Generando el PDF…</p>');
  const ns = ordenes.map(o => o.n).sort((a, b) => a - b);
  return aPdf(htmlResumenOrdenes(ordenes, cliente), `Resumen_ordenes_${ns[0]}-${ns[ns.length - 1]}_${archivo(cliente.nombre)}.pdf`, ventana);
}
