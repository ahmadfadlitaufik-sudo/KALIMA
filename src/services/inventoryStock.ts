/** Hitungan untuk halaman Inventori. */

type StockEntry = { gudang: number; reseller: number; total: number };

/** Stok gudang yang benar-benar ada (minus tidak mengurangi), plus jumlah SKU minus / kosong dan titipan di reseller. */
export const warehouseTotals = (
  summary: Record<string, StockEntry>,
): { available: number; availableSkus: number; emptySkus: number; minusSkus: number; minusPcs: number; reseller: number } => {
  const totals = { available: 0, availableSkus: 0, emptySkus: 0, minusSkus: 0, minusPcs: 0, reseller: 0 };
  for (const entry of Object.values(summary)) {
    if (entry.gudang > 0) {
      totals.available += entry.gudang;
      totals.availableSkus++;
    } else if (entry.gudang < 0) {
      totals.minusSkus++;
      totals.minusPcs += entry.gudang;
    } else {
      totals.emptySkus++;
    }
    totals.reseller += Math.max(0, entry.reseller);
  }
  return totals;
};

export type OpnameCount = { physical: number | null; reason: string };

/** Item opname yang dikirim: hanya SKU yang sudah dihitung (physical terisi). */
export const countedOpnameItems = (
  counts: Record<string, OpnameCount>,
  systemOf: (sku: string) => number,
  globalReason: string,
): { sku: string; physicalQty: number; alasan: string }[] =>
  Object.entries(counts)
    .filter((entry): entry is [string, { physical: number; reason: string }] => entry[1].physical !== null)
    .map(([sku, { physical, reason }]) => ({
      sku,
      physicalQty: physical,
      alasan: reason.trim() || (physical === systemOf(sku) ? 'Sesuai hitungan fisik' : globalReason),
    }));

type Movement = { id: string; tanggal: string; sku: string; qty: number; lokasi: string };

/** Mutasi satu SKU dengan saldo gudang berjalan, terbaru di atas. Mutasi di reseller tidak mengubah saldo gudang. */
export const stockCard = <T extends Movement>(movements: T[], sku: string): (T & { balance: number })[] => {
  let balance = 0;
  return movements
    .map((movement, index) => ({ movement, index }))
    .filter(({ movement }) => movement.sku === sku)
    .sort((a, b) => a.movement.tanggal.localeCompare(b.movement.tanggal) || b.index - a.index)
    .map(({ movement }) => {
      if (movement.lokasi === 'Gudang Utama') {
        balance += movement.qty;
      }
      return { ...movement, balance };
    })
    .reverse();
};

const MOVEMENT_LABELS: Record<string, string> = {
  masuk: 'Barang masuk',
  jual: 'Penjualan',
  retur_jual: 'Retur penjualan',
  reject: 'Reject',
  opname: 'Opname',
  titip: 'Kirim titipan',
  laku_titip: 'Laku titipan',
  retur_titip: 'Retur titipan',
};

export const movementTypeLabel = (tipe: string): string => {
  if (MOVEMENT_LABELS[tipe]) {
    return MOVEMENT_LABELS[tipe];
  }
  const words = tipe.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
