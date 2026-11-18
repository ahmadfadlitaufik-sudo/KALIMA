import { describe, expect, it } from 'vitest';
import { consignmentPrice, consignmentPeriodLabel, resellerReceivable, resellerStockSummary } from './resellerConsignment';

describe('consignmentPrice', () => {
  it('applies the partner discount to the retail price', () => {
    expect(consignmentPrice(150_000, 25)).toBe(112_500);
    expect(consignmentPrice(150_000, 20)).toBe(120_000);
  });

  it('falls back to 20% when the partner has no discount set', () => {
    expect(consignmentPrice(100_000, undefined)).toBe(80_000);
  });
});

describe('resellerStockSummary', () => {
  const skus = [
    { sku: 'A', price: 150_000, hpp: 60_000 },
    { sku: 'B', price: 100_000, hpp: 40_000 },
  ];

  it('values stock at HPP and at the partner price, ignoring minus stock', () => {
    expect(resellerStockSummary({ A: 2, B: -3, C: 1 }, skus, 20)).toEqual({ pcs: 3, hppValue: 120_000, consignmentValue: 240_000 });
  });
});

describe('resellerReceivable', () => {
  const order = (customerId: string, sisaPiutang: number, statusOrder = 'selesai') => ({ customerId, sisaPiutang, statusOrder });

  it('counts unpaid orders of the partner and of customers linked to it, skipping cancelled ones', () => {
    const orders = [order('res-1', 100), order('cust-9', 50), order('cust-9', 70, 'batal'), order('cust-2', 30)];
    const customers = [
      { id: 'cust-9', resellerIdRef: 'res-1' },
      { id: 'cust-2', resellerIdRef: undefined },
    ];
    expect(resellerReceivable('res-1', orders, customers)).toBe(150);
  });
});

describe('consignmentPeriodLabel', () => {
  it('names the month in Indonesian', () => {
    expect(consignmentPeriodLabel(new Date(2026, 10, 18))).toBe('November 2026');
  });
});
