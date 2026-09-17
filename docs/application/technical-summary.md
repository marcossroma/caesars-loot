# Technical Summary

## React and PixiJS

React renders the HUD, settings and recovery controls. `PixiRuntime` owns initialization,
assets, resize and destruction. The canvas persists across React snapshots; frame updates
mutate existing scene entities instead of rebuilding them. Twenty-five tiles and a bounded
250-object effect pool prevent per-round resource growth.

## State and networking

`GameController` coordinates typed state transitions and presentation. Mutations are never
automatically replayed: an uncertain response triggers authoritative state resynchronization.
REST handles start/reveal/cashout; versioned Socket.IO envelopes carry committed results.
Event IDs and session sequences reject duplicates and stale messages. A server restart
creates a new sequence epoch, accepted after resync.

## Server authority and persistence

NestJS validates session ownership and legal transitions. Hidden traps never appear in
active-round DTOs. Drizzle repositories use PostgreSQL transactions and row locks; a partial
unique index permits only one active round per session. Critical events are inserted before
commit; broadcasts happen afterward. Anonymous sessions use fictional credits and are not
a substitute for authenticated multi-user accounts.

## Tests and measured performance

Vitest covers math, state, APIs, gateway events, malformed inputs, concurrent actions and
resource cleanup. Five isolated PostgreSQL integration tests run against disposable CI
PostgreSQL, never the production database. Playwright covers touch, resize, recovery,
preferences and a twenty-round soak. Hosted smoke is recorded separately from local results.

The critical background was reduced from 2,469,435 to 240,998 bytes. Narrow React selectors
reduced idle HUD commits from 80 to 7 in the same six-second sample. These are measured local
results, not a promise of real-device FPS. See [performance evidence](../performance-case-study.md).

## Tradeoffs

Single Railway replica, process-local Socket.IO publisher/rate limits, procedural character
and audio, and incomplete keyboard canvas navigation. Scaling, account authentication,
distributed adapters and production sprite art are deliberately outside this portfolio scope.
