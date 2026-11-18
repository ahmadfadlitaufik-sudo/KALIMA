import { describe, expect, it } from 'vitest';
import { backupSummary, parseAmount, skuRowProblem } from './importChecks';

describe('backupSummary', () => {
  it('counts the known collections in a backup and ignores the rest', () => {
    expect(backupSummary({ skus: [1, 2], orders: [1], foo: [1, 2, 3] })).toEqual([
      { label: 'SKU', count: 2 },
      { label: 'Order', count: 1 },
    ]);
  });

  it('returns an empty list for something that is not a backup', () => {
    expect(backupSummary([1, 2])).toEqual([]);
    expect(backupSummary({ name: 'x' })).toEqual([]);
  });
});

describe('parseAmount', () => {
  it('reads Rupiah text and returns null when empty', () => {
    expect(parseAmount('Rp 129.000')).toBe(129000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe('skuRowProblem', () => {
  it('names every missing field instead of filling in a guess', () => {
    expect(skuRowProblem({ sku: '', name: '', price: null, hpp: null })).toBe('kode SKU, nama, harga jual, HPP kosong');
    expect(skuRowProblem({ sku: 'A', name: 'Kaos', price: 100000, hpp: 0 })).toBe('HPP kosong');
    expect(skuRowProblem({ sku: 'A', name: 'Kaos', price: 100000, hpp: 40000 })).toBeNull();
  });
});
