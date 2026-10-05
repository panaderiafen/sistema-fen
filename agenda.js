// ═══════════════════════════════════════════════
//  Sistema Fën — agenda  v0.7.0
//  Dos colecciones (reglas v1.3.0):
//   · agenda           lo de Fën: lo ve la administración.
//   · agenda_personal  lo personal: solo lo ve y lo cambia quien lo creó, y no
//                      entra en ningún informe de Fën.
//  Nada se borra: "Quitar" lo marca quitado (queda en Firebase).
//  Las consultas usan un solo campo (no necesitan índices).
// ═══════════════════════════════════════════════
import { auth, db, collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, Timestamp } from './firebase.js?v=0.7.0';

const correo = () => (auth.currentUser && auth.currentUser.email) || '';
const uid = () => (auth.currentUser && auth.currentUser.uid) || '';
const COL = { fen: 'agenda', personal: 'agenda_personal' };
export const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// desde / hasta: 'AAAA-MM-DD', ambos incluidos
export async function leerAgenda(desde, hasta) {
  const [fen, per] = await Promise.all([
    getDocs(query(collection(db, COL.fen), where('fecha', '>=', desde))),
    getDocs(query(collection(db, COL.personal), where('uid', '==', uid())))
  ]);
  const lista = [];
  fen.docs.forEach(d => lista.push({ id: d.id, tipo: 'fen', ...d.data() }));
  per.docs.forEach(d => lista.push({ id: d.id, tipo: 'personal', ...d.data() }));
  return lista.filter(x => !x.quitado && x.fecha >= desde && x.fecha <= hasta)
    .sort((a, b) => (a.fecha + (a.hora || '99:99')).localeCompare(b.fecha + (b.hora || '99:99')));
}

function limpiar(d) {
  const titulo = String(d.titulo || '').trim().slice(0, 120);
  if (!titulo) throw new Error('Escribe qué es');
  if (!DIA_RE.test(d.fecha || '')) throw new Error('Elige la fecha');
  const hora = String(d.hora || '').trim();
  if (hora && !HORA_RE.test(hora)) throw new Error('La hora no es válida');
  return { titulo, fecha: d.fecha, hora, nota: String(d.nota || '').trim().slice(0, 500) };
}

// Agregar o cambiar. Si cambia de Fën a personal (o al revés), se crea en la otra
// colección y el original queda quitado (con la referencia a dónde se fue).
export async function guardar(item, datos, tipo) {
  const c = limpiar(datos);
  const ahora = Timestamp.now();
  if (item && item.tipo === tipo) {
    await updateDoc(doc(db, COL[tipo], item.id), { ...c, editado: ahora, editadoPor: correo() });
    return item.id;
  }
  const base = { ...c, hecho: item ? !!item.hecho : false, quitado: false, creado: ahora, creadoPor: correo(), origen: 'manual' };
  const nuevo = await addDoc(collection(db, COL[tipo]), tipo === 'personal' ? { ...base, uid: uid() } : base);
  if (item) await updateDoc(doc(db, COL[item.tipo], item.id), { quitado: true, quitadoEn: ahora, movidoA: COL[tipo] + '/' + nuevo.id });
  return nuevo.id;
}
export function marcarHecho(item, hecho) {
  return updateDoc(doc(db, COL[item.tipo], item.id), { hecho: !!hecho, hechoEn: hecho ? Timestamp.now() : null });
}
export function quitar(item) {
  return updateDoc(doc(db, COL[item.tipo], item.id), { quitado: true, quitadoEn: Timestamp.now(), quitadoPor: correo() });
}
