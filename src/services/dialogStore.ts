/**
 * Antrean dialog dalam aplikasi (pengganti window.alert/confirm/prompt).
 * Dipanggil dari mana saja; `DialogHost` menampilkan dialog yang sedang aktif.
 */

export type DialogKind = 'notice' | 'confirm' | 'password';

export type DialogRequest = {
  kind: DialogKind;
  message: string;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type DialogAnswer = boolean | string | null;
type QueuedDialog = DialogRequest & { resolve: (answer: DialogAnswer) => void };

const queue: QueuedDialog[] = [];
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((listener) => listener());

const enqueue = (request: DialogRequest): Promise<DialogAnswer> =>
  new Promise((resolve) => {
    queue.push({ ...request, resolve });
    if (queue.length === 1) {
      notify();
    }
  });

export const currentDialog = (): DialogRequest | null => queue[0] ?? null;

export const subscribeDialog = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Menutup dialog aktif dengan jawaban, lalu menampilkan dialog berikutnya. */
export const settleDialog = (answer: DialogAnswer): void => {
  const active = queue.shift();
  if (!active) {
    return;
  }
  active.resolve(answer);
  notify();
};

export const showNotice = async (message: string, title?: string): Promise<void> => {
  await enqueue({ kind: 'notice', message, title });
};

export const askConfirm = async (
  message: string,
  options: { title?: string; confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> => (await enqueue({ kind: 'confirm', message, ...options })) === true;

export const askPassword = async (message: string, title?: string): Promise<string | null> => {
  const answer = await enqueue({ kind: 'password', message, title });
  return typeof answer === 'string' && answer !== '' ? answer : null;
};
