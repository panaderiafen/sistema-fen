// ═══════════════════════════════════════════════
//  Sistema Fën — Llenar la factura en el portal gratuito del SII  v0.22.0
//  1) En Por facturar, "Preparar para el SII" copia el RUT del cliente y el detalle
//     (producto, cantidad y precio neto) como un texto que empieza con "FENSII1:".
//  2) En el formulario "Factura electrónica" del SII, el botón "Llenar factura Fën"
//     (un favorito del navegador) lee ese texto y llena los campos del formulario.
//     Primer toque: el RUT del cliente (el SII busca sus datos). Segundo toque: los productos.
//  Nada se emite solo: se revisa y se usa "Validar y visualizar" del SII como siempre.
//  v0.20.0: referencias "Nota de pedido" con el N° de cada orden; clientes que pagan a 30 días:
//  forma de pago Crédito + info de pago (vencimiento y monto); los demás, Contado.
//  Tercer toque, en la página "Documento enviado exitosamente": lee el folio y abre Sistema Fën
//  para asignarlo a esas órdenes (pide confirmar). Las órdenes que se están facturando quedan
//  anotadas en ese navegador (almacenamiento del sitio del SII), nada más.
//  v0.22.0: si el SII se abrió desde Sistema Fën ("Abrir el formulario del SII"), el folio vuelve a esa
//  misma pestaña (mensaje entre pestañas); si no, se abre Sistema Fën en una pestaña nueva, como antes.
//  El botón no manda nada a ninguna parte: solo escribe en el formulario abierto.
// ═══════════════════════════════════════════════
export const PREFIJO = 'FENSII1:';
export const URL_FORMULARIO_SII = 'https://www1.sii.cl/cgi-bin/Portal001/mipeGenFacEx.cgi?PTDC_CODIGO=33';
// v0.24.1: el formulario no se abre directo desde Sistema Fën: el SII no recibe tu sesión cuando llegas desde otro sitio
// (Error 501 "ptr NULL (ptrTkn)"). Se abre la portada del SII y desde su menú se llega a Emitir factura.
export const URL_INICIO_SII = 'https://www.sii.cl/';
// Mensaje que llega desde la página del SII con el folio (solo se acepta de una página de sii.cl)
export function leerMensajeFolio(e) {
  if (!e || !/^https:\/\/([a-z0-9-]+\.)*sii\.cl$/.test(String(e.origin || ''))) return null;
  const m = e.data || {};
  if (m.tipo !== 'fen-sii-folio' || !/^\d{1,12}$/.test(String(m.folio || ''))) return null;
  return { folio: String(m.folio), rut: String(m.rut || '').toUpperCase().replace(/[^0-9K]/g, ''), total: Number(m.total) || 0, fecha: /^\d{4}-\d{2}-\d{2}$/.test(m.fecha || '') ? m.fecha : '', ordenes: String(m.ordenes || '').split(',').filter(x => /^\d+$/.test(x)) };
}

// RUT "76.123.456-7" → { rut: '76123456', dv: '7' }
export function partirRut(r) {
  const t = String(r || '').toUpperCase().replace(/[^0-9K]/g, '');
  return t.length >= 2 ? { rut: t.slice(0, -1), dv: t.slice(-1) } : null;
}

// Texto que se copia. filas: [{ producto, cantidad, precio (neto unitario) }]
export function textoParaSii(cliente, filas, ordenes, total) {
  const r = partirRut(cliente && cliente.rut);
  if (!r) throw new Error('El cliente no tiene RUT (Clientes → Editar datos).');
  const lineas = filas.map(f => ({ n: String(f.producto).trim(), q: Math.round((Number(f.cantidad) || 0) * 1000) / 1000, p: Math.round(Number(f.precio) || 0) }));
  const pago30 = /30/.test(String((cliente && cliente.frecuenciaPago) || ''));
  const os = (ordenes || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.n - b.n).map(o => ({ n: o.n, f: String(o.fecha || '').slice(0, 10) }));
  return PREFIJO + JSON.stringify({ v: 2, rut: r.rut, dv: r.dv, razon: (cliente && (cliente.razonSocial || cliente.nombre)) || '', ciudad: String((cliente && cliente.ciudad) || '').trim(), ordenes: os, pago30, total: Math.round(Number(total) || 0), lineas });
}

// ── El botón (bookmarklet). Corre dentro de la página del SII. ──
async function llenarFacturaFen(SF) {
  const f = document.forms.VIEW_EFXP;
  // Tercer toque: la página del SII que confirma la factura emitida → lleva el folio a Sistema Fën
  const txtPag = String((document.body && document.body.innerText) || '');
  if (!f && /ENVIADO EXITOSAMENTE/i.test(txtPag)) {
    const folio = (txtPag.match(/FACTURA ELECTR.NICA\s*N\S{0,2}\s*(\d{1,12})/i) || [])[1];
    const rutR = ((txtPag.match(/Rut Receptor\s*([\d.]+-[\dkK])/i) || [])[1] || '').replace(/[^\dkK]/g, '').toUpperCase();
    const totalR = Number(((txtPag.match(/TOTAL\s*\$\s*([\d.]+)/i) || [])[1] || '').replace(/\./g, '')) || 0;
    const fe = (txtPag.match(/Fecha Emisi.n:\s*(\d{2})-(\d{2})-(\d{4})/i) || []);
    if (!folio) { alert('No encontré el N° de folio en esta página. Asígnalo a mano en Sistema Fën.'); return; }
    let pend = null;
    try { pend = JSON.parse(localStorage.getItem('fen_sii_pendiente') || 'null'); } catch (e) { pend = null; }
    const calza = pend && (pend.rut + pend.dv).toUpperCase() === rutR;
    const datos = { siiFolio: folio, rut: rutR, total: String(totalR), fecha: fe[3] ? fe[3] + '-' + fe[2] + '-' + fe[1] : '', ordenes: calza ? pend.ordenes.join(',') : '' };
    const limpiar = () => { if (calza) try { localStorage.removeItem('fen_sii_pendiente'); } catch (e) {} };
    // Si este SII se abrió desde Sistema Fën, el folio vuelve a esa pestaña (sin abrir otra)
    const origen = new URL(SF).origin;
    if (window.opener && !window.opener.closed) {
      let ok = false;
      const oir = e => { if (e.origin === origen && e.data && e.data.tipo === 'fen-sii-ok') ok = true; };
      window.addEventListener('message', oir);
      try { window.opener.postMessage({ tipo: 'fen-sii-folio', folio: datos.siiFolio, rut: datos.rut, total: datos.total, fecha: datos.fecha, ordenes: datos.ordenes }, origen); } catch (e) {}
      await new Promise(r => setTimeout(r, 1500));
      window.removeEventListener('message', oir);
      if (ok) { limpiar(); try { window.opener.focus(); } catch (e) {} alert('Listo: el folio N° ' + folio + ' pasó a Sistema Fën, en la pestaña desde donde abriste el SII. Ve a esa pestaña para asignarlo.'); return; }
    }
    window.open(SF + '?' + new URLSearchParams(datos).toString() + '#b2b', '_blank');
    limpiar();
    return;
  }
  if (!f) { alert('Llenar factura Fën: abre primero el formulario de Factura electrónica del SII (Emitir documento → Factura electrónica) y vuelve a tocar el botón.'); return; }
  let t = '';
  try { t = await navigator.clipboard.readText(); } catch (e) { t = ''; }
  if (String(t).indexOf('FENSII1:') !== 0) t = prompt('Pega aquí lo que copiaste en Sistema Fën con "Preparar para el SII":') || '';
  t = String(t).trim();
  if (t.indexOf('FENSII1:') !== 0) { alert('Eso no es un texto de Sistema Fën. En Por facturar toca "Preparar para el SII" y vuelve a intentarlo.'); return; }
  let d;
  try { d = JSON.parse(t.slice(8)); } catch (e) { alert('El texto copiado está incompleto. Vuelve a tocar "Preparar para el SII".'); return; }
  const campo = n => f.elements[n];
  const avisar = (e, tipo) => e.dispatchEvent(new Event(tipo, { bubbles: true }));
  const poner = (n, v) => { const e = campo(n); if (!e) return false; e.value = v; avisar(e, 'input'); avisar(e, 'change'); avisar(e, 'blur'); return true; };
  // Paso 1: el receptor. Al escribir el dígito verificador, el SII busca la razón social, dirección y giro.
  const rut = campo('EFXP_RUT_RECEP'), dv = campo('EFXP_DV_RECEP');
  if (!rut || !dv) { alert('No encontré el RUT del receptor en este formulario. Puede que el SII lo haya cambiado: avísale a Claude.'); return; }
  if (String(rut.value).trim() !== d.rut || String(dv.value).trim().toUpperCase() !== d.dv) {
    rut.value = d.rut; avisar(rut, 'change');
    dv.value = d.dv; avisar(dv, 'change');
    alert('Paso 1 de 2 listo: RUT ' + d.rut + '-' + d.dv + (d.razon ? ' (' + d.razon + ')' : '') + '.\n\nEspera que el SII cargue los datos del cliente y vuelve a tocar "Llenar factura Fën" para poner los productos.');
    return;
  }
  // Paso 2: los productos (el SII dibuja las líneas desde datosArray; además se escriben en cada casilla)
  const L = d.lineas || [], k2 = i => ('0' + (i + 1)).slice(-2), A = window.datosArray;
  const yaHay = Array.from(f.elements).filter(e => /^EFXP_NMB_\d+$/.test(e.name) && String(e.value).trim()).length;
  if (yaHay && !confirm('El formulario ya tiene ' + yaHay + ' producto(s). ¿Reemplazarlos por los de Sistema Fën?')) return;
  if (Array.isArray(A)) {
    const conBoton = !!campo('AGREGA_DETALLE');
    for (let i = 0; i < (conBoton ? A.length : Math.max(L.length, A.length)); i++) {
      const k = k2(i);
      if (!A[i]) A[i] = [['EFXP_TPO_COD_' + k, ''], ['EFXP_COD_' + k, ''], ['EFXP_NMB_' + k, ''], ['DESCRIP_' + k, ''], ['EFXP_QTY_' + k, ''], ['EFXP_UNMD_' + k, ''], ['EFXP_PRC_' + k, ''], ['EFXP_OTRO_IMP_' + k, ''], ['EFXP_PCTD_' + k, ''], ['EFXP_SUBT_' + k, ''], ['EFXP_DSC_ITEM_' + k, ''], ['NO_VIS', 'NO_VIS']];
      const x = L[i], fila = A[i];
      fila.forEach(c => { if (/^(EFXP_|DESCRIP_)/.test(c[0])) c[1] = ''; });
      if (x) { fila[2][1] = x.n; fila[4][1] = String(x.q); fila[6][1] = String(x.p); fila[9][1] = String(Math.round(x.q * x.p)); }
      fila[fila.length - 1][0] = x || i === 0 ? 'VIS' : 'NO_VIS';
    }
    if (typeof window.dibujaDetalles === 'function') window.dibujaDetalles();
  }
  // Más de las líneas que trae el formulario: el botón "Agrega linea de Detalle" del SII
  for (let n = 0; n < 60 && campo('AGREGA_DETALLE') && !campo('EFXP_NMB_' + k2(L.length - 1)); n++) campo('AGREGA_DETALLE').click();
  // La ciudad del receptor (el SII no siempre la trae): la de Clientes en Sistema Fën
  if (d.ciudad && campo('EFXP_CIUDAD_RECEP') && !String(campo('EFXP_CIUDAD_RECEP').value).trim()) { const c = campo('EFXP_CIUDAD_RECEP'); poner('EFXP_CIUDAD_RECEP', c.maxLength > 0 ? d.ciudad.slice(0, c.maxLength) : d.ciudad); }
  const cortados = [], faltan = [];
  L.forEach((x, i) => {
    const k = k2(i), nm = campo('EFXP_NMB_' + k);
    if (!nm) { faltan.push(x.n); return; }
    let nombre = x.n;
    const max = nm.maxLength > 0 ? nm.maxLength : 80;
    if (nombre.length > max) { cortados.push(nombre); nombre = nombre.slice(0, max); }
    poner('EFXP_NMB_' + k, nombre); poner('EFXP_QTY_' + k, String(x.q)); poner('EFXP_PRC_' + k, String(x.p));
  });
  // Líneas que sobraban de antes: vacías
  for (let i = L.length; campo('EFXP_NMB_' + k2(i)); i++) { if (String(campo('EFXP_NMB_' + k2(i)).value).trim()) { poner('EFXP_NMB_' + k2(i), ''); poner('EFXP_QTY_' + k2(i), ''); poner('EFXP_PRC_' + k2(i), ''); } }
  const neto = L.reduce((s, x) => s + Math.round(x.q * x.p), 0);
  // Referencias: una "Nota de pedido" (802) por orden, hasta 3; si son más, la tercera nombra el resto
  const os = (d.ordenes || []).map(o => (typeof o === 'object' ? o : { n: o, f: '' }));
  const ponerFecha = (pre, k, iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return true; let ok = true; [['dia', m[3]], ['mes', m[2]], ['anio', m[1]]].forEach(([p, v]) => { const e = campo('cbo_' + p + '_boleta_' + pre + '_' + k); if (!e || !Array.from(e.options).some(o => o.value === v)) { ok = false; return; } e.value = v; avisar(e, 'change'); }); return ok; };
  const avisos = [];
  const ref = campo('REF_SI_NO'), pag = campo('PAGO_SI_NO');
  if (os.length && ref) { ref.checked = true; }
  if (d.pago30 && pag) { pag.checked = true; }
  if ((os.length && ref) || (d.pago30 && pag)) { if (typeof window.printReferencias === 'function') window.printReferencias(); }
  if (os.length) {
    if (!campo('EFXP_TPO_DOC_REF_001')) avisos.push('No aparecieron las referencias: márcalas a mano (Nota de pedido, N° de orden).');
    else os.slice(0, 3).forEach((o, i) => {
      const k = '00' + (i + 1), resto = i === 2 && os.length > 3 ? os.slice(2) : null;
      poner('EFXP_TPO_DOC_REF_' + k, '802'); poner('EFXP_FOLIO_REF_' + k, String(o.n));
      if (!ponerFecha('ref', k.slice(-2), o.f)) avisos.push('Revisa la fecha de la referencia ' + (i + 1) + '.');
      poner('EFXP_RAZON_REF_' + k, (resto ? 'Órdenes de venta N° ' + resto.map(x => x.n).join(', ') : 'Orden de venta N° ' + o.n).slice(0, 90));
    });
  }
  // Forma de pago: Crédito con su vencimiento si el cliente paga a 30 días; si no, Contado
  if (campo('EFXP_FMA_PAGO')) poner('EFXP_FMA_PAGO', d.pago30 ? '2' : '1');
  if (d.pago30) {
    const em = String((campo('EFXP_FCH_EMIS') || {}).value || '') || new Date().toISOString().slice(0, 10);
    const v = new Date(em + 'T12:00:00'); v.setDate(v.getDate() + 30);
    const venc = v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
    if (!campo('EFXP_MNT_PAGO_001')) avisos.push('No apareció la info de pago: márcala a mano (vence el ' + venc.split('-').reverse().join('-') + ').');
    else { if (!ponerFecha('pago', '01', venc)) avisos.push('Revisa la fecha de pago.'); poner('EFXP_MNT_PAGO_001', String(d.total || Math.round(neto * 1.19))); poner('EFXP_GLOSA_PAGOS_001', 'Pago a 30 días'); }
  }
  // Para el tercer toque: qué órdenes se están facturando (solo en este navegador)
  try { localStorage.setItem('fen_sii_pendiente', JSON.stringify({ rut: d.rut, dv: d.dv, ordenes: os.map(o => o.n), total: d.total || 0, t: Date.now() })); } catch (e) {}
  setTimeout(() => {
    const enSii = Number(String((campo('EFXP_MNT_NETO') || {}).value || '').replace(/[^\d]/g, '')) || 0;
    let m = 'Paso 2 de 2 listo: ' + (L.length - faltan.length) + ' de ' + L.length + ' productos.\nNeto según Sistema Fën: $' + neto.toLocaleString('es-CL') + (enSii ? '\nNeto que calcula el SII: $' + enSii.toLocaleString('es-CL') + (enSii === neto ? ' ✓' : ' ← revisa, no calza') : '');
    if (faltan.length) m += '\n\nNo cupieron en el formulario: ' + faltan.join(', ') + '. Agrégalos a mano o haz dos facturas.';
    if (cortados.length) m += '\n\nNombres cortados (el SII acepta pocas letras): ' + cortados.join(', ') + '.';
    if (os.length) m += '\nReferencias: Nota de pedido N° ' + os.slice(0, 3).map(o => o.n).join(', ') + (os.length > 3 ? ' (y ' + (os.length - 3) + ' más en la razón)' : '') + '.';
    m += '\nForma de pago: ' + (d.pago30 ? 'Crédito, a 30 días' : 'Contado') + '.';
    if (avisos.length) m += '\n\n' + avisos.join('\n');
    alert(m + '\n\nRevisa y usa "Validar y visualizar" como siempre. Después de emitir, en la página del folio, toca el botón otra vez para llevarlo a Sistema Fën.');
  }, 400);
}
// El enlace que se arrastra a la barra de favoritos
export const codigoBoton = (sf = location.origin + location.pathname) => 'javascript:' + encodeURIComponent('(' + llenarFacturaFen.toString().replace(/\n\s+/g, '\n') + ')(' + JSON.stringify(sf) + ');void 0');
export { llenarFacturaFen };
