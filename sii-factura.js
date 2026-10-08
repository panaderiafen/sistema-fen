// ═══════════════════════════════════════════════
//  Sistema Fën — Llenar la factura en el portal gratuito del SII  v0.19.0
//  1) En Por facturar, "Preparar para el SII" copia el RUT del cliente y el detalle
//     (producto, cantidad y precio neto) como un texto que empieza con "FENSII1:".
//  2) En el formulario "Factura electrónica" del SII, el botón "Llenar factura Fën"
//     (un favorito del navegador) lee ese texto y llena los campos del formulario.
//     Primer toque: el RUT del cliente (el SII busca sus datos). Segundo toque: los productos.
//  Nada se emite solo: se revisa y se usa "Validar y visualizar" del SII como siempre.
//  El botón no manda nada a ninguna parte: solo escribe en el formulario abierto.
// ═══════════════════════════════════════════════
export const PREFIJO = 'FENSII1:';

// RUT "76.123.456-7" → { rut: '76123456', dv: '7' }
export function partirRut(r) {
  const t = String(r || '').toUpperCase().replace(/[^0-9K]/g, '');
  return t.length >= 2 ? { rut: t.slice(0, -1), dv: t.slice(-1) } : null;
}

// Texto que se copia. filas: [{ producto, cantidad, precio (neto unitario) }]
export function textoParaSii(cliente, filas, ordenes) {
  const r = partirRut(cliente && cliente.rut);
  if (!r) throw new Error('El cliente no tiene RUT (Clientes → Editar datos).');
  const lineas = filas.map(f => ({ n: String(f.producto).trim(), q: Math.round((Number(f.cantidad) || 0) * 1000) / 1000, p: Math.round(Number(f.precio) || 0) }));
  return PREFIJO + JSON.stringify({ v: 1, rut: r.rut, dv: r.dv, razon: (cliente && (cliente.razonSocial || cliente.nombre)) || '', ordenes: (ordenes || []).map(o => o.n), lineas });
}

// ── El botón (bookmarklet). Corre dentro de la página del SII. ──
async function llenarFacturaFen() {
  const f = document.forms.VIEW_EFXP;
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
    for (let i = 0; i < Math.max(L.length, A.length); i++) {
      const k = k2(i);
      if (!A[i]) A[i] = [['EFXP_TPO_COD_' + k, ''], ['EFXP_COD_' + k, ''], ['EFXP_NMB_' + k, ''], ['DESCRIP_' + k, ''], ['EFXP_QTY_' + k, ''], ['EFXP_UNMD_' + k, ''], ['EFXP_PRC_' + k, ''], ['EFXP_OTRO_IMP_' + k, ''], ['EFXP_PCTD_' + k, ''], ['EFXP_SUBT_' + k, ''], ['EFXP_DSC_ITEM_' + k, ''], ['NO_VIS', 'NO_VIS']];
      const x = L[i], fila = A[i];
      fila.forEach(c => { if (/^(EFXP_|DESCRIP_)/.test(c[0])) c[1] = ''; });
      if (x) { fila[2][1] = x.n; fila[4][1] = String(x.q); fila[6][1] = String(x.p); fila[9][1] = String(Math.round(x.q * x.p)); }
      fila[fila.length - 1][0] = x || i === 0 ? 'VIS' : 'NO_VIS';
    }
    if (typeof window.dibujaDetalles === 'function') window.dibujaDetalles();
  }
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
  setTimeout(() => {
    const enSii = Number(String((campo('EFXP_MNT_NETO') || {}).value || '').replace(/[^\d]/g, '')) || 0;
    let m = 'Paso 2 de 2 listo: ' + (L.length - faltan.length) + ' de ' + L.length + ' productos.\nNeto según Sistema Fën: $' + neto.toLocaleString('es-CL') + (enSii ? '\nNeto que calcula el SII: $' + enSii.toLocaleString('es-CL') + (enSii === neto ? ' ✓' : ' ← revisa, no calza') : '');
    if (faltan.length) m += '\n\nNo cupieron en el formulario: ' + faltan.join(', ') + '. Agrégalos a mano o haz dos facturas.';
    if (cortados.length) m += '\n\nNombres cortados (el SII acepta pocas letras): ' + cortados.join(', ') + '.';
    alert(m + '\n\nRevisa y usa "Validar y visualizar" como siempre.');
  }, 400);
}
// El enlace que se arrastra a la barra de favoritos
export const codigoBoton = () => 'javascript:' + encodeURIComponent('(' + llenarFacturaFen.toString().replace(/\n\s+/g, '\n') + ')();void 0');
export { llenarFacturaFen };
