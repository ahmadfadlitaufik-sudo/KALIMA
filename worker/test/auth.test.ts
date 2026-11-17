import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { OWNER_EMAIL, OWNER_PASSWORD, call, countUsers, loginAs, sessionCookie, setupOwner } from './helpers';

describe('setup', () => {
  it('creates the locked owner once, with a valid token', async () => {
    expect(await (await call('GET', '/api/setup')).json()).toEqual({ needed: true });

    const res = await call('POST', '/api/setup', { token: 'test-setup-token', name: 'Fadli', password: OWNER_PASSWORD });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { user: unknown }).user).toMatchObject({ email: OWNER_EMAIL, role: 'owner', name: 'Fadli' });
    expect(res.headers.get('set-cookie')).toMatch(/^sid=[0-9a-f]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
  });

  it('rejects a wrong token with 403 and creates nothing', async () => {
    const res = await call('POST', '/api/setup', { token: 'salah', name: 'X', password: OWNER_PASSWORD });

    expect(res.status).toBe(403);
    expect(await countUsers()).toBe(0);
  });

  it('is closed once an owner exists', async () => {
    await setupOwner();

    const replay = await call('POST', '/api/setup', { token: 'test-setup-token', name: 'Lain', password: OWNER_PASSWORD });

    expect(replay.status).toBe(403);
    expect(await countUsers()).toBe(1);
    expect(await (await call('GET', '/api/setup')).json()).toEqual({ needed: false });
  });

  it('rejects a weak owner password', async () => {
    const res = await call('POST', '/api/setup', { token: 'test-setup-token', name: 'Fadli', password: '12345678' });

    expect(res.status).toBe(400);
    expect(await countUsers()).toBe(0);
  });
});

describe('login', () => {
  it('normalizes email case and whitespace', async () => {
    await setupOwner();

    const res = await call('POST', '/api/auth/login', { email: ' AhmadFadliTaufik@Gmail.com ', password: OWNER_PASSWORD });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { email: string } }).user.email).toBe(OWNER_EMAIL);
  });

  it('rejects a wrong password with 401 and an Indonesian message', async () => {
    await setupOwner();

    const res = await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: 'salah-sekali' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Email atau kata sandi salah.' });
  });

  it('blocks the 6th attempt after 5 failures within 15 minutes', async () => {
    await setupOwner();
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: 'salah-sekali' })).status).toBe(401);
    }

    const blocked = await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });

    expect(blocked.status).toBe(429);
  });

  it('counts failures per network address, so one attacker cannot lock the owner out everywhere', async () => {
    await setupOwner();
    for (let attempt = 0; attempt < 5; attempt++) {
      await SELF.fetch('https://kalima.test/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
        body: JSON.stringify({ email: OWNER_EMAIL, password: 'salah-sekali' }),
      });
    }

    const fromOwnerNetwork = await SELF.fetch('https://kalima.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });

    expect(fromOwnerNetwork.status).toBe(200);
  });

  it('ignores failures older than 15 minutes', async () => {
    await setupOwner();
    const old = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      await env.DB.prepare('INSERT INTO login_failures (email, failed_at) VALUES (?, ?)').bind(OWNER_EMAIL, old).run();
    }

    const res = await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });

    expect(res.status).toBe(200);
  });
});

describe('session', () => {
  it('GET /api/auth/me without a cookie returns 401', async () => {
    expect((await call('GET', '/api/auth/me')).status).toBe(401);
  });

  it('GET /api/auth/me returns the logged-in user', async () => {
    const cookie = await setupOwner();

    const res = await call('GET', '/api/auth/me', undefined, cookie);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: unknown }).user).toMatchObject({ email: OWNER_EMAIL, role: 'owner' });
  });

  it('a deactivated user with a live session gets 401 on the next request', async () => {
    const cookie = await setupOwner();
    await env.DB.prepare('UPDATE users SET active = 0').run();

    expect((await call('GET', '/api/auth/me', undefined, cookie)).status).toBe(401);
  });

  it('an expired session returns 401', async () => {
    const cookie = await setupOwner();
    await env.DB.prepare('UPDATE sessions SET expires_at = ?').bind(new Date(Date.now() - 1000).toISOString()).run();

    expect((await call('GET', '/api/auth/me', undefined, cookie)).status).toBe(401);
  });

  it('logout deletes the session', async () => {
    const cookie = await setupOwner();

    const res = await call('POST', '/api/auth/logout', undefined, cookie);

    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('GET', '/api/auth/me', undefined, cookie)).status).toBe(401);
  });
});

describe('change password', () => {
  it('requires the correct current password', async () => {
    const cookie = await setupOwner();

    const res = await call('POST', '/api/auth/password', { currentPassword: 'keliru-123', newPassword: 'Baru#Sekali2026' }, cookie);

    expect(res.status).toBe(400);
  });

  it('rejects a common password with a reason', async () => {
    const cookie = await setupOwner();

    const res = await call('POST', '/api/auth/password', { currentPassword: OWNER_PASSWORD, newPassword: '12345678' }, cookie);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/kata sandi/i);
  });

  it('changes the password so only the new one works', async () => {
    const cookie = await setupOwner();

    const res = await call('POST', '/api/auth/password', { currentPassword: OWNER_PASSWORD, newPassword: 'Baru#Sekali2026' }, cookie);

    expect(res.status).toBe(204);
    expect((await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD })).status).toBe(401);
    expect(sessionCookie(await call('POST', '/api/auth/login', { email: OWNER_EMAIL, password: 'Baru#Sekali2026' }))).toMatch(/^sid=/);
    await loginAs(OWNER_EMAIL, 'Baru#Sekali2026');
  });
});

describe('routing', () => {
  it('unknown /api paths return a JSON 404', async () => {
    const res = await call('GET', '/api/tidak-ada');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Tidak ditemukan.' });
  });

  it('non-api paths are served by static assets', async () => {
    const res = await call('GET', '/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});
