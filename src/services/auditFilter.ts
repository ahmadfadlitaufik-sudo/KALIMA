/** Saringan Jejak Audit: kata kunci, modul, pengguna, dan rentang tanggal (YYYY-MM-DD, inklusif). */
export type AuditFilter = { query?: string; module?: string; user?: string; from?: string; to?: string };

export const filterAuditLogs = <T extends { timestamp: string; userName: string; module: string; action: string; detail: string }>(
  logs: T[],
  filter: AuditFilter,
): T[] => {
  const needle = filter.query?.trim().toLowerCase() ?? '';
  return logs.filter((log) => {
    const day = log.timestamp.slice(0, 10);
    return (
      (!needle || [log.action, log.detail, log.userName].some((field) => field.toLowerCase().includes(needle))) &&
      (!filter.module || log.module === filter.module) &&
      (!filter.user || log.userName === filter.user) &&
      (!filter.from || day >= filter.from) &&
      (!filter.to || day <= filter.to)
    );
  });
};
