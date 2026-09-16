# Mobile Testing

## Layout strategy

`layout.config.ts` is the single breakpoint and sizing source. Mobile uses a bottom HUD and compact
character; tablet retains the portrait hierarchy with a 0.30-scale character; desktop uses a side
HUD; viewports below 500 px in landscape use a right control rail. The board is calculated from the
space remaining after the relevant HUD and safe-area reserves.

The document uses `viewport-fit=cover`, all four `env(safe-area-inset-*)` values, `100dvh` with a
`100vh` fallback, and no zoom-blocking viewport directives. Primary controls and steppers target at
least 44 px. The canvas and controls use `touch-action: manipulation`, and overscroll is contained
during the full-viewport game.

## Viewport matrix

| Viewport  | Orientation       | Browser  | Status | Notes                                                   |
| --------- | ----------------- | -------- | ------ | ------------------------------------------------------- |
| 360×800   | Portrait          | Chromium | Pass   | Full board, lower HUD/actions, zero horizontal overflow |
| 375×812   | Portrait          | Chromium | Pass   | Compact phone layout, zero horizontal overflow          |
| 390×844   | Portrait          | Chromium | Pass   | Full touch round and reduced-effects check              |
| 393×873   | Portrait          | Chromium | Pass   | Full board and HUD visible                              |
| 412×915   | Portrait          | Chromium | Pass   | Full board and HUD visible                              |
| 430×932   | Portrait          | Chromium | Pass   | WON overlay captured and readable                       |
| 768×1024  | Portrait tablet   | Chromium | Pass   | Tablet character fixed at compact 0.30 scale            |
| 1366×768  | Landscape desktop | Chromium | Pass   | Cinematic side-HUD layout retained                      |
| 1920×1080 | Landscape desktop | Chromium | Pass   | Board cap prevents overexpansion                        |
| 844×390   | Landscape phone   | Chromium | Pass   | Right control rail, full board, no vertical crush       |
| 932×430   | Landscape phone   | Chromium | Pass   | Compact-landscape mode, zero horizontal overflow        |

Automated Playwright smoke tests cover 360×800, 390×844, 430×932 and 1366×768, plus touch flow,
rotation, delayed critical loading, runtime teardown and 20 complete mobile browser rounds. Visual review images are in
[`docs/screenshots/m9`](./screenshots/m9).

## Touch behavior

Tiles use only PixiJS pointer events. A tile tracks one primary pointer ID, ignores additional
fingers, shows pressed scale/highlight immediately, and accepts exactly one matching `pointertap`.
The server remains authoritative for safe/trap results. Controller input locking rejects rapid taps,
two-tile reveals and cashout during a pending reveal. Hover remains a desktop-only enhancement.

## Orientation and lifecycle

`ResponsiveLayoutManager` combines `ResizeObserver`, window resize, visual viewport resize and
orientation changes into a requestAnimationFrame-throttled pipeline. A PLAYING round was rotated
390×844 → 844×390 → 390×844 without resetting state; the character changed scale 0.18 → 0.28 → 0.18
and the canvas/application count stayed one.

React teardown/restoration produced canvas/application counts `1 → 0 → 1` and `maxActive=1`.
Stale scene diagnostics are owner-scoped so an old Strict Mode/HMR cleanup cannot unbind or overwrite
the replacement scene. Visibility return reconnects when needed and always requests authoritative
resynchronization. Manual socket disconnect/reconnect during PLAYING restored the same round.

## Performance and network

The mobile browser sample reported 60 FPS at idle with low effects, a 250-object fixed pool, one
character ticker and one active application. A 20-round browser endurance run retained those resource
counts without duplication. The 1672×941 background is 2.35 MiB and is the only
production raster, so no duplicate or 4K asset was found. Playwright adds 600 ms of critical-asset
latency to verify the responsive loading state. True Fast 3G/Slow 4G throughput, thermal throttling,
memory pressure and Mobile Safari behavior require a physical device.

## Real-device procedure

1. Run `npm run dev:web` and `npm run dev:server` on the same LAN.
2. Allow ports 5173 and 3000 in the local firewall only for the trusted network.
3. Open `http://<computer-lan-ip>:5173` on the phone. If testing from another origin, add that exact
   LAN origin to the development CORS configuration; do not use a wildcard for production.
4. Repeat READY, several reveals, cashout, trap, portrait/landscape rotation, background/foreground,
   socket disconnect/reconnect and Reduced Effects.
5. Use the later Vercel preview plus deployed API for cross-network testing after the deployment
   milestone.

## Known limitations

- No physical iOS/Android device was attached during this milestone; browser emulation cannot prove
  notch geometry, thermal behavior, real radio throughput or mobile audio interruption.
- Sound is only a persisted UI preference until the Milestone 10 SoundManager; there is no autoplay
  behavior to validate yet.
- Canvas keyboard navigation and full screen-reader tile semantics remain future accessibility work.
- PWA, native packaging, push notifications and device-detection libraries are intentionally absent.
