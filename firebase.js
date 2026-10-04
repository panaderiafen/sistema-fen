// Sistema Fën — conexión con Firebase (mismo proyecto que la caja: fen-ventas).
// Todo lo de Firebase entra por este archivo, así se puede cambiar de versión en un solo lugar.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc, increment,
  query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Instancia con nombre propio: Sistema Fën guarda su sesión aparte de la caja, aunque
// estén en el mismo sitio (panaderiafen.github.io). Así entrar, salir o revocar aquí
// nunca cambia ni cierra la cuenta abierta en la caja de ese navegador.
const app = initializeApp(window.FEN_SIS.firebase, 'sistema-fen');
export const auth = getAuth(app);
export const db = getFirestore(app);
export {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
  collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc, increment,
  query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp, runTransaction
};
