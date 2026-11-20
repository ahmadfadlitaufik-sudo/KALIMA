import { describe, expect, it } from 'vitest';
import { missingHppSkus, monthLabelId, oldestFirst, receivableReminder } from './financeChecks';

describe('monthLabelId', () => {
  it('names the month in Indonesian', () => {
    expect(monthLabelId('2026-10')).toBe('Oktober 2026');
  });
});

describe('missingHppSkus', () => {
  const order = (statusOrder: string, skuCodes: string[]) => ({ statusOrder, items: skuCodes.map((sku) => ({ sku, qty: 1 })) });
  const skus = [
    { sku: 'A', hpp: 0 },
    { sku: 'B', hpp: 50000 },
    { sku: 'C', hpp: 0 },
  ];
  it('lists each sold SKU whose master HPP is zero once, ignoring cancelled orders and filled HPP', () => {
    const orders = [order('selesai', ['A', 'B']), order('selesai', ['A']), order('batal', ['C'])];
    expect(missingHppSkus(orders, skus)).toEqual(['A']);
  });
});

describe('oldestFirst', () => {
  it('sorts by order date ascending without changing the input', () => {
    const input = [{ tanggal: '2026-10-05' }, { tanggal: '2026-09-01' }, { tanggal: '2026-10-01' }];
    expect(oldestFirst(input).map((o) => o.tanggal)).toEqual(['2026-09-01', '2026-10-01', '2026-10-05']);
    expect(input[0].tanggal).toBe('2026-10-05');
  });
});

describe('receivableReminder', () => {
  it('writes a polite Indonesian reminder with the order number, remaining amount and due date', () => {
    const text = receivableReminder({ noOrder: 'ORD-1', customerNama: 'Budi', sisaPiutang: 1250000, jatuhTempo: '2026-10-14' });
    expect(text).toContain('Budi');
    expect(text).toContain('ORD-1');
    expect(text).toContain('Rp 1.250.000');
    expect(text).toContain('14 Oktober 2026');
  });

  it('omits the due date when there is none', () => {
    expect(receivableReminder({ noOrder: 'ORD-2', customerNama: 'Sari', sisaPiutang: 5000 })).not.toContain('jatuh tempo');
  });
});
