// ═══════════════════════════════════════════════
//  Sistema Fën — Informe "Gastos sin cargo" (Gastos → Bandeja)  v0.81.0
//  Reglas puras, sin red ni pantalla. SOLO LEE: no cambia nada en la base.
//  Para cada gasto de la Bandeja que espera su cargo del banco busca, en TODAS las cartolas ya subidas (de la memoria):
//   · un cargo del mismo monto (±$1) en su ventana (20 días antes a 60 después), y qué se hizo con él;
//   · otro gasto vigente igual (mismo folio del mismo proveedor, o mismo monto con fecha cercana): posible repetido;
//   · varios gastos del mismo proveedor que juntos suman un cargo (un pago por varias facturas);
//   · y si no hay nada: si su fecha ya está cubierta por la cartola (ya debió llegar) o todavía puede llegar.
// ═══════════════════════════════════════════════
const s = v => String(v ?? '');
const n = v => Number(v) || 0;
const dia = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(v)); return m ? m[0] : ''; };
const utc = f => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diasEntre = (a, b) => (dia(a) && dia(b) ? Math.round((utc(dia(b)) - utc(dia(a))) / 864e5) : NaN);
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const rutN = r => s(r).toUpperCase().replace(/[^0-9K]/g, '');

export const VENTANA = [-20, 60];        // el cargo, de 20 días antes a 60 días después de la fecha del gasto
export const DIAS_REPETIDO = 10;         // mismo monto con fechas a 10 días o menos
export const MARGEN_LLEGAR = 10;         // si la cartola cubre hasta 10 días después del gasto, su cargo ya debió llegar
export const MAX_COMBO = 4;              // hasta 4 gastos que juntos suman un cargo

export const GRUPOS = [
  ['revisar', 'Su cargo está por revisar en la cartola', 'Hay un cargo del mismo monto sin revisar: cálzalo en la Bandeja (lado del banco).'],
  ['repetido', 'Posible repetido', 'Hay otro gasto igual. Si es el mismo, uno de los dos sobra: no anules nada todavía, lo vemos juntos.'],
  ['otro', 'Su cargo se usó para otra cosa', 'Hay un cargo del mismo monto, pero ya quedó resuelto de otra forma (dice cómo).'],
  ['combo', 'Varios gastos suman un cargo', 'Un solo pago del banco por varias facturas del mismo proveedor.'],
  ['sin', 'Sin cargo en el banco (ya debió llegar)', 'Ningún cargo calza y la cartola ya cubre su fecha: probablemente se pagó en efectivo, con tarjeta, desde otra cuenta (Mercado Pago) o con plata personal.'],
  ['espera', 'Todavía puede llegar', 'Su fecha es posterior a la última cartola subida: el cargo puede venir en la próxima.'],
];
export const NOMBRE_ACCION = {
  nuevo: 'se creó un gasto nuevo desde la cartola', gasto: 'se unió a otro gasto ya registrado', vencimientos: 'pagó un vencimiento', sii_pend: 'se clasificó una factura del SII al conciliar',
  previred: 'pago de Previred', previred_planilla: 'se unió a la planilla de Previred', abono: 'abono de sueldo', abono_parcial: 'abono (pago parcial)', traspaso: 'traspaso entre cuentas propias',
  pago_parcial: 'pago parcial', repetido: 'repetido de otra cartola',
};
export function queSeHizo(c) {
  if (!c) return '';
  if (c.estado === 'POR_REVISAR') return 'está por revisar';
  if (c.estado === 'IGNORADO') return 'se marcó "No es gasto"';
  if (c.estado === 'A_MEDIAS') return 'quedó conciliado en parte';
  return NOMBRE_ACCION[c.accion] || (c.accion ? `se resolvió como "${c.accion}"` : 'quedó conciliado');
}

// Los subconjuntos (2 a MAX_COMBO) de una lista chica que suman objetivo (±1)
function combos(lista, objetivo, max = MAX_COMBO) {
  const out = [], L = lista.slice(0, 14);
  const rec = (i, sel, suma) => {
    if (out.length >= 3) return;
    if (sel.length >= 2 && Math.abs(suma - objetivo) <= 1) { out.push(sel.slice()); return; }
    if (sel.length >= max || suma > objetivo + 1) return;
    for (let k = i; k < L.length; k++) { sel.push(L[k]); rec(k + 1, sel, suma + L[k].monto); sel.pop(); }
  };
  rec(0, [], 0);
  return out;
}

// E = { items (de la Bandeja: M.items), cargos (todos los cargos de las cartolas subidas), registrados (D.registrados),
//       ligados ({ cargoId → [gastos unidos] }), cartolas (D.cartolas), hoy }
export function revisar(E = {}) {
  const hoy = dia(E.hoy);
  const gastos = (E.items || []).filter(it => it.tipo === 'gasto' && it.ref && it.ref.gasto).map(it => {
    const g = it.ref.gasto;
    return { key: it.key, ids: (it.ids && it.ids.gastos) || [], fecha: dia(g.fecha || it.fecha), monto: n(g.monto || it.monto), folio: s(it.folio || g.folio), rut: rutN(it.rut || g.rut), razon: s(it.razon || g.razon),
      titulo: (s(it.razon || g.razon) ? s(it.razon || g.razon) + (s(it.folio || g.folio) ? ' · F. ' + s(it.folio || g.folio) : '') : '') || (g.items || []).filter(Boolean).join(' + ') || s(it.titulo), items: g.items || [], origen: g.planilla ? 'Copiado de la planilla antigua' : s(g.chip) || 'A mano', obs: s(g.obs), medio: s(g.medio) };
  });
  const cargos = (E.cargos || []).filter(c => c && c.estado !== 'REPETIDO' && !c.quitadoEnPlanilla && dia(c.fecha)).map(c => ({ ...c, monto: Math.abs(n(c.monto)), fecha: dia(c.fecha) }));
  const hasta = (E.cartolas || []).map(c => dia(c.hasta)).filter(Boolean).sort().pop() || cargos.map(c => c.fecha).sort().pop() || '';
  const enVentana = (g, c) => { const d = diasEntre(g.fecha, c.fecha); return isFinite(d) && d >= VENTANA[0] && d <= VENTANA[1]; };
  const mismoProv = (a, b) => (a.rut && b.rut ? a.rut === b.rut : !!(norm(a.razon) && norm(a.razon) === norm(b.razon)));
  const regs = (E.registrados || []).filter(r => r.tipo === 'gasto' && r.monto > 0);
  const ligados = E.ligados || {};
  const resultado = gastos.map(g => {
    const exactos = cargos.filter(c => Math.abs(c.monto - g.monto) <= 1 && enVentana(g, c)).sort((a, b) => Math.abs(diasEntre(g.fecha, a.fecha)) - Math.abs(diasEntre(g.fecha, b.fecha)));
    const yo = new Set(g.ids);
    // v0.81.0 · El folio es único: dos facturas con folios distintos son compras distintas (aunque tengan el mismo monto)
    const repetidos = regs.filter(r => !(r.ids || []).some(id => yo.has(id)) && !(g.folio && s(r.folio) && s(r.folio) !== g.folio) && (
      (g.folio && s(r.folio) === g.folio && (mismoProv(g, r) || (!r.rut && !g.rut))) ||
      (Math.abs(r.monto - g.monto) <= 1 && Math.abs(diasEntre(g.fecha, r.fecha)) <= DIAS_REPETIDO && (!g.rut || !r.rut || mismoProv(g, r)))))
      .slice(0, 4).map(r => ({ ids: (r.ids || []).slice(0, 40), fecha: r.fecha, monto: r.monto, folio: r.folio, razon: r.razon, items: r.items || [], conCargo: !!r.cargoId, estado: r.estado || '', porFolio: !!(g.folio && s(r.folio) === g.folio) }));
    // v0.81.0 · Un cargo ya unido a otro gasto que no se parece (otro folio, otro proveedor y otro ítem) es una casualidad del monto
    const parecido = l => (g.folio && s(l.folio) === g.folio) || (norm(l.razon) && norm(l.razon) === norm(g.razon)) || (s(l.item) && (g.items || []).some(i => norm(i) === norm(l.item)));
    const hallazgos = exactos.slice(0, 3).map(c => { const lg = (ligados[c.id] || []).slice(0, 4);
      return { cargoId: c.id, fecha: c.fecha, monto: c.monto, descripcion: s(c.descripcion), estado: c.estado, accion: c.accion, que: queSeHizo(c), ligados: lg, casualidad: c.estado !== 'POR_REVISAR' && lg.length > 0 && !lg.some(parecido) }; });
    const reales = hallazgos.filter(h => !h.casualidad);
    let grupo;
    if (reales.some(h => h.estado === 'POR_REVISAR')) grupo = 'revisar';
    else if (repetidos.length || reales.some(h => h.accion === 'nuevo' || h.accion === 'sii_pend')) grupo = 'repetido';
    else if (reales.length) grupo = 'otro';
    else grupo = '';
    return { ...g, hallazgos, repetidos, grupo, combo: null };
  });
  // Varios gastos del mismo proveedor (sin hallazgo) que juntos suman un cargo
  const libres = resultado.filter(r => !r.grupo && (r.rut || norm(r.razon)));
  const usados = new Set();
  libres.forEach(r => {
    if (usados.has(r.key)) return;
    const mismos = libres.filter(o => !usados.has(o.key) && mismoProv(r, o) && Math.abs(diasEntre(r.fecha, o.fecha)) <= 45);
    if (mismos.length < 2) return;
    const total = mismos.reduce((a, x) => a + x.monto, 0);
    const cand = cargos.filter(c => c.monto <= total + 1 && c.monto > r.monto && enVentana(r, c));
    for (const c of cand) {
      const cs = combos(mismos.filter(o => o.monto < c.monto + 1), c.monto);
      const k = cs.find(l => l.some(x => x.key === r.key)) || cs[0];
      if (k) {
        const combo = { cargoId: c.id, fecha: c.fecha, monto: c.monto, descripcion: s(c.descripcion), estado: c.estado, que: queSeHizo(c), gastos: k.map(x => ({ fecha: x.fecha, monto: x.monto, folio: x.folio })) };
        k.forEach(x => { x.grupo = 'combo'; x.combo = combo; usados.add(x.key); });
        break;
      }
    }
  });
  resultado.forEach(r => { if (!r.grupo) r.grupo = hasta && diasEntre(r.fecha, hasta) >= MARGEN_LLEGAR ? 'sin' : 'espera'; });
  const grupos = Object.fromEntries(GRUPOS.map(([k]) => [k, resultado.filter(r => r.grupo === k).sort((a, b) => a.fecha.localeCompare(b.fecha) || b.monto - a.monto)]));
  const resumen = GRUPOS.map(([k, t]) => ({ k, t, n: grupos[k].length, monto: grupos[k].reduce((a, x) => a + x.monto, 0) }));
  const porMes = {}; resultado.forEach(r => { const m = r.fecha.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; });
  return { hoy, hasta, total: resultado.length, monto: resultado.reduce((a, x) => a + x.monto, 0), grupos, resumen, porMes };
}

// CSV (punto y coma, para Excel en español)
export function csv(R) {
  const q = v => `"${s(v).replace(/"/g, '""')}"`;
  const filas = [['Grupo', 'Fecha', 'Proveedor o gasto', 'Folio', 'Monto', 'Origen', 'Qué se encontró'].map(q).join(';')];
  GRUPOS.forEach(([k, t]) => (R.grupos[k] || []).forEach(r => {
    const que = [...r.hallazgos.map(h => `Cargo ${h.fecha} $${h.monto} "${h.descripcion}": ${h.que}${h.ligados.length ? ' (' + h.ligados.map(l => [l.item, l.razon, l.folio ? 'F.' + l.folio : ''].filter(Boolean).join(' ')).join(', ') + ')' : ''}`),
      ...r.repetidos.map(x => `Otro gasto ${x.fecha} $${x.monto}${x.folio ? ' F.' + x.folio : ''} ${x.razon || x.items.join(' + ')}${x.conCargo ? ' (con cargo)' : ''}`),
      r.combo ? `Junto con ${r.combo.gastos.length - 1} más suma el cargo ${r.combo.fecha} $${r.combo.monto} "${r.combo.descripcion}" (${r.combo.que})` : ''].filter(Boolean).join(' | ');
    filas.push([t, r.fecha, r.titulo, r.folio, Math.round(r.monto), r.origen, que].map(q).join(';'));
  }));
  return '﻿' + filas.join('\r\n');
}
