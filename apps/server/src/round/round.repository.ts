import type { RoundModel } from './round.model.js';

export const ROUND_REPOSITORY = Symbol('ROUND_REPOSITORY');

export interface RoundRepository {
  create(round: RoundModel): Promise<RoundModel>;
  findById(id: string, lock?: boolean): Promise<RoundModel | undefined>;
  findActiveBySessionId(sessionId: string, lock?: boolean): Promise<RoundModel | undefined>;
  update(round: RoundModel): Promise<void>;
  finish(round: RoundModel): Promise<void>;
  listBySessionId(sessionId: string, limit?: number): Promise<RoundModel[]>;
  clear?(): Promise<void>;
}

export class InMemoryRoundRepository implements RoundRepository {
  private readonly rounds = new Map<string, RoundModel>();

  create(round: RoundModel): Promise<RoundModel> {
    this.rounds.set(round.id, round);
    return Promise.resolve(round);
  }

  findById(id: string): Promise<RoundModel | undefined> {
    return Promise.resolve(this.rounds.get(id));
  }

  findActiveBySessionId(sessionId: string): Promise<RoundModel | undefined> {
    return Promise.resolve(
      [...this.rounds.values()].find(
        (round) => round.sessionId === sessionId && round.status === 'active',
      ),
    );
  }

  update(round: RoundModel): Promise<void> {
    this.rounds.set(round.id, round);
    return Promise.resolve();
  }

  async finish(round: RoundModel): Promise<void> {
    await this.update(round);
  }

  listBySessionId(sessionId: string, limit?: number): Promise<RoundModel[]> {
    return Promise.resolve(
      [...this.rounds.values()]
        .filter((round) => round.sessionId === sessionId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, limit),
    );
  }

  clear(): Promise<void> {
    this.rounds.clear();
    return Promise.resolve();
  }

  snapshot(): Map<string, RoundModel> {
    return new Map(
      [...this.rounds].map(([id, round]) => [
        id,
        {
          ...round,
          trapTileIds: new Set(round.trapTileIds),
          revealedSafeTiles: new Set(round.revealedSafeTiles),
        },
      ]),
    );
  }

  restore(snapshot: Map<string, RoundModel>): void {
    this.rounds.clear();
    snapshot.forEach((round, id) => this.rounds.set(id, round));
  }
}
