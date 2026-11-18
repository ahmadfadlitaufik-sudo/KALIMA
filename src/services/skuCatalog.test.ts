import { describe, expect, it } from 'vitest';
import { averageMarginPercent, productImageUrl, sizeOptions, skuStockTotals, sortSkus, stockStatus } from './skuCatalog';

const sku = (code: string, price: number, hpp: number) => ({ sku: code, price, hpp });

describe('sizeOptions', () => {
  it('lists every size in the data once, in garment order, with the standard sizes always present', () => {
    expect(sizeOptions(['XL', 'XXL', 'S', 'L', 'XL', 'FREE'])).toEqual(['S', 'M', 'L', 'XL', '2XL', 'XXL', 'FREE']);
  });
});

describe('skuStockTotals', () => {
  it('ignores minus stock in totals and value, and counts minus SKUs separately', () => {
    const stock: Record<string, { gudang: number; total: number }> = {
      A: { gudang: 10, total: 14 },
      B: { gudang: -5, total: -5 },
      C: { gudang: 0, total: 3 },
    };
    const totals = skuStockTotals([sku('A', 100, 40.4), sku('B', 100, 50), sku('C', 100, 60)], (code) => stock[code]);
    expect(totals).toEqual({ gudang: 10, reseller: 7, value: Math.round(14 * 40.4 + 3 * 60), minusCount: 1 });
  });
});

describe('averageMarginPercent', () => {
  it('divides total margin by total price, to one decimal', () => {
    expect(averageMarginPercent([sku('A', 100, 40), sku('B', 300, 240)])).toBe(30);
    expect(averageMarginPercent([])).toBeNull();
  });
});

describe('stockStatus', () => {
  it('separates minus from sold out and low stock', () => {
    expect(stockStatus(-3, 10)).toBe('minus');
    expect(stockStatus(0, 10)).toBe('habis');
    expect(stockStatus(10, 10)).toBe('menipis');
    expect(stockStatus(11, 10)).toBe('aman');
  });
});

describe('sortSkus', () => {
  const items = [sku('B', 100, 90), sku('A', 100, 10), sku('C', 100, 50)];
  const stock: Record<string, number> = { A: 5, B: -2, C: 9 };
  const order = (key: Parameters<typeof sortSkus>[1]) => sortSkus(items, key, (code) => stock[code]).map((item) => item.sku);

  it('sorts by code, stock or margin without touching the input', () => {
    expect(order('kode')).toEqual(['A', 'B', 'C']);
    expect(order('stok_terendah')).toEqual(['B', 'A', 'C']);
    expect(order('stok_tertinggi')).toEqual(['C', 'A', 'B']);
    expect(order('margin_tertinggi')).toEqual(['A', 'C', 'B']);
    expect(items[0].sku).toBe('B');
  });
});

describe('productImageUrl', () => {
  it('maps the old source-folder photo path to the published products folder', () => {
    expect(productImageUrl('/src/assets/images/kalima_210gsm.jpg')).toBe('/products/kalima_210gsm.jpg');
    expect(productImageUrl('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
    expect(productImageUrl(undefined)).toBeUndefined();
  });
});
