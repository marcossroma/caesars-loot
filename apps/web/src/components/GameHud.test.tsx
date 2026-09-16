// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameController, GameSessionState } from '../game/controller/GameController';
import { GameHud } from './GameHud';

vi.mock('../hooks/useAnimatedNumber', () => ({ useAnimatedNumber: (value: number) => value }));
vi.mock('../game/audio/SoundManager', () => ({
  soundManager: {
    play: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    unlock: vi.fn(() => Promise.resolve()),
  },
}));

afterEach(cleanup);

const baseSnapshot = (): GameSessionState => ({
  gameState: 'READY',
  demoCredits: 1_000,
  bet: 5,
  trapCount: 3,
  safeReveals: 0,
  revealedTiles: [],
  multiplier: 1,
  potentialLoot: 5,
  history: [],
  inputLocked: false,
  result: null,
  error: null,
  sessionId: 'session',
  roundId: null,
  allowedBets: [1, 5, 10, 25, 50, 100],
  allowedTrapCounts: [1, 3, 5, 7, 10],
  apiStatus: 'connected',
  lastRequest: 'GET /config',
  latencyMs: 10,
  socketState: 'connected',
  socketId: 'socket',
  socketPingMs: 2,
  lastSocketEvent: null,
  lastSocketEventAt: null,
  reconnectAttempts: 0,
  socketEventLog: [],
  character: {
    state: 'idle',
    animation: 'idle',
    queueSize: 0,
    scale: 1,
    tickerCallbacks: 1,
    reducedMotion: false,
  },
  effects: {
    fps: 60,
    fpsAverage5s: 60,
    fpsMinimum: 60,
    frameTimeMs: 16.67,
    activeParticles: 0,
    poolSize: 250,
    createdParticles: 250,
    availableParticles: 250,
    peakActiveParticles: 0,
    maxParticles: 250,
    quality: 'high',
    tickerCallbacks: 1,
    reducedMotion: false,
    cameraState: 'idle',
    scheduledEffects: 0,
    listenerCount: 9,
  },
});

function fakeController(snapshot: GameSessionState) {
  const startHeist = vi.fn(() => Promise.resolve());
  const cashOut = vi.fn(() => Promise.resolve());
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    setBet: vi.fn(),
    setTrapCount: vi.fn(),
    setReducedEffects: vi.fn(),
    startHeist,
    cashOut,
  } as unknown as GameController;
  return { controller, startHeist, cashOut };
}

describe('GameHud', () => {
  it('enables configuration and start only when READY and realtime is connected', () => {
    const { controller, startHeist } = fakeController(baseSnapshot());
    render(<GameHud controller={controller} />);
    const start = screen.getByRole('button', { name: 'START HEIST' });
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'ESCAPE WITH LOOT' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(start);
    expect(startHeist).toHaveBeenCalledOnce();
  });

  it('enables cashout only after a safe reveal and reports realtime loss', () => {
    const snapshot = { ...baseSnapshot(), gameState: 'PLAYING' as const, safeReveals: 1 };
    const { controller, cashOut } = fakeController(snapshot);
    render(<GameHud controller={controller} />);
    expect(screen.getByRole('button', { name: 'START HEIST' })).toHaveProperty('disabled', true);
    const cashout = screen.getByRole('button', { name: 'ESCAPE WITH LOOT' });
    expect((cashout as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cashout);
    expect(cashOut).toHaveBeenCalledOnce();

    cleanup();
    render(
      <GameHud
        controller={fakeController({ ...baseSnapshot(), socketState: 'disconnected' }).controller}
      />,
    );
    expect(screen.getByText('Realtime unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'START HEIST' })).toHaveProperty('disabled', true);
  });
});
