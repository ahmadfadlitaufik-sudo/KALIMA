import { describe, expect, it } from 'vitest';
import { askConfirm, askPassword, currentDialog, settleDialog, showNotice, subscribeDialog } from './dialogStore';

describe('dialogStore', () => {
  it('resolves a confirmation with the chosen answer and clears the dialog', async () => {
    const answer = askConfirm('Hapus vendor A?');
    expect(currentDialog()?.message).toBe('Hapus vendor A?');
    settleDialog(true);
    await expect(answer).resolves.toBe(true);
    expect(currentDialog()).toBeNull();
  });

  it('queues dialogs so a second one waits for the first', async () => {
    const first = showNotice('Satu');
    const second = askConfirm('Dua');
    expect(currentDialog()?.message).toBe('Satu');
    settleDialog(true);
    await first;
    expect(currentDialog()?.message).toBe('Dua');
    settleDialog(false);
    await expect(second).resolves.toBe(false);
  });

  it('returns the typed password, or null when cancelled', async () => {
    const typed = askPassword('Kata sandi baru');
    expect(currentDialog()?.kind).toBe('password');
    settleDialog('rahasia-baru');
    await expect(typed).resolves.toBe('rahasia-baru');
    const cancelled = askPassword('Kata sandi baru');
    settleDialog(null);
    await expect(cancelled).resolves.toBeNull();
  });

  it('notifies subscribers when the dialog changes', () => {
    let calls = 0;
    const unsubscribe = subscribeDialog(() => calls++);
    void askConfirm('X');
    settleDialog(false);
    unsubscribe();
    expect(calls).toBe(2);
  });
});
