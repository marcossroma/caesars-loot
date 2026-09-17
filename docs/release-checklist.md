# Release checklist

- [ ] Lint, typecheck, unit tests, coverage and build pass on release commit
- [x] Isolated PostgreSQL integration tests pass (all five verified in GitHub CI)
- [ ] Critical E2E passes
- [ ] No credentials in tracked files, image or frontend artifact
- [ ] Intended GitHub remote and CI checks are green; branch protection configured
- [ ] Railway environment, migrations and /health verified
- [ ] Vercel environment and static assets verified
- [ ] REST, WSS, reconnect and backend redeploy persistence verified publicly
- [ ] Exact CORS allowlist and negative-origin test pass
- [ ] Validation, safe errors, headers and rate limiting verified
- [ ] Desktop/mobile and browser matrix verified on real URLs
- [ ] Measured production performance recorded
- [ ] README Live Demo links and deployment/rollback docs finalized
- [ ] Only then create v1.0.0 tag/release
