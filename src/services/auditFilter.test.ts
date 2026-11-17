import { describe, expect, it } from 'vitest';
import { filterAuditLogs } from './auditFilter';

const log = (id: string, timestamp: string, userName: string, module = 'Penjualan', action = 'Input Order', detail = '') => ({
  id,
  timestamp,
  userName,
  userRole: 'staff',
  module,
  action,
  detail,
});

const logs = [
  log('1', '2026-10-01 09:00', 'Ani'),
  log('2', '2026-10-05 10:00', 'Budi', 'Inventori', 'Opname', 'SKU KL-1'),
  log('3', '2026-10-09 23:59', 'Ani', 'Auth', 'Login'),
];

describe('filterAuditLogs', () => {
  it('filters by date range inclusive of both ends', () => {
    expect(filterAuditLogs(logs, { from: '2026-10-05', to: '2026-10-09' }).map((l) => l.id)).toEqual(['2', '3']);
  });

  it('filters by user and module together', () => {
    expect(filterAuditLogs(logs, { user: 'Ani', module: 'Auth' }).map((l) => l.id)).toEqual(['3']);
  });

  it('searches action, detail and user name, ignoring case', () => {
    expect(filterAuditLogs(logs, { query: 'kl-1' }).map((l) => l.id)).toEqual(['2']);
  });

  it('returns everything without filters', () => {
    expect(filterAuditLogs(logs, {})).toHaveLength(3);
  });
});
