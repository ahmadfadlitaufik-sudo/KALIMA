import type { AppView } from '../context/AppContext';

/** Alamat URL tiap halaman, agar bisa di-refresh, di-bookmark, dan tombol Back berfungsi. */
const VIEW_PATHS: Record<AppView, string> = {
  dashboard: '/',
  sales: '/penjualan',
  inventory: '/inventori',
  purchases: '/pengadaan',
  products: '/produk',
  customers: '/pelanggan',
  reseller: '/reseller',
  finance: '/keuangan',
  import_export: '/impor-ekspor',
  audit: '/audit',
  users: '/pengguna',
};

export const viewToPath = (view: AppView): string => VIEW_PATHS[view];

export const pathToView = (path: string): AppView => {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  // Nama halaman dalam bahasa Inggris (mis. /inventory) juga diterima.
  const match = (Object.keys(VIEW_PATHS) as AppView[]).find((view) => VIEW_PATHS[view] === normalized || `/${view}` === normalized);
  return match ?? 'dashboard';
};

/** Judul halaman (tampil di header dan judul tab browser). */
export const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Dashboard',
  sales: 'Penjualan',
  inventory: 'Inventori',
  purchases: 'Pengadaan PO',
  products: 'Master SKU',
  customers: 'Customer CRM',
  reseller: 'Reseller & Konsinyasi',
  finance: 'Keuangan & Neraca',
  import_export: 'Impor & Ekspor',
  audit: 'Jejak Audit',
  users: 'Pengguna',
};
