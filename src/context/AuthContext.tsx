import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, SessionUser, api } from '../services/api';
import { User } from '../types';

export type AuthStatus = 'loading' | 'setup' | 'signedOut' | 'authorized' | 'error';

interface AuthContextType {
  status: AuthStatus;
  /** Pengguna aplikasi; hanya terisi saat status = 'authorized'. */
  appUser: User | null;
  errorMessage: string | null;
  /** Kembalikan pesan error, atau null bila berhasil. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Buat Owner pertama; kembalikan pesan error, atau null bila berhasil. */
  completeSetup: (token: string, name: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Ganti nama tampilan sendiri; kembalikan pesan error, atau null bila berhasil. */
  updateName: (name: string) => Promise<string | null>;
  /** Kembali ke halaman login tanpa memanggil server (sesi sudah habis). */
  markSignedOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toAppUser = (user: SessionUser): User => ({
  id: String(user.id),
  email: user.email,
  name: user.name,
  role: user.role,
});

const messageOf = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [appUser, setAppUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authorize = (user: SessionUser) => {
    setAppUser(toAppUser(user));
    setStatus('authorized');
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await api.me();
        if (user) {
          authorize(user);
          return;
        }
        setStatus((await api.setupStatus()) ? 'setup' : 'signedOut');
      } catch (error) {
        setErrorMessage(messageOf(error));
        setStatus('error');
      }
    };
    void checkSession();
  }, []);

  const markSignedOut = useCallback(() => {
    setAppUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    status,
    appUser,
    errorMessage,
    signIn: async (email, password) => {
      try {
        authorize(await api.login(email, password));
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    completeSetup: async (token, name, password) => {
      try {
        authorize(await api.setup(token, name, password));
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    signOut: async () => {
      try {
        await api.logout();
      } finally {
        markSignedOut();
      }
    },
    updateName: async (name) => {
      try {
        setAppUser(toAppUser(await api.updateProfile(name)));
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    markSignedOut,
  }), [status, appUser, errorMessage, markSignedOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
