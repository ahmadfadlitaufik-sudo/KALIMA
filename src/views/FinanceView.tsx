import React, { useState, useMemo } from 'react';
import { receivableAging, sortNewestFirst } from '../services/financeLedger';
import { missingHppSkus, monthLabelId, oldestFirst, receivableReminder } from '../services/financeChecks';
import { latestOrderMonth } from '../services/salesPeriod';
import { showNotice } from '../services/dialogStore';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  MoreHorizontal,
  Edit2,
  Calendar,
  PieChart,
  EyeOff,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  RotateCcw,
  AlertTriangle,
  Building2,
  Wallet,
  Scale,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BiayaOperasional, Order } from '../types';
import { CashBankSection } from '../components/CashBankSection';
import { BalanceSheetSection } from '../components/BalanceSheetSection';
import { MonthlyPnLChart } from '../components/MonthlyPnLChart';
import { useCashBank } from '../hooks/useCashBank';

/** Jumlah baris per tampilan untuk daftar panjang (OPEX, piutang). */
const LIST_PAGE_SIZE = 25;

export const FinanceView: React.FC = () => {
  const {
    isOwner,
    skus,
    orders,
    biayaOperasional,
    addBiayaOperasional,
    updateBiayaOperasional,
    deleteBiayaOperasional,
    clearBiayaOperasional,
  } = useApp();

  const {
    cashAccounts,
    handleSalesPaymentSaved,
    defaultAccount,
    potongSaldo,
    tambahSaldo,
  } = useCashBank();

  // Tab: 'kas_bank' | 'pl_opex' | 'piutang' | 'neraca'
  const [activeTab, setActiveTab] = useState<'kas_bank' | 'pl_opex' | 'piutang' | 'neraca'>('kas_bank');

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  // Active filter type: 'month' | 'custom' | 'all'
  const [filterType, setFilterType] = useState<'month' | 'custom' | 'all'>('month');
  const [selectedMonth, setSelectedMonthState] = useState(() => latestOrderMonth(orders, currentMonthStr));
  /** Setelah pengguna memilih bulan sendiri, bulan tidak lagi berpindah otomatis saat data dimuat ulang. */
  const monthChosenRef = React.useRef(false);
  const setSelectedMonth = (month: string) => {
    monthChosenRef.current = true;
    setSelectedMonthState(month);
  };
  React.useEffect(() => {
    if (!monthChosenRef.current) {
      setSelectedMonthState(latestOrderMonth(orders, currentMonthStr));
    }
  }, [orders, currentMonthStr]);
  const [customStartDate, setCustomStartDate] = useState('2026-03-01');
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Dialog konfirmasi kosongkan OPEX
  const [isConfirmClearOpexOpen, setIsConfirmClearOpexOpen] = useState(false);

  // Daftar semua bulan yang memiliki transaksi atau pengeluaran
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    orders.forEach((o) => {
      if (o.tanggal && o.tanggal.length >= 7) monthSet.add(o.tanggal.substring(0, 7));
    });
    biayaOperasional.forEach((b) => {
      if (b.tanggal && b.tanggal.length >= 7) monthSet.add(b.tanggal.substring(0, 7));
    });
    monthSet.add(currentMonthStr);
    monthSet.add(selectedMonth);
    return Array.from(monthSet).sort().reverse();
  }, [orders, biayaOperasional, currentMonthStr, selectedMonth]);

  const { customOpexCategories: customCategoryList, setCustomOpexCategories: setCustomCategoryList } = useApp();

  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [opexSearchQuery, setOpexSearchQuery] = useState('');

  const handleSaveNewCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryNameInput.trim();
    if (!trimmed) return;
    if (!customCategoryList.includes(trimmed)) {
      const updated = [...customCategoryList, trimmed];
      setCustomCategoryList(updated);
    }
    setNewCategoryNameInput('');
    setIsAddCategoryModalOpen(false);
  };

  const allAvailableCategories = useMemo(() => {
    const standard = [
      'Marketing & Ads',
      'Gaji, Upah & Training',
      'Entertainment & Jamuan',
      'Packaging & Logistik',
      'Sewa & Utilitas',
      'Operasional, Software & Tools',
      'Pajak & Legalitas',
      'Lain-lain / Pengeluaran Umum',
    ];
    const fromData = Array.from(new Set(biayaOperasional.map((b) => b.kategori).filter(Boolean)));
    return Array.from(new Set([...standard, ...customCategoryList, ...fromData]));
  }, [biayaOperasional, customCategoryList]);

  // Modal Add OPEX
  const [isAddOpexOpen, setIsAddOpexOpen] = useState(false);
  const [opexKategori, setOpexKategori] = useState<BiayaOperasional['kategori']>('Marketing & Ads');
  const [opexCustomCategory, setOpexCustomCategory] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [opexJumlah, setOpexJumlah] = useState<number>(0);
  const [opexDeskripsi, setOpexDeskripsi] = useState('');
  const [opexAccountId, setOpexAccountId] = useState<string>('');
  const [selectedOpexCategoryFilter, setSelectedOpexCategoryFilter] = useState<string>('ALL');

  const openAddOpexModal = () => {
    const defaultAcc = cashAccounts.find((a) => a.isDefault) || cashAccounts[0];
    setOpexAccountId(defaultAcc?.id || '');
    setIsCustomCategoryMode(false);
    setOpexCustomCategory('');
    setIsAddOpexOpen(true);
  };

  // Modal Edit OPEX State
  const [editingOpex, setEditingOpex] = useState<BiayaOperasional | null>(null);
  const [editOpexTanggal, setEditOpexTanggal] = useState('');
  const [editOpexKategori, setEditOpexKategori] = useState('');
  const [editOpexDeskripsi, setEditOpexDeskripsi] = useState('');
  const [editOpexJumlah, setEditOpexJumlah] = useState<number>(0);
  const [editOpexAccountId, setEditOpexAccountId] = useState<string>('none');
  const [isEditCustomCategoryMode, setIsEditCustomCategoryMode] = useState(false);
  const [editOpexCustomCategory, setEditOpexCustomCategory] = useState('');

  const handleOpenEditOpex = (item: BiayaOperasional) => {
    setEditingOpex(item);
    setEditOpexTanggal(item.tanggal || todayStr);
    setEditOpexDeskripsi(item.deskripsi);
    setEditOpexJumlah(item.jumlah);
    setEditOpexAccountId(item.accountId || 'none');

    const standardCats = [
      'Marketing & Ads',
      'Gaji, Upah & Training',
      'Entertainment & Jamuan',
      'Packaging & Logistik',
      'Sewa & Utilitas',
      'Operasional, Software & Tools',
      'Pajak & Legalitas',
      'Lain-lain / Pengeluaran Umum',
    ];

    if (standardCats.includes(item.kategori)) {
      setEditOpexKategori(item.kategori);
      setIsEditCustomCategoryMode(false);
      setEditOpexCustomCategory('');
    } else {
      setEditOpexKategori('__CUSTOM__');
      setIsEditCustomCategoryMode(true);
      setEditOpexCustomCategory(item.kategori);
    }
  };

  const handleSaveEditOpex = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpex || editOpexJumlah <= 0) return;

    const finalCategory =
      isEditCustomCategoryMode && editOpexCustomCategory.trim()
        ? editOpexCustomCategory.trim()
        : editOpexKategori;

    updateBiayaOperasional(editingOpex.id, {
      tanggal: editOpexTanggal || editingOpex.tanggal,
      kategori: finalCategory,
      deskripsi: editOpexDeskripsi.trim() || finalCategory,
      jumlah: editOpexJumlah,
      accountId: editOpexAccountId === 'none' ? undefined : editOpexAccountId,
    });

    setEditingOpex(null);
  };

  // Settle Payment Modal
  const [settleOrder, setSettleOrder] = useState<Order | null>(null);
  const [visibleReceivableCount, setVisibleReceivableCount] = useState(LIST_PAGE_SIZE);
  const [visibleOpexCount, setVisibleOpexCount] = useState(LIST_PAGE_SIZE);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState('Transfer BCA');
  const [settleAccountId, setSettleAccountId] = useState<string>('');

  // Filter orders
  const monthOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.statusOrder === 'batal') return false;
      if (filterType === 'all') return true;
      if (filterType === 'month') return o.tanggal.startsWith(selectedMonth);
      if (filterType === 'custom') {
        if (customStartDate && o.tanggal < customStartDate) return false;
        if (customEndDate && o.tanggal > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [orders, filterType, selectedMonth, customStartDate, customEndDate]);

  // Filter OPEX
  const monthOpex = useMemo(() => {
    return sortNewestFirst(biayaOperasional).filter((b) => {
      if (filterType === 'all') return true;
      if (filterType === 'month') return b.tanggal.startsWith(selectedMonth);
      if (filterType === 'custom') {
        if (customStartDate && b.tanggal < customStartDate) return false;
        if (customEndDate && b.tanggal > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [biayaOperasional, filterType, selectedMonth, customStartDate, customEndDate]);

  // P&L Metrics
  const grossSales = useMemo(() => {
    return monthOrders.reduce((sum, o) => sum + o.subtotal, 0);
  }, [monthOrders]);

  const totalDiskon = useMemo(() => {
    return monthOrders.reduce((sum, o) => sum + o.diskon, 0);
  }, [monthOrders]);

  const netSales = Math.max(0, grossSales - totalDiskon);

  const totalAdminFees = useMemo(() => {
    return monthOrders.reduce((sum, o) => sum + o.adminFeeAmount, 0);
  }, [monthOrders]);

  const totalHpp = useMemo(() => {
    return monthOrders.reduce((sum, o) => sum + o.totalHpp, 0);
  }, [monthOrders]);

  const grossProfit = netSales - totalHpp - totalAdminFees;
  const skusWithoutHpp = useMemo(() => missingHppSkus(monthOrders, skus), [monthOrders, skus]);

  const totalOpex = useMemo(() => {
    return monthOpex.reduce((sum, b) => sum + b.jumlah, 0);
  }, [monthOpex]);

  const netProfit = grossProfit - totalOpex;

  /** Nama periode yang sedang difilter, untuk judul rincian laba rugi. */
  const plPeriodLabel =
    filterType === 'month'
      ? monthLabelId(selectedMonth)
      : filterType === 'custom'
        ? `${customStartDate || 'awal'} s.d. ${customEndDate || 'sekarang'}`
        : 'Semua periode';

  // Category Breakdown for OPEX
  const opexCategoryBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    monthOpex.forEach((b) => {
      const cat = b.kategori || 'Lain-lain / Pengeluaran Umum';
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += b.jumlah;
      map[cat].count += 1;
    });

    const entries = Object.entries(map).map(([kategori, val]) => ({
      kategori,
      total: val.total,
      count: val.count,
      percent: totalOpex > 0 ? ((val.total / totalOpex) * 100).toFixed(1) : '0',
    }));

    return entries.sort((a, b) => b.total - a.total);
  }, [monthOpex, totalOpex]);

  // Filtered OPEX list based on selected category chip & search query
  const filteredMonthOpex = useMemo(() => {
    return monthOpex.filter((b) => {
      if (selectedOpexCategoryFilter !== 'ALL' && b.kategori !== selectedOpexCategoryFilter) {
        return false;
      }
      if (opexSearchQuery.trim()) {
        const q = opexSearchQuery.toLowerCase();
        const matchDesc = (b.deskripsi || '').toLowerCase().includes(q);
        const matchCat = (b.kategori || '').toLowerCase().includes(q);
        const matchAcc = (b.accountNama || '').toLowerCase().includes(q);
        const matchAmount = b.jumlah.toString().includes(q);
        if (!matchDesc && !matchCat && !matchAcc && !matchAmount) return false;
      }
      return true;
    });
  }, [monthOpex, selectedOpexCategoryFilter, opexSearchQuery]);

  /** Satu gaya netral untuk semua kategori OPEX; nama kategori sudah cukup membedakan. */
  const getCategoryBadgeColor = (_cat: string) => 'bg-white text-slate-700 border-slate-200';

  // Receivables (Piutang)
  const allReceivableOrders = useMemo(() => {
    return oldestFirst(orders.filter((o) => o.sisaPiutang > 0 && o.statusOrder !== 'batal'));
  }, [orders]);

  const totalAllPiutang = useMemo(() => {
    return allReceivableOrders.reduce((sum, o) => sum + o.sisaPiutang, 0);
  }, [allReceivableOrders]);

  // Umur piutang (dari tanggal order)
  const agingData = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return receivableAging(allReceivableOrders, today);
  }, [allReceivableOrders]);

  const handleSaveOpex = (e: React.FormEvent) => {
    e.preventDefault();
    if (opexJumlah <= 0) return;

    const finalCategory = isCustomCategoryMode && opexCustomCategory.trim()
      ? opexCustomCategory.trim()
      : opexKategori;

    addBiayaOperasional({
      tanggal: new Date().toISOString().split('T')[0],
      kategori: finalCategory,
      deskripsi: opexDeskripsi || finalCategory,
      jumlah: opexJumlah,
      accountId: opexAccountId || undefined,
    });
    setIsAddOpexOpen(false);
    setOpexJumlah(0);
    setOpexDeskripsi('');
    setOpexAccountId('');
    setIsCustomCategoryMode(false);
    setOpexCustomCategory('');
  };

  /** Salin pesan tagihan ke clipboard untuk ditempel ke WhatsApp. */
  const copyReminder = async (ord: Order) => {
    try {
      await navigator.clipboard.writeText(receivableReminder(ord));
      void showNotice(`Pesan tagihan untuk ${ord.customerNama} sudah disalin. Tempel ke WhatsApp.`, 'Pesan disalin');
    } catch {
      void showNotice('Pesan tidak bisa disalin otomatis di browser ini.', 'Gagal menyalin');
    }
  };

  const handleSaveSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder || settleAmount <= 0) return;
    handleSalesPaymentSaved({
      orderId: settleOrder.id,
      amount: settleAmount,
      method: settleMethod,
      accountId: settleAccountId || undefined,
      note: `Pelunasan piutang #${settleOrder.noOrder} via Finance`,
    });
    setSettleOrder(null);
    setSettleAccountId('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Tab */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(
          [
            ['kas_bank', 'Kas & Bank', String(cashAccounts.length), false],
            ['pl_opex', 'Laba Rugi & Biaya', '', !isOwner],
            ['piutang', 'Piutang', allReceivableOrders.length > 0 ? String(allReceivableOrders.length) : '', false],
            ['neraca', 'Neraca', '', !isOwner],
          ] as const
        )
          .filter(([, , , hidden]) => !hidden)
          .map(([id, label, badge]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === id ? 'segmented-pill-active' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{label}</span>
              {badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${id === 'piutang' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>{badge}</span>
              )}
            </button>
          ))}
      </div>

      {/* Role notice for Admin */}
      {!isOwner && activeTab === 'pl_opex' && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-center justify-between text-xs text-slate-900">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-slate-900" />
            <span>
              Anda login sebagai <strong>Admin/CS</strong>. Sesuai PRD, modul Laba Kotor, HPP, dan Biaya Operasional (OPEX) hanya dapat diakses oleh Owner.
            </span>
          </div>
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
            Piutang
          </span>
        </div>
      )}

      {/* TAB 1: KAS & BANK */}
      {activeTab === 'kas_bank' && <CashBankSection />}

      {/* TAB 2: OWNER FINANCIAL SUMMARY & P&L REPORT */}
      {activeTab === 'pl_opex' && isOwner && (
        <div className="space-y-5">
          {/* Header & Filter Periode */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Laporan Laba Rugi
              </h2>
              <p className="text-xs text-slate-400">
                Dihitung otomatis dari order, HPP per SKU, biaya admin marketplace, dan biaya operasional.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Periode:</span>
              
              {/* Filter Type Buttons */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                    filterType === 'all'
                      ? 'segmented-pill-active font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilterType('month')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                    filterType === 'month'
                      ? 'segmented-pill-active font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Per Bulan
                </button>
                <button
                  onClick={() => setFilterType('custom')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                    filterType === 'custom'
                      ? 'segmented-pill-active font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Rentang Tanggal
                </button>
              </div>

              {/* Month Selector */}
              {filterType === 'month' && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white cursor-pointer font-medium"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {monthLabelId(m)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1 text-xs text-white"
                  />
                </div>
              )}

              {/* Custom Date Range Selector */}
              {filterType === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1 text-xs text-slate-300">
                    <span className="text-[11px] text-slate-400">Dari:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                  <span className="text-slate-500 text-xs">-</span>
                  <div className="flex items-center gap-1 text-xs text-slate-300">
                    <span className="text-[11px] text-slate-400">Sampai:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={openAddOpexModal}
                className="flex items-center gap-1.5 segmented-pill-active hover:opacity-90 font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm cursor-pointer ml-auto sm:ml-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat biaya</span>
              </button>
            </div>
          </div>

          {skusWithoutHpp.length > 0 && (
            <div role="note" className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                HPP belum diisi untuk <strong>{skusWithoutHpp.length} SKU</strong> yang terjual di periode ini, jadi aplikasi memakai HPP perkiraan dan laba kotor belum akurat. Isi HPP-nya di Master SKU.
              </span>
            </div>
          )}

          {/* 4 Financial Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs text-slate-400 mb-1">Penjualan bersih</div>
              <div className="text-lg sm:text-2xl font-black text-white font-mono">
                Rp {netSales.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Sebelum diskon Rp {grossSales.toLocaleString('id-ID')} (diskon Rp {totalDiskon.toLocaleString('id-ID')})
              </div>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs text-slate-400 mb-1">Laba kotor</div>
              <div className="text-lg sm:text-2xl font-black text-indigo-700 font-mono">
                Rp {grossProfit.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Margin: {netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs text-slate-400 mb-1">Biaya operasional</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono">
                Rp {totalOpex.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {monthOpex.length} pos pengeluaran tercatat
              </div>
            </div>

            <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs text-slate-400 mb-1">Laba bersih</div>
              <div
                className={`text-lg sm:text-2xl font-black font-mono ${
                  netProfit >= 0 ? 'text-indigo-700' : 'text-rose-700'
                }`}
              >
                Rp {netProfit.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Margin bersih: {netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>

          {/* Visualisasi Recharts Tren Laba Rugi Bulanan */}
          <MonthlyPnLChart
            orders={orders}
            biayaOperasional={biayaOperasional}
            selectedMonth={filterType === 'month' ? selectedMonth : undefined}
            onSelectMonth={(m) => {
              setSelectedMonth(m);
              setFilterType('month');
            }}
          />

          {/* Structured P&L Statement & Category Breakdown Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: P&L Statement */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-700" />
                  <span>Rincian Laba Rugi · {plPeriodLabel}</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Dihitung otomatis
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-200">
                  <span>(+) Penjualan sebelum diskon</span>
                  <span>Rp {grossSales.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>(-) Diskon penjualan</span>
                  <span>- Rp {totalDiskon.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
                  <span>(=) PENJUALAN BERSIH</span>
                  <span>Rp {netSales.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between text-rose-700 pt-2">
                  <span>(-) Harga pokok penjualan (HPP)</span>
                  <span>- Rp {totalHpp.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>(-) Biaya admin marketplace & channel</span>
                  <span>- Rp {totalAdminFees.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-bold pt-1 border-t border-slate-800">
                  <span>(=) LABA KOTOR</span>
                  <span>Rp {grossProfit.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between text-slate-900 pt-2">
                  <span>(-) Biaya operasional</span>
                  <span>- Rp {totalOpex.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-base font-black text-indigo-700 pt-2 border-t-2 border-slate-700">
                  <span>(=) LABA BERSIH</span>
                  <span>Rp {netProfit.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Tabel Ringkasan Beban Operasional per Kategori */}
            <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-slate-900" />
                      <span>Ringkasan Beban per Kategori</span>
                    </h3>
                    <div className="text-xs text-slate-900 font-mono font-semibold">
                      Total: Rp {totalOpex.toLocaleString('id-ID')} ({opexCategoryBreakdown.length} Kategori Aktif)
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryModalOpen(true)}
                      className="text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-700/80 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-slate-900" />
                      <span>Kategori Baru</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddOpexModal}
                      className="text-xs text-slate-900 hover:text-slate-900 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                    >
                      + Catat Pengeluaran
                    </button>
                  </div>
                </div>

                {/* Tabel Ringkasan Kategori */}
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                      <tr>
                        <th className="py-2 px-2.5">Kategori Beban</th>
                        <th className="py-2 px-2 text-center">Freq</th>
                        <th className="py-2 px-2.5 text-right">Total (Rp)</th>
                        <th className="py-2 px-2.5 text-right">Porsi OPEX</th>
                        <th className="py-2 px-2 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {opexCategoryBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                            Belum ada pengeluaran operasional yang dicatat di periode ini.
                          </td>
                        </tr>
                      ) : (
                        opexCategoryBreakdown.map((cat, idx) => {
                          const isFiltered = selectedOpexCategoryFilter === cat.kategori;
                          const pctNum = parseFloat(cat.percent) || 0;

                          return (
                            <tr
                              key={cat.kategori}
                              className={`hover:bg-slate-850/50 transition-colors ${
                                isFiltered ? 'bg-slate-100 border-l-2 border-slate-900' : ''
                              }`}
                            >
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full border text-[11px] font-semibold ${getCategoryBadgeColor(
                                      cat.kategori
                                    )}`}
                                  >
                                    {cat.kategori}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center font-mono text-slate-400">
                                {cat.count}x
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                Rp {cat.total.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-12 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-indigo-600 h-full rounded-full"
                                      style={{ width: `${Math.min(100, pctNum)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-300">
                                    {cat.percent}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedOpexCategoryFilter(
                                      isFiltered ? 'ALL' : cat.kategori
                                    )
                                  }
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                                    isFiltered
                                      ? 'segmented-pill-active font-bold'
                                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                  }`}
                                >
                                  {isFiltered ? 'Aktif' : 'Filter'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedOpexCategoryFilter !== 'ALL' && (
                <div className="p-2 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-900 mt-2">
                  <span>
                    Menampilkan pengeluaran kategori: <strong>{selectedOpexCategoryFilter}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOpexCategoryFilter('ALL')}
                    className="text-[11px] text-slate-900 hover:underline font-bold cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM: Buku Kas Detail Pengeluaran (Expense Ledger Table) */}
          <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Buku Catatan Pengeluaran Operasional (Ledger)</span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {filteredMonthOpex.length} Transaksi
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar transaksi pengeluaran operasional terperinci sesuai filter periode & kategori
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative">
                  <input
                    type="text"
                    value={opexSearchQuery}
                    onChange={(e) => setOpexSearchQuery(e.target.value)}
                    placeholder="Cari deskripsi / kategori / kas..."
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 w-56 focus:outline-none focus:border-amber-500/50"
                  />
                  {opexSearchQuery && (
                    <button aria-label="Hapus pencarian"
                      type="button"
                      onClick={() => setOpexSearchQuery('')}
                      className="absolute right-2 top-1.5 text-slate-500 hover:text-white text-xs"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>


                <button
                  type="button"
                  onClick={openAddOpexModal}
                  className="text-xs segmented-pill-active hover:opacity-90 font-bold px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-950" />
                  <span>Tambah Beban</span>
                </button>

                {biayaOperasional.length > 0 && (
                  <details className="relative">
                    <summary
                      className="list-none p-2 rounded-xl border border-slate-200 bg-white hover:border-slate-900 cursor-pointer [&::-webkit-details-marker]:hidden"
                      aria-label="Menu lainnya buku OPEX"
                      title="Lainnya"
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-700" aria-hidden="true" />
                    </summary>
                    <div className="absolute right-0 mt-1 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                          setIsConfirmClearOpexOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Kosongkan semua OPEX…
                      </button>
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Quick Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedOpexCategoryFilter('ALL')}
                aria-pressed={selectedOpexCategoryFilter === 'ALL'}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  selectedOpexCategoryFilter === 'ALL'
                    ? 'segmented-pill-active border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                Semua Kategori ({monthOpex.length})
              </button>
              {opexCategoryBreakdown.map((cat) => {
                const isSelected = selectedOpexCategoryFilter === cat.kategori;
                const badgeClass = getCategoryBadgeColor(cat.kategori);

                return (
                  <button
                    key={cat.kategori}
                    type="button"
                    onClick={() =>
                      setSelectedOpexCategoryFilter(
                        isSelected ? 'ALL' : cat.kategori
                      )
                    }
                    aria-pressed={isSelected}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isSelected ? 'segmented-pill-active border-slate-900' : badgeClass + ' hover:border-slate-400'
                    }`}
                  >
                    <span>{cat.kategori}</span>
                    <span className="font-mono text-[11px] opacity-80">
                      ({cat.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Keterangan / Deskripsi</th>
                    <th className="py-2.5 px-3">Sumber Kas/Bank</th>
                    <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredMonthOpex.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        {opexSearchQuery || selectedOpexCategoryFilter !== 'ALL'
                          ? 'Tidak ada pengeluaran yang cocok dengan kriteria filter.'
                          : 'Belum ada pengeluaran operasional yang dicatat di periode ini.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMonthOpex.slice(0, visibleOpexCount).map((b) => (
                      <tr key={b.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-700 text-xs tabular-nums whitespace-nowrap">
                          {b.tanggal}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${getCategoryBadgeColor(
                              b.kategori
                            )}`}
                          >
                            {b.kategori}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white max-w-xs">
                          {b.deskripsi}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-xs">
                          {b.accountNama ? (
                            <span className="text-slate-900/90 font-medium">
                              {b.accountNama}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                          Rp {b.jumlah.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOpex(b)}
                              title="Edit Pengeluaran" aria-label="Edit Pengeluaran"
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBiayaOperasional(b.id)}
                              title="Hapus Pengeluaran" aria-label="Hapus Pengeluaran"
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredMonthOpex.length > visibleOpexCount && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleOpexCount((count) => count + LIST_PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:border-slate-900 cursor-pointer"
                >
                  Tampilkan {Math.min(LIST_PAGE_SIZE, filteredMonthOpex.length - visibleOpexCount)} lagi ({visibleOpexCount} dari {filteredMonthOpex.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PIUTANG & JATUH TEMPO SECTION */}
      {activeTab === 'piutang' && (
        <div className="space-y-4">
          <div className="bg-[#121620] p-5 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-rose-700" />
                  Piutang pelanggan
                </h2>
                <p className="text-xs text-slate-400">
                  Total belum dibayar: <strong className="text-rose-700 font-mono">Rp {totalAllPiutang.toLocaleString('id-ID')}</strong> dari {allReceivableOrders.length} order, yang paling lama di atas.
                </p>
              </div>
            </div>

            {/* Umur piutang */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {(
                [
                  { key: 'under7', label: '≤ 7 hari', urgent: false },
                  { key: 'days8to14', label: '8–14 hari', urgent: false },
                  { key: 'days15to30', label: '15–30 hari', urgent: true },
                  { key: 'over30', label: '> 30 hari (macet)', urgent: true },
                ] as const
              ).map((bucket) => {
                const data = agingData[bucket.key];
                return (
                  <div
                    key={bucket.key}
                    className={`p-3 rounded-xl border ${bucket.urgent && data.count > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}
                  >
                    <div className={`text-xs ${bucket.urgent && data.count > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>{bucket.label}</div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums mt-1">Rp {data.total.toLocaleString('id-ID')}</div>
                    <div className="text-xs text-slate-500">{data.count} order</div>
                  </div>
                );
              })}
            </div>

            {/* HP: daftar kartu */}
            <div className="md:hidden space-y-2">
              {allReceivableOrders.length === 0 ? (
                <p className="py-8 text-center text-xs font-medium text-slate-600">Semua piutang telah lunas.</p>
              ) : (
                allReceivableOrders.slice(0, visibleReceivableCount).map((ord) => {
                  const isOverdue = ord.jatuhTempo && ord.jatuhTempo < todayStr;
                  return (
                    <div key={ord.id} className="border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{ord.customerNama}</div>
                          <div className="font-mono text-[11px] text-slate-500">{ord.noOrder} · {ord.tanggal}</div>
                        </div>
                        <div className="text-right font-mono font-bold text-rose-700 whitespace-nowrap">Rp {ord.sisaPiutang.toLocaleString('id-ID')}</div>
                      </div>
                      <div className="text-slate-500">
                        Tagihan Rp {ord.totalTagihan.toLocaleString('id-ID')} · terbayar Rp {ord.totalTerbayar.toLocaleString('id-ID')}
                        {ord.jatuhTempo && <span className={isOverdue ? 'text-rose-700 font-semibold' : ''}> · tempo {ord.jatuhTempo}{isOverdue ? ' (lewat)' : ''}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setSettleOrder(ord); setSettleAmount(ord.sisaPiutang); }} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 cursor-pointer">Catat bayar</button>
                        <button type="button" onClick={() => copyReminder(ord)} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 cursor-pointer">Salin tagihan</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Laptop: tabel */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">No. Order & Tgl</th>
                    <th className="py-2.5 px-3">Channel & Pelanggan</th>
                    <th className="py-2.5 px-3">Jatuh Tempo</th>
                    <th className="py-2.5 px-3 text-right">Total Tagihan</th>
                    <th className="py-2.5 px-3 text-right">Terbayar</th>
                    <th className="py-2.5 px-3 text-right">Sisa Piutang</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {allReceivableOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-indigo-700 text-xs font-medium">
                        Semua piutang telah lunas!
                      </td>
                    </tr>
                  ) : (
                    allReceivableOrders.slice(0, visibleReceivableCount).map((ord) => {
                      const isOverdue = ord.jatuhTempo && ord.jatuhTempo < todayStr;

                      return (
                        <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-white">{ord.noOrder}</div>
                            <div className="text-[11px] text-slate-400">{ord.tanggal}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{ord.customerNama}</div>
                            <div className="text-[11px] text-slate-400">
                              {ord.channel} · Telp: {ord.customerHp}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-xs font-semibold tabular-nums whitespace-nowrap ${isOverdue ? 'text-rose-700' : 'text-slate-700'}`}
                            >
                              {ord.jatuhTempo || 'Tidak ditentukan'}
                            </span>
                            {isOverdue && (
                              <span className="block w-fit mt-0.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold whitespace-nowrap">
                                Lewat jatuh tempo
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                            Rp {ord.totalTagihan.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                            Rp {ord.totalTerbayar.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-bold text-rose-700">
                            Rp {ord.sisaPiutang.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSettleOrder(ord);
                                setSettleAmount(ord.sisaPiutang);
                              }}
                              className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-900 text-slate-900 font-semibold rounded-lg text-xs whitespace-nowrap cursor-pointer"
                            >
                              Catat bayar
                            </button>
                            <button
                              type="button"
                              onClick={() => copyReminder(ord)}
                              className="ml-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-900 text-slate-900 font-semibold rounded-lg text-xs whitespace-nowrap cursor-pointer"
                            >
                              Salin tagihan
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {allReceivableOrders.length > visibleReceivableCount && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleReceivableCount((count) => count + LIST_PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:border-slate-900 cursor-pointer"
                >
                  Tampilkan {Math.min(LIST_PAGE_SIZE, allReceivableOrders.length - visibleReceivableCount)} lagi ({visibleReceivableCount} dari {allReceivableOrders.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LAPORAN NERACA KEUANGAN (BALANCE SHEET) */}
      {activeTab === 'neraca' && isOwner && <BalanceSheetSection />}

      {/* Modal Add OPEX */}
      {isAddOpexOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white">Catat Biaya Operasional (OPEX)</h3>

            <form onSubmit={handleSaveOpex} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Kategori Pos Pengeluaran *</label>
                <select
                  value={isCustomCategoryMode ? '__CUSTOM__' : opexKategori}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsCustomCategoryMode(true);
                    } else {
                      setIsCustomCategoryMode(false);
                      setOpexKategori(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <optgroup label="Kategori Standar & Kustom Tersimpan">
                    {allAvailableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__CUSTOM__">+ Tulis Kategori Kustom Baru...</option>
                </select>

                {isCustomCategoryMode && (
                  <div className="mt-2 space-y-1">
                    <label className="block text-xs text-slate-900 font-semibold">Nama Kategori Kustom:</label>
                    <input
                      type="text"
                      required
                      value={opexCustomCategory}
                      onChange={(e) => setOpexCustomCategory(e.target.value)}
                      placeholder="Contoh: Biaya Renovasi Rak Toko, Training Barista"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bayar Dari Akun Kas/Bank</label>
                <select
                  value={opexAccountId}
                  onChange={(e) => setOpexAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="none">-- Jangan Potong Kas (Pencatatan Saja) --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} ({a.tipe.toUpperCase()} - Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-900/90 mt-0.5">
                  Saldo akun terpilih akan otomatis berkurang & mutasi kas tercatat seketika
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Keterangan *</label>
                <input
                  type="text"
                  required
                  value={opexDeskripsi}
                  onChange={(e) => setOpexDeskripsi(e.target.value)}
                  placeholder="Contoh: Top-up saldo TikTok Ads kampanye 9.9"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nominal Biaya (Rp) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={opexJumlah || ''}
                  onChange={(e) => setOpexJumlah(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpexOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 segmented-pill-active hover:opacity-90 font-bold rounded-lg cursor-pointer shadow-md"
                >
                  Simpan Biaya
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit OPEX */}
      {editingOpex && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#121620] border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-slate-900" />
                <span>Edit Biaya Operasional (OPEX)</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                #{editingOpex.id.substring(0, 8)}
              </span>
            </div>

            <form onSubmit={handleSaveEditOpex} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  value={editOpexTanggal}
                  onChange={(e) => setEditOpexTanggal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kategori Pos Pengeluaran *</label>
                <select
                  value={isEditCustomCategoryMode ? '__CUSTOM__' : editOpexKategori}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      setIsEditCustomCategoryMode(true);
                    } else {
                      setIsEditCustomCategoryMode(false);
                      setEditOpexKategori(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <optgroup label="Kategori Standar & Kustom Tersimpan">
                    {allAvailableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__CUSTOM__">+ Tulis Kategori Kustom Baru...</option>
                </select>

                {isEditCustomCategoryMode && (
                  <div className="mt-2 space-y-1">
                    <label className="block text-xs text-slate-900 font-semibold">Nama Kategori Kustom:</label>
                    <input
                      type="text"
                      required
                      value={editOpexCustomCategory}
                      onChange={(e) => setEditOpexCustomCategory(e.target.value)}
                      placeholder="Contoh: Biaya Renovasi Rak Toko"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Sumber Rekening Kas/Bank</label>
                <select
                  value={editOpexAccountId}
                  onChange={(e) => setEditOpexAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="none">-- Tanpa Rekening Kas (Hanya Pencatatan P&L) --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} ({a.tipe.toUpperCase()} - Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Mengubah akun atau nominal akan otomatis menyesuaikan saldo kas terkait.
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Keterangan *</label>
                <input
                  type="text"
                  required
                  value={editOpexDeskripsi}
                  onChange={(e) => setEditOpexDeskripsi(e.target.value)}
                  placeholder="Keterangan pengeluaran"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nominal Biaya (Rp) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editOpexJumlah || ''}
                  onChange={(e) => setEditOpexJumlah(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOpex(null)}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 segmented-pill-active hover:opacity-90 font-bold rounded-lg cursor-pointer shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {settleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white">
              Pelunasan Piutang #{settleOrder.noOrder}
            </h3>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400">Pelanggan: {settleOrder.customerNama}</div>
              <div className="text-rose-700 font-mono font-bold">
                Sisa Piutang: Rp {settleOrder.sisaPiutang.toLocaleString('id-ID')}
              </div>
            </div>

            <form onSubmit={handleSaveSettle} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Nominal Diterima (Rp)</label>
                <input
                  type="number"
                  min="1"
                  max={settleOrder.sisaPiutang}
                  value={settleAmount || ''}
                  onChange={(e) => setSettleAmount(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Metode</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="Cash / Tunai">Cash / Tunai</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Masuk ke Akun Kas/Bank</label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">-- Otomatis sesuai metode / Default --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} (Saldo: Rp {a.saldo.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleOrder(null)}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg"
                >
                  Simpan Pelunasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KATEGORI KUSTOM BARU */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#121620] border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-900" />
                <span>Tambah Kategori Beban Baru</span>
              </h3>
              <button aria-label="Tutup" data-modal-close
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Kategori baru yang didaftarkan akan tersimpan dan otomatis muncul di pilihan formulir pencatatan pengeluaran.
            </p>

            <form onSubmit={handleSaveNewCustomCategory} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Kategori Beban *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCategoryNameInput}
                  onChange={(e) => setNewCategoryNameInput(e.target.value)}
                  placeholder="Contoh: Endorsement TikTok, Renovasi Display, Konsumsi Meeting"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Kategori yang sudah terdaftar ({allAvailableCategories.length}):</div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-1">
                  {allAvailableCategories.map((c) => (
                    <span key={c} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 segmented-pill-active hover:opacity-90 font-bold rounded-lg cursor-pointer shadow-md"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI KOSONGKAN DATA OPEX */}
      {isConfirmClearOpexOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#121620] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Kosongkan Seluruh Data OPEX?</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Saat ini terdapat <strong className="text-slate-900 font-mono">{biayaOperasional.length} catatan pengeluaran</strong> dengan total akumulasi senilai <strong className="text-slate-900 font-mono">Rp {biayaOperasional.reduce((acc, b) => acc + b.jumlah, 0).toLocaleString('id-ID')}</strong>.
              </p>
              <p className="text-xs text-slate-400">
                Gunakan fitur ini jika Anda ingin membersihkan data pengeluaran lama atau data ganda sebelum meng-upload ulang file CSV yang baru.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpexOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  clearBiayaOperasional();
                  setIsConfirmClearOpexOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua OPEX</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
