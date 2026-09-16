import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const sessionStatus = pgEnum('demo_session_status', ['active', 'expired']);
export const roundStatus = pgEnum('round_status', ['active', 'won', 'lost']);
export const roundEventType = pgEnum('round_event_type', [
  'ROUND_STARTED',
  'TILE_SAFE',
  'TILE_TRAP',
  'CASHOUT',
  'ROUND_WON',
  'ROUND_LOST',
]);

export const demoSessions = pgTable('demo_sessions', {
  id: uuid('id').primaryKey(),
  demoCredits: numeric('demo_credits', { precision: 14, scale: 4 }).notNull(),
  status: sessionStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => demoSessions.id, { onDelete: 'cascade' }),
    bet: numeric('bet', { precision: 14, scale: 4 }).notNull(),
    trapCount: integer('trap_count').notNull(),
    status: roundStatus('status').notNull().default('active'),
    multiplier: numeric('multiplier', { precision: 14, scale: 4 }).notNull(),
    potentialLoot: numeric('potential_loot', { precision: 14, scale: 4 }).notNull(),
    payout: numeric('payout', { precision: 14, scale: 4 }).notNull().default('0'),
    trapTileIds: integer('trap_tile_ids').array().notNull(),
    revealedTileIds: integer('revealed_tile_ids').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('rounds_session_created_idx').on(table.sessionId, table.createdAt),
    index('rounds_status_idx').on(table.status),
    uniqueIndex('rounds_one_active_per_session_idx')
      .on(table.sessionId)
      .where(sql`status = 'active'`),
  ],
);

export const roundEvents = pgTable(
  'round_events',
  {
    id: uuid('id').primaryKey(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    eventType: roundEventType('event_type').notNull(),
    tileId: integer('tile_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('round_events_round_idx').on(table.roundId),
    index('round_events_created_idx').on(table.createdAt),
  ],
);
