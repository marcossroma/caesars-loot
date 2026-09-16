export type RoundEventType =
  'ROUND_STARTED' | 'TILE_SAFE' | 'TILE_TRAP' | 'CASHOUT' | 'ROUND_WON' | 'ROUND_LOST';

export interface RoundEventModel {
  id: string;
  roundId: string;
  eventType: RoundEventType;
  tileId?: number;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export const ROUND_EVENT_REPOSITORY = Symbol('ROUND_EVENT_REPOSITORY');

export interface RoundEventRepository {
  append(event: RoundEventModel): Promise<void>;
  listByRound(roundId: string): Promise<RoundEventModel[]>;
  clear?(): Promise<void>;
}

export class InMemoryRoundEventRepository implements RoundEventRepository {
  private readonly events: RoundEventModel[] = [];

  append(event: RoundEventModel): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  listByRound(roundId: string): Promise<RoundEventModel[]> {
    return Promise.resolve(this.events.filter((event) => event.roundId === roundId));
  }

  clear(): Promise<void> {
    this.events.length = 0;
    return Promise.resolve();
  }

  snapshot(): RoundEventModel[] {
    return this.events.map((event) => ({
      ...event,
      ...(event.payload ? { payload: { ...event.payload } } : {}),
    }));
  }

  restore(snapshot: RoundEventModel[]): void {
    this.events.length = 0;
    this.events.push(...snapshot);
  }
}
