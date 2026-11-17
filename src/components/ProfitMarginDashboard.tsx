import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Percent,
  Layers,
  Store,
  DollarSign,
  Info,
  PieChart as PieChartIcon,
  BarChart3,
  Award,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Order, ProductSeries, SKUItem, SalesChannel } from '../types';

interface ProfitMarginDashboardProps {
  orders: Order[];
  series: ProductSeries[];
  skus: SKUItem[];
  channels: SalesChannel[];
  isOwner: boolean;
}

export interface ProductChartItem {
  id: string;
  name: string;
  subLabel: string;
  qty: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  profitPerPcs: number;
  avgSellingPrice: number;
  avgUnitHpp: number;
}

export interface ChannelMarginItem {
  channel: string;
  ordersCount: number;
  qty: number;
  omzetKotor: number;
  diskon: number;
  omzetBersih: number;
  hpp: number;
  adminFee: number;
  labaKotor: number;
  marginPercent: number;
  feePercent: number;
  profitPerPcs: number;
  color: string;
}

// Color palettes for charts
const PALETTE = {
  emerald: '#10b981',
  emeraldLight: '#34d399',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  rose: '#f43f5e',
  slateDark: '#1e293b',
  slateMuted: '#64748b',
};

const CHANNEL_COLORS: Record<string, string> = {
  TAPADA: '#10b981', // emerald
  Shopee: '#f97316', // orange
  TikTok: '#ec4899', // pink/rose
  Umum: '#3b82f6', // blue
  Reseller: '#eab308', // amber
  Internal: '#8b5cf6', // purple
  Marketing: '#06b6d4', // cyan
};

const PIE_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

export const ProfitMarginDashboard: React.FC<ProfitMarginDashboardProps> = ({
  orders,
  series,
  skus,
  channels,
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'channels' | 'comparison'>('products');
  const [productViewMode, setProductViewMode] = useState<'series' | 'sku'>('series');
  const [metricMode, setMetricMode] = useState<'nominal' | 'margin'>('nominal');

  // 1. COMPUTATION: Per Product / Series
  const seriesMarginData: ProductChartItem[] = useMemo(() => {
    const seriesMap: Record<
      string,
      {
        code: string;
        name: string;
        gsm: number;
        qty: number;
        grossRevenue: number;
        netRevenue: number;
        cogs: number;
        defaultPrice: number;
        defaultHpp: number;
      }
    > = {};

    series.forEach((s) => {
      seriesMap[s.code] = {
        code: s.code,
        name: s.name,
        gsm: s.gsm,
        qty: 0,
        grossRevenue: 0,
        netRevenue: 0,
        cogs: 0,
        defaultPrice: s.defaultPrice,
        defaultHpp: s.baseCost,
      };
    });

    orders.forEach((o) => {
      const discountRatio = o.subtotal > 0 ? (o.subtotal - o.diskon) / o.subtotal : 1;

      o.items.forEach((item) => {
        const skuInfo = skus.find((s) => s.sku === item.sku);
        const sCode = skuInfo?.seriesCode || (item.sku.includes('290') ? '290OV' : item.sku.includes('185') ? '185RG' : item.sku.includes('BAG') ? 'BAG' : '210OV');
        const serObj = series.find((s) => s.code === sCode);

        if (!seriesMap[sCode]) {
          seriesMap[sCode] = {
            code: sCode,
            name: serObj?.name || (sCode === 'BAG' ? 'Goodie Bag / Merchandise' : sCode),
            gsm: serObj?.gsm || 0,
            qty: 0,
            grossRevenue: 0,
            netRevenue: 0,
            cogs: 0,
            defaultPrice: item.hargaSatuan,
            defaultHpp: item.hppSatuan,
          };
        }

        const isApparel = sCode === '210OV' || sCode === '290OV' || sCode === '185RG';
        let unitHpp = item.hppSatuan;
        if (!unitHpp || (isApparel && unitHpp < 20000)) {
          unitHpp = skuInfo?.hpp ?? (serObj ? serObj.baseCost + 9500 : (sCode === '290OV' ? 74500 : sCode === '185RG' ? 45500 : 57500));
        }

        const itemGrossRev = item.subtotal;
        const itemNetRev = itemGrossRev * discountRatio;
        const itemCogs = item.qty * unitHpp;

        seriesMap[sCode].qty += item.qty;
        seriesMap[sCode].grossRevenue += itemGrossRev;
        seriesMap[sCode].netRevenue += itemNetRev;
        seriesMap[sCode].cogs += itemCogs;
      });
    });

    return Object.values(seriesMap).map((item) => {
      const grossProfit = item.netRevenue - item.cogs;
      const marginPercent = item.netRevenue > 0 ? (grossProfit / item.netRevenue) * 100 : 0;
      return {
        id: item.code,
        name: item.name,
        subLabel: `${item.code} ${item.gsm ? `(${item.gsm} GSM)` : ''}`,
        qty: item.qty,
        netRevenue: Math.round(item.netRevenue),
        cogs: Math.round(item.cogs),
        grossProfit: Math.round(grossProfit),
        marginPercent: Number(marginPercent.toFixed(1)),
        avgSellingPrice: item.qty > 0 ? Math.round(item.netRevenue / item.qty) : item.defaultPrice,
        avgUnitHpp: item.qty > 0 ? Math.round(item.cogs / item.qty) : item.defaultHpp,
        profitPerPcs: item.qty > 0 ? Math.round(grossProfit / item.qty) : 0,
      };
    });
  }, [orders, series, skus]);

  // 2. COMPUTATION: Per Top SKUs
  const skuMarginData: ProductChartItem[] = useMemo(() => {
    const skuMap: Record<
      string,
      {
        sku: string;
        name: string;
        seriesCode: string;
        colorName: string;
        size: string;
        qty: number;
        revenue: number;
        cogs: number;
      }
    > = {};

    orders.forEach((o) => {
      const discountRatio = o.subtotal > 0 ? (o.subtotal - o.diskon) / o.subtotal : 1;

      o.items.forEach((item) => {
        const skuInfo = skus.find((s) => s.sku === item.sku);
        const sCode = skuInfo?.seriesCode || (item.sku.includes('290') ? '290OV' : item.sku.includes('185') ? '185RG' : item.sku.includes('BAG') ? 'BAG' : '210OV');
        const serObj = series.find((s) => s.code === sCode);

        if (!skuMap[item.sku]) {
          skuMap[item.sku] = {
            sku: item.sku,
            name: item.namaProduk,
            seriesCode: sCode,
            colorName: item.colorName,
            size: item.size,
            qty: 0,
            revenue: 0,
            cogs: 0,
          };
        }

        const isApparel = sCode === '210OV' || sCode === '290OV' || sCode === '185RG';
        let unitHpp = item.hppSatuan;
        if (!unitHpp || (isApparel && unitHpp < 20000)) {
          unitHpp = skuInfo?.hpp ?? (serObj ? serObj.baseCost + 9500 : (sCode === '290OV' ? 74500 : sCode === '185RG' ? 45500 : 57500));
        }

        const netRev = item.subtotal * discountRatio;
        const itemCogs = item.qty * unitHpp;

        skuMap[item.sku].qty += item.qty;
        skuMap[item.sku].revenue += netRev;
        skuMap[item.sku].cogs += itemCogs;
      });
    });

    return Object.values(skuMap)
      .map((item) => {
        const profit = item.revenue - item.cogs;
        const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
        return {
          id: item.sku,
          name: item.name,
          subLabel: item.sku,
          qty: item.qty,
          netRevenue: Math.round(item.revenue),
          cogs: Math.round(item.cogs),
          grossProfit: Math.round(profit),
          marginPercent: Number(margin.toFixed(1)),
          profitPerPcs: item.qty > 0 ? Math.round(profit / item.qty) : 0,
          avgSellingPrice: item.qty > 0 ? Math.round(item.revenue / item.qty) : 0,
          avgUnitHpp: item.qty > 0 ? Math.round(item.cogs / item.qty) : 0,
        };
      })
      .sort((a, b) => b.netRevenue - a.netRevenue)
      .slice(0, 8); // Top 8 SKUs
  }, [orders, skus]);

  // Unified active product chart data
  const activeProductChartData: ProductChartItem[] = useMemo(() => {
    return productViewMode === 'series' ? seriesMarginData : skuMarginData;
  }, [productViewMode, seriesMarginData, skuMarginData]);

  // 3. COMPUTATION: Per Sales Channel
  const channelMarginData: ChannelMarginItem[] = useMemo(() => {
    const channelMap: Record<
      string,
      {
        channel: string;
        ordersCount: number;
        qty: number;
        omzetKotor: number;
        diskon: number;
        omzetBersih: number;
        hpp: number;
        adminFee: number;
        labaKotor: number;
        color: string;
      }
    > = {};

    channels.forEach((ch) => {
      channelMap[ch.name] = {
        channel: ch.name,
        ordersCount: 0,
        qty: 0,
        omzetKotor: 0,
        diskon: 0,
        omzetBersih: 0,
        hpp: 0,
        adminFee: 0,
        labaKotor: 0,
        color: CHANNEL_COLORS[ch.name] || '#94a3b8',
      };
    });

    orders.forEach((o) => {
      if (!channelMap[o.channel]) {
        channelMap[o.channel] = {
          channel: o.channel,
          ordersCount: 0,
          qty: 0,
          omzetKotor: 0,
          diskon: 0,
          omzetBersih: 0,
          hpp: 0,
          adminFee: 0,
          labaKotor: 0,
          color: CHANNEL_COLORS[o.channel] || '#94a3b8',
        };
      }

      const orderQty = o.items.reduce((s, it) => s + it.qty, 0);
      const omzetBersihOrder = o.subtotal - o.diskon;

      channelMap[o.channel].ordersCount += 1;
      channelMap[o.channel].qty += orderQty;
      channelMap[o.channel].omzetKotor += o.subtotal;
      channelMap[o.channel].diskon += o.diskon;
      channelMap[o.channel].omzetBersih += omzetBersihOrder;
      channelMap[o.channel].hpp += o.totalHpp;
      channelMap[o.channel].adminFee += o.adminFeeAmount;
      channelMap[o.channel].labaKotor += o.labaKotor;
    });

    return Object.values(channelMap).map((item) => {
      const margin = item.omzetBersih > 0 ? (item.labaKotor / item.omzetBersih) * 100 : 0;
      const feeRatio = item.omzetBersih > 0 ? (item.adminFee / item.omzetBersih) * 100 : 0;
      return {
        ...item,
        marginPercent: Number(margin.toFixed(1)),
        feePercent: Number(feeRatio.toFixed(1)),
        profitPerPcs: item.qty > 0 ? Math.round(item.labaKotor / item.qty) : 0,
      };
    });
  }, [channels, orders]);

  // Overall Business Margin Summary KPIs
  const overallSummary = useMemo(() => {
    const totalOmzetBersih = channelMarginData.reduce((s, c) => s + c.omzetBersih, 0);
    const totalHpp = channelMarginData.reduce((s, c) => s + c.hpp, 0);
    const totalAdminFee = channelMarginData.reduce((s, c) => s + c.adminFee, 0);
    const totalLabaKotor = channelMarginData.reduce((s, c) => s + c.labaKotor, 0);
    const totalQty = channelMarginData.reduce((s, c) => s + c.qty, 0);

    const overallMargin = totalOmzetBersih > 0 ? (totalLabaKotor / totalOmzetBersih) * 100 : 0;
    const feeImpact = totalOmzetBersih > 0 ? (totalAdminFee / totalOmzetBersih) * 100 : 0;

    // Best series
    const activeSeries = seriesMarginData.filter((s) => s.qty > 0);
    const highestMarginSeries =
      activeSeries.length > 0
        ? [...activeSeries].sort((a, b) => b.marginPercent - a.marginPercent)[0]
        : null;

    // Best and lowest channel
    const activeChannels = channelMarginData.filter((c) => c.omzetBersih > 0);
    const highestMarginChannel =
      activeChannels.length > 0
        ? [...activeChannels].sort((a, b) => b.marginPercent - a.marginPercent)[0]
        : null;

    const highestProfitChannel =
      activeChannels.length > 0
        ? [...activeChannels].sort((a, b) => b.labaKotor - a.labaKotor)[0]
        : null;

    return {
      totalOmzetBersih,
      totalHpp,
      totalAdminFee,
      totalLabaKotor,
      totalQty,
      overallMargin: Number(overallMargin.toFixed(1)),
      feeImpact: Number(feeImpact.toFixed(1)),
      highestMarginSeries,
      highestMarginChannel,
      highestProfitChannel,
    };
  }, [channelMarginData, seriesMarginData]);

  // Custom Dark Tooltip Component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f172a] border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[200px]">
          <div className="font-bold text-slate-100 border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
          </div>
          {payload.map((entry: any, index: number) => {
            const isPercent =
              String(entry.name).toLowerCase().includes('margin') ||
              String(entry.name).includes('%');
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-slate-400">{entry.name}:</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {isPercent
                    ? `${entry.value}%`
                    : `Rp ${Number(entry.value).toLocaleString('id-ID')}`}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Pie chart data for profit contribution
  const profitContributionData = useMemo(() => {
    return channelMarginData
      .filter((c) => c.labaKotor > 0)
      .map((c) => ({
        name: c.channel,
        value: c.labaKotor,
        color: c.color,
      }));
  }, [channelMarginData]);

  return (
    <div className="bg-[#121620] rounded-2xl border border-slate-800/80 p-5 space-y-6 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Dashboard Analisis Margin Profit
            </h2>
            <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono font-semibold">
              Recharts Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Komparasi margin kotor (Gross Margin), efisiensi HPP kaos Kalima, dan potongan fee channel
          </p>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Margin Produk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'channels'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Margin Channel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Ringkasan Matriks</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Rata-Rata Margin Bisnis */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Gross Margin Rata-rata</span>
            <Percent className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {overallSummary.overallMargin}%
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Laba Kotor Total:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              Rp {overallSummary.totalLabaKotor.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Card 2: Lini Produk Terbaik */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Produk Margin Tertinggi</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white truncate">
            {overallSummary.highestMarginSeries?.name || '-'}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Margin:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {overallSummary.highestMarginSeries?.marginPercent || 0}%
            </span>
          </div>
        </div>

        {/* Card 3: Channel Paling Efisien */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Channel Margin Tertinggi</span>
            <Store className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white truncate">
            {overallSummary.highestMarginChannel?.channel || '-'}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Margin Bersih:</span>
            <span className="font-mono text-blue-400 font-bold">
              {overallSummary.highestMarginChannel?.marginPercent || 0}%
            </span>
          </div>
        </div>

        {/* Card 4: Potongan Fee Marketplace */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Fee Admin Marketplace</span>
            <DollarSign className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
            Rp {overallSummary.totalAdminFee.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Beban ke Omzet:</span>
            <span className="font-mono text-rose-300 font-semibold">
              {overallSummary.feeImpact}% dari penjualan
            </span>
          </div>
        </div>
      </div>

      {/* TAB 1: PRODUCT MARGIN ANALYSIS */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          {/* Controls: Series vs SKU view & Metric toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Tingkat Detail:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setProductViewMode('series')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    productViewMode === 'series'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3 Lini Seri Kaos
                </button>
                <button
                  type="button"
                  onClick={() => setProductViewMode('sku')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    productViewMode === 'sku'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Top SKU Terjual
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Metrik Chart:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMetricMode('nominal')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    metricMode === 'nominal'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Rupiah (Omzet vs HPP vs Laba)
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('margin')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    metricMode === 'margin'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Persentase Margin (%)
                </button>
              </div>
            </div>
          </div>

          {/* Main Product Chart */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                  {productViewMode === 'series'
                    ? 'Grafik Profitabilitas Berdasarkan Lini Produk (Series)'
                    : 'Grafik Profitabilitas Top SKU Produk Terjual'}
                </h3>
                <p className="text-xs text-slate-400">
                  {metricMode === 'nominal'
                    ? 'Menampilkan perbandingan Omzet Penjualan, Biaya Modal (HPP), dan Laba Kotor'
                    : 'Menampilkan margin keuntungan kotor (%) per varian'}
                </p>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {metricMode === 'nominal' ? (
                  <ComposedChart
                    data={activeProductChartData}
                    margin={{ top: 15, right: 20, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey={productViewMode === 'series' ? 'name' : 'id'}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="netRevenue"
                      name="Omzet Bersih"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="cogs"
                      name="HPP (Modal)"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="grossProfit"
                      name="Laba Kotor"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                ) : (
                  <BarChart
                    data={activeProductChartData}
                    margin={{ top: 15, right: 20, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey={productViewMode === 'series' ? 'name' : 'id'}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="marginPercent"
                      name="Margin Profit (%)"
                      radius={[6, 6, 0, 0]}
                    >
                      {activeProductChartData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={
                            entry.marginPercent >= 50
                              ? PALETTE.emerald
                              : entry.marginPercent >= 35
                              ? PALETTE.amber
                              : PALETTE.rose
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Margin Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Rincian Kalkulasi Unit Economics per {productViewMode === 'series' ? 'Seri' : 'SKU'}
              </span>
              <span className="text-xs text-slate-400">
                Formula: Laba Kotor = Omzet Bersih - HPP (Bahan + Sablon + Aksesoris)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/90 font-medium">
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3 text-right">Volume (Qty)</th>
                    <th className="py-2.5 px-3 text-right">Omzet Bersih</th>
                    <th className="py-2.5 px-3 text-right">HPP (Modal)</th>
                    <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                    <th className="py-2.5 px-3 text-right">Laba/Pcs</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {activeProductChartData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-100">{item.name}</div>
                        <div className="text-[11px] text-amber-400/80 font-mono">
                          {item.subLabel}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {item.qty} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        Rp {item.netRevenue.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                        Rp {item.cogs.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        Rp {item.grossProfit.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        Rp {item.profitPerPcs.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400">
                        {item.marginPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.marginPercent >= 50
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : item.marginPercent >= 35
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {item.marginPercent >= 50
                            ? 'Sangat Tinggi'
                            : item.marginPercent >= 35
                            ? 'Stabil'
                            : 'Tipis'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES CHANNEL MARGIN ANALYSIS */}
      {activeTab === 'channels' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Waterfall Bar Chart of Channel Profitability */}
            <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    Komparasi Margin Bersih per Channel Penjualan
                  </h3>
                  <p className="text-xs text-slate-400">
                    Laba Bersih Kanal = Omzet - HPP Kaos - Biaya Potongan Admin Marketplace
                  </p>
                </div>
              </div>

              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={channelMarginData}
                    margin={{ top: 15, right: 20, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="channel"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f59e0b"
                      fontSize={10}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      iconType="circle"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="omzetBersih"
                      name="Omzet Bersih"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="adminFee"
                      name="Admin Fee Channel"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="labaKotor"
                      name="Laba Kotor Kanal"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="marginPercent"
                      name="Margin Kanal (%)"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#f59e0b' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right 1 Col: Donut Profit Contribution per Channel */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide">
                  <PieChartIcon className="w-4 h-4 text-amber-400" />
                  <span>Kontribusi Laba Bersih Kanal</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Porsi nominal rupiah laba kotor yang dihasilkan per kanal
                </p>
              </div>

              <div style={{ width: '100%', height: 230 }}>
                {profitContributionData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Belum ada data laba pada periode ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={profitContributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {profitContributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Channel Mini Badges */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800">
                {channelMarginData.slice(0, 4).map((c) => (
                  <div
                    key={c.channel}
                    className="p-1.5 bg-slate-900 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-slate-300 truncate">{c.channel}</span>
                    </div>
                    <span className="font-mono text-amber-400 font-bold ml-1">
                      {c.marginPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel Detail Breakdown Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Tabel Analisis Struktur Biaya & Margin Tiap Channel
              </span>
              <span className="text-xs text-slate-400">
                Memperhitungkan komisi Shopee (7.5%), TikTok (8.0%), TAPADA (2.5%), & Direct WhatsApp
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/90 font-medium">
                    <th className="py-2.5 px-3">Kanal Penjualan</th>
                    <th className="py-2.5 px-3 text-right">Order / Qty</th>
                    <th className="py-2.5 px-3 text-right">Omzet Kotor</th>
                    <th className="py-2.5 px-3 text-right">Diskon Toko</th>
                    <th className="py-2.5 px-3 text-right">HPP Kaos</th>
                    <th className="py-2.5 px-3 text-right">Admin Fee</th>
                    <th className="py-2.5 px-3 text-right">Fee Ratio %</th>
                    <th className="py-2.5 px-3 text-right">Laba Bersih Kanal</th>
                    <th className="py-2.5 px-3 text-right">Margin Bersih %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {channelMarginData.map((ch) => (
                    <tr key={ch.channel} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ch.color }}
                          />
                          <span className="font-semibold text-slate-100">{ch.channel}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {ch.ordersCount} ord · {ch.qty} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        Rp {ch.omzetKotor.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {ch.diskon > 0 ? `Rp ${ch.diskon.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                        Rp {ch.hpp.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-300">
                        {ch.adminFee > 0 ? `Rp ${ch.adminFee.toLocaleString('id-ID')}` : 'Rp 0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {ch.feePercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        Rp {ch.labaKotor.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400">
                        {ch.marginPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STRATEGIC COMPARISON & INSIGHTS */}
      {activeTab === 'comparison' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box 1: Product Efficiency Ranking */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  Peringkat Efisiensi Margin Seri Kaos
                </span>
                <span className="text-xs text-amber-400 font-mono">Sorted by Margin %</span>
              </div>

              <div className="space-y-2">
                {[...seriesMarginData]
                  .sort((a, b) => b.marginPercent - a.marginPercent)
                  .map((s, idx) => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white">{s.name}</div>
                          <div className="text-xs text-slate-400">
                            Harga Jual Rata-rata: Rp {s.avgSellingPrice.toLocaleString('id-ID')} ·
                            HPP: Rp {s.avgUnitHpp.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black text-amber-400 font-mono">
                          {s.marginPercent}%
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          +Rp {s.profitPerPcs.toLocaleString('id-ID')} / pcs
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Box 2: Channel Profitability Ranking */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  Peringkat Efisiensi Saluran Penjualan
                </span>
                <span className="text-xs text-emerald-400 font-mono">Net Profit Contribution</span>
              </div>

              <div className="space-y-2">
                {[...channelMarginData]
                  .sort((a, b) => b.labaKotor - a.labaKotor)
                  .map((ch, idx) => (
                    <div
                      key={ch.channel}
                      className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white">{ch.channel}</div>
                          <div className="text-xs text-slate-400">
                            Fee Admin: {ch.feePercent}% · Terjual {ch.qty} pcs ({ch.ordersCount}{' '}
                            order)
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          Rp {ch.labaKotor.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[11px] text-amber-400 font-mono">
                          Margin: {ch.marginPercent}%
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Strategic Insight Callout */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-800/40 flex items-start gap-3 text-xs">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Insight & Rekomendasi Optimasi Margin Kalima:
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                • <strong>Kanal Langsung & Konsinyasi:</strong> Penjualan melalui kanal{' '}
                <span className="text-white font-semibold">TAPADA</span> dan{' '}
                <span className="text-white font-semibold">Umum (Direct WhatsApp)</span> menghasilkan
                margin kotor paling optimal karena minim potongan biaya pihak ketiga (admin fee 0% -
                2.5%).
                <br />• <strong>Marketplace (Shopee & TikTok):</strong> Memiliki perputaran volume
                cepat, namun terbebani fee admin sebesar 7.5% - 8.0%. Disarankan menjaga strategi harga
                atau bundle set untuk mempertahankan margin di atas 40%.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
