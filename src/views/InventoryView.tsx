import React, { useMemo, useState } from 'react';
import { useSearchHandoff } from '../hooks/useSearchHandoff';
import { AlertCircle, CheckCircle2, ClipboardList, Edit2, Eye, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { stockValue } from '../services/dashboardMetrics';
import { askConfirm } from '../services/dialogStore';
import { OpnameCount, countedOpnameItems, movementTypeLabel, stockCard, warehouseTotals } from '../services/inventoryStock';
import { StockStatus, stockStatus } from '../services/skuCatalog';
import { useApp } from '../context/AppContext';
import { SKUItem, StockOpnameSession } from '../types';

type TabId = 'stok' | 'masuk' | 'opname' | 'reject' | 'kartu';
type OpnameView = 'lembar' | 'satu' | 'riwayat';
type StatusFilter = 'ALL' | StockStatus;
type OpnameFilter = 'ALL' | 'belum' | 'selisih';

const PAGE_SIZE = 25;
const CARD_HISTORY_STEP = 100;

const CARD = 'bg-white rounded-2xl border border-slate-200';
const INPUT = 'w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-slate-500';
const SMALL_INPUT = 'bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-500';
const OUTLINE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const PRIMARY_BUTTON =
  'segmented-pill-active inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const ICON_BUTTON = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer';

const STATUS_LABEL: Record<StockStatus, string> = { minus: 'Minus', habis: 'Habis', menipis: 'Menipis', aman: 'Aman' };
const STATUS_CLASS: Record<StockStatus, string> = {
  minus: 'bg-rose-50 text-rose-700 border border-rose-200',
  habis: 'bg-slate-100 text-slate-700 border border-slate-200',
  menipis: 'bg-amber-50 text-amber-800 border border-amber-200',
  aman: 'bg-white text-slate-600 border border-slate-200',
};
const REJECT_REASONS = ['Sablon cacat', 'Jahitan rusak', 'Noda / kotor', 'Salah ukuran / warna dari konveksi', 'Rusak saat penyimpanan'];

const formatRupiah = (val: number) => `${val < 0 ? '−' : ''}Rp ${Math.abs(Math.round(val)).toLocaleString('id-ID')}`;
const signed = (val: number) => (val > 0 ? `+${val}` : String(val));
const todayIso = () => new Date().toISOString().split('T')[0];

const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-slate-600 font-semibold mb-1">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-slate-500 mt-1 block">{hint}</span>}
  </label>
);

const Modal: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  wide,
  children,
}) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className={`bg-white border border-slate-200 rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] flex flex-col shadow-2xl`}>
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button type="button" aria-label="Tutup" data-modal-close onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl flex items-start gap-2 text-xs">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;

const Pager: React.FC<{ page: number; total: number; count: number; onChange: (page: number) => void; noun: string }> = ({ page, total, count, onChange, noun }) =>
  count === 0 ? null : (
    <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span>
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} dari {count} {noun}
      </span>
      {total > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className={OUTLINE_BUTTON}>
            ← Sebelumnya
          </button>
          <span className="font-mono">
            {page} / {total}
          </span>
          <button type="button" onClick={() => onChange(page + 1)} disabled={page >= total} className={OUTLINE_BUTTON}>
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  );

const StatusBadge: React.FC<{ status: StockStatus }> = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
);

export const InventoryView: React.FC = () => {
  const {
    skus,
    series,
    stockMovements,
    calculateStockSummary,
    recordRestock,
    recordStockOpname,
    recordBatchStockOpname,
    stockOpnameSessions,
    recordReject,
    isOwner,
    updateSKU,
    setCurrentView,
  } = useApp();

  const stockSummary = calculateStockSummary();
  const gudangOf = (code: string) => stockSummary[code]?.gudang ?? 0;
  const skuOf = (code: string) => skus.find((s) => s.sku === code);

  const [activeTab, setActiveTab] = useState<TabId>('stok');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };
  const switchTab = (tab: TabId) => {
    setFormError(null);
    setActiveTab(tab);
  };

  const seriesOptions = useMemo(() => {
    const map = new Map<string, string>();
    series.forEach((s) => map.set(s.code, s.name));
    skus.forEach((s) => s.seriesCode && !map.has(s.seriesCode) && map.set(s.seriesCode, s.seriesCode));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [series, skus]);

  const sortedSkus = useMemo(() => [...skus].sort((a, b) => a.name.localeCompare(b.name)), [skus]);
  const statusOf = (item: SKUItem) => stockStatus(gudangOf(item.sku), item.minStock);

  // ===== Ringkasan
  const totals = useMemo(() => warehouseTotals(stockSummary), [stockSummary]);
  const hppValue = useMemo(() => stockValue(skus, stockSummary, 'total'), [skus, stockSummary]);
  const lowCount = useMemo(() => skus.filter((s) => stockStatus(stockSummary[s.sku]?.gudang ?? 0, s.minStock) === 'menipis').length, [skus, stockSummary]);

  // ===== Tab stok gudang
  const [searchQuery, setSearchQuery] = useState('');
  useSearchHandoff('inventory', setSearchQuery);
  const [seriesFilter, setSeriesFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [stockPage, setStockPage] = useState(1);
  const [editingSku, setEditingSku] = useState<SKUItem | null>(null);
  const [editMinStock, setEditMinStock] = useState(0);

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedSkus.filter((item) => {
      if (seriesFilter !== 'ALL' && item.seriesCode !== seriesFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && stockStatus(stockSummary[item.sku]?.gudang ?? 0, item.minStock) !== statusFilter) {
        return false;
      }
      return !q || [item.sku, item.name, item.colorName, item.seriesCode, item.size].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [sortedSkus, searchQuery, seriesFilter, statusFilter, stockSummary]);
  const stockPages = Math.max(1, Math.ceil(filteredSkus.length / PAGE_SIZE));
  const stockPageNow = Math.min(stockPage, stockPages);
  const pagedSkus = filteredSkus.slice((stockPageNow - 1) * PAGE_SIZE, stockPageNow * PAGE_SIZE);
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setStockPage(1);
    };

  const showStatus = (status: StatusFilter) => {
    setStatusFilter(status);
    setStockPage(1);
    switchTab('stok');
  };

  const handleSaveMinStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) {
      return;
    }
    updateSKU(editingSku.sku, { minStock: Math.max(0, editMinStock) });
    flash(`Stok minimum ${editingSku.sku} menjadi ${Math.max(0, editMinStock)} pcs.`);
    setEditingSku(null);
  };

  // ===== Barang masuk
  const [restockSumber, setRestockSumber] = useState('');
  const [restockCatatan, setRestockCatatan] = useState('');
  const [restockRows, setRestockRows] = useState<{ sku: string; qty: number }[]>([{ sku: '', qty: 0 }]);

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rows = restockRows.filter((r) => r.sku);
    if (!restockSumber.trim()) {
      setFormError('Isi sumber barang, misalnya nama konveksi atau nomor PO.');
      return;
    }
    if (rows.length === 0 || rows.some((r) => r.qty <= 0)) {
      setFormError('Pilih SKU dan isi jumlah lebih dari 0 di setiap baris.');
      return;
    }
    recordRestock(rows, restockSumber.trim(), restockCatatan.trim());
    const pcs = rows.reduce((sum, r) => sum + r.qty, 0);
    setRestockSumber('');
    setRestockCatatan('');
    setRestockRows([{ sku: '', qty: 0 }]);
    setFormError(null);
    flash(`${pcs} pcs dari ${rows.length} SKU masuk ke Gudang Utama.`);
  };

  // ===== Opname
  const [opnameView, setOpnameView] = useState<OpnameView>('lembar');
  const [opnameDate, setOpnameDate] = useState(todayIso);
  const [opnameTitle, setOpnameTitle] = useState('');
  const [opnameSeries, setOpnameSeries] = useState('ALL');
  const [opnameReason, setOpnameReason] = useState('');
  const [opnameSearch, setOpnameSearch] = useState('');
  const [opnameFilter, setOpnameFilter] = useState<OpnameFilter>('ALL');
  const [opnamePage, setOpnamePage] = useState(1);
  const [counts, setCounts] = useState<Record<string, OpnameCount>>({});
  const [viewingSession, setViewingSession] = useState<StockOpnameSession | null>(null);

  const opnameScope = useMemo(() => sortedSkus.filter((s) => opnameSeries === 'ALL' || s.seriesCode === opnameSeries), [sortedSkus, opnameSeries]);
  const scopedCounts = useMemo(() => {
    const scope = new Set(opnameScope.map((s) => s.sku));
    return Object.fromEntries(Object.entries(counts).filter(([code, c]) => scope.has(code) && c.physical !== null)) as Record<string, OpnameCount>;
  }, [counts, opnameScope]);
  const opnameRows = useMemo(() => {
    const q = opnameSearch.trim().toLowerCase();
    return opnameScope.filter((item) => {
      const counted = scopedCounts[item.sku];
      if (opnameFilter === 'belum' && counted) {
        return false;
      }
      if (opnameFilter === 'selisih' && (!counted || counted.physical === gudangOf(item.sku))) {
        return false;
      }
      return !q || [item.sku, item.name, item.colorName, item.size].some((v) => (v || '').toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opnameScope, scopedCounts, opnameSearch, opnameFilter, stockSummary]);
  const opnamePages = Math.max(1, Math.ceil(opnameRows.length / PAGE_SIZE));
  const opnamePageNow = Math.min(opnamePage, opnamePages);
  const pagedOpname = opnameRows.slice((opnamePageNow - 1) * PAGE_SIZE, opnamePageNow * PAGE_SIZE);

  const opnameStats = useMemo(() => {
    let match = 0;
    let surplus = 0;
    let deficit = 0;
    let value = 0;
    Object.entries(scopedCounts).forEach(([code, c]) => {
      const diff = (c.physical ?? 0) - (stockSummary[code]?.gudang ?? 0);
      if (diff === 0) {
        match++;
      } else if (diff > 0) {
        surplus++;
      } else {
        deficit++;
      }
      value += diff * (skus.find((s) => s.sku === code)?.hpp || 0);
    });
    return { counted: Object.keys(scopedCounts).length, match, surplus, deficit, value };
  }, [scopedCounts, stockSummary, skus]);

  const setPhysical = (code: string, raw: string) =>
    setCounts((prev) => ({ ...prev, [code]: { physical: raw === '' ? null : Math.max(0, Math.floor(Number(raw) || 0)), reason: prev[code]?.reason || '' } }));
  const setReason = (code: string, reason: string) => setCounts((prev) => ({ ...prev, [code]: { physical: prev[code]?.physical ?? null, reason } }));

  const handleFillUncounted = async () => {
    const targets = opnameScope.filter((s) => !scopedCounts[s.sku] && gudangOf(s.sku) >= 0);
    const skipped = opnameScope.filter((s) => !scopedCounts[s.sku] && gudangOf(s.sku) < 0).length;
    const confirmed = await askConfirm(
      `${targets.length} SKU yang belum dihitung akan diisi sama dengan stok sistem, artinya dianggap cocok. Pakai ini hanya bila rak SKU tersebut memang sudah dicek.${
        skipped ? ` ${skipped} SKU minus tidak diisi; hitung fisiknya satu per satu.` : ''
      }`,
      { title: 'Isi sisa dengan stok sistem?', confirmLabel: 'Isi' },
    );
    if (!confirmed) {
      return;
    }
    setCounts((prev) => {
      const next = { ...prev };
      targets.forEach((s) => (next[s.sku] = { physical: gudangOf(s.sku), reason: '' }));
      return next;
    });
  };

  const handleSubmitOpname = async () => {
    const items = countedOpnameItems(scopedCounts, gudangOf, opnameReason.trim() || 'Selisih hitungan fisik');
    if (items.length === 0) {
      setFormError('Belum ada SKU yang dihitung.');
      return;
    }
    const confirmed = await askConfirm(
      `${items.length} SKU disimpan: ${opnameStats.match} cocok, ${opnameStats.surplus} lebih, ${opnameStats.deficit} kurang. Stok gudang disesuaikan dengan hitungan fisik (dampak HPP ${formatRupiah(
        opnameStats.value,
      )}). SKU yang belum dihitung tidak diubah.`,
      { title: 'Simpan hasil opname?', confirmLabel: 'Simpan & sesuaikan stok' },
    );
    if (!confirmed) {
      return;
    }
    const res = recordBatchStockOpname({
      judul: opnameTitle.trim() || `Stok opname ${opnameDate}`,
      kategoriFilter: opnameSeries === 'ALL' ? 'Semua Lini' : opnameSeries,
      lokasi: 'Gudang Utama',
      items,
      alasanGlobal: opnameReason.trim() || 'Selisih hitungan fisik',
      tanggal: opnameDate,
    });
    if (!res.success) {
      setFormError(res.error || 'Opname gagal disimpan.');
      return;
    }
    setCounts({});
    setOpnameTitle('');
    setOpnameReason('');
    setFormError(null);
    setOpnameView('riwayat');
    flash(`Sesi ${res.session?.nomorSesi || 'opname'} disimpan; ${items.length} SKU disesuaikan.`);
  };

  const [singleSku, setSingleSku] = useState('');
  const [singlePhysical, setSinglePhysical] = useState('');
  const [singleReason, setSingleReason] = useState('');

  const handleSingleOpname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSku || singlePhysical === '' || Number(singlePhysical) < 0) {
      setFormError('Pilih SKU dan isi jumlah fisik (0 atau lebih).');
      return;
    }
    if (!singleReason.trim()) {
      setFormError('Isi alasan penyesuaian.');
      return;
    }
    const physical = Math.floor(Number(singlePhysical));
    const diff = physical - gudangOf(singleSku);
    recordStockOpname(singleSku, physical, singleReason.trim());
    setSingleSku('');
    setSinglePhysical('');
    setSingleReason('');
    setFormError(null);
    flash(`Stok ${singleSku} disesuaikan menjadi ${physical} pcs (${signed(diff)}).`);
  };

  // ===== Reject
  const [rejectSku, setRejectSku] = useState('');
  const [rejectQty, setRejectQty] = useState(0);
  const [rejectReason, setRejectReason] = useState('');
  const rejectChoices = useMemo(() => sortedSkus.filter((s) => (stockSummary[s.sku]?.gudang ?? 0) > 0), [sortedSkus, stockSummary]);

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectSku || rejectQty <= 0) {
      setFormError('Pilih SKU dan isi jumlah lebih dari 0.');
      return;
    }
    if (rejectQty > gudangOf(rejectSku)) {
      setFormError(`Jumlah melebihi stok gudang (${gudangOf(rejectSku)} pcs).`);
      return;
    }
    if (!rejectReason.trim()) {
      setFormError('Pilih alasan reject.');
      return;
    }
    recordReject(rejectSku, rejectQty, rejectReason.trim());
    flash(`${rejectQty} pcs ${rejectSku} dikeluarkan dari stok siap jual sebagai reject.`);
    setRejectSku('');
    setRejectQty(0);
    setRejectReason('');
    setFormError(null);
  };

  // ===== Kartu stok
  const [cardSku, setCardSku] = useState('ALL');
  const [cardType, setCardType] = useState('ALL');
  const [cardFrom, setCardFrom] = useState('');
  const [cardTo, setCardTo] = useState('');
  const [cardLimit, setCardLimit] = useState(CARD_HISTORY_STEP);

  const cardRows = useMemo(() => {
    const base: (typeof stockMovements[number] & { balance?: number })[] =
      cardSku === 'ALL' ? [...stockMovements].sort((a, b) => b.tanggal.localeCompare(a.tanggal)) : stockCard(stockMovements, cardSku);
    return base.filter((m) => (cardType === 'ALL' || m.tipe === cardType) && (!cardFrom || m.tanggal >= cardFrom) && (!cardTo || m.tanggal <= cardTo));
  }, [stockMovements, cardSku, cardType, cardFrom, cardTo]);
  const movementTypes = useMemo(() => Array.from(new Set(stockMovements.map((m) => m.tipe))).sort(), [stockMovements]);
  const resetCardLimit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setCardLimit(CARD_HISTORY_STEP);
    };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'stok', label: 'Stok Gudang' },
    { id: 'masuk', label: 'Barang Masuk' },
    { id: 'opname', label: `Opname${stockOpnameSessions.length ? ` (${stockOpnameSessions.length})` : ''}` },
    { id: 'reject', label: 'Reject' },
    { id: 'kartu', label: 'Kartu Stok' },
  ];

  const skuLabel = (s: SKUItem) => `${s.name} · ${s.sku} · gudang ${gudangOf(s.sku)}`;

  return (
    <div className="space-y-5 pb-12">
      {notice && (
        <div role="status" className="bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notice}</span>
          </div>
          <button type="button" aria-label="Tutup pesan" onClick={() => setNotice(null)} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => switchTab(tab.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              activeTab === tab.id ? 'segmented-pill-active' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= STOK GUDANG ================= */}
      {activeTab === 'stok' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className={`${CARD} p-3`}>
              <div className="text-xs font-semibold text-slate-600">Stok siap jual</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">{totals.available.toLocaleString('id-ID')} pcs</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {totals.availableSkus} SKU · HPP gudang+reseller {formatRupiah(hppValue)}
              </div>
            </div>
            <button type="button" onClick={() => showStatus('minus')} className={`${CARD} p-3 text-left hover:border-slate-400 cursor-pointer`}>
              <div className="text-xs font-semibold text-slate-600">Stok minus</div>
              <div className={`text-xl font-bold font-mono mt-1 ${totals.minusSkus ? 'text-rose-700' : 'text-slate-900'}`}>{totals.minusSkus} SKU</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {totals.minusSkus ? `Kurang ${Math.abs(totals.minusPcs).toLocaleString('id-ID')} pcs · cek lewat opname` : 'Tidak ada'}
              </div>
            </button>
            <button type="button" onClick={() => showStatus('menipis')} className={`${CARD} p-3 text-left hover:border-slate-400 cursor-pointer`}>
              <div className="text-xs font-semibold text-slate-600">Menipis</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">{lowCount} SKU</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Di bawah stok minimum · {totals.emptySkus} SKU kosong</div>
            </button>
            <div className={`${CARD} p-3`}>
              <div className="text-xs font-semibold text-slate-600">Dititip di reseller</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">{totals.reseller.toLocaleString('id-ID')} pcs</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tidak termasuk stok gudang</div>
            </div>
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Cari SKU"
                  placeholder="Cari kode SKU, nama, warna, atau ukuran…"
                  value={searchQuery}
                  onChange={(e) => resetPage(setSearchQuery)(e.target.value)}
                  className="w-full bg-white border border-slate-300 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Lini" value={seriesFilter} onChange={(e) => resetPage(setSeriesFilter)(e.target.value)} className={SMALL_INPUT}>
                  <option value="ALL">Semua lini</option>
                  {seriesOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select aria-label="Status stok" value={statusFilter} onChange={(e) => resetPage(setStatusFilter)(e.target.value as StatusFilter)} className={SMALL_INPUT}>
                  <option value="ALL">Semua status</option>
                  <option value="minus">Minus</option>
                  <option value="habis">Habis</option>
                  <option value="menipis">Menipis</option>
                  <option value="aman">Aman</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => switchTab('masuk')} className={OUTLINE_BUTTON}>
                  <PackagePlus className="w-3.5 h-3.5" /> Barang masuk
                </button>
                <button type="button" onClick={() => switchTab('opname')} className={OUTLINE_BUTTON}>
                  <ClipboardList className="w-3.5 h-3.5" /> Opname
                </button>
              </div>
            </div>

            {filteredSkus.length === 0 ? (
              <p className="p-12 text-center text-xs text-slate-500">Tidak ada SKU yang cocok.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Produk</th>
                        <th className="px-3 py-3 text-right">Gudang</th>
                        <th className="px-3 py-3 text-right">Reseller</th>
                        <th className="px-3 py-3 text-right">Min.</th>
                        <th className="px-3 py-3">Status</th>
                        {isOwner && <th className="px-4 py-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedSkus.map((item) => {
                        const stock = stockSummary[item.sku] || { gudang: 0, reseller: 0, total: 0 };
                        return (
                          <tr key={item.sku} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <div className="font-mono text-[11px] text-slate-500 whitespace-nowrap">{item.sku}</div>
                            </td>
                            <td className={`px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${stock.gudang < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                              {stock.gudang} pcs
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">{stock.reseller || 0}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500">{item.minStock}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={statusOf(item)} />
                            </td>
                            {isOwner && (
                              <td className="px-4 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSku(item);
                                    setEditMinStock(item.minStock);
                                  }}
                                  className={ICON_BUTTON}
                                  title="Ubah stok minimum"
                                  aria-label={`Ubah stok minimum ${item.sku}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-slate-100">
                  {pagedSkus.map((item) => {
                    const stock = stockSummary[item.sku] || { gudang: 0, reseller: 0, total: 0 };
                    return (
                      <div key={item.sku} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                          <div className="mt-1 flex items-center gap-2 text-slate-500">
                            <StatusBadge status={statusOf(item)} />
                            <span>min. {item.minStock}</span>
                            {stock.reseller > 0 && <span>· reseller {stock.reseller}</span>}
                          </div>
                        </div>
                        <span className={`font-mono font-bold whitespace-nowrap ${stock.gudang < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{stock.gudang} pcs</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <Pager page={stockPageNow} total={stockPages} count={filteredSkus.length} onChange={setStockPage} noun="SKU" />
          </div>
        </div>
      )}

      {/* ================= BARANG MASUK ================= */}
      {activeTab === 'masuk' && (
        <div className="max-w-2xl space-y-3">
          <div className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}>
            <p className="text-slate-600">Beli dari vendor dengan PO? Catat lewat Pengadaan PO agar pembayaran dan penerimaannya ikut terlacak.</p>
            <button type="button" onClick={() => setCurrentView('purchases')} className={`${OUTLINE_BUTTON} shrink-0`}>
              Buka Pengadaan PO
            </button>
          </div>
          <form onSubmit={handleRestockSubmit} className={`${CARD} p-5 space-y-3.5 text-xs`}>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Catat barang masuk</h2>
              <p className="text-slate-500 mt-0.5">Untuk kiriman langsung dari konveksi sendiri; stok Gudang Utama langsung bertambah.</p>
            </div>
            <FormError message={formError} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Sumber / no. PO *">
                <input type="text" value={restockSumber} onChange={(e) => setRestockSumber(e.target.value)} placeholder="Contoh: Konveksi Pak Ahmad" className={INPUT} />
              </Field>
              <Field label="Catatan">
                <input type="text" value={restockCatatan} onChange={(e) => setRestockCatatan(e.target.value)} placeholder="Contoh: batch 2 warna hitam" className={INPUT} />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-semibold">Barang</span>
                <button
                  type="button"
                  onClick={() => setRestockRows((prev) => [...prev, { sku: '', qty: 0 }])}
                  className="inline-flex items-center gap-1 text-slate-700 font-semibold hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah baris
                </button>
              </div>
              {restockRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    aria-label={`SKU baris ${idx + 1}`}
                    value={row.sku}
                    onChange={(e) => setRestockRows((prev) => prev.map((r, i) => (i === idx ? { ...r, sku: e.target.value } : r)))}
                    className={`${INPUT} p-2 min-w-0`}
                  >
                    <option value="">Pilih SKU…</option>
                    {sortedSkus.map((s) => (
                      <option key={s.sku} value={s.sku}>
                        {skuLabel(s)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    aria-label={`Jumlah baris ${idx + 1}`}
                    placeholder="Pcs"
                    value={row.qty || ''}
                    onChange={(e) => setRestockRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: Number(e.target.value) || 0 } : r)))}
                    className={`${INPUT} p-2 w-24 shrink-0 font-mono text-right`}
                  />
                  {restockRows.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Hapus baris ${idx + 1}`}
                      onClick={() => setRestockRows((prev) => prev.filter((_, i) => i !== idx))}
                      className={`${ICON_BUTTON} shrink-0 text-rose-700`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <p className="text-slate-500">Total {restockRows.reduce((sum, r) => sum + (r.qty || 0), 0)} pcs</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan ke gudang
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= OPNAME ================= */}
      {activeTab === 'opname' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['lembar', 'Lembar opname'],
                ['satu', 'Satu SKU'],
                ['riwayat', `Riwayat (${stockOpnameSessions.length})`],
              ] as [OpnameView, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={opnameView === id}
                onClick={() => {
                  setFormError(null);
                  setOpnameView(id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${opnameView === id ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {opnameView === 'lembar' && (
            <div className="space-y-3">
              <div className={`${CARD} p-4 space-y-3 text-xs`}>
                <p className="text-slate-600">
                  Isi kolom <strong>Fisik</strong> hanya untuk SKU yang sudah dihitung di rak. SKU yang dibiarkan kosong tidak diubah saat disimpan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Tanggal">
                    <input type="date" value={opnameDate} onChange={(e) => setOpnameDate(e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Judul sesi">
                    <input type="text" value={opnameTitle} onChange={(e) => setOpnameTitle(e.target.value)} placeholder={`Stok opname ${opnameDate}`} className={INPUT} />
                  </Field>
                  <Field label="Lini">
                    <select
                      value={opnameSeries}
                      onChange={(e) => {
                        setOpnameSeries(e.target.value);
                        setOpnamePage(1);
                      }}
                      className={INPUT}
                    >
                      <option value="ALL">Semua lini ({skus.length} SKU)</option>
                      {seriesOptions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Alasan selisih (umum)">
                    <input type="text" value={opnameReason} onChange={(e) => setOpnameReason(e.target.value)} placeholder="Contoh: selisih hitung akhir bulan" className={INPUT} />
                  </Field>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  ['Sudah dihitung', `${opnameStats.counted} / ${opnameScope.length}`],
                  ['Cocok', String(opnameStats.match)],
                  ['Lebih', String(opnameStats.surplus)],
                  ['Kurang', String(opnameStats.deficit)],
                  ['Dampak HPP', formatRupiah(opnameStats.value)],
                ].map(([label, value]) => (
                  <div key={label} className={`${CARD} p-3`}>
                    <div className="text-slate-500">{label}</div>
                    <div className="font-bold font-mono text-slate-900 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>

              <FormError message={formError} />

              <div className={`${CARD} overflow-hidden`}>
                <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Cari di lembar opname"
                      placeholder="Cari SKU di lembar opname…"
                      value={opnameSearch}
                      onChange={(e) => {
                        setOpnameSearch(e.target.value);
                        setOpnamePage(1);
                      }}
                      className="w-full bg-white border border-slate-300 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <select
                    aria-label="Tampilkan"
                    value={opnameFilter}
                    onChange={(e) => {
                      setOpnameFilter(e.target.value as OpnameFilter);
                      setOpnamePage(1);
                    }}
                    className={SMALL_INPUT}
                  >
                    <option value="ALL">Semua SKU</option>
                    <option value="belum">Belum dihitung</option>
                    <option value="selisih">Ada selisih</option>
                  </select>
                  <button type="button" onClick={handleFillUncounted} className={OUTLINE_BUTTON}>
                    Isi sisa = stok sistem
                  </button>
                  {opnameStats.counted > 0 && (
                    <button type="button" onClick={() => setCounts({})} className={OUTLINE_BUTTON}>
                      Kosongkan
                    </button>
                  )}
                  <button type="button" onClick={handleSubmitOpname} disabled={opnameStats.counted === 0} className={PRIMARY_BUTTON}>
                    Simpan opname ({opnameStats.counted})
                  </button>
                </div>
                {opnameRows.length === 0 ? (
                  <p className="p-10 text-center text-xs text-slate-500">Tidak ada SKU di tampilan ini.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pagedOpname.map((item) => {
                      const system = gudangOf(item.sku);
                      const count = scopedCounts[item.sku];
                      const diff = count ? (count.physical ?? 0) - system : null;
                      return (
                        <div key={item.sku} className="px-4 py-2.5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] md:items-center gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                          </div>
                          <div className="flex items-center gap-3 md:contents">
                            <div className="md:w-24 md:text-right">
                              <span className="text-slate-500 md:hidden">Sistem </span>
                              <span className={`font-mono font-semibold ${system < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{system}</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              aria-label={`Hitungan fisik ${item.sku}`}
                              placeholder="Fisik"
                              value={count?.physical ?? ''}
                              onChange={(e) => setPhysical(item.sku, e.target.value)}
                              className={`${SMALL_INPUT} w-24 font-mono text-right`}
                            />
                            <div className={`md:w-20 md:text-right font-mono font-semibold ${diff === null ? 'text-slate-400' : diff === 0 ? 'text-slate-600' : diff > 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                              {diff === null ? 'belum' : diff === 0 ? 'cocok' : signed(diff)}
                            </div>
                          </div>
                          {diff !== null && diff !== 0 && (
                            <input
                              type="text"
                              aria-label={`Alasan selisih ${item.sku}`}
                              placeholder={opnameReason || 'Alasan selisih (opsional)'}
                              value={count?.reason || ''}
                              onChange={(e) => setReason(item.sku, e.target.value)}
                              className={`${SMALL_INPUT} md:col-span-4`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <Pager page={opnamePageNow} total={opnamePages} count={opnameRows.length} onChange={setOpnamePage} noun="SKU" />
              </div>
            </div>
          )}

          {opnameView === 'satu' && (
            <form onSubmit={handleSingleOpname} className={`${CARD} p-5 space-y-3.5 text-xs max-w-lg`}>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Sesuaikan satu SKU</h2>
                <p className="text-slate-500 mt-0.5">Stok gudang diganti dengan hasil hitungan fisik; selisihnya tercatat di kartu stok.</p>
              </div>
              <FormError message={formError} />
              <Field label="SKU *">
                <select value={singleSku} onChange={(e) => setSingleSku(e.target.value)} className={INPUT}>
                  <option value="">Pilih SKU…</option>
                  {sortedSkus.map((s) => (
                    <option key={s.sku} value={s.sku}>
                      {skuLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hitungan fisik (pcs) *" hint={singleSku ? `Sistem ${gudangOf(singleSku)} pcs` : undefined}>
                  <input type="number" min="0" value={singlePhysical} onChange={(e) => setSinglePhysical(e.target.value)} className={`${INPUT} font-mono`} />
                </Field>
                <Field label="Selisih">
                  <div className={`${INPUT} bg-slate-50 font-mono`}>{singleSku && singlePhysical !== '' ? signed(Math.floor(Number(singlePhysical)) - gudangOf(singleSku)) : '–'}</div>
                </Field>
              </div>
              <Field label="Alasan *">
                <input type="text" value={singleReason} onChange={(e) => setSingleReason(e.target.value)} placeholder="Contoh: salah hitung saat terima barang" className={INPUT} />
              </Field>
              <div className="flex justify-end">
                <button type="submit" className={PRIMARY_BUTTON}>
                  Simpan penyesuaian
                </button>
              </div>
            </form>
          )}

          {opnameView === 'riwayat' && (
            <div className={`${CARD} overflow-hidden`}>
              {stockOpnameSessions.length === 0 ? (
                <p className="p-10 text-center text-xs text-slate-500">Belum ada sesi opname.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stockOpnameSessions.map((sess) => (
                    <div key={sess.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          <span className="font-mono">{sess.nomorSesi}</span> · {sess.judul}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {sess.tanggal} · {sess.petugas} · {sess.totalItemChecked} SKU: {sess.totalMatch} cocok, {sess.totalSurplus} lebih, {sess.totalDeficit} kurang · selisih{' '}
                          {signed(sess.netSelisihQty)} pcs ({formatRupiah(sess.netSelisihNominal)})
                        </div>
                      </div>
                      <button type="button" onClick={() => setViewingSession(sess)} className={`${OUTLINE_BUTTON} py-1.5 shrink-0`}>
                        <Eye className="w-3.5 h-3.5" /> Rincian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= REJECT ================= */}
      {activeTab === 'reject' && (
        <form onSubmit={handleRejectSubmit} className={`${CARD} p-5 space-y-3.5 text-xs max-w-lg`}>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Catat barang reject</h2>
            <p className="text-slate-500 mt-0.5">Barang cacat atau rusak dikeluarkan dari stok siap jual Gudang Utama.</p>
          </div>
          <FormError message={formError} />
          <Field label="SKU *" hint="Hanya SKU yang stok gudangnya ada.">
            <select value={rejectSku} onChange={(e) => setRejectSku(e.target.value)} className={INPUT}>
              <option value="">Pilih SKU…</option>
              {rejectChoices.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {skuLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah (pcs) *" hint={rejectSku ? `Stok gudang ${gudangOf(rejectSku)} pcs` : undefined}>
              <input
                type="number"
                min="1"
                max={rejectSku ? gudangOf(rejectSku) : undefined}
                value={rejectQty || ''}
                onChange={(e) => setRejectQty(Number(e.target.value) || 0)}
                className={`${INPUT} font-mono`}
              />
            </Field>
            <Field label="Alasan *">
              <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={INPUT}>
                <option value="">Pilih alasan…</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" className={PRIMARY_BUTTON}>
              Keluarkan dari stok
            </button>
          </div>
        </form>
      )}

      {/* ================= KARTU STOK ================= */}
      {activeTab === 'kartu' && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <select aria-label="SKU" value={cardSku} onChange={(e) => resetCardLimit(setCardSku)(e.target.value)} className={SMALL_INPUT}>
              <option value="ALL">Semua SKU</option>
              {sortedSkus.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.name} · {s.sku}
                </option>
              ))}
            </select>
            <select aria-label="Jenis mutasi" value={cardType} onChange={(e) => resetCardLimit(setCardType)(e.target.value)} className={SMALL_INPUT}>
              <option value="ALL">Semua jenis</option>
              {movementTypes.map((t) => (
                <option key={t} value={t}>
                  {movementTypeLabel(t)}
                </option>
              ))}
            </select>
            <input type="date" aria-label="Dari tanggal" value={cardFrom} onChange={(e) => resetCardLimit(setCardFrom)(e.target.value)} className={SMALL_INPUT} />
            <input type="date" aria-label="Sampai tanggal" value={cardTo} onChange={(e) => resetCardLimit(setCardTo)(e.target.value)} className={SMALL_INPUT} />
          </div>
          {cardSku !== 'ALL' && (
            <p className="px-4 py-2 border-b border-slate-100 text-xs text-slate-600">
              Stok gudang sekarang <strong className="font-mono">{gudangOf(cardSku)} pcs</strong>. Kolom Saldo = saldo gudang setelah mutasi itu (mutasi di reseller tidak
              mengubahnya).
            </p>
          )}
          {cardRows.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">Tidak ada mutasi yang cocok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    {cardSku === 'ALL' && <th className="px-3 py-3">SKU</th>}
                    <th className="px-3 py-3">Jenis</th>
                    <th className="px-3 py-3">Lokasi</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    {cardSku !== 'ALL' && <th className="px-3 py-3 text-right">Saldo</th>}
                    <th className="px-3 py-3">Referensi</th>
                    <th className="px-4 py-3">Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cardRows.slice(0, cardLimit).map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">{mov.tanggal}</td>
                      {cardSku === 'ALL' && <td className="px-3 py-2.5 font-mono whitespace-nowrap">{mov.sku}</td>}
                      <td className="px-3 py-2.5 whitespace-nowrap">{movementTypeLabel(mov.tipe)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{mov.lokasi}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${mov.qty < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{signed(mov.qty)}</td>
                      {cardSku !== 'ALL' && (
                        <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${(mov.balance ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{mov.balance}</td>
                      )}
                      <td className="px-3 py-2.5 min-w-[200px]">
                        <div>{mov.referensi}</div>
                        {mov.catatan && <div className="text-slate-500">{mov.catatan}</div>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{mov.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cardRows.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Menampilkan {Math.min(cardLimit, cardRows.length)} dari {cardRows.length} mutasi
              </span>
              {cardRows.length > cardLimit && (
                <button type="button" onClick={() => setCardLimit((n) => n + CARD_HISTORY_STEP)} className={OUTLINE_BUTTON}>
                  Tampilkan {Math.min(CARD_HISTORY_STEP, cardRows.length - cardLimit)} lagi
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: stok minimum */}
      {editingSku && (
        <Modal title="Ubah stok minimum" subtitle={`${editingSku.name} · ${editingSku.sku}`} onClose={() => setEditingSku(null)}>
          <form onSubmit={handleSaveMinStock} className="space-y-3.5 text-xs">
            <Field label="Stok minimum (pcs)" hint="SKU ditandai Menipis bila stok gudang sama atau di bawah angka ini.">
              <input type="number" min="0" value={editMinStock} onChange={(e) => setEditMinStock(Number(e.target.value) || 0)} className={`${INPUT} font-mono`} />
            </Field>
            <p className="text-slate-500">
              Nama, harga, HPP, dan kode SKU diubah di{' '}
              <button
                type="button"
                onClick={() => {
                  setEditingSku(null);
                  setCurrentView('products');
                }}
                className="font-semibold text-slate-900 underline cursor-pointer"
              >
                Master SKU
              </button>
              .
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditingSku(null)} className={OUTLINE_BUTTON}>
                Batal
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: rincian sesi opname */}
      {viewingSession && (
        <Modal
          title={`${viewingSession.nomorSesi} · ${viewingSession.judul}`}
          subtitle={`${viewingSession.tanggal} · ${viewingSession.petugas} · ${viewingSession.alasanGlobal}`}
          onClose={() => setViewingSession(null)}
          wide
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Sistem</th>
                  <th className="px-3 py-2 text-right">Fisik</th>
                  <th className="px-3 py-2 text-right">Selisih</th>
                  <th className="px-3 py-2 text-right">Dampak HPP</th>
                  <th className="px-3 py-2">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewingSession.items.map((it) => (
                  <tr key={it.sku}>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">{it.namaProduk}</div>
                      <div className="font-mono text-[11px] text-slate-500">{it.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{it.systemQty}</td>
                    <td className="px-3 py-2 text-right font-mono">{it.physicalQty}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${it.selisihQty < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{signed(it.selisihQty)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formatRupiah(it.selisihNominal)}</td>
                    <td className="px-3 py-2 text-slate-600">{it.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};
