import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../services/api/ApiClient';
import { ApiGameRoundService } from './ApiGameRoundService';

afterEach(() => vi.unstubAllGlobals());

describe('ApiGameRoundService', () => {
  it('sends commands through the central API client and parses public responses', async () => {
    const payload = {
      roundId: 'round-1',
      status: 'active',
      bet: 10,
      trapCount: 3,
      multiplier: 1,
      potentialLoot: 10,
      demoCredits: 990,
      revealedTiles: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new ApiGameRoundService(new ApiClient('http://api.test'));
    await expect(
      service.startRound({ sessionId: 'session-1', bet: 10, trapCount: 3 }),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/game/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('converts structured API failures without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'ROUND_ALREADY_FINISHED', message: 'Finished.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient('http://api.test');
    await expect(client.post('/api/game/cashout', {})).rejects.toMatchObject({
      code: 'ROUND_ALREADY_FINISHED',
      status: 409,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
