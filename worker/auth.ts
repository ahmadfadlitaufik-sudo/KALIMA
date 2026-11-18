import { hashPassword, isAcceptablePassword, randomHex, sha256Hex, verifyPassword } from './crypto';
import { HttpError, getCookie, json, noContent, normalizeEmail, readJson } from './http';
import { Env, SessionUser, UserRole } from './types';

export const FIRST_OWNER_EMAIL = 'ahmadfadlitaufik@gmail.com';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const INVALID_LOGIN = 'Email atau kata sandi salah.';

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: number;
  password_hash: string;
  salt: string;
}

const toSessionUser = (row: Pick<UserRow, 'id' | 'email' | 'name' | 'role'>): SessionUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
});

const sessionCookie = (token: string): string =>
  `sid=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;

const clearedSessionCookie = 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

/** Buat sesi baru untuk user dan kembalikan header Set-Cookie. */
const createSession = async (env: Env, userId: number): Promise<string> => {
  const token = randomHex(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, expiresAt.toISOString(), now.toISOString())
    .run();
  return sessionCookie(token);
};

/** Kembalikan user dari cookie sesi; lempar 401 bila tidak ada, kedaluwarsa, atau user nonaktif. */
export const requireUser = async (req: Request, env: Env): Promise<SessionUser> => {
  const token = getCookie(req, 'sid');
  if (!token) {
    throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
  }
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.role
       FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1`,
  )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first<Pick<UserRow, 'id' | 'email' | 'name' | 'role'>>();
  if (!row) {
    throw new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.');
  }
  return toSessionUser(row);
};

export const requireOwner = async (req: Request, env: Env): Promise<SessionUser> => {
  const user = await requireUser(req, env);
  if (user.role !== 'owner') {
    throw new HttpError(403, 'Hanya Owner yang boleh melakukan ini.');
  }
  return user;
};

/** Alamat jaringan pengirim (diisi Cloudflare); kosong saat uji lokal. */
const clientIp = (req: Request): string => req.headers.get('cf-connecting-ip') ?? '';

const countRecentFailures = async (env: Env, email: string, ip: string): Promise<number> => {
  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM login_failures WHERE email = ? AND ip = ? AND failed_at > ?')
    .bind(email, ip, since)
    .first<{ total: number }>();
  return row?.total ?? 0;
};

const login = async (req: Request, env: Env): Promise<Response> => {
  const body = await readJson<{ email: string; password: string }>(req);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const ip = clientIp(req);
  if (await countRecentFailures(env, email, ip) >= MAX_FAILURES) {
    throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.');
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  const isValid = user !== null && user.active === 1 && await verifyPassword(password, user.salt, user.password_hash);
  if (!isValid) {
    await env.DB.prepare('INSERT INTO login_failures (email, ip, failed_at) VALUES (?, ?, ?)').bind(email, ip, new Date().toISOString()).run();
    throw new HttpError(401, INVALID_LOGIN);
  }

  await env.DB.prepare('DELETE FROM login_failures WHERE email = ?').bind(email).run();
  return json({ user: toSessionUser(user) }, 200, { 'set-cookie': await createSession(env, user.id) });
};

const logout = async (req: Request, env: Env): Promise<Response> => {
  const token = getCookie(req, 'sid');
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  }
  return noContent({ 'set-cookie': clearedSessionCookie });
};

const changePassword = async (req: Request, env: Env): Promise<Response> => {
  const user = await requireUser(req, env);
  const body = await readJson<{ currentPassword: string; newPassword: string }>(req);
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (!row || !await verifyPassword(currentPassword, row.salt, row.password_hash)) {
    throw new HttpError(400, 'Kata sandi lama salah.');
  }
  const reason = isAcceptablePassword(body.newPassword);
  if (reason) {
    throw new HttpError(400, reason);
  }
  await setPassword(env, user.id, body.newPassword as string);
  return noContent();
};

const MAX_NAME_LENGTH = 60;

/** Ubah nama tampilan milik sendiri; peran dan email tidak bisa diubah dari sini. */
const updateProfile = async (req: Request, env: Env): Promise<Response> => {
  const user = await requireUser(req, env);
  const body = await readJson<{ name?: unknown }>(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    throw new HttpError(400, 'Nama tidak boleh kosong.');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new HttpError(400, `Nama maksimal ${MAX_NAME_LENGTH} karakter.`);
  }
  await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, user.id).run();
  return json({ user: { ...user, name } });
};

/** Simpan kata sandi baru (hash + salt baru). */
export const setPassword = async (env: Env, userId: number, password: string): Promise<void> => {
  const salt = randomHex(16);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(await hashPassword(password, salt), salt, userId)
    .run();
};

const hasAnyUser = async (env: Env): Promise<boolean> =>
  (await env.DB.prepare('SELECT 1 FROM users LIMIT 1').first()) !== null;

const setupStatus = async (env: Env): Promise<Response> => json({ needed: !await hasAnyUser(env) });

const setup = async (req: Request, env: Env): Promise<Response> => {
  const body = await readJson<{ token: string; name: string; password: string }>(req);
  if (!env.SETUP_TOKEN || body.token !== env.SETUP_TOKEN || await hasAnyUser(env)) {
    throw new HttpError(403, 'Pengaturan awal tidak tersedia.');
  }
  const reason = isAcceptablePassword(body.password);
  if (reason) {
    throw new HttpError(400, reason);
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Owner';
  const salt = randomHex(16);
  const passwordHash = await hashPassword(body.password as string, salt);

  // INSERT ... WHERE NOT EXISTS mencegah dua permintaan setup bersamaan membuat dua Owner.
  const result = await env.DB.prepare(
    `INSERT INTO users (email, name, role, active, password_hash, salt, created_at, created_by)
     SELECT ?, ?, 'owner', 1, ?, ?, ?, 'setup' WHERE NOT EXISTS (SELECT 1 FROM users)`,
  )
    .bind(FIRST_OWNER_EMAIL, name, passwordHash, salt, new Date().toISOString())
    .run();
  if (!result.meta.changes) {
    throw new HttpError(403, 'Pengaturan awal tidak tersedia.');
  }

  const user = { id: Number(result.meta.last_row_id), email: FIRST_OWNER_EMAIL, name, role: 'owner' as const };
  return json({ user }, 201, { 'set-cookie': await createSession(env, user.id) });
};

/** Tangani /api/auth/* dan /api/setup; kembalikan null bila jalur bukan milik modul ini. */
export const handleAuth = async (req: Request, env: Env, path: string): Promise<Response | null> => {
  const route = `${req.method} ${path}`;
  switch (route) {
    case 'POST /api/auth/login':
      return login(req, env);
    case 'POST /api/auth/logout':
      return logout(req, env);
    case 'GET /api/auth/me':
      return json({ user: await requireUser(req, env) });
    case 'POST /api/auth/password':
      return changePassword(req, env);
    case 'PATCH /api/auth/profile':
      return updateProfile(req, env);
    case 'GET /api/setup':
      return setupStatus(env);
    case 'POST /api/setup':
      return setup(req, env);
    default:
      return null;
  }
};
