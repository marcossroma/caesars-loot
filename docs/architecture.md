# Architecture

## Intended production topology

Browser loads React/PixiJS from Vercel, then uses HTTPS REST and WSS Socket.IO with
Railway NestJS. Supabase PostgreSQL persists critical session/round/event state.
One backend replica owns transient event delivery and bounded anti-spam windows;
these are not the source of truth. A restart restores game state from PostgreSQL.
Public deployment and hosted reconnect/redeploy validation remain pending.

The monorepo separates browser UI, realtime rendering, server authority, shared contracts and game
math. The current rendering path is `React → PixiRuntime → MainScene → BoardContainer → LootTile`.
React does not create or manage individual tiles.

`BoardContainer` owns 25 persistent entities and exposes rendering operations without containing
game rules. `LootTile` owns its display objects, typed visual state and pointer events. All tiles use
one `TweenManager` attached once to the PixiJS ticker. Resize recalculates layout and redraws existing
graphics without rebuilding the board.

The runtime command path is now:

```text
React HUD + PixiJS Board
           ↓
     GameController
           ↓
  GameRoundService ── REST commands ──► GameEngineService
           ▲                                  │
           │                                  ├─► repository interfaces
           │                                  │       │
           │                                  │       ▼
           │                                  │  Drizzle/PostgreSQL
           │                                  │
     GameSocketService ◄─ Socket.IO ─ GameEventPublisher
```

The browser owns presentation state and animation timing. The server owns sessions, demo credits,
trap positions, reveal outcomes, multipliers, payouts and history. `GameRoundService` is the client
boundary, so later transports do not require React or PixiJS rules to be rewritten.

`GameEventPublisher` is the realtime boundary: the engine publishes domain events without importing
the Gateway or Socket.IO. `GameGateway` attaches the room transport, validates joins, and never owns
round rules. Networking emits controller updates; it does not manipulate PixiJS sprites.

`SessionRepository`, `RoundRepository` and `RoundEventRepository` have PostgreSQL and in-memory
implementations. `GameUnitOfWork` supplies transaction-scoped repositories, keeping domain math out
of Drizzle. Critical events commit with state, while Socket.IO publication occurs after commit. The
`DatabaseModule` owns one pool, health checks and graceful shutdown. See
[`database.md`](./database.md).
