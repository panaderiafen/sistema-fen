// ═══════════════════════════════════════════════════════════════════════
//  Sistema Fën — Finanzas → Cierre de mes → Informe de conciliación (pantalla)  v0.129.0
//  Se prepara al tocar (lee lo mismo que el Flujo de caja) y se descarga un Excel con tres hojas: Resumen, Cargos y Abonos.
// ═══════════════════════════════════════════════════════════════════════
import * as M from './flujo-modelo.js?v=0.129.0';
import * as FF from './flujo-fs.js?v=0.129.0';
import * as IC from './informe-conc.js?v=0.129.0';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let cargando = null;
function cargarXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!cargando) cargando = new Promise((ok, no) => { const s = document.createElement('script'); s.src = XLSX_URL; s.onload = () => ok(window.XLSX); s.onerror = () => { cargando = null; no(new Error('No se pudo cargar el lector de Excel. Revise la conexión.')); }; document.head.appendChild(s); });
  return cargando;
}
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const TXT = 'Cada cargo y cada abono del banco y de Mercado Pago del mes, con su documento o su explicación, y lo que quedó pendiente.\nSirve de respaldo de la conciliación bancaria ante el SII y para la contadora (la contabilidad oficial la lleva ella).\nEl Excel trae tres hojas: Resumen (saldos de la cartola por cuenta, cuánto está conciliado, los pendientes y las ventas con tarjeta por día), Cargos y Abonos.\nSale con los datos de hoy: si el mes está abierto, dice "borrador".';

// sec: el <section> donde va; mes 'AAAA-MM'; c: { cerrado, cerradoEn }
export function pintar(sec, H, mes, c = {}) {
  if (!sec) return;
  const est = c.cerrado ? `Mes cerrado${c.cerradoEn ? ' el ' + c.cerradoEn : ''}` : 'Borrador: el mes está abierto';
  sec.innerHTML = `<div class="titulo-fila fin-titulo"><h2 id="t-ic">Informe de conciliación ${H.info('Informe de conciliación', TXT)}</h2></div>
    <p class="ayuda">Cada cargo y cada abono del banco y de Mercado Pago de ${H.esc(M.mesTxt(mes))}, con su documento o su explicación, y lo que quedó pendiente. Respaldo ante el SII y para la contadora.</p>
    <div id="ic-cuerpo"><button type="button" class="btn-sec" id="ic-prep">Preparar el informe de ${H.esc(M.mesTxt(mes))}</button></div>`;
  const b = sec.querySelector('#ic-prep');
  b.onclick = async () => {
    b.disabled = true; b.textContent = 'Preparando…';
    let R; try { R = IC.armar(await FF.cargar(), mes); }
    catch (e) { console.error('Informe de conciliación', e); sec.querySelector('#ic-cuerpo').innerHTML = `<p class="error" role="alert">No se pudo preparar (${H.esc(e.message || String(e))}).</p>`; return; }
    const t = R.totales, cuerpo = sec.querySelector('#ic-cuerpo');
    cuerpo.innerHTML = `<div class="ic-tres">
        <div class="ic-k"><small>Cargos</small><b>${t.cargos.n} · ${IC.pct(t.cargos.conc, t.cargos.n)} %</b><small>conciliados</small></div>
        <div class="ic-k"><small>Abonos</small><b>${t.abonos.n} · ${IC.pct(t.abonos.conc, t.abonos.n)} %</b><small>conciliados</small></div>
        <div class="ic-k ${t.pendientes.n ? 'ic-k-pend' : ''}"><small>Pendientes</small><b>${t.pendientes.n}${t.pendientes.n ? ' · ' + pesos(t.pendientes.monto) : ''}</b><small>${t.pendientes.n ? 'con su nota' : 'nada pendiente'}</small></div></div>
      ${R.faltan.length ? '<p class="aviso">Algunos datos no se pudieron leer en este equipo (Ventas a empresas o las cajas): el informe puede salir incompleto.</p>' : ''}
      <div class="botones"><button type="button" class="btn" id="ic-bajar">Descargar informe (Excel)</button></div>
      <p class="ayuda">${H.esc(est)}. Sale con los datos de hoy. Nombre del archivo: Fen conciliacion ${H.esc(mes)}.xlsx</p><p class="error" id="ic-err" role="alert"></p>`;
    cuerpo.querySelector('#ic-bajar').onclick = async ev => {
      const bt = ev.currentTarget; bt.disabled = true;
      try {
        const X = await cargarXlsx(), wb = X.utils.book_new(), hoyTxt = new Date().toLocaleString('es-CL');
        const H3 = IC.hojas(R, { generado: hoyTxt, estadoMes: est });
        const anchos = { Resumen: [26, 18, 14, 14, 18, 14, 22, 20, 18, 12], Cargos: [11, 7, 22, 40, 16, 12, 30, 18, 12, 14, 30, 26, 14, 14, 30, 36], Abonos: [11, 22, 40, 16, 12, 24, 30, 14, 40, 40, 34] };
        Object.entries(H3).forEach(([n, filas]) => { const sh = X.utils.aoa_to_sheet(filas); sh['!cols'] = (anchos[n] || []).map(w => ({ wch: w })); X.utils.book_append_sheet(wb, sh, n); });
        X.writeFile(wb, `Fen conciliacion ${mes}.xlsx`);
        if (H.registrar) H.registrar('Finanzas: informe de conciliación', `${M.mesTxt(mes)} · ${t.cargos.n} cargos · ${t.abonos.n} abonos · ${t.pendientes.n} pendientes`);
      } catch (e) { sec.querySelector('#ic-err').textContent = e.message || String(e); }
      bt.disabled = false;
    };
  };
}
