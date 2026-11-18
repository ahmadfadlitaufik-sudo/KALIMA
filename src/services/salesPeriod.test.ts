import { describe, expect, it } from 'vitest';
import { latestOrderMonth } from './salesPeriod';

describe('latestOrderMonth', () => {
  it('picks the newest month that has a non-cancelled order', () => {
    const orders = [
      { tanggal: '2026-09-30', statusOrder: 'selesai' },
      { tanggal: '2026-10-05', statusOrder: 'selesai' },
      { tanggal: '2026-11-01', statusOrder: 'batal' },
    ];
    expect(latestOrderMonth(orders, '2026-11')).toBe('2026-10');
  });

  it('falls back to the given month when there are no orders', () => {
    expect(latestOrderMonth([], '2026-11')).toBe('2026-11');
  });
});
