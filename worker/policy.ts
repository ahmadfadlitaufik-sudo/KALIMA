import type { WorkspaceDocId } from './workspace';
import { SessionUser } from './types';

type DocData = Record<string, unknown>;

/** Bagian yang hanya boleh diubah Owner; simpanan staf untuk bagian ini diabaikan. */
const OWNER_ONLY_FIELDS: Partial<Record<WorkspaceDocId, string[]>> = {
  master: ['series', 'skus', 'bomItems'],
  finance: ['fixedAssets', 'balanceSheetConfig'],
};

/** Bagian yang tidak dikirim ke staf sama sekali. */
const HIDDEN_FROM_STAFF: Partial<Record<WorkspaceDocId, string[]>> = {
  finance: ['fixedAssets', 'balanceSheetConfig'],
};

/** Jumlah entri jejak audit yang disimpan server (terbaru lebih dulu). */
export const AUDIT_LOG_LIMIT = 1000;

const isOwner = (user: SessionUser): boolean => user.role === 'owner';

/** Data yang boleh dilihat user ini. */
export const applyReadPolicy = (id: WorkspaceDocId, data: DocData, user: SessionUser): DocData => {
  const hidden = isOwner(user) ? [] : HIDDEN_FROM_STAFF[id] ?? [];
  if (hidden.length === 0) {
    return data;
  }
  const visible = { ...data };
  for (const field of hidden) {
    delete visible[field];
  }
  return visible;
};

/** Jejak audit hanya bertambah: entri lama tidak bisa diubah/dihapus; entri baru dicap nama & peran penyimpan. */
const appendAuditLogs = (incoming: DocData, stored: DocData | null, user: SessionUser): DocData => {
  const existing = Array.isArray(stored?.auditLogs) ? (stored!.auditLogs as DocData[]) : [];
  const existingIds = new Set(existing.map((entry) => String(entry?.id ?? '')));
  const added: DocData[] = [];
  for (const entry of Array.isArray(incoming.auditLogs) ? (incoming.auditLogs as unknown[]) : []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const id = String((entry as DocData).id ?? '');
    if (!id || existingIds.has(id)) {
      continue;
    }
    existingIds.add(id);
    added.push({ ...(entry as DocData), userName: user.name, userRole: user.role });
  }
  return { ...incoming, auditLogs: [...added, ...existing].slice(0, AUDIT_LOG_LIMIT) };
};

/** Data yang benar-benar disimpan, setelah aturan peran diterapkan pada kiriman user. */
export const applyWritePolicy = (id: WorkspaceDocId, incoming: DocData, stored: DocData | null, user: SessionUser): DocData => {
  if (id === 'audit_logs') {
    return appendAuditLogs(incoming, stored, user);
  }
  const protectedFields = isOwner(user) ? [] : OWNER_ONLY_FIELDS[id] ?? [];
  if (protectedFields.length === 0) {
    return incoming;
  }
  const result = { ...incoming };
  for (const field of protectedFields) {
    if (stored && field in stored) {
      result[field] = stored[field];
    } else {
      delete result[field];
    }
  }
  return result;
};
