import { WorkspaceDocId } from './api';
import { ListSnapshot, snapshotList, snapshotValue } from './threeWayMerge';

/** Kunci localStorage yang menandakan muat awal dari server pernah berhasil di browser ini. */
const SERVER_LOADED_KEY = 'server_loaded';

/** Browser baru = muat awal dari server belum pernah berhasil di sini (cache data contoh tidak dihitung). */
export const isFreshBrowser = (storage: Pick<Storage, 'getItem'>, prefix: string): boolean =>
  storage.getItem(`${prefix}${SERVER_LOADED_KEY}`) === null;

/** Tandai bahwa data server sudah dimuat penuh di browser ini. */
export const markServerLoaded = (storage: Pick<Storage, 'setItem'>, prefix: string): void => {
  storage.setItem(`${prefix}${SERVER_LOADED_KEY}`, new Date().toISOString());
};

export const pickInitial = <T>(fresh: boolean, local: T, server: T | undefined, merge: (local: T, server: T) => T): T => {
  if (server === undefined) {
    return local;
  }
  return fresh ? server : merge(local, server);
};

/** Dokumen yang versinya di server lebih baru dari yang sudah kita ketahui. */
export const docsToRefetch = (
  known: Partial<Record<string, number>>,
  server: Partial<Record<string, number>>,
): WorkspaceDocId[] =>
  (Object.keys(server) as WorkspaceDocId[]).filter((id) => (server[id] ?? 0) > (known[id] ?? 0));

/** Isi tiap dokumen: daftar (dengan field kuncinya) atau nilai tunggal. */
export const WORKSPACE_FIELDS: Record<WorkspaceDocId, { field: string; key?: string; single?: true }[]> = {
  orders: [{ field: 'orders' }],
  stock_movements: [{ field: 'stockMovements' }],
  master: [{ field: 'series' }, { field: 'skus', key: 'sku' }, { field: 'bomItems' }, { field: 'customers' }, { field: 'resellers' }],
  finance: [
    { field: 'biayaOperasional' },
    { field: 'cashAccounts' },
    { field: 'cashMutations' },
    { field: 'bankReconciliations' },
    { field: 'journalEntries' },
    { field: 'fixedAssets' },
    { field: 'balanceSheetConfig', single: true },
    { field: 'customOpexCategories' },
  ],
  operations: [{ field: 'suratTitip' }, { field: 'laporanTitipLaku' }, { field: 'stockOpnameSessions' }, { field: 'vendors' }, { field: 'purchaseOrders' }],
  audit_logs: [{ field: 'auditLogs' }],
};

/** Sidik data yang terakhir sama dengan server, per `dokumen.field`. */
export type SyncBase = Record<string, ListSnapshot | string>;

const SYNC_BASE_KEY = 'sync_base';

/** Sidik semua field yang ada di data dokumen (dipakai sebagai dasar gabung tiga arah). */
export const snapshotDoc = (id: WorkspaceDocId, data: Record<string, unknown>): SyncBase => {
  const base: SyncBase = {};
  for (const { field, key, single } of WORKSPACE_FIELDS[id]) {
    const value = data[field];
    if (single ? value !== undefined && value !== null : Array.isArray(value)) {
      base[`${id}.${field}`] = single ? snapshotValue(value) : snapshotList(value as unknown[], key);
    }
  }
  return base;
};

export const loadSyncBase = (storage: Pick<Storage, 'getItem'>, prefix: string): SyncBase => {
  try {
    const parsed = JSON.parse(storage.getItem(`${prefix}${SYNC_BASE_KEY}`) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const storeSyncBase = (storage: Pick<Storage, 'setItem'>, prefix: string, base: SyncBase): void => {
  try {
    storage.setItem(`${prefix}${SYNC_BASE_KEY}`, JSON.stringify(base));
  } catch (err) {
    console.warn('Gagal menyimpan dasar sinkron:', err);
  }
};
