import { describe, expect, it } from 'vitest';
import { mergeList, mergeValue, snapshotList, snapshotValue } from './threeWayMerge';

type Row = { id: string; status?: string; nama?: string };

const order = (id: string, status = 'baru'): Row => ({ id, status });

describe('mergeList', () => {
  it('takes another user\'s edit when this browser did not touch the record', () => {
    const base = snapshotList([order('X', 'baru')]);
    const result = mergeList(base, [order('X', 'baru')], [order('X', 'dikirim')]);
    expect(result).toEqual([order('X', 'dikirim')]);
  });

  it('keeps this browser\'s unsaved edit', () => {
    const base = snapshotList([order('X', 'baru')]);
    const result = mergeList(base, [order('X', 'lunas')], [order('X', 'baru')]);
    expect(result).toEqual([order('X', 'lunas')]);
  });

  it('drops a record another user deleted', () => {
    const base = snapshotList([order('X'), order('Y')]);
    const result = mergeList(base, [order('X'), order('Y')], [order('X')]);
    expect(result).toEqual([order('X')]);
  });

  it('does not bring back a record this browser deleted', () => {
    const base = snapshotList([order('X'), order('Y')]);
    const result = mergeList(base, [order('X')], [order('X'), order('Y')]);
    expect(result).toEqual([order('X')]);
  });

  it('keeps new records from both sides', () => {
    const base = snapshotList([order('X')]);
    const result = mergeList(base, [order('X'), order('L')], [order('X'), order('S')]);
    expect(result.map((row) => row.id).sort()).toEqual(['L', 'S', 'X']);
  });

  it('keeps a local edit of a record another user deleted', () => {
    const base = snapshotList([order('X', 'baru')]);
    const result = mergeList(base, [order('X', 'lunas')], []);
    expect(result).toEqual([order('X', 'lunas')]);
  });

  it('uses the server list as-is when there is no base yet', () => {
    const result = mergeList(undefined, [order('X', 'lama'), order('Z')], [order('X', 'baru')]);
    expect(result).toEqual([order('X', 'baru')]);
  });

  it('keeps the local list when the server has no list', () => {
    const local = [order('X')];
    expect(mergeList(snapshotList([]), local, undefined)).toBe(local);
  });

  it('matches records by a custom key field', () => {
    const base = snapshotList([{ sku: 'A', hpp: 1 }], 'sku');
    const result = mergeList(base, [{ sku: 'A', hpp: 1 }], [{ sku: 'A', hpp: 2 }], 'sku');
    expect(result).toEqual([{ sku: 'A', hpp: 2 }]);
  });

  it('merges plain string lists by value', () => {
    const base = snapshotList(['Listrik', 'Air']);
    const result = mergeList(base, ['Listrik', 'Air', 'Sewa'], ['Listrik']);
    expect(result.sort()).toEqual(['Listrik', 'Sewa']);
  });
});

describe('mergeValue', () => {
  it('takes the server value when this browser did not change it', () => {
    expect(mergeValue(snapshotValue({ a: 1 }), { a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('keeps this browser\'s unsaved change', () => {
    expect(mergeValue(snapshotValue({ a: 1 }), { a: 5 }, { a: 2 })).toEqual({ a: 5 });
  });

  it('uses the server value when there is no base yet', () => {
    expect(mergeValue(undefined, { a: 5 }, { a: 2 })).toEqual({ a: 2 });
  });
});
