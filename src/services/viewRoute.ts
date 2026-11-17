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
  const match = (Object.keys(VIEW_PATHS) as AppView[]).find((view) => VIEW_PATHS[view] === normalized);
  return match ?? 'dashboard';
};
