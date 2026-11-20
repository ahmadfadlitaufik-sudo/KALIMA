/** Waktu catatan audit dalam "YYYY-MM-DD HH:mm" waktu setempat; teks yang sudah berformat itu dibiarkan. */
export const formatAuditTime = (timestamp: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(timestamp)) {
    return timestamp;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
