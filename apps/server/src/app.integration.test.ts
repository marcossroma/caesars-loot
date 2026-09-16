import { BadRequestException, type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { TRAP_GENERATOR } from './game/game-engine.service.js';

describe('HTTP API integration', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRAP_GENERATOR)
      .useValue((count: number) => new Set(Array.from({ length: count }, (_, index) => index)))
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: errors.flatMap((error) => Object.values(error.constraints ?? {})).join(' '),
          }),
      }),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => app.close());

  const json = async <T>(
    path: string,
    init?: RequestInit,
  ): Promise<{ status: number; body: T }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
    return { status: response.status, body: (await response.json()) as T };
  };

  it('serves health and public config', async () => {
    expect((await json<{ status: string }>('/health')).body.status).toBe('ok');
    const config = await json<{ boardSize: number; allowedTrapCounts: number[] }>(
      '/api/game/config',
    );
    expect(config).toMatchObject({ status: 200, body: { boardSize: 25 } });
    expect(config.body.allowedTrapCounts).toEqual([1, 3, 5, 7, 10]);
  });

  it('runs session → start → reveal → cashout → history without leaking traps', async () => {
    const session = await json<{ sessionId: string }>('/api/session', { method: 'POST' });
    const start = await json<{ roundId: string }>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.body.sessionId, bet: 10, trapCount: 3 }),
    });
    expect(start.status).toBe(201);
    expect(JSON.stringify(start.body)).not.toContain('trapTileIds');
    const reveal = await json<{ result: string }>('/api/game/reveal', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.body.sessionId,
        roundId: start.body.roundId,
        tileId: 3,
      }),
    });
    expect(reveal.body.result).toBe('safe');
    const cashout = await json<{ status: string }>('/api/game/cashout', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.body.sessionId, roundId: start.body.roundId }),
    });
    expect(cashout.body.status).toBe('won');
    const history = await json<Array<{ roundId: string }>>(
      `/api/game/history?sessionId=${session.body.sessionId}`,
    );
    expect(history.body[0]?.roundId).toBe(start.body.roundId);
  });

  it('normalizes validation and domain errors', async () => {
    const invalid = await json<Record<string, unknown>>('/api/game/start', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'bad', bet: 2, trapCount: 2, extra: true }),
    });
    expect(invalid.status).toBe(400);
    expect(JSON.stringify(invalid.body)).toContain('VALIDATION_ERROR');
    const missing = await json<{ code: string }>(
      '/api/game/history?sessionId=8386b68c-bcb4-4e82-aaae-11fe8c299717',
    );
    expect(missing).toMatchObject({ status: 404, body: { code: 'SESSION_NOT_FOUND' } });
  });
});
