import { asc, eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from './database.service.js';
import { roundEvents } from './schema.js';
import type { RoundEventModel, RoundEventRepository } from '../round/round-event.repository.js';

export class PostgresRoundEventRepository implements RoundEventRepository {
  constructor(private readonly db: DatabaseClient) {}

  async append(event: RoundEventModel): Promise<void> {
    await this.db.insert(roundEvents).values({
      id: event.id,
      roundId: event.roundId,
      eventType: event.eventType,
      tileId: event.tileId,
      payload: event.payload,
      createdAt: event.createdAt,
    });
  }

  async listByRound(roundId: string): Promise<RoundEventModel[]> {
    const rows = await this.db
      .select()
      .from(roundEvents)
      .where(eq(roundEvents.roundId, roundId))
      .orderBy(asc(roundEvents.createdAt));
    return rows.map((row) => ({
      id: row.id,
      roundId: row.roundId,
      eventType: row.eventType,
      ...(row.tileId === null ? {} : { tileId: row.tileId }),
      ...(row.payload ? { payload: row.payload } : {}),
      createdAt: row.createdAt,
    }));
  }

  async clear(): Promise<void> {
    await this.db.execute(sql`delete from ${roundEvents}`);
  }
}
