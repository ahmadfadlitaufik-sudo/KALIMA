import { requireUser } from './auth';
import { HttpError, json } from './http';
import { Env } from './types';

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

const readAll = async (env: Env): Promise<Response> => {
  const { results } = await env.DB.prepare('SELECT id, data, version, updated_at FROM workspace_docs').all<DocRow>();
  const docs: Record<string, { data: unknown; version: number; updatedAt: string }> = {};
  for (const row of results) {
    docs[row.id] = { data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at };
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

const saveDoc = async (req: Request, env: Env, id: WorkspaceDocId, email: string): Promise<Response> => {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Data terlalu besar untuk disimpan (maksimal 1,8 MB per bagian). Hubungi pengembang.');
  }

  let data: unknown;
  try {
    data = (JSON.parse(raw) as { data?: unknown }).data;
  } catch {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'Data yang dikirim tidak valid.');
  }

  const updatedAt = new Date().toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO workspace_docs (id, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, version = workspace_docs.version + 1,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by
     RETURNING version`,
  )
    .bind(id, JSON.stringify(data), updatedAt, email)
    .first<{ version: number }>();

  return json({ version: row!.version, updatedAt });
};

/** Tangani /api/workspace*; kembalikan null bila jalur bukan milik modul ini. */
export const handleWorkspace = async (req: Request, env: Env, path: string): Promise<Response | null> => {
  if (path !== '/api/workspace' && !path.startsWith('/api/workspace/')) {
    return null;
  }
  const user = await requireUser(req, env);

  if (req.method === 'GET' && path === '/api/workspace') {
    return readAll(env);
  }
  if (req.method === 'GET' && path === '/api/workspace/versions') {
    return readVersions(env);
  }
  const id = path.slice('/api/workspace/'.length);
  if (req.method === 'PUT' && isWorkspaceDocId(id)) {
    return saveDoc(req, env, id, user.email);
  }
  return null;
};
