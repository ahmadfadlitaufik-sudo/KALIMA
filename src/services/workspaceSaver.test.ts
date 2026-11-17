import { describe, expect, it, vi } from 'vitest';
import { ApiError, WorkspaceDocId } from './api';
import { NotLoadedError, createWorkspaceSaver } from './workspaceSaver';

type SaveFn = (id: WorkspaceDocId, data: object, baseVersion: number) => Promise<{ version: number }>;

const setup = (saveDoc: SaveFn, options: { ready?: boolean; refetch?: (id: WorkspaceDocId) => Promise<void> } = {}) => {
  let ready = options.ready ?? true;
  const saver = createWorkspaceSaver({
    saveDoc: vi.fn(saveDoc),
    refetch: vi.fn(options.refetch ?? (async () => {})),
    isReady: () => ready,
  });
  return { saver, setReady: (value: boolean) => { ready = value; } };
};

describe('createWorkspaceSaver', () => {
  it('sends the last known version as baseVersion and records the new one', async () => {
    const saveDoc = vi.fn<SaveFn>(async () => ({ version: 8 }));
    const { saver } = setup(saveDoc);
    saver.recordVersion('orders', 7);

    await saver.save('orders', () => ({ orders: [] }));

    expect(saveDoc).toHaveBeenCalledWith('orders', { orders: [] }, 7);
    expect(saver.knownVersions().orders).toBe(8);
  });

  it('never moves a known version backwards', () => {
    const { saver } = setup(async () => ({ version: 1 }));
    saver.recordVersion('master', 5);

    saver.recordVersion('master', 3);

    expect(saver.knownVersions().master).toBe(5);
  });

  it('on 409 refetches the document, rebuilds the data and retries once', async () => {
    let local = ['mine'];
    const saveDoc = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new ApiError(409, 'konflik'))
      .mockResolvedValueOnce({ version: 4 });
    const { saver } = setup(saveDoc, {
      refetch: async () => {
        local = ['theirs', 'mine'];
        saver.recordVersion('orders', 3);
      },
    });

    await saver.save('orders', () => ({ orders: local }));

    expect(saveDoc).toHaveBeenLastCalledWith('orders', { orders: ['theirs', 'mine'] }, 3);
    expect(saver.dirtyDocs()).toEqual([]);
  });

  it('marks a document dirty when the save fails, and clears it after a later success', async () => {
    const saveDoc = vi.fn<SaveFn>().mockRejectedValueOnce(new ApiError(0, 'offline')).mockResolvedValueOnce({ version: 1 });
    const { saver } = setup(saveDoc);

    await expect(saver.save('finance', () => ({}))).rejects.toThrow('offline');
    expect(saver.dirtyDocs()).toEqual(['finance']);

    await saver.save('finance', () => ({}));
    expect(saver.dirtyDocs()).toEqual([]);
  });

  it('refuses to save before the first server load and keeps the document dirty', async () => {
    const saveDoc = vi.fn<SaveFn>(async () => ({ version: 1 }));
    const { saver } = setup(saveDoc, { ready: false });

    await expect(saver.save('orders', () => ({ orders: ['seed'] }))).rejects.toBeInstanceOf(NotLoadedError);

    expect(saveDoc).not.toHaveBeenCalled();
    expect(saver.dirtyDocs()).toEqual(['orders']);
  });

  it('does not report a document as needing a retry while its save is still in flight', async () => {
    let finish: (value: { version: number }) => void = () => {};
    const { saver } = setup(() => new Promise((resolve) => { finish = resolve; }));
    saver.markDirty('master');

    const pending = saver.save('master', () => ({}));
    expect(saver.dirtyDocs()).toEqual([]);

    finish({ version: 1 });
    await pending;
    expect(saver.dirtyDocs()).toEqual([]);
  });
});
