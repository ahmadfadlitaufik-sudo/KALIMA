/** Bulan (YYYY-MM) terbaru yang punya order tidak batal; bila tidak ada, pakai fallback. */
export const latestOrderMonth = (orders: { tanggal: string; statusOrder: string }[], fallback: string): string =>
  orders.reduce((latest, o) => {
    const month = o.statusOrder === 'batal' ? '' : (o.tanggal || '').substring(0, 7);
    return month.length === 7 && month > latest ? month : latest;
  }, '') || fallback;
