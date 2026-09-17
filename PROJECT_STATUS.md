# Project Status

Last updated: 2026-09-17

## Current Release Snapshot

Functional portfolio demo published on Vercel + Railway + dedicated Supabase with verified TLS.
Frontend: https://caesars-loot-server.vercel.app/.
Backend health: https://caesars-lootserver-production.up.railway.app/health.
Final presentation quality CI 35240736062 and complete browser CI 35240736079 passed on
35c3258. Public settings persistence passed in 38.3 s; the polished six-viewport touch/reload
smoke passed again without changing tracked screenshots. Repository is clean and synchronized.
Hosted smoke passed: database health, exact positive/negative CORS, safe validation errors,
headers, disabled production Swagger, private traps, double start/cashout, history and WSS.
Responsive browser smoke passed at 360x800, 390x844, 430x932, 844x390, 1366x768 and 1920x1080:
touch round, last-result restoration after reload, retained credits and one canvas, without
application page errors or production debug controls. Clean hosted screenshots are under
docs/screenshots/release. An active safe round survived Railway deployment replacement
c663fb60 → f94264ac; credits, revealed state, WSS room rejoin and later settlement passed.
Local lint/typecheck/format/build/coverage and 157 unit tests passed; five database tests are
verified in isolated CI. Current npm audit reports zero vulnerabilities; known database values
are absent from all Git objects and the frontend artifact. This is not an audit of unknown secrets.

Final polish adds a visible NO REAL MONEY notice, revalidation for unversioned nested assets,
professional README, technical/application summaries, career drafts, code tour, two-/five-minute
demo scripts and a manual gameplay recording plan. No application/profile/video was submitted.
Formal v1.0.0 release is not declared: physical iOS/Android, full browser/hardware performance
matrix and owner-managed branch protection remain manual checklist requirements. Hosting uses
the existing Railway trial; long-term service availability requires owner plan/budget review.

## Implementation and Deployment History

The entries below record earlier stages and failures, not the current live service state.

Milestone 14 in progress by user authorization. The five previously deferred Milestone 13
isolated PostgreSQL integration tests passed in GitHub CI run 35156783870 on commit 2a3c44d.
Real Supabase connection, migrations and backend restart restoration are verified.

Milestone 14 preparation: root Vercel configuration, Railway Docker build/pre-deploy migrations,
healthcheck, exact REST/WebSocket CORS, bounded POST rate limiting, small JSON payloads,
request IDs, safe headers, production Swagger restriction and deployment/rollback/environment
documentation are implemented. Vercel static deployment and platform quality CI passed;
Railway rollout and public end-to-end smoke remain pending.
GitHub remote is configured: https://github.com/marcossroma/caesars-loot.
First reviewed commit d265d24 was pushed to main. Initial CI failed because workspace
declarations were absent before typed lint; workflows now build shared packages first.
The staged-content audit found no current database password, private env files or private keys.
Vercel and Railway are authenticated; Railway's terms were accepted by the user.
Railway GitHub App access to this repository was authorized by the user.
Railway project e155507d-6a25-4280-a962-c16f5292b770 now has a staged backend service;
the automatically proposed frontend service was discarded before deployment.
Dockerfile /Dockerfile, Wait for CI, /health (120 seconds), pre-deploy migrations,
start command and On Failure restart (3 retries) are staged. Six masked variables are staged:
NODE_ENV, DATABASE_POOL_MAX, DATABASE_SSL_CA_FILE, DATABASE_URL, DIRECT_URL and exact CORS_ORIGIN.
Database credentials were stored in Railway with explicit user authorization; no credentials
were sent to Vercel or GitHub. Dashboard changes were applied; deployment was skipped because
the GitHub E2E check failed. Wait for CI remains enabled (not bypassed).
Public domain caesars-lootserver-production.up.railway.app was generated with user authorization,
target port 3000. PORT=3000 is configured. No healthy backend deployment is live yet.
The existing Vercel project caesars-loot-server was corrected from NestJS/apps/server to
Vite/repository root, with npm ci, shared-workspace + web build, apps/web/dist and Node 22.x.
Dashboard success notifications confirmed these settings were saved. Production VITE_API_URL
and VITE_WS_URL now reference the assigned Railway HTTPS origin and /game namespace;
Vercel confirmed both variables were added. Frontend deployment F9tHoXcjxZN57P7ckxybsCNpgUru
reached Ready; https://caesars-loot-server.vercel.app/ renders the game and the expected recovery
screen while the backend is offline. The redundant Railway custom build command was removed,
leaving all workspace compilation to the Dockerfile.
The Railway dashboard reports Config as Code unavailable for newly configured services;
railway.json must not be relied on for this deployment. Equivalent dashboard settings are required.
CI quality passed 162 tests (server 47, web 89, math 26), lint, typecheck, format and build.
E2E run 35156783927 passed 15/16; the two-cycle recovery scenario exceeded its 30-second
total budget. Its explicit budget is now 60 seconds; the focused local rerun passed in 39.9 seconds.
CI run 35161395701 passed on commit 6335c83. Complete E2E run 35161395756 passed 13/16:
the 20-round scenario exceeded 240 seconds, settings persistence encountered a closed browser
session, and timeout recovery exceeded 30 seconds. The previously failing expired-session/render
recovery scenario passed. These failures require further diagnosis; hosted release is not validated.
Trace screenshot capture is now disabled while DOM/action traces are retained, reducing
continuous WebGL readback overhead. The CI twenty-round total budget is 480 seconds and timeout
recovery is 60 seconds; individual transition deadlines and assertions remain unchanged.
Focused local rerun of all three failing scenarios passed (3/3, 4.5 minutes).
Complete local browser suite passed 16/16 (6.9 minutes); lint, typecheck, formatting,
157 local unit tests, coverage and build passed. Five database tests remain CI-only locally.
Quality CI run 35168271884 passed. Hosted E2E run 35168271741 again encountered a closed
Chromium session in settings persistence after the long mobile rendering suite.
The workflow now runs mobile and recovery files in separate Chromium invocations, preserving
all tests and distinct failure artifact folders. This isolates renderer resources; a green
hosted rerun is still required. Wait for CI remains enabled on Railway.
Public domains are assigned; no v1.0.0 release exists yet.
CI failure trace confirms settings persisted correctly; the final assertion began with only
174 ms remaining before the total test deadline closed the browser context. The redundant
initial reset/reload is removed, actual settings-summary clicks are used, and this scenario
uses a mobile viewport with a 120-second CI budget. Its focused local rerun passed in 18.5 s.
Downloaded diagnostic artifacts are excluded from Git, lint and formatting, not test sources.
Milestone 14 local validation: lint, typecheck, format, build, coverage and 157 unit tests passed.
Six recovery E2E tests passed again after the final dependency correction; production-mode smoke
against localhost:3004 with real Supabase passed database health, exact CORS denial, WebSocket
join, double start, safe reveal, double cashout, history and hidden-trap omission.
Nest Express adapter updated to 12.0.3 (multer 2.4.0), removing audit High findings.
Four Moderate findings remain in Drizzle tooling's development-server dependency chain;
no public Studio server is exposed. Docker image build and hosted smoke are not yet verified.

Supabase project `caesars-loot` is provisioned and healthy in São Paulo. Data API is disabled.
The ignored `apps/server/.env` is configured for the IPv4 session pooler.
Drizzle configuration now loads the server workspace `.env`, matching backend startup.
The official Supabase CA is provided in `apps/server/supabase-ca.crt`; `DATABASE_SSL_CA_FILE`
configures verified TLS for both Drizzle and the backend, with no certificate-check bypass.
Validation on 2026-09-16: migration deploy passed twice (idempotent), health reports database
connected, a demo round survived backend process restart, safe reveal/cashout/history passed.
Frontend and backend started successfully. Lint, typecheck, format, build and 152 local tests
passed; 5 PostgreSQL integration tests were skipped because TEST_DATABASE_URL is absent.
The smoke-test demo session/history was retained; no user data was deleted.

## Done

- npm workspaces monorepo with `apps/web`, `apps/server` and shared packages
- React + TypeScript + Vite frontend foundation
- PixiJS dependency reserved for the Canvas/WebGL scene in Milestone 2
- NestJS application foundation
- Shared game contracts and explicit state vocabulary
- Isolated demonstrative game-math package with unit tests
- Central Roman-inspired color tokens based on the supplied visual references
- Strict TypeScript, ESLint and Prettier configuration
- Root development, quality and build scripts
- Initial portfolio README and fictional-credits disclaimer
- Asset and documentation directory structure
- Quality gate passed: formatting, lint, typecheck, 5 unit tests and production builds
- One persistent PixiJS v8 `Application` shared safely across React Strict Mode effect cycles
- Responsive full-viewport Canvas/WebGL scene with capped device resolution
- PixiJS loading scene with `CAESAR’S LOOT`, `Loading treasures...` and progress feedback
- Initial asset manifest and async background loading with a built-in scene fallback
- Original Roman treasury background guided by the supplied visual references
- Base main scene with cover-crop layout for desktop and portrait mobile viewports
- `ResizeObserver` lifecycle, ticker removal, asset unload and renderer/resource destruction
- Development-only diagnostics and cleanup control for runtime verification
- Four responsive-layout unit tests; total project suite now contains 9 passing tests
- Browser validation at 1366×768 and 390×844 with no horizontal overflow
- Runtime validation: one active Canvas/PixiJS application, maximum active count of one
- React unmount validation: canvas removed and PixiJS destroyed successfully
- Programmatically generated 5×5 PixiJS board with exactly 25 persistent tile entities
- Deterministic tile IDs and coordinate/index helpers with invalid-input handling
- `BoardContainer` rendering API: `getTile`, `setTileState`, `disableAll`, `enableAll`, `reset`
- Typed tile states prepared for `hidden`, `hover`, `pressed`, `disabled`, `revealing`, `safe`,
  and `trap`
- Mouse/touch-ready PixiJS pointer events: over, out, down, up, up-outside and tap
- Subtle hover glow/scale, press compression and click pulse animations
- One shared ticker-driven, cancellable tween manager for all tile transitions
- Responsive board sizing that reuses and relayouts existing tile instances
- Development diagnostics for tile count, hover, selection, board size and tile size
- Canvas accessibility description and documented keyboard-navigation limitation
- Browser interaction validation with rapid selection through deterministic tile ID 14
- Responsive validation at 360×800, 390×844, 430×932, 768×1024, 1366×768,
  1920×1080 and rotated 844×390
- Ten board indexing/sizing tests; total project suite now contains 19 passing tests
- Explicit state machine with `BOOT`, `LOADING`, `READY`, `STARTING`, `PLAYING`, `REVEALING`,
  `CASHING_OUT`, `WON`, `LOST` and `ERROR`
- Central observable `GameController`; React and PixiJS consume one typed game snapshot
- Replaceable `GameRoundService` contract and frontend-only `LocalGameRoundService`
- Collision-safe generation of 1, 3, 5, 7 or 10 unique local traps
- 1,000 initial demo credits and selectable bets of 1, 5, 10, 25, 50 or 100
- Validated start, safe reveal, trap loss, multiplier, cashout, win and round-reset flows
- Simple safe/trap scale and glow feedback, remaining-trap reveal and board shake
- Double-input, repeated-tile, cashout-during-reveal and active-round configuration protection
- In-memory history limited to the five most recent rounds
- Typed internal event bus, development logger and live debug overlay
- Responsive React HUD with demo-only labels and no real-currency symbols
- Desktop cashout/win and trap/loss scenarios validated in the browser
- Mobile start/reveal flow validated at 390×844 with separated HUD and board
- Runtime verification retained exactly one Canvas/PixiJS application across state updates and resize
- Final quality gate: lint, typecheck, 35 tests and production builds pass across all workspaces
- NestJS REST API for config, sessions, start, reveal, cashout, history, health and Swagger docs
- Server-authoritative trap generation, outcomes, multipliers, payouts and demo-credit balance
- Public active-round responses and safe reveals never expose hidden trap positions
- Structured validation/domain errors and protections against repeated reveal and double cashout
- Central frontend `ApiClient` and API-backed `GameRoundService` with timeout and no command retries
- In-memory repositories with focused service/controller integration tests
- NestJS Socket.IO `GameGateway` on `/game` with validated `session:{sessionId}` rooms
- Transport-independent `GameEventPublisher`; the game engine has no Gateway/Socket.IO dependency
- Shared version-1 event envelope with UUID, timestamp, session sequence and typed payloads
- Realtime events: `SESSION_READY`, `ROUND_STARTED`, `TILE_REVEALED`, `MULTIPLIER_CHANGED`,
  `ROUND_WON`, `ROUND_LOST`, `CREDITS_UPDATED` and `SERVER_STATUS`
- One lazy Socket.IO client per browser tab with bounded 1–8 second reconnect backoff
- Event deduplication by ID, per-session ordering, authoritative value replacement and animation queue
- Automatic room rejoin and one-shot `GET /api/session/:sessionId/state` resynchronization
- Session ID preservation in `sessionStorage`, including clear recovery after a backend restart
- Reconnect restoration of active revealed tiles without leaking hidden traps
- Development connection diagnostics, bounded event log and disconnect/reconnect controls
- Production-safe degraded-realtime warning; new rounds are blocked until synchronization returns
- Socket and PixiJS lifecycle metrics plus complete disposal/recreation without duplicate instances
- Gateway integration coverage for valid/invalid joins, event delivery and room isolation
- Frontend mock-socket coverage for connection state, event handlers, deduplication and reconnect resync
- Browser validation of start, safe reveal, multiplier, cashout, loss, reconnect and refresh recovery
- Complete mobile round validated at 390×844 with no horizontal overflow
- Runtime validation: maximum one PixiJS application and one active socket; both reach zero on disposal
- Final quality gate: lint, typecheck, 59 tests and all production builds pass
- Independent PixiJS `CharacterController` and reusable `CharacterView` display tree
- Explicit idle, anticipation, thinking, happy, surprised, scared, celebrate, caught and escape states
- Priority-driven cancellation with one bounded pending reaction and absolute baseline transforms
- Three safe-reaction strengths plus trap recoil, fear, caught, cashout dash and victory sequence
- Persistent Roman monkey-gladiator fallback with red plume, bronze armor, cape, coin and shadow
- Critical character asset manifest/loader prepared for idle, happy, scared and celebrate textures
- Development-only missing-asset warning and no known 404 requests while production art is absent
- Internal game-event integration only; character has no React or WebSocket dependency
- Remote-tab and reconnect state synchronization for PLAYING, WON and LOST character states
- Named background, ambient, character, board, foreground-effect and UI PixiJS layers
- Initial Milestone 7 character-local 14-object effect pool, superseded by the Milestone 8 global pool
- Optional happy, scared and win sound hooks prepared without adding full sound design
- Live `prefers-reduced-motion` response for motion amplitude and effect density
- Responsive desktop, compact landscape and portrait-mobile character placement
- Development character diagnostics and manual idle/happy/scared/celebrate/caught tester
- Six focused controller tests for event mapping, priority interruption, reset, resync, disposal and
  20-round resource reuse
- Browser validation of anticipation, safe, cashout/win, trap/loss, reset, spam and reconnect/resync
- Browser cleanup validation: Canvas/application 1 → 0 → 1 with maximum active count of one
- Thirty-second idle observation and 20 browser rounds kept one Canvas, one application, one
  character ticker callback, seven listeners and the fixed effect pool
- Character architecture, lifecycle and interview documentation completed
- Final quality gate: lint, typecheck, 86 tests and all production builds pass
- Central `GameFeelDirector` as the single game-event subscriber for character, particles and camera
- Fixed 250-object `ParticleManager` pool with six presets and no display allocations per frame
- Gold spark, coin burst, gem sparkle, smoke, dust and ambient fire-ember effects
- Low/medium/high density, mobile-first selection and sustained-low-FPS adaptive downgrade
- One drift-free camera container for board, character and foreground effects
- Shake, flash, zoom punch, visual hit-stop, darkening, reset and disposal camera APIs
- Safe, trap, cashout, win and loss sequences driven only by internal presentation events
- Animated multiplier, potential-loot and demo-credit display without changing authoritative values
- Development FPS/load diagnostics, preset tester and 100/250/500 stress modes with a 250 cap
- Reduced-motion support for density, zoom, shake and photosensitive flash intensity
- Focused tests for pool reuse/cap, quality, reduced motion, cancellation and camera baseline reset
- Game-feel architecture, performance and interview documentation completed
- Browser validation at 1366×768 and 390×844: no horizontal overflow, one Canvas/application,
  trap schedule returns to idle, reduced-motion toggle propagates and 500 stress caps at 250
- Cleanup validation: Canvas/application 1 → 0 → 1 with the maximum active count remaining one
- Twenty-cycle automated presentation soak retained the 250 pool, nine listeners and three effect
  ticker callbacks, all returning to zero after disposal
- Final quality gate: lint, typecheck, 93 tests and all production builds pass
- Central mobile/tablet/desktop/wide/compact-landscape configuration in `layout.config.ts`
- One requestAnimationFrame-throttled `ResponsiveLayoutManager` for host, visual viewport, resize and
  orientation changes, with complete listener/observer cleanup
- Available-space board sizing with explicit HUD reserves and a 620 px cap; all 25 tile instances are
  retained across resize and rotation
- Portrait bottom HUD, compact-landscape right rail and desktop side HUD with board-first hierarchy
- Safe-area support on every edge, `viewport-fit=cover`, accessibility zoom preserved and `100dvh`
  with fallback
- 44 px primary actions, settings and stepper controls; full-width lower-thumb-zone actions on phone
- Bet/trap steppers replace small selects; compact Sound and persisted Reduced Effects controls added
- One-primary-pointer tile ownership with immediate press feedback and secondary/duplicate tap guards
- Phone/compact-landscape low effects, tablet medium effects and compact character scaling
- Page visibility return reconnects when needed and requests authoritative state resynchronization
- Owner-scoped board, character and effect bindings prevent stale Strict Mode/HMR scene cleanup from
  clobbering the active PixiJS scene diagnostics
- Development overlay converted to a compact, hideable drawer that does not block the board by default
- Required 11-viewport browser matrix passed with one canvas and zero horizontal overflow
- Rotation during PLAYING preserved round state and one application across portrait → landscape →
  portrait; character scale adapted 0.18 → 0.28 → 0.18
- React teardown/restoration validated Canvas/application `1 → 0 → 1`, with historical maximum one,
  character ticker one and fixed pool 250 after restoration
- Playwright smoke coverage for 360×800, 390×844, 430×932 and 1366×768, touch round, orientation,
  delayed critical loading, PixiJS teardown and a 20-round mobile endurance flow; five visual review
  screenshots generated
- Mobile asset audit: one 1672×941, 2.35 MiB production raster, no 4K source and no duplicates
- Mobile testing, real-device procedure, performance notes and interview answers documented
- Final quality gate: formatting, lint, typecheck, 109 unit/integration tests, 10 Playwright mobile
  tests and all production builds pass
- Decoupled `SoundManager` with one lazy Web Audio context, master gain, semantic cues, priorities,
  rate limiting, page-visibility handling and complete voice/listener cleanup
- Gameplay sound routed through `GameEventBus` and `GameFeelDirector` for tile press, safe loot,
  coin/gem, trap, cashout, win, loss and character reactions
- Mobile autoplay-safe first-gesture unlock with silent non-blocking fallback when Web Audio fails
- Typed `GameSettings` store for mute, volume and Reduced Effects with validation, legacy migration,
  local persistence and safe in-memory degradation
- Responsive Roman settings drawer with accessible mute, volume and reduced-effects controls
- Standard `AppError` model for network, session, round, validation, socket, asset and unknown errors
- Production-safe themed recovery overlay, deduplicated toast stack and bounded 20-entry DEV error log
- React ErrorBoundary plus Pixi initialization recovery and non-blocking missing-background fallback
- One bounded retry for idempotent GETs; mutations are never automatically replayed
- AbortController cancellation and controller request epochs prevent late responses after Restart
- Authoritative state resync for uncertain reveal/cashout outcomes, conflicts and socket reconnects
- Safe Restart and New Demo Session flows preserve local settings and cancel presentation work
- DEV simulation controls for REST, timeout, expired session, asset and render failures plus an audio
  cue tester and lifecycle diagnostics
- Audio and error/recovery architecture, mobile policy and interview answers documented
- Milestone 10 focused tests cover settings persistence, sound priority/rate limiting, event routing,
  retry policy, error deduplication, offline recovery, session replacement, render isolation and
  asset fallback
- Final Milestone 10 gate: formatting, lint, typecheck, 119 unit/integration tests, 15 Playwright
  scenarios and all production builds pass
- Deterministic `RandomSource` seam preserving cryptographic production randomness and enabling 500
  repeatable uniqueness/range checks across every supported trap count
- Expanded game-math matrices for supported/invalid inputs, probabilities, multipliers, finite values
  and two-decimal demo-credit rounding
- Full invalid-transition additions plus loss-path, stale-response, double-input and dismissed-result
  reconnect regression coverage
- Real NestJS HTTP integration for health, config, session, start, reveal, cashout, history,
  validation normalization and domain errors
- Backend concurrency tests for duplicate reveal/cashout, single settlement, ownership, finished-round
  idempotency and isolated newest-first five-round history
- DTO fuzz-lite coverage for empty, null, arrays, non-finite values, bad UUIDs and oversized strings
- WebSocket runtime envelope validation plus malformed/foreign/duplicate/stale event and cleanup tests
- React jsdom tests for HUD availability/realtime degradation and ErrorBoundary containment
- Sixteen Playwright scenarios covering responsive layout, touch, rotation, loading, cleanup, 20-round
  resource soak, settings/audio and offline/timeout/session/render/asset recovery
- Coverage reports: server 94.00% statements / 92.88% lines, web 69.87% statements / 72.62% lines,
  game-math 95.23% statements / 95.00% lines
- Separate GitHub Actions quality and Playwright workflows with artifacts, issue and PR templates
- QA matrix, edge-case catalog, regression checklist, QA summary and Milestone 11 interview notes
- Three defects fixed: reconnect no longer reopens a dismissed result; malformed realtime envelopes
  are ignored; compiled backend tests are excluded from collection after build
- Final Milestone 11 gate: formatting, lint, typecheck, 151 unit/integration tests, 16 Playwright
  scenarios, coverage collection and all production builds pass
- Production performance baseline captured for 1366×768, 1920×1080, 390×844 and 844×390 with an
  explicit software-WebGL FPS limitation
- Critical Roman background converted from 2,469,435-byte PNG to visually verified 240,998-byte
  WebP; the source PNG remains outside the production bundle
- Artificial 900 ms loading floor removed; loading now ends at actual critical-asset readiness
- User Timing marks added for app start, Pixi initialization, assets loaded, session ready and first
  interactive
- Development performance overlay expanded with current/average/minimum FPS, frame time, Pixi object
  census, particle created/available/peak, viewport, DPR, quality and ticker ownership
- React Profiler identified broad snapshot subscriptions; shallow controller selectors reduced the
  six-second idle HUD sample from 80 to 7 commits and Result from 69 to 1
- Production mobile TGI samples improved 3,205→2,798 ms portrait and 2,764→2,426 ms landscape; noisy
  software-WebGL desktop results are documented without an unsupported improvement claim
- Forced-GC 50-round production soak plateaued at 11.74 MB used heap after 11.80 MB at round 25 and
  retained one canvas
- Pixi READY census recorded 462 objects (2 sprites, 420 graphics, 38 containers, 2 texts), five
  centralized main-scene callbacks and a fixed 250-particle pool
- Asset, bundle, loading/network, memory-soak and small evidence-capture scripts added with 600 kB
  entry and 300 kB critical-background budgets
- Ticker, texture/cache, destroy, filter, particles, character, WebSocket payload/listener, audio,
  timer/listener and React/Pixi boundary audits completed
- Performance baseline, optimization log, reproducible testing guide and interview-ready technical
  case study completed
- Standard production flow completed in one attempt: READY → START → three safe reveals → CASHOUT →
  START → TRAP → READY, retaining one canvas
- Final Milestone 12 gate: lint, typecheck, 151 unit/integration tests, coverage, production build,
  five critical browser flows plus the corrected 20-round soak, asset/bundle budgets and four-viewport
  production validation pass
- Selected Drizzle ORM with the standard `pg` driver; no Supabase browser client or second ORM added
- Versioned migration for anonymous demo sessions, rounds, private traps/reveals, critical round
  events, typed statuses, justified indexes and one-active-round partial uniqueness
- `DatabaseModule` owns one bounded connection pool, ping health and graceful shutdown
- PostgreSQL Session/Round/Event repositories map explicit NUMERIC(14,4) values to domain models;
  existing in-memory repositories remain available for tests and database-free development
- `GameUnitOfWork` makes start, reveal and cashout atomic; session/round row locks and the partial
  unique index protect double start, repeated reveals and double cashout
- Critical events append inside the transaction; WebSocket events publish only after commit
- State resync and five-item history now read through the configured repository implementation
- Added conditional isolated-PostgreSQL integration suite and disposable PostgreSQL CI service;
  no `TEST_DATABASE_URL` exists on this host, so database-specific tests remain unexecuted locally
- Added PostgreSQL setup, transaction, security and retention documentation plus interview notes
- Local non-database gate: lint, typecheck, 151 existing tests, build and five critical E2E flows
  pass; E2E port hardcoding in one test was fixed
- Corrected WebSocket rejoin after backend restart: the client now accepts the publisher's new
  sequence epoch after authoritative resync rather than discarding future low-sequence events;
  focused regression coverage passes
- Final follow-up gate passes lint, typecheck, 152 unit/integration tests, build and formatting;
  four of five E2E critical flows passed together, and the touch flow passed on an isolated rerun

## In Progress

- Owner-only device/browser, branch protection, video and application checklist actions.

## Next

Complete the remaining manual release checklist before tagging v1.0.0. Feature scope is frozen;
portfolio materials are prepared by the user's request to finalize the project.

## Known Issues

- No Critical or High severity defect is known at the Milestone 12 close.
- Without `DATABASE_URL`, non-production runs intentionally use in-memory repositories and reset on
  backend restart. Production requires a PostgreSQL URL. Real Supabase persistence/restart and
  five isolated PostgreSQL tests are verified. Local TEST_DATABASE_URL remains unset; isolated
  integration tests run against disposable PostgreSQL in GitHub CI, not production.
- One grouped E2E run hit a transient Chromium session-closed timeout during first touch readiness;
  the same touch scenario passed isolated. This is tracked as test-environment flakiness, not a
  confirmed gameplay regression.
- Multiple tabs may observe one shared session room, but coordinated multiplayer gameplay is outside
  this milestone; authoritative conflict validation still applies.
- Authentication and distributed Socket.IO adapters are intentionally deferred. PostgreSQL
  persistent storage is implemented and verified.
- Production character sprite sheets, textured particles, recorded audio and keyboard board
  navigation remain future work; procedural character and sound are intentional fallbacks.
- The generated and optimized background remains an initial original scene; isolated production
  sprite assets remain future work.
- Physical iOS/Android testing, real Slow 4G/thermal profiling and notch validation remain required;
  browser emulation and deterministic request latency were used in this milestone.

## Performance Notes

- Render resolution is capped at 2× device pixel ratio to limit mobile GPU memory pressure.
- React rerenders do not recreate the PixiJS application.
- Background layout uses cover scaling without reconstructing the scene on resize.
- The resize observer, ticker callback, asset cache and renderer are released on teardown.
- Live FPS and active-particle profiling is available in the development overlay.
- The board keeps 25 tile objects and one tween ticker callback; resize redraws/repositions them
  without reconstructing the board.
- All requested viewports retained one Canvas and one active PixiJS application with no horizontal
  overflow.
- React HUD updates do not reconstruct the PixiJS application, scene, board, textures or tiles.
- Input locking prevents concurrent reveal work and unnecessary render mutations.
- Socket events update the existing controller/board; they never reconstruct the canvas or sprites.
- Event IDs are retained in a bounded 200-item set and the development event log is capped at 8.
- The production frontend entry is approximately 520 kB (156 kB gzip) after adding Socket.IO.
- Manual desktop/mobile validation retained one Canvas, one PixiJS application and one socket with
  zero horizontal overflow; full disposal reduced both active counts to zero.
- The character mutates one reusable pose and owns one ticker callback; global effects are now owned
  by `ParticleManager`, and state transitions allocate no new display objects.
- Twenty browser rounds retained one Canvas/application and stable character resource counts; an
  automated 20-cycle test additionally verifies ticker/listener/pool reuse.
- The production frontend entry is approximately 535 kB (161 kB gzip) after the character system.
- The global effects pool remains fixed at 250 objects; 500-particle stress requests cannot exceed it.
- Three focused effect ticker callbacks are removed on teardown, with scheduled actions cancelled.
- The production frontend entry is approximately 545 kB (164 kB gzip) after the effects system.
- Phone and compact-landscape layouts select low effect quality; the browser sample held 60 FPS at
  idle and retained the fixed 250-object pool.
- Every required viewport reported zero horizontal overflow and one canvas. Rotation did not change
  the authoritative round or recreate the application.
- The sole production raster is now a 1600×900, 240,998-byte WebP; the 2,469,435-byte source PNG is
  retained under `assets/source` and excluded from the production bundle.
- The Milestone 9 production entry is approximately 550 kB (165 kB gzip); Vite's 500 kB advisory
  remains non-blocking and PixiJS code splitting is a future optimization.
- Milestone 10 adds no encoded audio payload: procedural Web Audio cues preserve a zero-byte audio
  download while the category manifest remains ready for licensed production clips.
- The Milestone 10 production entry is approximately 563 kB (169 kB gzip); the existing Vite 500 kB
  advisory remains non-blocking and no audio payload was added.
- Milestone 11 retains approximately 563 kB (169 kB gzip); test and coverage packages are
  development-only and do not increase the browser payload.
- Milestone 12 entry is 566,881 bytes raw (169.86 kB gzip) and remains below its measured 600,000-byte
  guard. The extra diagnostics/selectors add 3,442 raw bytes over Milestone 11.
- Hardware Chrome FPS, DevTools flame charts, DPR 2/3, CPU 4× and real-device thermal evidence remain
  manual; headless software-WebGL frame cadence is not presented as user-visible FPS.
- Milestone 12 coverage: server 92.37% statements / 92.57% lines, web 69.91% statements / 72.65%
  lines, game-math 95.23% statements / 95.00% lines.

## Deployment Status

Vercel frontend and Railway backend are live. Dedicated Supabase, public REST/WSS, responsive
touch/reload and hosted redeploy persistence are verified. The functional demo is usable;
formal release/tag awaits the explicitly documented manual checklist, not an offline backend.
