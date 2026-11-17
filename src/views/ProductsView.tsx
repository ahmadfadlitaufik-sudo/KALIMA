import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  Sliders,
  DollarSign,
  Package,
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Percent,
  TrendingUp,
  Warehouse,
  Palette,
  Ruler,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SKUItem, ApparelSize, ProductSeries, ApparelFit } from '../types';
import { INITIAL_COLORS } from '../data/initialData';

export const ProductsView: React.FC = () => {
  const {
    series,
    skus,
    bomItems,
    isOwner,
    updateSeries,
    updateSKU,
    addSKU,
    deleteSKU,
    updateBOM,
    calculateStock,
    syncAllSkuNames,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'katalog_seri' | 'semua_sku' | 'bom_aksesoris'>('semua_sku');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Edit Series (Owner Only)
  const [editingSeries, setEditingSeries] = useState<ProductSeries | null>(null);
  const [editSeriesName, setEditSeriesName] = useState('');
  const [editSeriesGsm, setEditSeriesGsm] = useState<number>(210);
  const [editSeriesFit, setEditSeriesFit] = useState<ApparelFit>('Oversize');
  const [editSeriesBaseCost, setEditSeriesBaseCost] = useState<number>(0);
  const [editSeriesPrice, setEditSeriesPrice] = useState<number>(0);
  const [editSeriesDesc, setEditSeriesDesc] = useState('');

  // Modal Add SKU
  const [isAddSkuOpen, setIsAddSkuOpen] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [newSeriesCode, setNewSeriesCode] = useState('210OV');
  const [newColorCode, setNewColorCode] = useState('HT');
  const [newColorName, setNewColorName] = useState('Hitam');
  const [newSize, setNewSize] = useState<string>('XL');
  const [newPrice, setNewPrice] = useState<number>(129000);
  const [newHppCustom, setNewHppCustom] = useState<number>(0);
  const [newMinStock, setNewMinStock] = useState<number>(10);

  // Edit SKU Modal
  const [editingSku, setEditingSku] = useState<SKUItem | null>(null);
  const [editSkuCode, setEditSkuCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editColorName, setEditColorName] = useState('');
  const [editSize, setEditSize] = useState<string>('L');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editHpp, setEditHpp] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(0);
  const [skuToDelete, setSkuToDelete] = useState<SKUItem | null>(null);

  // BOM Edit State (Owner Only)
  const [tempBom, setTempBom] = useState(bomItems);
  const [bomSuccess, setBomSuccess] = useState(false);

  const totalAksesoris = useMemo(() => {
    return bomItems.reduce((acc, it) => acc + it.biayaPerUnit, 0);
  }, [bomItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered SKUs for Matriks SKU table
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
        selectedSeries === 'ALL' || item.seriesCode === selectedSeries;

      const matchesSize =
        selectedSizeFilter === 'ALL' || item.size === selectedSizeFilter;

      return matchesSearch && matchesSeries && matchesSize;
    });
  }, [skus, searchQuery, selectedSeries, selectedSizeFilter]);

  // Overall SKU matrix stats
  const skuStats = useMemo(() => {
    let totalStockGudang = 0;
    let totalStockReseller = 0;
    let totalValuasiHpp = 0;
    let totalMarginSum = 0;

    filteredSkus.forEach((s) => {
      const stockG = calculateStock(s.sku, 'Gudang Utama');
      const stockR = calculateStock(s.sku) - stockG;
      totalStockGudang += stockG;
      totalStockReseller += Math.max(0, stockR);
      totalValuasiHpp += Math.max(0, stockG + stockR) * (s.hpp || 0);
      const margin = s.price - s.hpp;
      const pct = s.price > 0 ? (margin / s.price) * 100 : 0;
      totalMarginSum += pct;
    });

    const avgMargin = filteredSkus.length > 0 ? (totalMarginSum / filteredSkus.length).toFixed(1) : '0';

    return {
      totalSkus: filteredSkus.length,
      totalStockGudang,
      totalStockReseller,
      totalStockAll: totalStockGudang + totalStockReseller,
      totalValuasiHpp: Math.round(totalValuasiHpp),
      avgMargin,
    };
  }, [filteredSkus, calculateStock]);

  // Open Edit Series Modal
  const handleOpenEditSeries = (ser: ProductSeries) => {
    setEditingSeries(ser);
    setEditSeriesName(ser.name);
    setEditSeriesGsm(ser.gsm);
    setEditSeriesFit(ser.fit);
    setEditSeriesBaseCost(ser.baseCost);
    setEditSeriesPrice(ser.defaultPrice);
    setEditSeriesDesc(ser.description);
  };

  // Save Edit Series
  const handleSaveEditSeries = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries) return;

    updateSeries(editingSeries.id, {
      name: editSeriesName.trim() || editingSeries.name,
      gsm: editSeriesGsm || editingSeries.gsm,
      fit: editSeriesFit || editingSeries.fit,
      baseCost: editSeriesBaseCost,
      defaultPrice: editSeriesPrice,
      description: editSeriesDesc.trim() || editingSeries.description,
    });

    setEditingSeries(null);
    showToast(`Parameter lini produk "${editSeriesName}" berhasil diperbarui!`);
  };

  // Open Edit SKU Modal
  const handleOpenEditSku = (sku: SKUItem) => {
    setEditingSku(sku);
    setEditSkuCode(sku.sku);
    setEditName(sku.name);
    setEditColorName(sku.colorName || '');
    setEditSize(sku.size || 'L');
    setEditPrice(sku.price);
    setEditHpp(sku.hpp);
    setEditMinStock(sku.minStock);
  };

  const handleSaveAddSku = (e: React.FormEvent) => {
    e.preventDefault();
    const serObj = series.find((s) => s.code === newSeriesCode);
    const generatedSku = newSkuCode.trim() || `KL-${newSeriesCode}-${newColorCode || 'STD'}-${newSize}`;
    const baseCost = serObj?.baseCost || 45000;
    const defaultHpp = baseCost + totalAksesoris;
    const finalHpp = newHppCustom > 0 ? newHppCustom : defaultHpp;
    const finalName = newCustomName.trim() || `Kalima ${serObj?.name || newSeriesCode} - ${newColorName || 'Standard'} (${newSize})`;

    const item: SKUItem = {
      sku: generatedSku,
      seriesId: serObj?.id || 'ser-custom',
      seriesCode: newSeriesCode,
      colorCode: newColorCode || 'STD',
      colorName: newColorName || 'Standard',
      size: newSize as ApparelSize,
      name: finalName,
      price: newPrice,
      hpp: finalHpp,
      minStock: newMinStock,
      active: true,
    };

    addSKU(item);
    setIsAddSkuOpen(false);
    setNewSkuCode('');
    setNewCustomName('');
    setNewHppCustom(0);
    showToast(`SKU baru ${item.sku} berhasil ditambahkan!`);
  };

  const handleSaveEditSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) return;
    updateSKU(editingSku.sku, {
      sku: editSkuCode.trim() || editingSku.sku,
      name: editName.trim() || editingSku.name,
      colorName: editColorName.trim() || editingSku.colorName,
      size: (editSize as ApparelSize) || editingSku.size,
      price: editPrice,
      hpp: editHpp > 0 ? editHpp : editingSku.hpp,
      minStock: editMinStock,
    });
    setEditingSku(null);
    showToast(`SKU ${editingSku.sku} berhasil diperbarui!`);
  };

  const handleDeleteSku = (skuCode: string) => {
    deleteSKU(skuCode);
    setSkuToDelete(null);
    setEditingSku(null);
    showToast(`SKU ${skuCode} berhasil dihapus.`);
  };

  const handleSaveBom = (e: React.FormEvent) => {
    e.preventDefault();
    updateBOM(tempBom);
    setBomSuccess(true);
    showToast('Tabel BOM aksesoris berhasil disimpan dan seluruh HPP SKU otomatis diperbarui!');
    setTimeout(() => setBomSuccess(false), 2000);
  };

  const handleSyncNames = () => {
    syncAllSkuNames();
    showToast('Seluruh format nama SKU berhasil disinkronkan sesuai standar Kalima!');
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 p-3.5 bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Subnav Tabs */}
      <div className="segmented-pill-bar flex items-center gap-1 overflow-x-auto bg-white">
        <button
          onClick={() => setActiveTab('katalog_seri')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'katalog_seri'
              ? 'segmented-pill-active'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>3 Lini Produk Utama Kalima</span>
        </button>

        <button
          onClick={() => setActiveTab('semua_sku')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'semua_sku'
              ? 'segmented-pill-active'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Matriks & Katalog SKU ({skus.length} SKU)</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('bom_aksesoris')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'bom_aksesoris'
                ? 'segmented-pill-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Tabel BOM & Komponen HPP</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 3 LINI PRODUK UTAMA KALIMA */}
      {/* ========================================================================= */}
      {activeTab === 'katalog_seri' && (
        <div className="space-y-4">
          {/* Intro Banner */}
          <div className="bg-[#121620] p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Arsitektur 3 Lini Produk Kalima Apparel
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Struktur gramasi kain, varian warna, estimasi modal (HPP = Kaos Polos + BOM Rp {totalAksesoris.toLocaleString('id-ID')}), dan margin keuntungan per lini.
              </p>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={handleSyncNames}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sinkronkan Penamaan SKU</span>
              </button>
            )}
          </div>

          {/* 3 Series Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {series.map((ser) => {
              const seriesSkus = skus.filter((s) => s.seriesCode === ser.code);
              const totalStockGudang = seriesSkus.reduce(
                (acc, s) => acc + calculateStock(s.sku, 'Gudang Utama'),
                0
              );
              const totalStockAll = seriesSkus.reduce(
                (acc, s) => acc + calculateStock(s.sku),
                0
              );
              const totalStockReseller = Math.max(0, totalStockAll - totalStockGudang);

              const colorPalette = INITIAL_COLORS[ser.code] || [];
              const hppStandar = ser.baseCost + totalAksesoris;
              const marginRp = ser.defaultPrice - hppStandar;
              const marginPct = ser.defaultPrice > 0 ? ((marginRp / ser.defaultPrice) * 100).toFixed(1) : '0';
              const totalValuasiAset = Math.round(totalStockAll * hppStandar);

              return (
                <div
                  key={ser.id}
                  className="bg-[#121620] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl flex flex-col hover:border-slate-700 transition-all group"
                >
                  {/* Photo & Badges */}
                  <div className="relative h-52 bg-slate-950 overflow-hidden">
                    {ser.image ? (
                      <img
                        src={ser.image}
                        alt={ser.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 font-medium">
                        Foto Produk Kalima {ser.code}
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-amber-300 border border-amber-500/40 shadow-md">
                        KL-{ser.code}
                      </span>
                      <span className="bg-amber-500/90 text-slate-950 px-2 py-0.5 rounded-lg text-xs font-bold shadow-md">
                        {ser.gsm} GSM
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700">
                      {ser.fit} Fit
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-200 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80">
                      <span className="font-semibold text-white">
                        {colorPalette.length} Warna Pilihan
                      </span>
                      <span className="font-mono text-amber-300 font-bold">
                        {seriesSkus.length} SKU Terdaftar
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {ser.name}
                        </h3>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditSeries(ser)}
                            title="Edit Parameter Lini Produk" aria-label="Edit Parameter Lini Produk"
                            className="p-1 rounded-lg bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-400 transition-colors cursor-pointer shrink-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                        {ser.description}
                      </p>
                    </div>

                    {/* Varian Warna (Color Swatches) */}
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        <span>Katalog Varian Warna ({colorPalette.length}):</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {colorPalette.map((col) => (
                          <div
                            key={col.code}
                            className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300"
                            title={`${col.name} (${col.code})`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-700 shadow-sm shrink-0"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span className="font-medium">{col.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial & Margin Breakdown */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Harga Jual Rekomendasi:</span>
                        <span className="font-mono font-bold text-white text-sm">
                          Rp {ser.defaultPrice.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {isOwner ? (
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>1. Kaos Polos Konveksi:</span>
                            <span className="font-mono text-slate-200">
                              Rp {ser.baseCost.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400">
                            <span>2. BOM Aksesoris & Packing:</span>
                            <span className="font-mono text-slate-200">
                              +Rp {totalAksesoris.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-850 font-semibold text-amber-300">
                            <span>HPP Modal Total / Pcs:</span>
                            <span className="font-mono font-bold">
                              Rp {hppStandar.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-850 font-bold text-emerald-400">
                            <span>Margin Kotor Satuan:</span>
                            <span className="font-mono">
                              Rp {marginRp.toLocaleString('id-ID')} ({marginPct}%)
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-950 p-2 rounded-xl">
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>HPP Modal & Margin disembunyikan (Akses Admin)</span>
                        </div>
                      )}

                      {/* Stock Summary */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Stok Gudang Utama:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {totalStockGudang} pcs
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Stok Titipan Reseller:</span>
                          <span className="font-mono text-slate-400">
                            {totalStockReseller} pcs
                          </span>
                        </div>
                        {isOwner && (
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-850">
                            <span>Valuasi Aset Stok:</span>
                            <span className="font-mono font-bold text-amber-300">
                              Rp {totalValuasiAset.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeries(ser.code);
                          setActiveTab('semua_sku');
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 text-amber-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Lihat Matriks SKU Seri {ser.code}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MATRIKS & KATALOG SEMUA SKU */}
      {/* ========================================================================= */}
      {activeTab === 'semua_sku' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121620] p-3 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Total SKU Aktif</span>
              <p className="text-sm font-mono font-bold text-white mt-0.5">
                {skuStats.totalSkus} SKU
              </p>
            </div>
            <div className="bg-[#121620] p-3 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Total Stok Fisik Gudang</span>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                {skuStats.totalStockGudang} pcs
              </p>
            </div>
            <div className="bg-[#121620] p-3 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">Rata-rata Margin Kotor</span>
              <p className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                {skuStats.avgMargin}%
              </p>
            </div>
            <div className="bg-[#121620] p-3 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400" title="Stok gudang + reseller × HPP; SKU stok minus tidak dihitung">Nilai HPP Stok (gudang + reseller)</span>
              <p className="text-sm font-mono font-bold text-white mt-0.5">
                Rp {skuStats.totalValuasiHpp.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* Search, Filters & Create Button */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#121620] p-4 rounded-2xl border border-slate-800/80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Cari Kode SKU (KL-210OV-HT-XL), warna, ukuran, lini..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Seri ({series.length})</option>
                {series.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedSizeFilter}
                onChange={(e) => setSelectedSizeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Ukuran</option>
                <option value="S">Size S</option>
                <option value="M">Size M</option>
                <option value="L">Size L</option>
                <option value="XL">Size XL</option>
                <option value="2XL">Size 2XL</option>
              </select>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsAddSkuOpen(true)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Buat SKU Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* SKU Table */}
          <div className="bg-[#121620] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Format Kode SKU</th>
                    <th className="py-3 px-3">Lini & Nama Produk</th>
                    <th className="py-3 px-3 text-center">Warna & Ukuran</th>
                    <th className="py-3 px-3 text-right">Harga Jual</th>
                    {isOwner && <th className="py-3 px-3 text-right">HPP Modal</th>}
                    {isOwner && <th className="py-3 px-3 text-right">Margin Kotor</th>}
                    <th className="py-3 px-3 text-right">Stok Gudang</th>
                    <th className="py-3 px-3 text-center">Buffer Min.</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    {isOwner && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredSkus.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 10 : 8} className="py-8 text-center text-slate-500">
                        Tidak ada SKU yang cocok dengan filter atau kata kunci &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredSkus.map((sku) => {
                      const stockGudang = calculateStock(sku.sku, 'Gudang Utama');
                      const stockReseller = calculateStock(sku.sku) - stockGudang;
                      const margin = sku.price - sku.hpp;
                      const marginPct = sku.price > 0 ? ((margin / sku.price) * 100).toFixed(0) : '0';

                      const isOutOfStock = stockGudang <= 0;
                      const isLowStock = stockGudang <= sku.minStock;

                      // Color swatch lookup
                      const seriesColors = INITIAL_COLORS[sku.seriesCode] || [];
                      const matchedCol = seriesColors.find(
                        (c) => c.code === sku.colorCode || c.name.toLowerCase() === sku.colorName.toLowerCase()
                      );

                      return (
                        <tr key={sku.sku} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            <span className="bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                              {sku.sku}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-100 line-clamp-1" title={sku.name}>
                              {sku.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="text-amber-300 font-medium">
                                Lini: {sku.seriesCode}
                              </span>
                              <span>·</span>
                              <span>Titipan: {Math.max(0, stockReseller)} pcs</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {matchedCol && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-700 shrink-0"
                                  style={{ backgroundColor: matchedCol.hex }}
                                  title={sku.colorName}
                                />
                              )}
                              <span className="text-slate-300 font-medium">{sku.colorName || '-'}</span>
                              <span className="font-bold text-amber-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 font-mono text-xs">
                                {sku.size || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white tabular-nums">
                            Rp {sku.price.toLocaleString('id-ID')}
                          </td>
                          {isOwner && (
                            <td className="py-3 px-3 text-right font-mono text-slate-300 tabular-nums">
                              Rp {sku.hpp.toLocaleString('id-ID')}
                            </td>
                          )}
                          {isOwner && (
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span className="text-emerald-400 font-semibold">
                                Rp {margin.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1">
                                ({marginPct}%)
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-3 text-right font-mono font-bold text-white tabular-nums">
                            {stockGudang} pcs
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-500 tabular-nums">
                            {sku.minStock} pcs
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {isOutOfStock ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                                HABIS
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                MENIPIS
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-400">
                                Aman
                              </span>
                            )}
                          </td>
                          {isOwner && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSku(sku)}
                                  title="Edit SKU" aria-label="Edit SKU"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSkuToDelete(sku)}
                                  title="Hapus SKU" aria-label="Hapus SKU"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BOM AKSESORIS & STRUKTUR BIAYA FINISHING */}
      {/* ========================================================================= */}
      {activeTab === 'bom_aksesoris' && isOwner && (
        <div className="bg-[#121620] p-5 sm:p-6 rounded-2xl border border-slate-800/80 max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                Standar Bill of Materials (BOM) Aksesoris
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Biaya pelengkap per lembar kaos (label, hangtag, ziplock packaging, sablon dada, dll).
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Aksesoris:</span>
              <div className="text-base font-mono font-bold text-amber-400">
                Rp {totalAksesoris.toLocaleString('id-ID')} / pcs
              </div>
            </div>
          </div>

          {bomSuccess && (
            <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Komponen BOM berhasil diperbarui dan seluruh HPP SKU otomatis dihitung ulang!</span>
            </div>
          )}

          <form onSubmit={handleSaveBom} className="space-y-3">
            {tempBom.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={item.komponen}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTempBom((prev) =>
                        prev.map((b, i) => (i === idx ? { ...b, komponen: val } : b))
                      );
                    }}
                    className="w-full bg-transparent font-semibold text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.keterangan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTempBom((prev) =>
                        prev.map((b, i) => (i === idx ? { ...b, keterangan: val } : b))
                      );
                    }}
                    placeholder="Spesifikasi / keterangan"
                    className="w-full bg-transparent text-xs text-slate-400 focus:outline-none mt-0.5"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">Rp</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={item.biayaPerUnit}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setTempBom((prev) =>
                        prev.map((b, i) => (i === idx ? { ...b, biayaPerUnit: val } : b))
                      );
                    }}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-right text-xs text-white font-mono"
                  />
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                Simpan & Perbarui HPP Seluruh SKU
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT PARAMETER LINI PRODUK (SERIES) */}
      {/* ========================================================================= */}
      {editingSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              Edit Parameter Lini: <span className="font-mono text-amber-400">{editingSeries.code}</span>
            </h3>

            <form onSubmit={handleSaveEditSeries} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lini Produk</label>
                <input
                  type="text"
                  required
                  value={editSeriesName}
                  onChange={(e) => setEditSeriesName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Gramasi Kain (GSM)</label>
                  <input
                    type="number"
                    required
                    value={editSeriesGsm}
                    onChange={(e) => setEditSeriesGsm(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Pola Potongan (Fit)</label>
                  <select
                    value={editSeriesFit}
                    onChange={(e) => setEditSeriesFit(e.target.value as ApparelFit)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Oversize">Oversize Fit</option>
                    <option value="Regular">Regular Fit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Biaya Kaos Polos Konveksi (Rp)</label>
                  <input
                    type="number"
                    required
                    value={editSeriesBaseCost}
                    onChange={(e) => setEditSeriesBaseCost(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Harga Jual Rekomendasi (Rp)</label>
                  <input
                    type="number"
                    required
                    value={editSeriesPrice}
                    onChange={(e) => setEditSeriesPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi & Karakter Bahan</label>
                <textarea
                  rows={3}
                  value={editSeriesDesc}
                  onChange={(e) => setEditSeriesDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSeries(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH SKU BARU */}
      {/* ========================================================================= */}
      {isAddSkuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Tambah SKU Kaos / Produk Baru
            </h3>

            <form onSubmit={handleSaveAddSku} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Lini / Seri Produk *</label>
                <select
                  value={newSeriesCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setNewSeriesCode(code);
                    const matchedSer = series.find((s) => s.code === code);
                    if (matchedSer) {
                      setNewPrice(matchedSer.defaultPrice);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {series.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                  <option value="ACC">Aksesoris / Merchandise (ACC)</option>
                  <option value="BAG">Tas / Goodie Bag (BAG)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Kode Warna (2 Huruf)</label>
                  <input
                    type="text"
                    value={newColorCode}
                    onChange={(e) => setNewColorCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: HT, PT, WB"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Nama Warna / Varian</label>
                  <input
                    type="text"
                    required
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="Contoh: Washed Black"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Ukuran / Size *</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="S">Size S</option>
                    <option value="M">Size M</option>
                    <option value="L">Size L</option>
                    <option value="XL">Size XL</option>
                    <option value="2XL">Size 2XL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Buffer Minimum</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HPP Kustom (0 = Ikuti Seri)</label>
                  <input
                    type="number"
                    value={newHppCustom}
                    onChange={(e) => setNewHppCustom(Number(e.target.value) || 0)}
                    placeholder="Otomatis"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kustom Kode SKU (Opsional)</label>
                <input
                  type="text"
                  value={newSkuCode}
                  onChange={(e) => setNewSkuCode(e.target.value.toUpperCase())}
                  placeholder={`KL-${newSeriesCode}-${newColorCode || 'STD'}-${newSize}`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSkuOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Simpan SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT SKU */}
      {/* ========================================================================= */}
      {editingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              Edit SKU: <span className="font-mono text-amber-400">{editingSku.sku}</span>
            </h3>

            <form onSubmit={handleSaveEditSku} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Kode SKU</label>
                <input
                  type="text"
                  required
                  value={editSkuCode}
                  onChange={(e) => setEditSkuCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Produk / Kaos Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Varian Warna</label>
                  <input
                    type="text"
                    value={editColorName}
                    onChange={(e) => setEditColorName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ukuran / Size</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HPP Modal (Rp)</label>
                  <input
                    type="number"
                    value={editHpp}
                    onChange={(e) => setEditHpp(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Buffer Min.</label>
                  <input
                    type="number"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSku(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI HAPUS SKU */}
      {/* ========================================================================= */}
      {skuToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#121620] border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Hapus Master SKU?
            </h3>
            <p className="text-slate-300">
              Apakah Anda yakin ingin menghapus SKU <span className="font-bold text-amber-400 font-mono">{skuToDelete.sku}</span> ({skuToDelete.name})?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSkuToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSku(skuToDelete.sku)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer"
              >
                Hapus SKU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
