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
import { ApiClient, ApiClientError } from '../../services/api/ApiClient';
import type { GameRoundService } from './GameRoundService';

const DEFAULT_API_URL = 'http://localhost:3000';
const configuredApiUrl = import.meta.env.VITE_API_URL;
const SESSION_STORAGE_KEY = 'caesars-loot.session-id';

export class ApiGameRoundService implements GameRoundService {
  constructor(private readonly client = new ApiClient(configuredApiUrl ?? DEFAULT_API_URL)) {}

  async createSession(): Promise<DemoSession> {
    const storedSessionId = this.readStoredSession();
    if (storedSessionId) {
      try {
        const state = await this.getSessionState(storedSessionId);
        return {
          sessionId: state.sessionId,
          demoCredits: state.demoCredits,
          createdAt: new Date().toISOString(),
        };
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
        this.clearStoredSession();
      }
    }
    const session = await this.client.post<DemoSession>('/api/session');
    this.storeSession(session.sessionId);
    return session;
  }

  getConfig(): Promise<GameConfig> {
    return this.client.get('/api/game/config');
  }

  startRound(input: StartRoundInput): Promise<StartRoundResult> {
    return this.client.post('/api/game/start', input);
  }

  revealTile(input: RevealTileInput): Promise<RevealTileResult> {
    return this.client.post('/api/game/reveal', input);
  }

  cashout(input: CashoutInput): Promise<CashoutResult> {
    return this.client.post('/api/game/cashout', input);
  }

  getHistory(sessionId: string): Promise<RoundHistoryItem[]> {
    return this.client.get(`/api/game/history?sessionId=${encodeURIComponent(sessionId)}`);
  }

  getSessionState(sessionId: string): Promise<SessionStateResult> {
    return this.client.get(`/api/session/${encodeURIComponent(sessionId)}/state`);
  }

  cancelPending(): void {
    this.client.abortAll();
  }

  clearSession(): void {
    this.clearStoredSession();
  }

  private readStoredSession(): string | null {
    return typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem(SESSION_STORAGE_KEY);
  }

  private storeSession(sessionId: string): void {
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  private clearStoredSession(): void {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
