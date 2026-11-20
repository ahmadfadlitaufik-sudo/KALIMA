import { describe, expect, it } from 'vitest';
import { formatAuditTime } from './auditTime';

describe('formatAuditTime', () => {
  it('leaves already-local timestamps untouched', () => {
    expect(formatAuditTime('2026-11-18 16:41')).toBe('2026-11-18 16:41');
  });

  it('converts a UTC ISO timestamp to local "YYYY-MM-DD HH:mm"', () => {
    const iso = '2026-11-20T11:06:56.505Z';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(formatAuditTime(iso)).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`);
  });
});
