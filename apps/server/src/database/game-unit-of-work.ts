import type { RoundEventRepository } from '../round/round-event.repository.js';
import type { RoundRepository } from '../round/round.repository.js';
import type { SessionRepository } from '../session/session.repository.js';
import { InMemorySessionRepository } from '../session/session.repository.js';
import { InMemoryRoundRepository } from '../round/round.repository.js';
import { InMemoryRoundEventRepository } from '../round/round-event.repository.js';
import type { DatabaseClient } from './database.service.js';
import { PostgresRoundEventRepository } from './postgres-round-event.repository.js';
import { PostgresRoundRepository } from './postgres-round.repository.js';
import { PostgresSessionRepository } from './postgres-session.repository.js';

export const GAME_UNIT_OF_WORK = Symbol('GAME_UNIT_OF_WORK');

export interface RepositoryContext {
  sessions: SessionRepository;
  rounds: RoundRepository;
  events: RoundEventRepository;
}

export interface GameUnitOfWork {
  transaction<T>(work: (repositories: RepositoryContext) => Promise<T>): Promise<T>;
}

export class InMemoryGameUnitOfWork implements GameUnitOfWork {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly repositories: RepositoryContext) {}

  async transaction<T>(work: (repositories: RepositoryContext) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const memorySessions =
      this.repositories.sessions instanceof InMemorySessionRepository
        ? this.repositories.sessions
        : undefined;
    const memoryRounds =
      this.repositories.rounds instanceof InMemoryRoundRepository
        ? this.repositories.rounds
        : undefined;
    const memoryEvents =
      this.repositories.events instanceof InMemoryRoundEventRepository
        ? this.repositories.events
        : undefined;
    const snapshots =
      memorySessions && memoryRounds && memoryEvents
        ? {
            sessions: memorySessions.snapshot(),
            rounds: memoryRounds.snapshot(),
            events: memoryEvents.snapshot(),
          }
        : undefined;
    try {
      return await work(this.repositories);
    } catch (error) {
      if (snapshots && memorySessions && memoryRounds && memoryEvents) {
        memorySessions.restore(snapshots.sessions);
        memoryRounds.restore(snapshots.rounds);
        memoryEvents.restore(snapshots.events);
      }
      throw error;
    } finally {
      release();
    }
  }
}

export class PostgresGameUnitOfWork implements GameUnitOfWork {
  constructor(private readonly db: DatabaseClient) {}

  async transaction<T>(work: (repositories: RepositoryContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (transaction) => {
      // A transaction exposes the same query builder API used by repository implementations.
      const db = transaction as unknown as DatabaseClient;
      return work({
        sessions: new PostgresSessionRepository(db),
        rounds: new PostgresRoundRepository(db),
        events: new PostgresRoundEventRepository(db),
      });
    });
  }
}
