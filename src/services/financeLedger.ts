/** Urutan & pengelompokan untuk buku kas, buku OPEX, dan piutang. */

/** Salinan daftar yang diurut dari tanggal (dan jam) terbaru; urutan asli dipertahankan bila sama. */
export const sortNewestFirst = <T extends { tanggal: string; waktu?: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => {
    const keyA = `${a.tanggal} ${a.waktu ?? ''}`;
    const keyB = `${b.tanggal} ${b.waktu ?? ''}`;
    return keyA === keyB ? 0 : keyA < keyB ? 1 : -1;
  });

type AgingBucket = { total: number; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Umur piutang dihitung dari tanggal order sampai `today` (YYYY-MM-DD). */
export const receivableAging = (
  orders: { tanggal: string; sisaPiutang: number }[],
  today: string,
): { under7: AgingBucket; days8to14: AgingBucket; days15to30: AgingBucket; over30: AgingBucket } => {
  const result = {
    under7: { total: 0, count: 0 },
    days8to14: { total: 0, count: 0 },
    days15to30: { total: 0, count: 0 },
    over30: { total: 0, count: 0 },
  };
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  for (const order of orders) {
    const age = Math.floor((todayMs - Date.parse(`${order.tanggal}T00:00:00Z`)) / DAY_MS);
    const bucket = age <= 7 ? result.under7 : age <= 14 ? result.days8to14 : age <= 30 ? result.days15to30 : result.over30;
    bucket.total += order.sisaPiutang;
    bucket.count++;
  }
  return result;
};
