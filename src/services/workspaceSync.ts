import { WorkspaceDocId } from './api';

/** Kunci cache localStorage yang menandakan browser ini pernah memuat data. */
const CACHED_DATA_KEYS = ['orders', 'movements', 'series', 'skus', 'customers', 'cash_accounts'];

/** true bila browser belum punya cache data sama sekali (mis. pertama kali membuka domain baru). */
export const isFreshBrowser = (storage: Pick<Storage, 'getItem'>, prefix: string): boolean =>
  CACHED_DATA_KEYS.every((key) => storage.getItem(`${prefix}${key}`) === null);

/**
 * Tentukan data awal: browser baru memakai data server apa adanya (tanpa data contoh),
 * browser dengan cache menggabungkan seperti biasa, dan bila server kosong pakai data lokal.
 */
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
