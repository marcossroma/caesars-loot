import type { GameSocketEvent, JoinSessionResult } from '@caesars-loot/shared';
import type { Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import { GameSocketService } from './GameSocketService';

class MockManager {
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  on(event: string, listener: (...args: unknown[]) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }
  off(event: string, listener: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  trigger(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

class MockSocket {
  id = 'socket-test';
  connected = false;
  joinSequence = 0;
  readonly io = new MockManager();
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }
  once(event: string, listener: (...args: unknown[]) => void) {
    const wrapped = (...args: unknown[]) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }
  off(event: string, listener?: (...args: unknown[]) => void) {
    if (listener) this.listeners.get(event)?.delete(listener);
    else this.listeners.delete(event);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    if (event === 'JOIN_SESSION') {
      const ack = args.at(-1) as (result: JoinSessionResult) => void;
      ack({ ok: true, socketId: this.id, sequence: this.joinSequence });
    }
    return this;
  }
  connect() {
    this.connected = true;
    this.trigger('connect');
    return this;
  }
  disconnect() {
    if (this.connected) {
      this.connected = false;
      this.trigger('disconnect', 'io client disconnect');
    }
    return this;
  }
  serverEmit(event: string, payload: unknown) {
    this.trigger(event, payload);
  }
  private trigger(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

const started = (
  sequence: number,
  eventId = `event-${sequence}`,
): GameSocketEvent<'ROUND_STARTED'> => ({
  eventId,
  type: 'ROUND_STARTED',
  timestamp: new Date().toISOString(),
  version: 1,
  sequence,
  sessionId: 'session-1',
  roundId: 'round-1',
  payload: {
    roundId: 'round-1',
    status: 'active',
    bet: 5,
    trapCount: 3,
    multiplier: 1,
    potentialLoot: 5,
    demoCredits: 995,
    revealedTiles: [],
  },
});

describe('GameSocketService', () => {
  it('creates one socket, exposes state, and deduplicates ordered events', async () => {
    const socket = new MockSocket();
    const factory = vi.fn(() => socket as unknown as Socket);
    const service = new GameSocketService('http://socket.test/game', factory);
    const handler = vi.fn();
    service.on('ROUND_STARTED', handler);

    await service.connect('session-1');
    await service.connect('session-1');
    expect(factory).toHaveBeenCalledOnce();
    expect(service.getSnapshot()).toMatchObject({ state: 'connected', socketId: 'socket-test' });

    socket.serverEmit('ROUND_STARTED', started(1));
    socket.serverEmit('ROUND_STARTED', started(1));
    socket.serverEmit('ROUND_STARTED', started(0, 'older'));
    expect(handler).toHaveBeenCalledOnce();
    expect(service.getSnapshot().lastEvent).toBe('ROUND_STARTED');
  });

  it('updates disconnect state and resynchronizes after rejoin', async () => {
    const socket = new MockSocket();
    const service = new GameSocketService(
      'http://socket.test/game',
      () => socket as unknown as Socket,
    );
    const resync = vi.fn(() => Promise.resolve());
    service.setResyncHandler(resync);
    await service.connect('session-1');

    socket.connected = false;
    socket.serverEmit('disconnect', 'transport close');
    expect(service.getSnapshot().state).toBe('reconnecting');
    socket.io.trigger('reconnect_attempt', 2);
    expect(service.getSnapshot().reconnectAttempts).toBe(2);
    await service.reconnect();
    await Promise.resolve();
    expect(service.getSnapshot().state).toBe('connected');
    expect(resync).toHaveBeenCalledOnce();
  });

  it('accepts a new event sequence after the backend publisher restarts', async () => {
    const socket = new MockSocket();
    const service = new GameSocketService(
      'http://socket.test/game',
      () => socket as unknown as Socket,
    );
    const handler = vi.fn();
    const resync = vi.fn(() => Promise.resolve());
    service.on('ROUND_STARTED', handler);
    service.setResyncHandler(resync);
    await service.connect('session-1');
    socket.serverEmit('ROUND_STARTED', started(50, 'old-process-event'));
    expect(handler).toHaveBeenCalledOnce();

    socket.connected = false;
    socket.serverEmit('disconnect', 'transport close');
    socket.joinSequence = 2;
    await service.reconnect();
    await Promise.resolve();
    expect(resync).toHaveBeenCalledOnce();

    socket.serverEmit('ROUND_STARTED', started(3, 'new-process-event'));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('removes listeners and disconnects on destroy', async () => {
    const socket = new MockSocket();
    const service = new GameSocketService(
      'http://socket.test/game',
      () => socket as unknown as Socket,
    );
    await service.connect('session-1');
    service.destroy();
    expect(service.getSnapshot()).toMatchObject({ state: 'disconnected', socketId: null });
    expect(socket.connected).toBe(false);
  });

  it('ignores malformed, foreign-session, and mismatched event payloads', async () => {
    const socket = new MockSocket();
    const service = new GameSocketService(
      'http://socket.test/game',
      () => socket as unknown as Socket,
    );
    const handler = vi.fn();
    service.on('ROUND_STARTED', handler);
    await service.connect('session-1');

    socket.serverEmit('ROUND_STARTED', null);
    socket.serverEmit('ROUND_STARTED', { sequence: 1 });
    socket.serverEmit('ROUND_STARTED', { ...started(1), sessionId: 'session-2' });
    socket.serverEmit('ROUND_STARTED', { ...started(1), timestamp: 'not-a-date' });

    expect(handler).not.toHaveBeenCalled();
    expect(service.getSnapshot().lastEvent).toBeNull();
  });
});
