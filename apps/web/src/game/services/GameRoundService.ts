import type {
  CashoutInput,
  CashoutResult,
  DemoSession,
  GameConfig,
  RevealTileInput,
  RevealTileResult,
  RoundHistoryItem,
  SessionStateResult,
  StartRoundInput,
  StartRoundResult,
} from '@caesars-loot/shared';

export interface GameRoundService {
  createSession(): Promise<DemoSession>;
  getConfig(): Promise<GameConfig>;
  startRound(input: StartRoundInput): Promise<StartRoundResult>;
  revealTile(input: RevealTileInput): Promise<RevealTileResult>;
  cashout(input: CashoutInput): Promise<CashoutResult>;
  getHistory(sessionId: string): Promise<RoundHistoryItem[]>;
  getSessionState(sessionId: string): Promise<SessionStateResult>;
  cancelPending?(): void;
  clearSession?(): void;
}
