import { describe, expect, it } from 'vitest';
import { receivableAging, sortNewestFirst } from './financeLedger';

describe('sortNewestFirst', () => {
  it('orders by date then time, newest first, without touching the input', () => {
    const entries = [
      { id: 'a', tanggal: '2026-10-07', waktu: '15:18' },
      { id: 'b', tanggal: '2026-10-14', waktu: '11:48' },
      { id: 'c', tanggal: '2026-10-14', waktu: '11:45' },
      { id: 'd', tanggal: '2026-03-01' },
    ];
    expect(sortNewestFirst(entries).map((entry) => entry.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(entries[0].id).toBe('a');
  });

  it('keeps input order for entries on the same date and time', () => {
    const entries = [
      { id: 'first', tanggal: '2026-09-29' },
      { id: 'second', tanggal: '2026-09-29' },
    ];
    expect(sortNewestFirst(entries).map((entry) => entry.id)).toEqual(['first', 'second']);
  });
});

describe('receivableAging', () => {
  it('buckets outstanding amounts and counts by order age', () => {
    const orders = [
      { tanggal: '2026-11-15', sisaPiutang: 100 },
      { tanggal: '2026-11-08', sisaPiutang: 200 },
      { tanggal: '2026-10-25', sisaPiutang: 300 },
      { tanggal: '2026-10-01', sisaPiutang: 400 },
      { tanggal: '2026-09-01', sisaPiutang: 500 },
    ];
    expect(receivableAging(orders, '2026-11-18')).toEqual({
      under7: { total: 100, count: 1 },
      days8to14: { total: 200, count: 1 },
      days15to30: { total: 300, count: 1 },
      over30: { total: 900, count: 2 },
    });
  });
});
