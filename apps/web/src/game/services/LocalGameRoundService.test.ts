import { describe, expect, it } from 'vitest';
import { LocalGameRoundService } from './LocalGameRoundService';

describe('LocalGameRoundService test fallback', () => {
  it('keeps trap positions out of the public start result', async () => {
    const service = new LocalGameRoundService(() => 0);
    const session = await service.createSession();
    const round = await service.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 3 });
    expect(round).not.toHaveProperty('trapIds');
    expect(round).not.toHaveProperty('trapTileIds');
    expect(round.revealedTiles).toEqual([]);
  });

  it('returns remaining traps only after a loss', async () => {
    const service = new LocalGameRoundService(() => 0);
    const session = await service.createSession();
    const round = await service.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 });
    const safe = await service.revealTile({
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 1,
    });
    expect(safe).not.toHaveProperty('revealedTrapIds');
    const trap = await service.revealTile({
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 0,
    });
    expect(trap.revealedTrapIds).toEqual([0]);
  });
});
