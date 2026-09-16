# Performance Optimizations

## 1. Critical background payload — High

**Problem:** the only critical raster was a 2.35 MiB PNG and was required before the game became interactive.

**Evidence:** the asset audit measured 2,469,435 bytes at 1,672 × 941. It was the largest standalone production asset.

**Change:** visually inspected conversion to quality-0.86 WebP, safely resized to 1,600 × 900. The original is retained in `assets/source`; only the WebP ships. `scripts/optimize-background.mjs` makes the conversion reproducible.

**Before:** 2,469,435 bytes. **After:** 240,998 bytes. **Result:** 2,228,437 bytes / 90.24% smaller.

**Tradeoff:** lossy encoding and a 4.3% dimension reduction. Side-by-side inspection retained the intended Roman detail, contrast and color direction.

## 2. Artificial loading floor — High

**Problem:** `PixiRuntime` waited until at least 900 ms had elapsed even when every critical asset was ready.

**Evidence:** source audit found the explicit `Math.max(0, 900 - elapsed)` timer. The pre-change production TGI was 5,678 / 8,612 / 3,205 / 2,764 ms across the four standard viewports.

**Change:** removed the timer; the loading screen now exits immediately after actual critical asset readiness. User Timing marks now separate Pixi initialization, asset loading, session readiness and first interactivity.

**After:** TGI was 5,915 / 9,011 / 2,798 / 2,426 ms in the same headless run. Portrait improved 407 ms and compact landscape 338 ms. Desktop samples regressed 237/399 ms under software WebGL, so no desktop improvement is claimed from this noisy single-run environment. The fixed 900 ms floor is nevertheless gone by construction.

**Tradeoff:** on fast devices the branded loading screen is visible for less time. Accuracy and faster interaction take priority over a minimum animation duration.

## 3. Broad React subscriptions — Medium

**Problem:** `GameHud` and `ResultOverlay` subscribed to the complete controller snapshot. Character/effect diagnostics update frequently, so unrelated components committed while READY and idle.

**Evidence:** the development React `Profiler` recorded, over the same six-second idle flow, 80 HUD commits and 69 result-overlay commits; `GameCanvas` committed four times.

**Change:** added a cached `useGameControllerSelector` with explicit shallow equality. HUD subscribes only to gameplay/HUD fields; the result overlay subscribes only to result/error. The debug overlay intentionally retains the whole snapshot.

**After:** seven HUD commits and one result-overlay commit over six seconds; `GameCanvas` remained at four. This is a reduction of 73 HUD commits (91.25%) and 68 result commits (98.55%) in that flow.

**Tradeoff:** selector field lists must be updated when a component gains a dependency. The lists are colocated with the components and preserve readable React code.

## 4. Particle diagnostics allocation — Low

**Problem:** the diagnostics path filtered all 250 pool entries four times per second merely to count active objects.

**Evidence:** code audit of `getDiagnostics()` showed the array allocation and scan; the overlay itself is the only consumer.

**Change:** active count is maintained on acquire/release. Added created, available, peak-active, current FPS, five-sample average, minimum and frame-time metrics without another ticker or render loop.

**Before/after CPU:** not isolated; no CPU improvement is claimed. **After allocation behavior:** the recurring `filter()` allocation is removed.

**Tradeoff:** pool transitions maintain one additional counter invariant, covered by focused tests.

## Budgets and guardrails

Measured budgets are deliberately close enough to catch accidental regressions without rejecting the current architecture:

- Vite entry JavaScript: maximum 600,000 raw bytes; current 566,881 bytes.
- Critical background: maximum 300,000 bytes; current 240,998 bytes.
- Particle pool: hard cap 250; stress requests cannot grow it.
- Renderer DPR: maximum 2 through the existing centralized clamp.

Run `npm run perf:budget` after `npm run build`.

## Audits with no code change

- **Pixi ticker:** loading owns one callback. MainScene owns five centralized callbacks: tween, character, particles, camera and game-feel scheduler. Tests assert all are removed at teardown.
- **Display tree:** READY census is 462 objects: 2 sprites, 420 graphics, 38 containers and 2 text objects. The high graphics count is dominated by the intentional fixed particle pool and procedural tile/character fallback. No conversion was made without a frame-profile signal.
- **Textures/cache:** the background uses one `Assets.load` result and one sprite; tile visuals reuse persistent graphics. Shared textures are unloaded only when the owning Pixi runtime is destroyed.
- **Filters:** no full-scene Pixi filters are active. Camera feedback mutates existing containers/layers.
- **Socket:** one client, bounded 200-event dedupe set, bounded eight-item UI log, and explicit `off`/manager cleanup. Local benchmark payloads were 2–160 response bytes; microbyte optimization was not justified.
- **Timers/listeners:** API timeouts clear in `finally`; audio, visibility, media-query and responsive listeners have matching removal; responsive RAF is cancelled; presentation scheduling is ticker-owned and cancelled on reset/destroy.
- **Audio:** one lazy context, one master gain, bounded active voices and explicit stop/detach/destroy paths. No encoded audio payload ships.
- **Database:** Supabase is intentionally absent until Milestone 13; no query/index optimization was fabricated.

## Memory result

The production mobile soak forced GC before each sample and retained one canvas throughout:

| Completed rounds |     Used JS heap |    Total JS heap |
| ---------------: | ---------------: | ---------------: |
|                0 |  9,569,957 bytes | 11,225,761 bytes |
|               10 | 11,477,923 bytes | 12,589,999 bytes |
|               25 | 11,798,656 bytes | 13,122,060 bytes |
|               50 | 11,744,367 bytes | 13,121,203 bytes |

Used heap decreased by 54,289 bytes from round 25 to 50 after forced GC. The initial rise is consistent with warmed caches/history and then plateaus; this run did not show persistent unbounded growth. A retained-object DevTools snapshot comparison remains manual.

## Local network result

One post-change local production-preview run measured complete fetch + body-read time. These are localhost diagnostics, not internet latency:

| Command |  Latency | Request / response body |
| ------- | -------: | ----------------------: |
| config  | 73.57 ms |           0 / 108 bytes |
| session | 13.06 ms |           0 / 110 bytes |
| history | 16.12 ms |             0 / 2 bytes |
| resync  | 14.89 ms |           0 / 116 bytes |
| start   | 15.67 ms |          74 / 160 bytes |
| reveal  | 14.02 ms |         112 / 154 bytes |
| cashout | 15.33 ms |         101 / 119 bytes |

Payloads are small and no duplicate command was observed. WebSocket envelopes remain versioned, bounded and deduplicated; exact on-wire compression/frame overhead is **Manual measurement required** in DevTools Network.

## Standard flow result

The production automation completed `READY → START → 3 SAFE → CASHOUT → START → TRAP → READY` in one safe-run attempt and retained exactly one canvas. This confirms the performance instrumentation and selectors did not change the core game flow.
