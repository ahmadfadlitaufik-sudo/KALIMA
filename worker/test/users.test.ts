import { beforeEach, describe, expect, it } from 'vitest';
import { OWNER_EMAIL, call, loginAs, setupOwner } from './helpers';

interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'admin';
  active: boolean;
  createdAt: string;
}

let ownerCookie: string;

const createUser = (body: Record<string, unknown>) => call('POST', '/api/users', body, ownerCookie);

const createSiti = async (): Promise<StaffUser> => {
  const res = await createUser({ email: 'siti@kalima.id', name: 'Siti', role: 'admin', password: 'Admin#Kalima1' });
  return ((await res.json()) as { user: StaffUser }).user;
};

const ownerId = async (): Promise<number> => {
  const res = await call('GET', '/api/users', undefined, ownerCookie);
  const { users } = (await res.json()) as { users: StaffUser[] };
  return users.find((u) => u.email === OWNER_EMAIL)!.id;
};

beforeEach(async () => {
  ownerCookie = await setupOwner();
});

describe('users API', () => {
  it('rejects an admin on every route with 403', async () => {
    const siti = await createSiti();
    const adminCookie = await loginAs('siti@kalima.id', 'Admin#Kalima1');

    expect((await call('GET', '/api/users', undefined, adminCookie)).status).toBe(403);
    expect((await call('POST', '/api/users', { email: 'x@y.id', name: 'X', role: 'admin', password: 'Admin#Kalima1' }, adminCookie)).status).toBe(403);
    expect((await call('PATCH', `/api/users/${siti.id}`, { name: 'Z' }, adminCookie)).status).toBe(403);
    expect((await call('POST', `/api/users/${siti.id}/password`, { password: 'Baru#Kalima1' }, adminCookie)).status).toBe(403);
    expect((await call('DELETE', `/api/users/${siti.id}`, undefined, adminCookie)).status).toBe(403);
  });

  it('stores a normalized email and refuses a case-variant duplicate with 409', async () => {
    const res = await createUser({ email: ' Siti@Kalima.ID ', name: 'Siti', role: 'admin', password: 'Admin#Kalima1' });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { user: StaffUser }).user.email).toBe('siti@kalima.id');

    const duplicate = await createUser({ email: 'SITI@kalima.id', name: 'Siti 2', role: 'admin', password: 'Admin#Kalima1' });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: 'Email ini sudah terdaftar.' });
  });

  it('rejects a weak password and an invalid role with 400', async () => {
    expect((await createUser({ email: 'a@b.id', name: 'A', role: 'admin', password: '12345678' })).status).toBe(400);
    expect((await createUser({ email: 'a@b.id', name: 'A', role: 'superadmin', password: 'Admin#Kalima1' })).status).toBe(400);
    expect((await createUser({ email: 'bukan-email', name: 'A', role: 'admin', password: 'Admin#Kalima1' })).status).toBe(400);
  });

  it('never returns password hash or salt', async () => {
    await createSiti();

    const text = await (await call('GET', '/api/users', undefined, ownerCookie)).text();

    expect(text).not.toMatch(/password_hash|salt/);
    expect(JSON.parse(text).users).toHaveLength(2);
  });

  it('deactivating a user ends their sessions', async () => {
    const siti = await createSiti();
    const adminCookie = await loginAs('siti@kalima.id', 'Admin#Kalima1');

    const res = await call('PATCH', `/api/users/${siti.id}`, { active: false }, ownerCookie);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: StaffUser }).user.active).toBe(false);
    expect((await call('GET', '/api/auth/me', undefined, adminCookie)).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'siti@kalima.id', password: 'Admin#Kalima1' })).status).toBe(401);
  });

  it('updates name and role', async () => {
    const siti = await createSiti();

    const res = await call('PATCH', `/api/users/${siti.id}`, { name: 'Siti Rahma', role: 'owner' }, ownerCookie);

    expect(((await res.json()) as { user: StaffUser }).user).toMatchObject({ name: 'Siti Rahma', role: 'owner', active: true });
  });

  it('stops the owner from demoting, deactivating or deleting themself', async () => {
    const id = await ownerId();

    expect((await call('PATCH', `/api/users/${id}`, { role: 'admin' }, ownerCookie)).status).toBe(400);
    expect((await call('PATCH', `/api/users/${id}`, { active: false }, ownerCookie)).status).toBe(400);
    const del = await call('DELETE', `/api/users/${id}`, undefined, ownerCookie);
    expect(del.status).toBe(400);
    expect(await del.json()).toEqual({ error: 'Tidak bisa mengubah akun Anda sendiri.' });
  });

  it('lets the owner rename themself', async () => {
    const id = await ownerId();

    expect((await call('PATCH', `/api/users/${id}`, { name: 'Ahmad Fadli' }, ownerCookie)).status).toBe(200);
  });

  it('resetting a password replaces the old one and ends sessions', async () => {
    const siti = await createSiti();
    const adminCookie = await loginAs('siti@kalima.id', 'Admin#Kalima1');

    const res = await call('POST', `/api/users/${siti.id}/password`, { password: 'Baru#Kalima1' }, ownerCookie);

    expect(res.status).toBe(204);
    expect((await call('GET', '/api/auth/me', undefined, adminCookie)).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'siti@kalima.id', password: 'Admin#Kalima1' })).status).toBe(401);
    await loginAs('siti@kalima.id', 'Baru#Kalima1');
  });

  it('deletes a user', async () => {
    const siti = await createSiti();

    expect((await call('DELETE', `/api/users/${siti.id}`, undefined, ownerCookie)).status).toBe(204);
    expect((await call('PATCH', `/api/users/${siti.id}`, { name: 'X' }, ownerCookie)).status).toBe(404);
  });
});
