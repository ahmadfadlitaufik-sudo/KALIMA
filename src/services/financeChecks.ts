/** Bantuan kecil untuk halaman Keuangan. */

/** "2026-10" → "Oktober 2026". */
export const monthLabelId = (yearMonth: string): string =>
  new Date(`${yearMonth}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

/** Kode SKU yang terjual (order tidak batal) padahal HPP di Master SKU masih 0, masing-masing sekali. */
export const missingHppSkus = (
  orders: { statusOrder: string; items: { sku: string; qty: number }[] }[],
  skus: { sku: string; hpp: number }[],
): string[] => {
  const hppOf = new Map(skus.map((s) => [s.sku, s.hpp]));
  const missing = new Set<string>();
  for (const order of orders) {
    if (order.statusOrder === 'batal') {
      continue;
    }
    for (const item of order.items) {
      if (item.qty > 0 && !((hppOf.get(item.sku) ?? 0) > 0)) {
        missing.add(item.sku);
      }
    }
  }
  return [...missing];
};

/** Tanggal order paling lama di atas; array asli tidak diubah. */
export const oldestFirst = <T extends { tanggal: string }>(orders: T[]): T[] => [...orders].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

const formatLongDate = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/** Pesan tagihan sopan yang bisa ditempel ke WhatsApp. */
export const receivableReminder = (order: { noOrder: string; customerNama: string; sisaPiutang: number; jatuhTempo?: string }): string =>
  `Halo ${order.customerNama}, kami dari Kalima. Mengingatkan tagihan order ${order.noOrder} yang masih tersisa Rp ${order.sisaPiutang.toLocaleString('id-ID')}${
    order.jatuhTempo ? ` (jatuh tempo ${formatLongDate(order.jatuhTempo)})` : ''
  }. Mohon dibantu pelunasannya. Terima kasih.`;
