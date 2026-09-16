# Caesar's Loot — Performance Baseline

Captured on 2026-09-10 before Milestone 12 runtime optimizations.

## Environment and method

- Windows, Node.js 24.14.1, Vite production build served with `vite preview`.
- Chromium 142 (Playwright 1.63), headless, DPR 1, precise-memory-info enabled.
- Local NestJS production build and Socket.IO server.
- Each viewport used a fresh browser context and a five-second idle `requestAnimationFrame` sample.
- Time to Game Interactive (TGI) is navigation start through an enabled `START HEIST` control, after Pixi and the REST session are ready.
- Initial JavaScript: 563,439 bytes raw / 168,960 bytes gzip (Vite build output).
- Critical background: `roman-treasury.png`, 1,672 × 941, 2,469,435 bytes.

## Production baseline

| Viewport    |      TGI | Navigation load | Idle JS heap | Automated FPS avg/min |       Avg / p95 / max frame |
| ----------- | -------: | --------------: | -----------: | --------------------: | --------------------------: |
| 1366 × 768  | 5,678 ms |           98 ms |     12.47 MB |           3.55 / 3.33 |       281.47 / 300 / 300 ms |
| 1920 × 1080 | 8,612 ms |          194 ms |     11.38 MB |           2.32 / 2.22 |       430.55 / 450 / 450 ms |
| 390 × 844   | 3,205 ms |          331 ms |     13.29 MB |           9.08 / 8.56 | 110.14 / 116.70 / 116.80 ms |
| 844 × 390   | 2,764 ms |           98 ms |     13.09 MB |          10.30 / 8.58 |  97.11 / 100.10 / 116.60 ms |

The headless Chromium run used software WebGL in this environment. Its frame cadence was heavily throttled and is recorded only as a reproducible diagnostic, **not** as a user-visible FPS claim. A development in-app-browser observation at 844 × 390 reported 96 FPS, three ambient particles, low effects quality, and one particle ticker, but it is not substituted for a production result. Production gameplay FPS/minimums and Chrome Performance Panel screenshots therefore remain **Manual measurement required** on hardware-accelerated Chrome.

The measured page requested 24 resources and reported 272,444 transferred bytes / 894,191 decoded bytes from Resource Timing. Browser cache and transfer encoding make that figure different from the complete on-disk critical-asset weight above.

## Scene and pool baseline

- One active `PIXI.Application`; lifecycle regression coverage already verifies React Strict Mode cleanup.
- 25 board tiles.
- Particle pool creates 250 `PIXI.Graphics` objects eagerly and remains capped at 250.
- Baseline development overlay: `Created` was not exposed; `Active` 3; pool 250; peak-active unavailable.
- Approximate Sprite/Graphics/Container/Text counts for READY, PLAYING, WIN, and after 20 rounds: **Manual measurement required** until the diagnostics overlay exposes a stable scene census.
- Active advanced Pixi filters: none. The title's text style uses a drop shadow; no full-scene blur/glow filters are installed.

## Memory baseline

The production READY heap observations were 11.38–13.29 MB across isolated contexts. These are not a leak series because each viewport used a new context.

- READY: recorded above.
- After 10 / 25 / 50 rounds with forced GC: **Manual measurement required**.
- Heap snapshots A (READY), B (multiple rounds), C (reset): **Manual measurement required** in Chrome Memory tools.

## Loading pipeline baseline

Source inspection confirmed a hard minimum 900 ms delay after critical asset loading in `PixiRuntime`. This delay is included in TGI and is a candidate only because the baseline has now been captured. React ready, Pixi ready, assets loaded, session ready, and first-interactive were not individually marked before Milestone 12; per-stage timings are **Manual measurement required** for this baseline.

## Known limitations

- Headless/software-WebGL FPS cannot be compared with a real device's hardware-composited FPS.
- Browser DevTools Performance, React DevTools Profiler, CPU 4× slowdown, DPR 2/3, and forced-GC heap snapshots require a manual hardware Chrome pass.
- The local benchmark is appropriate for regression comparison of loading, bundle, asset, resource-count, and heap signals. It is not a substitute for field telemetry.

Reproduce the automated portion with `node scripts/performance-benchmark.mjs` while the production preview and backend are running.
