import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { ApiError, api } from '../services/api';

const fieldClassName =
  'w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500';

/** Dialog ganti kata sandi untuk pengguna yang sedang login. */
export const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setMessage({ tone: 'error', text: 'Konfirmasi kata sandi baru tidak sama.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setMessage({ tone: 'success', text: 'Kata sandi berhasil diganti.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Gagal mengganti kata sandi.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#121620] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Ganti Kata Sandi
          </h3>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {message && (
          <p className={`text-xs ${message.tone === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{message.text}</p>
        )}

        <label className="block text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Kata sandi lama</span>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={fieldClassName} />
        </label>
        <label className="block text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Kata sandi baru (minimal 8 karakter)</span>
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={fieldClassName} />
        </label>
        <label className="block text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Ulangi kata sandi baru</span>
          <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} className={fieldClassName} />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
        </button>
      </form>
    </div>
  );
};
