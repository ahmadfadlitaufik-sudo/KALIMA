import React, { useState } from 'react';
import { KeyRound, ArrowRight, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice, PasswordInput, inputClassName, primaryButtonClassName } from './AuthFormParts';

/** Pembuatan akun Owner pertama; hanya tampil selama belum ada pengguna sama sekali. */
export const SetupPanel: React.FC = () => {
  const { completeSetup } = useAuth();
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
        <h2 className="text-2xl font-bold text-white tracking-tight">Pengaturan Awal</h2>
        <p className="text-xs text-slate-400 mt-1">
          Buat kata sandi untuk akun Owner <strong className="text-slate-200">ahmadfadlitaufik@gmail.com</strong>.
          Halaman ini hanya muncul sekali.
        </p>
      </div>

      {message && <ErrorNotice>{message}</ErrorNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="setup-token" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Kode Pengaturan
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              id="setup-token"
              type="text"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Kode dari pengembang"
              className={inputClassName}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="setup-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nama Anda
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              id="setup-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmad Fadli"
              className={inputClassName}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="setup-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Kata Sandi Baru
          </label>
          <PasswordInput id="setup-password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Minimal 8 karakter" />
        </div>

        <div>
          <label htmlFor="setup-password-confirmation" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Ulangi Kata Sandi
          </label>
          <PasswordInput
            id="setup-password-confirmation"
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            autoComplete="new-password"
            placeholder="Ketik ulang kata sandi"
          />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClassName}>
          <span>{loading ? 'Memproses...' : 'Buat Akun Owner'}</span>
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};
