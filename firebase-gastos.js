// Sistema Fën — conexión con la base nueva de Gastos (proyecto Firebase fen-gastos)  v0.43.0
// Proyecto aparte (como fen-b2b y fen-produccion): cuota propia; solo entra la cuenta de administración.
// Todo lo de fen-gastos entra por este archivo. Se conecta recién cuando hay configuración guardada.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, setPersistence,
  browserLocalPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  query, where, orderBy, limit, serverTimestamp, getAggregateFromServer, sum, count,
  onSnapshot, runTransaction, addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let actual = null;   // { proyecto, app, auth, db }

// Instancia con nombre propio ("fen-gastos"): su sesión se guarda aparte de la de Sistema Fën y la caja.
export async function conectar(cfg) {
  if (actual && actual.proyecto === cfg.projectId) return actual;
  if (actual) { try { await deleteApp(actual.app); } catch (e) {} actual = null; }
  const app = initializeApp(cfg, 'fen-gastos');
  const auth = getAuth(app);
  await auth.authStateReady();
  actual = { proyecto: cfg.projectId, app, auth, db: getFirestore(app) };
  return actual;
}
export const conectado = () => actual;

export async function entrar(correo, clave, soloSesion) {
  await setPersistence(actual.auth, soloSesion ? browserSessionPersistence : browserLocalPersistence);
  return (await signInWithEmailAndPassword(actual.auth, correo, clave)).user;
}
export async function salir() { if (actual) await signOut(actual.auth); }

export {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  query, where, orderBy, limit, serverTimestamp, getAggregateFromServer, sum, count,
  onSnapshot, runTransaction, addDoc
};
