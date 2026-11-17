import { ApiError, WorkspaceDocId } from './api';

/** Penyimpanan ditolak karena data dari server belum pernah dimuat di browser ini. */
export class NotLoadedError extends Error {
  constructor() {
    super('Data dari server belum dimuat. Perubahan disimpan di perangkat ini dan dikirim setelah tersambung.');
  }
}

interface SaverDeps {
  /** PUT dokumen dengan versi dasar; melempar ApiError (409 bila versi server sudah lebih baru). */
  saveDoc: (id: WorkspaceDocId, data: object, baseVersion: number) => Promise<{ version: number }>;
  /** Ambil dokumen terbaru dari server dan gabungkan ke data lokal (juga mencatat versinya). */
  refetch: (id: WorkspaceDocId) => Promise<void>;
  /** true setelah muat awal dari server berhasil. */
  isReady: () => boolean;
}

/**
 * Pengelola simpan dokumen workspace: kirim versi dasar, gabung-ulang sekali saat bentrok (409),
 * dan catat dokumen yang belum tersimpan agar bisa dicoba lagi.
 */
export const createWorkspaceSaver = (deps: SaverDeps) => {
  const known: Partial<Record<WorkspaceDocId, number>> = {};
  const dirty = new Set<WorkspaceDocId>();
  const inFlight = new Set<WorkspaceDocId>();

  const recordVersion = (id: WorkspaceDocId, version: number): void => {
    known[id] = Math.max(known[id] ?? 0, version);
  };

  const attempt = async (id: WorkspaceDocId, build: () => object): Promise<void> => {
    const { version } = await deps.saveDoc(id, build(), known[id] ?? 0);
    recordVersion(id, version);
  };

  /** `build` dipanggil ulang setelah gabung saat bentrok, jadi harus membaca data terbaru. */
  const save = async (id: WorkspaceDocId, build: () => object): Promise<void> => {
    dirty.add(id);
    if (!deps.isReady()) {
      throw new NotLoadedError();
    }
    inFlight.add(id);
    try {
      try {
        await attempt(id, build);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) {
          throw error;
        }
        await deps.refetch(id);
        await attempt(id, build);
      }
      dirty.delete(id);
    } finally {
      inFlight.delete(id);
    }
  };

  return {
    save,
    recordVersion,
    markDirty: (id: WorkspaceDocId) => dirty.add(id),
    knownVersions: (): Partial<Record<WorkspaceDocId, number>> => ({ ...known }),
    /** Dokumen yang perlu (di)simpan ulang dan sedang tidak dikirim. */
    dirtyDocs: (): WorkspaceDocId[] => [...dirty].filter((id) => !inFlight.has(id)),
  };
};

export type WorkspaceSaver = ReturnType<typeof createWorkspaceSaver>;
