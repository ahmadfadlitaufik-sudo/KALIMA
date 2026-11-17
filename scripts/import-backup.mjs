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

/** Baris dari stdin bila input berupa pipe (bukan terminal). */
let pipedLines;

/** Baca satu baris dari stdin; di terminal, `hidden` menyembunyikan ketikan (untuk kata sandi). */
const readLine = (question, hidden) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    if (!process.stdin.isTTY) {
      pipedLines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]();
      pipedLines.next().then(({ value }) => resolve(value ?? ''));
      return;
    }
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) process.stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        if (!hidden) process.stdout.write(char);
      }
    };
    process.stdin.on('data', onData);
  });

/** Tanya sampai jawabannya tidak kosong. */
const ask = async (question, hidden = false) => {
  for (;;) {
    const answer = (await readLine(question, hidden)).trim();
    if (answer) {
      return answer;
    }
  }
};

const { docs } = JSON.parse(await readFile(file, 'utf8'));
const email = await ask('Email Owner: ');
const password = await ask('Kata sandi (tidak tampil saat diketik): ', true);

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
