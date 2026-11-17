import React, { useState, useMemo } from 'react';
import { History, Search, ShieldCheck, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { filterAuditLogs } from '../services/auditFilter';

const PAGE_SIZE = 50;

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  const userNames = useMemo(() => [...new Set(auditLogs.map((log) => log.userName))].sort(), [auditLogs]);

  const filteredLogs = useMemo(
    () =>
      filterAuditLogs(auditLogs, {
        query: searchQuery,
        module: moduleFilter === 'ALL' ? undefined : moduleFilter,
        user: userFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
    [auditLogs, searchQuery, moduleFilter, userFilter, fromDate, toDate],
  );

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageLogs = filteredLogs.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const hasFilter = Boolean(searchQuery || moduleFilter !== 'ALL' || userFilter || fromDate || toDate);
  const resetFilters = () => {
    setSearchQuery('');
    setModuleFilter('ALL');
    setUserFilter('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Jejak Audit Aktivitas Sistem (Audit Trail)
          </h2>
          <p className="text-xs text-slate-400">
            Mencegah manipulasi data, pelacakan otomatis siapa yang input order, edit stok, dan menyetujui pembatalan
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          {auditLogs.length} Aktivitas Tercatat
        </span>
      </div>

      {/* Filters */}
      <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari aktivitas, nama pengguna, atau rincian transaksi..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-1.5 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Modul"
            className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">Semua Modul</option>
            <option value="Penjualan">Penjualan</option>
            <option value="Inventori">Inventori</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Reseller">Reseller</option>
            <option value="Master Data">Master Data</option>
            <option value="Auth">Autentikasi & Sistem</option>
          </select>
        </div>

        <select
          value={userFilter}
          onChange={(e) => {
            setUserFilter(e.target.value);
            setPage(0);
          }}
          aria-label="Pengguna"
          className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none"
        >
          <option value="">Semua Pengguna</option>
          {userNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="shrink-0">Dari</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="shrink-0">s.d.</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none"
          />
        </label>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#121620] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-3">Pengguna & Peran</th>
                <th className="py-3 px-3">Modul</th>
                <th className="py-3 px-3">Aksi</th>
                <th className="py-3 px-4">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {pageLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Tidak ada aktivitas yang cocok.{' '}
                    {hasFilter && (
                      <button type="button" onClick={resetFilters} className="font-semibold text-indigo-700 hover:underline cursor-pointer">
                        Hapus filter
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {pageLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {log.userRole === 'owner' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="font-semibold text-white">{log.userName}</span>
                      <span className="text-[11px] uppercase px-1 py-0.2 bg-slate-900 border border-slate-800 rounded font-bold text-slate-400">
                        {log.userRole}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {log.module}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-amber-400 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-xs leading-relaxed">
                    {log.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
          <span>
            {filteredLogs.length === 0
              ? '0 aktivitas'
              : `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filteredLogs.length)} dari ${filteredLogs.length} aktivitas`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              ← Sebelumnya
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              Selanjutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
