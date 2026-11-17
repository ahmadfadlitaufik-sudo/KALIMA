import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  Clock,
  ChevronRight,
  EyeOff,
  RefreshCw,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Target,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { orderSortComparator } from '../types';
import { cashFlowForMonth, grossMarginPercent, negativeStock, qtySoldInMonth, stockValue } from '../services/dashboardMetrics';
import { CashBankSection } from '../components/CashBankSection';
import { MonthlySalesPerformanceChart } from '../components/MonthlySalesPerformanceChart';
import fintechGrowthImg from '../assets/images/fintech_growth_card_1790731112363.jpg';
import apparelHeroImg from '../assets/images/apparel_hero_card_1790731128707.jpg';

export const DashboardView: React.FC = () => {
  const {
    isOwner,
    orders,
    skus,
    series,
    channels,
    stockMovements,
    biayaOperasional,
    calculateStockSummary,
    getLowStockSKUs,
    setCurrentView,
    cashAccounts,
    cashMutations,
    purchaseOrders,
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'all'>('30days');

  // Compute Total Cash Balance
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthCashFlow = useMemo(() => cashFlowForMonth(cashMutations, currentMonth), [cashMutations, currentMonth]);
  const qtySoldThisMonth = useMemo(() => qtySoldInMonth(orders, currentMonth), [orders, currentMonth]);
  const MONTHLY_QUOTA_PCS = 1500;
  const periodLabel = { today: 'hari ini', '7days': '7 hari terakhir', '30days': '30 hari terakhir', all: 'semua waktu' }[dateFilter];

  const totalCashBalance = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  // Total belanja semua PO
  const totalBelanjaPO = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (po.totalTagihan || 0), 0);
  }, [purchaseOrders]);

  const totalQtyPesanPO = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (po.totalQtyPesan || 0), 0);
  }, [purchaseOrders]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return orders.filter((ord) => {
      if (ord.statusOrder === 'batal') return false;

      if (dateFilter === 'today') {
        return ord.tanggal === todayStr;
      }
      if (dateFilter === '7days') {
        const orderDate = new Date(ord.tanggal);
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (dateFilter === '30days') {
        const orderDate = new Date(ord.tanggal);
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 30;
      }
      return true;
    });
  }, [orders, dateFilter]);

  // Aggregate stats
  const totalOmzet = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.totalTagihan, 0);
  }, [filteredOrders]);

  const totalQtySold = useMemo(() => {
    return filteredOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0),
      0
    );
  }, [filteredOrders]);

  const totalLabaKotor = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.labaKotor, 0);
  }, [filteredOrders]);

  const totalBiayaOperasional = useMemo(() => {
    return biayaOperasional.reduce((sum, b) => sum + b.jumlah, 0);
  }, [biayaOperasional]);

  const estimasiLabaBersih = totalLabaKotor - totalBiayaOperasional;

  // Stock Summary
  const stockSummary = calculateStockSummary();
  const lowStockSKUs = getLowStockSKUs();

  const totalStokGudang = Object.values(stockSummary).reduce((acc, it) => acc + it.gudang, 0);
  const totalStokReseller = Object.values(stockSummary).reduce((acc, it) => acc + it.reseller, 0);
  const minusStock = negativeStock(stockSummary, 'total');

  // Nilai Persediaan (HPP * stock) - Owner only
  const totalNilaiPersediaan = useMemo(() => stockValue(skus, stockSummary, 'gudang'), [skus, stockSummary]);

  // Piutang Outstanding
  const piutangOrders = useMemo(() => {
    return orders.filter(
      (o) => o.statusBayar === 'piutang' || o.statusBayar === 'sebagian'
    );
  }, [orders]);

  const totalPiutang = useMemo(() => {
    return piutangOrders.reduce((sum, o) => sum + (o.sisaPiutang || 0), 0);
  }, [piutangOrders]);

  // Channel breakdown
  const channelBreakdown = useMemo(() => {
    const map: Record<string, { count: number; omzet: number; qty: number; laba: number }> = {};
    channels.forEach((ch) => {
      map[ch.name] = { count: 0, omzet: 0, qty: 0, laba: 0 };
    });

    filteredOrders.forEach((o) => {
      if (!map[o.channel]) {
        map[o.channel] = { count: 0, omzet: 0, qty: 0, laba: 0 };
      }
      map[o.channel].count += 1;
      map[o.channel].omzet += o.totalTagihan;
      map[o.channel].laba += o.labaKotor;
      map[o.channel].qty += o.items.reduce((s, it) => s + it.qty, 0);
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.omzet - a.omzet);
  }, [filteredOrders, channels]);

  const recentOrders = useMemo(() => {
    return [...orders].sort(orderSortComparator).slice(0, 6);
  }, [orders]);

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE FEATURE CARDS (MATCHING REFERENCE DESIGN LAYOUT & PALETTE)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CARD 1: DARK TECH CARD ("Your Balance" Reference Card) - col-span-12 lg:col-span-5 */}
        <div className="card-dark-tech lg:col-span-5 p-6 flex flex-col justify-between relative min-h-[250px] overflow-hidden group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-rose-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-rose-500/30 transition-all duration-700" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Row: Title & Net Growth Pill */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Saldo Kas & Likuiditas
              </span>
            </div>
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                monthCashFlow.count === 0
                  ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                  : monthCashFlow.net >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}
              title={`Kas masuk Rp ${monthCashFlow.masuk.toLocaleString('id-ID')} · keluar Rp ${monthCashFlow.keluar.toLocaleString('id-ID')} bulan ini`}
            >
              {monthCashFlow.count > 0 && (monthCashFlow.net >= 0 ? <ArrowUpRight className="w-3 h-3 stroke-[2.5]" /> : <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />)}
              <span>
                {monthCashFlow.count === 0
                  ? 'Belum ada mutasi bulan ini'
                  : `${monthCashFlow.net >= 0 ? '+' : '−'}Rp ${Math.abs(monthCashFlow.net).toLocaleString('id-ID')} bulan ini`}
              </span>
            </div>
          </div>

          {/* Center: Big Balance Amount */}
          <div className="my-5 relative z-10">
            <div className="text-xs text-slate-400 font-medium">Total Kas & Rekening Bank Aktif</div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono mt-1">
              Rp {totalCashBalance.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{cashAccounts.length} Rekening Terhubung</span>
              <span>·</span>
              <span className={`font-medium ${monthCashFlow.count === 0 ? 'text-slate-400' : monthCashFlow.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthCashFlow.count === 0 ? 'Arus kas bulan ini belum tercatat' : monthCashFlow.net >= 0 ? 'Arus kas bulan ini positif' : 'Arus kas bulan ini negatif'}
              </span>
            </div>
          </div>

          {/* Bottom Action Row: Frosted Buttons (Sell / Buy Style in Reference) */}
          <div className="grid grid-cols-1 gap-2.5 pt-2 relative z-10">
            <button
              onClick={() => setCurrentView('finance')}
              className="frosted-btn py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Buku Kas & Bank</span>
            </button>
          </div>
        </div>

        {/* CARD 2: VIBRANT GRADIENT CORAL CARD ("Retire on your terms" Reference Card) - col-span-12 lg:col-span-4 */}
        <div className="card-gradient-coral lg:col-span-4 p-6 flex flex-col justify-between relative min-h-[250px] overflow-hidden group">
          {/* Subtle Ambient Radial Light */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Floating Generated 3D Illustration Asset on the right */}
          <div className="absolute -bottom-2 -right-2 w-32 h-32 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 transform rotate-3 group-hover:rotate-0 group-hover:scale-105 transition-all duration-500 pointer-events-none">
            <img
              src={fintechGrowthImg}
              alt="Kalima Growth Asset"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 max-w-[65%]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white mb-2">
              <Sparkles className="w-3 h-3 text-amber-200 fill-amber-200" />
              <span>Target & Kuota Penjualan</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight mt-1">
              Target Omzet Bulanan
            </h3>
            <p className="text-xs text-rose-50/90 mt-2 font-medium leading-relaxed">
              Bulan ini terjual <strong>{qtySoldThisMonth.toLocaleString('id-ID')} pcs</strong> dari kuota {MONTHLY_QUOTA_PCS.toLocaleString('id-ID')} pcs ({Math.round((qtySoldThisMonth / MONTHLY_QUOTA_PCS) * 100)}%).
            </p>
          </div>

          <div className="relative z-10 pt-4">
            <button
              type="button"
              onClick={() => setCurrentView('sales')}
              className="btn-white-pill px-5 py-2.5 text-xs inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-900 bg-white hover:bg-slate-50 transition-all duration-200 shadow-md"
            >
              <span className="text-slate-900 font-bold">Kelola Pesanan</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] text-slate-900" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 2 STACKED PASTEL CARDS ("Net Growth Score" & "You Invest" in Reference) - col-span-12 lg:col-span-3 */}
        <div className="lg:col-span-3 flex flex-col gap-3.5">
          {/* CARD 3: SOFT PASTEL PINK ("Net Growth Score" Reference) */}
          <div className="card-pastel-pink p-4 flex items-center justify-between relative overflow-hidden flex-1">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  {isOwner ? 'Margin Kotor' : 'Penjualan'}
                </span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 first-letter:uppercase">
                {periodLabel}
              </div>
              <div className="text-xs text-slate-600">
                {isOwner
                  ? `Laba kotor Rp ${totalLabaKotor.toLocaleString('id-ID')}`
                  : `${totalQtySold.toLocaleString('id-ID')} pcs terjual`}
              </div>
            </div>

            {/* Circular Gauge / Badge */}
            <div className="w-13 h-13 rounded-full bg-white shadow-sm border border-rose-200 flex flex-col items-center justify-center shrink-0">
              <span className="text-base font-black text-rose-600 font-mono leading-none">
                {isOwner ? (grossMarginPercent(totalOmzet, totalLabaKotor) === null ? '–' : `${grossMarginPercent(totalOmzet, totalLabaKotor)}%`) : filteredOrders.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">{isOwner ? 'Margin' : 'Order'}</span>
            </div>
          </div>

          {/* CARD 4: SOFT PASTEL PEACH ("You Invested in Last 30 Days" Reference) */}
          <div className="card-pastel-peach p-4 flex items-center justify-between relative overflow-hidden flex-1 group">
            <div className="space-y-0.5 max-w-[62%]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Total Belanja PO
              </span>
              <div className="text-base font-black text-slate-900 font-mono tracking-tight">
                Rp {totalBelanjaPO.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-slate-600 truncate">
                {totalQtyPesanPO.toLocaleString('id-ID')} pcs dari {purchaseOrders.length} PO
              </div>
            </div>

            {/* Embedded Thumbnail Asset */}
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm border-2 border-white shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={apparelHeroImg}
                alt="Apparel Hero Asset"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Filter Banner with Segmented Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Ringkasan Metrik Operasional
          </h2>
          <p className="text-xs text-slate-500">
            {isOwner
              ? 'Data transaksi, margin laba kotor, arus kas & pergerakan stok real-time'
              : 'Data transaksi, antrean pengiriman & monitoring stok gudang'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Filter Pills */}
          <div className="segmented-pill-bar flex items-center gap-1 bg-slate-100/80">
            {(
              [
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari' },
                { id: '30days', label: '30 Hari' },
                { id: 'all', label: 'Semua' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === tab.id
                    ? 'segmented-pill-active'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. METRIC CARDS ROW (Soft Clean White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Omzet Penjualan</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rp {totalOmzet.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
              <span className="font-bold text-rose-600 font-mono">{filteredOrders.length}</span> order
              <span>·</span>
              <span className="font-bold text-slate-900 font-mono">{totalQtySold}</span> pcs
            </div>
          </div>
        </div>

        {/* Laba Kotor (Owner Only) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isOwner ? 'Laba Kotor (Gross Profit)' : 'Total Qty Terjual'}
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {isOwner ? (
              <>
                <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
                  Rp {totalLabaKotor.toLocaleString('id-ID')}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                  <span>Margin:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {totalOmzet > 0 ? ((totalLabaKotor / totalOmzet) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {totalQtySold} pcs
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Margin laba disembunyikan untuk CS</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Total Stok Gudang */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stok Fisik</span>
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              {totalStokGudang + totalStokReseller} pcs
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
              <span>Gudang: <strong className="text-slate-900 font-mono">{totalStokGudang}</strong></span>
              <span>·</span>
              <span>Konsinyasi: <strong className="text-amber-600 font-mono">{totalStokReseller}</strong></span>
            </div>
            {minusStock.count > 0 && (
              <button
                type="button"
                onClick={() => setCurrentView('inventory')}
                className="mt-2 flex items-start gap-1 text-left text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {minusStock.count} SKU stok minus ({minusStock.pcs.toLocaleString('id-ID')} pcs) — cek stok
              </button>
            )}
          </div>
        </div>

        {/* Piutang / Tempo */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Piutang & Tempo Aktif</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-700 tracking-tight font-mono">
              Rp {totalPiutang.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
              <span className="font-bold text-amber-700 font-mono">{piutangOrders.length}</span> tagihan aktif
            </div>
          </div>
        </div>
      </div>

      {/* 4. RINGKASAN & GRAFIK PERFORMA PENJUALAN BULANAN (RECHARTS) */}
      <MonthlySalesPerformanceChart
        orders={orders}
        channels={channels}
        isOwner={isOwner}
      />

      {/* 5. SEKSI BUKU KAS & REKENING BANK */}
      <CashBankSection />

      {/* 6. WARNING STOK MENIPIS (IF ANY) */}
      {lowStockSKUs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Peringatan Stok Menipis: {lowStockSKUs.length} SKU Berada Di Bawah Batas Minimum!
              </h4>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Segera jadwalkan pengadaan bahan baku atau restok agar tidak menghambat pemenuhan order.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('inventory')}
            className="btn-primary-dark text-xs !py-2 !px-4 cursor-pointer whitespace-nowrap shrink-0"
          >
            Buka Inventori →
          </button>
        </div>
      )}

      {/* 7. 2-COLUMN SECTION: Breakdown Saluran & Order Terkini */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kiri: Performa per Channel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Penjualan per Saluran (Channel)</h3>
              <p className="text-xs text-slate-500">Distribusi omzet & volume produk</p>
            </div>
            <button
              onClick={() => setCurrentView('sales')}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Detail</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {channelBreakdown.map((ch) => {
              const pct = totalOmzet > 0 ? (ch.omzet / totalOmzet) * 100 : 0;
              return (
                <div key={ch.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span>{ch.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono font-normal">
                        ({ch.count} order · {ch.qty} pcs)
                      </span>
                    </div>
                    <div className="font-mono font-black text-slate-900">
                      Rp {ch.omzet.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kanan: Transaksi Terbaru */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transaksi Pesanan Terbaru</h3>
              <p className="text-xs text-slate-500">Aktivitas penjualan multi-channel terintegrasi</p>
            </div>
            <button
              onClick={() => setCurrentView('sales')}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Semua Pesanan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {recentOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 flex items-center justify-between text-xs transition-colors"
              >
                <div className="space-y-0.5 min-w-0 mr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 font-mono">{ord.noOrder}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                      {ord.channel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {ord.customerNama || 'Customer Umum'} · {ord.tanggal}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-slate-900">
                    Rp {ord.totalTagihan.toLocaleString('id-ID')}
                  </div>
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                      ord.statusBayar === 'lunas'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {ord.statusBayar.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
