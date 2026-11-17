import { WorkspaceDocId } from './api';

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
