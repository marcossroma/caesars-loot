import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedOrigins, originAllowed } from './production-config.js';

afterEach(() => vi.unstubAllEnvs());
describe('production origins', () => {
  it('requires an explicit production origin', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', undefined);
    expect(() => allowedOrigins()).toThrow();
  });
  it('rejects wildcards and insecure production URLs', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const value of ['*', 'http://example.com', 'https://example.com/path']) {
      vi.stubEnv('CORS_ORIGIN', value);
      expect(() => allowedOrigins()).toThrow();
    }
  });
  it('matches exact origins without granting other Vercel projects access', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGIN', 'https://demo.vercel.app');
    expect(originAllowed('https://demo.vercel.app')).toBe(true);
    expect(originAllowed('https://other.vercel.app')).toBe(false);
    expect(originAllowed(undefined)).toBe(true);
  });
});
