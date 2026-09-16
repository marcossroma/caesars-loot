import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { originAllowed } from './production-config.js';

export function productionMiddleware() {
  const logger = new Logger('Http');
  const windows = new Map<string, { count: number; expires: number }>();
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    response.setHeader('x-request-id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Cache-Control', 'no-store');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    const started = Date.now();
    response.on('finish', () => {
      logger.log(
        JSON.stringify({
          event: 'request completed',
          requestId,
          method: request.method,
          status: response.statusCode,
          durationMs: Date.now() - started,
        }),
      );
    });
    if (!originAllowed(request.headers.origin)) {
      response.status(403).json({ code: 'ORIGIN_DENIED', message: 'Origin is not allowed.' });
      return;
    }
    if (request.method === 'POST') {
      const now = Date.now();
      for (const [key, entry] of windows) if (entry.expires <= now) windows.delete(key);
      const key = request.ip ?? 'unknown';
      const entry = windows.get(key) ?? { count: 0, expires: now + 60_000 };
      if (!windows.has(key) && windows.size >= 10_000) {
        response.status(429).json({ code: 'RATE_LIMITED', message: 'Please try again later.' });
        return;
      }
      entry.count += 1;
      windows.set(key, entry);
      if (entry.count > 120) {
        response.setHeader('Retry-After', Math.ceil((entry.expires - now) / 1000));
        response.status(429).json({ code: 'RATE_LIMITED', message: 'Please try again later.' });
        return;
      }
    }
    next();
  };
}
