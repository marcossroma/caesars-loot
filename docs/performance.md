# Performance

## Milestone 8 profile

Before: character accents used a separate 14-object pool, board trap feedback mutated the board
root, and there was no shared particle/FPS diagnostic. The production web entry was approximately
535 kB (161 kB gzip).

After: effects use one preallocated 250-object global pool and three additional ticker callbacks
(particles, camera and director). Particle transforms mutate Pixi objects directly and diagnostics
are throttled; React is updated only by controller snapshots and the numeric HUD animation. Stress
requests of 100, 250 and 500 remain capped at 250. Browser profiling should use the live FPS and
active-particle counters in the development overlay; quality automatically steps down below a
sustained 45 FPS sample. Final bundle measurements are recorded in `PROJECT_STATUS.md`.

Milestone 2 establishes the first lifecycle baseline: one active PixiJS application, one Canvas,
cover-crop scene resize without reconstruction, and a render-resolution cap of 2× device pixel ratio.
Desktop 1366×768 and mobile 390×844 resizing completed without horizontal overflow. React unmount
removed the Canvas and destroyed the runtime.

Representative FPS, particle load, React rerenders, texture sizes, WebSocket lifecycle and longer
memory checks begin after the corresponding systems exist.

Milestone 3 keeps the board allocation stable at 25 `LootTile` entities. One shared ticker callback
updates only active tweens; completed and cancelled transitions leave the map. Pointer listeners are
registered once per tile and removed during destruction. Resize changes geometry and positions in
place, while diagnostics confirmed one Canvas and one active PixiJS application at every requested
viewport.

Milestone 7 added one character callback and an initial 14-object local effect pool. Milestone 8
moved all effects and event subscriptions into the shared managers/director. Character poses still
mutate one reusable object and are calculated from a saved baseline. Automated 20-cycle soak tests
confirm the global pool, listener and ticker counts remain constant and return to zero on disposal.

## Milestone 9 mobile profile

- Browser checks at every required viewport reported 60 FPS while idle in the local development
  build. Phone and compact-landscape modes selected low effects automatically; the fixed pool stayed
  at 250 objects and no active burst remained after settling.
- Rotation during an active round retained one canvas, one PixiJS application, one character ticker
  and the same authoritative round. Explicit React teardown/restoration measured application counts
  `1 → 0 → 1`, with the historical maximum remaining one.
- The only production raster currently loaded is `roman-treasury.png`: 1672×941, 2,469,435 bytes
  (2.35 MiB). It is not a 4K source and no duplicate production images were found. A mobile variant
  would add cache and art-maintenance cost without enough current evidence; revisit after real-device
  transfer profiling.
- Critical loading remains staged behind the branded PixiJS loading scene. A Playwright test adds
  600 ms to the background request and confirms the loading message, canvas and eventual interactive
  controls remain available. This is deterministic latency coverage, not a substitute for Fast 3G /
  Slow 4G testing on a physical device.
- Local reconnect validation during PLAYING restored the same round and single canvas. The observed
  local sample was 10 ms REST latency and 13 ms socket ping; those numbers describe the test machine,
  not production network performance.
- The required viewport matrix has zero horizontal overflow. Touch smoke coverage performs START,
  one primary canvas tap and a server-authoritative cashout/loss result.
- A sequential 20-round Playwright run at 390×844 used real REST, Socket.IO and presentation timings;
  it completed with one canvas/application, one character ticker and the fixed 250-object pool.
- The final production entry is 550.03 kB (165.09 kB gzip). Vite still emits its advisory above
  500 kB; splitting optional PixiJS systems is deferred because the current single-scene startup is
  stable and the milestone did not introduce secondary art bundles suitable for lazy loading.
