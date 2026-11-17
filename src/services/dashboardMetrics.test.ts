import { describe, expect, it } from 'vitest';
import { cashFlowForMonth, grossMarginPercent, negativeStock, qtySoldInMonth, stockValue } from './dashboardMetrics';

describe('cashFlowForMonth', () => {
  it('sums money in and out for the given month only, ignoring transfers', () => {
    const mutations = [
      { tanggal: '2026-11-02', tipe: 'masuk' as const, jumlah: 500 },
      { tanggal: '2026-11-10', tipe: 'keluar' as const, jumlah: 200 },
      { tanggal: '2026-11-11', tipe: 'transfer' as const, jumlah: 999 },
      { tanggal: '2026-10-30', tipe: 'masuk' as const, jumlah: 7000 },
    ];
    expect(cashFlowForMonth(mutations, '2026-11')).toEqual({ masuk: 500, keluar: 200, net: 300, count: 2 });
  });
});

describe('grossMarginPercent', () => {
  it('returns the rounded margin, or null without sales', () => {
    expect(grossMarginPercent(1000, 425)).toBe(43);
    expect(grossMarginPercent(0, 0)).toBeNull();
  });
});

describe('qtySoldInMonth', () => {
  it('counts pieces from non-cancelled orders in the month', () => {
    const orders = [
      { tanggal: '2026-11-03', statusOrder: 'selesai', items: [{ qty: 2 }, { qty: 1 }] },
      { tanggal: '2026-11-04', statusOrder: 'batal', items: [{ qty: 5 }] },
      { tanggal: '2026-10-31', statusOrder: 'selesai', items: [{ qty: 9 }] },
    ];
    expect(qtySoldInMonth(orders, '2026-11')).toBe(3);
  });
});

describe('negativeStock', () => {
  it('counts SKUs below zero and their total shortfall', () => {
    const summary = { A: { total: -145, gudang: -145 }, B: { total: 10, gudang: 10 }, C: { total: -5, gudang: -5 } };
    expect(negativeStock(summary, 'total')).toEqual({ count: 2, pcs: -150 });
  });
});

describe('stockValue', () => {
  it('values only positive stock at HPP and rounds to whole rupiah', () => {
    const skus = [
      { sku: 'A', hpp: 66634.4 },
      { sku: 'B', hpp: 50000 },
    ];
    const summary = { A: { total: 3, gudang: 3 }, B: { total: -10, gudang: -10 } };
    expect(stockValue(skus, summary, 'total')).toBe(199903);
  });
});
