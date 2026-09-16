# Deployment

Status: configuration prepared; no public deployment verified yet.

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
DATABASE_SSL_CA_FILE=supabase-ca.crt. PORT is supplied by Railway. Generate an HTTPS domain.
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
not estimates. Production smoke and physical-device checks are pending.

For a controlled smoke run set SMOKE_API_URL and SMOKE_FRONTEND_ORIGIN, then run
`node scripts/deployment-smoke.mjs`. It creates a retained fictional-credit session, verifies
WebSocket join, double start, reveal/history and double cashout if the random tile is safe.
It does not reset/delete data. A trap outcome explicitly leaves cashout concurrency unverified.
Local production-mode smoke passed against the real dedicated Supabase on 2026-09-16;
this is not evidence of public HTTPS/WSS deployment.

## Known limitations

All five isolated Postgres fault-injection/integration tests passed in CI run 35156783870.
The latest complete E2E run passed 15/16; recovery exceeded the default total time budget.
Its focused local rerun passed with an explicit 60-second budget; a new hosted CI run is pending.
Four Moderate audit findings remain in Drizzle tooling's old development-server dependency;
do not expose Drizzle Studio publicly. High multer findings were corrected via the Nest HTTP
adapter update. The local bundled Node 24.14.1 reports tooling engine warnings; deployed Node
must satisfy the CLI's Node 22.22.3 minimum. `.nvmrc` records that version. Docker verification
and platform connection are pending. No CSP is enabled yet: validate PixiJS worker/blob,
fonts/assets and actual API/WSS domains before adding a restrictive policy.

## Rollback

See [rollback](rollback.md). No release/tag until the release checklist is satisfied.

## Platform references

[Railway configuration](https://docs.railway.com/config-as-code/reference),
[Railway pre-deploy](https://docs.railway.com/deployments/pre-deploy-command),
[Vercel monorepos](https://vercel.com/docs/monorepos).
