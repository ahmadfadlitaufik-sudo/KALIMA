import { describe, expect, it } from 'vitest';
import { displayCity, formatCompactRupiah, frequencyTier, resolveSegment } from './customerSegments';

const activity = { totalOrders: 0, totalSpent: 0, marketplaceOrders: 0, directOrders: 0, resellerOrders: 0 };

describe('resolveSegment', () => {
  it('keeps a manual tag, including Internal', () => {
    expect(resolveSegment({ nama: 'TAPADA', tipe: 'Retail', kategoriManual: 'Internal' }, { ...activity, totalOrders: 130 })).toEqual({
      segment: 'Internal',
      isManual: true,
    });
  });

  it('treats the walk-in placeholder customer as internal instead of VIP', () => {
    expect(resolveSegment({ nama: ' Pelanggan Umum ', tipe: 'Retail' }, { ...activity, totalOrders: 246, totalSpent: 40_000_000 })).toEqual({
      segment: 'Internal',
      isManual: false,
    });
  });

  it('auto-detects VIP, marketplace and reseller from order history', () => {
    expect(resolveSegment({ nama: 'Budi', tipe: 'Retail' }, { ...activity, totalOrders: 5 }).segment).toBe('VIP');
    expect(resolveSegment({ nama: 'Sari', tipe: 'Retail' }, { ...activity, totalOrders: 2, marketplaceOrders: 2 }).segment).toBe('Marketplace');
    expect(resolveSegment({ nama: 'Toko', tipe: 'Retail' }, { ...activity, totalOrders: 1, resellerOrders: 1 }).segment).toBe('Reseller');
    expect(resolveSegment({ nama: 'Ani', tipe: 'Retail' }, { ...activity, totalOrders: 1, directOrders: 1 }).segment).toBe('Umum');
  });
});

describe('frequencyTier', () => {
  it('groups by number of orders', () => {
    expect([0, 1, 2, 4, 5].map(frequencyTier)).toEqual(['no_order', 'baru', 'reguler', 'reguler', 'loyal']);
  });
});

describe('displayCity', () => {
  it('hides placeholder cities instead of showing a fake one', () => {
    expect(displayCity('Kota Asal')).toBe('');
    expect(displayCity(' - ')).toBe('');
    expect(displayCity('Makassar')).toBe('Makassar');
  });
});

describe('formatCompactRupiah', () => {
  it('uses Indonesian decimal comma', () => {
    expect(formatCompactRupiah(148_840_466)).toBe('148,8 jt');
    expect(formatCompactRupiah(1_250_000_000)).toBe('1,3 M');
    expect(formatCompactRupiah(9_500)).toBe('10 rb');
    expect(formatCompactRupiah(800)).toBe('800');
  });
});
