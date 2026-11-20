import React, { useState, useMemo } from 'react';
import { Search, ShieldCheck, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { filterAuditLogs } from '../services/auditFilter';
import { formatAuditTime } from '../services/auditTime';

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

  const INPUT = 'w-full bg-white border border-slate-300 px-3 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-500';
  const roleBadge = (role: string) => (
    <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-bold text-slate-600">{role === 'owner' ? 'Owner' : 'Staf'}</span>
  );

  return (
    <div className="space-y-4 pb-12">
      <p className="text-xs text-slate-600">
        Catatan siapa mengubah apa, dari order, stok, sampai persetujuan pembatalan. Yang tampil {auditLogs.length} aktivitas terakhir.
      </p>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari aktivitas"
              placeholder="Cari aktivitas, pengguna, atau rincian"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className={`${INPUT} pl-9`}
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Modul"
            className={INPUT}
          >
            <option value="ALL">Semua modul</option>
            <option value="Penjualan">Penjualan</option>
            <option value="Inventori">Inventori</option>
            <option value="Pengadaan">Pengadaan</option>
            <option value="Keuangan">Keuangan</option>
            <option value="Reseller">Reseller</option>
            <option value="Master Data">Master Data</option>
            <option value="Auth">Akun & login</option>
          </select>
          <select
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Pengguna"
            className={INPUT}
          >
            <option value="">Semua pengguna</option>
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
              className={INPUT}
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
              className={INPUT}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">Tanggal boleh dikosongkan untuk melihat semuanya.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {pageLogs.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            Tidak ada aktivitas yang cocok.{' '}
            {hasFilter && (
              <button type="button" onClick={resetFilters} className="font-semibold text-slate-900 underline cursor-pointer">
                Hapus filter
              </button>
            )}
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-3">Pengguna</th>
                    <th className="py-3 px-3">Modul</th>
                    <th className="py-3 px-3">Aksi</th>
                    <th className="py-3 px-4">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 align-top">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{formatAuditTime(log.timestamp)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {log.userRole === 'owner' ? <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          <span className="font-semibold text-slate-900">{log.userName}</span>
                          {roleBadge(log.userRole)}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">{log.module}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{log.action}</td>
                      <td className="py-3 px-4 text-slate-600 leading-relaxed">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {pageLogs.map((log) => (
                <div key={log.id} className="p-4 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatAuditTime(log.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>{log.userName}</span>
                    {roleBadge(log.userRole)}
                    <span>· {log.module}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{log.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {filteredLogs.length === 0
              ? '0 aktivitas'
              : `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filteredLogs.length)} dari ${filteredLogs.length} aktivitas`}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} className="px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default">
              ← Sebelumnya
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} className="px-3 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default">
              Selanjutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
