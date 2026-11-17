import { describe, expect, it } from 'vitest';
import { actionItems, cashFlowForMonth, opexTotal, stockCover, topProducts, grossMarginPercent, negativeStock, percentChange, periodRange, qtySoldInMonth, salesSummary, stockValue } from './dashboardMetrics';

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

describe('periodRange', () => {
  it('gives this month and the month before for comparison', () => {
    expect(periodRange('this_month', '2026-11-18')).toEqual({ start: '2026-11-01', end: '2026-11-30', prevStart: '2026-10-01', prevEnd: '2026-10-31' });
  });

  it('handles last month across a year boundary', () => {
    expect(periodRange('last_month', '2026-01-05')).toEqual({ start: '2025-12-01', end: '2025-12-31', prevStart: '2025-11-01', prevEnd: '2025-11-30' });
  });

  it('compares this year to date with the same days last year', () => {
    expect(periodRange('this_year', '2026-11-18')).toEqual({ start: '2026-01-01', end: '2026-11-18', prevStart: '2025-01-01', prevEnd: '2025-11-18' });
  });
});

describe('salesSummary', () => {
  it('sums non-cancelled orders within the dates', () => {
    const orders = [
      { tanggal: '2026-10-07', statusOrder: 'selesai', totalTagihan: 125000, labaKotor: 58000, items: [{ qty: 1 }] },
      { tanggal: '2026-10-08', statusOrder: 'batal', totalTagihan: 999, labaKotor: 9, items: [{ qty: 9 }] },
      { tanggal: '2026-11-01', statusOrder: 'selesai', totalTagihan: 50000, labaKotor: 20000, items: [{ qty: 2 }] },
    ];
    expect(salesSummary(orders, '2026-10-01', '2026-10-31')).toEqual({ omzet: 125000, laba: 58000, qty: 1, count: 1 });
  });
});

describe('percentChange', () => {
  it('returns the rounded change, or null without a previous value', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(0, 200)).toBe(-100);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe('actionItems', () => {
  const base = { today: '2026-11-18', negativeCount: 0, lowStockCount: 0, purchaseOrders: [] as { statusPO: string }[] };

  it('lists only what needs attention, most urgent first', () => {
    const orders = [
      { statusOrder: 'menunggu_approval_batal', statusBayar: 'lunas', sisaPiutang: 0 },
      { statusOrder: 'selesai', statusBayar: 'piutang', sisaPiutang: 100000, jatuhTempo: '2026-11-10' },
      { statusOrder: 'selesai', statusBayar: 'sebagian', sisaPiutang: 50000, jatuhTempo: '2026-11-20' },
      { statusOrder: 'selesai', statusBayar: 'piutang', sisaPiutang: 70000, jatuhTempo: '2026-12-30' },
      { statusOrder: 'batal', statusBayar: 'piutang', sisaPiutang: 5000, jatuhTempo: '2026-11-01' },
    ];
    const items = actionItems({ ...base, orders, negativeCount: 83, lowStockCount: 90, purchaseOrders: [{ statusPO: 'dikirim' }, { statusPO: 'diterima' }] });
    expect(items.map((item) => [item.id, item.count])).toEqual([
      ['cancel_requests', 1],
      ['overdue', 1],
      ['due_soon', 1],
      ['negative_stock', 83],
      ['low_stock', 90],
      ['po_in_transit', 1],
    ]);
    expect(items.find((item) => item.id === 'overdue')?.amount).toBe(100000);
  });

  it('returns nothing when all is in order', () => {
    expect(actionItems({ ...base, orders: [] })).toEqual([]);
  });
});

const item = (sku: string, qty: number, subtotal = qty * 100) => ({ sku, namaProduk: 'Kaos 290', colorName: 'Hitam', size: 'L', qty, subtotal });

describe('topProducts', () => {
  it('ranks SKUs by pieces sold in the period, skipping cancelled orders', () => {
    const orders = [
      { tanggal: '2026-11-02', statusOrder: 'selesai', items: [item('A', 3), item('B', 5)] },
      { tanggal: '2026-11-03', statusOrder: 'selesai', items: [item('A', 4)] },
      { tanggal: '2026-11-04', statusOrder: 'batal', items: [item('C', 50)] },
      { tanggal: '2026-10-30', statusOrder: 'selesai', items: [item('D', 99)] },
    ];
    expect(topProducts(orders, '2026-11-01', '2026-11-30', 2)).toEqual([
      { sku: 'A', label: 'Kaos 290 · Hitam L', qty: 7, omzet: 700 },
      { sku: 'B', label: 'Kaos 290 · Hitam L', qty: 5, omzet: 500 },
    ]);
  });
});

describe('topProducts label', () => {
  it('does not repeat colour and size already in the product name', () => {
    const orders = [
      { tanggal: '2026-11-02', statusOrder: 'selesai', items: [{ sku: 'E', namaProduk: 'Kalima Essential – BEIGE (L)', colorName: 'BEIGE', size: 'L', qty: 1, subtotal: 100 }] },
    ];
    expect(topProducts(orders, '2026-11-01', '2026-11-30')[0].label).toBe('Kalima Essential – BEIGE (L)');
  });
});

describe('stockCover', () => {
  it('estimates days of stock left for SKUs sold in the last 30 days, shortest first', () => {
    const orders = [
      { tanggal: '2026-11-10', statusOrder: 'selesai', items: [item('A', 30)] },
      { tanggal: '2026-11-15', statusOrder: 'selesai', items: [item('B', 6)] },
      { tanggal: '2026-11-16', statusOrder: 'selesai', items: [item('C', 3)] },
      { tanggal: '2026-09-01', statusOrder: 'selesai', items: [item('D', 90)] },
    ];
    const stock = { A: 10, B: 60, C: -2, D: 1 };
    expect(stockCover(orders, stock, '2026-11-18', { windowDays: 30 })).toEqual([
      { sku: 'C', label: 'Kaos 290 · Hitam L', stock: -2, sold: 3, daysLeft: 0 },
      { sku: 'A', label: 'Kaos 290 · Hitam L', stock: 10, sold: 30, daysLeft: 10 },
      { sku: 'B', label: 'Kaos 290 · Hitam L', stock: 60, sold: 6, daysLeft: 300 },
    ]);
  });
});

describe('opexTotal', () => {
  it('sums operating expenses between two dates', () => {
    const opex = [
      { tanggal: '2026-11-01', jumlah: 100 },
      { tanggal: '2026-11-30', jumlah: 50 },
      { tanggal: '2026-12-01', jumlah: 999 },
    ];
    expect(opexTotal(opex, '2026-11-01', '2026-11-30')).toBe(150);
  });
});
