/** Hitungan untuk halaman Reseller & Konsinyasi. */

const DEFAULT_PARTNER_DISCOUNT = 20;

/** Harga titip = harga jual dikurangi diskon mitra (bawaan 20%). */
export const consignmentPrice = (retailPrice: number, diskonPersen: number | undefined): number =>
  Math.round(retailPrice * (1 - (diskonPersen ?? DEFAULT_PARTNER_DISCOUNT) / 100));

type PricedSku = { sku: string; price: number; hpp: number };

/** Jumlah pcs titipan, nilainya menurut HPP (sama dengan neraca) dan menurut harga titip (untuk plafon). Stok minus diabaikan. */
export const resellerStockSummary = (
  stockBySku: Record<string, number>,
  skus: PricedSku[],
  diskonPersen: number | undefined,
): { pcs: number; hppValue: number; consignmentValue: number } => {
  let pcs = 0;
  let hppValue = 0;
  let consignmentValue = 0;
  for (const [code, qty] of Object.entries(stockBySku)) {
    if (qty <= 0) {
      continue;
    }
    pcs += qty;
    const sku = skus.find((s) => s.sku === code);
    if (sku) {
      hppValue += qty * (sku.hpp || 0);
      consignmentValue += qty * consignmentPrice(sku.price, diskonPersen);
    }
  }
  return { pcs, hppValue, consignmentValue };
};

/** Sisa tagihan mitra: order atas nama mitra maupun customer CRM yang ditautkan ke mitra itu. */
export const resellerReceivable = (
  resellerId: string,
  orders: { customerId: string; sisaPiutang: number; statusOrder: string }[],
  customers: { id: string; resellerIdRef?: string }[],
): number => {
  const ids = new Set([resellerId, ...customers.filter((c) => c.resellerIdRef === resellerId).map((c) => c.id)]);
  return orders.filter((o) => ids.has(o.customerId) && o.statusOrder !== 'batal').reduce((sum, o) => sum + Math.max(0, o.sisaPiutang), 0);
};

/** "November 2026" untuk isian periode laporan laku. */
export const consignmentPeriodLabel = (date: Date): string => date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
