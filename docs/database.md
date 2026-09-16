# Database persistence

Milestone 13 uses Supabase as managed PostgreSQL. NestJS remains the only application authority:

```text
React + PixiJS → REST / Socket.IO → NestJS → repositories → Drizzle → PostgreSQL
```

No Supabase SDK or database credential exists in the browser bundle. The implementation uses only
standard PostgreSQL features, so moving providers primarily means changing the connection string.

## Schema

```text
demo_sessions 1 ─── N rounds 1 ─── N round_events
```

- `demo_sessions` stores an anonymous UUID, `NUMERIC(14,4)` demo credits, status and timestamps.
- `rounds` stores typed wager/outcome columns, private trap IDs, revealed IDs and timestamps.
- `round_events` stores critical domain events; visual effects are never persisted.

No name, email, location or persistent IP is stored. Indexes cover session history, active status,
event lookup and event time. A partial unique index on active rounds is a double-start backstop.

## Decimal strategy

PostgreSQL values use `NUMERIC(14,4)`. Repository mappers explicitly serialize four decimal places
and convert rows to domain numbers; domain credits are rounded at the same boundary. ORM entities
never cross into REST DTOs.

## Transactions and concurrency

`GameUnitOfWork` gives the domain service transaction-scoped repository interfaces. Start locks the
session, checks the active round and credits, debits, creates the round and appends its event before
commit. Reveal locks session and round, updates state and appends critical events together. Cashout
locks both rows, finishes the round, credits payout and appends cashout/win events atomically.

Two cashouts serialize on `SELECT … FOR UPDATE`; the second sees a finished round. Two starts
serialize on the session row, with the partial unique index as an extra guarantee. Socket events are
published only after commit. A socket failure cannot undo committed state; resync reads PostgreSQL.

## Setup

1. Create a Supabase project and put its pooled runtime URL in `DATABASE_URL`.
2. Put its direct URL in `DIRECT_URL` for migrations.
3. Keep `sslmode=require` for hosted URLs; TLS validation is never globally disabled.
4. Run `npm run db:migrate:deploy`.
5. Start NestJS with `npm run dev:server`.

Local PostgreSQL can use the same variables. Without `DATABASE_URL`, non-production runs use memory;
production intentionally refuses to start. Never test against production: use `TEST_DATABASE_URL`.

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
```

Migrations live under `apps/server/drizzle`. Startup never resets or migrates the database.

## Testing and operations

Unit/HTTP tests use in-memory repositories. With `TEST_DATABASE_URL`, integration tests apply the
migration and verify mapping, restart-style reconstruction, events and concurrent start/cashout.
CI supplies a disposable PostgreSQL service.

Manual restart: create a session, start/reveal, restart NestJS, refresh and verify the same active
round and credits. Finish, restart again and verify newest-first history. Active DTOs must never
contain `trapTileIds`.

`GET /health` reports `database: connected` when PostgreSQL responds. Connection failures return a
sanitized 503. One bounded `pg` pool is closed by Nest shutdown hooks. RLS does not replace backend
authorization for a direct server connection. A future job should delete anonymous demo records
older than an agreed retention window; no scheduler is added here.
