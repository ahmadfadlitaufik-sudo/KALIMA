import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

export const inputClassName =
  'w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all';

export const primaryButtonClassName =
  'w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer';

export const ErrorNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200 bg-rose-500/10 border border-rose-500/30 text-rose-300">
    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
    <span>{children}</span>
  </div>
);

/** Kolom kata sandi dengan tombol tampilkan/sembunyikan. */
export const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
}> = ({ id, value, onChange, autoComplete, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
        <Lock className="w-4 h-4" />
      </div>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClassName} pr-10`}
        required
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
