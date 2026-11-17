import { describe, expect, it, vi } from 'vitest';
import { docsToRefetch, isFreshBrowser, loadSyncBase, markServerLoaded, pickInitial, snapshotDoc } from './workspaceSync';

const PREFIX = 'kalima_app_v1_';
const memoryStorage = (entries: Record<string, string>) => ({
  getItem: (key: string) => (key in entries ? entries[key] : null),
});

describe('isFreshBrowser', () => {
  it('is true when only non-data keys are cached', () => {
    expect(isFreshBrowser(memoryStorage({ [`${PREFIX}theme`]: 'light' }), PREFIX)).toBe(true);
  });

  it('stays true when seeds were cached but no server load ever finished', () => {
    expect(isFreshBrowser(memoryStorage({ [`${PREFIX}orders`]: '[]', [`${PREFIX}cash_accounts`]: '[]' }), PREFIX)).toBe(true);
  });

  it('is false once a server load has finished in this browser', () => {
    const storage = { entries: {} as Record<string, string>, getItem(key: string) { return this.entries[key] ?? null; }, setItem(key: string, value: string) { this.entries[key] = value; } };

    markServerLoaded(storage, PREFIX);

    expect(isFreshBrowser(storage, PREFIX)).toBe(false);
  });
});

describe('pickInitial', () => {
  it('takes server data on a fresh browser, ignoring seeds', () => {
    const merge = vi.fn();

    expect(pickInitial(true, [{ id: 'seed' }], [{ id: 'real' }], merge)).toEqual([{ id: 'real' }]);
    expect(merge).not.toHaveBeenCalled();
  });

  it('merges local and server data on a browser with a cache', () => {
    const merged = pickInitial(false, [{ id: 'a' }], [{ id: 'b' }], (local, server) => [...local, ...server]);

    expect(merged).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('keeps local data when the server has none', () => {
    expect(pickInitial(true, [{ id: 'seed' }], undefined, (l) => l)).toEqual([{ id: 'seed' }]);
  });
});

describe('docsToRefetch', () => {
  it('skips docs whose version equals the one our own save returned', () => {
    expect(docsToRefetch({ orders: 4, master: 2 }, { orders: 4, master: 3, finance: 1 })).toEqual(['master', 'finance']);
  });

  it('returns nothing when everything is current', () => {
    expect(docsToRefetch({ orders: 4 }, { orders: 4 })).toEqual([]);
  });
});

describe('snapshotDoc', () => {
  it('records list fields by their key field and plain values as one hash', () => {
    const base = snapshotDoc('master', { skus: [{ sku: 'A', hpp: 1 }], customers: [{ id: 'c1' }] });
    expect(Object.keys(base['master.skus'] as object)).toEqual(['A']);
    expect(Object.keys(base['master.customers'] as object)).toEqual(['c1']);
    expect(base['master.series']).toBeUndefined();

    const finance = snapshotDoc('finance', { balanceSheetConfig: { modal: 1 } });
    expect(typeof finance['finance.balanceSheetConfig']).toBe('string');
  });
});

describe('loadSyncBase', () => {
  it('returns an empty base when the stored value is missing or broken', () => {
    expect(loadSyncBase(memoryStorage({}), PREFIX)).toEqual({});
    expect(loadSyncBase(memoryStorage({ [`${PREFIX}sync_base`]: '{rusak' }), PREFIX)).toEqual({});
  });
});
