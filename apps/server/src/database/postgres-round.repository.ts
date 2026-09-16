import { and, desc, eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from './database.service.js';
import { rounds } from './schema.js';
import type { RoundModel } from '../round/round.model.js';
import type { RoundRepository } from '../round/round.repository.js';

type RoundRow = typeof rounds.$inferSelect;

export class PostgresRoundRepository implements RoundRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(round: RoundModel): Promise<RoundModel> {
    const [row] = await this.db.insert(rounds).values(this.toRow(round)).returning();
    if (!row) throw new Error('Round insert returned no row.');
    return this.toDomain(row);
  }

  async findById(id: string, lock = false): Promise<RoundModel | undefined> {
    const query = this.db.select().from(rounds).where(eq(rounds.id, id)).limit(1);
    const [row] = lock ? await query.for('update') : await query;
    return row ? this.toDomain(row) : undefined;
  }

  async findActiveBySessionId(sessionId: string, lock = false): Promise<RoundModel | undefined> {
    const query = this.db
      .select()
      .from(rounds)
      .where(and(eq(rounds.sessionId, sessionId), eq(rounds.status, 'active')))
      .limit(1);
    const [row] = lock ? await query.for('update') : await query;
    return row ? this.toDomain(row) : undefined;
  }

  async update(round: RoundModel): Promise<void> {
    await this.db.update(rounds).set(this.toRow(round)).where(eq(rounds.id, round.id));
  }

  async finish(round: RoundModel): Promise<void> {
    await this.update(round);
  }

  async listBySessionId(sessionId: string, limit = 100): Promise<RoundModel[]> {
    const rows = await this.db
      .select()
      .from(rounds)
      .where(eq(rounds.sessionId, sessionId))
      .orderBy(desc(rounds.createdAt))
      .limit(limit);
    return rows.map((row) => this.toDomain(row));
  }

  async clear(): Promise<void> {
    await this.db.execute(sql`delete from ${rounds}`);
  }

  private toRow(round: RoundModel): typeof rounds.$inferInsert {
    return {
      id: round.id,
      sessionId: round.sessionId,
      bet: this.decimal(round.bet),
      trapCount: round.trapCount,
      status: round.status,
      multiplier: this.decimal(round.multiplier),
      potentialLoot: this.decimal(round.potentialLoot),
      payout: this.decimal(round.payout),
      trapTileIds: [...round.trapTileIds],
      revealedTileIds: [...round.revealedSafeTiles],
      createdAt: round.createdAt,
      finishedAt: round.finishedAt,
    };
  }

  private toDomain(row: RoundRow): RoundModel {
    return {
      id: row.id,
      sessionId: row.sessionId,
      bet: Number(row.bet),
      trapCount: row.trapCount,
      status: row.status,
      multiplier: Number(row.multiplier),
      potentialLoot: Number(row.potentialLoot),
      payout: Number(row.payout),
      trapTileIds: new Set(row.trapTileIds),
      revealedSafeTiles: new Set(row.revealedTileIds),
      createdAt: row.createdAt,
      ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
    };
  }

  private decimal(value: number): string {
    return value.toFixed(4);
  }
}
