import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Eye, EyeOff, Info, KeyRound } from 'lucide-react';
import { currentDialog, settleDialog, subscribeDialog } from '../services/dialogStore';

const MIN_PASSWORD_LENGTH = 8;

/** Menampilkan dialog dari `dialogStore` (konfirmasi, pemberitahuan, isian kata sandi). */
export const DialogHost: React.FC = () => {
  const dialog = useSyncExternalStore(subscribeDialog, currentDialog);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const primaryRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setError('');
    if (dialog?.kind === 'password') {
      inputRef.current?.focus();
    } else {
      primaryRef.current?.focus();
    }
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  const cancelAnswer = dialog.kind === 'password' ? null : false;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog.kind === 'password') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
        return;
      }
      settleDialog(password);
      return;
    }
    settleDialog(true);
  };

  const Icon = dialog.kind === 'password' ? KeyRound : dialog.danger ? AlertTriangle : Info;
  const iconTone = dialog.danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600';
  const title = dialog.title ?? (dialog.kind === 'confirm' ? 'Konfirmasi' : dialog.kind === 'password' ? 'Kata Sandi Baru' : 'Pemberitahuan');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => settleDialog(cancelAnswer)}>
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className={`shrink-0 p-2 rounded-xl ${iconTone}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 id="app-dialog-title" className="text-sm font-bold text-slate-900">
              {title}
            </h3>
            <p id="app-dialog-message" className="text-sm text-slate-600 whitespace-pre-line">
              {dialog.message}
            </p>
          </div>
        </div>

        {dialog.kind === 'password' && (
          <div className="space-y-1">
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-label="Kata sandi baru"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 pr-11 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {dialog.kind !== 'notice' && (
            <button
              type="button"
              data-modal-close
              onClick={() => settleDialog(cancelAnswer)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Batal
            </button>
          )}
          <button
            ref={primaryRef}
            type="submit"
            {...(dialog.kind === 'notice' ? { 'data-modal-close': true } : {})}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${dialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {dialog.confirmLabel ?? (dialog.kind === 'notice' ? 'Oke' : dialog.kind === 'password' ? 'Simpan' : 'Ya, lanjutkan')}
          </button>
        </div>
      </form>
    </div>
  );
};
