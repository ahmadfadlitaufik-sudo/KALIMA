import { SELF, env } from 'cloudflare:test';

export const OWNER_EMAIL = 'ahmadfadlitaufik@gmail.com';
export const OWNER_PASSWORD = 'Rahasia#2026';

/** Kirim permintaan ke Worker utama; `cookie` berupa nilai header Cookie. */
export const call = (method: string, path: string, body?: unknown, cookie?: string): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (cookie) {
    headers.cookie = cookie;
  }
  return SELF.fetch(`https://kalima.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
};

/** Ambil "sid=..." dari header Set-Cookie. */
export const sessionCookie = (res: Response): string => {
  const header = res.headers.get('set-cookie') ?? '';
  return header.split(';')[0];
};

/** Buat Owner lewat /api/setup dan kembalikan cookie sesinya. */
export const setupOwner = async (): Promise<string> => {
  const res = await call('POST', '/api/setup', { token: 'test-setup-token', name: 'Fadli', password: OWNER_PASSWORD });
  if (res.status !== 201) {
    throw new Error(`setup gagal: ${res.status} ${await res.text()}`);
  }
  return sessionCookie(res);
};

/** Login dan kembalikan cookie sesi. */
export const loginAs = async (email: string, password: string): Promise<string> => {
  const res = await call('POST', '/api/auth/login', { email, password });
  if (res.status !== 200) {
    throw new Error(`login gagal: ${res.status} ${await res.text()}`);
  }
  return sessionCookie(res);
};

export const countUsers = async (): Promise<number> => {
  const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  return row?.total ?? 0;
};
