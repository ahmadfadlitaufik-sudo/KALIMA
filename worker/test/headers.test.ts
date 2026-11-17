import { describe, expect, it } from 'vitest';
import { call } from './helpers';

describe('security headers', () => {
  it.each(['/', '/api/auth/me'])('are sent on %s', async (path) => {
    const res = await call('GET', path);

    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toMatch(/^max-age=\d+/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
