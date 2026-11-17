/**
 * Ubah satu nilai Firestore REST (bertipe) menjadi nilai JavaScript biasa.
 * @param {Record<string, any>} value
 * @returns {any}
 */
export const fromFirestoreValue = (value) => {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields ?? {});
  throw new Error(`Tipe nilai Firestore tidak dikenal: ${Object.keys(value).join(', ')}`);
};

/**
 * Ubah `fields` dokumen Firestore REST menjadi objek biasa.
 * @param {Record<string, any>} fields
 * @returns {Record<string, any>}
 */
export const fromFirestoreFields = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));

/** Dokumen workspace yang diterima API Cloudflare. */
export const WORKSPACE_DOC_IDS = ['orders', 'stock_movements', 'master', 'finance', 'operations', 'audit_logs'];

/** Batas ukuran satu dokumen di API (byte). */
export const MAX_DOC_BYTES = 1_800_000;
