import { describe, expect, it } from 'vitest';
import { InMemorySessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  it('creates unique sessions with 1,000 demo credits', async () => {
    const service = new SessionService(new InMemorySessionRepository());
    const first = await service.create();
    const second = await service.create();
    expect(first.demoCredits).toBe(1000);
    expect(first.sessionId).not.toBe(second.sessionId);
  });

  it('rejects an unknown session with a structured domain error', async () => {
    const service = new SessionService(new InMemorySessionRepository());
    await expect(service.require('missing')).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
      status: 404,
    });
  });
});
