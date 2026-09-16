# Networking

REST carries authoritative player commands. Socket.IO carries server events and reconnect
synchronization; it never bypasses validation in the REST/game-engine layer.

```text
Player Action
     │
     ▼
REST Command ──► NestJS GameEngine ──► HTTP response
                         │
                         ▼
                GameEventPublisher
                         │
                         ▼
                 session:{sessionId}
                         │ WebSocket
                         ▼
                  GameController
                    ┌────┴────┐
                    ▼         ▼
                  React     PixiJS
```

## Request lifecycle

1. The client fetches `GET /api/game/config` and creates or restores a persisted anonymous session.
2. `POST /api/game/start` validates session, bet, traps and credits, then creates the secret round.
3. `POST /api/game/reveal` returns only the selected result and current public state.
4. Trap positions are returned only after the round is lost, for the final reveal animation.
5. `POST /api/game/cashout` calculates and credits the payout on the server.
6. `GET /api/game/history` returns up to five finished rounds.
7. `GET /api/session/:sessionId/state` performs one authoritative resync after refresh/reconnect.

The frontend never receives `trapTileIds` on start, safe reveal, or active-round resync. It never
calculates or optimistically applies credits or payouts. Mutating commands use a central client with
a six-second timeout and no automatic retry.

## Realtime lifecycle

After creating or restoring a session, the single `GameSocketService` connects to `/game` and sends
`JOIN_SESSION`. The Gateway validates that the UUID exists before joining the socket to its
`session:{sessionId}` room. It then publishes `SESSION_READY` and `SERVER_STATUS`. Server-only event
names are never accepted as client commands.

The event set is `ROUND_STARTED`, `TILE_REVEALED`, `MULTIPLIER_CHANGED`, `ROUND_WON`, `ROUND_LOST`,
and `CREDITS_UPDATED`. Every envelope has an event UUID, ISO timestamp, version 1, a per-session
sequence, session ID, and optional round ID. Trap IDs appear only in loss/final-state payloads.

Socket.IO reconnect uses bounded backoff (approximately 1–8 seconds, eight attempts). A reconnect
always rejoins the room and triggers one REST state fetch; there is no polling. New rounds are
blocked while realtime is degraded, while an already active command may complete over REST. The
development overlay exposes connection state, socket ID, join latency, last event, reconnect count,
a bounded event log, and manual disconnect/reconnect controls.

REST responses drive the initiating tab's immediate animation. Matching events received during that
command are observed but not applied twice. Events from another tab use a small animation queue.
Credits are always assigned from server values, never incremented client-side.

Two tabs with the same session may observe the same room. Concurrent gameplay is still protected by
server round rules, but this milestone does not promise multiplayer coordination. Different session
rooms are covered by an isolation integration test.

## Errors, concurrency, and environment

Expected failures use an HTTP status plus `{ code, message }`. Invalid input is `400`, missing
entities are `404`, and state conflicts such as repeated reveal/cashout are `409`. Invalid socket
joins return a structured error without stack traces.

DTOs accept an optional `requestId` for future idempotency, but mutating REST requests are not
automatically retried. PostgreSQL transactions lock the relevant session and round rows. A partial
unique index permits one active round per session; cashout commits status, credits and critical
events before Socket.IO success is published. Reconnect performs `GET state → PostgreSQL → public
DTO → frontend`, so a lost event or server restart does not lose authoritative state.

The realtime sequence is process-local. On a successful rejoin, the client adopts the ACK sequence
even if it is lower than the previous value, then performs the authoritative REST resync. This
prevents a browser tab from discarding all new events after a backend restart.

Development CORS defaults to `http://localhost:5173` and is configured with `CORS_ORIGIN` for both
HTTP and Socket.IO. The frontend uses `VITE_API_URL` and `VITE_WS_URL`. `DEV_API_DELAY_MS` is a
development-only REST latency simulator.
