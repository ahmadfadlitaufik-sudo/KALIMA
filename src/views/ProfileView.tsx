import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ApiError, api } from '../services/api';

const CARD = 'bg-white rounded-2xl border border-slate-200 p-5 space-y-4';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-500';
const PRIMARY_BUTTON =
  'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const MAX_NAME_LENGTH = 60;
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin / Staf' } as const;

type Message = { tone: 'error' | 'success'; text: string } | null;

const Notice: React.FC<{ message: Message }> = ({ message }) =>
  message ? (
    <div
      role={message.tone === 'error' ? 'alert' : 'status'}
      className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
        message.tone === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {message.tone === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />}
      <span>{message.text}</span>
    </div>
  ) : null;

/** Profil pengguna yang sedang masuk: ganti nama tampilan dan kata sandi. */
export const ProfileView: React.FC = () => {
  const { currentUser, logAudit } = useApp();
  const { updateName } = useAuth();

  const [name, setName] = useState(currentUser.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== currentUser.name;

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    const error = await updateName(trimmedName);
    setSavingName(false);
    if (error) {
      setNameMessage({ tone: 'error', text: error });
      return;
    }
    logAudit('Auth', 'Ubah Profil', `${currentUser.name} mengganti nama tampilan menjadi ${trimmedName}`);
    setName(trimmedName);
    setNameMessage({ tone: 'success', text: 'Nama tampilan disimpan.' });
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setPasswordMessage({ tone: 'error', text: 'Konfirmasi kata sandi baru tidak sama.' });
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      logAudit('Auth', 'Ganti Kata Sandi', `${currentUser.name} mengganti kata sandinya sendiri`);
      setPasswordMessage({ tone: 'success', text: 'Kata sandi berhasil diganti.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (error) {
      setPasswordMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Gagal mengganti kata sandi.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordType = showPasswords ? 'text' : 'password';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start pb-12">
      <form onSubmit={handleSaveName} className={CARD}>
        <h2 className="text-sm font-bold text-slate-900">Info akun</h2>
        <Notice message={nameMessage} />
        <label className="block text-xs">
          <span className="block text-slate-600 font-semibold mb-1">Nama tampilan</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameMessage(null);
            }}
            maxLength={MAX_NAME_LENGTH}
            required
            className={INPUT}
          />
          <span className="block text-[11px] text-slate-500 mt-1">Tampil di pojok atas, sidebar, dan jejak audit. Maksimal {MAX_NAME_LENGTH} karakter.</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="block text-slate-600 font-semibold mb-1">Email</span>
            <div className={`${INPUT} bg-slate-50 text-slate-700 break-all`}>{currentUser.email}</div>
          </div>
          <div>
            <span className="block text-slate-600 font-semibold mb-1">Peran</span>
            <div className={`${INPUT} bg-slate-50 text-slate-700`}>{ROLE_LABEL[currentUser.role]}</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Email dan peran diatur oleh Owner di menu Pengguna.</p>
        <div className="flex items-center justify-end gap-3">
          {!nameChanged && !savingName && <span className="text-[11px] text-slate-500">Ubah nama dulu untuk menyimpan.</span>}
          <button type="submit" disabled={savingName || !nameChanged || !trimmedName} className={PRIMARY_BUTTON}>
            {savingName ? 'Menyimpan…' : 'Simpan nama'}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className={CARD}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Ganti kata sandi</h2>
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            {showPasswords ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        </div>
        <Notice message={passwordMessage} />
        <label className="block text-xs">
          <span className="block text-slate-600 font-semibold mb-1">Kata sandi lama</span>
          <input type={passwordType} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={INPUT} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">Kata sandi baru</span>
            <input type={passwordType} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={INPUT} />
            <span className="block text-[11px] text-slate-500 mt-1">Minimal 8 karakter.</span>
          </label>
          <label className="block text-xs">
            <span className="block text-slate-600 font-semibold mb-1">Ulangi kata sandi baru</span>
            <input type={passwordType} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} className={INPUT} />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingPassword} className={PRIMARY_BUTTON}>
            {savingPassword ? 'Menyimpan…' : 'Simpan kata sandi'}
          </button>
        </div>
      </form>
    </div>
  );
};
