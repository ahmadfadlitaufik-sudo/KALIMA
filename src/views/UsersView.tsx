import React, { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, UserCheck, AlertCircle, Lock, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApiError, StaffUser, api } from '../services/api';
import { UserRole } from '../types';

const inputClassName =
  'w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500';

const messageOf = (error: unknown): string => (error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.');

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
    }
  };

  const handleRoleChange = async (user: StaffUser, role: UserRole) => {
    if (await run(() => api.updateUser(user.id, { role }))) {
      logAudit('Auth', 'Ubah Pengguna', `${user.email}: peran diubah menjadi ${role.toUpperCase()}`);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    if (await run(() => api.updateUser(user.id, { active: !user.active }))) {
      logAudit('Auth', 'Ubah Pengguna', `${user.email}: akses ${user.active ? 'dinonaktifkan' : 'diaktifkan'}`);
    }
  };

  const handleResetPassword = async (user: StaffUser) => {
    const password = window.prompt(`Kata sandi baru untuk ${user.email} (minimal 8 karakter):`);
    if (!password) {
      return;
    }
    if (await run(() => api.resetPassword(user.id, password))) {
      logAudit('Auth', 'Reset Kata Sandi', `Kata sandi ${user.email} di-reset oleh Owner`);
      window.alert(`Kata sandi ${user.email} sudah diganti. Berikan kata sandi baru ini ke yang bersangkutan.`);
    }
  };

  const handleDelete = async (user: StaffUser) => {
    if (!window.confirm(`Hapus ${user.email} dari daftar pengguna? Orang ini tidak akan bisa masuk lagi.`)) {
      return;
    }
    if (await run(() => api.deleteUser(user.id))) {
      logAudit('Auth', 'Hapus Pengguna', `${user.email} dihapus dari daftar pengguna`);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <UserCog className="w-5 h-5 text-amber-400" />
          Pengguna & Hak Akses
        </h2>
        <p className="text-xs text-slate-400">
          Hanya akun di daftar ini yang bisa membuka aplikasi. Berikan kata sandi awal ke staf; staf bisa menggantinya lewat menu akun.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <label className="sm:col-span-3 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Email</span>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="staf@gmail.com" required className={inputClassName} />
        </label>
        <label className="sm:col-span-3 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Nama</span>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Siti Rahma (CS)" className={inputClassName} />
        </label>
        <label className="sm:col-span-2 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Peran</span>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className={inputClassName}>
            <option value="admin">Admin / Staf</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="sm:col-span-2 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Kata sandi awal</span>
          <input
            type="text"
            autoComplete="off"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 karakter"
            required
            minLength={8}
            className={inputClassName}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="sm:col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah
        </button>
      </form>

      <div className="bg-[#121620] rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-3">Peran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((user) => {
                const isSelf = String(user.id) === currentUser.id;
                return (
                  <tr key={user.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={user.role}
                        disabled={isSelf || saving}
                        onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                        className="bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-xs text-slate-300 disabled:opacity-60"
                      >
                        <option value="admin">Admin / Staf</option>
                        <option value="owner">Owner</option>
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        disabled={isSelf || saving}
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center gap-1 font-semibold disabled:opacity-60 ${user.active ? 'text-emerald-400' : 'text-slate-500'}`}
                        title={isSelf ? 'Tidak bisa mengubah akun Anda sendiri' : 'Klik untuk mengubah status'}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {user.active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isSelf ? (
                        <Lock className="w-3.5 h-3.5 inline text-slate-500" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                            title="Reset kata sandi"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Hapus pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
