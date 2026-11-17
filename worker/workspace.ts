import { requireUser } from './auth';
import { applyReadPolicy, applyWritePolicy } from './policy';
import { HttpError, json } from './http';
import { Env, SessionUser } from './types';

export const WORKSPACE_DOC_IDS = ['orders', 'stock_movements', 'master', 'finance', 'operations', 'audit_logs'] as const;
export type WorkspaceDocId = (typeof WORKSPACE_DOC_IDS)[number];

const MAX_BODY_BYTES = 1_800_000;

const isWorkspaceDocId = (id: string): id is WorkspaceDocId =>
  (WORKSPACE_DOC_IDS as readonly string[]).includes(id);

interface DocRow {
  id: WorkspaceDocId;
  data: string;
  version: number;
  updated_at: string;
}

const readAll = async (env: Env, user: SessionUser): Promise<Response> => {
  const { results } = await env.DB.prepare('SELECT id, data, version, updated_at FROM workspace_docs').all<DocRow>();
  const docs: Record<string, { data: unknown; version: number; updatedAt: string }> = {};
  for (const row of results) {
    docs[row.id] = { data: applyReadPolicy(row.id, JSON.parse(row.data), user), version: row.version, updatedAt: row.updated_at };
  }
  return json({ docs });
};

const readVersions = async (env: Env): Promise<Response> => {
  const { results } = await env.DB.prepare('SELECT id, version FROM workspace_docs').all<Pick<DocRow, 'id' | 'version'>>();
  const versions: Record<string, number> = {};
  for (const row of results) {
    versions[row.id] = row.version;
  }
  return json({ versions });
};

const saveDoc = async (req: Request, env: Env, id: WorkspaceDocId, user: SessionUser): Promise<Response> => {
  const email = user.email;
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Data terlalu besar untuk disimpan (maksimal 1,8 MB per bagian). Hubungi pengembang.');
  }

  let data: unknown;
  let baseVersion: unknown;
  try {
    ({ data, baseVersion } = JSON.parse(raw) as { data?: unknown; baseVersion?: unknown });
  } catch {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }
  if (baseVersion !== undefined && (!Number.isInteger(baseVersion) || (baseVersion as number) < 0)) {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }

  const storedRow = await env.DB.prepare('SELECT data FROM workspace_docs WHERE id = ?').bind(id).first<{ data: string }>();
  const stored = storedRow ? (JSON.parse(storedRow.data) as Record<string, unknown>) : null;
  const updatedAt = new Date().toISOString();
  const payload = JSON.stringify(applyWritePolicy(id, data as Record<string, unknown>, stored, user));
  let row: { version: number } | null;
  if (baseVersion === undefined) {
    // Tanpa versi dasar (skrip impor): timpa apa adanya.
    row = await env.DB.prepare(
      `INSERT INTO workspace_docs (id, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, version = workspace_docs.version + 1,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by
       RETURNING version`,
    ).bind(id, payload, updatedAt, email).first<{ version: number }>();
  } else if (baseVersion === 0) {
    row = await env.DB.prepare(
      `INSERT INTO workspace_docs (id, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO NOTHING RETURNING version`,
    ).bind(id, payload, updatedAt, email).first<{ version: number }>();
  } else {
    row = await env.DB.prepare(
      `UPDATE workspace_docs SET data = ?, version = version + 1, updated_at = ?, updated_by = ?
       WHERE id = ? AND version = ? RETURNING version`,
    ).bind(payload, updatedAt, email, id, baseVersion).first<{ version: number }>();
  }

  if (!row) {
    // Orang lain sudah menyimpan lebih dulu: klien harus ambil, gabungkan, lalu simpan ulang.
    const current = await env.DB.prepare('SELECT version FROM workspace_docs WHERE id = ?').bind(id).first<{ version: number }>();
    return json({ error: 'Data sudah diubah pengguna lain. Memuat ulang lalu menyimpan lagi.', version: current?.version ?? 0 }, 409);
  }
  return json({ version: row.version, updatedAt });
};

/** Tangani /api/workspace*; kembalikan null bila jalur bukan milik modul ini. */
export const handleWorkspace = async (req: Request, env: Env, path: string): Promise<Response | null> => {
  if (path !== '/api/workspace' && !path.startsWith('/api/workspace/')) {
    return null;
  }
  const user = await requireUser(req, env);

  if (req.method === 'GET' && path === '/api/workspace') {
    return readAll(env, user);
  }
  if (req.method === 'GET' && path === '/api/workspace/versions') {
    return readVersions(env);
  }
  const id = path.slice('/api/workspace/'.length);
  if (req.method === 'PUT' && isWorkspaceDocId(id)) {
    return saveDoc(req, env, id, user);
  }
  return null;
};
