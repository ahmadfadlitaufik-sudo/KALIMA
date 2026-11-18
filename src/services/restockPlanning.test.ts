import { describe, expect, it } from 'vitest';
import { restockSuggestions } from './restockPlanning';

const sale = (tanggal: string, sku: string, qty: number, statusOrder = 'selesai') => ({
  tanggal,
  statusOrder,
  items: [{ sku, namaProduk: sku, colorName: '', size: 'L', qty, subtotal: 0 }],
});
const skus = [
  { sku: 'A', name: 'Kaos A', hpp: 50000 },
  { sku: 'B', name: 'Kaos B', hpp: 60000 },
  { sku: 'C', name: 'Kaos C', hpp: 40000, active: false },
];
const base = { skus, purchaseOrders: [], today: '2026-11-18', stockBySku: {} as Record<string, number> };

describe('restockSuggestions', () => {
  it('suggests perDay x 45 minus stock and ignores cancelled and out-of-window orders', () => {
    const orders = [sale('2026-11-01', 'A', 60), sale('2026-11-02', 'A', 30, 'batal'), sale('2026-08-01', 'A', 500)];
    const [a] = restockSuggestions({ ...base, orders, stockBySku: { A: 10 } });
    expect(a).toMatchObject({ sku: 'A', perDay: 1, stock: 10, onOrder: 0, daysLeft: 10, suggested: 35 });
  });

  it('subtracts open POs but not cancelled or fully received ones', () => {
    const open = { statusPO: 'dikirim', items: [{ sku: 'A', qtyPesan: 40, qtyDiterima: 10 }] };
    const cancelled = { statusPO: 'batal', items: [{ sku: 'A', qtyPesan: 100, qtyDiterima: 0 }] };
    const done = { statusPO: 'diterima', items: [{ sku: 'A', qtyPesan: 100, qtyDiterima: 100 }] };
    const [a] = restockSuggestions({ ...base, orders: [sale('2026-11-01', 'A', 60)], stockBySku: { A: 0 }, purchaseOrders: [open, cancelled, done] });
    expect(a).toMatchObject({ onOrder: 30, suggested: 15 });
  });

  it('treats minus stock as zero, skips inactive and enough-stock SKUs, and sorts by days left', () => {
    const orders = [sale('2026-11-01', 'A', 60), sale('2026-11-01', 'B', 60), sale('2026-11-01', 'C', 60)];
    const result = restockSuggestions({ ...base, orders, stockBySku: { A: 50, B: -5, C: 0 } });
    expect(result.map((r) => r.sku)).toEqual(['B']);
    expect(result[0]).toMatchObject({ stock: 0, daysLeft: 0, suggested: 45 });
  });
});
