import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

/**
 * Email yang selalu dianggap Owner, walau belum ada di daftar pengguna.
 * Harus sama dengan daftar di firestore.rules (fungsi isBootstrapOwner).
 */
export const BOOTSTRAP_OWNER_EMAILS = ['ahmadfadlitaufik@gmail.com'];

/** Koleksi daftar pengguna yang diizinkan masuk; ID dokumen = email huruf kecil. */
export const STAFF_COLLECTION = 'kalima_users';

export { doc, setDoc, getDoc, getDocFromServer, onSnapshot };
