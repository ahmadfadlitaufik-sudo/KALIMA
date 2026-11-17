import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { UserCog, Plus, Trash2, ShieldCheck, UserCheck, AlertCircle, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StaffRecord, isBootstrapOwnerEmail } from '../context/AuthContext';
import { db, BOOTSTRAP_OWNER_EMAILS, STAFF_COLLECTION } from '../services/firebase';
import { UserRole } from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner mengelola siapa saja yang boleh masuk ke aplikasi beserta perannya. */
export const UsersView: React.FC = () => {
  const { currentUser, logAudit } = useApp();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');

  useEffect(() => onSnapshot(
    collection(db, STAFF_COLLECTION),
    (snap) => {
      setStaff(snap.docs.map((d) => d.data() as StaffRecord).sort((a, b) => a.email.localeCompare(b.email)));
      setLoadError(null);
    },
    (error) => {
      console.warn('Gagal memuat daftar pengguna:', error);
      setLoadError('Gagal memuat daftar pengguna. Pastikan aturan Firestore terbaru sudah dipasang.');
    },
  ), []);

  const bootstrapOwnersWithoutRecord = useMemo(
    () => BOOTSTRAP_OWNER_EMAILS.filter((email) => !staff.some((s) => s.email === email)),
    [staff],
  );

  const saveRecord = async (record: StaffRecord): Promise<boolean> => {
    setSaving(true);
    setFormError(null);
    try {
      await setDoc(doc(db, STAFF_COLLECTION, record.email), record);
      return true;
    } catch (error) {
      console.warn('Gagal menyimpan pengguna:', error);
      setFormError('Gagal menyimpan. Hanya Owner yang boleh mengubah daftar pengguna.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setFormError('Format email tidak valid.');
      return;
    }
    if (staff.some((s) => s.email === email)) {
      setFormError('Email ini sudah ada di daftar.');
      return;
    }

    const saved = await saveRecord({
      email,
      name: newName.trim() || email,
      role: newRole,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email,
    });
    if (saved) {
      logAudit('Auth', 'Tambah Pengguna', `${email} ditambahkan sebagai ${newRole.toUpperCase()}`);
      setNewEmail('');
      setNewName('');
      setNewRole('admin');
    }
  };

  const handleChange = async (record: StaffRecord, changes: Partial<StaffRecord>) => {
    const saved = await saveRecord({ ...record, ...changes });
    if (saved) {
      const description = changes.role
        ? `peran diubah menjadi ${changes.role.toUpperCase()}`
        : changes.active ? 'akses diaktifkan' : 'akses dinonaktifkan';
      logAudit('Auth', 'Ubah Pengguna', `${record.email}: ${description}`);
    }
  };

  const handleDelete = async (record: StaffRecord) => {
    if (!window.confirm(`Hapus ${record.email} dari daftar pengguna? Orang ini tidak akan bisa masuk lagi.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, STAFF_COLLECTION, record.email));
      logAudit('Auth', 'Hapus Pengguna', `${record.email} dihapus dari daftar pengguna`);
    } catch (error) {
      console.warn('Gagal menghapus pengguna:', error);
      setFormError('Gagal menghapus pengguna.');
    }
  };

  const isSelf = (email: string) => email === currentUser.email;

  return (
    <div className="space-y-5 pb-12">
      <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <UserCog className="w-5 h-5 text-amber-400" />
          Pengguna & Hak Akses
        </h2>
        <p className="text-xs text-slate-400">
          Hanya email di daftar ini yang bisa membuka aplikasi. Staf masuk dengan akun Google, atau membuat kata sandi sendiri lewat halaman login ("Buat kata sandi").
        </p>
      </div>

      {(loadError || formError) && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{loadError || formError}</span>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <label className="sm:col-span-4 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Email</span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="staf@gmail.com"
            required
            className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="sm:col-span-4 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Nama</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Siti Rahma (CS)"
            className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="sm:col-span-2 text-xs text-slate-400 space-y-1">
          <span className="block font-semibold">Peran</span>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="admin">Admin / Staf</option>
            <option value="owner">Owner</option>
          </select>
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
            <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-3">Peran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {bootstrapOwnersWithoutRecord.map((email) => (
                <tr key={email}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{email}</div>
                    <div className="text-[10px] text-slate-500">Owner utama (tertanam di sistem)</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold uppercase text-[10px]">
                      <ShieldCheck className="w-3.5 h-3.5" /> owner
                    </span>
                  </td>
                  <td className="py-3 px-3 text-emerald-400 font-semibold">Aktif</td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    <Lock className="w-3.5 h-3.5 inline" />
                  </td>
                </tr>
              ))}
              {staff.map((record) => {
                const locked = isSelf(record.email) || isBootstrapOwnerEmail(record.email);
                return (
                  <tr key={record.email}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{record.name}</div>
                      <div className="text-[10px] text-slate-500">{record.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={record.role}
                        disabled={locked || saving}
                        onChange={(e) => handleChange(record, { role: e.target.value as UserRole })}
                        className="bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-xs text-slate-300 disabled:opacity-60"
                      >
                        <option value="admin">Admin / Staf</option>
                        <option value="owner">Owner</option>
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        disabled={locked || saving}
                        onClick={() => handleChange(record, { active: !record.active })}
                        className={`inline-flex items-center gap-1 font-semibold disabled:opacity-60 ${
                          record.active ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                        title={locked ? 'Tidak bisa mengubah akun Anda sendiri' : 'Klik untuk mengubah status'}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {record.active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {locked ? (
                        <Lock className="w-3.5 h-3.5 inline text-slate-500" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Hapus pengguna"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
