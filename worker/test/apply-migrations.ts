import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeEach } from 'vitest';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Penyimpanan D1 tidak diisolasi per tes, jadi kosongkan semua tabel sebelum setiap tes.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM login_failures'),
    env.DB.prepare('DELETE FROM workspace_docs'),
    env.DB.prepare('DELETE FROM users'),
  ]);
});
