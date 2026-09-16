import type { GameEventType, GameSocketEvent, SocketState } from '@caesars-loot/shared';
import { describe, expect, it, vi } from 'vitest';
import type { GameSocketPort, SocketDiagnostics } from '../../services/socket/GameSocketService';
import { LocalGameRoundService } from '../services/LocalGameRoundService';
import type { BoardPort, TileVisualState } from './GameController';
import { GameController } from './GameController';

class FakeSocket implements GameSocketPort {
  reconnectCalls = 0;
  private diagnostics: SocketDiagnostics = {
    state: 'disconnected',
    socketId: null,
    pingMs: null,
    lastEvent: null,
    lastEventAt: null,
    reconnectAttempts: 0,
    eventLog: [],
  };
  private readonly listeners = new Set<() => void>();
  private readonly events = new Map<GameEventType, Set<(event: GameSocketEvent) => void>>();
  private resync: (() => Promise<void>) | null = null;
  private joined = false;

  getSnapshot = () => this.diagnostics;
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  on<K extends GameEventType>(type: K, listener: (event: GameSocketEvent<K>) => void) {
    const set = this.events.get(type) ?? new Set();
    const wrapped = (event: GameSocketEvent) => listener(event as GameSocketEvent<K>);
    set.add(wrapped);
    this.events.set(type, set);
    return () => set.delete(wrapped);
  }
  setResyncHandler(handler: (() => Promise<void>) | null) {
    this.resync = handler;
  }
  connect() {
    const rejoin = this.joined;
    this.joined = true;
    this.update('connected');
    if (rejoin) void this.resync?.();
    return Promise.resolve();
  }
  disconnect() {
    this.update('disconnected');
  }
  async reconnect() {
    this.reconnectCalls += 1;
    await this.connect();
  }
  destroy() {
    this.disconnect();
    this.events.clear();
  }
  emit<K extends GameEventType>(event: GameSocketEvent<K>) {
    this.events
      .get(event.type)
      ?.forEach((listener) => listener(event as unknown as GameSocketEvent));
  }
  simulateTransportLoss() {
    this.update('reconnecting');
  }
  private update(state: SocketState) {
    this.diagnostics = {
      ...this.diagnostics,
      state,
      socketId: state === 'connected' ? 'fake-socket' : null,
    };
    this.listeners.forEach((listener) => listener());
  }
}

function createBoard(): BoardPort & { states: Map<number, TileVisualState> } {
  const states = new Map<number, TileVisualState>();
  return {
    states,
    reset: vi.fn(() => states.clear()),
    disableAll: vi.fn(),
    enableAll: vi.fn(),
    setTileState: vi.fn((id: number, state: TileVisualState) => {
      states.set(id, state);
      return true;
    }),
    playTrapFeedback: vi.fn(),
  };
}

let sequence = 0;
function socketEvent<K extends GameEventType>(
  type: K,
  sessionId: string,
  roundId: string,
  payload: GameSocketEvent<K>['payload'],
): GameSocketEvent<K> {
  sequence += 1;
  return {
    eventId: `event-${sequence}`,
    type,
    timestamp: new Date().toISOString(),
    version: 1,
    sequence,
    sessionId,
    roundId,
    payload,
  } as GameSocketEvent<K>;
}

async function readyRealtimeController() {
  const socket = new FakeSocket();
  const controller = new GameController({
    service: new LocalGameRoundService(() => 0),
    socket,
    delay: () => Promise.resolve(),
  });
  const board = createBoard();
  controller.bindBoard(board);
  await controller.handleRuntimeStatus({ phase: 'loading', progress: 0.5 });
  await controller.handleRuntimeStatus({ phase: 'ready', progress: 1 });
  return { controller, socket, board };
}

describe('GameController realtime handlers', () => {
  it('applies server events without incrementing authoritative credits', async () => {
    const { controller, socket, board } = await readyRealtimeController();
    const sessionId = controller.getSnapshot().sessionId!;
    socket.emit(
      socketEvent('ROUND_STARTED', sessionId, 'remote-round', {
        roundId: 'remote-round',
        status: 'active',
        bet: 5,
        trapCount: 3,
        multiplier: 1,
        potentialLoot: 5,
        demoCredits: 995,
        revealedTiles: [],
      }),
    );
    socket.emit(
      socketEvent('TILE_REVEALED', sessionId, 'remote-round', {
        tileId: 4,
        result: 'safe',
        status: 'active',
        revealedTiles: [4],
      }),
    );
    socket.emit(
      socketEvent('MULTIPLIER_CHANGED', sessionId, 'remote-round', {
        multiplier: 1.25,
        potentialLoot: 6.25,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({
      gameState: 'PLAYING',
      demoCredits: 995,
      multiplier: 1.25,
      potentialLoot: 6.25,
      revealedTiles: [4],
    });
    expect(board.states.get(4)).toBe('safe');

    socket.emit(
      socketEvent('ROUND_WON', sessionId, 'remote-round', {
        payout: 6.25,
        multiplier: 1.25,
        demoCredits: 1001.25,
      }),
    );
    await vi.waitFor(() => {
      expect(controller.getSnapshot()).toMatchObject({
        gameState: 'WON',
        demoCredits: 1001.25,
      });
    });
  });

  it('marks connection loss and restores an active round after reconnect', async () => {
    const { controller, socket, board } = await readyRealtimeController();
    controller.setTrapCount(1);
    await controller.startHeist();
    await controller.revealTile(1);
    socket.simulateTransportLoss();
    expect(controller.getSnapshot().socketState).toBe('reconnecting');
    await socket.reconnect();
    await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({
      socketState: 'connected',
      gameState: 'PLAYING',
      revealedTiles: [1],
    });
    expect(board.states.get(1)).toBe('safe');
  });

  it('reconnects and resynchronizes when the page returns to the foreground', async () => {
    const { controller, socket, board } = await readyRealtimeController();
    controller.setTrapCount(1);
    await controller.startHeist();
    await controller.revealTile(1);
    socket.simulateTransportLoss();

    await controller.handleVisibilityReturn();

    expect(socket.reconnectCalls).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      socketState: 'connected',
      gameState: 'PLAYING',
      revealedTiles: [1],
    });
    expect(board.states.get(1)).toBe('safe');
  });

  it('does not reopen a completed result that the player already dismissed', async () => {
    const { controller, socket } = await readyRealtimeController();
    controller.setTrapCount(1);
    await controller.startHeist();
    await controller.revealTile(1);
    await controller.cashOut();
    await controller.reset();
    expect(controller.getSnapshot().gameState).toBe('READY');

    socket.disconnect();
    await socket.reconnect();

    await vi.waitFor(() => expect(controller.getSnapshot().socketState).toBe('connected'));
    expect(controller.getSnapshot()).toMatchObject({
      gameState: 'READY',
      roundId: null,
      result: null,
    });
  });
});
