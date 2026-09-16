import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryRoundRepository } from '../round/round.repository.js';
import { InMemoryRoundEventRepository } from '../round/round-event.repository.js';
import { InMemorySessionRepository } from '../session/session.repository.js';
import { SessionService } from '../session/session.service.js';
import { GameEventPublisher } from '../realtime/game-event.publisher.js';
import { InMemoryGameUnitOfWork } from '../database/game-unit-of-work.js';
import { GameEngineService } from './game-engine.service.js';

describe('GameEngineService', () => {
  let sessions: InMemorySessionRepository;
  let sessionService: SessionService;
  let rounds: InMemoryRoundRepository;
  let game: GameEngineService;

  beforeEach(() => {
    sessions = new InMemorySessionRepository();
    sessionService = new SessionService(sessions);
    rounds = new InMemoryRoundRepository();
    const roundEvents = new InMemoryRoundEventRepository();
    game = new GameEngineService(
      sessionService,
      sessions,
      rounds,
      new InMemoryGameUnitOfWork({ sessions, rounds, events: roundEvents }),
      (count: number) => new Set(Array.from({ length: count }, (_, index) => index)),
      new GameEventPublisher(),
    );
  });

  it('starts a valid authoritative round and protects double start', async () => {
    const session = await sessionService.create();
    const result = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    expect(result).toMatchObject({ demoCredits: 990, revealedTiles: [] });
    expect(result).not.toHaveProperty('trapTileIds');
    await expect(
      game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 }),
    ).rejects.toMatchObject({ code: 'ROUND_ALREADY_ACTIVE' });
  });

  it('rejects invalid inputs and insufficient credits', async () => {
    const session = await sessionService.create();
    await expect(
      game.startRound({ sessionId: session.sessionId, bet: 2, trapCount: 3 }),
    ).rejects.toMatchObject({ code: 'INVALID_BET' });
    await expect(
      game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 2 }),
    ).rejects.toMatchObject({ code: 'INVALID_TRAP_COUNT' });
    const model = await sessionService.require(session.sessionId);
    model.demoCredits = 0;
    await sessions.update(model);
    await expect(
      game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_DEMO_CREDITS' });
  });

  it('validates reveal ownership, range, repeat and finished state', async () => {
    const session = await sessionService.create();
    const other = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 });
    await expect(
      game.revealTile({ sessionId: other.sessionId, roundId: round.roundId, tileId: 1 }),
    ).rejects.toMatchObject({ code: 'ROUND_SESSION_MISMATCH' });
    await expect(
      game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 25 }),
    ).rejects.toMatchObject({ code: 'INVALID_TILE' });
    await expect(
      game.revealTile({
        sessionId: session.sessionId,
        roundId: '196dbd32-aef3-4682-a8ce-c3936ace0a49',
        tileId: 1,
      }),
    ).rejects.toMatchObject({ code: 'ROUND_NOT_FOUND' });
    const safe = await game.revealTile({
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 1,
    });
    expect(safe).toMatchObject({ result: 'safe', status: 'active', revealedTiles: [1] });
    await expect(
      game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 1 }),
    ).rejects.toMatchObject({ code: 'TILE_ALREADY_REVEALED' });
    const trap = await game.revealTile({
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 0,
    });
    expect(trap).toMatchObject({ result: 'trap', status: 'lost', revealedTrapIds: [0] });
    await expect(
      game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 2 }),
    ).rejects.toMatchObject({ code: 'ROUND_ALREADY_FINISHED' });
  });

  it('requires a safe reveal before cashout', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    await expect(
      game.cashOut({ sessionId: session.sessionId, roundId: round.roundId }),
    ).rejects.toMatchObject({ code: 'CASHOUT_NOT_AVAILABLE' });
  });

  it('persists safe reveal, cashout, credits and history', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    const safe = await game.revealTile({
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 3,
    });
    const cashout = await game.cashOut({ sessionId: session.sessionId, roundId: round.roundId });
    expect(safe.result).toBe('safe');
    expect(cashout.demoCredits).toBe(990 + cashout.payout);
    expect(await game.getHistory(session.sessionId)).toEqual([
      expect.objectContaining({ roundId: round.roundId, result: 'won' }),
    ]);
  });

  it('records loss and resynchronizes without active trap leakage', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 3 });
    const active = await game.getSessionState(session.sessionId);
    expect(active.activeRound).toMatchObject({ revealedTiles: [3] });
    expect(JSON.stringify(active)).not.toContain('trapTileIds');
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 0 });
    const finished = await game.getSessionState(session.sessionId);
    expect(finished.activeRound).toBeNull();
    expect(finished.lastCompletedRound).toMatchObject({
      status: 'lost',
      revealedTrapIds: [0, 1, 2],
    });
    expect(await game.getHistory(session.sessionId)).toEqual([
      expect.objectContaining({ result: 'lost' }),
    ]);
  });

  it('settles exactly one of two concurrent cashouts', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 3 });
    const results = await Promise.allSettled([
      game.cashOut({ sessionId: session.sessionId, roundId: round.roundId }),
      game.cashOut({ sessionId: session.sessionId, roundId: round.roundId }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const current = await sessionService.require(session.sessionId);
    const history = await game.getHistory(session.sessionId);
    expect(current.demoCredits).toBe(990 + history[0]!.payout);
  });

  it('accepts only one simultaneous repeat reveal', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    const input = { sessionId: session.sessionId, roundId: round.roundId, tileId: 3 };
    const results = await Promise.allSettled([game.revealTile(input), game.revealTile(input)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('enforces cashout ownership and finished-round idempotency', async () => {
    const session = await sessionService.create();
    const other = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 3 });
    await expect(
      game.cashOut({ sessionId: other.sessionId, roundId: round.roundId }),
    ).rejects.toMatchObject({ code: 'ROUND_SESSION_MISMATCH' });
    await game.cashOut({ sessionId: session.sessionId, roundId: round.roundId });
    await expect(
      game.cashOut({ sessionId: session.sessionId, roundId: round.roundId }),
    ).rejects.toMatchObject({ code: 'ROUND_ALREADY_FINISHED' });
  });

  it('returns five isolated history items in newest-first order', async () => {
    const session = await sessionService.create();
    const other = await sessionService.create();
    const ids: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const round = await game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 });
      ids.push(round.roundId);
      await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 1 });
      await game.cashOut({ sessionId: session.sessionId, roundId: round.roundId });
      const model = await rounds.findById(round.roundId);
      model!.createdAt = new Date(index * 1_000);
      await rounds.update(model!);
    }
    const foreign = await game.startRound({ sessionId: other.sessionId, bet: 5, trapCount: 1 });
    await game.revealTile({ sessionId: other.sessionId, roundId: foreign.roundId, tileId: 0 });
    const history = await game.getHistory(session.sessionId);
    expect(history.map((item) => item.roundId)).toEqual(ids.slice(1).reverse());
    expect(history).toHaveLength(5);
  });

  it('rolls back credits and round creation when a critical event append fails', async () => {
    const failingEvents = new InMemoryRoundEventRepository();
    failingEvents.append = () => Promise.reject(new Error('injected event failure'));
    const isolatedSessions = new InMemorySessionRepository();
    const isolatedRounds = new InMemoryRoundRepository();
    const isolatedService = new SessionService(isolatedSessions);
    const isolatedGame = new GameEngineService(
      isolatedService,
      isolatedSessions,
      isolatedRounds,
      new InMemoryGameUnitOfWork({
        sessions: isolatedSessions,
        rounds: isolatedRounds,
        events: failingEvents,
      }),
      () => new Set([0]),
      new GameEventPublisher(),
    );
    const session = await isolatedService.create();
    await expect(
      isolatedGame.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 1 }),
    ).rejects.toThrow('injected event failure');
    expect((await isolatedService.require(session.sessionId)).demoCredits).toBe(1000);
    expect(await isolatedRounds.findActiveBySessionId(session.sessionId)).toBeUndefined();
  });
});
