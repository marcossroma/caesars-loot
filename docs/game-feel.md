# Game Feel System

Milestone 8 centralizes presentation feedback without changing authoritative game math, REST or
Socket.IO contracts.

## Ownership

`GameFeelDirector` is the only subscriber that translates internal round events into visual
reactions. It coordinates `CharacterController`, `ParticleManager`, `CameraEffectsManager` and
optional sound hooks. It has no WebSocket dependency and uses the existing typed `GameEventBus`.

The Pixi display tree separates the static background from the camera. Character, board and
foreground particles live in one camera container; Pixi overlays and the React HUD remain outside
it. Every camera frame is calculated from the stored viewport centre, so shake and zoom cannot
accumulate transform drift.

## Particle architecture

`ParticleManager` preallocates 250 `Graphics` objects and returns inactive particles to that fixed
pool. The six presets are `goldSpark`, `coinBurst`, `gemSparkle`, `smoke`, `dust` and `fireEmber`.
No display objects are allocated per animation frame. Low, medium and high quality multiply
emission counts; a sustained FPS sample below 45 lowers quality after a cooldown. Portrait and
compact viewports start on low quality.

## Sequences

- Safe: happy reaction, gold sparks at the revealed tile, subtle gold flash and small camera shake.
  Every fifth tile ID gets a deterministic gem sparkle accent; this is presentation-only.
- Trap: surprised recoil, 55 ms visual hit-stop, red flash, impact shake, smoke and dust, followed by
  the caught state and screen darkening when the authoritative loss arrives.
- Win/cashout: escape or celebration reaction, zoom punch, gold flash and coin/gold burst before the
  result card arrives.
- Reset/error/dispose: scheduled actions are cancelled, particles are returned and camera transforms
  and overlays return to baseline.

## Accessibility and diagnostics

`prefers-reduced-motion` forces low density, disables zoom punch, greatly reduces shake and softens
flashes. The development overlay reports FPS, active/max particles, quality, camera state,
scheduled effects, listeners and ticker callbacks. It exposes each preset plus Safe/Trap/Win/Lose
and stress controls for 100, 250 and 500 requested particles; the hard cap remains 250.
