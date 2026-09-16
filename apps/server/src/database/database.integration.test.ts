import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameEngineService } from '../game/game-engine.service.js';
import { GameEventPublisher } from '../realtime/game-event.publisher.js';
import { SessionService } from '../session/session.service.js';
import { PostgresGameUnitOfWork } from './game-unit-of-work.js';
import { PostgresRoundEventRepository } from './postgres-round-event.repository.js';
import { PostgresRoundRepository } from './postgres-round.repository.js';
import { PostgresSessionRepository } from './postgres-session.repository.js';
import * as schema from './schema.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('PostgreSQL repositories and transactions', () => {
  const pool = new Pool({ connectionString: testDatabaseUrl });
  const db = drizzle(pool, { schema });
  const sessions = new PostgresSessionRepository(db);
  const rounds = new PostgresRoundRepository(db);
  const unitOfWork = new PostgresGameUnitOfWork(db);
  const sessionService = new SessionService(sessions);
  const game = new GameEngineService(
    sessionService,
    sessions,
    rounds,
    unitOfWork,
    (count: number) => new Set(Array.from({ length: count }, (_, index) => index)),
    new GameEventPublisher(),
  );

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('persists session, active round, reveal, events and history across repository recreation', async () => {
    const session = await sessionService.create();
    const started = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 3 });
    await game.revealTile({ sessionId: session.sessionId, roundId: started.roundId, tileId: 3 });

    const restartedSessions = new PostgresSessionRepository(db);
    const restartedRounds = new PostgresRoundRepository(db);
    const restartedEvents = new PostgresRoundEventRepository(db);
    const restartedGame = new GameEngineService(
      new SessionService(restartedSessions),
      restartedSessions,
      restartedRounds,
      new PostgresGameUnitOfWork(db),
      () => new Set([0, 1, 2]),
      new GameEventPublisher(),
    );
    const restored = await restartedGame.getSessionState(session.sessionId);
    expect(restored.activeRound).toMatchObject({ roundId: started.roundId, revealedTiles: [3] });
    expect(JSON.stringify(restored)).not.toContain('trapTileIds');
    expect(await restartedEvents.listByRound(started.roundId)).toHaveLength(2);

    await restartedGame.cashOut({ sessionId: session.sessionId, roundId: started.roundId });
    expect((await restartedGame.getHistory(session.sessionId))[0]?.roundId).toBe(started.roundId);
  });

  it('protects concurrent start and cashout with row locks and the partial unique index', async () => {
    const session = await sessionService.create();
    const starts = await Promise.allSettled([
      game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 }),
      game.startRound({ sessionId: session.sessionId, bet: 5, trapCount: 1 }),
    ]);
    expect(starts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const started = starts.find((result) => result.status === 'fulfilled');
    if (!started || started.status !== 'fulfilled') throw new Error('Expected one round.');
    await game.revealTile({
      sessionId: session.sessionId,
      roundId: started.value.roundId,
      tileId: 1,
    });
    const cashouts = await Promise.allSettled([
      game.cashOut({ sessionId: session.sessionId, roundId: started.value.roundId }),
      game.cashOut({ sessionId: session.sessionId, roundId: started.value.roundId }),
    ]);
    expect(cashouts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('supports the repository contract directly', async () => {
    const now = new Date();
    const id = randomUUID();
    await sessions.create({
      id,
      demoCredits: 12.3456,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    expect(await sessions.findById(id)).toMatchObject({ id, demoCredits: 12.3456 });
    await sessions.updateCredits(id, 20.125);
    expect((await sessions.findById(id))?.demoCredits).toBe(20.125);
    await sessions.expire(id);
    expect((await sessions.findById(id))?.status).toBe('expired');
  });

  it('rolls back start when event insertion fails after the credit debit and round insert', async () => {
    const session = await sessionService.create();
    const broken = new GameEngineService(
      sessionService,
      sessions,
      rounds,
      {
        transaction: (work) =>
          unitOfWork.transaction((repositories) =>
            work({
              ...repositories,
              events: {
                ...repositories.events,
                append: () => Promise.reject(new Error('injected event failure')),
                listByRound: (id) => repositories.events.listByRound(id),
              },
            }),
          ),
      },
      () => new Set([0]),
      new GameEventPublisher(),
    );
    await expect(
      broken.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 1 }),
    ).rejects.toThrow('injected event failure');
    expect((await sessions.findById(session.sessionId))?.demoCredits).toBe(1000);
    expect(await rounds.findActiveBySessionId(session.sessionId)).toBeUndefined();
  });

  it('rolls back cashout when credits update fails after the round status update', async () => {
    const session = await sessionService.create();
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 1 });
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 1 });
    const broken = new GameEngineService(
      sessionService,
      sessions,
      rounds,
      {
        transaction: (work) =>
          unitOfWork.transaction((repositories) =>
            work({
              ...repositories,
              sessions: {
                ...repositories.sessions,
                create: (model) => repositories.sessions.create(model),
                findById: (id, lock) => repositories.sessions.findById(id, lock),
                update: () => Promise.reject(new Error('injected credits failure')),
                updateCredits: (id, credits) => repositories.sessions.updateCredits(id, credits),
                updateLastSeen: (id, at) => repositories.sessions.updateLastSeen(id, at),
                expire: (id) => repositories.sessions.expire(id),
              },
            }),
          ),
      },
      () => new Set([0]),
      new GameEventPublisher(),
    );
    await expect(
      broken.cashOut({ sessionId: session.sessionId, roundId: round.roundId }),
    ).rejects.toThrow('injected credits failure');
    expect((await rounds.findById(round.roundId))?.status).toBe('active');
    expect((await sessions.findById(session.sessionId))?.demoCredits).toBe(990);
  });
});
