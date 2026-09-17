# Release checklist

- [ ] Lint, typecheck, unit tests, coverage and build pass on release commit
- [x] Isolated PostgreSQL integration tests pass (all five verified in GitHub CI)
- [x] Critical E2E passes (complete hosted browser CI 35235472555 on ad1db5c)
- [ ] No credentials in tracked files, image or frontend artifact
- [ ] Intended GitHub remote and CI checks are green; branch protection configured
- [x] Railway environment, migrations and /health verified
- [x] Vercel environment and static assets verified
- [x] REST, WSS room rejoin and backend redeploy persistence verified publicly
- [x] Exact CORS allowlist and negative-origin test pass
- [ ] Validation, safe errors, headers and rate limiting verified
- [ ] Desktop/mobile and browser matrix verified on real URLs
- [x] Measured public headless baseline recorded (hardware/mobile FPS remains manual)
- [x] README Live Demo links and deployment/rollback docs finalized
- [ ] Only then create v1.0.0 tag/release

Verified 2026-09-17. Known current local database values are absent from all Git objects and
the frontend artifact; unrelated/previously rotated secrets and image layers are not fully
certified. Public safe errors/headers/Swagger passed; rate limiting is covered in automated
integration tests, not by stressing production. Chromium covered six desktop/mobile viewports;
physical iOS/Android and full Edge/Firefox/Safari hardware matrix remain manual.
Branch protection requires owner configuration. Railway currently uses a time-limited trial;
the owner must decide ongoing budget before relying on permanent service availability.
