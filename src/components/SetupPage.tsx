import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice, PasswordInput, inputClassName, labelClassName, primaryButtonClassName } from './AuthFormParts';

/** Pembuatan akun Owner pertama; hanya tampil selama belum ada pengguna sama sekali. */
export const SetupPanel: React.FC = () => {
  const { completeSetup, setupEmail } = useAuth();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setMessage('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setLoading(true);
    setMessage(null);
    const error = await completeSetup(token.trim(), name, password);
    setLoading(false);
    if (error) {
      setMessage(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan awal</h1>
        <p className="text-sm text-slate-600 mt-1">
          Buat akun Owner{setupEmail ? <> untuk <strong className="text-slate-900 break-all">{setupEmail}</strong></> : ''}. Halaman ini hanya muncul sekali, sebelum ada pengguna.
        </p>
      </div>

      {message && <ErrorNotice>{message}</ErrorNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="setup-token" className={labelClassName}>
            Kode pengaturan
          </label>
          <input
            id="setup-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-describedby="setup-token-hint"
            className={inputClassName}
            required
            autoFocus
          />
          <p id="setup-token-hint" className="text-xs text-slate-500 mt-1.5">
            Kode rahasia dari pengembang yang memasang aplikasi ini. Hubungi pengembang bila belum menerimanya.
          </p>
        </div>

        <div>
          <label htmlFor="setup-name" className={labelClassName}>
            Nama Anda
          </label>
          <input id="setup-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} required />
        </div>

        <div>
          <label htmlFor="setup-password" className={labelClassName}>
            Kata sandi baru
          </label>
          <PasswordInput id="setup-password" value={password} onChange={setPassword} autoComplete="new-password" describedBy="setup-password-hint" />
          <p id="setup-password-hint" className="text-xs text-slate-500 mt-1.5">
            Minimal 8 karakter. Kata sandi yang terlalu umum (seperti 12345678) akan ditolak.
          </p>
        </div>

        <div>
          <label htmlFor="setup-password-confirmation" className={labelClassName}>
            Ulangi kata sandi
          </label>
          <PasswordInput id="setup-password-confirmation" value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClassName}>
          <span>{loading ? 'Memproses…' : 'Buat akun Owner'}</span>
          {!loading && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
};
