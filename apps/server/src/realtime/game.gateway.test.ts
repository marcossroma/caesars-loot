import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type GameEventType,
  type GameSocketEvent,
  type JoinSessionResult,
} from '@caesars-loot/shared';
import { io, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameEngineService, TRAP_GENERATOR } from '../game/game-engine.service.js';
import { GameModule } from '../game/game.module.js';
import { SessionModule } from '../session/session.module.js';
import { SessionService } from '../session/session.service.js';
import { RealtimeModule } from './realtime.module.js';
import { DatabaseModule } from '../database/database.module.js';

const waitForEvent = <K extends GameEventType>(socket: Socket, type: K) =>
  new Promise<GameSocketEvent<K>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 1500);
    const typedSocket = socket as unknown as {
      once(event: string, listener: (event: GameSocketEvent<K>) => void): void;
    };
    typedSocket.once(type, (event) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });

describe('GameGateway integration', () => {
  let app: INestApplication;
  let url: string;
  let sessions: SessionService;
  let game: GameEngineService;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      imports: [DatabaseModule, SessionModule, RealtimeModule, GameModule],
    });
    moduleBuilder
      .overrideProvider(TRAP_GENERATOR)
      .useValue((count: number) => new Set(Array.from({ length: count }, (_, index) => index)));
    const moduleRef = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/game`;
    sessions = app.get(SessionService);
    game = app.get(GameEngineService);
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.disconnect());
    sockets.length = 0;
    await app.close();
  });

  async function connectAndJoin(
    sessionId: string,
  ): Promise<{ socket: Socket; result: JoinSessionResult }> {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
    const result = await new Promise<JoinSessionResult>((resolve) => {
      socket.emit('JOIN_SESSION', { sessionId }, resolve);
    });
    return { socket, result };
  }

  it('connects, validates the session, and emits the round event sequence', async () => {
    const session = await sessions.create();
    const { socket, result } = await connectAndJoin(session.sessionId);
    expect(result).toMatchObject({ ok: true, socketId: socket.id });

    const startedEvent = waitForEvent(socket, 'ROUND_STARTED');
    const creditsAtStart = waitForEvent(socket, 'CREDITS_UPDATED');
    const round = await game.startRound({ sessionId: session.sessionId, bet: 10, trapCount: 1 });
    await expect(startedEvent).resolves.toMatchObject({
      type: 'ROUND_STARTED',
      roundId: round.roundId,
      payload: { demoCredits: 990 },
    });
    await expect(creditsAtStart).resolves.toMatchObject({
      type: 'CREDITS_UPDATED',
      payload: { reason: 'round_started', demoCredits: 990 },
    });

    const tileEvent = waitForEvent(socket, 'TILE_REVEALED');
    const multiplierEvent = waitForEvent(socket, 'MULTIPLIER_CHANGED');
    await game.revealTile({ sessionId: session.sessionId, roundId: round.roundId, tileId: 1 });
    await expect(tileEvent).resolves.toMatchObject({ payload: { tileId: 1, result: 'safe' } });
    await expect(multiplierEvent).resolves.toMatchObject({ type: 'MULTIPLIER_CHANGED' });

    const wonEvent = waitForEvent(socket, 'ROUND_WON');
    const creditsAtCashout = waitForEvent(socket, 'CREDITS_UPDATED');
    await game.cashOut({ sessionId: session.sessionId, roundId: round.roundId });
    await expect(wonEvent).resolves.toMatchObject({ type: 'ROUND_WON' });
    await expect(creditsAtCashout).resolves.toMatchObject({ payload: { reason: 'cashout' } });
  });

  it('rejects invalid sessions without joining a room', async () => {
    const { result } = await connectAndJoin('00000000-0000-4000-8000-000000000000');
    expect(result).toEqual({
      ok: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Unable to join session.' },
    });
  });

  it('isolates rooms and emits loss details only to the owning session', async () => {
    const sessionA = await sessions.create();
    const sessionB = await sessions.create();
    const [{ socket: socketA }, { socket: socketB }] = await Promise.all([
      connectAndJoin(sessionA.sessionId),
      connectAndJoin(sessionB.sessionId),
    ]);
    let leaked = false;
    socketB.on('ROUND_LOST', () => {
      leaked = true;
    });
    const round = await game.startRound({ sessionId: sessionA.sessionId, bet: 5, trapCount: 1 });
    const lostEvent = waitForEvent(socketA, 'ROUND_LOST');
    await game.revealTile({ sessionId: sessionA.sessionId, roundId: round.roundId, tileId: 0 });
    await expect(lostEvent).resolves.toMatchObject({
      sessionId: sessionA.sessionId,
      payload: { revealedTrapIds: [0] },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(leaked).toBe(false);
  });
});
