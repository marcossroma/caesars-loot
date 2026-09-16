# Edge Cases

## Commands and state

- Double start, reveal and cashout accept at most one valid mutation.
- Reveal during cashout, cashout before a safe tile, repeated tile and commands after completion are rejected.
- Late REST responses are discarded by request epoch; duplicate/out-of-order socket events are ignored.
- Reconnect restores an active round, but cannot reopen a completed result that the player already dismissed.

## Inputs and transport

- Unsupported bets/trap counts, non-finite numbers, bad UUIDs, extra fields, empty objects, arrays,
  null values and oversized strings are rejected.
- Timeout, explicit abort, offline, malformed JSON and HTTP 400/404/409/500 have distinct errors.
- Foreign-room, malformed, duplicate and stale WebSocket envelopes do not mutate client state.

## Rendering and lifecycle

- Resize/orientation reuses the application and 25 tiles.
- Unmount removes socket listeners, ticker callbacks, assets and the canvas.
- Missing images and unavailable Web Audio degrade to built-in visual/procedural fallbacks.
- Particle allocation is capped at 250 and reduced-motion suppresses strong camera motion.
