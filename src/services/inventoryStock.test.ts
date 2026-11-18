import { describe, expect, it } from 'vitest';
import { countedOpnameItems, movementTypeLabel, stockCard, warehouseTotals } from './inventoryStock';

describe('warehouseTotals', () => {
  it('counts only stock that physically exists and reports minus SKUs separately', () => {
    const summary = {
      A: { gudang: 10, reseller: 2, total: 12 },
      B: { gudang: -4, reseller: 0, total: -4 },
      C: { gudang: 0, reseller: 3, total: 3 },
    };
    expect(warehouseTotals(summary)).toEqual({ available: 10, availableSkus: 1, emptySkus: 1, minusSkus: 1, minusPcs: -4, reseller: 5 });
  });
});

describe('countedOpnameItems', () => {
  it('submits only SKUs that were actually counted, with the global reason for differences', () => {
    const counts = { A: { physical: 8, reason: '' }, B: { physical: 0, reason: 'hilang' }, C: { physical: null, reason: '' } };
    const systemOf = (sku: string) => ({ A: 10, B: -4, C: 5 })[sku] ?? 0;
    expect(countedOpnameItems(counts, systemOf, 'Opname bulanan')).toEqual([
      { sku: 'A', physicalQty: 8, alasan: 'Opname bulanan' },
      { sku: 'B', physicalQty: 0, alasan: 'hilang' },
    ]);
  });

  it('marks an unchanged count as matching', () => {
    expect(countedOpnameItems({ A: { physical: 10, reason: '' } }, () => 10, 'x')).toEqual([{ sku: 'A', physicalQty: 10, alasan: 'Sesuai hitungan fisik' }]);
  });
});

describe('stockCard', () => {
  const mv = (id: string, tanggal: string, qty: number, lokasi = 'Gudang Utama') => ({ id, tanggal, sku: 'A', qty, lokasi });

  it('gives a running warehouse balance, newest first', () => {
    const rows = stockCard([mv('2', '2026-01-02', -3), mv('1', '2026-01-01', 10), mv('3', '2026-01-03', 5, 'Reseller: X')], 'A');
    expect(rows.map((r) => [r.id, r.balance])).toEqual([
      ['3', 7],
      ['2', 7],
      ['1', 10],
    ]);
  });
});

describe('movementTypeLabel', () => {
  it('turns stored codes into readable words', () => {
    expect(movementTypeLabel('laku_titip')).toBe('Laku titipan');
    expect(movementTypeLabel('sesuatu_baru')).toBe('Sesuatu baru');
  });
});
