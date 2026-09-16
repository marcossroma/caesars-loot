import { Global, Module } from '@nestjs/common';
import {
  GAME_UNIT_OF_WORK,
  InMemoryGameUnitOfWork,
  PostgresGameUnitOfWork,
} from './game-unit-of-work.js';
import { DatabaseService } from './database.service.js';
import { PostgresSessionRepository } from './postgres-session.repository.js';
import { PostgresRoundRepository } from './postgres-round.repository.js';
import { PostgresRoundEventRepository } from './postgres-round-event.repository.js';
import {
  InMemorySessionRepository,
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../session/session.repository.js';
import {
  InMemoryRoundRepository,
  ROUND_REPOSITORY,
  type RoundRepository,
} from '../round/round.repository.js';
import {
  InMemoryRoundEventRepository,
  ROUND_EVENT_REPOSITORY,
  type RoundEventRepository,
} from '../round/round-event.repository.js';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: SESSION_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService): SessionRepository =>
        database.client
          ? new PostgresSessionRepository(database.client)
          : new InMemorySessionRepository(),
    },
    {
      provide: ROUND_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService): RoundRepository =>
        database.client
          ? new PostgresRoundRepository(database.client)
          : new InMemoryRoundRepository(),
    },
    {
      provide: ROUND_EVENT_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService): RoundEventRepository =>
        database.client
          ? new PostgresRoundEventRepository(database.client)
          : new InMemoryRoundEventRepository(),
    },
    {
      provide: GAME_UNIT_OF_WORK,
      inject: [DatabaseService, SESSION_REPOSITORY, ROUND_REPOSITORY, ROUND_EVENT_REPOSITORY],
      useFactory: (
        database: DatabaseService,
        sessions: SessionRepository,
        rounds: RoundRepository,
        events: RoundEventRepository,
      ) =>
        database.client
          ? new PostgresGameUnitOfWork(database.client)
          : new InMemoryGameUnitOfWork({ sessions, rounds, events }),
    },
  ],
  exports: [
    DatabaseService,
    SESSION_REPOSITORY,
    ROUND_REPOSITORY,
    ROUND_EVENT_REPOSITORY,
    GAME_UNIT_OF_WORK,
  ],
})
export class DatabaseModule {}
