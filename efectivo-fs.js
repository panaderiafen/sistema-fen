// ═══════════════════════════════════════════════
//  Sistema Fën — Efectivo · Firestore (fen-ventas)  v0.120.0
//  efectivo/caja_admin           { saldo, ultimoConteo: { dia, monto, diferencia, por, en }, actualizado, por }
//  efectivo_movimientos/{id}     un movimiento (ver efectivo-modelo.js) + { cuenta, creado, por } y, si se anula,
//                                anulado: { por, en, motivo }. Nada se borra.
//  Cada movimiento y el saldo se escriben juntos en una transacción.
//  Lecturas al abrir: 1 (el saldo) + los movimientos del mes elegido (una consulta por mes, sin índices)
//  + lo que las cajas dejaron por recibir (caja_movimientos con pendienteAdmin, una consulta sin índices).
//  v0.119.0 (caja v3.0.0): recibirDeCaja() pasa un retiro de la caja (o el sencillo que salió hacia ella)
//  a la caja de administración y lo marca recibido, todo en la misma transacción.
// ═══════════════════════════════════════════════
import { auth, db, collection, doc, getDoc, getDocs, query, where, Timestamp, runTransaction } from './firebase.js?v=0.120.2';
import { CUENTA, efecto, movPorRecibir, revisarRecepcion } from './efectivo-modelo.js?v=0.120.2';

const correo = () => (auth.currentUser && auth.currentUser.email) || '';
const refCuenta = () => doc(db, 'efectivo', CUENTA);

export async function leerCuenta() {
  const sn = await getDoc(refCuenta());
  return sn.exists() ? sn.data() : null;
}
export async function leerMes(mes) {
  const sn = await getDocs(query(collection(db, 'efectivo_movimientos'), where('mes', '==', mes)));
  return sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.cuenta === CUENTA);
}

// mov: lo que devuelve revisar(). → { id, saldo }
export async function guardar(mov) {
  const ref = doc(collection(db, 'efectivo_movimientos'));
  const ahora = Timestamp.now(), por = correo();
  let saldo = 0;
  await runTransaction(db, async tx => {
    const c = await tx.get(refCuenta());
    const antes = c.exists() ? Math.round(Number(c.data().saldo) || 0) : 0;
    const datos = { ...mov, cuenta: CUENTA, creado: ahora, por };
    let cambios;
    if (mov.tipo === 'conteo') {
      // El conteo deja el saldo en lo contado; la diferencia queda anotada en el movimiento
      datos.diferencia = mov.monto - antes;
      datos.saldoAntes = antes;
      datos.inicial = !c.exists() || !c.data().ultimoConteo;
      saldo = mov.monto;
      cambios = { saldo, ultimoConteo: { dia: mov.dia, monto: mov.monto, diferencia: datos.diferencia, inicial: datos.inicial, por, en: ahora }, actualizado: ahora, por };
    } else {
      saldo = antes + efecto(mov);
      cambios = { saldo, actualizado: ahora, por };
    }
    tx.set(ref, datos);
    if (c.exists()) tx.update(refCuenta(), cambios);
    else tx.set(refCuenta(), { ...cambios, creado: ahora });
  });
  return { id: ref.id, saldo };
}

// Anular un ingreso o una salida (el conteo no se anula: se hace un conteo nuevo). → { saldo }
export async function anular(id, motivo) {
  const ref = doc(db, 'efectivo_movimientos', id);
  const ahora = Timestamp.now(), por = correo();
  let saldo = 0;
  await runTransaction(db, async tx => {
    const m = await tx.get(ref), c = await tx.get(refCuenta());
    if (!m.exists()) throw new Error('El movimiento ya no existe.');
    const d = m.data();
    if (d.anulado) throw new Error('Ese movimiento ya estaba anulado.');
    if (d.tipo === 'conteo') throw new Error('Un conteo no se anula: haga un conteo nuevo.');
    // Lo anterior al último conteo ya quedó cuadrado por ese conteo: anularlo descuadraría el saldo
    const uc = c.exists() && c.data().ultimoConteo, msC = uc && uc.en && uc.en.toMillis ? uc.en.toMillis() : 0, msM = d.creado && d.creado.toMillis ? d.creado.toMillis() : 0;
    if (msC && msM && msM < msC) throw new Error('Es anterior al último conteo, que ya lo incluye. Si hay un error, haga un conteo nuevo.');
    saldo = (c.exists() ? Math.round(Number(c.data().saldo) || 0) : 0) - efecto(d);
    tx.update(ref, { anulado: { por, en: ahora, motivo: String(motivo || '').trim().slice(0, 200) } });
    if (c.exists()) tx.update(refCuenta(), { saldo, actualizado: ahora, por });
  });
  return { saldo };
}

// v0.119.0 · Lo que las cajas dejaron para la caja de administración y aún no se recibe
export async function leerPorRecibir() {
  // v0.120.0: también el efectivo de clientes B2B que queda por recibir (efectivo_por_recibir)
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'caja_movimientos'), where('pendienteAdmin', '==', true))),
    getDocs(query(collection(db, 'efectivo_por_recibir'), where('pendienteAdmin', '==', true)))
  ]);
  return [...a.docs.map(d => ({ id: d.id, col: 'caja_movimientos', ...d.data() })), ...b.docs.map(d => ({ id: d.id, col: 'efectivo_por_recibir', ...d.data() }))]
    .filter(m => !m.anulado && !m.recibido);
}

// v0.120.0 · Un cobro B2B en efectivo queda por recibir (lo marca Cobranza). → id
export async function crearPorRecibirB2B({ folio, cliente, monto, dia, nota }) {
  const ref = doc(collection(db, 'efectivo_por_recibir'));
  const ahora = Timestamp.now();
  await runTransaction(db, async tx => {
    tx.set(ref, { origen: 'b2b', folio: String(folio || ''), cliente: String(cliente || '').slice(0, 120), monto: Math.round(Number(monto) || 0),
      dia, mes: String(dia || '').slice(0, 7), nota: String(nota || '').slice(0, 200), pendienteAdmin: true, por: correo(), creado: ahora });
  });
  return ref.id;
}

// Recibir en la caja de administración lo que dejó una caja o un cobro B2B. → { saldo }
// v0.120.0: recepcion = { llego, usos } cuando llega menos: entra lo esperado y sale, en la misma transacción,
// cada pago hecho con esa plata (Por unir) o el faltante con su motivo. Sin recepcion, llegó completo.
export async function recibirDeCaja(id, recepcion = null, col = 'caja_movimientos') {
  const refOrigen = doc(db, col, id);
  const ahora = Timestamp.now(), por = correo();
  let saldo = 0;
  await runTransaction(db, async tx => {
    const cm = await tx.get(refOrigen), c = await tx.get(refCuenta());
    if (!cm.exists()) throw new Error('Ese movimiento ya no existe.');
    const x = cm.data();
    if (x.anulado) throw new Error('Ese movimiento fue anulado.');
    if (x.recibido || x.pendienteAdmin !== true) throw new Error('Ya estaba recibido.');
    const base = movPorRecibir({ id, ...x });
    if (!base) throw new Error('Ese movimiento no va a la caja de administración.');
    const r = recepcion ? revisarRecepcion(base, recepcion) : { movs: [base], falta: 0 };
    if (r.error) throw new Error(r.error);
    let s = c.exists() ? Math.round(Number(c.data().saldo) || 0) : 0;
    const ids = [];
    r.movs.forEach((m, i) => {
      const ref = doc(collection(db, 'efectivo_movimientos'));
      s += efecto(m);
      // Un milisegundo de diferencia entre cada uno: así el saldo línea por línea queda en orden
      tx.set(ref, { ...m, cuenta: CUENTA, creado: Timestamp.fromMillis(ahora.toMillis() + i), por });
      ids.push(ref.id);
    });
    saldo = s;
    if (c.exists()) tx.update(refCuenta(), { saldo, actualizado: ahora, por });
    else tx.set(refCuenta(), { saldo, actualizado: ahora, por, creado: ahora });
    tx.update(refOrigen, { pendienteAdmin: false, recibido: { por, en: ahora, efectivoId: ids[0], ...(r.falta ? { llego: base.monto - r.falta, falta: r.falta } : {}) } });
  });
  return { saldo };
}

// v0.120.0 · Anular un cobro B2B que quedó por recibir (por ejemplo, el pago se marcó por error). Nada se borra.
export async function anularPorRecibir(id, motivo) {
  const ref = doc(db, 'efectivo_por_recibir', id);
  await runTransaction(db, async tx => {
    const sn = await tx.get(ref);
    if (!sn.exists()) throw new Error('Ya no existe.');
    const x = sn.data();
    if (x.recibido || x.anulado) throw new Error('Ya estaba recibido o anulado.');
    tx.update(ref, { pendienteAdmin: false, anulado: { por: correo(), en: Timestamp.now(), motivo: String(motivo || '').trim().slice(0, 200) } });
  });
}
