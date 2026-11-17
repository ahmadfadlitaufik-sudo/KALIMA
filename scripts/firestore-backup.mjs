/**
 * Unduh SEMUA dokumen koleksi kalima_workspace dari Firestore lama ke backup/firestore-<waktu>.json.
 * Hanya membaca; tidak menulis apa pun ke Firestore.
 *
 * Aturan keamanan Firestore menolak baca tanpa login: isi FIRESTORE_ACCESS_TOKEN dengan access token
 * OAuth milik pemilik project agar bisa membaca. Token tidak pernah dicetak.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fromFirestoreFields } from './firestore-values.mjs';

const PROJECT_ID = 'windy-summer-d83d0';
const DATABASE_ID = 'ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824';
const API_KEY = 'AIzaSyAeeqTcvz0ALdqd5Sfx8B6ynyK5xfFbf6w';
const ACCESS_TOKEN = process.env.FIRESTORE_ACCESS_TOKEN ?? '';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/kalima_workspace`;

const docs = {};
let pageToken = '';
do {
  const url = new URL(BASE);
  if (!ACCESS_TOKEN) url.searchParams.set('key', API_KEY);
  url.searchParams.set('pageSize', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url, ACCESS_TOKEN ? { headers: { authorization: `Bearer ${ACCESS_TOKEN}` } } : undefined);
  if (!response.ok) {
    console.error(`Gagal membaca Firestore (${response.status}): ${await response.text()}`);
    process.exit(1);
  }
  const page = await response.json();
  for (const document of page.documents ?? []) {
    const id = document.name.split('/').pop();
    docs[id] = fromFirestoreFields(document.fields ?? {});
  }
  pageToken = page.nextPageToken ?? '';
} while (pageToken);

const exportedAt = new Date().toISOString();
const file = `backup/firestore-${exportedAt.slice(0, 16).replace(':', '-')}.json`;
await mkdir('backup', { recursive: true });
await writeFile(file, JSON.stringify({ exportedAt, docs }, null, 2));
console.log(`Tersimpan: ${file} (${Object.keys(docs).length} dokumen: ${Object.keys(docs).join(', ')})`);
