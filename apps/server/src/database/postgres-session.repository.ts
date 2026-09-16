import { eq, sql } from 'drizzle-orm';
import type { DatabaseClient } from './database.service.js';
import { demoSessions } from './schema.js';
import type { DemoSessionModel } from '../session/session.model.js';
import type { SessionRepository } from '../session/session.repository.js';

type SessionRow = typeof demoSessions.$inferSelect;

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(session: DemoSessionModel): Promise<DemoSessionModel> {
    const [row] = await this.db.insert(demoSessions).values(this.toRow(session)).returning();
    if (!row) throw new Error('Session insert returned no row.');
    return this.toDomain(row);
  }

  async findById(id: string, lock = false): Promise<DemoSessionModel | undefined> {
    const query = this.db.select().from(demoSessions).where(eq(demoSessions.id, id)).limit(1);
    const [row] = lock ? await query.for('update') : await query;
    return row ? this.toDomain(row) : undefined;
  }

  async update(session: DemoSessionModel): Promise<void> {
    await this.db
      .update(demoSessions)
      .set(this.toRow({ ...session, updatedAt: new Date() }))
      .where(eq(demoSessions.id, session.id));
  }

  async updateCredits(id: string, demoCredits: number): Promise<void> {
    await this.db
      .update(demoSessions)
      .set({ demoCredits: this.decimal(demoCredits), updatedAt: new Date() })
      .where(eq(demoSessions.id, id));
  }

  async updateLastSeen(id: string, at: Date): Promise<void> {
    await this.db
      .update(demoSessions)
      .set({ lastSeenAt: at, updatedAt: at })
      .where(eq(demoSessions.id, id));
  }

  async expire(id: string): Promise<void> {
    await this.db
      .update(demoSessions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(demoSessions.id, id));
  }

  async clear(): Promise<void> {
    await this.db.execute(sql`delete from ${demoSessions}`);
  }

  private toRow(session: DemoSessionModel): typeof demoSessions.$inferInsert {
    return {
      id: session.id,
      demoCredits: this.decimal(session.demoCredits),
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastSeenAt: session.lastSeenAt,
    };
  }

  private toDomain(row: SessionRow): DemoSessionModel {
    return {
      id: row.id,
      demoCredits: Number(row.demoCredits),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSeenAt: row.lastSeenAt,
    };
  }

  private decimal(value: number): string {
    return value.toFixed(4);
  }
}
