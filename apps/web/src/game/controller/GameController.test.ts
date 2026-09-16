import { describe, expect, it, vi } from 'vitest';
import type { BoardPort, TileVisualState } from './GameController';
import { GameController } from './GameController';
import { LocalGameRoundService } from '../services/LocalGameRoundService';
import type { GameRoundService } from '../services/GameRoundService';
import type { StartRoundInput, StartRoundResult } from '@caesars-loot/shared';

function createBoard(): BoardPort & {
  states: Map<number, TileVisualState>;
  trapFeedbackMock: ReturnType<typeof vi.fn>;
} {
  const states = new Map<number, TileVisualState>();
  const trapFeedbackMock = vi.fn();
  return {
    states,
    trapFeedbackMock,
    reset: vi.fn(() => states.clear()),
    disableAll: vi.fn(),
    enableAll: vi.fn(),
    setTileState: vi.fn((id: number, state: TileVisualState) => {
      states.set(id, state);
      return true;
    }),
    playTrapFeedback: trapFeedbackMock,
  };
}

async function readyController(random = () => 0) {
  const controller = new GameController({
    service: new LocalGameRoundService(random),
    delay: () => Promise.resolve(),
  });
  const board = createBoard();
  controller.bindBoard(board);
  await controller.handleRuntimeStatus({ phase: 'loading', progress: 0.5 });
  await controller.handleRuntimeStatus({ phase: 'ready', progress: 1 });
  controller.setTrapCount(1);
  return { controller, board };
}

describe('GameController REST-facing flow', () => {
  it('ignores a late mutation response after a safe restart', async () => {
    const local = new LocalGameRoundService(() => 0);
    let releaseStart: (() => void) | undefined;
    const service: GameRoundService = {
      createSession: () => local.createSession(),
      getConfig: () => local.getConfig(),
      startRound: (input: StartRoundInput) =>
        new Promise<StartRoundResult>((resolve) => {
          releaseStart = () => void local.startRound(input).then(resolve);
        }),
      revealTile: (input) => local.revealTile(input),
      cashout: (input) => local.cashout(input),
      getHistory: (sessionId) => local.getHistory(sessionId),
      getSessionState: (sessionId) => local.getSessionState(sessionId),
    };
    const controller = new GameController({ service, delay: () => Promise.resolve() });
    await controller.handleRuntimeStatus({ phase: 'loading', progress: 0.5 });
    await controller.handleRuntimeStatus({ phase: 'ready', progress: 1 });
    const pendingStart = controller.startHeist();
    const restart = controller.newDemoSession();
    releaseStart?.();
    await Promise.all([pendingStart, restart]);
    expect(controller.getSnapshot()).toMatchObject({
      gameState: 'READY',
      roundId: null,
      result: null,
      error: null,
    });
  });
  it('uses server responses for credits, reveal math, cashout and history', async () => {
    const { controller } = await readyController();
    expect(await controller.startHeist()).toBe(true);
    expect(controller.getSnapshot().demoCredits).toBe(995);
    expect(await controller.revealTile(1)).toBe(true);
    expect(controller.getSnapshot().revealedTiles).toEqual([1]);
    expect(await controller.cashOut()).toBe(true);
    expect(controller.getSnapshot().gameState).toBe('WON');
    expect(controller.getSnapshot().history).toHaveLength(1);
  });

  it('blocks incompatible actions while a request is in flight', async () => {
    let release: (() => void) | undefined;
    const controller = new GameController({
      service: new LocalGameRoundService(() => 0),
      delay: () => new Promise<void>((resolve) => (release = resolve)),
    });
    await controller.handleRuntimeStatus({ phase: 'loading', progress: 0.5 });
    await controller.handleRuntimeStatus({ phase: 'ready', progress: 1 });
    controller.setTrapCount(1);
    await controller.startHeist();
    const firstReveal = controller.revealTile(1);
    expect(await controller.revealTile(2)).toBe(false);
    expect(await controller.cashOut()).toBe(false);
    expect(await controller.startHeist()).toBe(false);
    release?.();
    await firstReveal;
    expect(controller.getSnapshot().safeReveals).toBe(1);
  });

  it('renders server-provided traps only after loss and resets safely', async () => {
    const { controller, board } = await readyController();
    await controller.startHeist();
    await controller.revealTile(0);
    expect(controller.getSnapshot().gameState).toBe('LOST');
    expect(board.states.get(0)).toBe('trap');
    expect(board.trapFeedbackMock).toHaveBeenCalledOnce();
    const credits = controller.getSnapshot().demoCredits;
    await controller.reset();
    expect(controller.getSnapshot()).toMatchObject({
      gameState: 'READY',
      demoCredits: credits,
      revealedTiles: [],
      roundId: null,
    });
  });

  it('does not allow bet or trap changes during an active round', async () => {
    const { controller } = await readyController();
    await controller.startHeist();
    controller.setBet(100);
    controller.setTrapCount(10);
    expect(controller.getSnapshot().bet).toBe(5);
    expect(controller.getSnapshot().trapCount).toBe(1);
  });
});
