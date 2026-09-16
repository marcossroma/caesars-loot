# Interview Notes

## Milestone 14 deployment decisions

- Vercel serves the hashed static frontend; Railway runs the long-lived NestJS/WebSocket process.
- Supabase supplies managed PostgreSQL, not frontend game authority or a service-role SDK.
- Socket.IO upgrades to WSS through Railway HTTPS ingress. Session IDs are anonymous bearer
  capabilities; rooms require an existing session. No account or real-money feature is present.
- On redeploy the socket reconnects, rejoins and fetches authoritative persisted state; transient
  event sequence numbers reset, so a new join acknowledgement establishes the new baseline.
- Migrations run once in a controlled pre-deploy step, never in each replica or per request.
- Secrets stay in platform stores/ignored server env; only public API/WS URLs reach Vite.
- Rollback promotes prior frontend/backend artifacts, provided they support the migrated schema.
  Database rollback is not a reset; additive migrations preserve compatibility.
- Debug tools remain development-only. Production source maps are not published.
- Local production-mode smoke verified Supabase, WebSocket join, CORS and concurrency.
  Public HTTPS/WSS, mobile, platform CI and redeploy tests are not yet verified.

## Milestone 8 talking points

- Game feel is an event-driven presentation concern: `GameFeelDirector` translates domain events
  but never reads WebSocket messages or changes game math.
- Pooling is valuable because bursts are allocation-heavy and short-lived. A hard 250-object cap
  makes stress behavior predictable and cleanup auditable.
- Camera effects use absolute baselines rather than incremental transforms, preventing drift after
  repeated rounds or interrupted animations.
- Accessibility is part of the architecture: reduced motion changes density, shake, zoom and flash,
  rather than relying on a final CSS-only patch.
- The main tradeoff is procedural `Graphics` particles instead of production textures. This keeps
  the fallback complete and avoids 404s while leaving presets ready for art replacement.

### Why use both REST and WebSockets?

REST gives commands a clear request/response boundary, validation, HTTP errors, and easy inspection.
WebSockets efficiently fan out committed state changes to every tab in a validated session room.

### Why not use WebSockets for every command?

Start, reveal, and cashout need explicit success/failure semantics and safe retry decisions. Moving
them to sockets would rebuild acknowledgements, timeouts, validation, and observability already
provided by HTTP.

### How does reconnection work?

Socket.IO applies bounded exponential backoff. On every connection the client sends `JOIN_SESSION`;
after a rejoin it fetches authoritative session state once and redraws already revealed tiles.

### How do you avoid duplicate socket connections?

The service lazily creates one Socket.IO client and shares the in-flight connection promise. React
components subscribe to `GameController`; they never instantiate sockets. Cleanup disconnects the
owned client, and hot-module disposal removes its listeners.

### How do you prevent duplicated events?

The client keeps a bounded set of `eventId` values and the last per-session `sequence`. The initiating
REST command owns its immediate animation, while matching realtime events are ignored during that
pending command. Authoritative totals are assigned, not added.

### How is state restored after reconnect?

`GET /api/session/:sessionId/state` returns credits plus the public active or last completed round.
The controller resets existing board objects and reapplies revealed states. Hidden traps are omitted
from active rounds.

### How do you isolate sessions?

The Gateway only joins `session:{id}` after `SessionService` validates the UUID. Publishers derive
the room name from server-owned session state, and an integration test proves that an event in room A
does not reach room B.

### How is the character controlled?

`CharacterController` owns its explicit state, priority, timing, pending reaction and one ticker
callback. `CharacterView` owns the persistent PixiJS display tree and only receives absolute poses,
expression states and lightweight effect requests.

### How do game events trigger animations?

`GameController` converts REST and Socket.IO outcomes into typed internal events such as
`roundStarted`, `tileRevealed`, `cashoutStarted`, `roundFinished` and `roundReset`. The character
subscribes only to that bus, so rendering is independent of the transport that produced the result.

### How do you prevent animations from conflicting?

Each state has a priority. Terminal win/loss reactions interrupt smaller reactions; a lower-priority
request can occupy only one pending slot. Starting a state first restores the baseline, which also
prevents position, rotation and scale drift.

### How do you clean PixiJS animation resources?

Disposal removes the character's single callback from the shared scene ticker, calls all seven event
unsubscribers, detaches the reduced-motion listener, clears queued work and destroys the persistent
view tree and fixed effect pool.

### Why did you separate CharacterController from GameController?

The game controller owns authoritative game and network coordination; the character controller owns
presentation timing. The boundary prevents sprite concerns from entering React or networking and
makes the animation logic independently testable.

### How does the character adapt to mobile?

Its layout uses viewport classes. Desktop places it in the free lane beside the board, portrait
mobile scales it into the header area, and short landscape places it on the far edge. Board and HUD
keep priority and are never resized merely to feature the character.

### What would you do with a full sprite sheet?

Load the critical clips in the existing manifest, map controller states to texture/frame sequences,
and let `CharacterView` advance frames on the same ticker. The event mapping, priorities,
cancellation, responsive root transform and cleanup contract would stay intact.

## Milestone 9 talking points

### How did you make the PixiJS canvas responsive?

One `ResponsiveLayoutManager` observes the host, visual viewport, resize and orientation events. It
coalesces changes into one animation-frame callback, then resizes the existing renderer and scene.
React receives layout through CSS/data attributes; it never creates a second PixiJS application.

### How do you size the board?

The calculation subtracts centralized top, bottom, horizontal and compact-landscape HUD reserves
from the viewport, then chooses the smallest of usable width, usable height and the 620 px board cap.
The same 25 tiles are redrawn and repositioned in place.

### How do you handle devicePixelRatio?

PixiJS uses `autoDensity` for crisp CSS-sized output and clamps renderer resolution to `min(DPR, 2)`.
That avoids unnecessarily large framebuffers on high-density phones while retaining sharp text and
geometry.

### How do you avoid double input on touch?

Each tile accepts one primary pointer ID from down through tap, ignores secondary pointers and does
not combine touch and click handlers. The game controller also locks incompatible commands while a
reveal is pending, so two tiles cannot become concurrent authoritative requests.

### How does orientation change work?

Orientation uses the same throttled resize pipeline as any viewport change. Layout mode, renderer,
board, character, camera and effects quality update in place; network session, round state, canvas
and PixiJS application identity remain unchanged.

### How do you prioritize layout on small screens?

Board and primary actions reserve space first. The HUD becomes a compact bottom control surface,
history disappears, decoration yields, and the character becomes a small companion. Short landscape
moves the HUD to a right rail instead of shrinking tiles vertically.

### How did you test mobile performance?

Automated calculations cover the full viewport matrix, Playwright verifies real DOM/canvas layout
and a touch round, and browser diagnostics expose FPS, particle, ticker, listener and application
counts. Rotation, reconnect, reduced effects and explicit teardown were also exercised in-browser.
Real-device thermal and network profiling remains a documented follow-up.

### Why did you reduce some effects on mobile?

Dense smoke, shake, zoom and embers can obscure small tiles and consume disproportionate fill rate.
Low quality preserves the outcome and core feedback while reducing density and amplitude; the
manual Reduced Effects option gives the player control independently of device size.

## Milestone 11 talking points

### How is the test strategy divided?

Pure rules stay in fast table/property-style tests, controllers use explicit fakes, NestJS runs both
service races and real HTTP integration, Socket.IO is tested on both sides, React components run in
jsdom, and Playwright is reserved for browser layout, touch and lifecycle behavior.

### How do deterministic RNG tests help without changing production randomness?

Trap generation accepts a narrow `RandomSource`. Production injects cryptographic randomness while
tests inject a repeatable integer sequence. The same generation algorithm is exercised and the
server-authoritative boundary remains intact.

### Which race conditions matter most?

Two reveals of the same tile, double cashout, reveal/cashout overlap, stale REST completion and
duplicate/out-of-order realtime envelopes. Tests assert both the rejected command and the invariant:
credits pay once, history records once and visible state never rolls backward.

### What did QA find?

Reconnect from READY could restore `lastCompletedRound` even after the player dismissed its result.
The restore rule now accepts a completed round only during initial loading or when the same round is
already visible. A focused test prevents recurrence. Socket inputs also gained runtime envelope
validation after malformed-message testing exposed that trust boundary.
The final gate also found order-dependent duplicate test collection from backend `dist`; an explicit
Vitest exclusion now keeps counts and execution stable whether tests run before or after a build.

### Why collect coverage without chasing 100 percent?

Coverage identifies unexercised decision paths, but the release gate prioritizes domain invariants,
transport errors, lifecycle cleanup and representative browser flows. Generated render branches and
browser/platform fallbacks are better validated by targeted E2E and manual QA than brittle line goals.

## Milestone 12 talking points

### How did you profile the game?

I measured a production preview at four fixed viewports, using User Timing for Pixi initialization,
assets and first interaction; Resource Timing for loading; React Profiler commits; a Pixi object and
ticker census; forced-GC heap samples; REST latency/payload measurements; and asset/bundle audits.
I kept software-WebGL FPS separate from hardware Chrome profiling because the headless cadence was
not representative.

### What bottleneck did you find?

The largest was a 2.47 MB critical PNG. I also found a hard 900 ms post-load pause and broad React
subscriptions that caused 80 HUD and 69 result commits during six idle seconds.

### What changed after profiling?

The background became a visually verified 241 kB WebP, loading now ends with actual readiness, and
cached shallow selectors isolate HUD/result updates. The same React sample fell to 7 and 1 commits.

### How did you measure React rerenders?

Development-only `Profiler` boundaries count Canvas, HUD and Result commits. I compare the exact same
READY idle interval and use React DevTools for interaction traces such as multiplier, credits, reveal
and socket events.

### How did you check for memory leaks?

I force GC before READY/10/25/50-round samples, verify one canvas and bounded pools, and audit who
owns every listener/ticker/resource. A cache increase is not called a leak; only retained growth after
GC or detached resources qualifies.

### Why use object pooling?

Bursts are short-lived and allocation-heavy. A preallocated pool makes the maximum display-object
count predictable, removes burst-time construction, and exposes created/active/available/peak
invariants that are easy to soak-test.

### How did you choose particle limits?

The existing 250 cap was retained because 0/50/100/250 diagnostics stayed bounded and profiling did
not justify a visual reduction. Mobile quality scales requested density before it reaches that cap.

### How did you optimize for mobile?

I measured portrait and landscape separately, cut the blocking raster by 90.24%, kept DPR capped at
2, retained low mobile effect density, and documented hardware DPR/CPU/thermal passes instead of
claiming headless FPS as device truth.

### What tradeoff did you make?

The WebP is lossy and selectors require explicit field maintenance. In exchange, the critical asset
is 2.23 MB smaller and unrelated diagnostic updates no longer commit production UI.

### What would you optimize next?

Capture real-device GPU/thermal traces, add field TGI telemetry after deployment, and evaluate lazy
Pixi/bootstrap splitting only if network traces show the 567 kB entry is materially blocking. I would
not replace procedural graphics or reduce the pool without a frame-profile signal.

## Milestone 13 talking points

### Why use Supabase if the backend is NestJS?

Supabase supplies familiar managed PostgreSQL, backups and simple hosting. NestJS still owns every
game rule and authorization decision; Supabase is infrastructure, not the application layer.

### Why not call Supabase directly from React?

Credits, hidden traps and payouts are authoritative state. A browser database client would widen
the trust boundary and expose credentials or policy complexity. React sends intent only to NestJS.

### Why use repositories, and why keep in-memory repositories?

Repositories keep Drizzle rows and vendor concerns outside domain services. In-memory versions make
unit, HTTP and failure-injection tests fast and deterministic while PostgreSQL integration tests
exercise real queries, constraints and transactions.

### How do transactions protect cashout and prevent double cashout?

Cashout locks the session and round, validates `active`, writes the finished round, credits and
critical events, then commits. A concurrent request waits for the lock and then sees `won`, so it
cannot credit the payout twice.

### How do you prevent double start?

Start locks the session before checking active state. PostgreSQL also has a partial unique index on
active rounds per session, so a logic regression or cross-process race still cannot create two.

### How does state survive server restart?

Only the anonymous session UUID stays in `sessionStorage`. After restart/reconnect the state endpoint
loads credits, active/last round and revealed IDs from PostgreSQL and maps them to a public DTO.

### Why use NUMERIC instead of float?

`NUMERIC(14,4)` stores exact decimal credits. Explicit mappers serialize four decimal places and the
domain rounds at the same boundary, avoiding visible binary floating-point artifacts.

### How are migrations handled?

Drizzle generates versioned SQL under `apps/server/drizzle`. Deployment runs the forward migration
command explicitly; application startup never resets or silently mutates production schema.
