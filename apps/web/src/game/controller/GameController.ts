import {
  ALLOWED_BETS,
  INITIAL_DEMO_CREDITS,
  TRAP_OPTIONS,
  type GameSocketEvent,
  type GameConfig,
  type PublicRoundState,
  type RoundHistoryItem,
  type SessionStateResult,
  type SocketState,
} from '@caesars-loot/shared';
import { GameEventBus } from '../events/GameEventBus';
import { devLogger } from '../logging/devLogger';
import type { PixiRuntimeStatus } from '../runtime/PixiRuntime';
import { ApiGameRoundService } from '../services/ApiGameRoundService';
import type { GameRoundService } from '../services/GameRoundService';
import { GameStateMachine, type GameState } from '../state/GameStateMachine';
import { ApiClientError } from '../../services/api/ApiClient';
import { GameSocketService, type GameSocketPort } from '../../services/socket/GameSocketService';
import type {
  CharacterDiagnostics,
  CharacterPort,
  CharacterState,
} from '../character/characterTypes';
import type { DevEffect, EffectDiagnostics } from '../effects/GameFeelDirector';
import { createAppError, toAppError, type AppError } from '../errors/AppError';
import { errorStore } from '../errors/ErrorStore';
import { gameSettingsStore } from '../settings/GameSettingsStore';

export interface GameFeelPort {
  playForDev(effect: DevEffect): void;
  stress(count: number): number;
  getDiagnostics(): EffectDiagnostics;
  setReducedMotion(active: boolean): void;
  cancelAll(): void;
}

export const BET_OPTIONS = ALLOWED_BETS;
export const TRAP_COUNT_OPTIONS = TRAP_OPTIONS;

export type TileVisualState = 'hidden' | 'disabled' | 'revealing' | 'safe' | 'trap';
export type ApiConnectionState = 'connecting' | 'connected' | 'offline';

export interface BoardPort {
  reset(): void;
  disableAll(): void;
  enableAll(): void;
  setTileState(id: number, state: TileVisualState): boolean;
  playTrapFeedback(): void;
}

export interface GameResult {
  kind: 'won' | 'lost' | 'error';
  title: string;
  message: string;
  payout: number;
}

export interface GameSessionState {
  gameState: GameState;
  demoCredits: number;
  bet: number;
  trapCount: number;
  safeReveals: number;
  revealedTiles: readonly number[];
  multiplier: number;
  potentialLoot: number;
  history: readonly RoundHistoryItem[];
  inputLocked: boolean;
  result: GameResult | null;
  error: AppError | null;
  sessionId: string | null;
  roundId: string | null;
  allowedBets: readonly number[];
  allowedTrapCounts: readonly number[];
  apiStatus: ApiConnectionState;
  lastRequest: string;
  latencyMs: number | null;
  socketState: SocketState;
  socketId: string | null;
  socketPingMs: number | null;
  lastSocketEvent: string | null;
  lastSocketEventAt: number | null;
  reconnectAttempts: number;
  socketEventLog: readonly string[];
  character: CharacterDiagnostics;
  effects: EffectDiagnostics;
}

export interface GameControllerOptions {
  service?: GameRoundService;
  delay?: (milliseconds: number) => Promise<void>;
  socket?: GameSocketPort | null;
}

const browserDelay = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

class StaleResponseError extends Error {
  readonly code = 'STALE_RESPONSE';
  constructor(context: string) {
    super(`Ignored stale ${context} response.`);
  }
}

export class GameController {
  readonly events = new GameEventBus();
  private readonly machine = new GameStateMachine();
  private readonly service: GameRoundService;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly socket: GameSocketPort | null;
  private readonly socketDisposers: Array<() => void> = [];
  private readonly listeners = new Set<() => void>();
  private board: BoardPort | null = null;
  private boardOwner: object | null = null;
  private character: CharacterPort | null = null;
  private characterOwner: object | null = null;
  private gameFeel: GameFeelPort | null = null;
  private gameFeelOwner: object | null = null;
  private initialization: Promise<void> | null = null;
  private pendingTileId: number | null = null;
  private socketAnimationQueue = Promise.resolve();
  private lifecycleLeases = 0;
  private lifecycleGeneration = 0;
  private requestEpoch = 0;
  private firstInteractiveMarked = false;
  private snapshot: GameSessionState = {
    gameState: 'BOOT',
    demoCredits: INITIAL_DEMO_CREDITS,
    bet: 5,
    trapCount: 3,
    safeReveals: 0,
    revealedTiles: [],
    multiplier: 1,
    potentialLoot: 5,
    history: [],
    inputLocked: true,
    result: null,
    error: null,
    sessionId: null,
    roundId: null,
    allowedBets: ALLOWED_BETS,
    allowedTrapCounts: TRAP_OPTIONS,
    apiStatus: 'connecting',
    lastRequest: 'none',
    latencyMs: null,
    socketState: 'disconnected',
    socketId: null,
    socketPingMs: null,
    lastSocketEvent: null,
    lastSocketEventAt: null,
    reconnectAttempts: 0,
    socketEventLog: [],
    character: {
      state: 'idle',
      animation: 'unmounted',
      queueSize: 0,
      scale: 0,
      tickerCallbacks: 0,
      reducedMotion: false,
    },
    effects: {
      fps: 60,
      fpsAverage5s: 60,
      fpsMinimum: 60,
      frameTimeMs: 16.67,
      activeParticles: 0,
      poolSize: 0,
      createdParticles: 0,
      availableParticles: 0,
      peakActiveParticles: 0,
      maxParticles: 250,
      quality: 'high',
      tickerCallbacks: 0,
      reducedMotion: false,
      cameraState: 'idle',
      scheduledEffects: 0,
      listenerCount: 0,
    },
  };

  constructor(options: GameControllerOptions = {}) {
    this.service = options.service ?? new ApiGameRoundService();
    this.delay = options.delay ?? browserDelay;
    this.socket =
      options.socket === undefined
        ? options.service
          ? null
          : new GameSocketService()
        : options.socket;
    this.bindSocket();
  }

  getSnapshot = (): GameSessionState => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  acquireApplicationLifecycle(): () => void {
    this.lifecycleLeases += 1;
    this.lifecycleGeneration += 1;
    if (this.snapshot.sessionId && this.snapshot.socketState === 'disconnected') {
      void this.socket?.connect(this.snapshot.sessionId).catch(() => undefined);
    }
    return () => {
      this.lifecycleLeases = Math.max(0, this.lifecycleLeases - 1);
      const generation = ++this.lifecycleGeneration;
      queueMicrotask(() => {
        if (this.lifecycleLeases === 0 && generation === this.lifecycleGeneration) {
          this.socket?.destroy();
        }
      });
    };
  }

  disconnectSocketForDev(): void {
    this.socket?.disconnect();
  }

  disposeRuntimeForDev(): void {
    this.socket?.destroy();
  }

  async reconnectSocketForDev(): Promise<void> {
    await this.socket?.reconnect().catch((error) => {
      devLogger.warn('Manual WebSocket reconnect failed.', error);
    });
  }

  destroy(): void {
    this.socketDisposers.splice(0).forEach((dispose) => dispose());
    this.socket?.setResyncHandler(null);
    this.socket?.destroy();
    this.events.clear();
  }

  bindBoard(board: BoardPort | null, owner?: object): void {
    if (!board && owner && this.boardOwner !== owner) return;
    this.board = board;
    this.boardOwner = board ? (owner ?? null) : null;
    if (board) {
      board.reset();
      if (this.machine.state !== 'PLAYING') board.disableAll();
    }
  }

  bindCharacter(character: CharacterPort | null, owner?: object): void {
    if (!character && owner && this.characterOwner !== owner) return;
    this.character = character;
    this.characterOwner = character ? (owner ?? null) : null;
    if (character) {
      character.syncGameState(this.machine.state);
      this.patch({ character: character.getDiagnostics() });
    } else {
      this.patch({
        character: {
          ...this.snapshot.character,
          animation: 'unmounted',
          tickerCallbacks: 0,
          queueSize: 0,
        },
      });
    }
  }

  bindGameFeel(gameFeel: GameFeelPort | null, owner?: object): void {
    if (!gameFeel && owner && this.gameFeelOwner !== owner) return;
    this.gameFeel = gameFeel;
    this.gameFeelOwner = gameFeel ? (owner ?? null) : null;
    if (gameFeel) {
      gameFeel.setReducedMotion(gameSettingsStore.getSnapshot().reducedEffects);
      this.patch({ effects: gameFeel.getDiagnostics() });
    } else
      this.patch({
        effects: {
          ...this.snapshot.effects,
          activeParticles: 0,
          tickerCallbacks: 0,
          listenerCount: 0,
          scheduledEffects: 0,
          cameraState: 'idle',
        },
      });
  }

  updateEffectDiagnostics(diagnostics: EffectDiagnostics, owner?: object): void {
    if (owner && this.gameFeelOwner !== owner) return;
    this.patch({ effects: diagnostics });
  }
  playEffectForDev(effect: DevEffect): void {
    if (import.meta.env.DEV) this.gameFeel?.playForDev(effect);
  }
  stressEffectsForDev(count: number): void {
    if (import.meta.env.DEV) this.gameFeel?.stress(count);
  }
  toggleReducedMotionForDev(): void {
    if (import.meta.env.DEV) this.gameFeel?.setReducedMotion(!this.snapshot.effects.reducedMotion);
  }

  setReducedEffects(active: boolean): void {
    gameSettingsStore.setReducedEffects(active);
    this.gameFeel?.setReducedMotion(active);
  }

  async handleVisibilityReturn(): Promise<void> {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (this.snapshot.socketState !== 'connected')
      await this.socket?.reconnect().catch(() => undefined);
    await this.resyncSession();
  }

  updateCharacterDiagnostics(diagnostics: CharacterDiagnostics, owner?: object): void {
    if (owner && this.characterOwner !== owner) return;
    this.patch({ character: diagnostics });
  }

  playCharacterAnimationForDev(state: CharacterState): void {
    if (import.meta.env.DEV) this.character?.playForDev(state);
  }

  async handleRuntimeStatus(status: PixiRuntimeStatus): Promise<void> {
    if (status.phase === 'error') {
      this.fail(
        createAppError(
          'RENDERER_INIT_FAILED',
          'Unable to initialize the game renderer.',
          'ASSET',
          'restart',
          'pixi',
        ),
      );
      return;
    }
    if (status.phase === 'loading' && ['BOOT', 'ERROR'].includes(this.machine.state)) {
      this.moveTo('LOADING');
      return;
    }
    if (status.phase === 'ready' && ['BOOT', 'LOADING'].includes(this.machine.state)) {
      if (this.machine.state === 'BOOT') this.moveTo('LOADING');
      await this.initializeService();
    }
  }

  setBet(value: number): void {
    if (this.machine.state !== 'READY' || !this.snapshot.allowedBets.includes(value)) return;
    this.patch({ bet: value, potentialLoot: value });
  }

  setTrapCount(value: number): void {
    if (this.machine.state !== 'READY' || !this.snapshot.allowedTrapCounts.includes(value)) return;
    this.patch({ trapCount: value });
  }

  async startHeist(): Promise<boolean> {
    const { sessionId, bet, trapCount, demoCredits } = this.snapshot;
    if (
      this.machine.state !== 'READY' ||
      !sessionId ||
      !this.snapshot.allowedBets.includes(bet) ||
      !this.snapshot.allowedTrapCounts.includes(trapCount) ||
      (this.socket !== null && this.snapshot.socketState !== 'connected') ||
      bet > demoCredits
    ) {
      return false;
    }

    this.moveTo('STARTING');
    this.patch({ result: null, error: null });
    try {
      const round = await this.performRequest('start', () =>
        this.service.startRound({ sessionId, bet, trapCount }),
      );
      this.board?.reset();
      this.board?.enableAll();
      this.patch({
        demoCredits: round.demoCredits,
        safeReveals: 0,
        revealedTiles: round.revealedTiles,
        multiplier: round.multiplier,
        potentialLoot: round.potentialLoot,
        roundId: round.roundId,
      });
      this.moveTo('PLAYING');
      this.events.emit('roundStarted', { roundId: round.roundId, bet, traps: trapCount });
      return true;
    } catch (error) {
      await this.handleOperationFailure(error, 'start');
      return false;
    }
  }

  async revealTile(tileId: number): Promise<boolean> {
    const { sessionId, roundId } = this.snapshot;
    if (
      this.machine.state !== 'PLAYING' ||
      !sessionId ||
      !roundId ||
      this.snapshot.revealedTiles.includes(tileId)
    ) {
      return false;
    }

    this.moveTo('REVEALING');
    this.pendingTileId = tileId;
    this.board?.disableAll();
    this.board?.setTileState(tileId, 'revealing');
    this.events.emit('tileRevealStarted', { tileId });
    try {
      const animation = this.delay(170);
      const reveal = await this.performRequest('reveal', () =>
        this.service.revealTile({ sessionId, roundId, tileId }),
      );
      await animation;
      this.board?.setTileState(tileId, reveal.result);
      this.events.emit('tileRevealed', { tileId, result: reveal.result });
      this.patch({
        safeReveals: reveal.revealedTiles.length,
        revealedTiles: reveal.revealedTiles,
        multiplier: reveal.multiplier,
        potentialLoot: reveal.potentialLoot,
        ...(reveal.demoCredits === undefined ? {} : { demoCredits: reveal.demoCredits }),
      });
      this.events.emit('multiplierUpdated', {
        multiplier: reveal.multiplier,
        potentialLoot: reveal.potentialLoot,
      });

      if (reveal.result === 'trap') {
        (reveal.revealedTrapIds ?? [tileId]).forEach((id) => this.board?.setTileState(id, 'trap'));
        this.board?.playTrapFeedback();
        await this.delay(220);
        await this.finishRound('lost', 0);
        this.moveTo('LOST');
      } else if (reveal.status === 'won') {
        await this.finishRound('won', reveal.payout ?? reveal.potentialLoot);
        this.moveTo('WON');
      } else {
        this.moveTo('PLAYING');
        this.board?.enableAll();
      }
      this.pendingTileId = null;
      return true;
    } catch (error) {
      this.pendingTileId = null;
      await this.handleOperationFailure(error, 'reveal');
      return false;
    }
  }

  async cashOut(): Promise<boolean> {
    const { sessionId, roundId } = this.snapshot;
    if (
      this.machine.state !== 'PLAYING' ||
      !sessionId ||
      !roundId ||
      this.snapshot.safeReveals === 0
    ) {
      return false;
    }
    this.moveTo('CASHING_OUT');
    this.board?.disableAll();
    this.events.emit('cashoutStarted', { roundId });
    try {
      const animation = this.delay(150);
      const cashout = await this.performRequest('cashout', () =>
        this.service.cashout({ sessionId, roundId }),
      );
      await animation;
      this.patch({
        demoCredits: cashout.demoCredits,
        multiplier: cashout.multiplier,
        potentialLoot: cashout.payout,
      });
      await this.finishRound('won', cashout.payout);
      this.moveTo('WON');
      return true;
    } catch (error) {
      await this.handleOperationFailure(error, 'cashout');
      return false;
    }
  }

  async reset(): Promise<void> {
    if (!['WON', 'LOST', 'ERROR'].includes(this.machine.state)) return;
    this.board?.reset();
    this.board?.disableAll();
    this.patch({
      safeReveals: 0,
      revealedTiles: [],
      multiplier: 1,
      potentialLoot: this.snapshot.bet,
      result: null,
      error: null,
      roundId: null,
    });
    this.events.emit('roundReset', {});

    if (this.machine.state === 'ERROR' && this.snapshot.apiStatus === 'offline') {
      this.patch({ sessionId: null });
      this.initialization = null;
      this.moveTo('LOADING');
      await this.initializeService();
      return;
    }
    this.moveTo('READY');
  }

  async recoverFromError(): Promise<void> {
    if (this.snapshot.error?.recoveryAction === 'new-session') {
      await this.newDemoSession();
      return;
    }
    if (await this.resyncSession()) {
      errorStore.clear();
      this.patch({ error: null });
      return;
    }
    await this.restartGame(false);
  }

  async restartGame(newSession = false): Promise<void> {
    this.requestEpoch += 1;
    this.service.cancelPending?.();
    this.gameFeel?.cancelAll();
    this.pendingTileId = null;
    this.initialization = null;
    errorStore.clear();
    this.board?.reset();
    this.board?.disableAll();
    if (newSession) {
      this.service.clearSession?.();
      this.socket?.destroy();
    }
    this.patch({
      ...(newSession ? { sessionId: null, demoCredits: INITIAL_DEMO_CREDITS, history: [] } : {}),
      roundId: null,
      safeReveals: 0,
      revealedTiles: [],
      multiplier: 1,
      potentialLoot: this.snapshot.bet,
      result: null,
      error: null,
      apiStatus: 'connecting',
    });
    this.events.emit('roundReset', {});
    this.restoreTo('LOADING');
    if (!newSession && this.snapshot.sessionId && (await this.resyncSession())) return;
    await this.initializeService();
  }

  newDemoSession(): Promise<void> {
    return this.restartGame(true);
  }

  simulateErrorForDev(kind: 'rest' | 'timeout' | 'session' | 'asset'): void {
    if (!import.meta.env.DEV) return;
    const errors = {
      rest: createAppError(
        'NETWORK_OFFLINE',
        'Unable to reach the game server.',
        'NETWORK',
        'retry',
        'dev-rest',
      ),
      timeout: createAppError(
        'REQUEST_TIMEOUT',
        'The server took too long to respond. Your action was not retried.',
        'NETWORK',
        'resync',
        'dev-timeout',
      ),
      session: createAppError(
        'SESSION_NOT_FOUND',
        'Your demo session expired.',
        'SESSION',
        'new-session',
        'dev-session',
      ),
      asset: createAppError(
        'ASSET_LOAD_FAILED',
        'Some game art could not be loaded. A safe fallback is active.',
        'ASSET',
        'restart',
        'dev-asset',
      ),
    } satisfies Record<string, AppError>;
    this.fail(errors[kind]);
  }

  reportAssetFallback(asset: string): void {
    errorStore.push(
      createAppError(
        'ASSET_LOAD_FAILED',
        'Some game art could not be loaded. A safe fallback is active.',
        'ASSET',
        'restart',
        asset,
      ),
    );
  }

  private initializeService(): Promise<void> {
    this.initialization ??= this.runInitialization();
    return this.initialization;
  }

  private async runInitialization(): Promise<void> {
    this.patch({ apiStatus: 'connecting', result: null, error: null });
    try {
      const config = await this.performRequest('config', () => this.service.getConfig());
      const session = await this.performRequest('session', () => this.service.createSession());
      const history = await this.performRequest('history', () =>
        this.service.getHistory(session.sessionId),
      );
      const state = await this.performRequest('state', () =>
        this.service.getSessionState(session.sessionId),
      );
      this.applyConfig(config);
      this.patch({
        sessionId: session.sessionId,
        demoCredits: session.demoCredits,
        history,
        apiStatus: 'connected',
      });
      this.applyAuthoritativeState(state);
      this.socket?.setResyncHandler(async () => {
        await this.resyncSession();
      });
      void this.socket?.connect(session.sessionId).catch((error) => {
        devLogger.warn('Realtime is unavailable; REST remains available.', error);
      });
    } catch (error) {
      this.initialization = null;
      this.failAndReport(error, 'initialization');
    }
  }

  private bindSocket(): void {
    if (!this.socket) return;
    this.socketDisposers.push(
      this.socket.subscribe(() => {
        const socket = this.socket!.getSnapshot();
        this.patch({
          socketState: socket.state,
          socketId: socket.socketId,
          socketPingMs: socket.pingMs,
          lastSocketEvent: socket.lastEvent,
          lastSocketEventAt: socket.lastEventAt,
          reconnectAttempts: socket.reconnectAttempts,
          socketEventLog: socket.eventLog,
        });
      }),
      this.socket.on('SESSION_READY', (event) => this.handleSessionReady(event)),
      this.socket.on('ROUND_STARTED', (event) => this.handleRoundStarted(event)),
      this.socket.on('TILE_REVEALED', (event) => this.handleTileRevealed(event)),
      this.socket.on('MULTIPLIER_CHANGED', (event) => this.handleMultiplierChanged(event)),
      this.socket.on('ROUND_WON', (event) => this.handleRoundWon(event)),
      this.socket.on('ROUND_LOST', (event) => this.handleRoundLost(event)),
      this.socket.on('CREDITS_UPDATED', (event) => this.handleCreditsUpdated(event)),
      this.socket.on('SERVER_STATUS', () => undefined),
    );
  }

  private handleSessionReady(event: GameSocketEvent<'SESSION_READY'>): void {
    this.patch({ demoCredits: event.payload.demoCredits });
  }

  private handleRoundStarted(event: GameSocketEvent<'ROUND_STARTED'>): void {
    const round = event.payload;
    this.patch({
      roundId: event.roundId ?? round.roundId,
      bet: round.bet,
      trapCount: round.trapCount,
      demoCredits: round.demoCredits,
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      revealedTiles: round.revealedTiles,
      safeReveals: round.revealedTiles.length,
      result: null,
    });
    if (this.machine.state === 'READY') {
      this.board?.reset();
      this.board?.enableAll();
      this.restoreTo('PLAYING');
      this.events.emit('roundStarted', {
        roundId: event.roundId ?? round.roundId,
        bet: round.bet,
        traps: round.trapCount,
      });
    }
  }

  private handleTileRevealed(event: GameSocketEvent<'TILE_REVEALED'>): void {
    if (event.roundId !== this.snapshot.roundId || this.pendingTileId === event.payload.tileId)
      return;
    this.enqueueSocketAnimation(async () => {
      if (this.machine.state === 'PLAYING') this.restoreTo('REVEALING');
      this.board?.disableAll();
      this.board?.setTileState(event.payload.tileId, 'revealing');
      await this.delay(120);
      this.board?.setTileState(event.payload.tileId, event.payload.result);
      this.events.emit('tileRevealed', {
        tileId: event.payload.tileId,
        result: event.payload.result,
      });
      this.patch({
        revealedTiles: event.payload.revealedTiles,
        safeReveals: event.payload.revealedTiles.length,
      });
      if (event.payload.status === 'active') {
        this.restoreTo('PLAYING');
        this.board?.enableAll();
      }
    });
  }

  private handleMultiplierChanged(event: GameSocketEvent<'MULTIPLIER_CHANGED'>): void {
    if (event.roundId !== this.snapshot.roundId) return;
    this.patch({
      multiplier: event.payload.multiplier,
      potentialLoot: event.payload.potentialLoot,
    });
  }

  private handleRoundWon(event: GameSocketEvent<'ROUND_WON'>): void {
    if (
      event.roundId !== this.snapshot.roundId ||
      this.machine.state === 'CASHING_OUT' ||
      this.pendingTileId !== null
    ) {
      return;
    }
    this.enqueueSocketAnimation(async () => {
      this.patch({
        demoCredits: event.payload.demoCredits,
        multiplier: event.payload.multiplier,
        potentialLoot: event.payload.payout,
      });
      await this.finishRound('won', event.payload.payout);
      this.restoreTo('WON');
    });
  }

  private handleRoundLost(event: GameSocketEvent<'ROUND_LOST'>): void {
    if (event.roundId !== this.snapshot.roundId || this.pendingTileId !== null) return;
    this.enqueueSocketAnimation(async () => {
      event.payload.revealedTrapIds.forEach((id) => this.board?.setTileState(id, 'trap'));
      this.board?.playTrapFeedback();
      this.patch({ demoCredits: event.payload.demoCredits });
      await this.finishRound('lost', 0);
      this.restoreTo('LOST');
    });
  }

  private handleCreditsUpdated(event: GameSocketEvent<'CREDITS_UPDATED'>): void {
    this.patch({ demoCredits: event.payload.demoCredits });
  }

  private enqueueSocketAnimation(work: () => Promise<void>): void {
    this.socketAnimationQueue = this.socketAnimationQueue.then(work).catch((error) => {
      devLogger.warn('Realtime animation queue recovered from an error.', error);
    });
  }

  private async resyncSession(): Promise<boolean> {
    const sessionId = this.snapshot.sessionId;
    if (!sessionId) return false;
    try {
      const [state, history] = await Promise.all([
        this.service.getSessionState(sessionId),
        this.service.getHistory(sessionId),
      ]);
      this.patch({ history, apiStatus: 'connected' });
      this.applyAuthoritativeState(state);
      return true;
    } catch (error) {
      devLogger.warn('Session state resync failed.', error);
      return false;
    }
  }

  private applyAuthoritativeState(state: SessionStateResult): void {
    this.board?.reset();
    const shouldRestoreCompletedRound =
      this.machine.state === 'LOADING' ||
      (state.lastCompletedRound !== null &&
        this.snapshot.roundId === state.lastCompletedRound.roundId);
    const round =
      state.activeRound ?? (shouldRestoreCompletedRound ? state.lastCompletedRound : null);
    if (!round) {
      this.board?.disableAll();
      this.patch({
        demoCredits: state.demoCredits,
        roundId: null,
        safeReveals: 0,
        revealedTiles: [],
        multiplier: 1,
        potentialLoot: this.snapshot.bet,
        result: null,
      });
      this.restoreTo('READY');
      return;
    }

    round.revealedTiles.forEach((id) => this.board?.setTileState(id, 'safe'));
    this.patch({
      demoCredits: state.demoCredits,
      roundId: round.roundId,
      bet: round.bet,
      trapCount: round.trapCount,
      safeReveals: round.revealedTiles.length,
      revealedTiles: round.revealedTiles,
      multiplier: round.multiplier,
      potentialLoot: round.potentialLoot,
      result: this.resultFromRound(round),
    });
    if (state.activeRound) {
      this.board?.enableAll();
      this.restoreTo('PLAYING');
    } else {
      round.revealedTrapIds?.forEach((id) => this.board?.setTileState(id, 'trap'));
      this.board?.disableAll();
      this.restoreTo(round.status === 'won' ? 'WON' : 'LOST');
    }
  }

  private resultFromRound(round: PublicRoundState): GameResult | null {
    if (round.status === 'active') return null;
    return round.status === 'won'
      ? {
          kind: 'won',
          title: 'LOOT SECURED!',
          message: 'Fortune favors the bold.',
          payout: round.payout,
        }
      : {
          kind: 'lost',
          title: 'CAUGHT!',
          message: 'The imperial guard found your trail.',
          payout: 0,
        };
  }

  private restoreTo(next: GameState): void {
    const from = this.machine.state;
    this.machine.restore(next);
    this.patch({ gameState: next, inputLocked: next !== 'READY' && next !== 'PLAYING' });
    if (from !== next) this.events.emit('stateChanged', { from, to: next });
  }

  private applyConfig(config: GameConfig): void {
    const bet = config.allowedBets.includes(this.snapshot.bet as never)
      ? this.snapshot.bet
      : (config.allowedBets[0] ?? 1);
    const trapCount = config.allowedTrapCounts.includes(this.snapshot.trapCount as never)
      ? this.snapshot.trapCount
      : (config.allowedTrapCounts[0] ?? 1);
    this.patch({
      allowedBets: config.allowedBets,
      allowedTrapCounts: config.allowedTrapCounts,
      bet,
      trapCount,
      potentialLoot: bet,
    });
  }

  private async finishRound(result: 'won' | 'lost', payout: number): Promise<void> {
    this.patch({
      inputLocked: true,
      result:
        result === 'won'
          ? {
              kind: 'won',
              title: 'LOOT SECURED!',
              message: 'Fortune favors the bold.',
              payout,
            }
          : {
              kind: 'lost',
              title: 'CAUGHT!',
              message: 'The imperial guard found your trail.',
              payout: 0,
            },
    });
    this.events.emit('roundFinished', { result, payout });
    await this.refreshHistory();
  }

  private async refreshHistory(): Promise<void> {
    if (!this.snapshot.sessionId) return;
    try {
      const history = await this.performRequest('history', () =>
        this.service.getHistory(this.snapshot.sessionId!),
      );
      this.patch({ history });
    } catch (error) {
      devLogger.warn('History refresh failed after a completed round.', error);
    }
  }

  private async performRequest<T>(name: string, request: () => Promise<T>): Promise<T> {
    const epoch = this.requestEpoch;
    const startedAt = performance.now();
    this.patch({ lastRequest: name });
    try {
      const response = await request();
      if (epoch !== this.requestEpoch) {
        throw new StaleResponseError(name);
      }
      this.patch({ apiStatus: 'connected', latencyMs: Math.round(performance.now() - startedAt) });
      return response;
    } catch (error) {
      const offline =
        error instanceof ApiClientError &&
        ['NETWORK_OFFLINE', 'REQUEST_TIMEOUT'].includes(error.code);
      this.patch({
        apiStatus: offline ? 'offline' : 'connected',
        latencyMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }

  private async handleOperationFailure(error: unknown, context: string): Promise<void> {
    if (this.isStale(error)) return;
    const appError = toAppError(error, context);
    errorStore.push(appError);
    if (
      (appError.recoveryAction === 'resync' || appError.code === 'REQUEST_TIMEOUT') &&
      (await this.resyncSession())
    ) {
      return;
    }
    this.fail(appError, false);
  }

  private failAndReport(error: unknown, context: string): void {
    if (this.isStale(error)) return;
    const appError = toAppError(error, context);
    errorStore.push(appError);
    this.fail(appError, false);
  }

  private isStale(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'STALE_RESPONSE'
    );
  }

  private fail(error: AppError, report = true): void {
    if (report) errorStore.push(error);
    if (this.machine.state !== 'ERROR') this.moveTo('ERROR');
    this.board?.disableAll();
    this.patch({
      inputLocked: true,
      error,
      result: {
        kind: 'error',
        title: error.category === 'SESSION' ? 'SESSION EXPIRED' : 'HEIST INTERRUPTED',
        message: error.message,
        payout: 0,
      },
    });
    this.events.emit('error', { message: error.message });
  }

  private moveTo(next: GameState): void {
    const from = this.machine.state;
    this.machine.transition(next);
    this.patch({ gameState: next, inputLocked: next !== 'READY' && next !== 'PLAYING' });
    this.events.emit('stateChanged', { from, to: next });
    devLogger.debug(`${from} -> ${next}`);
  }

  private patch(values: Partial<GameSessionState>): void {
    this.snapshot = { ...this.snapshot, ...values };
    if (
      !this.firstInteractiveMarked &&
      this.snapshot.gameState === 'READY' &&
      this.snapshot.socketState === 'connected' &&
      typeof window !== 'undefined' &&
      performance.getEntriesByName('caesars-loot:app-start').length > 0
    ) {
      this.firstInteractiveMarked = true;
      performance.mark('caesars-loot:first-interactive');
      performance.measure(
        'caesars-loot:app-to-interactive',
        'caesars-loot:app-start',
        'caesars-loot:first-interactive',
      );
    }
    if (import.meta.env.DEV && typeof document !== 'undefined') {
      document.documentElement.dataset['gameState'] = this.snapshot.gameState;
      document.documentElement.dataset['gameCredits'] = String(this.snapshot.demoCredits);
      document.documentElement.dataset['gameSafeReveals'] = String(this.snapshot.safeReveals);
      document.documentElement.dataset['gameInputLocked'] = String(this.snapshot.inputLocked);
      document.documentElement.dataset['gameApi'] = this.snapshot.apiStatus;
      document.documentElement.dataset['gameLastRequest'] = this.snapshot.lastRequest;
      document.documentElement.dataset['gameSocket'] = this.snapshot.socketState;
      document.documentElement.dataset['gameSocketId'] = this.snapshot.socketId ?? 'none';
      document.documentElement.dataset['gameLastSocketEvent'] =
        this.snapshot.lastSocketEvent ?? 'none';
    }
    this.listeners.forEach((listener) => listener());
  }
}

export const gameController = new GameController();

if (import.meta.hot) {
  import.meta.hot.dispose(() => gameController.destroy());
}
