import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  PackageX,
  Receipt,
  ShoppingBag,
  Target,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { useApp, type AppView } from '../context/AppContext';
import { orderSortComparator } from '../types';
import {
  actionItems,
  cashFlowForMonth,
  grossMarginPercent,
  negativeStock,
  opexTotal,
  percentChange,
  periodRange,
  PERIOD_LABELS,
  salesSummary,
  stockCover,
  stockValue,
  STOCK_COVER_WINDOW_DAYS,
  topProducts,
  type ActionItemId,
  type DashboardPeriod,
} from '../services/dashboardMetrics';
import { pushPendingSearch } from '../services/searchHandoff';
import { MonthlySalesPerformanceChart } from '../components/MonthlySalesPerformanceChart';

const MONTHLY_QUOTA_PCS = 1500;
const RECENT_ORDER_COUNT = 5;

const rupiah = (value: number): string => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Teks & tujuan tiap baris "Perlu Tindakan". */
const ACTION_META: Record<ActionItemId, { label: string; hint: string; view: AppView; icon: React.ElementType; tone: string }> = {
  cancel_requests: { label: 'Permintaan batal menunggu ACC', hint: 'Buka Penjualan', view: 'sales', icon: Ban, tone: 'text-amber-700 bg-amber-50' },
  overdue: { label: 'Piutang lewat jatuh tempo', hint: 'Buka Keuangan › Piutang', view: 'finance', icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50' },
  due_soon: { label: 'Piutang jatuh tempo ≤ 7 hari', hint: 'Buka Keuangan › Piutang', view: 'finance', icon: Clock, tone: 'text-amber-700 bg-amber-50' },
  negative_stock: { label: 'SKU stok minus — perlu stock opname', hint: 'Buka Inventori', view: 'inventory', icon: PackageX, tone: 'text-rose-700 bg-rose-50' },
  low_stock: { label: 'SKU di bawah stok minimum', hint: 'Buka Inventori', view: 'inventory', icon: Package, tone: 'text-amber-700 bg-amber-50' },
  po_in_transit: { label: 'PO dalam perjalanan', hint: 'Buka Pengadaan', view: 'purchases', icon: Truck, tone: 'text-slate-700 bg-slate-100' },
};

const ChangeBadge: React.FC<{ change: number | null; previousLabel: string }> = ({ change, previousLabel }) => {
  if (change === null) {
    return <span className="hero-muted text-xs text-slate-500">Belum ada data {previousLabel}</span>;
  }
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={`hero-chip inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold tabular-nums ${
          up ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {up ? '+' : ''}
        {change}%
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
      <span className="hero-muted text-slate-500">vs {previousLabel}</span>
    </span>
  );
};

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  linkLabel: string;
  onClick: () => void;
  highlight?: boolean;
  children?: React.ReactNode;
}> = ({ icon: Icon, label, value, linkLabel, onClick, highlight = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${
      highlight ? 'card-hero' : 'bg-white border-slate-200 hover:border-slate-300'
    } group flex flex-col rounded-[20px] border text-left w-full cursor-pointer transition-colors`}
  >
    <span className="flex-1 w-full p-5 space-y-3">
      <span className="flex items-center gap-2.5">
        <span className={`hero-chip p-2 rounded-xl border ${highlight ? 'border-transparent' : 'bg-white border-slate-200 text-slate-700'}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </span>
      <span className="block text-2xl font-bold text-slate-900 tabular-nums whitespace-nowrap">{value}</span>
      <span className="block space-y-1.5">{children}</span>
    </span>
    <span className="hero-divider w-full flex items-center justify-between px-5 py-3 border-t border-slate-200 text-xs font-semibold text-slate-700">
      {linkLabel}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
  </button>
);

export const DashboardView: React.FC = () => {
  const { isOwner, orders, skus, channels, calculateStockSummary, getLowStockSKUs, setCurrentView, cashAccounts, cashMutations, purchaseOrders, biayaOperasional } = useApp();

  const [period, setPeriod] = useState<DashboardPeriod>('this_month');
  const today = todayIso();
  const range = periodRange(period, today);
  const labels = PERIOD_LABELS[period];

  const current = useMemo(() => salesSummary(orders, range.start, range.end), [orders, range.start, range.end]);
  const previous = useMemo(() => salesSummary(orders, range.prevStart, range.prevEnd), [orders, range.prevStart, range.prevEnd]);
  const margin = grossMarginPercent(current.omzet, current.laba);
  const currentOpex = useMemo(() => opexTotal(biayaOperasional, range.start, range.end), [biayaOperasional, range.start, range.end]);
  const previousOpex = useMemo(() => opexTotal(biayaOperasional, range.prevStart, range.prevEnd), [biayaOperasional, range.prevStart, range.prevEnd]);
  const netProfit = current.laba - currentOpex;
  const previousNetProfit = previous.laba - previousOpex;
  const bestSellers = useMemo(() => topProducts(orders, range.start, range.end), [orders, range.start, range.end]);

  const lastOrderDate = useMemo(
    () => orders.reduce((latest, order) => (order.statusOrder !== 'batal' && order.tanggal > latest ? order.tanggal : latest), ''),
    [orders],
  );

  const totalCash = useMemo(() => cashAccounts.reduce((sum, account) => sum + (account.saldo || 0), 0), [cashAccounts]);
  const monthCashFlow = useMemo(() => cashFlowForMonth(cashMutations, today.slice(0, 7)), [cashMutations, today]);

  const stockSummary = calculateStockSummary();
  const lowStockSKUs = getLowStockSKUs();
  const minusStock = negativeStock(stockSummary, 'gudang');
  const lowStockCount = lowStockSKUs.filter((sku) => (stockSummary[sku.sku]?.gudang ?? 0) >= 0).length;
  const totalStockGudang = Object.values(stockSummary).reduce((sum, entry) => sum + entry.gudang, 0);
  const totalStockReseller = Object.values(stockSummary).reduce((sum, entry) => sum + entry.reseller, 0);
  const stockValueTotal = useMemo(() => stockValue(skus, stockSummary, 'total'), [skus, stockSummary]);
  const coverAll = useMemo(
    () => stockCover(orders, Object.fromEntries(Object.entries(stockSummary).map(([sku, entry]) => [sku, entry.gudang])), today, { limit: Infinity }),
    [orders, stockSummary, today],
  );
  // SKU laris yang stoknya sudah 0/minus sudah tercakup di "Perlu Tindakan"; daftar ini fokus ke yang masih ada stoknya.
  const runningOut = coverAll.filter((product) => product.stock > 0).slice(0, 5);
  const soldOutBestSellers = coverAll.filter((product) => product.stock <= 0).length;
  const openPurchaseOrders = purchaseOrders.filter((po) => !['diterima', 'batal'].includes(po.statusPO));

  const actions = useMemo(
    () => actionItems({ today, orders, purchaseOrders, negativeCount: minusStock.count, lowStockCount }),
    [today, orders, purchaseOrders, minusStock.count, lowStockCount],
  );

  const channelBreakdown = useMemo(() => {
    const totals = new Map<string, { omzet: number; qty: number; count: number }>();
    channels.forEach((channel) => totals.set(channel.name, { omzet: 0, qty: 0, count: 0 }));
    for (const order of orders) {
      if (order.statusOrder === 'batal' || order.tanggal < range.start || order.tanggal > range.end) {
        continue;
      }
      const entry = totals.get(order.channel) ?? { omzet: 0, qty: 0, count: 0 };
      entry.omzet += order.totalTagihan;
      entry.qty += order.items.reduce((sum, item) => sum + item.qty, 0);
      entry.count++;
      totals.set(order.channel, entry);
    }
    return [...totals.entries()]
      .map(([name, entry]) => ({ name, ...entry }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.omzet - a.omzet);
  }, [orders, channels, range.start, range.end]);

  const recentOrders = useMemo(() => [...orders].sort(orderSortComparator).slice(0, RECENT_ORDER_COUNT), [orders]);

  const openOrder = (noOrder: string) => {
    pushPendingSearch('sales', noOrder);
    setCurrentView('sales');
  };

  const quotaPercent = Math.min(100, Math.round((current.qty / MONTHLY_QUOTA_PCS) * 100));
  const isMonthPeriod = period !== 'this_year';

  return (
    <div className="space-y-6 pb-12">
      {/* Periode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ringkasan {labels.label.toLowerCase()}</h2>
          <p className="text-xs text-slate-500">
            {range.start} s.d. {range.end}
            {current.count === 0 && lastOrderDate && <> · belum ada order; order terakhir {lastOrderDate}</>}
          </p>
        </div>
        <div className="segmented-pill-bar flex items-center gap-1" role="group" aria-label="Pilih periode">
          {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              aria-pressed={period === key}
              className={`px-3 py-1.5 text-xs rounded-full font-semibold cursor-pointer ${period === key ? 'segmented-pill-active' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {PERIOD_LABELS[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 angka utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Omzet" value={rupiah(current.omzet)} linkLabel="Lihat penjualan" onClick={() => setCurrentView('sales')} highlight>
          <ChangeBadge change={percentChange(current.omzet, previous.omzet)} previousLabel={labels.previous} />
          <span className="hero-muted block text-xs text-slate-500">{current.count} order</span>
        </KpiCard>

        {isOwner ? (
          <KpiCard icon={CheckCircle2} label="Laba Bersih" value={rupiah(netProfit)} linkLabel="Lihat laba rugi" onClick={() => setCurrentView('finance')}>
            {previousNetProfit > 0 ? (
              <ChangeBadge change={percentChange(netProfit, previousNetProfit)} previousLabel={labels.previous} />
            ) : (
              <span className="block text-xs text-slate-500">
                {labels.previous}: <span className={previousNetProfit < 0 ? 'text-rose-700 font-semibold' : ''}>{previousNetProfit < 0 ? '−' : ''}{rupiah(Math.abs(previousNetProfit))}</span>
              </span>
            )}
            <span className="block text-xs text-slate-500">
              Laba kotor {rupiah(current.laba)} (margin {margin === null ? '–' : `${margin}%`}) − OPEX {rupiah(currentOpex)}
            </span>
          </KpiCard>
        ) : (
          <KpiCard icon={ShoppingBag} label="Jumlah Order" value={`${current.count}`} linkLabel="Lihat penjualan" onClick={() => setCurrentView('sales')}>
            <ChangeBadge change={percentChange(current.count, previous.count)} previousLabel={labels.previous} />
          </KpiCard>
        )}

        <KpiCard
          icon={Target}
          label={isMonthPeriod ? 'Pcs Terjual vs Kuota' : 'Pcs Terjual'}
          value={`${current.qty.toLocaleString('id-ID')} pcs`}
          linkLabel="Lihat stok"
          onClick={() => setCurrentView('inventory')}
        >
          {isMonthPeriod ? (
            <>
              <span className="block w-full bg-slate-100 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={quotaPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Pencapaian kuota">
                <span className="block bg-indigo-600 h-full rounded-full" style={{ width: `${quotaPercent}%` }} />
              </span>
              <span className="block text-xs text-slate-500">
                {quotaPercent}% dari kuota {MONTHLY_QUOTA_PCS.toLocaleString('id-ID')} pcs
              </span>
            </>
          ) : (
            <ChangeBadge change={percentChange(current.qty, previous.qty)} previousLabel={labels.previous} />
          )}
        </KpiCard>

        <KpiCard icon={Wallet} label="Total Kas & Bank" value={rupiah(totalCash)} linkLabel="Lihat kas & bank" onClick={() => setCurrentView('finance')}>
          <span className="block text-xs text-slate-500">
            {cashAccounts.length} rekening ·{' '}
            {monthCashFlow.count === 0 ? (
              'belum ada mutasi bulan ini'
            ) : (
              <span className={monthCashFlow.net >= 0 ? 'text-indigo-700' : 'text-rose-700'}>
                arus bersih bulan ini {monthCashFlow.net >= 0 ? '+' : '−'}
                {rupiah(Math.abs(monthCashFlow.net))}
              </span>
            )}
          </span>
        </KpiCard>
      </div>

      {/* Perlu tindakan + order terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-actions">
          <h3 id="dashboard-actions" className="text-sm font-bold text-slate-900">
            Perlu Tindakan
          </h3>
          {actions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Semua beres, tidak ada yang menunggu.
            </p>
          ) : (
            <ul className="space-y-2">
              {actions.map((item) => {
                const meta = ACTION_META[item.id];
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentView(meta.view)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200/80 hover:bg-slate-50 text-left cursor-pointer"
                    >
                      <span className={`p-2 rounded-xl shrink-0 ${meta.tone}`}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{meta.label}</span>
                        <span className="block text-xs text-slate-500">
                          {item.amount !== undefined ? `${rupiah(item.amount)} · ` : ''}
                          {meta.hint}
                        </span>
                      </span>
                      <span className="text-base font-bold text-slate-900 tabular-nums">{item.count}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-3 bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-recent">
          <div className="flex items-center justify-between">
            <h3 id="dashboard-recent" className="text-sm font-bold text-slate-900">
              Order Terbaru
            </h3>
            <button type="button" onClick={() => setCurrentView('sales')} className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer">
              Semua order <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <button type="button" onClick={() => openOrder(order.noOrder)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-xl px-2 cursor-pointer">
                  <Receipt className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 whitespace-nowrap">{order.noOrder}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {order.tanggal} · {order.channel} · {order.customerNama || 'Customer Umum'}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">{rupiah(order.totalTagihan)}</span>
                    <span className={`block text-xs font-semibold ${order.statusOrder === 'batal' ? 'text-slate-500' : order.statusBayar === 'lunas' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {order.statusOrder === 'batal' ? 'Batal' : order.statusBayar === 'lunas' ? 'Lunas' : 'Belum lunas'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Produk terlaris + stok laris hampir habis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-bestsellers">
          <div className="flex items-center justify-between gap-2">
            <h3 id="dashboard-bestsellers" className="text-sm font-bold text-slate-900">
              Produk Terlaris · {labels.label}
            </h3>
            <button type="button" onClick={() => setCurrentView('products')} className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer">
              Master SKU <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          {bestSellers.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada penjualan di periode ini.</p>
          ) : (
            <ol className="space-y-2.5">
              {bestSellers.map((product, index) => {
                const share = Math.round((product.qty / bestSellers[0].qty) * 100);
                return (
                  <li key={product.sku} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-slate-500 tabular-nums mr-1.5">{index + 1}.</span>
                        <span className="font-semibold text-slate-900">{product.label}</span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums whitespace-nowrap">
                        <span className="font-bold text-slate-900">{product.qty} pcs</span>
                        <span className="text-xs text-slate-500"> · {rupiah(product.omzet)}</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-runningout">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 id="dashboard-runningout" className="text-sm font-bold text-slate-900">
                Stok Laris Hampir Habis
              </h3>
              <p className="text-xs text-slate-500">Stok gudang ÷ rata-rata penjualan {STOCK_COVER_WINDOW_DAYS} hari terakhir</p>
            </div>
            <button type="button" onClick={() => setCurrentView('purchases')} className="shrink-0 text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer">
              Buat PO <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          {soldOutBestSellers > 0 && (
            <button
              type="button"
              onClick={() => setCurrentView('inventory')}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold text-left cursor-pointer hover:underline"
            >
              {soldOutBestSellers} SKU yang laku {STOCK_COVER_WINDOW_DAYS} hari terakhir stoknya sudah habis atau minus
              <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
          {runningOut.length === 0 ? (
            <p className="text-sm text-slate-500">
              {coverAll.length === 0 ? `Belum ada penjualan dalam ${STOCK_COVER_WINDOW_DAYS} hari terakhir.` : 'Tidak ada SKU laris yang masih berstok.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {runningOut.map((product) => {
                const tone =
                  product.daysLeft <= 7 ? 'bg-rose-50 text-rose-700' : product.daysLeft <= 30 ? 'bg-amber-50 text-amber-800' : 'bg-indigo-100 text-indigo-800';
                return (
                  <li key={product.sku} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 truncate">{product.label}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">
                        Stok {product.stock.toLocaleString('id-ID')} pcs · terjual {product.sold} pcs / {STOCK_COVER_WINDOW_DAYS} hari
                      </span>
                    </span>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums whitespace-nowrap ${tone}`}>
                      {product.daysLeft > 365 ? '> 1 tahun' : `± ${product.daysLeft} hari`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Tren bulanan */}
      <MonthlySalesPerformanceChart orders={orders} channels={channels} isOwner={isOwner} />

      {/* Channel + stok */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-channels">
          <h3 id="dashboard-channels" className="text-sm font-bold text-slate-900">
            Penjualan per Channel · {labels.label}
          </h3>
          {channelBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada penjualan di periode ini.</p>
          ) : (
            <ul className="space-y-3">
              {channelBreakdown.map((channel) => {
                const share = current.omzet > 0 ? Math.round((channel.omzet / current.omzet) * 100) : 0;
                return (
                  <li key={channel.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-800">
                        {channel.name} <span className="text-xs font-normal text-slate-500">· {channel.count} order · {channel.qty} pcs</span>
                      </span>
                      <span className="font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {rupiah(channel.omzet)} <span className="text-xs font-normal text-slate-500">({share}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 bg-white p-5 rounded-[20px] border border-slate-200 space-y-3" aria-labelledby="dashboard-stock">
          <div className="flex items-center justify-between">
            <h3 id="dashboard-stock" className="text-sm font-bold text-slate-900">
              Stok & Pembelian
            </h3>
            <button type="button" onClick={() => setCurrentView('inventory')} className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer">
              Inventori <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-2xl bg-slate-50">
              <dt className="text-xs text-slate-500">Stok gudang</dt>
              <dd className="font-bold text-slate-900 tabular-nums">{totalStockGudang.toLocaleString('id-ID')} pcs</dd>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50">
              <dt className="text-xs text-slate-500">Di reseller</dt>
              <dd className="font-bold text-slate-900 tabular-nums">{totalStockReseller.toLocaleString('id-ID')} pcs</dd>
            </div>
            {isOwner && (
              <div className="p-3 rounded-2xl bg-slate-50">
                <dt className="text-xs text-slate-500" title="Stok gudang + reseller × HPP; SKU stok minus tidak dihitung">Nilai HPP stok</dt>
                <dd className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{rupiah(stockValueTotal)}</dd>
              </div>
            )}
            <div className="p-3 rounded-2xl bg-slate-50">
              <dt className="text-xs text-slate-500">PO berjalan</dt>
              <dd className="font-bold text-slate-900 tabular-nums">{openPurchaseOrders.length} PO</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
};
