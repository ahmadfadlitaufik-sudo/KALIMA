import { requireOwner, setPassword } from './auth';
import { hashPassword, isAcceptablePassword, randomHex } from './crypto';
import { HttpError, json, noContent, normalizeEmail, readJson } from './http';
import { Env, SessionUser, UserRole } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: UserRole[] = ['owner', 'admin'];
const SELF_CHANGE_ERROR = 'Tidak bisa mengubah akun Anda sendiri.';

interface StaffRow {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: number;
  created_at: string;
}

const STAFF_COLUMNS = 'id, email, name, role, active, created_at';

const toStaffUser = (row: StaffRow) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  active: row.active === 1,
  createdAt: row.created_at,
});

const findUser = async (env: Env, id: number): Promise<StaffRow> => {
  const row = await env.DB.prepare(`SELECT ${STAFF_COLUMNS} FROM users WHERE id = ?`).bind(id).first<StaffRow>();
  if (!row) {
    throw new HttpError(404, 'Pengguna tidak ditemukan.');
  }
  return row;
};

const endSessions = (env: Env, userId: number) =>
  env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

const listUsers = async (env: Env): Promise<Response> => {
  const { results } = await env.DB.prepare(`SELECT ${STAFF_COLUMNS} FROM users ORDER BY email`).all<StaffRow>();
  return json({ users: results.map(toStaffUser) });
};

const createUser = async (req: Request, env: Env, owner: SessionUser): Promise<Response> => {
  const body = await readJson<{ email: string; name: string; role: UserRole; password: string }>(req);
  const email = normalizeEmail(body.email);
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Format email tidak valid.');
  }
  if (!ROLES.includes(body.role as UserRole)) {
    throw new HttpError(400, 'Peran tidak valid.');
  }
  const reason = isAcceptablePassword(body.password);
  if (reason) {
    throw new HttpError(400, reason);
  }
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) {
    throw new HttpError(409, 'Email ini sudah terdaftar.');
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email;
  const salt = randomHex(16);
  const row = await env.DB.prepare(
    `INSERT INTO users (email, name, role, active, password_hash, salt, created_at, created_by)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?) RETURNING ${STAFF_COLUMNS}`,
  )
    .bind(email, name, body.role, await hashPassword(body.password as string, salt), salt, new Date().toISOString(), owner.email)
    .first<StaffRow>();
  return json({ user: toStaffUser(row!) }, 201);
};

const updateUser = async (req: Request, env: Env, owner: SessionUser, id: number): Promise<Response> => {
  const current = await findUser(env, id);
  const body = await readJson<{ name: string; role: UserRole; active: boolean }>(req);

  const isSelf = id === owner.id;
  const changesRole = body.role !== undefined && body.role !== current.role;
  const changesActive = body.active !== undefined && body.active !== (current.active === 1);
  if (isSelf && (changesRole || changesActive)) {
    throw new HttpError(400, SELF_CHANGE_ERROR);
  }
  if (body.role !== undefined && !ROLES.includes(body.role)) {
    throw new HttpError(400, 'Peran tidak valid.');
  }
  if (body.active !== undefined && typeof body.active !== 'boolean') {
    throw new HttpError(400, 'Status tidak valid.');
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : current.name;
  const role = body.role ?? current.role;
  const active = body.active === undefined ? current.active : body.active ? 1 : 0;
  const row = await env.DB.prepare(`UPDATE users SET name = ?, role = ?, active = ? WHERE id = ? RETURNING ${STAFF_COLUMNS}`)
    .bind(name, role, active, id)
    .first<StaffRow>();
  if (active === 0) {
    await endSessions(env, id);
  }
  return json({ user: toStaffUser(row!) });
};

const resetPassword = async (req: Request, env: Env, id: number): Promise<Response> => {
  await findUser(env, id);
  const body = await readJson<{ password: string }>(req);
  const reason = isAcceptablePassword(body.password);
  if (reason) {
    throw new HttpError(400, reason);
  }
  await setPassword(env, id, body.password as string);
  await endSessions(env, id);
  return noContent();
};

const deleteUser = async (env: Env, owner: SessionUser, id: number): Promise<Response> => {
  if (id === owner.id) {
    throw new HttpError(400, SELF_CHANGE_ERROR);
  }
  await findUser(env, id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return noContent();
};

/** Tangani /api/users* (khusus Owner); kembalikan null bila jalur bukan milik modul ini. */
export const handleUsers = async (req: Request, env: Env, path: string): Promise<Response | null> => {
  if (path !== '/api/users' && !path.startsWith('/api/users/')) {
    return null;
  }
  const owner = await requireOwner(req, env);

  if (path === '/api/users') {
    if (req.method === 'GET') {
      return listUsers(env);
    }
    if (req.method === 'POST') {
      return createUser(req, env, owner);
    }
    return null;
  }

  const match = path.match(/^\/api\/users\/(\d+)(\/password)?$/);
  if (!match) {
    return null;
  }
  const id = Number(match[1]);
  if (match[2]) {
    return req.method === 'POST' ? resetPassword(req, env, id) : null;
  }
  if (req.method === 'PATCH') {
    return updateUser(req, env, owner, id);
  }
  if (req.method === 'DELETE') {
    return deleteUser(env, owner, id);
  }
  return null;
};
