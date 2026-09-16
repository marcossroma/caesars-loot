export interface GameEventMap {
  stateChanged: { from: string; to: string };
  roundStarted: { roundId: string; bet: number; traps: number };
  tileRevealStarted: { tileId: number };
  tileRevealed: { tileId: number; result: 'safe' | 'trap' };
  multiplierUpdated: { multiplier: number; potentialLoot: number };
  cashoutStarted: { roundId: string };
  roundFinished: { result: 'won' | 'lost'; payout: number };
  roundReset: Record<string, never>;
  error: { message: string };
}

type Listener<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

export class GameEventBus {
  private readonly listeners = new Map<keyof GameEventMap, Set<(payload: unknown) => void>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<K>): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    const wrapped = (payload: unknown) => listener(payload as GameEventMap[K]);
    listeners.add(wrapped);
    this.listeners.set(event, listeners);
    return () => listeners.delete(wrapped);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}
