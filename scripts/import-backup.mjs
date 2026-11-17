/**
 * Impor 6 dokumen workspace dari file backup ke API KALIMA (Cloudflare atau lokal).
 * Meminta email & kata sandi di terminal; kata sandi dan cookie tidak pernah dicetak.
 */
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { WORKSPACE_DOC_IDS } from './firestore-values.mjs';

const [file, baseUrl] = process.argv.slice(2);
if (!file || !baseUrl) {
  console.error('Pakai: node scripts/import-backup.mjs <file-backup.json> <url-aplikasi>');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
const writeToOutput = rl._writeToOutput.bind(rl);
rl._writeToOutput = (text) => {
  if (!muted) writeToOutput(text);
};

const lines = rl[Symbol.asyncIterator]();

/** Tanya satu baris; bila `hidden`, ketikan tidak ditampilkan. */
const ask = async (question, hidden = false) => {
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write('\n');
  return value ?? '';
};

const { docs } = JSON.parse(await readFile(file, 'utf8'));
const email = (await ask('Email Owner: ')).trim();
const password = await ask('Kata sandi: ', true);
rl.close();

const login = await fetch(new URL('/api/auth/login', baseUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error(`Login gagal (${login.status}): ${(await login.json().catch(() => ({}))).error ?? ''}`);
  process.exit(1);
}
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];

for (const id of WORKSPACE_DOC_IDS) {
  if (!docs[id]) {
    console.log(`- ${id}: tidak ada di backup, dilewati`);
    continue;
  }
  const { updatedAt, ...data } = docs[id];
  const response = await fetch(new URL(`/api/workspace/${id}`, baseUrl), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`- ${id}: GAGAL (${response.status}) ${body.error ?? ''}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`- ${id}: tersimpan, versi ${body.version}`);
}
