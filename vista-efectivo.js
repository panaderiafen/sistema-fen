// ═══════════════════════════════════════════════
//  Sistema Fën — Efectivo → Caja de administración  v0.119.1
//  Aprobado por Emmanuel el 30 oct (lienzo "Boceto · Efectivo de la caja"; mapa v15, cuenta 1.1.6).
//  Cuánto debería haber, lo que entró y salió en el mes, el último conteo y los movimientos, con
//  Ingreso, Salida, Contar y Anular.
//  v0.119.0 (caja v3.0.0): "Por recibir de las cajas": el retiro de cada cierre y los retiros o el sencillo
//  con la caja abierta llegan solos; la administración los recibe con un botón (transacción con el saldo).
// ═══════════════════════════════════════════════
import * as M from './efectivo-modelo.js?v=0.119.1';
import * as FS from './efectivo-fs.js?v=0.119.1';

const EF = { mes: '', cuenta: undefined, movs: null, porRecibir: null, posteriores: null, msg: '', err: '' };
export function olvidar() { EF.cuenta = undefined; EF.movs = null; EF.porRecibir = null; EF.posteriores = null; }

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// v0.119.1 · Movimientos con el saldo que quedó después de cada uno (como una cartola)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const diaTexto = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${DIAS[new Date(y, m - 1, dd).getDay()]} ${dd} ${MESES[m - 1].slice(0, 3)}`; };
const mesTexto = k => { const [y, m] = k.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };

export async function pintarEfectivo(el, sub, H) {
  const { esc, info, pesos } = H;
  const hoy = hoyLocal();
  if (!EF.mes) EF.mes = hoy.slice(0, 7);
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-efectivo">Efectivo</h1><p>Caja de administración: el efectivo que sale de las cajas y el de los clientes B2B</p></div></div>
    <section class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></section>`;
  try {
    if (EF.cuenta === undefined) EF.cuenta = await FS.leerCuenta();
    if (EF.porRecibir === null) EF.porRecibir = await FS.leerPorRecibir();
    if (!EF.movs || EF.movs.mes !== EF.mes) { const l = await FS.leerMes(EF.mes); EF.movs = { mes: EF.mes, lista: l }; EF.posteriores = null; }
    // v0.119.1 · Para el saldo línea por línea de un mes pasado hacen falta los movimientos de los meses siguientes
    if (EF.posteriores === null) {
      const despues = M.mesesHasta(hoy).filter(k => k > EF.mes);
      EF.posteriores = (await Promise.all(despues.map(k => FS.leerMes(k)))).flat();
    }
  } catch (e) {
    el.querySelector('.tarjeta').innerHTML = `<p class="error">${esc(H.mensajeError(e))}</p>`;
    return;
  }
  const c = EF.cuenta, lista = M.ordenar(EF.movs.lista), r = M.resumirMes(lista);
  const saldos = c ? M.saldosDespues([...EF.movs.lista, ...(EF.posteriores || [])], c.saldo) : {};
  const uc = c && c.ultimoConteo;
  const ucTxt = !uc ? 'Sin conteo todavía' : uc.inicial ? 'Conteo inicial' : (Math.round(uc.diferencia || 0) === 0 ? 'Cuadró' : `Diferencia ${uc.diferencia > 0 ? '+' : ''}${pesos(uc.diferencia)}`);
  const chipTipo = m => m.tipo === 'ingreso' ? '<span class="chip c-verde">Ingreso</span>' : m.tipo === 'salida' ? '<span class="chip c-amarillo">Salida</span>' : '<span class="chip c-gris">Conteo</span>';
  const msDe = t => (t && t.toMillis ? t.toMillis() : 0), msConteo = uc ? msDe(uc.en) : 0;
  // Lo anterior al último conteo ya quedó cuadrado por ese conteo: no se anula (se hace un conteo nuevo)
  const anulable = m => m.tipo !== 'conteo' && !m.anulado && !(msConteo && msDe(m.creado) && msDe(m.creado) < msConteo);
  const fila = m => {
    const signo = m.tipo === 'ingreso' ? '+ ' : m.tipo === 'salida' ? '− ' : '';
    const acc = m.anulado ? `<span class="chip c-gris">Anulado</span>`
      : !anulable(m) ? '' : `${m.estado === 'por_unir' ? `<span class="chip c-amarillo" title="Se unirá a su ${m.motivo === 'deposito' ? 'abono en la cartola' : 'documento en Gastos'} en una próxima versión">Por unir</span>` : ''}<button type="button" class="btn-sec btn-chico" data-anular="${esc(m.id)}">Anular</button>`;
    return `<div class="fila-caja ef-fila${m.anulado ? ' ef-anulado' : ''}"><div class="txt">
        <b>${chipTipo(m)} ${esc(M.textoMotivo(m.tipo, m.motivo))}</b>
        <span>${esc(diaTexto(m.dia))}${M.detalleTexto(m) ? ' · ' + esc(M.detalleTexto(m)) : ''}${m.por ? ' · ' + esc(m.por) : ''}</span>
        ${m.anulado ? `<span class="nota">Anulado por ${esc(m.anulado.por || '')}${m.anulado.motivo ? ': “' + esc(m.anulado.motivo) + '”' : ''}</span>` : ''}</div>
      <div class="acciones"><span class="ef-monto-col"><span class="ef-monto ef-${esc(m.tipo)}">${signo}${pesos(m.monto)}</span>${saldos[m.id] != null ? `<span class="ef-saldo">saldo ${pesos(saldos[m.id])}</span>` : ''}</span>${acc}</div></div>`;
  };
  const meses = M.mesesHasta(hoy);
  // v0.119.0 · Lo que las cajas dejaron para la caja de administración
  const pr = (EF.porRecibir || []).filter(x => M.movDesdeCaja(x)).sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || msDe(a.creado) - msDe(b.creado));
  const filaPr = x => {
    const entra = x.tipo === 'retiro';
    return `<div class="fila-caja ef-fila"><div class="txt">
        <b>${entra ? '<span class="chip c-verde">Entra</span>' : '<span class="chip c-amarillo">Sale</span>'} ${esc(M.TEXTO_CAJA[x.motivo] || '')} · ${esc(M.textoSucursal(x.sucursal))}</b>
        <span>${esc(diaTexto(x.dia))}${x.por ? ' · ' + esc(x.por) : ''}${x.nota ? ' · ' + esc(x.nota) : ''}</span></div>
      <div class="acciones"><span class="ef-monto ef-${entra ? 'ingreso' : 'salida'}">${entra ? '+ ' : '− '}${pesos(x.monto)}</span><button type="button" class="btn btn-chico" data-recibir="${esc(x.id)}">${entra ? 'Recibir' : 'Confirmar salida'}</button></div></div>`;
  };
  const totPr = pr.reduce((a, x) => a + (x.tipo === 'retiro' ? 1 : -1) * Math.round(Number(x.monto) || 0), 0);
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-efectivo">Efectivo ${info('Caja de administración', 'Es la cuenta 1.1.6 del plan de gestión: el efectivo que no está en una caja de venta. Entra lo que se retira de las cajas al cerrar y el efectivo de clientes B2B; sale a depósitos al banco, pagos en efectivo y sencillo para las cajas.\n"Debería haber" es el último conteo más lo que entró menos lo que salió desde entonces. Cuente de vez en cuando con "Contar": si no cuadra, la diferencia queda anotada y el saldo pasa a ser lo contado.\nNada se borra: un movimiento equivocado se anula, con su motivo.')}</h1><p>Caja de administración: el efectivo que sale de las cajas y el de los clientes B2B</p></div></div>
    ${EF.msg ? `<div class="aviso" role="status">${EF.msg}</div>` : ''}${EF.err ? `<p class="error" role="alert">${esc(EF.err)}</p>` : ''}
    ${!c ? `<section class="tarjeta" aria-labelledby="t-ef-inicio"><div class="titulo-fila"><h2 id="t-ef-inicio">Para empezar</h2></div>
        <p class="ayuda" style="margin:0 0 12px">Cuente cuánto efectivo hay hoy en la caja de administración. Desde ese monto, Sistema Fën lleva la cuenta con cada ingreso y salida.</p>
        <button type="button" class="btn" id="ef-contar">Hacer el conteo inicial</button></section>` : `
    <div class="cifras cifras-4">
      <div class="tarjeta cifra"><span class="rotulo">Debería haber</span><span class="valor">${pesos(c.saldo)}</span><span class="nota">Según los movimientos</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Entró en ${esc(mesTexto(EF.mes))}</span><span class="valor">${pesos(r.entro)}</span><span class="nota">Sin anulados</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Salió en ${esc(mesTexto(EF.mes))}</span><span class="valor">${pesos(r.salio)}</span><span class="nota">Sin anulados</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Último conteo</span><span class="valor">${uc ? esc(diaTexto(uc.dia)) : '—'}</span><span class="nota">${esc(ucTxt)}</span></div>
    </div>
    <div class="ef-botones">
      <button type="button" class="btn" id="ef-ingreso">Ingreso</button>
      <button type="button" class="btn" id="ef-salida">Salida</button>
      <button type="button" class="btn-sec" id="ef-contar">Contar la caja de administración</button>
    </div>`}
    ${pr.length ? `<section class="tarjeta" aria-labelledby="t-ef-pr">
      <div class="titulo-fila"><h2 id="t-ef-pr">Por recibir de las cajas ${info('Por recibir de las cajas', 'Lo que las cajas dejaron para la caja de administración: el retiro de cada cierre (lo contado menos el fondo que queda) y los retiros con la caja abierta. También el sencillo que se llevó a una caja desde aquí.\nRecíbalo cuando la plata esté en sus manos: recién entonces cambia lo que debería haber. Si llegó otro monto, recíbalo igual y haga un conteo: la diferencia queda anotada.')}</h2><span class="nota">${pr.length} · ${pesos(totPr)}</span></div>
      ${pr.map(filaPr).join('')}</section>` : ''}
    <section class="tarjeta" aria-labelledby="t-ef-movs">
      <div class="titulo-fila"><h2 id="t-ef-movs">Movimientos</h2>
        <select id="ef-mes" aria-label="Mes">${meses.map(k => `<option value="${k}" ${k === EF.mes ? 'selected' : ''}>${esc(mesTexto(k))}</option>`).join('')}</select></div>
      ${lista.length ? `<div data-colapsar="15">${lista.map(fila).join('')}</div>` : `<div class="vacio">Sin movimientos en ${esc(mesTexto(EF.mes))}.</div>`}
      <p class="nota-i">(i) Desde la caja v3.0.0, lo que se retira de cada caja llega solo a "Por recibir de las cajas". Lo de antes (o de una caja cerrada desde aquí sin retiro) se anota a mano: Ingreso → Retiro de una caja.</p>
    </section>`;
  EF.msg = ''; EF.err = '';
  const repintar = () => pintarEfectivo(el, sub, H);
  const $q = s => el.querySelector(s);
  $q('#ef-mes').addEventListener('change', e => { EF.mes = e.target.value; repintar(); });
  $q('#ef-contar') && $q('#ef-contar').addEventListener('click', () => dialogoMov('conteo', H, repintar));
  $q('#ef-ingreso') && $q('#ef-ingreso').addEventListener('click', () => dialogoMov('ingreso', H, repintar));
  $q('#ef-salida') && $q('#ef-salida').addEventListener('click', () => dialogoMov('salida', H, repintar));
  el.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', () => dialogoAnular(lista.find(m => m.id === b.dataset.anular), H, repintar)));
  el.querySelectorAll('[data-recibir]').forEach(b => b.addEventListener('click', () => recibir(pr.find(x => x.id === b.dataset.recibir), b, H, repintar)));
}

function dialogoMov(tipo, H, repintar) {
  const { esc, pesos } = H, hoy = hoyLocal(), saldo = Math.round(Number(EF.cuenta && EF.cuenta.saldo) || 0);
  const titulo = { ingreso: 'Ingreso de efectivo', salida: 'Salida de efectivo', conteo: EF.cuenta ? 'Contar la caja de administración' : 'Conteo inicial' }[tipo];
  const chips = (nombre, lista, sel) => `<div class="chips" role="radiogroup">${lista.map(([k, t], i) => `<label class="chip-radio"><input type="radio" name="${nombre}" value="${k}" ${(sel ? k === sel : i === 0) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
  const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>${esc(titulo)}</h2>
    ${tipo === 'conteo' ? `<p class="ayuda">${EF.cuenta ? `Según los movimientos debería haber <b>${pesos(saldo)}</b>. Escriba lo que contó: si no cuadra, la diferencia queda anotada.` : 'Escriba cuánto efectivo hay hoy en la caja de administración.'}</p>` : `
    <fieldset class="campo"><legend>${tipo === 'ingreso' ? 'De dónde viene' : 'A dónde va'}</legend>${chips('ef-motivo', M.MOTIVOS[tipo].map(m => [m[0], m[1]]))}</fieldset>
    <fieldset class="campo ef-pide" data-pide="sucursal"><legend>Caja</legend>${chips('ef-suc', M.SUCURSALES)}</fieldset>
    <fieldset class="campo ef-pide" data-pide="banco"><legend>Cuenta del banco</legend>${chips('ef-banco', M.BANCOS)}</fieldset>
    <div class="campo ef-pide" data-pide="proveedor"><label for="ef-prov">A quién se le pagó</label><input id="ef-prov" maxlength="120" placeholder="Nombre del proveedor"></div>
    <div class="campo ef-pide" data-pide="proveedor"><label for="ef-doc">N° de boleta o factura (si la hay)</label><input id="ef-doc" maxlength="40" inputmode="numeric"></div>
    <div class="campo ef-pide" data-pide="detalle"><label for="ef-det">Detalle</label><input id="ef-det" maxlength="120" placeholder="Por ejemplo: cliente y N° de orden"></div>`}
    <div class="campo"><label for="ef-monto">${tipo === 'conteo' ? 'Efectivo contado' : 'Monto'}</label><input id="ef-monto" inputmode="numeric" autocomplete="off" placeholder="$0"></div>
    <div class="campo"><label for="ef-dia">Fecha</label><input id="ef-dia" type="date" value="${hoy}" max="${hoy}"></div>
    <div class="campo"><label for="ef-nota">Nota (opcional)</label><input id="ef-nota" maxlength="200"></div>
    <p class="ayuda" id="ef-prev" aria-live="polite"></p>
    <p class="error" id="ef-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="ef-no">Cancelar</button><button type="submit" class="btn" id="ef-si">Guardar</button></div></form>`);
  const val = n => (d.querySelector(`input[name="${n}"]:checked`) || {}).value;
  const leer = () => ({ tipo, motivo: val('ef-motivo'), sucursal: val('ef-suc'), banco: val('ef-banco'),
    detalle: (d.querySelector('#ef-prov') && val('ef-motivo') === 'pago' ? d.querySelector('#ef-prov').value : (d.querySelector('#ef-det') || {}).value) || '',
    documento: (d.querySelector('#ef-doc') || {}).value || '', monto: d.querySelector('#ef-monto').value, dia: d.querySelector('#ef-dia').value, nota: d.querySelector('#ef-nota').value });
  const vis = () => {
    if (tipo !== 'conteo') {
      const m = M.MOTIVOS[tipo].find(x => x[0] === val('ef-motivo')) || [];
      d.querySelectorAll('.ef-pide').forEach(x => x.classList.toggle('oculto', x.dataset.pide !== m[2]));
    }
    const n = M.leerMonto(d.querySelector('#ef-monto').value), p = d.querySelector('#ef-prev');
    if (!(n >= 0) || d.querySelector('#ef-monto').value === '') { p.textContent = ''; return; }
    if (tipo === 'conteo') p.textContent = EF.cuenta ? (n === saldo ? 'Cuadra con lo que debería haber.' : `Diferencia: ${n - saldo > 0 ? 'sobran' : 'faltan'} ${pesos(Math.abs(n - saldo))}.`) : '';
    else p.textContent = `Lo que debería haber queda en ${pesos(saldo + (tipo === 'ingreso' ? n : -n))}.`;
  };
  d.addEventListener('change', vis); d.addEventListener('input', vis); vis();
  d.querySelector('#ef-no').onclick = () => d.close();
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#ef-err'), b = d.querySelector('#ef-si'); err.textContent = '';
    const r = M.revisar(leer(), hoy);
    if (r.error) { err.textContent = r.error; return; }
    // Una salida mayor que lo que debería haber: se avisa y se guarda solo si se presiona Guardar otra vez
    if (tipo === 'salida' && r.mov.monto > saldo && d.dataset.aviso !== String(r.mov.monto)) {
      d.dataset.aviso = String(r.mov.monto);
      err.textContent = `La salida (${pesos(r.mov.monto)}) es mayor que lo que debería haber (${pesos(saldo)}). Si está bien, presione Guardar otra vez.`;
      return;
    }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      const res = await FS.guardar(r.mov);
      H.registrar('Efectivo: ' + (tipo === 'conteo' ? 'contó la caja de administración' : tipo === 'ingreso' ? 'anotó un ingreso' : 'anotó una salida'),
        `${M.textoMotivo(tipo, r.mov.motivo)} · ${pesos(r.mov.monto)} · ${r.mov.dia}${M.detalleTexto(r.mov) ? ' · ' + M.detalleTexto(r.mov) : ''}`);
      d.close();
      EF.cuenta = undefined; EF.movs = null; EF.mes = r.mov.mes;
      EF.msg = `Listo. Lo que debería haber en la caja de administración: <b>${esc(pesos(res.saldo))}</b>.`;
      repintar();
    } catch (e) { err.textContent = e.message || H.mensajeError(e); b.disabled = false; b.textContent = 'Guardar'; }
  });
  setTimeout(() => { const i = d.querySelector('#ef-monto'); if (i) i.focus(); }, 0);
}

function dialogoAnular(m, H, repintar) {
  if (!m) return;
  const { esc, pesos } = H;
  const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>Anular movimiento</h2>
    <p class="ayuda"><b>${esc(M.textoMotivo(m.tipo, m.motivo))}</b> · ${pesos(m.monto)} · ${esc(diaTexto(m.dia))}${M.detalleTexto(m) ? ' · ' + esc(M.detalleTexto(m)) : ''}</p>
    <p class="ayuda">No se borra: queda anulado, con su motivo, y el saldo vuelve a como estaba.</p>
    <div class="campo"><label for="ea-mot">Motivo</label><input id="ea-mot" maxlength="200" placeholder="Por ejemplo: monto mal escrito"></div>
    <p class="error" id="ea-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="ea-no">Cancelar</button><button type="submit" class="btn btn-peligro" id="ea-si">Anular</button></div></form>`);
  d.querySelector('#ea-no').onclick = () => d.close();
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#ea-err'), b = d.querySelector('#ea-si'), mot = d.querySelector('#ea-mot').value.trim();
    if (mot.length < 3) { err.textContent = 'Escriba el motivo.'; return; }
    b.disabled = true; b.textContent = 'Anulando…';
    try {
      const res = await FS.anular(m.id, mot);
      H.registrar('Efectivo: anuló un movimiento', `${M.textoMotivo(m.tipo, m.motivo)} · ${pesos(m.monto)} · ${m.dia} · ${mot}`);
      d.close(); EF.cuenta = undefined; EF.movs = null;
      EF.msg = `Anulado. Lo que debería haber: <b>${esc(pesos(res.saldo))}</b>.`;
      repintar();
    } catch (e) { err.textContent = e.message || H.mensajeError(e); b.disabled = false; b.textContent = 'Anular'; }
  });
}

// v0.119.0 · Recibir en la caja de administración lo que dejó una caja (un clic: la plata ya está en la mano)
async function recibir(x, b, H, repintar) {
  if (!x) return;
  const { esc, pesos } = H;
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    const res = await FS.recibirDeCaja(x.id);
    H.registrar('Efectivo: recibió de una caja', `${M.TEXTO_CAJA[x.motivo] || ''} · ${M.textoSucursal(x.sucursal)} · ${pesos(x.monto)} · ${x.dia}`);
    EF.cuenta = undefined; EF.movs = null; EF.porRecibir = null; EF.mes = String(x.dia || '').slice(0, 7) || EF.mes;
    EF.msg = `Listo. Lo que debería haber en la caja de administración: <b>${esc(pesos(res.saldo))}</b>.`;
  } catch (e) {
    EF.porRecibir = null; EF.err = e.message || H.mensajeError(e);
  }
  repintar();
}
