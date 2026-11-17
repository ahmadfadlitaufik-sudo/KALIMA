/** Angka ringkasan dashboard & inventori, dihitung dari data nyata. */

type StockEntry = { total: number; gudang: number };
type StockField = keyof StockEntry;

/** Kas masuk & keluar pada bulan `YYYY-MM` (pindah saldo antar-akun tidak dihitung). */
export const cashFlowForMonth = (
  mutations: { tanggal: string; tipe: 'masuk' | 'keluar' | 'transfer'; jumlah: number }[],
  month: string,
): { masuk: number; keluar: number; net: number; count: number } => {
  let masuk = 0;
  let keluar = 0;
  let count = 0;
  for (const mutation of mutations) {
    if (!mutation.tanggal.startsWith(month) || mutation.tipe === 'transfer') {
      continue;
    }
    count++;
    if (mutation.tipe === 'masuk') {
      masuk += mutation.jumlah;
    } else {
      keluar += mutation.jumlah;
    }
  }
  return { masuk, keluar, net: masuk - keluar, count };
};

/** Margin kotor dalam persen (dibulatkan), atau null bila belum ada penjualan. */
export const grossMarginPercent = (omzet: number, labaKotor: number): number | null =>
  omzet > 0 ? Math.round((labaKotor / omzet) * 100) : null;

/** Jumlah pcs terjual pada bulan `YYYY-MM`, tanpa order batal. */
export const qtySoldInMonth = (
  orders: { tanggal: string; statusOrder: string; items: { qty: number }[] }[],
  month: string,
): number =>
  orders
    .filter((order) => order.statusOrder !== 'batal' && order.tanggal.startsWith(month))
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);

/** SKU yang stoknya di bawah nol dan total kekurangannya (angka negatif). */
export const negativeStock = (summary: Record<string, StockEntry>, field: StockField): { count: number; pcs: number } => {
  let count = 0;
  let pcs = 0;
  for (const entry of Object.values(summary)) {
    if (entry[field] < 0) {
      count++;
      pcs += entry[field];
    }
  }
  return { count, pcs };
};

/** Nilai HPP stok yang benar-benar ada (stok minus tidak dihitung), dibulatkan ke rupiah. */
export const stockValue = (skus: { sku: string; hpp: number }[], summary: Record<string, StockEntry>, field: StockField): number =>
  Math.round(skus.reduce((sum, sku) => sum + Math.max(0, summary[sku.sku]?.[field] ?? 0) * (sku.hpp || 0), 0));

export type DashboardPeriod = 'this_month' | 'last_month' | 'this_year';

export const PERIOD_LABELS: Record<DashboardPeriod, { label: string; previous: string }> = {
  this_month: { label: 'Bulan ini', previous: 'bulan lalu' },
  last_month: { label: 'Bulan lalu', previous: '2 bulan lalu' },
  this_year: { label: 'Tahun ini', previous: 'periode sama tahun lalu' },
};

const pad = (value: number): string => String(value).padStart(2, '0');
const monthStart = (year: number, month: number): string => {
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
};
const monthEnd = (year: number, month: number): string => {
  const date = new Date(Date.UTC(year, month + 1, 0));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** Rentang tanggal (YYYY-MM-DD, inklusif) untuk periode dan periode pembandingnya. */
export const periodRange = (
  period: DashboardPeriod,
  today: string,
): { start: string; end: string; prevStart: string; prevEnd: string } => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  if (period === 'this_year') {
    return { start: `${year}-01-01`, end: today, prevStart: `${year - 1}-01-01`, prevEnd: `${year - 1}${today.slice(4)}` };
  }
  const offset = period === 'last_month' ? 1 : 0;
  return {
    start: monthStart(year, month - offset),
    end: monthEnd(year, month - offset),
    prevStart: monthStart(year, month - offset - 1),
    prevEnd: monthEnd(year, month - offset - 1),
  };
};

/** Omzet, laba kotor, pcs, dan jumlah order (tanpa batal) di antara dua tanggal. */
export const salesSummary = (
  orders: { tanggal: string; statusOrder: string; totalTagihan: number; labaKotor: number; items: { qty: number }[] }[],
  start: string,
  end: string,
): { omzet: number; laba: number; qty: number; count: number } => {
  const summary = { omzet: 0, laba: 0, qty: 0, count: 0 };
  for (const order of orders) {
    if (order.statusOrder === 'batal' || order.tanggal < start || order.tanggal > end) {
      continue;
    }
    summary.omzet += order.totalTagihan;
    summary.laba += order.labaKotor;
    summary.qty += order.items.reduce((sum, item) => sum + item.qty, 0);
    summary.count++;
  }
  return summary;
};

/** Perubahan dalam persen (dibulatkan), atau null bila periode pembanding nol. */
export const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

export type ActionItemId = 'cancel_requests' | 'overdue' | 'due_soon' | 'negative_stock' | 'low_stock' | 'po_in_transit';

export type ActionItem = { id: ActionItemId; count: number; amount?: number };

const DUE_SOON_DAYS = 7;

const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Daftar hal yang perlu ditindak, urut dari yang paling mendesak; yang nol tidak dimasukkan. */
export const actionItems = (input: {
  today: string;
  orders: { statusOrder: string; statusBayar: string; sisaPiutang: number; jatuhTempo?: string }[];
  purchaseOrders: { statusPO: string }[];
  negativeCount: number;
  lowStockCount: number;
}): ActionItem[] => {
  const dueSoonLimit = addDays(input.today, DUE_SOON_DAYS);
  const receivables = input.orders.filter((order) => order.statusOrder !== 'batal' && order.statusBayar !== 'lunas' && order.sisaPiutang > 0 && order.jatuhTempo);
  const overdue = receivables.filter((order) => order.jatuhTempo! < input.today);
  const dueSoon = receivables.filter((order) => order.jatuhTempo! >= input.today && order.jatuhTempo! <= dueSoonLimit);
  const total = (list: { sisaPiutang: number }[]) => list.reduce((sum, order) => sum + order.sisaPiutang, 0);

  const items: ActionItem[] = [
    { id: 'cancel_requests', count: input.orders.filter((order) => order.statusOrder === 'menunggu_approval_batal').length },
    { id: 'overdue', count: overdue.length, amount: total(overdue) },
    { id: 'due_soon', count: dueSoon.length, amount: total(dueSoon) },
    { id: 'negative_stock', count: input.negativeCount },
    { id: 'low_stock', count: input.lowStockCount },
    { id: 'po_in_transit', count: input.purchaseOrders.filter((po) => po.statusPO === 'dikirim').length },
  ];
  return items.filter((item) => item.count > 0);
};

type SoldItem = { sku: string; namaProduk: string; colorName: string; size: string; qty: number; subtotal: number };
type OrderWithItems = { tanggal: string; statusOrder: string; items: SoldItem[] };

/** Nama produk; warna & ukuran ditambahkan hanya bila belum tertulis di nama. */
const itemLabel = (item: SoldItem): string =>
  item.namaProduk.toLowerCase().includes(item.colorName.toLowerCase()) ? item.namaProduk : `${item.namaProduk} · ${item.colorName} ${item.size}`;

/** Pcs & omzet per SKU (tanpa order batal) di antara dua tanggal. */
const salesBySku = (orders: OrderWithItems[], start: string, end: string): Map<string, { label: string; qty: number; omzet: number }> => {
  const totals = new Map<string, { label: string; qty: number; omzet: number }>();
  for (const order of orders) {
    if (order.statusOrder === 'batal' || order.tanggal < start || order.tanggal > end) {
      continue;
    }
    for (const item of order.items) {
      const entry = totals.get(item.sku) ?? { label: itemLabel(item), qty: 0, omzet: 0 };
      entry.qty += item.qty;
      entry.omzet += item.subtotal;
      totals.set(item.sku, entry);
    }
  }
  return totals;
};

/** SKU terlaris (berdasarkan pcs) di periode, maksimal `limit`. */
export const topProducts = (
  orders: OrderWithItems[],
  start: string,
  end: string,
  limit = 5,
): { sku: string; label: string; qty: number; omzet: number }[] =>
  [...salesBySku(orders, start, end).entries()]
    .map(([sku, entry]) => ({ sku, ...entry }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);

export const STOCK_COVER_WINDOW_DAYS = 90;

/**
 * Perkiraan sisa hari stok untuk SKU yang terjual dalam `windowDays` hari terakhir:
 * stok ÷ rata-rata pcs per hari. Stok nol atau minus berarti 0 hari. Urut dari yang paling cepat habis.
 */
export const stockCover = (
  orders: OrderWithItems[],
  stockBySku: Record<string, number>,
  today: string,
  { windowDays = STOCK_COVER_WINDOW_DAYS, limit = 5 }: { windowDays?: number; limit?: number } = {},
): { sku: string; label: string; stock: number; sold: number; daysLeft: number }[] =>
  [...salesBySku(orders, addDays(today, -windowDays), today).entries()]
    .map(([sku, entry]) => {
      const stock = stockBySku[sku] ?? 0;
      const perDay = entry.qty / windowDays;
      return { sku, label: entry.label, stock, sold: entry.qty, daysLeft: stock <= 0 ? 0 : Math.floor(stock / perDay) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || b.sold - a.sold)
    .slice(0, limit);

/** Total biaya operasional (OPEX) di antara dua tanggal. */
export const opexTotal = (opex: { tanggal: string; jumlah: number }[], start: string, end: string): number =>
  opex.reduce((sum, entry) => (entry.tanggal >= start && entry.tanggal <= end ? sum + entry.jumlah : sum), 0);
