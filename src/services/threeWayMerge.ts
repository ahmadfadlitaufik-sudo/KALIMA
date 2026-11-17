/**
 * Gabung tiga arah: `base` = sidik data terakhir yang sama dengan server (saat dimuat atau disimpan).
 * Record yang tidak diubah di browser ini mengikuti server (termasuk edit & hapus dari pengguna lain);
 * record yang diubah, ditambah, atau dihapus di browser ini mempertahankan versi lokal.
 */

/** Sidik per record: kunci → hash isi record. */
export type ListSnapshot = Record<string, string>;

/** Hash 53-bit (cyrb53) dari JSON nilai; cukup untuk mendeteksi perubahan. */
const hashOf = (value: unknown): string => {
  const text = JSON.stringify(value) ?? '';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/** Kunci record; string polos memakai nilainya sendiri. Kosong = record tanpa kunci (diabaikan). */
const keyOf = (item: unknown, keyField: string): string => {
  if (typeof item === 'string') {
    return item;
  }
  if (!item || typeof item !== 'object') {
    return '';
  }
  const row = item as Record<string, unknown>;
  return String(row[keyField] || row.id || row.sku || row.code || '');
};

export const snapshotList = (list: unknown[], keyField = 'id'): ListSnapshot => {
  const snapshot: ListSnapshot = {};
  for (const item of list) {
    const key = keyOf(item, keyField);
    if (key) {
      snapshot[key] = hashOf(item);
    }
  }
  return snapshot;
};

export const snapshotValue = (value: unknown): string => hashOf(value);

export const mergeList = <T>(base: ListSnapshot | undefined, local: T[], server: T[] | undefined, keyField = 'id'): T[] => {
  if (!Array.isArray(server)) {
    return local;
  }
  if (!base) {
    return server;
  }
  const localByKey = new Map<string, T>();
  for (const item of local) {
    const key = keyOf(item, keyField);
    if (key) {
      localByKey.set(key, item);
    }
  }
  const changedLocally = (key: string, item: T): boolean => base[key] !== hashOf(item);

  const result: T[] = [];
  const seen = new Set<string>();
  for (const serverItem of server) {
    const key = keyOf(serverItem, keyField);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const localItem = localByKey.get(key);
    if (localItem === undefined) {
      if (!(key in base)) {
        result.push(serverItem); // baru dari pengguna lain
      }
      continue; // sudah dihapus di browser ini
    }
    result.push(changedLocally(key, localItem) ? localItem : serverItem);
  }
  for (const [key, localItem] of localByKey) {
    if (seen.has(key)) {
      continue;
    }
    // Tidak ada di server: baru di browser ini, atau dihapus pengguna lain (kecuali kita sempat mengubahnya).
    if (!(key in base) || changedLocally(key, localItem)) {
      result.push(localItem);
    }
  }
  return result;
};

export const mergeValue = <T>(baseHash: string | undefined, local: T, server: T): T => {
  if (baseHash === undefined) {
    return server;
  }
  return hashOf(local) !== baseHash ? local : server;
};
