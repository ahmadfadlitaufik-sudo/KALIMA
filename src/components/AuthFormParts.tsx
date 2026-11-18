import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Info } from 'lucide-react';

export const labelClassName = 'block text-xs font-semibold text-slate-700 mb-1.5';

export const inputClassName =
  'w-full px-3.5 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200 transition-colors';

export const primaryButtonClassName =
  'w-full py-3.5 px-4 rounded-xl segmented-pill-active font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer';

/** Pesan galat; `tone="warning"` untuk pembatasan sementara (bukan kesalahan pengguna). */
export const ErrorNotice: React.FC<{ children: React.ReactNode; tone?: 'error' | 'warning'; id?: string }> = ({ children, tone = 'error', id }) => (
  <div
    id={id}
    role="alert"
    className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 border ${
      tone === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'
    }`}
  >
    {tone === 'warning' ? <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />}
    <span>{children}</span>
  </div>
);

/** Kolom kata sandi dengan tombol tampilkan/sembunyikan. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  {
    id: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: string;
    placeholder?: string;
    describedBy?: string;
  }
>(({ id, value, onChange, autoComplete, placeholder, describedBy }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={describedBy}
        className={`${inputClassName} pr-12`}
        required
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
