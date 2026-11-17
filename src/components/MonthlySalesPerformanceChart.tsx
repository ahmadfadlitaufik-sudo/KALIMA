import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  Layers,
  ShoppingBag,
  Package,
  DollarSign,
  Percent,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sparkles,
  ChevronRight,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Order, SalesChannel } from '../types';

interface MonthlySalesPerformanceChartProps {
  orders: Order[];
  channels: SalesChannel[];
  isOwner: boolean;
}

type ChartViewType = 'revenue_profit' | 'channel_composition' | 'volume_orders' | 'aov_trend';
type TimeRangeType = 'all' | '6_months' | '12_months' | 'current_year';

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const FULL_MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const CHANNEL_COLORS: Record<string, string> = {
  'Shopee': '#f97316',
  'TikTok': '#06b6d4',
  'TAPADA': '#8b5cf6',
  'Reseller': '#10b981',
  'Umum': '#3b82f6',
  'Marketing': '#ec4899',
  'Internal': '#64748b',
};

const DEFAULT_CHANNEL_COLOR = '#a855f7';

export const MonthlySalesPerformanceChart: React.FC<MonthlySalesPerformanceChartProps> = ({
  orders,
  channels,
  isOwner,
}) => {
  const [chartType, setChartType] = useState<ChartViewType>('revenue_profit');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Available years from orders
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    orders.forEach((o) => {
      if (o.tanggal) {
        const yr = o.tanggal.split('-')[0];
        if (yr) yearSet.add(yr);
      }
    });
    const currentYr = new Date().getFullYear().toString();
    yearSet.add(currentYr);
    return Array.from(yearSet).sort().reverse();
  }, [orders]);

  // Process & Aggregate Monthly Data
  const monthlyData = useMemo(() => {
    // Collect all valid completed/processing orders (exclude cancelled)
    const validOrders = orders.filter((o) => o.statusOrder !== 'batal');

    // Create a map by "YYYY-MM"
    const monthMap: Record<
      string,
      {
        yearMonth: string;
        year: string;
        monthIndex: number;
        monthLabel: string;
        fullLabel: string;
        omzet: number;
        labaKotor: number;
        totalOrders: number;
        totalQty: number;
        adminFees: number;
        channels: Record<string, number>;
        channelQty: Record<string, number>;
      }
    > = {};

    // Populate data from orders
    validOrders.forEach((o) => {
      if (!o.tanggal) return;
      const parts = o.tanggal.split('-');
      if (parts.length < 2) return;
      const ym = `${parts[0]}-${parts[1]}`;
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;

      if (!monthMap[ym]) {
        monthMap[ym] = {
          yearMonth: ym,
          year,
          monthIndex: monthIdx,
          monthLabel: `${MONTH_NAMES_ID[monthIdx] || parts[1]} '${year.slice(-2)}`,
          fullLabel: `${FULL_MONTH_NAMES_ID[monthIdx] || parts[1]} ${year}`,
          omzet: 0,
          labaKotor: 0,
          totalOrders: 0,
          totalQty: 0,
          adminFees: 0,
          channels: {},
          channelQty: {},
        };
      }

      const itemQty = o.items ? o.items.reduce((sum, it) => sum + (it.qty || 0), 0) : 0;
      monthMap[ym].omzet += o.totalTagihan || 0;
      monthMap[ym].labaKotor += o.labaKotor || 0;
      monthMap[ym].totalOrders += 1;
      monthMap[ym].totalQty += itemQty;
      monthMap[ym].adminFees += o.adminFeeAmount || 0;

      // Channel breakdown
      const chName = o.channel || 'Umum';
      monthMap[ym].channels[chName] = (monthMap[ym].channels[chName] || 0) + (o.totalTagihan || 0);
      monthMap[ym].channelQty[chName] = (monthMap[ym].channelQty[chName] || 0) + itemQty;
    });

    // If no data, populate current year's months so chart renders cleanly
    if (Object.keys(monthMap).length === 0) {
      const now = new Date();
      const yr = now.getFullYear().toString();
      for (let m = 0; m < 12; m++) {
        const mStr = String(m + 1).padStart(2, '0');
        const ym = `${yr}-${mStr}`;
        monthMap[ym] = {
          yearMonth: ym,
          year: yr,
          monthIndex: m,
          monthLabel: `${MONTH_NAMES_ID[m]} '${yr.slice(-2)}`,
          fullLabel: `${FULL_MONTH_NAMES_ID[m]} ${yr}`,
          omzet: 0,
          labaKotor: 0,
          totalOrders: 0,
          totalQty: 0,
          adminFees: 0,
          channels: {},
          channelQty: {},
        };
      }
    }

    // Sort chronologically
    let sortedList = Object.values(monthMap).sort((a, b) =>
      a.yearMonth.localeCompare(b.yearMonth)
    );

    // Apply Year filter if selected
    if (selectedYear !== 'all') {
      sortedList = sortedList.filter((d) => d.year === selectedYear);
    }

    // Apply Time Range filter
    if (timeRange === '6_months') {
      sortedList = sortedList.slice(-6);
    } else if (timeRange === '12_months') {
      sortedList = sortedList.slice(-12);
    } else if (timeRange === 'current_year') {
      const curYear = new Date().getFullYear().toString();
      sortedList = sortedList.filter((d) => d.year === curYear);
    }

    // Enhance with derived metrics (AOV, profit margin, MoM growth)
    return sortedList.map((item, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const momGrowth = prev && prev.omzet > 0
        ? ((item.omzet - prev.omzet) / prev.omzet) * 100
        : 0;

      const aov = item.totalOrders > 0 ? Math.round(item.omzet / item.totalOrders) : 0;
      const pricePerPcs = item.totalQty > 0 ? Math.round(item.omzet / item.totalQty) : 0;
      const profitMargin = item.omzet > 0 ? Number(((item.labaKotor / item.omzet) * 100).toFixed(1)) : 0;

      // Extract unique channel keys for recharts
      const channelProps: Record<string, number> = {};
      channels.forEach((ch) => {
        channelProps[ch.name] = item.channels[ch.name] || 0;
      });
      // also include any other channel in order
      Object.keys(item.channels).forEach((ch) => {
        channelProps[ch] = item.channels[ch] || 0;
      });

      return {
        ...item,
        ...channelProps,
        aov,
        pricePerPcs,
        profitMargin,
        momGrowth: Number(momGrowth.toFixed(1)),
      };
    });
  }, [orders, channels, selectedYear, timeRange]);

  // Distinct channels present in the aggregated data
  const activeChannels = useMemo(() => {
    const set = new Set<string>();
    monthlyData.forEach((d) => {
      Object.keys(d.channels).forEach((ch) => {
        if (d.channels[ch] > 0) set.add(ch);
      });
    });
    if (set.size === 0) {
      channels.forEach((c) => set.add(c.name));
    }
    return Array.from(set);
  }, [monthlyData, channels]);

  // Overall Statistics for KPI Highlights
  const kpiStats = useMemo(() => {
    if (monthlyData.length === 0) {
      return {
        totalRevenue: 0,
        totalGrossProfit: 0,
        totalOrdersCount: 0,
        totalQtyCount: 0,
        avgMonthlyRevenue: 0,
        bestMonth: null,
        latestMoMGrowth: 0,
        avgAOV: 0,
      };
    }

    const totalRevenue = monthlyData.reduce((acc, m) => acc + m.omzet, 0);
    const totalGrossProfit = monthlyData.reduce((acc, m) => acc + m.labaKotor, 0);
    const totalOrdersCount = monthlyData.reduce((acc, m) => acc + m.totalOrders, 0);
    const totalQtyCount = monthlyData.reduce((acc, m) => acc + m.totalQty, 0);
    const avgMonthlyRevenue = Math.round(totalRevenue / monthlyData.length);

    // Find best performing month
    let bestMonth = monthlyData[0];
    monthlyData.forEach((m) => {
      if (m.omzet > (bestMonth?.omzet || 0)) {
        bestMonth = m;
      }
    });

    const latestMonth = monthlyData[monthlyData.length - 1];
    const latestMoMGrowth = latestMonth ? latestMonth.momGrowth : 0;
    const avgAOV = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    return {
      totalRevenue,
      totalGrossProfit,
      totalOrdersCount,
      totalQtyCount,
      avgMonthlyRevenue,
      bestMonth,
      latestMoMGrowth,
      avgAOV,
    };
  }, [monthlyData]);

  // Currency Formatter
  const formatRupiah = (val: number): string => {
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const formatShortRupiah = (val: number): string => {
    if (val >= 1_000_000_000) {
      return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000_000) {
      return `Rp ${(val / 1_000_000).toFixed(1)}Jt`;
    }
    if (val >= 1_000) {
      return `Rp ${(val / 1_000).toFixed(0)}Rb`;
    }
    return `Rp ${val}`;
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xl min-w-[220px] text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <span className="font-bold text-slate-900 text-sm">{dataPoint?.fullLabel || label}</span>
            {dataPoint?.momGrowth !== undefined && dataPoint?.momGrowth !== 0 && (
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  dataPoint.momGrowth >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {dataPoint.momGrowth >= 0 ? '+' : ''}
                {dataPoint.momGrowth}% MoM
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {chartType === 'revenue_profit' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Total Omzet:
                  </span>
                  <span className="font-bold text-amber-300 font-mono">
                    {formatRupiah(dataPoint?.omzet || 0)}
                  </span>
                </div>
                {isOwner && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        Laba Kotor:
                      </span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {formatRupiah(dataPoint?.labaKotor || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60 text-slate-400">
                      <span>Margin Keuntungan:</span>
                      <span className="font-bold text-emerald-300 font-mono">
                        {dataPoint?.profitMargin}%
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                  <span>Transaksi / Volume:</span>
                  <span className="font-mono text-slate-200">
                    {dataPoint?.totalOrders} order · {dataPoint?.totalQty} pcs
                  </span>
                </div>
              </>
            )}

            {chartType === 'channel_composition' && (
              <>
                <div className="text-xs font-semibold text-slate-400 mb-1">
                  Kontribusi per Saluran:
                </div>
                {activeChannels.map((ch) => {
                  const val = dataPoint?.[ch] || 0;
                  const pct = dataPoint?.omzet > 0 ? ((val / dataPoint.omzet) * 100).toFixed(1) : 0;
                  const color = CHANNEL_COLORS[ch] || DEFAULT_CHANNEL_COLOR;
                  return (
                    <div key={ch} className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: color }} />
                        {ch}:
                      </span>
                      <span className="font-mono font-semibold text-white">
                        {formatRupiah(val)}{' '}
                        <span className="text-slate-400 text-[11px]">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-slate-800 pt-1 mt-1 flex justify-between font-bold text-amber-300">
                  <span>Total Bulan:</span>
                  <span className="font-mono">{formatRupiah(dataPoint?.omzet || 0)}</span>
                </div>
              </>
            )}

            {chartType === 'volume_orders' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />
                    Total Qty Terjual:
                  </span>
                  <span className="font-bold text-blue-300 font-mono">
                    {dataPoint?.totalQty?.toLocaleString('id-ID')} pcs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Total Transaksi:
                  </span>
                  <span className="font-bold text-amber-300 font-mono">
                    {dataPoint?.totalOrders?.toLocaleString('id-ID')} order
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs text-slate-400">
                  <span>Rata-rata Qty/Order:</span>
                  <span className="font-mono text-white">
                    {dataPoint?.totalOrders > 0
                      ? (dataPoint.totalQty / dataPoint.totalOrders).toFixed(1)
                      : 0}{' '}
                    pcs
                  </span>
                </div>
              </>
            )}

            {chartType === 'aov_trend' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                    Rata-rata Nilai Order (AOV):
                  </span>
                  <span className="font-bold text-purple-300 font-mono">
                    {formatRupiah(dataPoint?.aov || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Harga Rata-rata per Pcs:
                  </span>
                  <span className="font-bold text-emerald-300 font-mono">
                    {formatRupiah(dataPoint?.pricePerPcs || 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Export monthly summary to CSV
  const handleExportCSV = () => {
    const headers = [
      'Bulan',
      'Tahun',
      'Total Omzet (Rp)',
      'Laba Kotor (Rp)',
      'Jumlah Order',
      'Total Pcs',
      'AOV (Rp)',
      'Pertumbuhan MoM (%)',
    ];

    const rows = monthlyData.map((m) => [
      `"${m.fullLabel}"`,
      m.year,
      m.omzet,
      isOwner ? m.labaKotor : 'Protected',
      m.totalOrders,
      m.totalQty,
      m.aov,
      `${m.momGrowth}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `performa-penjualan-bulanan-kalima-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-5 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Ringkasan & Tren Performa Penjualan Bulanan
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualisasi analitik komprehensif omzet, volume produk, kontribusi saluran, dan pertumbuhan bulanan (MoM).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart View Selector */}
          <div className="segmented-pill-bar flex items-center gap-1 bg-slate-100/80">
            <button
              onClick={() => setChartType('revenue_profit')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartType === 'revenue_profit'
                  ? 'segmented-pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Tren Omzet & Laba" aria-label="Tren Omzet & Laba"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Omzet & Laba</span>
            </button>

            <button
              onClick={() => setChartType('channel_composition')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartType === 'channel_composition'
                  ? 'segmented-pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Komposisi Channel Penjualan" aria-label="Komposisi Channel Penjualan"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Saluran (Channel)</span>
            </button>

            <button
              onClick={() => setChartType('volume_orders')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartType === 'volume_orders'
                  ? 'segmented-pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Volume Penjualan (Pcs) & Transaksi" aria-label="Volume Penjualan (Pcs) & Transaksi"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Volume & Qty</span>
            </button>

            <button
              onClick={() => setChartType('aov_trend')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chartType === 'aov_trend'
                  ? 'segmented-pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Average Order Value (AOV)" aria-label="Average Order Value (AOV)"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>AOV</span>
            </button>
          </div>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRangeType)}
            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-full px-3 py-1.5 focus:outline-none focus:border-slate-900 cursor-pointer shadow-2xs font-semibold"
          >
            <option value="all">Semua Periode</option>
            <option value="6_months">6 Bulan Terakhir</option>
            <option value="12_months">12 Bulan Terakhir</option>
            <option value="current_year">Tahun Ini ({new Date().getFullYear()})</option>
          </select>

          {/* Year Filter */}
          {availableYears.length > 1 && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-full px-3 py-1.5 focus:outline-none focus:border-slate-900 cursor-pointer shadow-2xs font-semibold"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          )}

          {/* CSV Download Button */}
          <button
            onClick={handleExportCSV}
            title="Download Rekap Bulanan CSV" aria-label="Download Rekap Bulanan CSV"
            className="btn-circle-action cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Rata-rata Bulanan */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Rata-rata Omzet</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1">
            {formatShortRupiah(kpiStats.avgMonthlyRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            dari {monthlyData.length} bulan operasional
          </div>
        </div>

        {/* Bulan Terbaik */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Bulan Terbaik</span>
            <Award className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1 truncate">
            {kpiStats.bestMonth?.fullLabel || '-'}
          </div>
          <div className="text-[11px] text-amber-700 font-bold font-mono">
            {kpiStats.bestMonth ? formatShortRupiah(kpiStats.bestMonth.omzet) : 'Rp 0'}
          </div>
        </div>

        {/* Pertumbuhan MoM Terkini */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Tren MoM Terakhir</span>
            {kpiStats.latestMoMGrowth >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            )}
          </div>
          <div
            className={`text-base sm:text-lg font-black font-mono mt-1 ${
              kpiStats.latestMoMGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {kpiStats.latestMoMGrowth >= 0 ? '+' : ''}
            {kpiStats.latestMoMGrowth}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">dibandingkan bulan lalu</div>
        </div>

        {/* Rata-rata Order Value */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Rata-rata Order (AOV)</span>
            <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-1">
            {formatShortRupiah(kpiStats.avgAOV)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Total {kpiStats.totalQtyCount.toLocaleString('id-ID')} pcs terjual
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'revenue_profit' ? (
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(val) => formatShortRupiah(val)}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                formatter={(value) => <span className="text-slate-700 font-bold">{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="omzet"
                name="Total Omzet (Revenue)"
                stroke="#f43f5e"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#omzetGradient)"
                activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
              />
              {isOwner && (
                <Area
                  type="monotone"
                  dataKey="labaKotor"
                  name="Laba Kotor (Gross Profit)"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#profitGradient)"
                  activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          ) : chartType === 'channel_composition' ? (
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(val) => formatShortRupiah(val)}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                formatter={(value) => <span className="text-slate-700 font-bold">{value}</span>}
              />
              {activeChannels.map((ch) => (
                <Bar
                  key={ch}
                  dataKey={ch}
                  name={ch}
                  stackId="channelStack"
                  fill={CHANNEL_COLORS[ch] || DEFAULT_CHANNEL_COLOR}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          ) : chartType === 'volume_orders' ? (
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#3b82f6"
                tick={{ fill: '#2563eb', fontSize: 10 }}
                tickFormatter={(val) => `${val} pcs`}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f59e0b"
                tick={{ fill: '#d97706', fontSize: 10 }}
                tickFormatter={(val) => `${val} ord`}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                formatter={(value) => <span className="text-slate-700 font-bold">{value}</span>}
              />
              <Bar
                yAxisId="left"
                dataKey="totalQty"
                name="Volume Produk Terjual (Pcs)"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalOrders"
                name="Jumlah Transaksi Pesanan"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
              />
            </BarChart>
          ) : (
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#cbd5e1"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(val) => formatShortRupiah(val)}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="aov"
                name="Average Order Value (AOV)"
                stroke="#a855f7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#a855f7' }}
                activeDot={{ r: 6, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="pricePerPcs"
                name="Harga Rata-rata per Pcs"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#10b981' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Monthly Breakdown Table Accordion / Data Grid Summary */}
      <div className="border-t border-slate-800/80 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2.5">
          <span className="flex items-center gap-1.5">
            <span>Rincian Data Performa Tiap Bulan</span>
            <span className="text-[11px] text-slate-500 font-normal">
              ({monthlyData.length} bulan ditampilkan)
            </span>
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Total Omzet:{' '}
            <strong className="text-amber-400 font-mono">
              {formatRupiah(kpiStats.totalRevenue)}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Periode Bulan</th>
                <th className="px-3 py-2.5 text-right">Omzet Penjualan</th>
                {isOwner && <th className="px-3 py-2.5 text-right">Laba Kotor</th>}
                {isOwner && <th className="px-3 py-2.5 text-right">Margin</th>}
                <th className="px-3 py-2.5 text-right">Qty Terjual</th>
                <th className="px-3 py-2.5 text-right">Total Order</th>
                <th className="px-3 py-2.5 text-right">Rata-rata AOV</th>
                <th className="px-3 py-2.5 text-right">Pertumbuhan MoM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-950/40 font-mono">
              {monthlyData.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 8 : 6} className="text-center py-6 text-slate-500 font-sans">
                    Belum ada riwayat transaksi penjualan bulanan.
                  </td>
                </tr>
              ) : (
                monthlyData.slice().reverse().map((m) => (
                  <tr key={m.yearMonth} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-3 py-2 font-sans font-medium text-white flex items-center gap-1.5">
                      <span>{m.fullLabel}</span>
                      {kpiStats.bestMonth?.yearMonth === m.yearMonth && (
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-sans font-semibold">
                          Top
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-300">
                      Rp {m.omzet.toLocaleString('id-ID')}
                    </td>
                    {isOwner && (
                      <td className="px-3 py-2 text-right text-emerald-400 font-semibold">
                        Rp {m.labaKotor.toLocaleString('id-ID')}
                      </td>
                    )}
                    {isOwner && (
                      <td className="px-3 py-2 text-right text-slate-300 font-medium">
                        {m.profitMargin}%
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-slate-200">
                      {m.totalQty.toLocaleString('id-ID')} pcs
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {m.totalOrders} order
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 text-xs">
                      Rp {m.aov.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-xs">
                      {m.momGrowth > 0 ? (
                        <span className="text-emerald-400">+{m.momGrowth}%</span>
                      ) : m.momGrowth < 0 ? (
                        <span className="text-rose-400">{m.momGrowth}%</span>
                      ) : (
                        <span className="text-slate-500">0%</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
