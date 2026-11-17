import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  CheckCircle2,
  Table as TableIcon,
} from 'lucide-react';
import { Order, BiayaOperasional } from '../types';

interface MonthlyPnLChartProps {
  orders: Order[];
  biayaOperasional: BiayaOperasional[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
}

export interface MonthlyPnLData {
  month: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
  shortLabel: string; // e.g. "Sep"
  pendapatan: number; // Net Sales
  grossSales: number; // Gross Sales before discount
  diskon: number;
  hpp: number; // Cost of Goods Sold
  adminFee: number;
  labaKotor: number;
  opex: number;
  labaBersih: number;
  marginBersih: number; // %
  marginKotor: number; // %
  hppRatio: number; // %
  opexRatio: number; // %
  orderCount: number;
}

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

export const MonthlyPnLChart: React.FC<MonthlyPnLChartProps> = ({
  orders,
  biayaOperasional,
  selectedMonth,
  onSelectMonth,
}) => {
  const [timeRange, setTimeRange] = useState<'all' | '6m' | '3m'>('all');
  const [chartMode, setChartMode] = useState<'nominal' | 'margin'>('nominal');
  const [showDataTable, setShowDataTable] = useState(false);

  // 1. Compute monthly financial data chronologically
  const monthlyData: MonthlyPnLData[] = useMemo(() => {
    const monthMap: Record<
      string,
      {
        grossSales: number;
        diskon: number;
        hpp: number;
        adminFee: number;
        opex: number;
        orderCount: number;
      }
    > = {};

    // Group orders
    orders.forEach((o) => {
      if (o.statusOrder === 'batal') return;
      if (!o.tanggal || o.tanggal.length < 7) return;
      const m = o.tanggal.substring(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = {
          grossSales: 0,
          diskon: 0,
          hpp: 0,
          adminFee: 0,
          opex: 0,
          orderCount: 0,
        };
      }
      monthMap[m].grossSales += o.subtotal || 0;
      monthMap[m].diskon += o.diskon || 0;
      monthMap[m].hpp += o.totalHpp || 0;
      monthMap[m].adminFee += o.adminFeeAmount || 0;
      monthMap[m].orderCount += 1;
    });

    // Group OPEX
    biayaOperasional.forEach((b) => {
      if (!b.tanggal || b.tanggal.length < 7) return;
      const m = b.tanggal.substring(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = {
          grossSales: 0,
          diskon: 0,
          hpp: 0,
          adminFee: 0,
          opex: 0,
          orderCount: 0,
        };
      }
      monthMap[m].opex += b.jumlah || 0;
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthMap).sort();

    return sortedMonths.map((m) => {
      const data = monthMap[m];
      const pendapatan = Math.max(0, data.grossSales - data.diskon);
      const labaKotor = pendapatan - data.hpp - data.adminFee;
      const labaBersih = labaKotor - data.opex;
      const marginBersih = pendapatan > 0 ? Number(((labaBersih / pendapatan) * 100).toFixed(1)) : 0;
      const marginKotor = pendapatan > 0 ? Number(((labaKotor / pendapatan) * 100).toFixed(1)) : 0;
      const hppRatio = pendapatan > 0 ? Number(((data.hpp / pendapatan) * 100).toFixed(1)) : 0;
      const opexRatio = pendapatan > 0 ? Number(((data.opex / pendapatan) * 100).toFixed(1)) : 0;

      const [year, monthNum] = m.split('-');
      const monthIdx = parseInt(monthNum, 10) - 1;
      const monthName = MONTH_NAMES_ID[monthIdx] || monthNum;

      return {
        month: m,
        label: `${monthName} ${year}`,
        shortLabel: `${monthName} '${year.slice(-2)}`,
        pendapatan,
        grossSales: data.grossSales,
        diskon: data.diskon,
        hpp: data.hpp,
        adminFee: data.adminFee,
        labaKotor,
        opex: data.opex,
        labaBersih,
        marginBersih,
        marginKotor,
        hppRatio,
        opexRatio,
        orderCount: data.orderCount,
      };
    });
  }, [orders, biayaOperasional]);

  // Filter based on selected time range
  const filteredData = useMemo(() => {
    if (timeRange === '3m') return monthlyData.slice(-3);
    if (timeRange === '6m') return monthlyData.slice(-6);
    return monthlyData;
  }, [monthlyData, timeRange]);

  // Overall Totals for the displayed range
  const overallSummary = useMemo(() => {
    const totalPendapatan = filteredData.reduce((s, d) => s + d.pendapatan, 0);
    const totalHpp = filteredData.reduce((s, d) => s + d.hpp, 0);
    const totalOpex = filteredData.reduce((s, d) => s + d.opex, 0);
    const totalLabaKotor = filteredData.reduce((s, d) => s + d.labaKotor, 0);
    const totalLabaBersih = filteredData.reduce((s, d) => s + d.labaBersih, 0);
    const avgMarginBersih = totalPendapatan > 0 ? (totalLabaBersih / totalPendapatan) * 100 : 0;
    const avgHppRatio = totalPendapatan > 0 ? (totalHpp / totalPendapatan) * 100 : 0;

    // Best month by Net Profit
    const bestMonth = [...filteredData].sort((a, b) => b.labaBersih - a.labaBersih)[0] || null;

    return {
      totalPendapatan,
      totalHpp,
      totalOpex,
      totalLabaKotor,
      totalLabaBersih,
      avgMarginBersih,
      avgHppRatio,
      bestMonth,
    };
  }, [filteredData]);

  // Format currency helpers
  const formatRupiah = (val: number) => {
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const formatCompact = (val: number) => {
    if (Math.abs(val) >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}jt`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${(val / 1_000).toFixed(0)}rb`;
    }
    return val.toString();
  };

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as MonthlyPnLData;

    return (
      <div className="bg-slate-950/95 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-sans min-w-[240px]">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Calendar className="w-3.5 h-3.5 text-slate-900" />
            <span>{data.label}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {data.orderCount} pesanan
          </span>
        </div>

        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-slate-900">
            <span className="flex items-center gap-1.5 font-sans text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
              Pendapatan Bersih:
            </span>
            <span className="font-bold">{formatRupiah(data.pendapatan)}</span>
          </div>

          <div className="flex items-center justify-between text-rose-700">
            <span className="flex items-center gap-1.5 font-sans text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              Beban Pokok (HPP):
            </span>
            <span className="font-bold">
              {formatRupiah(data.hpp)}
              <span className="text-[11px] text-slate-400 font-sans ml-1">({data.hppRatio}%)</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-900">
            <span className="flex items-center gap-1.5 font-sans text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              Biaya Operasional (OPEX):
            </span>
            <span className="font-bold">
              {formatRupiah(data.opex)}
              <span className="text-[11px] text-slate-400 font-sans ml-1">({data.opexRatio}%)</span>
            </span>
          </div>

          <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-sans font-bold text-white">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
              Laba Bersih:
            </span>
            <span
              className={`font-black font-mono ${
                data.labaBersih >= 0 ? 'text-indigo-700' : 'text-rose-700'
              }`}
            >
              {formatRupiah(data.labaBersih)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
            <span className="font-sans">Nett Profit Margin:</span>
            <span
              className={`font-bold font-mono ${
                data.marginBersih >= 0 ? 'text-indigo-700' : 'text-rose-700'
              }`}
            >
              {data.marginBersih}%
            </span>
          </div>
        </div>

        {onSelectMonth && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-center text-slate-900/90 font-sans">
            Klik bar untuk memfilter detail rincian bulan ini
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#121620] p-5 rounded-3xl border border-slate-800/80 shadow-md space-y-4">
      {/* Header Visualisasi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-indigo-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Tren Laporan Laba Rugi Bulanan</span>
                <span className="text-[11px] font-mono font-semibold bg-emerald-500/20 text-indigo-700 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Recharts Visual
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Komparasi pendapatan bersih, harga pokok penjualan (HPP), biaya operasional (OPEX), dan laba bersih per bulan
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                timeRange === 'all'
                  ? 'segmented-pill-active font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Bulan ({monthlyData.length})
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('6m')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                timeRange === '6m'
                  ? 'segmented-pill-active font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              6 Bulan
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('3m')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                timeRange === '3m'
                  ? 'segmented-pill-active font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3 Bulan
            </button>
          </div>

          {/* Metric mode toggle: Rupiah vs Margin % */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('nominal')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                chartMode === 'nominal'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>Nominal (Rp)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('margin')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                chartMode === 'margin'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Percent className="w-3 h-3" />
              <span>Margin (%)</span>
            </button>
          </div>

          {/* Toggle Table View Button */}
          <button
            type="button"
            onClick={() => setShowDataTable(!showDataTable)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              showDataTable
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
            }`}
            title="Tampilkan / Sembunyikan tabel angka detail bulanan" aria-label="Tampilkan / Sembunyikan tabel angka detail bulanan"
          >
            <TableIcon className="w-3.5 h-3.5 text-slate-900" />
            <span>{showDataTable ? 'Tutup Tabel' : 'Tabel Angka'}</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Finansial Akumulasi Periode (KPI Strip) */}
      {/* Pendapatan & laba bersih sudah ada di kartu atas; di sini hanya HPP dan bulan terbaik. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 2: Total Beban Pokok (HPP) */}
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-rose-500/20">
          <div className="flex items-center justify-between text-xs text-rose-700 mb-1">
            <span className="font-medium">Beban Pokok (HPP)</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-700 font-mono">
            {formatRupiah(overallSummary.totalHpp)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Rasio HPP:</span>
            <strong className="text-rose-700 font-mono">{overallSummary.avgHppRatio.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Card 4: Bulan Terbaik */}
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-900 mb-1">
            <span className="font-medium">Bulan Performa Terbaik</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          {overallSummary.bestMonth ? (
            <>
              <div className="text-lg sm:text-xl font-black text-slate-900 font-mono truncate">
                {overallSummary.bestMonth.label}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Laba: <span className="text-indigo-700 font-mono font-semibold">{formatRupiah(overallSummary.bestMonth.labaBersih)}</span> ({overallSummary.bestMonth.marginBersih}%)
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500 italic mt-2">Belum ada data</div>
          )}
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-[320px] sm:h-[360px] pt-2">
        {filteredData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
            <span>Belum ada data order atau pengeluaran untuk ditampilkan pada grafik bulanan.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'nominal' ? (
              <ComposedChart
                data={filteredData}
                margin={{ top: 10, right: 15, left: 10, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length && onSelectMonth) {
                    const m = (e.activePayload[0].payload as MonthlyPnLData).month;
                    onSelectMonth(m);
                  }
                }}
              >
                <defs>
                  {/* Linear Gradients for Premium Visual */}
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="gradHpp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#be123c" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="gradOpex" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#b45309" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="gradNetProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.7} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />

                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={formatCompact}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  width={45}
                />

                <Tooltip content={<CustomTooltip />} />

                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  formatter={(value) => {
                    if (value === 'pendapatan') return <span className="text-slate-900 font-medium">Pendapatan Bersih</span>;
                    if (value === 'hpp') return <span className="text-rose-700 font-medium">Harga Pokok (HPP)</span>;
                    if (value === 'opex') return <span className="text-slate-900 font-medium">Beban Operasional</span>;
                    if (value === 'labaBersih') return <span className="text-indigo-700 font-bold">Laba Bersih</span>;
                    return value;
                  }}
                />

                {/* Bars for Cost & Revenue Comparison */}
                <Bar
                  dataKey="pendapatan"
                  name="pendapatan"
                  fill="url(#gradRevenue)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="hpp"
                  name="hpp"
                  fill="url(#gradHpp)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="opex"
                  name="opex"
                  fill="url(#gradOpex)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                />

                {/* Prominent Net Profit Line & Nodes */}
                <Line
                  type="monotone"
                  dataKey="labaBersih"
                  name="labaBersih"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#064e3b' }}
                  activeDot={{ r: 7, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : (
              /* Margin Mode Chart (%) */
              <ComposedChart
                data={filteredData}
                margin={{ top: 10, right: 15, left: 10, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length && onSelectMonth) {
                    const m = (e.activePayload[0].payload as MonthlyPnLData).month;
                    onSelectMonth(m);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />

                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `${val}%`}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  width={40}
                />

                <Tooltip content={<CustomTooltip />} />

                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  formatter={(value) => {
                    if (value === 'marginKotor') return <span className="text-slate-900 font-medium">Gross Margin (%)</span>;
                    if (value === 'hppRatio') return <span className="text-rose-700 font-medium">HPP Ratio (%)</span>;
                    if (value === 'opexRatio') return <span className="text-slate-900 font-medium">OPEX Ratio (%)</span>;
                    if (value === 'marginBersih') return <span className="text-indigo-700 font-bold">Net Profit Margin (%)</span>;
                    return value;
                  }}
                />

                <Bar
                  dataKey="hppRatio"
                  name="hppRatio"
                  fill="#f43f5e"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="opexRatio"
                  name="opexRatio"
                  fill="#f59e0b"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  type="monotone"
                  dataKey="marginBersih"
                  name="marginBersih"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#064e3b' }}
                />
                <Line
                  type="monotone"
                  dataKey="marginKotor"
                  name="marginKotor"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ fill: '#38bdf8', r: 3 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Mini Interactive Month Selector Pills */}
      {monthlyData.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-900" />
            <span>Pilih Bulan Spesifik:</span>
          </span>
          {monthlyData.map((d) => {
            const isSelected = selectedMonth === d.month;
            return (
              <button
                key={d.month}
                type="button"
                onClick={() => onSelectMonth && onSelectMonth(d.month)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'segmented-pill-active font-bold shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{d.label}</span>
                {isSelected && <CheckCircle2 className="w-3 h-3 text-slate-950" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Optional Detailed Monthly Breakdown Table */}
      {showDataTable && (
        <div className="pt-3 border-t border-slate-800/80 overflow-x-auto">
          <div className="flex items-center justify-between pb-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-slate-900" />
              <span>Tabel Rincian Kinerja Finansial Bulanan Kalima</span>
            </h4>
            <span className="text-[11px] text-slate-400">Semua nominal dalam Rupiah (Rp)</span>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#161c28] border-b border-slate-800 text-slate-400 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Periode Bulan</th>
                <th className="py-2.5 px-2.5 text-center">Pesanan</th>
                <th className="py-2.5 px-3 text-right">Pendapatan Bersih</th>
                <th className="py-2.5 px-3 text-right">HPP</th>
                <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                <th className="py-2.5 px-3 text-right">OPEX</th>
                <th className="py-2.5 px-3 text-right">Laba Bersih</th>
                <th className="py-2.5 px-3 text-right">Nett Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredData.map((row) => {
                const isSelected = selectedMonth === row.month;
                return (
                  <tr
                    key={row.month}
                    onClick={() => onSelectMonth && onSelectMonth(row.month)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-100 text-white'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-semibold text-white flex items-center gap-1.5">
                      <span>{row.label}</span>
                      {isSelected && (
                        <span className="text-[11px] segmented-pill-active font-bold px-1.5 py-0.2 rounded font-sans">
                          Dipilih
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-slate-400 font-sans">
                      {row.orderCount}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-semibold">
                      {formatRupiah(row.pendapatan)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-700">
                      {formatRupiah(row.hpp)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-700">
                      {formatRupiah(row.labaKotor)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900">
                      {formatRupiah(row.opex)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-black ${
                        row.labaBersih >= 0 ? 'text-indigo-700' : 'text-rose-700'
                      }`}
                    >
                      {formatRupiah(row.labaBersih)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        row.marginBersih >= 0 ? 'text-indigo-700' : 'text-rose-700'
                      }`}
                    >
                      {row.marginBersih}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#161c28] border-t-2 border-slate-700 font-mono font-bold text-white">
              <tr>
                <td className="py-2.5 px-3 font-sans">Total Periode</td>
                <td className="py-2.5 px-2.5 text-center text-slate-400 font-sans">
                  {filteredData.reduce((s, r) => s + r.orderCount, 0)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900">
                  {formatRupiah(overallSummary.totalPendapatan)}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700">
                  {formatRupiah(overallSummary.totalHpp)}
                </td>
                <td className="py-2.5 px-3 text-right text-indigo-700">
                  {formatRupiah(overallSummary.totalLabaKotor)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900">
                  {formatRupiah(overallSummary.totalOpex)}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-black ${
                    overallSummary.totalLabaBersih >= 0 ? 'text-indigo-700' : 'text-rose-700'
                  }`}
                >
                  {formatRupiah(overallSummary.totalLabaBersih)}
                </td>
                <td className="py-2.5 px-3 text-right text-indigo-700">
                  {overallSummary.avgMarginBersih.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
