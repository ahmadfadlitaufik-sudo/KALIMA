/** Pemeriksaan sebelum data impor menimpa data aplikasi. */

const BACKUP_COLLECTIONS: [key: string, label: string][] = [
  ['skus', 'SKU'],
  ['series', 'Lini'],
  ['orders', 'Order'],
  ['stockMovements', 'Mutasi stok'],
  ['stockOpnameSessions', 'Sesi opname'],
  ['customers', 'Pelanggan'],
  ['resellers', 'Reseller'],
  ['vendors', 'Vendor'],
  ['purchaseOrders', 'PO'],
  ['cashAccounts', 'Akun kas'],
  ['cashMutations', 'Mutasi kas'],
  ['biayaOperasional', 'Biaya operasional'],
  ['bankReconciliations', 'Rekonsiliasi bank'],
];

/** Daftar isi backup JSON; kosong bila teks itu bukan backup Kalima. */
export const backupSummary = (parsed: unknown): { label: string; count: number }[] => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }
  const data = parsed as Record<string, unknown>;
  return BACKUP_COLLECTIONS.filter(([key]) => Array.isArray(data[key])).map(([key, label]) => ({ label, count: (data[key] as unknown[]).length }));
};

/** "Rp 129.000" → 129000; null bila kosong atau tidak berisi angka. */
export const parseAmount = (raw: unknown): number | null => {
  const digits = String(raw ?? '').replace(/[^0-9-]/g, '');
  if (digits === '' || digits === '-') {
    return null;
  }
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
};

/** Alasan baris SKU ditolak, atau null bila lengkap. */
export const skuRowProblem = (row: { sku: string; name: string; price: number | null; hpp: number | null }): string | null => {
  const missing = [
    !row.sku.trim() && 'kode SKU',
    !row.name.trim() && 'nama',
    !(row.price && row.price > 0) && 'harga jual',
    !(row.hpp && row.hpp > 0) && 'HPP',
  ].filter(Boolean);
  return missing.length ? `${missing.join(', ')} kosong` : null;
};
