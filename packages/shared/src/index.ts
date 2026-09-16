export const GAME_STATES = [
  'BOOT',
  'LOADING',
  'READY',
  'STARTING',
  'PLAYING',
  'REVEALING',
  'CASHING_OUT',
  'WON',
  'LOST',
  'ERROR',
] as const;

export type GameState = (typeof GAME_STATES)[number];

export const BOARD_SIZE = 25;
export const INITIAL_DEMO_CREDITS = 1000;
export const ALLOWED_BETS = [1, 5, 10, 25, 50, 100] as const;
export const TRAP_OPTIONS = [1, 3, 5, 7, 10] as const;

export type AllowedBet = (typeof ALLOWED_BETS)[number];
export type TrapCount = (typeof TRAP_OPTIONS)[number];
export type PublicRoundStatus = 'active' | 'won' | 'lost';

export interface GameConfig {
  boardSize: number;
  allowedTrapCounts: readonly TrapCount[];
  allowedBets: readonly AllowedBet[];
  initialDemoCredits: number;
}

export interface DemoSession {
  sessionId: string;
  demoCredits: number;
  createdAt: string;
}

export interface StartRoundInput {
  sessionId: string;
  bet: number;
  trapCount: number;
  requestId?: string;
}

export interface StartRoundResult {
  roundId: string;
  status: 'active';
  bet: number;
  trapCount: number;
  multiplier: number;
  potentialLoot: number;
  demoCredits: number;
  revealedTiles: number[];
}

export interface RevealTileInput {
  sessionId: string;
  roundId: string;
  tileId: number;
  requestId?: string;
}

export interface RevealTileResult {
  roundId: string;
  tileId: number;
  result: 'safe' | 'trap';
  status: 'active' | 'lost' | 'won';
  multiplier: number;
  potentialLoot: number;
  revealedTiles: number[];
  revealedTrapIds?: number[];
  demoCredits?: number;
  payout?: number;
}

export interface CashoutInput {
  sessionId: string;
  roundId: string;
  requestId?: string;
}

export interface CashoutResult {
  roundId: string;
  status: 'won';
  payout: number;
  demoCredits: number;
  multiplier: number;
}

export interface RoundHistoryItem {
  roundId: string;
  bet: number;
  trapCount: number;
  multiplier: number;
  result: 'won' | 'lost';
  payout: number;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface PublicRoundState {
  roundId: string;
  status: PublicRoundStatus;
  bet: number;
  trapCount: number;
  revealedTiles: number[];
  multiplier: number;
  potentialLoot: number;
  payout: number;
  revealedTrapIds?: number[];
}

export interface SessionStateResult {
  sessionId: string;
  demoCredits: number;
  activeRound: PublicRoundState | null;
  lastCompletedRound: PublicRoundState | null;
}

export const GAME_EVENT_TYPES = [
  'SESSION_READY',
  'ROUND_STARTED',
  'TILE_REVEALED',
  'MULTIPLIER_CHANGED',
  'ROUND_WON',
  'ROUND_LOST',
  'CREDITS_UPDATED',
  'SERVER_STATUS',
] as const;

export type GameEventType = (typeof GAME_EVENT_TYPES)[number];
export type SocketState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface SessionReadyPayload {
  demoCredits: number;
}

export type RoundStartedPayload = StartRoundResult;

export interface TileRevealedPayload {
  tileId: number;
  result: 'safe' | 'trap';
  status: PublicRoundStatus;
  revealedTiles: number[];
  revealedTrapIds?: number[];
}

export interface MultiplierChangedPayload {
  multiplier: number;
  potentialLoot: number;
}

export interface RoundWonPayload {
  payout: number;
  multiplier: number;
  demoCredits: number;
}

export interface RoundLostPayload {
  demoCredits: number;
  revealedTrapIds: number[];
}

export interface CreditsUpdatedPayload {
  demoCredits: number;
  reason: 'round_started' | 'cashout' | 'board_completed' | 'session_reset';
}

export interface ServerStatusPayload {
  status: 'online';
}

export interface GameEventPayloadMap {
  SESSION_READY: SessionReadyPayload;
  ROUND_STARTED: RoundStartedPayload;
  TILE_REVEALED: TileRevealedPayload;
  MULTIPLIER_CHANGED: MultiplierChangedPayload;
  ROUND_WON: RoundWonPayload;
  ROUND_LOST: RoundLostPayload;
  CREDITS_UPDATED: CreditsUpdatedPayload;
  SERVER_STATUS: ServerStatusPayload;
}

export type GameSocketEvent<K extends GameEventType = GameEventType> = {
  [P in K]: {
    eventId: string;
    type: P;
    timestamp: string;
    version: 1;
    sequence: number;
    sessionId: string;
    roundId?: string;
    payload: GameEventPayloadMap[P];
  };
}[K];

export interface JoinSessionInput {
  sessionId: string;
}

export type JoinSessionResult =
  { ok: true; socketId: string; sequence: number } | { ok: false; error: ApiErrorShape };
