# Performance Testing

## Automated production baseline

1. Build with `npm run build`.
2. Start the production server with CORS for preview:
   `$env:CORS_ORIGIN='http://localhost:5173,http://localhost:4173'; npm run start --workspace=@caesars-loot/server`.
3. Start the frontend with `npm run preview --workspace=@caesars-loot/web -- --host 0.0.0.0 --port 4173`.
4. Run `npm run perf:benchmark` for the four standard viewports and local REST latency/payload sizes.
5. Run `npm run perf:memory` for forced-GC samples at READY and after 10, 25 and 50 rounds.
6. Run `npm run perf:flow` for the standardized three-safe/cashout/trap sequence.
7. Run `npm run perf:assets` and `npm run perf:budget`.
8. With the development server running, refresh the small overlay evidence with `npm run perf:evidence`.

Headless Chromium uses software WebGL on this workstation. Loading, payload, bundle, asset, resource and heap results are reproducible; its FPS is diagnostic only.

## Standard manual gameplay flow

Use production preview, keep DevTools recording, and repeat exactly:

1. READY idle for 10 seconds.
2. START.
3. Reveal three safe tiles. If a trap appears first, record the trap scenario, reset, and restart.
4. CASHOUT and wait for the win sequence.
5. Reset and START.
6. Reveal until TRAP and wait for the loss sequence.
7. Reset to READY.

Capture separate marks for pointer response, REST response and presentation completion. Network latency is not animation latency; perceived latency spans both.

## Chrome Performance panel

Use hardware-accelerated Chrome. Disable screenshots only if capture overhead is material. Record Idle, Safe Reveal, Trap Reveal, Win, Lose, rapid resize/orientation, and 20 interactions. Inspect main-thread long tasks, scripting, style/layout, paint, GPU work, GC and frames above the approximate 16.67 ms budget. Save only small redacted screenshots under `docs/images/performance`.

## React Profiler

Use the development build and React DevTools Profiler for multiplier change, credits update, trap selector, reveal and socket event. The built-in development `Profiler` counters provide a quick regression signal for Canvas, HUD and Result. Expect diagnostics to update the DEV overlay without continuously committing HUD/Result.

## Pixi and particles

Open `DEV` and record current/average/minimum FPS, frame time, object census and ticker counts. Run Stress 0, 50, 100 and 250 at the same viewport. Check READY, PLAYING, WIN and after the 20-round E2E; display objects, pool created count and ticker count must return to their bounded baseline.

## Memory

For browser-grade evidence, take heap snapshots at READY, after repeated rounds, and after reset; expose GC in DevTools and force it before comparisons. Texture/cache retention is expected. A leak requires persistent growth after GC or retained detached objects/listeners, not a single higher sample.

## DPR, quality and low-end pass

Repeat portrait mobile at DPR 1, 2 and 3 using device emulation; the renderer should clamp to 2. Compare LOW/MEDIUM/HIGH effects with identical bursts. Repeat with CPU 4× slowdown and verify auto-quality cooldown does not oscillate. These hardware DevTools measurements remain **Manual measurement required** in the automated report.

## Final regression gate

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run perf:budget`, then the critical Playwright grep documented in `PROJECT_STATUS.md`.
