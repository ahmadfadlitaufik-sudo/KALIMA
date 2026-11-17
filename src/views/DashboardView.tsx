import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
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
  percentChange,
  periodRange,
  PERIOD_LABELS,
  salesSummary,
  stockValue,
  type ActionItemId,
  type DashboardPeriod,
} from '../services/dashboardMetrics';
import { pushPendingSearch } from '../services/searchHandoff';
import { MonthlySalesPerformanceChart } from '../components/MonthlySalesPerformanceChart';

const MONTHLY_QUOTA_PCS = 1500;
const RECENT_ORDER_COUNT = 6;

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
    return <span className="text-xs text-slate-500">Belum ada data {previousLabel}</span>;
  }
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {up ? '+' : ''}
      {change}% <span className="font-normal text-slate-500">vs {previousLabel}</span>
    </span>
  );
};

const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: string; children?: React.ReactNode; onClick?: () => void }> = ({
  icon: Icon,
  label,
  value,
  children,
  onClick,
}) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums whitespace-nowrap">{value}</div>
      <div className="space-y-1">{children}</div>
    </>
  );
  const className = 'bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 text-left w-full';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-indigo-300 transition-colors cursor-pointer`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
};

export const DashboardView: React.FC = () => {
  const { isOwner, orders, skus, channels, calculateStockSummary, getLowStockSKUs, setCurrentView, cashAccounts, cashMutations, purchaseOrders } = useApp();

  const [period, setPeriod] = useState<DashboardPeriod>('this_month');
  const today = todayIso();
  const range = periodRange(period, today);
  const labels = PERIOD_LABELS[period];

  const current = useMemo(() => salesSummary(orders, range.start, range.end), [orders, range.start, range.end]);
  const previous = useMemo(() => salesSummary(orders, range.prevStart, range.prevEnd), [orders, range.prevStart, range.prevEnd]);
  const margin = grossMarginPercent(current.omzet, current.laba);

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
  const stockValueGudang = useMemo(() => stockValue(skus, stockSummary, 'gudang'), [skus, stockSummary]);
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
        <KpiCard icon={TrendingUp} label="Omzet" value={rupiah(current.omzet)} onClick={() => setCurrentView('sales')}>
          <ChangeBadge change={percentChange(current.omzet, previous.omzet)} previousLabel={labels.previous} />
          <p className="text-xs text-slate-500">{current.count} order</p>
        </KpiCard>

        {isOwner ? (
          <KpiCard icon={CheckCircle2} label="Laba Kotor" value={rupiah(current.laba)}>
            <ChangeBadge change={percentChange(current.laba, previous.laba)} previousLabel={labels.previous} />
            <p className="text-xs text-slate-500">Margin {margin === null ? '–' : `${margin}%`}</p>
          </KpiCard>
        ) : (
          <KpiCard icon={ShoppingBag} label="Jumlah Order" value={`${current.count}`}>
            <ChangeBadge change={percentChange(current.count, previous.count)} previousLabel={labels.previous} />
          </KpiCard>
        )}

        <KpiCard icon={Target} label={isMonthPeriod ? 'Pcs Terjual vs Kuota' : 'Pcs Terjual'} value={`${current.qty.toLocaleString('id-ID')} pcs`}>
          {isMonthPeriod ? (
            <>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={quotaPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Pencapaian kuota">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${quotaPercent}%` }} />
              </div>
              <p className="text-xs text-slate-500">
                {quotaPercent}% dari kuota {MONTHLY_QUOTA_PCS.toLocaleString('id-ID')} pcs
              </p>
            </>
          ) : (
            <ChangeBadge change={percentChange(current.qty, previous.qty)} previousLabel={labels.previous} />
          )}
        </KpiCard>

        <KpiCard icon={Wallet} label="Total Kas & Bank" value={rupiah(totalCash)} onClick={() => setCurrentView('finance')}>
          <p className="text-xs text-slate-500">
            {cashAccounts.length} rekening ·{' '}
            {monthCashFlow.count === 0 ? (
              'belum ada mutasi bulan ini'
            ) : (
              <span className={monthCashFlow.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                arus bersih bulan ini {monthCashFlow.net >= 0 ? '+' : '−'}
                {rupiah(Math.abs(monthCashFlow.net))}
              </span>
            )}
          </p>
        </KpiCard>
      </div>

      {/* Perlu tindakan + order terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3" aria-labelledby="dashboard-actions">
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

        <section className="lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3" aria-labelledby="dashboard-recent">
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

      {/* Tren bulanan */}
      <MonthlySalesPerformanceChart orders={orders} channels={channels} isOwner={isOwner} />

      {/* Channel + stok */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3" aria-labelledby="dashboard-channels">
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

        <section className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3" aria-labelledby="dashboard-stock">
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
                <dt className="text-xs text-slate-500">Nilai HPP stok gudang</dt>
                <dd className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{rupiah(stockValueGudang)}</dd>
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
