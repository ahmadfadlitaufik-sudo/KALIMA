import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SetupPanel } from './SetupPage';
import { ErrorNotice, PasswordInput, inputClassName, labelClassName, primaryButtonClassName } from './AuthFormParts';

const SignInPanel: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const error = await signIn(email, password);
    setLoading(false);
    if (error) {
      setMessage(error);
      setPassword('');
      passwordRef.current?.focus();
    }
  };

  const isRateLimited = message?.startsWith('Terlalu banyak') ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Masuk</h1>
        <p className="text-sm text-slate-600 mt-1">Pakai email dan kata sandi akun Kalima Anda.</p>
      </div>

      {message && <ErrorNotice tone={isRateLimited ? 'warning' : 'error'}>{message}</ErrorNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className={labelClassName}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className={inputClassName}
            required
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="login-password" className={labelClassName}>
            Kata sandi
          </label>
          <PasswordInput ref={passwordRef} id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClassName}>
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Memproses…</span>
            </>
          ) : (
            <>
              <span>Masuk</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="pt-4 border-t border-slate-200 text-sm text-slate-600">Lupa kata sandi? Minta Owner mengatur ulang lewat menu Pengguna.</p>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { status, errorMessage } = useAuth();

  useEffect(() => {
    document.title = status === 'setup' ? 'Pengaturan Awal — Kalima' : 'Masuk — Kalima';
  }, [status]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <main className="w-full max-w-md space-y-6">
        <img src="/brand/kalima-logo-dark.png" alt="Kalima" className="h-9 w-auto mx-auto" />
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8">
          {status === 'loading' ? (
            <div role="status" className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="text-sm text-slate-600">Memeriksa sesi…</span>
            </div>
          ) : status === 'error' ? (
            <div className="space-y-4">
              <ErrorNotice>{errorMessage || 'Tidak bisa terhubung ke server.'}</ErrorNotice>
              <button type="button" onClick={() => window.location.reload()} className={primaryButtonClassName}>
                Muat ulang
              </button>
            </div>
          ) : status === 'setup' ? (
            <SetupPanel />
          ) : (
            <SignInPanel />
          )}
        </div>
        <p className="text-center text-xs text-slate-500">© {new Date().getFullYear()} Kalima Apparel Indonesia</p>
      </main>
    </div>
  );
};
