/** Ringkas isi file backup: jumlah item per daftar dan ukuran tiap dokumen. */
import { readFile } from 'node:fs/promises';
import { MAX_DOC_BYTES, WORKSPACE_DOC_IDS } from './firestore-values.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Pakai: node scripts/summarize-backup.mjs <file-backup.json>');
  process.exit(1);
}
const { exportedAt, docs } = JSON.parse(await readFile(file, 'utf8'));
console.log(`Backup ${file} (diekspor ${exportedAt})`);

for (const id of Object.keys(docs)) {
  const { updatedAt, ...data } = docs[id];
  const bytes = Buffer.byteLength(JSON.stringify(data));
  const allowed = WORKSPACE_DOC_IDS.includes(id);
  const counts = Object.entries(data)
    .map(([field, value]) => (Array.isArray(value) ? `${field}=${value.length}` : `${field}=(${typeof value})`))
    .join(', ');
  console.log(`- ${id}${allowed ? '' : ' [TIDAK DIIMPOR]'}: ${bytes.toLocaleString('id-ID')} byte; ${counts}`);
  if (bytes > MAX_DOC_BYTES) {
    console.warn(`  PERINGATAN: ${id} melebihi batas ${MAX_DOC_BYTES.toLocaleString('id-ID')} byte.`);
  }
}
for (const id of WORKSPACE_DOC_IDS.filter((docId) => !(docId in docs))) {
  console.log(`- ${id}: tidak ada di backup`);
}
