/** Saran restok: berapa pcs per SKU yang perlu dipesan agar stok cukup untuk `targetDays` hari. */

export const RESTOCK_WINDOW_DAYS = 60;
export const RESTOCK_TARGET_DAYS = 45;

/** PO yang barangnya masih ditunggu. */
const OPEN_PO_STATUSES = ['dipesan', 'dikirim', 'diterima_sebagian'];

export type RestockSuggestion = {
  sku: string;
  name: string;
  hpp: number;
  stock: number;
  onOrder: number;
  perDay: number;
  daysLeft: number;
  suggested: number;
};

type RestockInput = {
  orders: { tanggal: string; statusOrder: string; items: { sku: string; qty: number }[] }[];
  skus: { sku: string; name: string; hpp: number; active?: boolean }[];
  stockBySku: Record<string, number>;
  purchaseOrders: { statusPO: string; items: { sku: string; qtyPesan: number; qtyDiterima: number }[] }[];
  today: string;
  windowDays?: number;
  targetDays?: number;
};

const daysBefore = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
};

/**
 * Usulan = ceil(laku per hari × target) − stok − sudah dipesan. Stok minus dihitung 0; SKU nonaktif,
 * tanpa penjualan di jendela, atau yang sudah cukup tidak muncul. Urut dari yang paling cepat habis.
 */
export const restockSuggestions = ({
  orders,
  skus,
  stockBySku,
  purchaseOrders,
  today,
  windowDays = RESTOCK_WINDOW_DAYS,
  targetDays = RESTOCK_TARGET_DAYS,
}: RestockInput): RestockSuggestion[] => {
  const start = daysBefore(today, windowDays);
  const sold = new Map<string, number>();
  for (const order of orders) {
    if (order.statusOrder === 'batal' || order.tanggal < start || order.tanggal > today) {
      continue;
    }
    for (const item of order.items) {
      sold.set(item.sku, (sold.get(item.sku) ?? 0) + item.qty);
    }
  }

  const onOrder = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (!OPEN_PO_STATUSES.includes(po.statusPO)) {
      continue;
    }
    for (const item of po.items) {
      onOrder.set(item.sku, (onOrder.get(item.sku) ?? 0) + Math.max(0, item.qtyPesan - (item.qtyDiterima || 0)));
    }
  }

  return skus
    .filter((sku) => sku.active !== false && (sold.get(sku.sku) ?? 0) > 0)
    .map((sku) => {
      const perDay = (sold.get(sku.sku) ?? 0) / windowDays;
      const stock = Math.max(0, stockBySku[sku.sku] ?? 0);
      const ordered = onOrder.get(sku.sku) ?? 0;
      return {
        sku: sku.sku,
        name: sku.name,
        hpp: sku.hpp,
        stock,
        onOrder: ordered,
        perDay,
        daysLeft: Math.floor(stock / perDay),
        suggested: Math.ceil(perDay * targetDays) - stock - ordered,
      };
    })
    .filter((row) => row.suggested > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.suggested - a.suggested);
};
