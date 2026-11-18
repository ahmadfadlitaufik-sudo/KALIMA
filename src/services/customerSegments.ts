/** Aturan segmen & format untuk halaman Customer CRM. */

export type CustomerSegment = 'Umum' | 'Reseller' | 'Marketplace' | 'VIP' | 'Internal';
export type FrequencyTier = 'baru' | 'reguler' | 'loyal' | 'no_order';

type SegmentInput = { nama: string; tipe: string; kategoriManual?: CustomerSegment; resellerIdRef?: string };
type Activity = { totalOrders: number; totalSpent: number; marketplaceOrders: number; directOrders: number; resellerOrders: number };

/** Nama penampung untuk order tanpa data pembeli; bukan pelanggan sungguhan. */
const WALK_IN_NAMES = new Set(['pelanggan umum']);

const VIP_MIN_ORDERS = 5;
const VIP_MIN_SPENT = 2_500_000;

export const resolveSegment = (customer: SegmentInput, activity: Activity): { segment: CustomerSegment; isManual: boolean } => {
  if (customer.kategoriManual) {
    return { segment: customer.kategoriManual, isManual: true };
  }
  if (WALK_IN_NAMES.has(customer.nama.trim().toLowerCase())) {
    return { segment: 'Internal', isManual: false };
  }
  if (customer.tipe === 'VIP') {
    return { segment: 'VIP', isManual: true };
  }
  if (customer.tipe === 'Reseller' || customer.resellerIdRef || activity.resellerOrders > 0) {
    return { segment: 'Reseller', isManual: customer.tipe === 'Reseller' };
  }
  if (customer.tipe === 'Marketplace') {
    return { segment: 'Marketplace', isManual: true };
  }
  if (activity.marketplaceOrders > 0 && activity.marketplaceOrders >= activity.directOrders) {
    return { segment: 'Marketplace', isManual: false };
  }
  if (activity.totalOrders >= VIP_MIN_ORDERS || activity.totalSpent >= VIP_MIN_SPENT) {
    return { segment: 'VIP', isManual: false };
  }
  return { segment: 'Umum', isManual: false };
};

export const frequencyTier = (totalOrders: number): FrequencyTier =>
  totalOrders === 0 ? 'no_order' : totalOrders === 1 ? 'baru' : totalOrders <= 4 ? 'reguler' : 'loyal';

const PLACEHOLDER_CITIES = new Set(['', '-', 'kota asal']);

/** Kota untuk ditampilkan; isian pengganti seperti "Kota Asal" dianggap kosong. */
export const displayCity = (kota: string | undefined): string => {
  const value = (kota ?? '').trim();
  return PLACEHOLDER_CITIES.has(value.toLowerCase()) ? '' : value;
};

const oneDecimal = (value: number): string => value.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Rupiah ringkas: 148,8 jt · 1,3 M · 10 rb. */
export const formatCompactRupiah = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${oneDecimal(value / 1_000_000_000)} M`;
  }
  if (abs >= 1_000_000) {
    return `${oneDecimal(value / 1_000_000)} jt`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)} rb`;
  }
  return String(value);
};
