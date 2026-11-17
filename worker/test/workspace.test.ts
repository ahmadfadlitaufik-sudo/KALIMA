import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { call, loginAs, setupOwner } from './helpers';
import { hashPassword } from '../crypto';

const put = async (cookie: string, id: string, data: unknown) =>
  call('PUT', `/api/workspace/${id}`, { data }, cookie);

const createAdmin = async (): Promise<string> => {
  const salt = '00112233445566778899aabbccddeeff';
  await env.DB.prepare(
    `INSERT INTO users (email, name, role, active, password_hash, salt, created_at) VALUES ('siti@kalima.id', 'Siti', 'admin', 1, ?, ?, ?)`,
  )
    .bind(await hashPassword('Admin#Kalima1', salt), salt, new Date().toISOString())
    .run();
  return loginAs('siti@kalima.id', 'Admin#Kalima1');
};

describe('workspace API', () => {
  it('requires a session for all three endpoints', async () => {
    expect((await call('GET', '/api/workspace')).status).toBe(401);
    expect((await call('GET', '/api/workspace/versions')).status).toBe(401);
    expect((await call('PUT', '/api/workspace/orders', { data: {} })).status).toBe(401);
  });

  it('round-trips data and bumps the version on every save', async () => {
    const cookie = await setupOwner();

    expect(await (await put(cookie, 'orders', { orders: [{ id: 'o1' }] })).json()).toMatchObject({ version: 1 });
    expect(await (await put(cookie, 'orders', { orders: [] })).json()).toMatchObject({ version: 2 });

    const all = (await (await call('GET', '/api/workspace', undefined, cookie)).json()) as {
      docs: Record<string, { data: unknown; version: number; updatedAt: string }>;
    };
    expect(all.docs.orders).toMatchObject({ data: { orders: [] }, version: 2 });
    expect(typeof all.docs.orders.updatedAt).toBe('string');
    expect(await (await call('GET', '/api/workspace/versions', undefined, cookie)).json()).toEqual({ versions: { orders: 2 } });
  });

  it('records who saved last', async () => {
    const cookie = await setupOwner();

    await put(cookie, 'master', { skus: [] });

    const row = await env.DB.prepare("SELECT updated_by FROM workspace_docs WHERE id = 'master'").first<{ updated_by: string }>();
    expect(row?.updated_by).toBe('ahmadfadlitaufik@gmail.com');
  });

  it('rejects an unknown document id with 404', async () => {
    const cookie = await setupOwner();

    expect((await put(cookie, 'main', {})).status).toBe(404);
  });

  it('rejects a body over 1,800,000 bytes with 413', async () => {
    const cookie = await setupOwner();
    const bigData = { orders: ['x'.repeat(1_800_001)] };

    const res = await put(cookie, 'orders', bigData);

    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toMatch(/^Data terlalu besar/);
  });

  it('rejects data that is not an object with 400', async () => {
    const cookie = await setupOwner();

    expect((await put(cookie, 'orders', [1, 2])).status).toBe(400);
    expect((await put(cookie, 'orders', 'teks')).status).toBe(400);
  });

  it('lets an admin save (owner-only is not enforced here)', async () => {
    await setupOwner();
    const adminCookie = await createAdmin();

    expect((await put(adminCookie, 'finance', { cashAccounts: [] })).status).toBe(200);
  });
});
