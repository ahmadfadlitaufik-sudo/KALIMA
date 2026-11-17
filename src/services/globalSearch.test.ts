import { describe, expect, it } from 'vitest';
import { searchAll } from './globalSearch';
import { pushPendingSearch, subscribePendingSearch, takePendingSearch } from './searchHandoff';

const data = {
  orders: [
    { id: 'o1', noOrder: 'ORD-20261007-002', tanggal: '2026-10-07', customerNama: 'TPD ARHAM', customerHp: '0811', totalTagihan: 125000, items: [{ sku: 'KL-ESS-PT-S', namaProduk: 'Kalima Essential Putih' }] },
    { id: 'o2', noOrder: 'ORD-20261006-001', tanggal: '2026-10-06', customerNama: 'whydi', customerHp: '08529', totalTagihan: 125000, items: [{ sku: 'KL-ESS-HT-L', namaProduk: 'Kalima Essential Hitam' }] },
  ],
  skus: [
    { sku: 'KL-ESS-PT-S', name: 'Kalima Essential - Putih - S', colorName: 'Putih' },
    { sku: 'KL-ESS-HT-L', name: 'Kalima Essential - Hitam - L', colorName: 'Hitam' },
  ],
  customers: [
    { id: 'c1', nama: 'TPD ARHAM', noHp: '0811', kota: 'Makassar' },
    { id: 'c2', nama: 'whydi', noHp: '08529', kota: 'Makassar' },
  ],
};

describe('searchAll', () => {
  it('finds orders, SKUs and customers by any visible field, ignoring case', () => {
    const result = searchAll('arham', data);
    expect(result.orders.map((o) => o.id)).toEqual(['o1']);
    expect(result.customers.map((c) => c.id)).toEqual(['c1']);
    expect(result.skus).toEqual([]);
  });

  it('matches SKU codes inside orders and the SKU list', () => {
    const result = searchAll('ht-l', data);
    expect(result.orders.map((o) => o.id)).toEqual(['o2']);
    expect(result.skus.map((s) => s.sku)).toEqual(['KL-ESS-HT-L']);
  });

  it('returns nothing for queries shorter than two characters', () => {
    expect(searchAll(' k ', data)).toEqual({ orders: [], skus: [], customers: [] });
  });

  it('caps each group at the limit', () => {
    expect(searchAll('kalima', data, 1).orders).toHaveLength(1);
  });
});

describe('searchHandoff', () => {
  it('hands a query to the target page once', () => {
    pushPendingSearch('sales', 'ORD-1');
    expect(takePendingSearch('inventory')).toBe('');
    expect(takePendingSearch('sales')).toBe('ORD-1');
    expect(takePendingSearch('sales')).toBe('');
  });

  it('notifies a page that is already open', () => {
    const seen: string[] = [];
    const unsubscribe = subscribePendingSearch('customers', (query) => seen.push(query));
    pushPendingSearch('customers', 'whydi');
    unsubscribe();
    expect(seen).toEqual(['whydi']);
    expect(takePendingSearch('customers')).toBe('');
  });
});
