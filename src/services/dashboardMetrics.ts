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
