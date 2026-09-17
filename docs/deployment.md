# Deployment

Status: functional demo live; public REST/WSS and responsive touch/reload smoke passed.
Frontend: https://caesars-loot-server.vercel.app/.
Backend: https://caesars-lootserver-production.up.railway.app/health (database connected).
Verified 2026-09-17: Docker build, pre-deploy migrations, active deployment, safe validation/
headers, disabled production Swagger, exact CORS denial, private traps, double start/cashout
and history. Six viewport Chromium smoke retained one canvas and no page errors.
An active revealed round and credits survived Railway replacement c663fb60 → f94264ac,
followed by WSS room rejoin and cashout. Fictional smoke sessions are retained; no data deleted.
Final presentation quality CI 35240736062 and complete browser CI 35240736079 passed on 35c3258.
Owner-managed branch protection and physical/browser/hardware review remain release gates.

## Architecture

Vercel serves React/PixiJS static files. HTTPS REST and Socket.IO WebSocket connections
go to a single Railway NestJS replica. Supabase PostgreSQL owns sessions, rounds and events.
The demo uses fictional credits only and requires no login.

## Vercel Setup

Reuse the existing project if one exists. Import the monorepo with root directory `.`;
root `vercel.json` is the equivalent monorepo configuration and outputs `apps/web/dist`.
Set `VITE_API_URL=https://<railway-domain>` and `VITE_WS_URL=https://<railway-domain>/game`.
Socket.IO accepts an HTTPS namespace URL and upgrades to WSS. Build validation requires
secure URLs on Vercel. Never put database credentials or service-role keys in VITE variables.
Only hashed build assets receive immutable cache; unversioned public assets do not.
Generated Vite files live directly under /assets; public art stays in category subdirectories.
The final root-file cache rule avoids a :path* directory matcher, which also matched zero segments.
Public production source maps are disabled; reproduce locally for debugging.

## Railway Setup

Import the same repository with root directory `.` and only the backend service.
For new services, the Railway dashboard reports Config as Code unavailable as of 2026-08-28.
Do not assume `/railway.json` is applied: configure Dockerfile `/Dockerfile`, pre-deploy
`npm run db:migrate:deploy`, start `npm run start --workspace=@caesars-loot/server`,
healthcheck `/health` (120 seconds), On Failure (3 retries) and Wait for CI in the dashboard.
Include backend, shared packages, lockfile and Dockerfile changes in deployment watch paths.
The Dockerfile builds the backend and shared workspaces; migration tooling remains in the
image for the controlled pre-deploy command. The application runs as a non-root user.
Set NODE_ENV=production, DATABASE_URL, DIRECT_URL, CORS_ORIGIN, DATABASE_POOL_MAX=10,
DATABASE_SSL_CA_FILE=supabase-ca.crt. Set PORT=3000 to match this service's public target port.
Generate an HTTPS domain. Leave the custom build command empty when using the Dockerfile.
Use one replica: event delivery and rate-limit windows are process-local; scaling requires
a shared Socket.IO adapter and rate-limit store, not included in this portfolio.
Trust exactly one ingress proxy; do not expose this server directly with untrusted forwarded headers.

## Supabase Setup

Use the dedicated Caesar's Loot project, not a test database. Keep Data API disabled.
The session pooler on port 5432 supports IPv4 and a long-lived NestJS pool. Its password
belongs only in server secrets. Migrations may use the direct endpoint where IPv6 works,
or the session pooler; do not use transaction pooling for migrations.
The official CA shipped as `apps/server/supabase-ca.crt` is public, not a secret.
Certificate/hostname verification stays enabled. Never use rejectUnauthorized=false.
Budget poolMax × replica count plus migrations and administration under the project's limits.

## Environment Variables

See [environments](environments.md). Local server env is `apps/server/.env` (ignored).
Railway env is injected by the platform, not copied into the image. Local simulator is disabled
in production. Production CORS requires explicit HTTPS origins; no wildcard previews.

## Migrations

Order: Supabase → `npm run db:migrate:deploy` → backend → `/health` → frontend → smoke.
Railway pre-deploy exits nonzero on migration failure and must prevent rollout.
Do not migrate in every replica's startup. Serialize deployments and use additive migrations.
No reset, truncate or drop command runs at startup. Keep DIRECT_URL only in server secrets.

## CI/CD

Quality workflow runs lint, typecheck, tests, coverage, isolated Postgres migrations and build.
Require both quality and E2E checks on main. Enable platform GitHub deploy integrations only
after connecting the intended repository. CI execution and branch protection are not verified
until that remote exists. Do not assume GitHub checks gate platform auto-deploy by default;
configure a checks gate or deploy manually only after green checks.

## Smoke Tests

Before release verify health database=connected, create demo session, concurrent double start,
safe reveal, double cashout, history, refresh and backend redeploy during an active round.
Public state must omit hidden traps. Test Socket.IO connect/join/disconnect/reconnect/resync.
Validate unauthorized Origin returns 403, malformed inputs return safe 4xx, and controlled
POST spam returns 429. Do not load-test production or run rollback fault injection there.
Test 390×844, 430×932, 844×390 and Chromium/Firefox/WebKit. Record actual performance,
not estimates. Production Chromium smoke passed; physical/full browser checks remain manual.

For a controlled smoke run set SMOKE_API_URL and SMOKE_FRONTEND_ORIGIN, then run
`node scripts/deployment-smoke.mjs`. It creates a retained fictional-credit session, verifies
WebSocket join, double start, reveal/history and double cashout if the random tile is safe.
It does not reset/delete data. A trap outcome explicitly leaves cashout concurrency unverified.
Local production-mode smoke passed against the real dedicated Supabase on 2026-09-16;
this is not evidence of public HTTPS/WSS deployment.

## Known limitations

All five isolated Postgres tests and complete E2E passed in GitHub CI. Settings traces showed
an exhausted total deadline, not lost preferences; initialization/budgets were corrected without
removing assertions. Current npm audit reports zero vulnerabilities; still do not expose Studio.
Wait for CI remains enabled. Deployed Node must satisfy the CLI's Node 22.22.3 minimum;
`.nvmrc` records that version. Hosted Docker build is verified. No CSP is enabled yet: validate PixiJS worker/blob,
fonts/assets and actual API/WSS domains before adding a restrictive policy.
US West backend to São Paulo database latency and the time-limited Railway trial are known
tradeoffs. Do not assume permanent free backend availability or verified free-plan backups.

Frontend smoke: set SMOKE_WEB_URL and run `node scripts/hosted-browser-smoke.mjs`.
Redeploy smoke: set SMOKE_API_URL/SMOKE_FRONTEND_ORIGIN and run
`node scripts/hosted-restart-smoke.mjs`; verify a new Railway deployment is Active, then
press Enter. This script does not initiate redeploy or reset/delete the database.

## Rollback

See [rollback](rollback.md). No release/tag until the release checklist is satisfied.

## Platform references

[Railway configuration](https://docs.railway.com/config-as-code/reference),
[Railway pre-deploy](https://docs.railway.com/deployments/pre-deploy-command),
[Vercel monorepos](https://vercel.com/docs/monorepos).
