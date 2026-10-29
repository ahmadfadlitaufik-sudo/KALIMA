import React, { useState } from 'react';
import {
  runFirestorePersistenceDiagnostic,
  verifyOrderInServerFirestore,
  PersistenceDiagnosticReport,
} from '../services/firestoreDiagnostics';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Database,
  Server,
  Zap,
  X,
  ShieldCheck,
} from 'lucide-react';

interface FirestoreDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirestoreDiagnosticModal: React.FC<FirestoreDiagnosticModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<PersistenceDiagnosticReport | null>(null);
  const [searchOrderInput, setSearchOrderInput] = useState('');
  const [orderSearchResult, setOrderSearchResult] = useState<{
    persisted: boolean;
    order?: any;
    serverUpdatedAt?: string;
    totalOrdersOnServer: number;
    message: string;
  } | null>(null);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);

  const handleRunDiagnostic = async () => {
    setIsRunning(true);
    setOrderSearchResult(null);
    try {
      const res = await runFirestorePersistenceDiagnostic();
      setReport(res);
    } catch (e: any) {
      console.error('Diagnostic error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleVerifySpecificOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchOrderInput.trim()) return;
    setIsSearchingOrder(true);
    try {
      const res = await verifyOrderInServerFirestore(searchOrderInput.trim());
      setOrderSearchResult(res);
    } finally {
      setIsSearchingOrder(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Diagnostik Persistensi Firestore</h3>
              <p className="text-xs text-slate-500">
                Uji langsung verifikasi baca & tulis ke server Google Cloud Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Main Action Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Uji Tulis & Baca Server Langsung</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mengirim paket probe unik ke server cloud dan memvalidasi keasliannya tanpa cache lokal.
              </p>
            </div>
            <button
              onClick={handleRunDiagnostic}
              disabled={isRunning}
              className="shrink-0 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Menguji Cloud...' : 'Jalankan Diagnostik'}</span>
            </button>
          </div>

          {/* Diagnostic Report Display */}
          {report && (
            <div className="space-y-4 animate-fade-in">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  report.success
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}
              >
                {report.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>
                      {report.success
                        ? 'Verifikasi Cloud: Berhasil & Permanen'
                        : 'Verifikasi Cloud: Gagal / Terputus'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        report.success
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-rose-200 text-rose-800'
                      }`}
                    >
                      {report.serverVerification}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{report.summary}</p>
                </div>
              </div>

              {/* Latency & Protocol Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>Waktu Tulis (Write)</span>
                  </div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {report.writeLatencyMs >= 0 ? `${report.writeLatencyMs} ms` : '-'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <Server className="w-3 h-3 text-blue-500" />
                    <span>Waktu Baca Server</span>
                  </div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {report.readLatencyMs >= 0 ? `${report.readLatencyMs} ms` : '-'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span>Total Putaran</span>
                  </div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {report.totalRoundtripMs} ms
                  </div>
                </div>
              </div>

              {/* Document Health Breakdown */}
              {report.documents.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Status Dokumen Modular Database (Batas 1 MB per Dokumen)
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {report.documents.map((d) => (
                      <div
                        key={d.docPath}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <span>{d.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({d.docPath})</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {d.itemCount !== undefined ? `${d.itemCount} data tersimpan` : 'Aktif'} ·{' '}
                            <span className="font-mono">{d.sizeKb} KB</span> ({d.percentOf1MbLimit}% dari 1 MB)
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            d.status === 'HEALTHY'
                              ? 'bg-emerald-100 text-emerald-700'
                              : d.status === 'WARNING'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {d.status === 'HEALTHY' ? 'SEHAT (Aman)' : d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Specific Order Verifier */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Verifikasi Pesanan Tertentu di Server Firestore</span>
            </div>
            <p className="text-xs text-slate-500">
              Masukkan Nomor Order (misal: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">ORD-20260302-001</code>) atau Order ID untuk memastikan apakah pesanan tersebut sudah benar-benar mendarat di database cloud.
            </p>

            <form onSubmit={handleVerifySpecificOrder} className="flex gap-2">
              <input
                type="text"
                value={searchOrderInput}
                onChange={(e) => setSearchOrderInput(e.target.value)}
                placeholder="Contoh: ORD-20260302-001 atau ord-1741..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="submit"
                disabled={isSearchingOrder || !searchOrderInput.trim()}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors"
              >
                {isSearchingOrder ? 'Memeriksa...' : 'Cek Server'}
              </button>
            </form>

            {orderSearchResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  orderSearchResult.persisted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                {orderSearchResult.persisted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {orderSearchResult.persisted
                      ? 'Order Terverifikasi di Server Cloud!'
                      : 'Order Belum Ditemukan di Cloud'}
                  </div>
                  <p className="mt-0.5 opacity-90">{orderSearchResult.message}</p>
                  {orderSearchResult.order && (
                    <div className="mt-2 p-2 bg-white/70 rounded-lg text-[11px] font-mono border border-emerald-200/60">
                      Channel: {orderSearchResult.order.channel} | Customer: {orderSearchResult.order.customerNama} | Total: Rp {Number(orderSearchResult.order.totalTagihan).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200/80 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
