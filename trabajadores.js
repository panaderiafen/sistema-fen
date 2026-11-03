// ═══════════════════════════════════════════════
//  Sistema Fën — Ficha del trabajador y provisión de vacaciones y finiquitos  v0.104.0 · reglas puras, sin red
//  Aprobado por Emmanuel el 26 oct (hoja de ruta v7, sección 5 paso 4). Es de GESTIÓN: que el resultado de cada área cargue cada mes lo que
//  después se paga junto (las vacaciones con su reemplazo, los finiquitos) y saber cuánto apartar. El monto exacto de un finiquito lo calcula
//  el contador (topes en UF y lo que diga cada contrato).
//  · La ficha es la del proveedor (gn_proveedores/r_<RUT>), con sus datos en "trabajador": cargo, ingreso, contrato (plazo fijo o indefinido),
//    vencimiento del plazo fijo y desde cuándo es indefinido. El área (o reparto) es la de la ficha, la misma de Previred.
//  · El sueldo sale de las liquidaciones del Gastos nuevo (origen 'liquidacion'): sueldo base y haberes.
//  · Cada mes con liquidación, por trabajador:
//     vacaciones: 15 días hábiles al año ≈ 21 días corridos; siempre con reemplazo (decidido por Emmanuel) → remuneración × 21/30 ÷ 12;
//     indemnización por años de servicio: solo con contrato indefinido, un mes por año (tope 11 años) → remuneración ÷ 12.
//    La remuneración: el promedio de los haberes de las últimas 3 liquidaciones (hasta ese mes), sin colación, movilización, viáticos ni
//    asignación familiar.
//  · Un pago que usa la provisión (la liquidación de un reemplazo de vacaciones o un finiquito, marcado así en la Bandeja) no es gasto del
//    mes: sale de lo acumulado (cuenta 2.8).
// ═══════════════════════════════════════════════
const s = v => String(v == null ? '' : v).trim();
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const norm = t => s(t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const esIso = f => /^\d{4}-\d{2}-\d{2}$/.test(s(f));
const esMes = m => /^\d{4}-\d{2}$/.test(s(m));
export const DIAS_VACACIONES = 21, TOPE_ANIOS = 11, MESES_PROMEDIO = 3;
export const CONTRATOS = { plazo_fijo: 'Plazo fijo', indefinido: 'Indefinido' };
// v0.124.3 · Término del contrato y documentos del trabajador (boceto aprobado por Emmanuel el 3 nov)
export const CAUSAS = { renuncia: 'Renuncia voluntaria', vencimiento: 'Vencimiento del plazo', mutuo: 'Mutuo acuerdo', necesidades: 'Necesidades de la empresa', despido: 'Despido por causa justificada', otra: 'Otra' };
export const FIRMAS = { notaria: 'Notaría', inspeccion: 'Inspección del Trabajo', dt: 'Finiquito electrónico (DT)', pendiente: 'Todavía no se firma' };
export const TIPOS_DOC = { contrato: 'Contrato de trabajo', renovacion: 'Anexo · renovación del plazo', jornada: 'Anexo · cambio de jornada u horas', anexo: 'Anexo · otro cambio', renuncia: 'Renuncia voluntaria', carta: 'Carta de término', finiquito: 'Finiquito', pago_finiquito: 'Comprobante de pago del finiquito', otro: 'Otro' };
export const MAX_DOCS = 60;
// v0.124.3 · Cómo se renovó un plazo fijo (pedido por Emmanuel el 3 nov): las dos formas cuentan como renovación
export const COMO_RENOVO = { anexo: 'Con un anexo que alarga el plazo', contrato: 'Con un contrato nuevo por otro período' };
const NO_IMPONIBLE = /COLACION|MOVILIZACION|VIATICO|ASIGNACION FAMILIAR|ASIG FAMILIAR|AGUINALDO NO IMPONIBLE/;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaTxt = f => (esIso(f) ? `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}` : '');
const mesesEntre = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) - (Number(b.slice(8, 10) || 31) < Number(a.slice(8, 10) || 1) ? 1 : 0);
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const finMes = m => { const [y, n] = m.split('-').map(Number); return `${m}-${String(new Date(Date.UTC(y, n, 0)).getUTCDate()).padStart(2, '0')}`; };

// ── La ficha ──
export function validarFicha(d) {
  const contrato = d.contrato === 'indefinido' ? 'indefinido' : d.contrato === 'plazo_fijo' ? 'plazo_fijo' : '';
  if (!contrato) throw new Error('Elija el tipo de contrato.');
  if (!esIso(d.ingreso)) throw new Error('Escriba la fecha de ingreso (está en su contrato).');
  const vence = s(d.vence), indefinidoDesde = s(d.indefinidoDesde);
  if (contrato === 'plazo_fijo' && !esIso(vence)) throw new Error('Escriba hasta cuándo es el contrato a plazo fijo.');
  if (vence && vence < d.ingreso) throw new Error('El vencimiento no puede ser antes del ingreso.');
  if (indefinidoDesde && (!esIso(indefinidoDesde) || indefinidoDesde < d.ingreso)) throw new Error('Revise la fecha desde la que es indefinido.');
  const renovaciones = Math.max(0, Math.min(5, Math.round(num(d.renovaciones))));
  // v0.124.3 · La renovación: cómo (anexo o contrato nuevo), hasta cuándo vencía antes y desde cuándo rige (opcionales)
  let renovacion = null;
  if (contrato === 'plazo_fijo' && renovaciones >= 1) {
    const r = d.renovacion || {}, como = COMO_RENOVO[r.como] ? r.como : '', antes = s(r.venciaAntes), dia = s(r.dia);
    if (antes && (!esIso(antes) || antes < d.ingreso)) throw new Error('Revise hasta cuándo vencía antes de la renovación.');
    if (antes && vence && antes >= vence) throw new Error('El vencimiento nuevo tiene que ser después del que tenía antes de la renovación.');
    if (dia && !esIso(dia)) throw new Error('Revise la fecha de la renovación.');
    renovacion = { como, venciaAntes: antes, dia };
  }
  return { cargo: s(d.cargo).slice(0, 60), ingreso: d.ingreso, contrato, vence: contrato === 'plazo_fijo' ? vence : '', indefinidoDesde: contrato === 'indefinido' ? (indefinidoDesde || d.ingreso) : '',
    renovaciones, renovacion, nota: s(d.nota).slice(0, 200), activo: d.activo !== false };
}
// v0.124.3 · El término: último día trabajado, causa, dónde se firmó el finiquito, monto y pago (opcionales)
export function validarTermino(d, ficha) {
  const dia = s(d.dia); if (!esIso(dia)) throw new Error('Escriba el último día trabajado.');
  if (ficha && esIso(ficha.ingreso) && dia < ficha.ingreso) throw new Error('El último día no puede ser antes del ingreso.');
  const causa = CAUSAS[d.causa] ? d.causa : ''; if (!causa) throw new Error('Elija la causa del término.');
  const firma = FIRMAS[d.firma] ? d.firma : '';
  const monto = Math.round(num(String(d.monto == null ? '' : d.monto).replace(/[^\d]/g, ''))); const pagoDia = s(d.pagoDia);
  if (pagoDia && !esIso(pagoDia)) throw new Error('Revise la fecha del pago.');
  return { dia, causa, firma, monto: monto > 0 ? monto : 0, pagoDia, pagoComo: s(d.pagoComo).slice(0, 60), nota: s(d.nota).slice(0, 200) };
}
export const terminado = x => !!(x && x.termino && esIso(x.termino.dia));
export const docsVigentes = x => ((x && x.documentos) || []).filter(d => d && d.estado !== 'no_va');
export const textoTermino = t => (t ? [`Terminó el ${fechaTxt(t.dia)}`, (CAUSAS[t.causa] || '').toLowerCase(), t.firma ? (t.firma === 'pendiente' ? 'finiquito todavía sin firmar' : `finiquito: ${FIRMAS[t.firma].toLowerCase()}`) : ''].filter(Boolean).join(' · ') : '');
// Liquidaciones de meses posteriores al término (por si la fecha está mal)
export const liqsDespues = (x) => (terminado(x) ? (x.liqs || []).filter(l => s(l.mes) > x.termino.dia.slice(0, 7)) : []);
export function antiguedad(ingreso, hoy) {
  if (!esIso(ingreso) || !esIso(hoy) || hoy < ingreso) return { meses: 0, anios: 0, texto: '' };
  const m = Math.max(0, mesesEntre(ingreso, hoy)), a = Math.floor(m / 12), r = m % 12;
  return { meses: m, anios: a, texto: [a ? `${a} ${a === 1 ? 'año' : 'años'}` : '', r ? `${r} ${r === 1 ? 'mes' : 'meses'}` : '', !a && !r ? 'menos de un mes' : ''].filter(Boolean).join(' y ') };
}
// ¿Es indefinido en ese mes? (indefinido desde su fecha, o un plazo fijo que ya pasó a indefinido)
export const indefinidoEn = (t, mes) => !!t && t.contrato === 'indefinido' && s(t.indefinidoDesde || t.ingreso).slice(0, 7) <= mes;
// El contrato hoy: lo que hay que mirar. La ley: un plazo fijo que se renueva por segunda vez, o en que el trabajador sigue después de su
// vencimiento con conocimiento del empleador, pasa a ser indefinido.
export function estadoContrato(t, hoy) {
  if (!t || !t.contrato) return { nivel: 'falta', texto: 'Faltan los datos del contrato (fecha de ingreso y tipo).' };
  if (t.contrato === 'indefinido') return { nivel: 'ok', texto: `Indefinido desde el ${fechaTxt(t.indefinidoDesde || t.ingreso)}.` };
  const d = diasEntre(hoy, t.vence);
  if (d < 0) return { nivel: 'vencido', dias: d, texto: `El plazo fijo venció el ${fechaTxt(t.vence)}. Si sigue trabajando, por ley ya es indefinido: actualice la ficha (o renueve el contrato con el contador).` };
  if (num(t.renovaciones) >= 1) { const r = t.renovacion || {}, como = r.como === 'anexo' ? ' con un anexo' : r.como === 'contrato' ? ' con un contrato nuevo' : '';
    return { nivel: d <= 30 ? 'pronto' : 'ok', dias: d, texto: `Plazo fijo hasta el ${fechaTxt(t.vence)}, ya renovado una vez${como}${esIso(r.venciaAntes) ? ` (antes vencía el ${fechaTxt(r.venciaAntes)})` : ''}: una segunda renovación lo deja indefinido.` }; }
  return { nivel: d <= 30 ? 'pronto' : 'ok', dias: d, texto: `Plazo fijo hasta el ${fechaTxt(t.vence)}${d <= 30 ? ` (en ${d} ${d === 1 ? 'día' : 'días'})` : ''}.` };
}

// ── Las liquidaciones de cada trabajador ──
export const rutDe = clave => (s(clave).startsWith('r_') ? s(clave).slice(2).replace(/_c_.*$/, '') : '');
export function liquidacionesDe(docs, rutN) {
  return (docs || []).filter(d => d && d.origen === 'liquidacion' && d.estado !== 'no_va' && s(d.rutN) === s(rutN) && esMes(d.mes)).sort((a, b) => a.mes.localeCompare(b.mes));
}
export const sueldoBase = liq => { const h = ((liq && liq.liquidacion && liq.liquidacion.haberes) || []).find(x => /SUELDO BASE/.test(norm(x.concepto))); return h ? num(h.monto) : 0; };
// Lo que cuenta como remuneración de un mes: los haberes sin lo no imponible (si no se leyeron, el líquido más los anticipos)
export function remuneracionDe(liq) {
  const L = (liq && liq.liquidacion) || {}, hab = L.haberes || [];
  const t = hab.length ? hab.filter(x => !NO_IMPONIBLE.test(norm(x.concepto))).reduce((a, x) => a + num(x.monto), 0) : num(L.totalHaberes);
  return Math.round(t || num(L.liquido) + num(L.anticipos) || num(liq && liq.total));
}
export function remuneracionBase(liqs, mes) {
  const l = (liqs || []).filter(x => x.mes <= mes).slice(-MESES_PROMEDIO);
  return l.length ? Math.round(l.reduce((a, x) => a + remuneracionDe(x), 0) / l.length) : 0;
}

// ── La provisión de un mes (solo si ese mes tiene liquidación: trabajó ese mes) ──
export function provisionMes(t, liqs, mes) {
  if (!(liqs || []).some(x => x.mes === mes)) return null;
  const base = remuneracionBase(liqs, mes), ant = t && esIso(t.ingreso) ? antiguedad(t.ingreso, finMes(mes)) : { anios: 0 };
  const vac = Math.round(base * DIAS_VACACIONES / 30 / 12);
  const ias = indefinidoEn(t, mes) && ant.anios < TOPE_ANIOS ? Math.round(base / 12) : 0;
  return { base, vac, ias, total: vac + ias, sinFicha: !(t && t.contrato) };
}
// Lo que se debía antes del inicio (va al balance de apertura): la indemnización de los años ya trabajados con contrato indefinido (estimada
// con la remuneración de hoy). Las vacaciones pendientes al inicio dependen de los días ya tomados: se anotan aparte.
export function iasAntesDe(t, liqs, inicio) {
  if (!t || t.contrato !== 'indefinido' || !esIso(t.ingreso) || t.ingreso >= inicio) return 0;
  const base = remuneracionBase(liqs, '9999-12'), anios = Math.min(TOPE_ANIOS, antiguedad(t.ingreso, inicio).anios);
  return Math.round(base * anios);
}

// ── Para todo el equipo ──
// D: { docs, provs }. → [{ clave, rutN, nombre, ficha (trabajador), liqs }]: los que tienen liquidaciones (o ficha de trabajador)
export function equipo(D) {
  const por = {};
  ((D && D.docs) || []).filter(d => d && d.origen === 'liquidacion' && d.estado !== 'no_va' && s(d.rutN)).forEach(d => { const k = 'r_' + d.rutN; if (!por[k]) por[k] = { clave: k, rutN: s(d.rutN), nombre: s(d.razon) }; });
  Object.entries((D && D.provs) || {}).forEach(([k, p]) => { if (p && p.trabajador && !por[k]) por[k] = { clave: k, rutN: rutDe(k), nombre: s(p.razon) || k }; });
  return Object.values(por).map(x => { const p = ((D && D.provs) || {})[x.clave] || {};
    return { ...x, ficha: p.trabajador || null, termino: p.termino || null, documentos: Array.isArray(p.documentosTrab) ? p.documentosTrab : [], liqs: liquidacionesDe(D && D.docs, x.rutN) }; })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
// Las áreas de un trabajador (las de su ficha, o su reparto) → partes del monto, sin perder pesos
export function partesArea(monto, areas) {
  const l = (areas || []).filter(a => a && a.area && num(a.pct) > 0); if (!l.length) return [{ area: 'ADMIN', monto }];
  let resto = monto; const t = l.reduce((a, x) => a + num(x.pct), 0);
  return l.map((a, i) => { const v = i === l.length - 1 ? resto : Math.round(monto * num(a.pct) / t); resto -= v; return { area: s(a.area).toUpperCase(), monto: v }; });
}
// La provisión del mes, por trabajador y área. areasDe(clave) → [{ area, pct }]
export function provisionesDelMes(D, mes, areasDe = () => []) {
  return equipo(D).map(x => { const p = provisionMes(x.ficha, x.liqs, mes); return p && p.total ? { clave: x.clave, nombre: x.nombre, ...p, partes: partesArea(p.total, areasDe(x.clave)) } : null; }).filter(Boolean);
}
// Los pagos que usan la provisión (marcados en la Bandeja): { uso: 'vacaciones' | 'finiquito', de (clave del trabajador) }
export const USOS = { vacaciones: 'Reemplazo de vacaciones', finiquito: 'Finiquito' };
export const usaProvision = d => !!(d && d.provision && USOS[d.provision.uso]);
export function usosDelMes(D, mes) {
  return ((D && D.docs) || []).filter(d => usaProvision(d) && d.estado !== 'no_va' && s(d.mes || s(d.fecha).slice(0, 7)) === mes)
    .map(d => ({ docId: d.id, nombre: s(d.razon), uso: d.provision.uso, de: s(d.provision.de), monto: Math.round(num(d.total)) }));
}
// Acumulado desde el inicio hasta un mes (incluido): provisionado, usado y saldo (lo que se debería tener apartado)
export function saldo(D, inicioMes, hastaMes, areasDe) {
  let prov = 0, usado = 0; const porTrab = {};
  for (let m = inicioMes, k = 0; m <= hastaMes && k < 240; k++) {
    provisionesDelMes(D, m, areasDe).forEach(x => { prov += x.total; const t = porTrab[x.clave] || (porTrab[x.clave] = { nombre: x.nombre, prov: 0, usado: 0 }); t.prov += x.total; });
    usosDelMes(D, m).forEach(u => { usado += u.monto; if (u.de) { const t = porTrab[u.de] || (porTrab[u.de] = { nombre: u.de, prov: 0, usado: 0 }); t.usado += u.monto; } });
    const [y, n] = m.split('-').map(Number); m = n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`;
  }
  return { provisionado: prov, usado, saldo: prov - usado, porTrabajador: porTrab };
}
// Avisos de contratos (para Hoy y la Agenda): los plazos fijos que vencen en 30 días o ya vencieron
export function avisosContratos(D, hoy) {
  return equipo(D).filter(x => x.ficha && x.ficha.activo !== false && !terminado(x) && x.ficha.contrato === 'plazo_fijo').map(x => ({ x, e: estadoContrato(x.ficha, hoy) }))
    .filter(({ e }) => e.nivel === 'vencido' || e.nivel === 'pronto').map(({ x, e }) => ({ f: x.ficha.vence, q: x.nombre.slice(0, 40), v: e.nivel === 'vencido' ? 1 : 0 }));
}
