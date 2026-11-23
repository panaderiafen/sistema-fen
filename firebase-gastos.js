// Sistema Fën — conexión con la base nueva de Gastos (proyecto Firebase fen-gastos)  v0.43.0 · v0.45.0: idToken()
// Proyecto aparte (como fen-b2b y fen-produccion): cuota propia; solo entra la cuenta de administración.
// Todo lo de fen-gastos entra por este archivo. Se conecta recién cuando hay configuración guardada.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, setPersistence,
  browserLocalPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, initializeFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  query, where, orderBy, limit, serverTimestamp, getAggregateFromServer, sum, count,
  onSnapshot, runTransaction, addDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// v0.137.1 (20 nov): la conexión por streaming de Firestore se quedó colgada (Abriendo… sin fin); la consulta larga (long polling) sí
// responde. initializeFirestore solo se puede llamar una vez por app: si ya existe, se usa la que hay.
const conLargo = app => { try { return initializeFirestore(app, { experimentalForceLongPolling: true }); } catch (e) { return getFirestore(app); } };
let actual = null;   // { proyecto, app, auth, db }

// Instancia con nombre propio ("fen-gastos"): su sesión se guarda aparte de la de Sistema Fën y la caja.
export async function conectar(cfg) {
  if (actual && actual.proyecto === cfg.projectId) return actual;
  if (actual) { try { await deleteApp(actual.app); } catch (e) {} actual = null; }
  const app = initializeApp(cfg, 'fen-gastos');
  const auth = getAuth(app);
  await auth.authStateReady();
  actual = { proyecto: cfg.projectId, app, auth, db: conLargo(app) };
  return actual;
}
export const conectado = () => actual;

export async function entrar(correo, clave, soloSesion) {
  await setPersistence(actual.auth, soloSesion ? browserSessionPersistence : browserLocalPersistence);
  return (await signInWithEmailAndPassword(actual.auth, correo, clave)).user;
}
export async function salir() { if (actual) await signOut(actual.auth); }
// v0.45.0: token de la sesión de fen-gastos, para que el script de Gastos lea y desmarque lo que pasa a la planilla
export async function idToken() { if (!actual || !actual.auth.currentUser) throw new Error('Sin sesión en la base nueva de Gastos.'); return actual.auth.currentUser.getIdToken(); }

export {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  query, where, orderBy, limit, serverTimestamp, getAggregateFromServer, sum, count,
  onSnapshot, runTransaction, addDoc, Timestamp
};
