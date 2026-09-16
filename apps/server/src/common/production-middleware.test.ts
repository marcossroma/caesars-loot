import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, expect, it, vi } from 'vitest';
import { productionMiddleware } from './production-middleware.js';

afterEach(() => vi.unstubAllEnvs());
function response() {
  return Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  });
}
it('rejects unauthorized origins and sets request/security headers', () => {
  vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');
  const res = response();
  const next = vi.fn();
  productionMiddleware()(
    { method: 'POST', headers: { origin: 'https://evil.test' }, ip: 'test' } as Request,
    res as unknown as Response,
    next,
  );
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
});
it('allows ordinary traffic and returns 429 after the generous POST budget', () => {
  vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');
  const middleware = productionMiddleware();
  const next = vi.fn();
  for (let index = 0; index < 120; index++) {
    middleware(
      { method: 'POST', headers: {}, ip: 'test' } as Request,
      response() as unknown as Response,
      next,
    );
  }
  expect(next).toHaveBeenCalledTimes(120);
  const res = response();
  middleware(
    { method: 'POST', headers: {}, ip: 'test' } as Request,
    res as unknown as Response,
    next,
  );
  expect(res.status).toHaveBeenCalledWith(429);
  expect(next).toHaveBeenCalledTimes(120);
});
