import React, { useCallback, useEffect, useState } from 'react';
import { askConfirm, askPassword, showNotice } from '../services/dialogStore';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApiError, StaffUser, api } from '../services/api';
import { UserRole } from '../types';

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const PRIMARY_BUTTON =
  'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const ICON_BUTTON = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40';

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Admin / Staf', owner: 'Owner' };

const messageOf = (error: unknown): string => (error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.');

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border ${
      active ? 'bg-white text-slate-700 border-slate-300' : 'bg-slate-100 text-slate-500 border-slate-200'
    }`}
  >
    {active ? 'Aktif' : 'Nonaktif'}
  </span>
);

/** Owner mengelola siapa saja yang boleh masuk ke aplikasi beserta perannya. */
export const UsersView: React.FC = () => {
  const { currentUser, logAudit } = useApp();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /** Jalankan aksi ke server, tampilkan error bila gagal, lalu muat ulang daftar. */
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await action();
      await loadUsers();
      return true;
    } catch (error) {
      setErrorMessage(messageOf(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    const added = await run(() => api.createUser({ email, name: newName.trim() || email, role: newRole, password: newPassword }));
    if (added) {
      logAudit('Auth', 'Tambah Pengguna', `${email} ditambahkan sebagai ${newRole.toUpperCase()}`);
      setNewEmail('');
      setNewName('');
      setNewRole('admin');
      setNewPassword('');
      setShowPassword(false);
    }
  };

  const handleRoleChange = async (user: StaffUser, role: UserRole) => {
    const message =
      role === 'owner'
        ? `${user.email} akan bisa melihat HPP, laba, keuangan, dan mengelola pengguna.`
        : `${user.email} tidak lagi bisa melihat HPP, laba, keuangan, maupun mengelola pengguna.`;
    if (!(await askConfirm(message, { title: `Jadikan ${ROLE_LABEL[role]}?`, confirmLabel: 'Ya, ubah peran' }))) {
      return;
    }
    if (await run(() => api.updateUser(user.id, { role }))) {
      logAudit('Auth', 'Ubah Pengguna', `${user.email}: peran diubah menjadi ${role.toUpperCase()}`);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    if (user.active) {
      const confirmed = await askConfirm(`${user.email} tidak bisa masuk sampai diaktifkan lagi. Datanya tetap tersimpan.`, {
        title: 'Nonaktifkan akun?',
        confirmLabel: 'Nonaktifkan',
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    if (await run(() => api.updateUser(user.id, { active: !user.active }))) {
      logAudit('Auth', 'Ubah Pengguna', `${user.email}: akses ${user.active ? 'dinonaktifkan' : 'diaktifkan'}`);
    }
  };

  const handleResetPassword = async (user: StaffUser) => {
    const password = await askPassword(`Ketik kata sandi baru untuk ${user.email} (minimal 8 karakter).`, 'Reset Kata Sandi');
    if (!password) {
      return;
    }
    if (await run(() => api.resetPassword(user.id, password))) {
      logAudit('Auth', 'Reset Kata Sandi', `Kata sandi ${user.email} di-reset oleh Owner`);
      void showNotice(`Kata sandi ${user.email} sudah diganti. Berikan kata sandi baru ini ke yang bersangkutan.`, 'Kata Sandi Diganti');
    }
  };

  const handleDelete = async (user: StaffUser) => {
    if (
      !(await askConfirm(`${user.email} dihapus dari daftar pengguna dan tidak bisa masuk lagi. Untuk menahan akses sementara, pakai Nonaktifkan.`, {
        title: 'Hapus pengguna?',
        danger: true,
        confirmLabel: 'Ya, hapus',
      }))
    ) {
      return;
    }
    if (await run(() => api.deleteUser(user.id))) {
      logAudit('Auth', 'Hapus Pengguna', `${user.email} dihapus dari daftar pengguna`);
    }
  };

  const actionsFor = (user: StaffUser, isSelf: boolean) =>
    isSelf ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Akun Anda
      </span>
    ) : (
      <div className="flex items-center gap-1.5 justify-end">
        <button type="button" onClick={() => handleToggleActive(user)} disabled={saving} className={`${OUTLINE_BUTTON} py-1.5`}>
          {user.active ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <button type="button" onClick={() => handleResetPassword(user)} disabled={saving} className={ICON_BUTTON} title="Reset kata sandi" aria-label={`Reset kata sandi ${user.email}`}>
          <KeyRound className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => handleDelete(user)} disabled={saving} className={`${ICON_BUTTON} text-rose-700`} title="Hapus pengguna" aria-label={`Hapus ${user.email}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );

  const roleSelect = (user: StaffUser, isSelf: boolean) => (
    <select
      aria-label={`Peran ${user.email}`}
      value={user.role}
      disabled={isSelf || saving}
      onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
      className="bg-white border border-slate-300 px-2 py-1.5 rounded-lg text-xs text-slate-800 disabled:opacity-60"
    >
      <option value="admin">{ROLE_LABEL.admin}</option>
      <option value="owner">{ROLE_LABEL.owner}</option>
    </select>
  );

  return (
    <div className="space-y-5 pb-12 max-w-5xl">
      <p className="text-xs text-slate-600">Hanya akun di daftar ini yang bisa membuka aplikasi. Berikan kata sandi awal ke staf; staf bisa menggantinya lewat menu akun.</p>

      {errorMessage && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleAdd} className={`${CARD} p-4 space-y-3 text-xs`}>
        <h2 className="text-sm font-bold text-slate-900">Tambah pengguna</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-slate-600 font-semibold mb-1">Email *</span>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoComplete="off" className={INPUT} />
          </label>
          <label className="block">
            <span className="block text-slate-600 font-semibold mb-1">Nama</span>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Boleh dikosongkan" className={INPUT} />
          </label>
          <label className="block">
            <span className="block text-slate-600 font-semibold mb-1">Peran</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className={INPUT}>
              <option value="admin">{ROLE_LABEL.admin}</option>
              <option value="owner">{ROLE_LABEL.owner}</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-slate-600 font-semibold mb-1">Kata sandi awal *</span>
            <span className="relative block">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
                minLength={8}
                className={`${INPUT} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
        </div>
        <p className="text-slate-500">Owner bisa melihat HPP, laba, keuangan, dan mengelola pengguna. Admin / Staf mengurus order, stok, dan pelanggan.</p>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
            <Plus className="w-3.5 h-3.5" /> Tambah pengguna
          </button>
        </div>
      </form>

      <div className={`${CARD} overflow-hidden`}>
        <div className="hidden md:block">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-3">Peran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = String(user.id) === currentUser.id;
                return (
                  <tr key={user.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    </td>
                    <td className="py-3 px-3">{roleSelect(user, isSelf)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge active={user.active} />
                    </td>
                    <td className="py-3 px-4 text-right">{actionsFor(user, isSelf)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-slate-100">
          {users.map((user) => {
            const isSelf = String(user.id) === currentUser.id;
            return (
              <div key={user.id} className="p-4 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{user.name}</div>
                    <div className="text-[11px] text-slate-500 break-all">{user.email}</div>
                  </div>
                  <StatusBadge active={user.active} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {roleSelect(user, isSelf)}
                  {actionsFor(user, isSelf)}
                </div>
              </div>
            );
          })}
        </div>
        {users.length === 0 && !errorMessage && <p className="p-10 text-center text-xs text-slate-500">Memuat daftar pengguna…</p>}
      </div>
    </div>
  );
};
