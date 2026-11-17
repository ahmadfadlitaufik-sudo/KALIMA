/**
 * Titipan kata kunci dari pencarian global ke halaman tujuan.
 * Halaman yang baru dibuka mengambilnya saat mount; halaman yang sudah terbuka diberi tahu lewat subscribe.
 */
import type { AppView } from '../context/AppContext';

const pending = new Map<AppView, string>();
const listeners = new Map<AppView, Set<(query: string) => void>>();

export const pushPendingSearch = (view: AppView, query: string): void => {
  const subscribers = listeners.get(view);
  if (subscribers && subscribers.size > 0) {
    subscribers.forEach((listener) => listener(query));
    return;
  }
  pending.set(view, query);
};

export const takePendingSearch = (view: AppView): string => {
  const query = pending.get(view) ?? '';
  pending.delete(view);
  return query;
};

export const subscribePendingSearch = (view: AppView, listener: (query: string) => void): (() => void) => {
  const subscribers = listeners.get(view) ?? new Set();
  subscribers.add(listener);
  listeners.set(view, subscribers);
  return () => subscribers.delete(listener);
};
