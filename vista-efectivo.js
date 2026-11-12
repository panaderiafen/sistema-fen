// ═══════════════════════════════════════════════
//  Sistema Fën — Efectivo → Caja de administración  v0.121.0
//  Aprobado por Emmanuel el 30 oct (lienzo "Boceto · Efectivo de la caja"; mapa v15, cuenta 1.1.6).
//  Cuánto debería haber, lo que entró y salió en el mes, el último conteo y los movimientos, con
//  Ingreso, Salida, Contar y Anular.
//  v0.119.0 (caja v3.0.0): "Por recibir de las cajas": el retiro de cada cierre y los retiros o el sencillo
//  con la caja abierta llegan solos; la administración los recibe con un botón (transacción con el saldo).
//  v0.121.0: "Recibir todos (llegó completo)" y, arriba de la lista, cuánto hay en sobres sin retirar por origen.
//  v0.122.0: cada movimiento muestra "antes" y "saldo"; Contar puede corregir el conteo anterior mal hecho.
//  v0.123.0 (aprobado por Emmanuel el 1 nov): "Por unir a su documento" (los pagos en efectivo, de aquí y de las cajas, se unen a su
//  boleta o factura en Gastos), los depósitos esperan su abono de la cartola, y la pestaña "Retiros por semana".
// ═══════════════════════════════════════════════
import * as M from './efectivo-modelo.js?v=0.126.6';
import * as FS from './efectivo-fs.js?v=0.126.6';

const EF = { mes: '', cuenta: undefined, movs: null, porRecibir: null, posteriores: null, porUnir: null, semana: '', msg: '', err: '', selPr: new Set(), pasados: null };   // v0.124.8: selPr = ids elegidos en Por recibir · v0.124.9: pasados = { mes: [movs] } de los meses anteriores (se leen al abrir "Meses anteriores")
export function olvidar() { EF.cuenta = undefined; EF.movs = null; EF.pasados = null; EF.porRecibir = null; EF.posteriores = null; EF.porUnir = null; EF.pasados = null; FS.olvidarPorUnir(); FS.olvidarSemanas(); }
// v0.124.9 · Plegar "Cómo se llega" y "Meses anteriores" (parten plegadas; se recuerda en este equipo)
const PLEG = 'fen_ef_abiertas';
const abiertas = () => { try { return JSON.parse(localStorage.getItem(PLEG) || '{}') || {}; } catch (e) { return {}; } };
const abrirSec = (k, v) => { try { const a = abiertas(); a[k] = !!v; localStorage.setItem(PLEG, JSON.stringify(a)); } catch (e) { /* sin almacenamiento: queda como esté */ } };
// v0.123.0 · Las dos pestañas de Efectivo
const pestanas = sub => `<div class="pestanas" role="tablist" aria-label="Secciones de Efectivo"><a role="tab" href="#efectivo" aria-selected="${sub !== 'semana'}">Caja de administración</a><a role="tab" href="#efectivo/semana" aria-selected="${sub === 'semana'}">Retiros por semana</a></div>`;

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// v0.119.1 · Movimientos con el saldo que quedó después de cada uno (como una cartola)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const diaTexto = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${DIAS[new Date(y, m - 1, dd).getDay()]} ${dd} ${MESES[m - 1].slice(0, 3)}`; };
// De dónde viene lo que está por recibir
const textoPr = x => (x.origen === 'b2b' ? `Efectivo de un cliente B2B · ${x.cliente || ''} · ${M.refB2b(x)}` : `${M.TEXTO_CAJA[x.motivo] || ''} · ${M.textoSucursal(x.sucursal)}`);
// v0.121.0 · Lo que entra a la caja de administración (retiros de una caja o efectivo B2B); el sencillo sale
const entraPr = x => x.tipo === 'retiro' || x.origen === 'b2b';
// Cuánto hay sin retirar, por origen (solo lo que entra): [[texto, monto], …] con monto > 0
export function porOrigen(lista) {
  const t = { barros_arana: 0, ainavillo: 0, b2b: 0 };
  (lista || []).filter(entraPr).forEach(x => { const k = x.origen === 'b2b' ? 'b2b' : x.sucursal; if (k in t) t[k] += Math.round(Number(x.monto) || 0); });
  return [['Barros Arana', t.barros_arana], ['Ainavillo', t.ainavillo], ['B2B', t.b2b]].filter(x => x[1] > 0);
}
const mesTexto = k => { const [y, m] = k.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };

export async function pintarEfectivo(el, sub, H) {
  if (sub === 'semana') return pintarSemana(el, H);   // v0.123.0
  const { esc, info, pesos } = H;
  const hoy = hoyLocal();
  if (!EF.mes) EF.mes = hoy.slice(0, 7);
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-efectivo">Efectivo</h1><p>Caja de administración: el efectivo que sale de las cajas y el de los clientes B2B</p></div>${pestanas(sub)}</div>
    <section class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></section>`;
  try {
    if (EF.cuenta === undefined) EF.cuenta = await FS.leerCuenta();
    if (EF.porRecibir === null) EF.porRecibir = await FS.leerPorRecibir();
    // v0.123.0 · Los pagos por unir (de aquí y de las cajas) y los depósitos que esperan su abono. Si no se puede leer, el resto sigue.
    if (EF.porUnir === null) { try { EF.porUnir = await FS.leerPorUnir(); } catch (e) { console.warn('Efectivo: sin los pagos por unir', e); EF.porUnir = false; } }
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
  // v0.124.9 · El mes en curso: cómo se llega a lo que debería haber (sale de lo ya leído: el mes elegido o los posteriores)
  const mesHoy = hoy.slice(0, 7);
  const movsHoy = EF.mes === mesHoy ? EF.movs.lista : (EF.posteriores || []).filter(m => m.mes === mesHoy);
  const cq = c ? M.cuadreMes(movsHoy, c.saldo) : null;
  const abiertasNow = abiertas();
  const saldos = c ? M.saldosDespues([...EF.movs.lista, ...(EF.posteriores || [])], c.saldo) : {};
  const uc = c && c.ultimoConteo;
  const ucTxt = !uc ? 'Sin conteo todavía' : uc.corrige ? 'Corrigió el conteo anterior' : uc.inicial ? 'Conteo inicial' : (Math.round(uc.diferencia || 0) === 0 ? 'Cuadró' : `Diferencia ${uc.diferencia > 0 ? '+' : ''}${pesos(uc.diferencia)}`);
  const chipTipo = m => m.tipo === 'ingreso' ? '<span class="chip c-verde">Ingreso</span>' : m.tipo === 'salida' ? '<span class="chip c-amarillo">Salida</span>' : '<span class="chip c-gris">Conteo</span>';
  const msDe = t => (t && t.toMillis ? t.toMillis() : 0), msConteo = uc ? msDe(uc.en) : 0;
  // Lo anterior al último conteo ya quedó cuadrado por ese conteo: no se anula (se hace un conteo nuevo)
  const unido = m => m.estado === 'unido' || m.estado === 'uniendo';
  const anulable = m => m.tipo !== 'conteo' && !m.anulado && !unido(m) && !(msConteo && msDe(m.creado) && msDe(m.creado) < msConteo);
  // v0.123.0 · Por unir: un pago se une aquí a su documento; un depósito, solo, con su abono de la cartola. Unido: con qué.
  const chipUnion = m => m.anulado ? '' : m.estado === 'unido' ? `<span class="chip c-verde ef-unido">${esc(M.textoUnido(m))}</span>`
    : m.estado === 'uniendo' ? '<span class="chip c-amarillo" title="Se está uniendo a su abono: termine en Ventas a empresas → Conciliación">Uniendo a su abono</span>'
    : m.estado !== 'por_unir' ? '' : m.motivo === 'pago' || m.motivo === 'anticipo' ? `<button type="button" class="btn btn-chico" data-unir="${esc(m.id)}">${m.motivo === 'anticipo' ? 'Unir a su liquidación' : 'Unir a su documento'}</button>`
    : '<span class="chip c-amarillo" title="Se une solo con su abono cuando se sube la cartola (Ventas a empresas → Conciliación)">Por unir · con la cartola</span>';
  const fila = m => {
    const signo = m.tipo === 'ingreso' ? '+ ' : m.tipo === 'salida' ? '− ' : '';
    const acc = m.anulado ? `<span class="chip c-gris">Anulado</span>`
      : `${chipUnion(m)}${anulable(m) ? `<button type="button" class="btn-sec btn-chico" data-anular="${esc(m.id)}">Anular</button>` : ''}`;
    return `<div class="fila-caja ef-fila${m.anulado ? ' ef-anulado' : ''}"><div class="txt">
        <b>${chipTipo(m)} ${esc(M.textoMotivo(m.tipo, m.motivo))}</b>
        <span>${esc(diaTexto(m.dia))}${M.detalleTexto(m) ? ' · ' + esc(M.detalleTexto(m)) : ''}${m.por ? ' · ' + esc(m.por) : ''}</span>
        ${m.anulado ? `<span class="nota">Anulado por ${esc(m.anulado.por || '')}${m.anulado.motivo ? ': “' + esc(m.anulado.motivo) + '”' : ''}</span>` : ''}</div>
      <div class="acciones"><span class="ef-monto-col"><span class="ef-monto ef-${esc(m.tipo)}">${signo}${pesos(m.monto)}</span>${saldos[m.id] != null ? `<span class="ef-saldo">antes ${pesos(M.saldoAntesDe(m, saldos[m.id]))} · saldo ${pesos(saldos[m.id])}</span>` : ''}</span>${acc}</div></div>`;
  };
  const meses = M.mesesHasta(hoy);
  // v0.119.0 · Lo que las cajas dejaron para la caja de administración
  // v0.120.0: también el efectivo de clientes B2B marcado como pagado en Cobranza
  const pr = (EF.porRecibir || []).filter(x => M.movPorRecibir(x)).sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || msDe(a.creado) - msDe(b.creado));
  const filaPr = x => {
    const entra = entraPr(x);
    // v0.124.8 · Lo que entra se puede marcar para recibir varios de una vez (con 2 o más que entran)
    const cas = entra && entran.length >= 2 ? `<label class="check-b2b ef-sel-pr"><input type="checkbox" data-sel-pr="${esc(x.id)}" ${EF.selPr.has(x.id) ? 'checked' : ''} aria-label="Marcar ${esc(textoPr(x))} · ${esc(pesos(x.monto))}"></label>` : '';
    return `<div class="fila-caja ef-fila${cas ? ' ef-fila-sel' : ''}">${cas}<div class="txt">
        <b>${entra ? '<span class="chip c-verde">Entra</span>' : '<span class="chip c-amarillo">Sale</span>'} ${esc(textoPr(x))}</b>
        <span>${esc(diaTexto(x.dia))}${x.por ? ' · ' + esc(x.por) : ''}${x.nota ? ' · ' + esc(x.nota) : ''}</span></div>
      <div class="acciones"><span class="ef-monto ef-${entra ? 'ingreso' : 'salida'}">${entra ? '+ ' : '− '}${pesos(x.monto)}</span><button type="button" class="btn btn-chico" data-recibir="${esc(x.id)}">${entra ? 'Recibir' : 'Confirmar salida'}</button>${x.origen === 'b2b' ? `<button type="button" class="btn-link btn-chico" data-anular-pr="${esc(x.id)}">Anular</button>` : ''}</div></div>`;
  };
  const totPr = pr.reduce((a, x) => a + (entraPr(x) ? 1 : -1) * Math.round(Number(x.monto) || 0), 0);
  const porLlegar = pr.filter(entraPr).reduce((a, x) => a + Math.round(Number(x.monto) || 0), 0), nLlegar = pr.filter(entraPr).length;
  // v0.124.9 · Bloques de "Cómo se llega" (entró / salió / partió) para el mes en curso y para cada mes anterior
  const filaMonto = ([t, n]) => `<div class="ef-cq-fila"><span>${esc(t)}</span><span class="nowrap">${pesos(n)}</span></div>`;
  const bloquesCuadre = (q, partio) => `<div class="ef-cq">
      <div class="ef-cq-b"><b>${esc(partio)}</b><div class="ef-cq-fila"><span>Debería haber al empezar</span><b class="nowrap">${pesos(q.inicio)}</b></div>${q.ultimoConteo ? `<div class="ef-cq-fila ef-cq-nota"><span>Conteo del ${esc(diaTexto(q.ultimoConteo.dia))}</span><span class="nowrap">${pesos(q.ultimoConteo.monto)} · ${q.ultimoConteo.diferencia ? (q.ultimoConteo.diferencia > 0 ? 'sobraron ' : 'faltaron ') + pesos(Math.abs(q.ultimoConteo.diferencia)) : 'cuadró'}</span></div>` : ''}${q.conteos ? `<div class="ef-cq-fila"><span>${q.conteoInicial ? 'Conteo inicial' : 'Ajuste de los conteos'}</span><span class="nowrap">${q.conteos > 0 ? '+' : '−'}${pesos(Math.abs(q.conteos))}</span></div>` : ''}</div>
      <div class="ef-cq-b ef-cq-entra"><b>+ Entró · ${pesos(q.entro)}</b>${q.entradas.length ? q.entradas.map(filaMonto).join('') : '<div class="ef-cq-fila"><span>Nada todavía</span></div>'}</div>
      <div class="ef-cq-b ef-cq-sale"><b>− Salió · ${pesos(q.salio)}</b>${q.salidas.length ? q.salidas.map(filaMonto).join('') : '<div class="ef-cq-fila"><span>Nada todavía</span></div>'}</div></div>`;
  const P = EF.pasados, mesesAntes = M.mesesHasta(hoy).filter(k => k < mesHoy);
  const cuadrePasados = c && P && P.porMes ? M.cuadreMeses({ ...P.porMes, [mesHoy]: movsHoy }, [...mesesAntes, mesHoy], c.saldo).filter(x => x.mes < mesHoy) : null;
  // v0.121.0 · Sobres sin retirar por origen y "Recibir todos" (con 2 o más que entran)
  const origenes = porOrigen(pr), entran = pr.filter(entraPr);
  EF.selPr = new Set([...EF.selPr].filter(id => entran.some(x => x.id === id)));   // lo ya recibido o anulado sale de la selección
  const elegidos = () => entran.filter(x => EF.selPr.has(x.id));
  const textoBtnRt = () => { const l = elegidos(); return l.length ? `Recibir lo seleccionado (${l.length} · ${pesos(l.reduce((a, x) => a + Math.round(Number(x.monto) || 0), 0))})` : 'Recibir todos'; };
  // v0.123.0 · Por unir a su documento: los pagos en efectivo de aquí y de las cajas; y los depósitos que esperan su abono
  const pu = (EF.porUnir || []).filter(M.esPagoPorUnir).sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || msDe(a.creado) - msDe(b.creado));
  const deps = (EF.porUnir || []).filter(M.esDepositoAbierto);
  const filaPu = x => { const ant = M.esAnticipo(x); return `<div class="fila-caja ef-fila"><div class="txt">
      <b>${ant ? '<span class="chip c-azul">Anticipo</span>' : '<span class="chip c-amarillo">Pago</span>'} ${esc(x.detalle || 'Proveedor')}</b>
      <span>${esc(diaTexto(x.dia))} · ${ant ? `espera la liquidación de ${esc(mesTexto(x.mesSueldo || String(x.dia || '').slice(0, 7)))}` : `${esc(M.textoOrigenEfectivo(x))}${x.documento ? ' · N° ' + esc(x.documento) : ' · sin N°'}`}${x.por ? ' · ' + esc(x.por) : ''}</span></div>
    <div class="acciones"><span class="ef-monto ef-salida">− ${pesos(x.monto)}</span><button type="button" class="btn btn-chico" data-unir="${esc(x.id)}" data-col="${esc(x.col || '')}">${ant ? 'Unir a su liquidación' : 'Unir a su documento'}</button></div></div>`; };
  el.innerHTML = `<div class="cabecera"><div><h1 id="t-efectivo">Efectivo ${info('Caja de administración', 'Es la cuenta 1.1.6 del plan de gestión: el efectivo que no está en una caja de venta. Entra lo que se retira de las cajas al cerrar y el efectivo de clientes B2B; sale a depósitos al banco, pagos en efectivo y sencillo para las cajas.\n"Debería haber" es el último conteo más lo que entró menos lo que salió desde entonces. Cuente de vez en cuando con "Contar": si no cuadra, la diferencia queda anotada y el saldo pasa a ser lo contado.\nNada se borra: un movimiento equivocado se anula, con su motivo.')}</h1><p>Caja de administración: el efectivo que sale de las cajas y el de los clientes B2B</p></div>${pestanas(sub)}</div>
    ${EF.msg ? `<div class="aviso" role="status">${EF.msg}</div>` : ''}${EF.err ? `<p class="error" role="alert">${esc(EF.err)}</p>` : ''}
    ${!c ? `<section class="tarjeta" aria-labelledby="t-ef-inicio"><div class="titulo-fila"><h2 id="t-ef-inicio">Para empezar</h2></div>
        <p class="ayuda" style="margin:0 0 12px">Cuente cuánto efectivo hay hoy en la caja de administración. Desde ese monto, Sistema Fën lleva la cuenta con cada ingreso y salida.</p>
        <button type="button" class="btn" id="ef-contar">Hacer el conteo inicial</button></section>` : `
    <h2 class="ef-mes-hoy">${esc(mesTexto(mesHoy).replace(/^./, x => x.toUpperCase()))} · hasta hoy</h2>
    <div class="cifras cifras-4">
      <div class="tarjeta cifra ef-cifra-fuerte"><span class="rotulo">Debería haber en la caja</span><span class="valor" id="ef-deberia">${pesos(c.saldo)}</span><span class="nota">Lo que ya llegó, menos lo que salió</span>
        <span class="ef-del-mes" id="ef-del-mes">En ${esc(MESES[Number(mesHoy.slice(5, 7)) - 1])}: entró ${pesos(cq.entro)} · salió ${pesos(cq.salio)}${cq.conteos ? ` · conteos ${cq.conteos > 0 ? '+' : '−'}${pesos(Math.abs(cq.conteos))}` : ''} · neto <b class="${cq.fin - cq.inicio < 0 ? 'ef-rojo' : ''}">${cq.fin - cq.inicio < 0 ? '−' : ''}${pesos(Math.abs(cq.fin - cq.inicio))}</b><br>De antes: ${pesos(cq.inicio)}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Todavía no llega</span><span class="valor" id="ef-por-llegar">${pesos(porLlegar)}</span><span class="nota">${nLlegar ? `${nLlegar} ${nLlegar === 1 ? 'sobre' : 'sobres'} en Por recibir` : 'Nada en Por recibir'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Faltó al recibir</span><span class="valor${cq.faltante ? ' ef-rojo' : ''}" id="ef-falto">${pesos(cq.faltante)}</span><span class="nota">${cq.nFalt ? `${cq.nFalt} ${cq.nFalt === 1 ? 'sobre llegó' : 'sobres llegaron'} con menos, sin saber en qué se usó` : 'Este mes, todo llegó completo'}</span></div>
      <div class="tarjeta cifra"><span class="rotulo">Último conteo</span><span class="valor">${uc ? esc(diaTexto(uc.dia)) : '—'}</span><span class="nota">${uc ? `Contado ${esc(pesos(uc.monto))} · ` : ''}${esc(ucTxt)}</span></div>
    </div>
    <details class="tarjeta ef-plegable" id="ef-como" data-pleg="como" ${abiertasNow.como ? 'open' : ''}>
      <summary class="titulo-fila"><h2>Cómo se llega a los ${pesos(c.saldo)}</h2><span class="nota">Todo el efectivo del negocio hoy: ${pesos(c.saldo)} en la caja + ${pesos(porLlegar)} por llegar = <b id="ef-total-negocio">${pesos(c.saldo + porLlegar)}</b></span></summary>
      ${bloquesCuadre(cq, mesesAntes.length ? 'Quedó del mes anterior' : 'Partió con')}
      <p class="ayuda">Un sobre que llegó con menos entra completo y en el mismo momento sale lo que faltó: como pago hecho con esa plata (queda Por unir a su boleta) o como faltante. Por eso los dos aparecen en "Salió".</p>
    </details>
    ${mesesAntes.length ? `<details class="tarjeta ef-plegable" id="ef-meses" data-pleg="meses" ${abiertasNow.meses ? 'open' : ''}>
      <summary class="titulo-fila"><h2>Meses anteriores</h2><span class="nota">${mesesAntes.length}</span></summary>
      ${!cuadrePasados ? `<div class="vacio" style="border:0">${P && P.error ? esc(P.error) : 'Cargando…'}</div>` : cuadrePasados.map(q => `<details class="ef-mes-ant" data-mes-ant="${q.mes}"><summary><span><b>${esc(mesTexto(q.mes).replace(/^./, x => x.toUpperCase()))}</b></span><span>Quedó <b>${pesos(q.fin)}</b> en la caja de administración</span></summary>${bloquesCuadre(q, 'Partió con')}<button type="button" class="btn-link btn-chico" data-ver-mes="${q.mes}">Ver los movimientos de ${esc(mesTexto(q.mes))}</button></details>`).join('')}
    </details>` : ''}
    <div class="ef-botones">
      <button type="button" class="btn" id="ef-ingreso">Ingreso</button>
      <button type="button" class="btn" id="ef-salida">Salida</button>
      <button type="button" class="btn-sec" id="ef-contar">Contar la caja de administración</button>
    </div>`}
    ${pr.length ? `<section class="tarjeta" aria-labelledby="t-ef-pr">
      <div class="titulo-fila"><h2 id="t-ef-pr">Por recibir ${info('Por recibir', 'Lo que tiene que llegar a la caja de administración: el retiro de cada cierre de caja (lo contado menos el fondo que queda), los retiros con la caja abierta y el efectivo de clientes B2B marcado como pagado en Cobranza. También el sencillo que se llevó a una caja desde aquí.\nRecíbalo cuando la plata esté en sus manos: recién entonces cambia lo que debería haber.\nSi llegó menos, escriba cuánto llegó y explique la diferencia: un pago hecho con esa plata (queda Por unir a su boleta o factura en Gastos) o un faltante con su motivo.')}</h2><span class="nota">${pr.length} · ${pesos(totPr)}</span></div>
      ${origenes.length || entran.length >= 2 ? `<div class="ef-pr-resumen">${origenes.length ? `<p class="ef-pr-origen" id="ef-pr-origen">En sobres sin retirar: ${origenes.map(([t, n]) => `<span class="nowrap">${esc(t)} <b>${pesos(n)}</b></span>`).join(' · ')}</p>` : ''}${entran.length >= 2 ? `<button type="button" class="btn-sec btn-chico" id="ef-recibir-todos">${esc(textoBtnRt())}</button>` : ''}</div>` : ''}
      ${pr.map(filaPr).join('')}</section>` : ''}
    ${pu.length || deps.length ? `<section class="tarjeta" aria-labelledby="t-ef-pu" id="ef-por-unir">
      <div class="titulo-fila"><h2 id="t-ef-pu">Por unir a su documento ${info('Por unir a su documento', 'Cada pago en efectivo (de aquí o de una caja) se une a su boleta o factura en Gastos. Al unir, el documento queda pagado en efectivo en Gastos, con la fecha del pago, y aquí dice "Unido".\nSi el documento todavía no está en Gastos, regístrelo allá como "Gasto sin banco" (en efectivo) y vuelva: aparece para unirlo.\nLos depósitos al banco no se unen aquí: se unen solos con su abono cuando se sube la cartola (Ventas a empresas → Conciliación).')}</h2><span class="nota">${pu.length} ${pu.length === 1 ? 'pago' : 'pagos'} · ${pesos(pu.reduce((a, x) => a + Math.round(Number(x.monto) || 0), 0))}</span></div>
      ${pu.map(filaPu).join('')}
      ${deps.length ? `<p class="ayuda ef-deps">${deps.length} ${deps.length === 1 ? 'depósito espera' : 'depósitos esperan'} su abono en la cartola (${pesos(deps.reduce((a, x) => a + Math.round(Number(x.monto) || 0), 0))}). Se unen al conciliar los abonos en <a href="#b2b/conciliacion">Ventas a empresas → Conciliación</a>.</p>` : ''}</section>` : ''}
    ${EF.porUnir === false ? '<p class="aviso">No se pudieron leer los pagos por unir. Vuelva a abrir Efectivo.</p>' : ''}
    <section class="tarjeta" aria-labelledby="t-ef-movs">
      <div class="titulo-fila"><h2 id="t-ef-movs">Movimientos</h2>
        <select id="ef-mes" aria-label="Mes">${meses.map(k => `<option value="${k}" ${k === EF.mes ? 'selected' : ''}>${esc(mesTexto(k))}</option>`).join('')}</select></div>
      ${lista.length ? `<div data-colapsar="15">${lista.map(fila).join('')}</div>` : `<div class="vacio">Sin movimientos en ${esc(mesTexto(EF.mes))}.</div>`}
      <p class="nota-i">(i) Desde la caja v3.0.0, lo que se retira de cada caja llega solo a "Por recibir". Lo de antes (o de una caja cerrada desde aquí sin retiro) se anota a mano: Ingreso → Retiro de una caja.</p>
    </section>`;
  EF.msg = ''; EF.err = '';
  const repintar = () => pintarEfectivo(el, sub, H);
  const $q = s => el.querySelector(s);
  $q('#ef-mes').addEventListener('change', e => { EF.mes = e.target.value; repintar(); });
  // v0.124.9 · Plegables: se recuerda si quedaron abiertos; los meses anteriores se leen la primera vez que se abren
  const cargarPasados = () => {
    if (EF.pasados) return;
    EF.pasados = { cargando: true };
    Promise.all(mesesAntesL.map(k => (EF.movs && EF.movs.mes === k ? Promise.resolve(EF.movs.lista) : FS.leerMes(k)).then(l => [k, l])))
      .then(par => { EF.pasados = { porMes: Object.fromEntries(par) }; })
      .catch(e => { EF.pasados = { error: H.mensajeError(e) }; })
      .finally(() => { if (el.isConnected && el.querySelector('#ef-meses')) repintar(); });
  };
  const mesesAntesL = M.mesesHasta(hoyLocal()).filter(k => k < hoyLocal().slice(0, 7));
  el.querySelectorAll('details[data-pleg]').forEach(dt => dt.addEventListener('toggle', () => { abrirSec(dt.dataset.pleg, dt.open); if (dt.dataset.pleg === 'meses' && dt.open) cargarPasados(); }));
  if ($q('#ef-meses') && $q('#ef-meses').open) cargarPasados();
  el.querySelectorAll('[data-ver-mes]').forEach(b => b.addEventListener('click', () => { EF.mes = b.dataset.verMes; repintar(); setTimeout(() => { const t = el.querySelector('#t-ef-movs'); if (t) t.scrollIntoView({ block: 'start' }); }, 50); }));
  $q('#ef-contar') && $q('#ef-contar').addEventListener('click', () => dialogoMov('conteo', H, repintar));
  $q('#ef-ingreso') && $q('#ef-ingreso').addEventListener('click', () => dialogoMov('ingreso', H, repintar));
  $q('#ef-salida') && $q('#ef-salida').addEventListener('click', () => dialogoMov('salida', H, repintar));
  el.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', () => dialogoAnular(lista.find(m => m.id === b.dataset.anular), H, repintar)));
  el.querySelectorAll('[data-recibir]').forEach(b => b.addEventListener('click', () => recibir(pr.find(x => x.id === b.dataset.recibir), b, H, repintar)));
  $q('#ef-recibir-todos') && $q('#ef-recibir-todos').addEventListener('click', () => { const l = elegidos(); dialogoRecibirTodos(l.length ? l : entran, H, repintar, !!l.length); });
  el.querySelectorAll('[data-sel-pr]').forEach(c => c.addEventListener('change', () => {
    if (c.checked) EF.selPr.add(c.dataset.selPr); else EF.selPr.delete(c.dataset.selPr);
    const b = $q('#ef-recibir-todos'); if (b) b.textContent = textoBtnRt();
  }));
  el.querySelectorAll('[data-anular-pr]').forEach(b => b.addEventListener('click', () => dialogoAnularPr(pr.find(x => x.id === b.dataset.anularPr), H, repintar)));
  // v0.123.0 · Unir a su documento (desde la lista Por unir o desde la fila del movimiento)
  el.querySelectorAll('[data-unir]').forEach(b => b.addEventListener('click', () => {
    const col = b.dataset.col || '', m = pu.find(x => x.id === b.dataset.unir && (x.col || '') === col) || (col ? null : lista.find(x => x.id === b.dataset.unir));
    if (m) dialogoUnir(m, H, repintar);
  }));
}

function dialogoMov(tipo, H, repintar) {
  const { esc, pesos } = H, hoy = hoyLocal(), saldo = Math.round(Number(EF.cuenta && EF.cuenta.saldo) || 0);
  const ucD = EF.cuenta && EF.cuenta.ultimoConteo; // v0.122.0 · el conteo que se puede corregir
  const titulo = { ingreso: 'Ingreso de efectivo', salida: 'Salida de efectivo', conteo: EF.cuenta ? 'Contar la caja de administración' : 'Conteo inicial' }[tipo];
  const chips = (nombre, lista, sel) => `<div class="chips" role="radiogroup">${lista.map(([k, t], i) => `<label class="chip-radio"><input type="radio" name="${nombre}" value="${k}" ${(sel ? k === sel : i === 0) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>`;
  const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>${esc(titulo)}</h2>
    ${tipo === 'conteo' ? `<p class="ayuda">${EF.cuenta ? `Según los movimientos debería haber <b>${pesos(saldo)}</b>. Escriba lo que contó: si no cuadra, la diferencia queda anotada.` : 'Escriba cuánto efectivo hay hoy en la caja de administración.'}</p>` : `
    <fieldset class="campo"><legend>${tipo === 'ingreso' ? 'De dónde viene' : 'A dónde va'}</legend>${chips('ef-motivo', M.MOTIVOS[tipo].map(m => [m[0], m[1]]))}</fieldset>
    <fieldset class="campo ef-pide" data-pide="sucursal"><legend>Caja</legend>${chips('ef-suc', M.SUCURSALES)}</fieldset>
    <fieldset class="campo ef-pide" data-pide="banco"><legend>Cuenta del banco</legend>${chips('ef-banco', M.BANCOS)}</fieldset>
    <div class="campo ef-pide" data-pide="proveedor"><label for="ef-prov">A quién se le pagó</label><input id="ef-prov" maxlength="120" placeholder="Nombre del proveedor"></div>
    <div class="campo ef-pide" data-pide="proveedor"><label for="ef-doc">N° de boleta o factura (si la hay)</label><input id="ef-doc" maxlength="40" inputmode="numeric"></div>
    <div class="campo ef-pide" data-pide="trabajador"><label for="ef-trab">Trabajador (de Gastos → Equipo)</label><select id="ef-trab"><option value="">Cargando…</option></select>
      <p class="ayuda">Es parte del sueldo del mes, no un gasto aparte. Queda en Por unir y, cuando suba la liquidación del mes, aparece lista para unirla.</p></div>
    <div class="campo ef-pide" data-pide="detalle"><label for="ef-det">Detalle</label><input id="ef-det" maxlength="120" placeholder="Por ejemplo: cliente y N° de orden"></div>`}
    ${tipo === 'conteo' && ucD ? `<label class="check-linea ef-corrige"><input type="checkbox" id="ef-corrige"> <span>Este conteo <b>corrige el conteo${ucD.inicial ? ' inicial' : ''} del ${esc(diaTexto(ucD.dia))}</b> (${pesos(ucD.monto)}), que estuvo mal contado. La diferencia queda como error de conteo, no como faltante.</span></label>` : ''}
    <div class="campo"><label for="ef-monto">${tipo === 'conteo' ? 'Efectivo contado' : 'Monto'}</label><input id="ef-monto" inputmode="numeric" autocomplete="off" placeholder="$0"></div>
    <div class="campo"><label for="ef-dia">Fecha</label><input id="ef-dia" type="date" value="${hoy}" max="${hoy}"></div>
    <div class="campo"><label for="ef-nota">Nota (opcional)</label><input id="ef-nota" maxlength="200"></div>
    <p class="ayuda" id="ef-prev" aria-live="polite"></p>
    <p class="error" id="ef-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="ef-no">Cancelar</button><button type="submit" class="btn" id="ef-si">Guardar</button></div></form>`);
  const val = n => (d.querySelector(`input[name="${n}"]:checked`) || {}).value;
  // v0.124.9 · Los trabajadores para el anticipo de sueldo (se leen de Gastos la primera vez que se elige)
  let trabs = null;
  const cargarTrabs = () => {
    if (trabs || !d.querySelector('#ef-trab')) return;
    trabs = [];
    fsGN().then(G => G.trabajadoresParaEfectivo()).then(l => { trabs = l;
      d.querySelector('#ef-trab').innerHTML = l.length ? `<option value="">Elija…</option>${l.map(t => `<option value="${esc(t.clave)}">${esc(t.nombre)}</option>`).join('')}` : '<option value="">No hay trabajadores en Gastos → Equipo</option>'; })
      .catch(e => { trabs = null; d.querySelector('#ef-trab').innerHTML = `<option value="">No se pudo leer Gastos (${esc(H.mensajeError(e))})</option>`; });
  };
  const trabElegido = () => { const k = (d.querySelector('#ef-trab') || {}).value; return (trabs || []).find(t => t.clave === k) || null; };
  const leer = () => ({ tipo, motivo: val('ef-motivo'), sucursal: val('ef-suc'), banco: val('ef-banco'), trabajador: trabElegido(),
    detalle: (d.querySelector('#ef-prov') && val('ef-motivo') === 'pago' ? d.querySelector('#ef-prov').value : (d.querySelector('#ef-det') || {}).value) || '',
    documento: (d.querySelector('#ef-doc') || {}).value || '', monto: d.querySelector('#ef-monto').value, dia: d.querySelector('#ef-dia').value, nota: d.querySelector('#ef-nota').value,
    corrige: !!(d.querySelector('#ef-corrige') && d.querySelector('#ef-corrige').checked), corrigeDia: ucD && ucD.dia, corrigeInicial: !!(ucD && ucD.inicial) });
  const vis = () => {
    if (tipo !== 'conteo') {
      const m = M.MOTIVOS[tipo].find(x => x[0] === val('ef-motivo')) || [];
      d.querySelectorAll('.ef-pide').forEach(x => x.classList.toggle('oculto', x.dataset.pide !== m[2]));
      if (m[2] === 'trabajador') cargarTrabs();
    }
    const n = M.leerMonto(d.querySelector('#ef-monto').value), p = d.querySelector('#ef-prev');
    if (!(n >= 0) || d.querySelector('#ef-monto').value === '') { p.textContent = ''; return; }
    const corr = d.querySelector('#ef-corrige') && d.querySelector('#ef-corrige').checked;
    if (tipo === 'conteo') p.textContent = EF.cuenta ? (n === saldo ? 'Cuadra con lo que debería haber.' : corr ? `Error de conteo: ${n - saldo > 0 ? '+' : '−'}${pesos(Math.abs(n - saldo))}. Lo que debería haber queda en ${pesos(n)}; no se anota como faltante.` : `Diferencia: ${n - saldo > 0 ? 'sobran' : 'faltan'} ${pesos(Math.abs(n - saldo))}.`) : '';
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
      EF.cuenta = undefined; EF.movs = null; EF.pasados = null; EF.porUnir = null; FS.olvidarPorUnir(); EF.mes = r.mov.mes;
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
      d.close(); EF.cuenta = undefined; EF.movs = null; EF.pasados = null; EF.porUnir = null; FS.olvidarPorUnir();
      EF.msg = `Anulado. Lo que debería haber: <b>${esc(pesos(res.saldo))}</b>.`;
      repintar();
    } catch (e) { err.textContent = e.message || H.mensajeError(e); b.disabled = false; b.textContent = 'Anular'; }
  });
}

// v0.119.0 · Recibir en la caja de administración lo que dejó una caja o un cobro B2B.
// v0.120.0 (Emmanuel, 31 oct): se pregunta cuánto llegó. Si llegó menos, la diferencia se explica antes de guardar:
// un pago en efectivo hecho con esa plata (proveedor y N°, queda Por unir a su documento en Gastos) o un faltante con su motivo.
// El sencillo que sale hacia una caja se confirma con un clic, como antes.
async function recibir(x, b, H, repintar) {
  if (!x) return;
  const { esc, pesos } = H;
  const entra = x.tipo === 'retiro' || x.origen === 'b2b';
  if (!entra) return guardarRecibir(x, null, b, H, repintar);
  const esperado = Math.round(Number(x.monto) || 0);
  const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>Recibir</h2>
    <p class="ayuda"><b>${esc(textoPr(x))}</b> · ${esc(diaTexto(x.dia))}${x.por ? ' · ' + esc(x.por) : ''}</p>
    <p class="ayuda">Se esperaba <b>${pesos(esperado)}</b>. Escriba lo que de verdad llegó a sus manos.</p>
    <div class="campo"><label for="er-llego">¿Cuánto llegó?</label><input id="er-llego" inputmode="numeric" autocomplete="off" value="${esperado.toLocaleString('es-CL')}"></div>
    <div id="er-dif" class="oculto">
      <p class="ayuda" id="er-dif-txt"></p>
      <div id="er-usos"></div>
      <div class="ef-botones"><button type="button" class="btn-sec btn-chico" id="er-mas-pago">+ Un pago hecho con esa plata</button><button type="button" class="btn-sec btn-chico" id="er-mas-falta">+ Falta y no sé en qué se usó</button></div>
    </div>
    <p class="ayuda" id="er-estado" aria-live="polite"></p>
    <p class="error" id="er-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="er-no">Cancelar</button><button type="submit" class="btn" id="er-si">Recibir</button></div></form>`);
  const usos = d.querySelector('#er-usos');
  let n = 0;
  const filaUso = tipo => {
    const k = ++n;
    const div = document.createElement('div');
    div.className = 'ef-uso'; div.dataset.tipo = tipo;
    div.innerHTML = tipo === 'pago'
      ? `<div class="fila-campos"><div class="campo"><label for="eu-p${k}">A quién se le pagó</label><input id="eu-p${k}" data-u="proveedor" maxlength="120" placeholder="Nombre del proveedor"></div>
         <div class="campo"><label for="eu-d${k}">N° de boleta o factura (si la hay)</label><input id="eu-d${k}" data-u="documento" maxlength="40"></div>
         <div class="campo"><label for="eu-m${k}">Monto</label><input id="eu-m${k}" data-u="monto" inputmode="numeric" autocomplete="off"></div></div>
         <button type="button" class="btn-link btn-chico" data-quitar>Quitar</button>`
      : `<div class="fila-campos"><div class="campo"><label for="eu-t${k}">Qué cree que pasó</label><input id="eu-t${k}" data-u="detalle" maxlength="120" placeholder="Por ejemplo: no sé, se revisa el lunes"></div>
         <div class="campo"><label for="eu-m${k}">Monto</label><input id="eu-m${k}" data-u="monto" inputmode="numeric" autocomplete="off"></div></div>
         <button type="button" class="btn-link btn-chico" data-quitar>Quitar</button>`;
    div.querySelector('[data-quitar]').onclick = () => { div.remove(); vis(); };
    usos.appendChild(div);
    // Si es el único, sugiere todo lo que falta
    const falta = esperado - (M.leerMonto(d.querySelector('#er-llego').value) || 0);
    const yaExp = leerUsos().filter(u => u !== null).reduce((a, u) => a + (M.leerMonto(u.monto) || 0), 0);
    if (falta - yaExp > 0) div.querySelector('[data-u="monto"]').value = (falta - yaExp).toLocaleString('es-CL');
    vis();
    const primero = div.querySelector('input'); if (primero) primero.focus();
  };
  const leerUsos = () => [...usos.querySelectorAll('.ef-uso')].map(u => { const o = { tipo: u.dataset.tipo }; u.querySelectorAll('[data-u]').forEach(i => { o[i.dataset.u] = i.value; }); return o; });
  const leer = () => ({ llego: d.querySelector('#er-llego').value, usos: leerUsos() });
  const vis = () => {
    d.querySelector('#er-err').textContent = '';   // al corregir, se va el aviso anterior
    const llego = M.leerMonto(d.querySelector('#er-llego').value);
    const falta = llego >= 0 ? esperado - llego : 0;
    d.querySelector('#er-dif').classList.toggle('oculto', !(falta > 0));
    d.querySelector('#er-dif-txt').innerHTML = falta > 0 ? `Llegaron <b>${pesos(falta)}</b> menos. Explique en qué se usaron, con uno o más pagos, o como faltante.` : '';
    const exp = leerUsos().reduce((a, u) => a + (M.leerMonto(u.monto) || 0), 0);
    const est = d.querySelector('#er-estado');
    est.textContent = falta > 0 ? (exp === falta ? 'Diferencia explicada.' : `Falta explicar ${pesos(falta - exp)}.`) : (llego >= 0 && llego <= esperado ? `Lo que debería haber sube en ${pesos(llego)}.` : '');
  };
  d.addEventListener('input', vis);
  d.querySelector('#er-mas-pago').onclick = () => filaUso('pago');
  d.querySelector('#er-mas-falta').onclick = () => filaUso('faltante');
  d.querySelector('#er-no').onclick = () => d.close();
  vis();
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#er-err'), bs = d.querySelector('#er-si'); err.textContent = '';
    const rec = leer();
    const r = M.revisarRecepcion(M.movPorRecibir(x), rec);
    if (r.error) { err.textContent = r.error; return; }
    bs.disabled = true; bs.textContent = 'Guardando…';
    const ok = await guardarRecibir(x, r.falta ? rec : null, bs, H, repintar, err);
    if (ok) d.close(); else { bs.disabled = false; bs.textContent = 'Recibir'; }
  });
  setTimeout(() => { const i = d.querySelector('#er-llego'); i.focus(); i.select(); }, 0);
}
async function guardarRecibir(x, rec, b, H, repintar, errEl = null) {
  const { esc, pesos } = H;
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    const res = await FS.recibirDeCaja(x.id, rec, x.col || 'caja_movimientos');
    const llego = rec ? M.leerMonto(rec.llego) : Math.round(Number(x.monto) || 0);
    H.registrar('Efectivo: recibió ' + (x.origen === 'b2b' ? 'de un cliente B2B' : 'de una caja'), `${textoPr(x)} · ${pesos(llego)}${rec ? ` de ${pesos(x.monto)}` : ''} · ${x.dia}`);
    EF.cuenta = undefined; EF.movs = null; EF.pasados = null; EF.porUnir = null; FS.olvidarPorUnir(); EF.porRecibir = null; EF.posteriores = null; EF.mes = String(x.dia || '').slice(0, 7) || EF.mes;
    EF.msg = `Listo. Lo que debería haber en la caja de administración: <b>${esc(pesos(res.saldo))}</b>.`;
    repintar();
    return true;
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || H.mensajeError(e); return false; }
    EF.porRecibir = null; EF.err = e.message || H.mensajeError(e);
    repintar();
    return false;
  }
}

// v0.121.0 · Recibir todos los que entran, completos, en una sola transacción. El sencillo que sale no va aquí.
function dialogoRecibirTodos(lista, H, repintar, seleccion = false) {   // v0.124.8: seleccion = solo lo marcado (puede ser 1)
  if (!lista || lista.length < (seleccion ? 1 : 2)) return;
  const { esc, pesos } = H;
  const total = lista.reduce((a, x) => a + Math.round(Number(x.monto) || 0), 0);
  const tit = seleccion ? 'Recibir lo seleccionado' : 'Recibir todos';
  // v0.124.12 · Cada uno con su "Llegó" (parte con lo esperado). Si llegó menos, se explica ahí mismo: pago con esa plata o faltante.
  // Para repartir la diferencia en varias partes, se recibe aparte con su botón Recibir.
  const d = H.dialogo(`<form class="form-dialogo ef-rt-form" novalidate><h2>${tit}</h2>
    <p class="ayuda">Revise cuánto llegó de cada uno. Si llegó menos, explique la diferencia en esa misma línea.</p>
    <div class="ef-rt-lista">${lista.map((x, i) => `<div class="ef-rt-item" data-i="${i}"><div class="ef-rt-fila"><span>${esc(textoPr(x))} · ${esc(diaTexto(x.dia))}<br><span class="nota">Esperado ${pesos(x.monto)}</span></span>
        <span class="campo ef-rt-llego"><label for="ef-rt-l${i}">Llegó</label><input id="ef-rt-l${i}" data-llego="${i}" inputmode="numeric" autocomplete="off" value="${esc(Math.round(Number(x.monto) || 0).toLocaleString('es-CL'))}"></span></div>
        <div class="ef-rt-dif oculto" data-dif="${i}"><p class="ayuda" data-dif-txt="${i}"></p>
          <div class="chips" role="radiogroup" aria-label="La diferencia"><label class="chip-op"><input type="radio" name="ef-rt-t${i}" value="pago" checked> Pago con esa plata</label><label class="chip-op"><input type="radio" name="ef-rt-t${i}" value="faltante"> Faltante</label></div>
          <div class="fila-campos"><div class="campo"><label for="ef-rt-q${i}" data-q-label="${i}">A quién se le pagó</label><input id="ef-rt-q${i}" data-q="${i}" maxlength="120"></div>
            <div class="campo" data-doc-campo="${i}"><label for="ef-rt-d${i}">N° de boleta o factura (si la hay)</label><input id="ef-rt-d${i}" data-doc="${i}" maxlength="40"></div></div></div></div>`).join('')}
      <div class="ef-rt-fila ef-rt-total"><span>Llegó en total (${lista.length})</span><b class="nowrap" id="ef-rt-total">${pesos(total)}</b></div></div>
    <p class="ayuda" id="ef-rt-sube">Lo que debería haber sube en <b>${pesos(total)}</b>.</p>
    <p class="error" id="ef-rt-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="ef-rt-no">Cancelar</button><button type="submit" class="btn" id="ef-rt-si">${tit}</button></div></form>`);
  d.querySelector('#ef-rt-no').onclick = () => d.close();
  const llegoDe = i => M.leerMonto(d.querySelector(`[data-llego="${i}"]`).value);
  const tipoDe = i => (d.querySelector(`input[name="ef-rt-t${i}"]:checked`) || {}).value || 'pago';
  // La recepción de cada uno: null si llegó completo; si no, { llego, usos: [una parte con toda la diferencia] }
  const recDe = i => {
    const x = lista[i], esp = Math.round(Number(x.monto) || 0), l = llegoDe(i);
    if (l === esp) return null;
    const q = d.querySelector(`[data-q="${i}"]`).value, falta = l >= 0 ? esp - l : 0;
    return { llego: d.querySelector(`[data-llego="${i}"]`).value, usos: falta > 0 ? [tipoDe(i) === 'pago' ? { tipo: 'pago', proveedor: q, documento: d.querySelector(`[data-doc="${i}"]`).value, monto: String(falta) } : { tipo: 'faltante', detalle: q, monto: String(falta) }] : [] };
  };
  const vis = () => {
    d.querySelector('#ef-rt-err').textContent = '';
    let tot = 0;
    lista.forEach((x, i) => {
      const esp = Math.round(Number(x.monto) || 0), l = llegoDe(i), falta = l >= 0 ? esp - l : 0, pago = tipoDe(i) === 'pago';
      tot += l >= 0 ? Math.min(l, esp) : 0;
      d.querySelector(`[data-dif="${i}"]`).classList.toggle('oculto', !(falta > 0));
      d.querySelector(`[data-dif-txt="${i}"]`).innerHTML = falta > 0 ? `Llegaron <b>${pesos(falta)}</b> menos. ¿Qué pasó con esa plata?` : '';
      d.querySelector(`[data-q-label="${i}"]`).textContent = pago ? 'A quién se le pagó' : 'Qué cree que pasó';
      d.querySelector(`[data-q="${i}"]`).placeholder = pago ? 'Nombre del proveedor' : 'Por ejemplo: no sé, se revisa el lunes';
      d.querySelector(`[data-doc-campo="${i}"]`).classList.toggle('oculto', !pago);
    });
    d.querySelector('#ef-rt-total').textContent = pesos(tot);
    d.querySelector('#ef-rt-sube').innerHTML = `Lo que debería haber sube en <b>${pesos(tot)}</b>.`;
  };
  d.addEventListener('input', vis); d.addEventListener('change', vis); vis();
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#ef-rt-err'), b = d.querySelector('#ef-rt-si'); err.textContent = '';
    // Se revisa cada uno antes de guardar (la misma regla que al recibir uno solo)
    const items = [];
    for (let i = 0; i < lista.length; i++) {
      const x = lista[i], rec = recDe(i);
      if (rec) { const r = M.revisarRecepcion(M.movPorRecibir(x), rec); if (r.error) { err.textContent = `${textoPr(x)}: ${r.error}`; const q = d.querySelector(r.falta ? `[data-q="${i}"]` : `[data-llego="${i}"]`); if (q) q.focus(); return; } }
      items.push({ id: x.id, col: x.col || 'caja_movimientos', recepcion: rec });
    }
    b.disabled = true; b.textContent = 'Guardando…';
    try {
      const res = await FS.recibirVarios(items);
      const conMenos = items.filter(x => x.recepcion).length;
      H.registrar((seleccion ? 'Efectivo: recibió lo seleccionado' : 'Efectivo: recibió todos') + (conMenos ? ` (${conMenos} con menos)` : ' (completos)'), `${lista.length} · ${pesos(res.total)} · ${lista.map((x, i) => `${textoPr(x)} ${pesos(llegoDe(i))}${llegoDe(i) !== Math.round(Number(x.monto) || 0) ? ' de ' + pesos(x.monto) : ''}`).join(' · ')}`.slice(0, 900));
      d.close();
      const meses = [...new Set(lista.map(x => String(x.dia || '').slice(0, 7)).filter(Boolean))].sort();
      EF.cuenta = undefined; EF.movs = null; EF.pasados = null; EF.porUnir = null; FS.olvidarPorUnir(); EF.porRecibir = null; EF.posteriores = null; EF.mes = meses[meses.length - 1] || EF.mes;
      EF.selPr = new Set();
      EF.msg = `Listo: ${res.n} recibidos por ${esc(pesos(res.total))}. Lo que debería haber en la caja de administración: <b>${esc(pesos(res.saldo))}</b>.`;
      repintar();
    } catch (e) {
      err.textContent = e.message || H.mensajeError(e);
      b.textContent = tit;
      if (/No se recibió ninguno/.test(err.textContent)) {
        // Algo cambió (otro lo recibió o lo anuló): no se guardó nada; la lista se vuelve a leer al cerrar
        EF.porRecibir = null; b.disabled = true;
        d.querySelector('#ef-rt-no').textContent = 'Cerrar';
        d.addEventListener('close', () => repintar(), { once: true });
      } else b.disabled = false;   // sin conexión u otro error: se puede intentar de nuevo
    }
  });
}

// v0.120.0 · Anular un cobro B2B por recibir (el pago en Cobranza no se toca: si fue un error, se corrige allá)
function dialogoAnularPr(x, H, repintar) {
  if (!x) return;
  const { esc, pesos } = H;
  const d = H.dialogo(`<form class="form-dialogo" novalidate><h2>Anular lo por recibir</h2>
    <p class="ayuda"><b>${esc(textoPr(x))}</b> · ${pesos(x.monto)} · ${esc(diaTexto(x.dia))}</p>
    <p class="ayuda">Úselo si ese efectivo nunca va a llegar a la caja de administración (por ejemplo, el pago se marcó por error). No se borra: queda anulado con su motivo. El folio en Cobranza no cambia.</p>
    <div class="campo"><label for="ap-mot">Motivo</label><input id="ap-mot" maxlength="200"></div>
    <p class="error" id="ap-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="ap-no">Cancelar</button><button type="submit" class="btn btn-peligro" id="ap-si">Anular</button></div></form>`);
  d.querySelector('#ap-no').onclick = () => d.close();
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = d.querySelector('#ap-err'), b = d.querySelector('#ap-si'), mot = d.querySelector('#ap-mot').value.trim();
    if (mot.length < 3) { err.textContent = 'Escriba el motivo.'; return; }
    b.disabled = true; b.textContent = 'Anulando…';
    try {
      await FS.anularPorRecibir(x.id, mot);
      H.registrar('Efectivo: anuló un cobro B2B por recibir', `${textoPr(x)} · ${pesos(x.monto)} · ${mot}`);
      d.close(); EF.porRecibir = null; EF.msg = 'Anulado.'; repintar();
    } catch (e) { err.textContent = e.message || H.mensajeError(e); b.disabled = false; b.textContent = 'Anular'; }
  });
}

// ═══════════════ v0.123.0 · Unir un pago en efectivo a su documento en Gastos ═══════════════
// Primero se paga en Gastos (fen-gastos), con una clave que sale del movimiento; después se marca aquí (fen-ventas). Son dos bases
// distintas: si la segunda parte falla, el pago en Gastos ya quedó y "Unir" otra vez solo termina de marcarlo (no paga dos veces).
const fsGN = () => import('./gn-fs.js?v=0.126.6');
function dialogoUnir(m, H, repintar) {
  const { esc, pesos } = H;
  let docs = null, elegido = '';
  const d = H.dialogo(`<form class="form-dialogo ef-unir" novalidate><h2>Unir a su documento</h2>
    <p class="ayuda"><b>${M.esAnticipo(m) ? 'Anticipo de sueldo' : 'Pago en efectivo'} · ${pesos(m.monto)}</b> · ${esc(diaTexto(m.dia))} · ${esc(m.detalle || '')}${m.documento ? ' · N° ' + esc(m.documento) : ''} · ${esc(M.textoOrigenEfectivo(m))}</p>
    <div class="campo"><label for="eu-q">Buscar en Gastos</label><input id="eu-q" type="search" placeholder="Nombre, RUT o N° del documento" autocomplete="off"></div>
    <div id="eu-lista" class="eu-lista" role="radiogroup" aria-label="Documentos de Gastos"><div class="vacio" style="border:0">Buscando en Gastos…</div></div>
    <p class="ayuda eu-mano"><a href="#gastos" id="eu-mano">No está en Gastos: registrarla a mano</a> · En Gastos use "Registrar gasto sin banco" (en efectivo), con la fecha y el monto de este pago. Después vuelva aquí: aparece como "Ya pagado en efectivo" y se une con un toque.</p>
    <p class="error" id="eu-err" role="alert"></p>
    <div class="botones"><button type="button" class="btn-sec" id="eu-no">Cancelar</button><button type="submit" class="btn" id="eu-si" disabled>Unir</button></div></form>`);
  const lista = d.querySelector('#eu-lista'), err = d.querySelector('#eu-err'), b = d.querySelector('#eu-si');
  const fila = x => {
    const dd = x.d, pag = dd.estado === 'pagado_efectivo';
    const sub = pag ? `Ya pagado en efectivo en Gastos el ${esc(diaTexto(dd.pagoFecha || dd.fecha))} · ${pesos(dd.pagoMonto)}` : `${esc(diaTexto(dd.fecha))} · total ${pesos(dd.total)}${dd.saldo !== dd.total ? ` · falta ${pesos(dd.saldo)}` : ''}`;
    const k = dd.id + '|' + (dd.pagoId || '');
    return `<label class="eu-doc${x.puede ? '' : ' eu-no-puede'}"><input type="radio" name="eu-doc" value="${esc(k)}" ${x.puede ? '' : 'disabled'} ${elegido === k ? 'checked' : ''}>
      <span class="eu-doc-t"><span class="gn-fila"><b>${esc(M.textoDocumento(dd))} · ${esc(dd.razon || dd.rut || 'Sin nombre')}</b>${x.calza ? '<span class="chip c-verde chip-chico">Calza</span>' : ''}</span>
      <small>${sub}${!x.puede ? (pag ? ' · el monto no calza' : ' · el pago es mayor que lo que falta') : !x.calza && !pag ? ` · queda pagado ${pesos(x.monto)} de ${pesos(dd.saldo)}` : ''}</small></span></label>`;
  };
  let cands = [];
  const pintar = () => {
    if (!docs) return;
    cands = M.candidatosUnir(m, docs, d.querySelector('#eu-q').value);
    const ant = M.esAnticipo(m), sinAnt = ant && cands.some(x => x.sinAnticipo);
    lista.innerHTML = (cands.length ? cands.map(fila).join('') : `<div class="vacio" style="border:0">${d.querySelector('#eu-q').value.trim() ? 'Nada con ese texto en lo por pagar de Gastos.' : ant ? `Todavía no está la liquidación de ${esc(mesTexto(m.mesSueldo || String(m.dia || '').slice(0, 7)))} de ${esc(m.detalle || 'este trabajador')}. Súbala en Gastos y vuelva.` : 'No hay documentos por pagar de este proveedor ni del mismo monto. Búsquelo por nombre o N°.'}</div>`)
      + (sinAnt ? '<p class="aviso">La liquidación de ese mes no trae anticipos: revise con la contadora antes de unirla (quizás no se descontó).</p>' : '');
    b.disabled = !cands.some(x => x.puede && x.d.id + '|' + (x.d.pagoId || '') === elegido);
  };
  d.querySelector('#eu-q').addEventListener('input', pintar);
  lista.addEventListener('change', e => { if (e.target.name === 'eu-doc') { elegido = e.target.value; err.textContent = ''; b.disabled = false; } });
  d.querySelector('#eu-no').onclick = () => d.close();
  d.querySelector('#eu-mano').addEventListener('click', () => d.close());
  if (M.esAnticipo(m)) d.querySelector('.eu-mano').hidden = true;   // v0.124.9: un anticipo se une a la liquidación, no a una boleta a mano
  fsGN().then(G => G.docsParaEfectivo(m.id)).then(l => { docs = l; const c = M.candidatosUnir(m, l, ''); if (c[0] && c[0].calza && c[0].puede) elegido = c[0].d.id + '|' + (c[0].d.pagoId || ''); pintar(); })
    .catch(e => { lista.innerHTML = `<p class="error">${esc(e.message || H.mensajeError(e))}</p>`; });
  d.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const x = cands.find(c => c.d.id + '|' + (c.d.pagoId || '') === elegido);
    if (!x || !x.puede) { err.textContent = 'Elija el documento.'; return; }
    b.disabled = true; b.textContent = 'Uniendo…'; err.textContent = '';
    let pago;
    try {
      pago = await (await fsGN()).pagarConEfectivo(x.d, { id: m.id, col: m.col || 'efectivo_movimientos', sucursal: m.sucursal || '', dia: m.dia, monto: x.monto, origen: M.origenEfectivo(m), clave: M.claveUnion(m),
        texto: `Efectivo · ${M.textoOrigenEfectivo(m)} · ${m.detalle || ''}` });
    } catch (e) { err.textContent = e.message || H.mensajeError(e); b.disabled = false; b.textContent = 'Unir'; return; }
    const documento = M.textoDocumento(x.d);
    try { await FS.unir(m, { docId: x.d.id, pagoId: pago.pagoId || '', documento, proveedor: String(x.d.razon || '').slice(0, 120), monto: x.monto }); }
    catch (e) { err.textContent = `Quedó pagado en Gastos, pero no se alcanzó a marcar aquí (${e.message || H.mensajeError(e)}). Toque Unir otra vez: no se paga dos veces.`; b.disabled = false; b.textContent = 'Unir'; return; }
    H.registrar('Efectivo: unió un pago a su documento', `${pesos(m.monto)} · ${m.dia} · ${m.detalle || ''} → ${documento} · ${x.d.razon || ''}`);
    d.close();
    EF.porUnir = null; EF.movs = null; EF.pasados = null; FS.olvidarPorUnir();
    EF.msg = `Listo: unido a ${esc(documento)} de ${esc(x.d.razon || '')}. En Gastos quedó pagado en efectivo.`;
    repintar();
  });
}

// ═══════════════ v0.123.0 · Efectivo → Retiros por semana ═══════════════
// De lunes a domingo, por caja: lo que se retiró, lo que se pagó con la caja, el sencillo y los descuadres. 2 lecturas por semana
// (consultas), guardadas 10 minutos por semana.
const SUCS_SEM = [['barros_arana', 'Barros Arana'], ['ainavillo', 'Ainavillo']];
async function pintarSemana(el, H) {
  const { esc, pesos, info } = H, hoy = hoyLocal();
  if (!EF.semana) EF.semana = M.lunesDe(hoy);
  const lunes = EF.semana, dom = M.sumarDias(lunes, 6), esta = lunes === M.lunesDe(hoy);
  const corto = dd => { const [y, mm, x] = dd.split('-').map(Number); return `${x} ${MESES[mm - 1].slice(0, 3)}`; };
  const cab = `<div class="cabecera"><div><h1 id="t-efectivo">Efectivo</h1><p>Lo que pasó con el efectivo de cada caja, semana a semana</p></div>${pestanas('semana')}</div>
    <div class="ef-sem-nav" role="group" aria-label="Semana"><button type="button" class="btn-sec btn-chico" id="ef-sem-ant" aria-label="Semana anterior">← Anterior</button>
      <b id="ef-sem-t">Lun ${esc(corto(lunes))} al dom ${esc(corto(dom))}${esta ? ' · esta semana' : ''}</b>
      <button type="button" class="btn-sec btn-chico" id="ef-sem-sig" aria-label="Semana siguiente" ${esta ? 'disabled' : ''}>Siguiente →</button></div>`;
  el.innerHTML = cab + '<section class="tarjeta"><div class="vacio" style="border:0">Cargando…</div></section>';
  const enlazar = () => {
    el.querySelector('#ef-sem-ant').onclick = () => { EF.semana = M.sumarDias(lunes, -7); pintarSemana(el, H); };
    el.querySelector('#ef-sem-sig').onclick = () => { if (!esta) { EF.semana = M.sumarDias(lunes, 7); pintarSemana(el, H); } };
  };
  enlazar();
  let r;
  try { const x = await FS.leerSemana(lunes); r = M.resumirSemana(x.evals, x.cmovs, lunes); }
  catch (e) { el.querySelector('.tarjeta').innerHTML = `<p class="error">${esc(H.mensajeError(e))}</p>`; return; }
  if (EF.semana !== lunes) return;   // se cambió de semana mientras cargaba
  const P = r.porSuc, celda = (k, f) => SUCS_SEM.map(([s]) => `<td>${f(P[s])}</td>`).join('');
  const mc = (o, sin = '—') => (o.n ? `${pesos(o.monto)} · ${o.n}` : sin);
  const difTxt = n => (n < 0 ? `falta ${pesos(-n)}` : n > 0 ? `sobra ${pesos(n)}` : 'cuadra');
  const filas = [
    ['Cierres', s => String(s.cierres)],
    ['Retirado al cerrar', s => pesos(s.retiroCierre)],
    ['Retiros con la caja abierta', s => mc(s.retirosAbierta, '$0')],
    ['Pagos desde la caja', s => mc(s.pagos, '$0')],
    ['Sencillo recibido', s => mc(s.sencillo, '$0')],
    ['Descuadres', s => (s.descuadres.n ? `<span class="${s.descuadres.suma < 0 ? 'ef-neg' : ''}">${s.descuadres.n} · ${difTxt(s.descuadres.suma)}</span>` : 'Ninguno')],
    [`Fondo al cerrar (meta ${pesos(M.META_FONDO)})`, s => (s.fondo.n ? `${s.fondo.enMeta} de ${s.fondo.n} en la meta` : '—')]
  ];
  const tabla = `<div class="ef-sem-tabla-c"><table class="ef-sem-tabla"><thead><tr><th scope="col"><span class="sr">Concepto</span></th>${SUCS_SEM.map(([, t]) => `<th scope="col">${esc(t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(([t, f]) => `<tr><th scope="row">${esc(t)}</th>${celda(t, f)}</tr>`).join('')}</tbody></table></div>`;
  const mot = r.motivos.length ? `<ul class="ef-sem-mot">${r.motivos.map(x => `<li><span><b>${esc(x.texto)}</b> · ${esc(M.textoSucursal(x.sucursal))} · ${esc(diaTexto(x.dia))}${x.nota && x.nota !== x.texto ? ` <small>${esc(x.nota)}</small>` : ''}</span><b class="nowrap${x.monto < 0 ? ' ef-neg' : ''}">${difTxt(x.monto)}</b></li>`).join('')}</ul>` : '<div class="vacio" style="border:0">Sin descuadres de efectivo esta semana.</div>';
  el.innerHTML = cab + `<section class="tarjeta" aria-labelledby="t-ef-sem"><div class="titulo-fila"><h2 id="t-ef-sem">Por caja ${info('Retiros por semana', 'Sale de los cierres de cada caja (su evaluación) y de los retiros e ingresos con la caja abierta, de lunes a domingo, por el día de la caja.\nRetirado al cerrar: lo que se sacó en el sobre de cada cierre. Retiros con la caja abierta: los que fueron a la caja de administración. Pagos desde la caja: los pagos a proveedores con plata de la caja.\nDescuadres: los cierres cuyo efectivo no cuadró, con lo que faltó o sobró.\nFondo al cerrar: cuántos cierres dejaron justo la meta de fondo.')}</h2></div>${tabla}</section>
    <section class="tarjeta" aria-labelledby="t-ef-mot"><div class="titulo-fila"><h2 id="t-ef-mot">Descuadres por motivo</h2><span class="nota">${r.motivos.length}</span></div>${mot}</section>`;
  enlazar();
}
