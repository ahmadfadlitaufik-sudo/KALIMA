import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  ClipboardList,
  AlertOctagon,
  FileSpreadsheet,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
  AlertTriangle,
  History,
  CheckCircle2,
  Edit2,
  Sparkles,
  Check,
  TrendingDown,
  TrendingUp,
  MinusCircle,
  Eye,
  FileText,
  Printer,
  RotateCcw,
  CheckCheck,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  Info,
  Truck,
  Boxes,
  Package,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SKUItem, ApparelSize, StockOpnameSession, StockOpnameItem } from '../types';

export const InventoryView: React.FC = () => {
  const {
    skus,
    series,
    stockMovements,
    calculateStockSummary,
    getLowStockSKUs,
    recordRestock,
    recordStockOpname,
    recordBatchStockOpname,
    stockOpnameSessions,
    recordReject,
    currentUser,
    isOwner,
    updateSKU,
    syncAllSkuNames,
    setCurrentView,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'stok_berjalan' | 'barang_masuk' | 'opname' | 'reject' | 'kartu_stok'>('stok_berjalan');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('ALL');
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Quick Edit SKU Modal State
  const [editingSku, setEditingSku] = useState<SKUItem | null>(null);
  const [editSkuCode, setEditSkuCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editSeriesCode, setEditSeriesCode] = useState('');
  const [editColorName, setEditColorName] = useState('');
  const [editSize, setEditSize] = useState<string>('L');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editHpp, setEditHpp] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(10);

  // Restock Form State
  const [restockSumber, setRestockSumber] = useState('Konveksi Kalima PO-0926');
  const [restockCatatan, setRestockCatatan] = useState('');
  const [restockRows, setRestockRows] = useState<{ id: string; sku: string; qty: number }[]>([
    { id: 'restock-row-1', sku: skus[0]?.sku || '', qty: 50 },
  ]);
  const [restockSuccess, setRestockSuccess] = useState(false);

  // ===================== STOK OPNAME STATES =====================
  const [opnameSubTab, setOpnameSubTab] = useState<'batch' | 'single' | 'history'>('batch');
  
  // Single SKU Opname State
  const [singleOpnameSku, setSingleOpnameSku] = useState(skus[0]?.sku || '');
  const [singleOpnamePhysical, setSingleOpnamePhysical] = useState<number>(0);
  const [singleOpnameCatatan, setSingleOpnameCatatan] = useState('Penyesuaian stok opname fisik');
  const [singleOpnameSuccess, setSingleOpnameSuccess] = useState(false);

  // Auto-sync initial SKU selections when skus list becomes populated
  useEffect(() => {
    if (skus.length > 0) {
      if (!singleOpnameSku) setSingleOpnameSku(skus[0].sku);
      if (!rejectSku) setRejectSku(skus[0].sku);
      setRestockRows((prev) =>
        prev.map((r) => (!r.sku ? { ...r, sku: skus[0].sku } : r))
      );
    }
  }, [skus]);

  // Batch Opname State
  const [batchOpnameDate, setBatchOpnameDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchOpnameTitle, setBatchOpnameTitle] = useState('Stok Opname Rutin Akhir Bulan');
  const [batchOpnameSeriesFilter, setBatchOpnameSeriesFilter] = useState<string>('ALL');
  const [batchOpnameGlobalReason, setBatchOpnameGlobalReason] = useState('Audit berkala fisik rak gudang');
  const [batchOpnameSearch, setBatchOpnameSearch] = useState('');
  const [batchOpnameFilterDiffOnly, setBatchOpnameFilterDiffOnly] = useState(false);
  
  // Map of sku -> { physical: number; reason: string }
  const [batchOpnameCounts, setBatchOpnameCounts] = useState<Record<string, { physical: number; reason: string }>>({});
  const [showConfirmBatchModal, setShowConfirmBatchModal] = useState(false);
  const [viewingSessionDetail, setViewingSessionDetail] = useState<StockOpnameSession | null>(null);

  // Reject State
  const [rejectSku, setRejectSku] = useState(skus[0]?.sku || '');
  const [rejectQty, setRejectQty] = useState<number>(1);
  const [rejectReason, setRejectReason] = useState('Sablon cacat / curing miring');
  const [rejectSuccess, setRejectSuccess] = useState(false);

  // Kartu Stok Filter
  const [selectedKartuSku, setSelectedKartuSku] = useState<string>('ALL');

  const stockSummary = calculateStockSummary();
  const lowStockSKUs = getLowStockSKUs();

  // Extract all unique series dynamically
  const allSeriesOptions = useMemo(() => {
    const map = new Map<string, string>();
    series.forEach((s) => map.set(s.code, `${s.name} (${s.code})`));
    skus.forEach((sku) => {
      if (sku.seriesCode && !map.has(sku.seriesCode)) {
        map.set(sku.seriesCode, `Lini/Kategori: ${sku.seriesCode}`);
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [series, skus]);

  // Filtered SKUs for Stok Berjalan table
  const [skuPage, setSkuPage] = useState(1);
  const skuPageSize = 25;

  const filteredSkus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return skus.filter((item) => {
      const matchesSearch =
        !q ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.colorName && item.colorName.toLowerCase().includes(q)) ||
        (item.seriesCode && item.seriesCode.toLowerCase().includes(q)) ||
        (item.size && item.size.toLowerCase().includes(q));
      const matchesSeries =
        selectedSeriesFilter === 'ALL' || item.seriesCode === selectedSeriesFilter;
      return matchesSearch && matchesSeries;
    });
  }, [skus, searchQuery, selectedSeriesFilter]);

  const totalSkuPages = Math.max(1, Math.ceil(filteredSkus.length / skuPageSize));
  const paginatedSkus = useMemo(() => {
    const start = (Math.min(skuPage, totalSkuPages) - 1) * skuPageSize;
    return filteredSkus.slice(start, start + skuPageSize);
  }, [filteredSkus, skuPage, totalSkuPages, skuPageSize]);

  // SKUs in Batch Opname scope
  const batchScopedSkus = useMemo(() => {
    return skus.filter((item) => {
      if (batchOpnameSeriesFilter !== 'ALL' && item.seriesCode !== batchOpnameSeriesFilter) {
        return false;
      }
      return true;
    });
  }, [skus, batchOpnameSeriesFilter]);

  // Displayed SKUs in Batch Opname Table (with search & diff filter)
  const displayedBatchSkus = useMemo(() => {
    const q = batchOpnameSearch.trim().toLowerCase();
    return batchScopedSkus.filter((item) => {
      const matchesSearch =
        !q ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.colorName && item.colorName.toLowerCase().includes(q)) ||
        (item.size && item.size.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (batchOpnameFilterDiffOnly) {
        const sys = stockSummary[item.sku]?.gudang ?? 0;
        const count = batchOpnameCounts[item.sku]?.physical ?? sys;
        return count !== sys;
      }

      return true;
    });
  }, [batchScopedSkus, batchOpnameSearch, batchOpnameFilterDiffOnly, stockSummary, batchOpnameCounts]);

  // Batch Opname Live Summary Metrics
  const batchMetrics = useMemo(() => {
    let totalChecked = 0;
    let matchCount = 0;
    let surplusCount = 0;
    let deficitCount = 0;
    let totalSelisihQty = 0;
    let totalSelisihNominal = 0;

    batchScopedSkus.forEach((sku) => {
      totalChecked += 1;
      const sys = stockSummary[sku.sku]?.gudang ?? 0;
      const phys = batchOpnameCounts[sku.sku]?.physical ?? sys;
      const diff = phys - sys;
      const hpp = sku.hpp || 50000;

      if (diff === 0) {
        matchCount += 1;
      } else if (diff > 0) {
        surplusCount += 1;
      } else {
        deficitCount += 1;
      }

      totalSelisihQty += diff;
      totalSelisihNominal += diff * hpp;
    });

    return {
      totalChecked,
      matchCount,
      surplusCount,
      deficitCount,
      totalSelisihQty,
      totalSelisihNominal,
      hasDiscrepancies: surplusCount > 0 || deficitCount > 0,
    };
  }, [batchScopedSkus, stockSummary, batchOpnameCounts]);

  // Initialize or prefill batch counts to match system
  const handlePreFillMatchSystem = () => {
    const next: Record<string, { physical: number; reason: string }> = {};
    batchScopedSkus.forEach((s) => {
      const sys = stockSummary[s.sku]?.gudang ?? 0;
      next[s.sku] = {
        physical: sys,
        reason: batchOpnameCounts[s.sku]?.reason || 'Sesuai fisik',
      };
    });
    setBatchOpnameCounts((prev) => ({ ...prev, ...next }));
    setSyncToast('Semua input hitungan fisik telah diisi sama dengan stok sistem!');
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Reset batch counts to 0
  const handleResetCountsToZero = () => {
    const next: Record<string, { physical: number; reason: string }> = {};
    batchScopedSkus.forEach((s) => {
      next[s.sku] = {
        physical: 0,
        reason: '',
      };
    });
    setBatchOpnameCounts((prev) => ({ ...prev, ...next }));
  };

  // Update physical count for single item in batch
  const handleSetBatchPhysical = (skuCode: string, value: number) => {
    const clamped = Math.max(0, value);
    setBatchOpnameCounts((prev) => ({
      ...prev,
      [skuCode]: {
        physical: clamped,
        reason: prev[skuCode]?.reason || '',
      },
    }));
  };

  // Update reason for single item in batch
  const handleSetBatchReason = (skuCode: string, reason: string) => {
    setBatchOpnameCounts((prev) => ({
      ...prev,
      [skuCode]: {
        physical: prev[skuCode]?.physical ?? (stockSummary[skuCode]?.gudang ?? 0),
        reason,
      },
    }));
  };

  // Execute Batch Opname Submission
  const handleConfirmExecuteBatch = () => {
    const itemsToSubmit = batchScopedSkus.map((s) => {
      const sys = stockSummary[s.sku]?.gudang ?? 0;
      const countData = batchOpnameCounts[s.sku];
      const physicalQty = countData !== undefined ? countData.physical : sys;
      return {
        sku: s.sku,
        physicalQty,
        alasan: countData?.reason || (physicalQty === sys ? 'Sesuai hitungan fisik' : batchOpnameGlobalReason),
      };
    });

    const res = recordBatchStockOpname({
      judul: batchOpnameTitle.trim() || `Stok Opname ${batchOpnameDate}`,
      kategoriFilter: batchOpnameSeriesFilter === 'ALL' ? 'Semua Lini' : batchOpnameSeriesFilter,
      lokasi: 'Gudang Utama',
      items: itemsToSubmit,
      alasanGlobal: batchOpnameGlobalReason.trim() || 'Audit stok opname berkala',
      tanggal: batchOpnameDate,
    });

    setShowConfirmBatchModal(false);
    if (res.success) {
      setSyncToast(`Sesi ${res.session?.nomorSesi || 'Opname'} berhasil diterapkan dan dicatat ke Audit Log!`);
      setTimeout(() => setSyncToast(null), 4000);
      setOpnameSubTab('history');
    }
  };

  // Handle Sync SKU Names
  const handleSyncNames = () => {
    syncAllSkuNames();
    setSyncToast('Nama produk & lini seluruh SKU berhasil disinkronkan sesuai kode SKU!');
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Open Edit Modal
  const handleOpenEdit = (sku: SKUItem) => {
    setEditingSku(sku);
    setEditSkuCode(sku.sku);
    setEditName(sku.name);
    setEditSeriesCode(sku.seriesCode || '210OV');
    setEditColorName(sku.colorName || '');
    setEditSize(sku.size || 'L');
    setEditPrice(sku.price);
    setEditHpp(sku.hpp);
    setEditMinStock(sku.minStock);
  };

  // Save Edit Modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) return;

    updateSKU(editingSku.sku, {
      sku: editSkuCode.trim() || editingSku.sku,
      name: editName.trim() || editingSku.name,
      seriesCode: editSeriesCode.trim() || editingSku.seriesCode,
      colorName: editColorName.trim() || editingSku.colorName,
      size: (editSize as ApparelSize) || editingSku.size,
      price: editPrice,
      hpp: editHpp > 0 ? editHpp : editingSku.hpp,
      minStock: editMinStock,
    });

    setEditingSku(null);
    setSyncToast(`SKU ${editingSku.sku} berhasil diperbarui!`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Movements for Kartu Stok
  const filteredMovements = useMemo(() => {
    return stockMovements.filter((mov) => {
      if (selectedKartuSku !== 'ALL' && mov.sku !== selectedKartuSku) return false;
      return true;
    });
  }, [stockMovements, selectedKartuSku]);

  // Submit Restock
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = restockRows.filter((r) => r.sku && r.qty > 0);
    if (validRows.length === 0) return;

    recordRestock(validRows, restockSumber, restockCatatan);
    setRestockSuccess(true);
    setTimeout(() => {
      setRestockSuccess(false);
      setActiveTab('stok_berjalan');
    }, 1500);
  };

  // Submit Single Opname
  const handleSingleOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordStockOpname(singleOpnameSku, singleOpnamePhysical, singleOpnameCatatan);
    setSingleOpnameSuccess(true);
    setTimeout(() => {
      setSingleOpnameSuccess(false);
      setOpnameSubTab('history');
    }, 1500);
  };

  // Submit Reject
  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectQty <= 0) return;
    recordReject(rejectSku, rejectQty, rejectReason);
    setRejectSuccess(true);
    setTimeout(() => {
      setRejectSuccess(false);
      setActiveTab('stok_berjalan');
    }, 1500);
  };

  // Overall Inventory Stats for KPI Cards
  const overallInventoryStats = useMemo(() => {
    let totalGudang = 0;
    let totalReseller = 0;
    let totalStock = 0;
    let totalHppValue = 0;

    skus.forEach((s) => {
      const data = stockSummary[s.sku] || { gudang: 0, reseller: 0, total: 0 };
      totalGudang += data.gudang;
      totalReseller += data.reseller;
      totalStock += data.total;
      totalHppValue += data.total * (s.hpp || 50000);
    });

    const outOfStockCount = skus.filter((s) => (stockSummary[s.sku]?.gudang ?? 0) <= 0).length;

    return {
      totalGudang,
      totalReseller,
      totalStock,
      totalHppValue,
      lowStockCount: lowStockSKUs.length,
      outOfStockCount,
    };
  }, [skus, stockSummary, lowStockSKUs]);

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {syncToast && (
        <div className="fixed top-20 right-5 z-50 p-3.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white text-xs rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{syncToast}</span>
        </div>
      )}

      {/* Main Subnav Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'stok_berjalan', label: 'Stok Berjalan', icon: FileSpreadsheet },
          { id: 'barang_masuk', label: '+ Barang Masuk (Restock)', icon: PackagePlus },
          { id: 'opname', label: 'Stok Opname Fisik & Audit', icon: ClipboardList, badge: stockOpnameSessions.length },
          { id: 'reject', label: 'Stok Reject & Cacat', icon: AlertOctagon },
          { id: 'kartu_stok', label: 'Kartu Stok & Audit', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STOK BERJALAN */}
      {/* ========================================================================= */}
      {activeTab === 'stok_berjalan' && (
        <div className="space-y-4">
          {/* Inventory KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Total SKU */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total SKU & Varian
                </span>
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {skus.length} <span className="text-xs font-medium text-slate-400 font-sans">SKU</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>{allSeriesOptions.length} Lini / Seri Produk Aktif</span>
                </div>
              </div>
            </div>

            {/* 2. Stok Gudang Utama */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Stok Siap Jual Gudang
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {overallInventoryStats.totalGudang.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-medium text-slate-400 font-sans">pcs</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                  <span>Est. HPP Aset: Rp {overallInventoryStats.totalHppValue.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* 3. Stok Titip Reseller */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Stok Titip Reseller
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {overallInventoryStats.totalReseller.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-medium text-slate-400 font-sans">pcs</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>Konsinyasi di mitra toko</span>
                </div>
              </div>
            </div>

            {/* 4. SKU Kritis / Menipis */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Perlu Buffer / Restock
                </span>
                <div className={`p-2 rounded-xl border ${
                  overallInventoryStats.lowStockCount > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                    : 'bg-slate-100 text-slate-500 border-slate-200/80'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {overallInventoryStats.lowStockCount}{' '}
                  <span className="text-xs font-medium text-slate-400 font-sans">SKU</span>
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-1 font-medium">
                  {overallInventoryStats.outOfStockCount > 0 ? (
                    <span className="text-rose-600 font-semibold">
                      {overallInventoryStats.outOfStockCount} SKU Habis Total (0 pcs)
                    </span>
                  ) : (
                    <span className="text-slate-500">Stok berada di bawah buffer minimum</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter & Action Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode SKU, nama produk kaos, lini, warna, ukuran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200/80 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSeriesFilter}
                onChange={(e) => setSelectedSeriesFilter(e.target.value)}
                className="bg-slate-50/80 border border-slate-200/80 px-3 py-2 rounded-xl text-xs text-slate-700 hover:border-slate-300 focus:outline-none focus:bg-white cursor-pointer transition-colors"
              >
                <option value="ALL">Semua Lini ({allSeriesOptions.length})</option>
                {allSeriesOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>

              {isOwner && (
                <button
                  type="button"
                  title="Sinkronkan otomatis nama produk dan lini sesuai pola kode SKU"
                  onClick={handleSyncNames}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/90 text-amber-800 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sinkronkan Nama SKU</span>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('opname');
                  setOpnameSubTab('batch');
                }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
                <span>Stok Opname</span>
              </button>

              <button
                onClick={() => setActiveTab('barang_masuk')}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Restock</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Kode SKU</th>
                    <th className="py-3.5 px-3">Lini & Nama Produk</th>
                    <th className="py-3.5 px-3 text-center">Warna & Ukuran</th>
                    <th className="py-3.5 px-3 text-right">Stok Gudang</th>
                    <th className="py-3.5 px-3 text-right">Stok Titip Reseller</th>
                    <th className="py-3.5 px-3 text-right">Total Stok</th>
                    <th className="py-3.5 px-3 text-center">Buffer Min.</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    {isOwner && <th className="py-3.5 px-3 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredSkus.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 9 : 8} className="py-12 text-center text-slate-400">
                        Tidak ada SKU yang cocok dengan filter atau kata kunci &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  ) : (
                    paginatedSkus.map((sku) => {
                      const data = stockSummary[sku.sku] || { gudang: 0, reseller: 0, total: 0, minStock: 10 };
                      const isLow = data.gudang <= sku.minStock;
                      const isOutOfStock = data.gudang <= 0;
                      const serObj = series.find((s) => s.code === sku.seriesCode);
                      const seriesLabel = serObj ? serObj.name : (sku.seriesCode || 'Umum');

                      return (
                        <tr key={sku.sku} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs">
                              {sku.sku}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 line-clamp-1" title={sku.name}>
                              {sku.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="text-slate-600 font-medium">
                                Lini: {seriesLabel} ({sku.seriesCode})
                              </span>
                              <span>·</span>
                              <span>Harga: Rp {sku.price.toLocaleString('id-ID')}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-medium text-slate-700">{sku.colorName || '-'}</span>{' '}
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 font-mono text-[11px]">
                              {sku.size || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {data.gudang} pcs
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500 tabular-nums">
                            {data.reseller} pcs
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                            {data.total} pcs
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-400 tabular-nums">
                            {sku.minStock} pcs
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80">
                                HABIS
                              </span>
                            ) : isLow ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                                MENIPIS
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                Aman
                              </span>
                            )}
                          </td>
                          {isOwner && (
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                title="Edit / Koreksi Detail SKU"
                                onClick={() => handleOpenEdit(sku)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for SKUs */}
            {filteredSkus.length > skuPageSize && (
              <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-600">
                <div>
                  Menampilkan <span className="font-semibold text-slate-900">{(skuPage - 1) * skuPageSize + 1}</span> - <span className="font-semibold text-slate-900">{Math.min(skuPage * skuPageSize, filteredSkus.length)}</span> dari <span className="font-semibold text-slate-900">{filteredSkus.length}</span> SKU
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSkuPage((p) => Math.max(1, p - 1))}
                    disabled={skuPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer text-xs font-medium shadow-xs"
                  >
                    &larr; Sebelumnya
                  </button>
                  <div className="px-2 font-mono text-slate-800 text-xs font-semibold">
                    {skuPage} / {totalSkuPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkuPage((p) => Math.min(totalSkuPages, p + 1))}
                    disabled={skuPage >= totalSkuPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer text-xs font-medium shadow-xs"
                  >
                    Selanjutnya &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BARANG MASUK (RESTOCK) */}
      {/* ========================================================================= */}
      {activeTab === 'barang_masuk' && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Link to Full Vendor PO Procurement Lifecycle */}
          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white border border-blue-200/80 p-4 rounded-3xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100/80 text-blue-700 border border-blue-200/80 rounded-2xl shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Ingin Alur Pengadaan Kaos Lengkap?</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gunakan modul Purchase Order untuk order ke pabrik vendor, tracking resi ekspedisi kargo, hingga checklist penerimaan.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentView('purchases')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              <span>Buka Modul PO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-slate-700" />
                Pencatatan Barang Masuk Cepat (Manual Restock)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Catat kedatangan stok langsung dari penjahit/konveksi ke Gudang Utama Kalima.
              </p>
            </div>

            {restockSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">Barang masuk berhasil dicatat dan stok gudang bertambah.</span>
              </div>
            )}

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sumber / Konveksi / No. PO *
                  </label>
                  <input
                    type="text"
                    required
                    value={restockSumber}
                    onChange={(e) => setRestockSumber(e.target.value)}
                    placeholder="Contoh: Konveksi Bandung PO-0926"
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={restockCatatan}
                    onChange={(e) => setRestockCatatan(e.target.value)}
                    placeholder="Contoh: Batch pertama t-shirt washed grey"
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Item Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Daftar SKU & Jumlah Masuk
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRestockRows((prev) => [
                        ...prev,
                        { id: `restock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, sku: skus[0]?.sku || '', qty: 25 },
                      ])
                    }
                    className="text-xs text-slate-700 hover:text-slate-900 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    + Tambah Baris
                  </button>
                </div>

                {restockRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <select
                      value={row.sku}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRestockRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, sku: val } : r))
                        );
                      }}
                      className="flex-1 bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
                    >
                      {skus.map((s) => (
                        <option key={s.sku} value={s.sku}>
                          {s.sku} — {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={row.qty || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setRestockRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, qty: val } : r))
                        );
                      }}
                      placeholder="Qty"
                      className="w-24 bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold text-center focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                    />

                    {restockRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRestockRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Simpan & Masukkan ke Stok Gudang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MODUL STOK OPNAME LENGKAP (BERKALA, SINGLE, HISTORI AUDIT) */}
      {/* ========================================================================= */}
      {activeTab === 'opname' && (
        <div className="space-y-4">
          {/* Opname Subtab Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setOpnameSubTab('batch')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  opnameSubTab === 'batch'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sesi Opname Berkala (Batch)</span>
              </button>

              <button
                type="button"
                onClick={() => setOpnameSubTab('single')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  opnameSubTab === 'single'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Penyesuaian Cepat (Single SKU)</span>
              </button>

              <button
                type="button"
                onClick={() => setOpnameSubTab('history')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  opnameSubTab === 'history'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histori & Jejak Audit Opname ({stockOpnameSessions.length})</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Setiap penyesuaian otomatis dicatat ke riwayat audit & kartu stok.</span>
            </div>
          </div>

          {/* SUB-VIEW 1: SESI OPNAME BERKALA (BATCH) */}
          {opnameSubTab === 'batch' && (
            <div className="space-y-4">
              {/* Opname Session Setup Header */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-slate-700" />
                      Lembar Kerja Stok Opname Fisik (Audit Berkala)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Input hasil hitung fisik di rak gudang. Sistem otomatis menghitung selisih unit & dampak nilai kerugian/kelebihan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Petugas:</span>
                    <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                      {currentUser.name} ({currentUser.role})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Pelaksanaan Opname *
                    </label>
                    <input
                      type="date"
                      value={batchOpnameDate}
                      onChange={(e) => setBatchOpnameDate(e.target.value)}
                      className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama / Judul Sesi Opname *
                    </label>
                    <input
                      type="text"
                      value={batchOpnameTitle}
                      onChange={(e) => setBatchOpnameTitle(e.target.value)}
                      placeholder="Misal: Opname Rutin Akhir Bulan September"
                      className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Filter Cakupan Lini / Seri Produk
                    </label>
                    <select
                      value={batchOpnameSeriesFilter}
                      onChange={(e) => setBatchOpnameSeriesFilter(e.target.value)}
                      className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
                    >
                      <option value="ALL">Semua Lini ({skus.length} SKU)</option>
                      {allSeriesOptions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan / Berita Acara Global Sesi *
                  </label>
                  <input
                    type="text"
                    value={batchOpnameGlobalReason}
                    onChange={(e) => setBatchOpnameGlobalReason(e.target.value)}
                    placeholder="Contoh: Rekonsiliasi fisik bulanan rak 1-4 gudang Kalima untuk tutup buku"
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              {/* Live Opname KPI Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-[11px] text-slate-500 font-medium">Total SKU Dicek</div>
                  <div className="text-base font-mono font-bold text-slate-900 mt-0.5">
                    {batchMetrics.totalChecked} SKU
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
                  <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cocok / Sesuai</span>
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-900 mt-0.5">
                    {batchMetrics.matchCount} SKU
                  </div>
                </div>

                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80 shadow-xs">
                  <div className="text-[11px] text-blue-700 flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Surplus (Lebih)</span>
                  </div>
                  <div className="text-base font-mono font-bold text-blue-900 mt-0.5">
                    +{batchMetrics.surplusCount} SKU
                  </div>
                </div>

                <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200/80 shadow-xs">
                  <div className="text-[11px] text-rose-700 flex items-center gap-1 font-medium">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Minus (Kurang)</span>
                  </div>
                  <div className="text-base font-mono font-bold text-rose-900 mt-0.5">
                    {batchMetrics.deficitCount} SKU
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-500 font-medium">Dampak Nilai (HPP)</div>
                  <div
                    className={`text-sm font-mono font-bold mt-0.5 ${
                      batchMetrics.totalSelisihNominal === 0
                        ? 'text-slate-600'
                        : batchMetrics.totalSelisihNominal > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {batchMetrics.totalSelisihNominal >= 0 ? '+' : ''}
                    Rp {batchMetrics.totalSelisihNominal.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Table Toolbar Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari SKU atau nama kaos pada lembar opname..."
                    value={batchOpnameSearch}
                    onChange={(e) => setBatchOpnameSearch(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200/80 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchOpnameFilterDiffOnly(!batchOpnameFilterDiffOnly)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      batchOpnameFilterDiffOnly
                        ? 'bg-amber-100/80 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Hanya Selisih ({batchMetrics.surplusCount + batchMetrics.deficitCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePreFillMatchSystem}
                    title="Isi otomatis semua hitungan fisik sama dengan stok sistem"
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Isi Sesuai Sistem</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetCountsToZero}
                    title="Kosongkan hitungan fisik menjadi 0"
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-rose-600 px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset 0</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfirmBatchModal(true)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-1.5 rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Terapkan Penyesuaian</span>
                  </button>
                </div>
              </div>

              {/* Batch Entry Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Kode SKU</th>
                        <th className="py-3 px-3">Produk & Varian</th>
                        <th className="py-3 px-3 text-right">HPP Satuan</th>
                        <th className="py-3 px-3 text-right">Stok Sistem</th>
                        <th className="py-3 px-3 text-center min-w-[150px]">Hitung Fisik (Pcs)</th>
                        <th className="py-3 px-3 text-center">Selisih</th>
                        <th className="py-3 px-3 text-right">Dampak Rp</th>
                        <th className="py-3 px-4 min-w-[200px]">Alasan Penyesuaian SKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {displayedBatchSkus.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            Tidak ada SKU yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        displayedBatchSkus.map((sku) => {
                          const sys = stockSummary[sku.sku]?.gudang ?? 0;
                          const currentCountData = batchOpnameCounts[sku.sku];
                          const phys = currentCountData !== undefined ? currentCountData.physical : sys;
                          const diff = phys - sys;
                          const hpp = sku.hpp || 50000;
                          const diffNominal = diff * hpp;

                          return (
                            <tr
                              key={sku.sku}
                              className={`transition-colors ${
                                diff !== 0
                                  ? diff > 0
                                    ? 'bg-blue-50/50 hover:bg-blue-50/80'
                                    : 'bg-rose-50/50 hover:bg-rose-50/80'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/80 text-xs">
                                  {sku.sku}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900 line-clamp-1">
                                  {sku.name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{sku.colorName || '-'}</span>
                                  <span>·</span>
                                  <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 font-mono text-[10px]">
                                    {sku.size || '-'}
                                  </span>
                                  <span>·</span>
                                  <span>Lini {sku.seriesCode}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                                Rp {hpp.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                {sys} pcs
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSetBatchPhysical(sku.sku, phys - 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-mono text-xs cursor-pointer transition-colors"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={phys}
                                    onChange={(e) =>
                                      handleSetBatchPhysical(sku.sku, Number(e.target.value) || 0)
                                    }
                                    className="w-16 bg-white border border-slate-200 rounded-lg py-1 px-1.5 text-center text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSetBatchPhysical(sku.sku, phys + 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-mono text-xs cursor-pointer transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {diff === 0 ? (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                                    0 (Cocok)
                                  </span>
                                ) : diff > 0 ? (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                                    +{diff} Surplus
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
                                    {diff} Minus
                                  </span>
                                )}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                                  diff === 0
                                    ? 'text-slate-400'
                                    : diff > 0
                                    ? 'text-blue-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {diff >= 0 ? '+' : ''}
                                {diffNominal.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2.5 px-4">
                                <input
                                  type="text"
                                  placeholder={diff === 0 ? 'Sesuai hitungan fisik' : 'Contoh: Noda kemasan, salah packing'}
                                  value={currentCountData?.reason || ''}
                                  onChange={(e) => handleSetBatchReason(sku.sku, e.target.value)}
                                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Action bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-600">
                  Total {batchMetrics.totalChecked} SKU terdata.{' '}
                  {batchMetrics.surplusCount + batchMetrics.deficitCount > 0 ? (
                    <span>
                      Terdapat{' '}
                      <span className="font-bold text-slate-900">
                        {batchMetrics.surplusCount + batchMetrics.deficitCount} SKU
                      </span>{' '}
                      yang memiliki selisih fisik.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">Seluruh hitungan fisik cocok dengan stok sistem.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmBatchModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Simpan & Terapkan Hasil Stok Opname ke Audit Log</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: PENYESUAIAN CEPAT (SINGLE SKU) */}
          {opnameSubTab === 'single' && (
            <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-slate-700" />
                  Penyesuaian Cepat (Single SKU Opname)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Koreksi cepat untuk 1 SKU tertentu yang baru selesai dihitung ulang di gudang.
                </p>
              </div>

              {singleOpnameSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Penyesuaian stok berhasil disimpan dan dicatat ke Audit Trail!</span>
                </div>
              )}

              <form onSubmit={handleSingleOpnameSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih SKU Kaos / Produk *
                  </label>
                  <select
                    value={singleOpnameSku}
                    onChange={(e) => setSingleOpnameSku(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
                  >
                    {skus.map((s) => {
                      const stockGudang = stockSummary[s.sku]?.gudang || 0;
                      return (
                        <option key={s.sku} value={s.sku}>
                          {s.sku} — {s.name} (Stok Sistem: {stockGudang} pcs)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Comparison Box */}
                {(() => {
                  const currentGudang = stockSummary[singleOpnameSku]?.gudang || 0;
                  const selisih = singleOpnamePhysical - currentGudang;
                  const targetSkuObj = skus.find((s) => s.sku === singleOpnameSku);
                  const hpp = targetSkuObj?.hpp || 50000;
                  const dampakRp = selisih * hpp;

                  return (
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-center text-xs">
                      <div>
                        <div className="text-slate-500 font-medium">Stok Sistem</div>
                        <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                          {currentGudang} pcs
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Hitung Fisik</div>
                        <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                          {singleOpnamePhysical} pcs
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Selisih Penyesuaian</div>
                        <div
                          className={`text-sm font-bold font-mono mt-0.5 ${
                            selisih === 0
                              ? 'text-emerald-700'
                              : selisih > 0
                              ? 'text-blue-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {selisih > 0 ? `+${selisih}` : selisih} pcs
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Dampak: Rp {dampakRp.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Input Jumlah Fisik Sebenarnya (Pcs) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={singleOpnamePhysical || ''}
                    onChange={(e) => setSingleOpnamePhysical(Number(e.target.value) || 0)}
                    placeholder="Jumlah riil fisik di rak gudang"
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan / Keterangan Penyesuaian *
                  </label>
                  <input
                    type="text"
                    required
                    value={singleOpnameCatatan}
                    onChange={(e) => setSingleOpnameCatatan(e.target.value)}
                    placeholder="Misal: Selisih hitung kiriman konveksi batch PO-0926"
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Simpan Penyesuaian SKU & Catat ke Audit
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 3: HISTORI & JEJAK AUDIT OPNAME */}
          {opnameSubTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-700" />
                    Histori Sesi & Berita Acara Stok Opname
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Arsip seluruh sesi penyesuaian stok opname fisik beserta alasan dan rincian per-item.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpnameSubTab('batch')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Buat Sesi Opname Baru</span>
                </button>
              </div>

              {stockOpnameSessions.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 text-slate-400 text-xs shadow-sm">
                  Belum ada riwayat sesi stok opname yang tersimpan.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {stockOpnameSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 hover:border-slate-300 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80 text-xs">
                            {sess.nomorSesi}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{sess.judul}</h4>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono">{sess.tanggal}</span>
                          <span>·</span>
                          <span className="text-slate-700 font-medium">Oleh: {sess.petugas}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                        <div>
                          <div className="text-slate-500 text-[11px]">Item Diperiksa</div>
                          <div className="font-mono font-bold text-slate-900 mt-0.5">
                            {sess.totalItemChecked} SKU
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500 text-[11px]">Status Selisih</div>
                          <div className="font-mono text-slate-700 mt-0.5">
                            <span className="text-emerald-700 font-medium">{sess.totalMatch} Cocok</span>
                            {' · '}
                            <span className="text-blue-700 font-medium">+{sess.totalSurplus}</span>
                            {' · '}
                            <span className="text-rose-700 font-medium">-{sess.totalDeficit}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500 text-[11px]">Net Selisih Unit</div>
                          <div
                            className={`font-mono font-bold mt-0.5 ${
                              sess.netSelisihQty === 0
                                ? 'text-emerald-700'
                                : sess.netSelisihQty > 0
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {sess.netSelisihQty >= 0 ? `+${sess.netSelisihQty}` : sess.netSelisihQty} pcs
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500 text-[11px]">Dampak Nominal (HPP)</div>
                          <div
                            className={`font-mono font-bold mt-0.5 ${
                              sess.netSelisihNominal === 0
                                ? 'text-slate-600'
                                : sess.netSelisihNominal > 0
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {sess.netSelisihNominal >= 0 ? '+' : ''}
                            Rp {sess.netSelisihNominal.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-slate-500 italic line-clamp-1">
                          &quot;{sess.alasanGlobal}&quot;
                        </p>

                        <button
                          type="button"
                          onClick={() => setViewingSessionDetail(sess)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition-colors shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Lihat Rincian Item ({sess.items.length})</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REJECT & CACAT */}
      {/* ========================================================================= */}
      {activeTab === 'reject' && (
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
              Pencatatan Barang Reject / Rusak
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Keluarkan barang cacat produksi atau kotor dari stok siap jual untuk menjaga kualitas Kalima.
            </p>
          </div>

          {rejectSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">Barang reject berhasil dicatat dan dipotong dari stok siap jual.</span>
            </div>
          )}

          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih SKU Reject *
              </label>
              <select
                value={rejectSku}
                onChange={(e) => setRejectSku(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
              >
                {skus.map((s) => (
                  <option key={s.sku} value={s.sku}>
                    {s.sku} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jumlah Reject (Pcs) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={rejectQty || ''}
                onChange={(e) => setRejectQty(Number(e.target.value) || 1)}
                className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Kerusakan / Cacat *
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
              >
                <option value="Sablon cacat / curing miring">Sablon cacat / curing miring</option>
                <option value="Kain bolong / serat benang putus">Kain bolong / serat benang putus</option>
                <option value="Jahitan lepas / kerut leher tidak rata">Jahitan lepas / kerut leher tidak rata</option>
                <option value="Noda oli / kotor permanen konveksi">Noda oli / kotor permanen konveksi</option>
                <option value="Ukuran pola melenceng (QC Fail)">Ukuran pola melenceng (QC Fail)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                Keluarkan dari Stok Siap Jual
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: KARTU STOK & AUDIT PERGERAKAN */}
      {/* ========================================================================= */}
      {activeTab === 'kartu_stok' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Kartu Stok & Riwayat Pergerakan
              </h3>
              <p className="text-xs text-slate-500">
                Log mutasi stok per SKU: Masuk, Jual, Retur, Reject, Opname, dan Titipan
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Filter SKU:</span>
              <select
                value={selectedKartuSku}
                onChange={(e) => setSelectedKartuSku(e.target.value)}
                className="bg-slate-50/80 border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
              >
                <option value="ALL">Semua SKU ({skus.length})</option>
                {skus.map((s) => (
                  <option key={s.sku} value={s.sku}>
                    {s.sku}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-3">Kode SKU</th>
                    <th className="py-3 px-3">Tipe Mutasi</th>
                    <th className="py-3 px-3">Lokasi</th>
                    <th className="py-3 px-3 text-right">Qty Mutasi</th>
                    <th className="py-3 px-3">Referensi Dokumen</th>
                    <th className="py-3 px-3">Catatan</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredMovements.slice(0, 50).map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {mov.tanggal}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/80 text-xs">
                          {mov.sku}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                            mov.tipe === 'opname'
                              ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                              : mov.qty > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                              : 'bg-rose-50 text-rose-700 border-rose-200/80'
                          }`}
                        >
                          {mov.tipe}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{mov.lokasi}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                          mov.qty > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {mov.qty > 0 ? `+${mov.qty}` : mov.qty} pcs
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {mov.referensi}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[220px]">
                        {mov.catatan || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {mov.recordedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI PENERAPAN BATCH OPNAME */}
      {/* ========================================================================= */}
      {showConfirmBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xl text-xs text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-700" />
              Konfirmasi Penerapan Sesi Stok Opname
            </h3>

            <p className="text-slate-600">
              Apakah Anda yakin ingin menerapkan penyesuaian fisik untuk sesi:{' '}
              <span className="font-bold text-slate-900">&quot;{batchOpnameTitle}&quot;</span>?
            </p>

            <div className="grid grid-cols-2 gap-2.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-slate-500 text-[11px] font-medium">Total Item SKU:</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{batchMetrics.totalChecked} SKU</p>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] font-medium">SKU Berselisih:</span>
                <p className="font-mono font-bold text-amber-700 mt-0.5">
                  {batchMetrics.surplusCount + batchMetrics.deficitCount} SKU
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] font-medium">Net Perubahan Unit:</span>
                <p
                  className={`font-mono font-bold mt-0.5 ${
                    batchMetrics.totalSelisihQty >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {batchMetrics.totalSelisihQty >= 0 ? '+' : ''}
                  {batchMetrics.totalSelisihQty} pcs
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] font-medium">Net Dampak Nilai (HPP):</span>
                <p
                  className={`font-mono font-bold mt-0.5 ${
                    batchMetrics.totalSelisihNominal >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {batchMetrics.totalSelisihNominal >= 0 ? '+' : ''}
                  Rp {batchMetrics.totalSelisihNominal.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-2xl text-[11px] text-amber-900">
              Penyesuaian stok akan langsung mengubah saldo stok Gudang Utama, mencatat kartu stok, dan menambahkan entri permanen di Jejak Audit (Audit Trail).
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmBatchModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmExecuteBatch}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                Ya, Terapkan & Simpan ke Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAIL SESI STOK OPNAME HISTORI */}
      {/* ========================================================================= */}
      {viewingSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-slate-200/90 rounded-3xl shadow-2xl text-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80 text-xs">
                    {viewingSessionDetail.nomorSesi}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{viewingSessionDetail.judul}</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tanggal: {viewingSessionDetail.tanggal} · Petugas: {viewingSessionDetail.petugas} ({viewingSessionDetail.userRole})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingSessionDetail(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                <span className="text-slate-500 font-semibold">Alasan / Catatan Berita Acara:</span>
                <p className="text-slate-800 mt-0.5 italic">&quot;{viewingSessionDetail.alasanGlobal}&quot;</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Kode SKU & Nama</th>
                      <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                      <th className="py-2.5 px-3 text-right">Hitung Fisik</th>
                      <th className="py-2.5 px-3 text-center">Selisih Unit</th>
                      <th className="py-2.5 px-3 text-right">Dampak Nominal</th>
                      <th className="py-2.5 px-3">Alasan Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {viewingSessionDetail.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-mono font-bold text-slate-900">{it.sku}</div>
                          <div className="text-[11px] text-slate-600 line-clamp-1">{it.namaProduk}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {it.systemQty} pcs
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {it.physicalQty} pcs
                        </td>
                        <td className="py-2 px-3 text-center">
                          {it.selisihQty === 0 ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                              0 (Cocok)
                            </span>
                          ) : it.selisihQty > 0 ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                              +{it.selisihQty}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
                              {it.selisihQty}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            it.selisihNominal === 0
                              ? 'text-slate-400'
                              : it.selisihNominal > 0
                              ? 'text-blue-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {it.selisihNominal >= 0 ? '+' : ''}
                          Rp {it.selisihNominal.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {it.alasan || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setViewingSessionDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK EDIT SKU MODAL */}
      {/* ========================================================================= */}
      {editingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xl text-xs text-slate-800">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-slate-700" />
              Koreksi Detail SKU:{' '}
              <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/80">
                {editingSku.sku}
              </span>
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kode SKU</label>
                <input
                  type="text"
                  required
                  value={editSkuCode}
                  onChange={(e) => setEditSkuCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 font-mono uppercase focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Produk / Kaos Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Lini / Seri Produk</label>
                  <select
                    value={editSeriesCode}
                    onChange={(e) => setEditSeriesCode(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer transition-colors"
                  >
                    {series.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                    <option value="ACC">Aksesoris / Merchandise</option>
                    <option value="BAG">Tas / Goodie Bag</option>
                    <option value="CUSTOM">Custom / Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Warna / Varian</label>
                  <input
                    type="text"
                    value={editColorName}
                    onChange={(e) => setEditColorName(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Ukuran / Size</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 uppercase font-mono font-bold focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min. Buffer</label>
                  <input
                    type="number"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSku(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
