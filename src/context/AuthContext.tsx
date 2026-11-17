import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, db, doc, onSnapshot, BOOTSTRAP_OWNER_EMAILS, STAFF_COLLECTION } from '../services/firebase';
import { User, UserRole } from '../types';

/** Data pengguna yang diizinkan masuk, disimpan di kalima_users/{email}. */
export interface StaffRecord {
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  createdBy?: string;
}

export type AuthStatus = 'loading' | 'signedOut' | 'unverified' | 'unauthorized' | 'authorized' | 'error';

interface AuthContextType {
  status: AuthStatus;
  /** Pengguna aplikasi; hanya terisi saat status = 'authorized'. */
  appUser: User | null;
  /** Email akun Firebase yang sedang masuk (juga saat belum diizinkan). */
  firebaseEmail: string | null;
  errorMessage: string | null;
  signInWithGoogle: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  registerWithEmail: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  resendVerification: () => Promise<string | null>;
  recheckVerification: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isBootstrapOwnerEmail = (email: string): boolean =>
  BOOTSTRAP_OWNER_EMAILS.includes(email.trim().toLowerCase());

/** Menerjemahkan kode error Firebase Auth ke pesan Bahasa Indonesia. */
export const describeAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email atau kata sandi salah.',
    'auth/wrong-password': 'Email atau kata sandi salah.',
    'auth/user-not-found': 'Email atau kata sandi salah.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/email-already-in-use': 'Email ini sudah punya akun. Silakan masuk, atau pakai "Lupa kata sandi".',
    'auth/weak-password': 'Kata sandi minimal 6 karakter.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    'auth/popup-closed-by-user': 'Jendela login Google ditutup sebelum selesai.',
    'auth/cancelled-popup-request': 'Jendela login Google ditutup sebelum selesai.',
    'auth/popup-blocked': 'Browser memblokir jendela login Google. Izinkan pop-up lalu coba lagi.',
    'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase Console.',
    'auth/unauthorized-domain': 'Domain ini belum didaftarkan di Firebase Console (Authentication → Settings → Authorized domains).',
    'auth/network-request-failed': 'Tidak ada koneksi internet.',
  };
  return messages[code] ?? `Gagal: ${code || (error as Error)?.message || 'kesalahan tidak dikenal'}`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [appUser, setAppUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationCheck, setVerificationCheck] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setFirebaseUser(user);
    setVerificationCheck((n) => n + 1);
  }), []);

  // Cocokkan akun Firebase dengan daftar pengguna (live, agar pencabutan akses langsung berlaku).
  useEffect(() => {
    setAppUser(null);
    setErrorMessage(null);

    if (!firebaseUser) {
      setStatus('signedOut');
      return;
    }

    const email = firebaseUser.email?.trim().toLowerCase();
    if (!email) {
      setStatus('unauthorized');
      return;
    }

    if (!firebaseUser.emailVerified) {
      setStatus('unverified');
      return;
    }

    setStatus('loading');
    const isBootstrapOwner = isBootstrapOwnerEmail(email);

    return onSnapshot(
      doc(db, STAFF_COLLECTION, email),
      (snap) => {
        const record = snap.exists() ? (snap.data() as StaffRecord) : null;
        const isActiveStaff = record !== null && record.active === true;

        if (!isBootstrapOwner && !isActiveStaff) {
          setAppUser(null);
          setStatus('unauthorized');
          return;
        }

        setAppUser({
          id: firebaseUser.uid,
          email,
          name: record?.name || firebaseUser.displayName || email,
          role: isBootstrapOwner ? 'owner' : record!.role,
          avatar: firebaseUser.photoURL ?? undefined,
        });
        setStatus('authorized');
      },
      (error) => {
        console.warn('Gagal membaca daftar pengguna:', error);
        setAppUser(null);
        setErrorMessage('Gagal memeriksa hak akses. Periksa koneksi internet lalu muat ulang halaman.');
        setStatus('error');
      },
    );
  }, [firebaseUser, verificationCheck]);

  const runAuthAction = async (action: () => Promise<unknown>): Promise<string | null> => {
    try {
      await action();
      return null;
    } catch (error) {
      return describeAuthError(error);
    }
  };

  const value = useMemo<AuthContextType>(() => ({
    status,
    appUser,
    firebaseEmail: firebaseUser?.email ?? null,
    errorMessage,
    signInWithGoogle: () => runAuthAction(() => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, provider);
    }),
    signInWithEmail: (email, password) =>
      runAuthAction(() => signInWithEmailAndPassword(auth, email.trim(), password)),
    registerWithEmail: (email, password) =>
      runAuthAction(async () => {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(credential.user);
      }),
    resetPassword: (email) => runAuthAction(() => sendPasswordResetEmail(auth, email.trim())),
    resendVerification: () =>
      runAuthAction(async () => {
        if (auth.currentUser) {
          await sendEmailVerification(auth.currentUser);
        }
      }),
    recheckVerification: async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        setFirebaseUser(auth.currentUser);
        setVerificationCheck((n) => n + 1);
      }
    },
    signOut: () => firebaseSignOut(auth),
  }), [status, appUser, firebaseUser, errorMessage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
