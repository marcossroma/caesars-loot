# Character System

## Event flow

```text
REST / Socket.IO result
        ↓
GameController authoritative snapshot
        ↓
typed internal GameEventBus event
        ↓
CharacterController state + priority selection
        ↓
CharacterView reusable PixiJS containers / optional state texture
```

The character never subscribes to Socket.IO and React never manipulates its display objects. This
keeps transport ownership in `GameController`, rendering ownership in the PixiJS scene, and makes
remote-tab events use the same reactions as the tab that sent the REST command.

## States and reactions

| State          | Trigger                  | Animation                               | Priority |
| -------------- | ------------------------ | --------------------------------------- | -------: |
| `idle`         | ready/reset              | breathing and micro head sway           |        0 |
| `thinking`     | active reveal flow       | board-facing lean                       |        1 |
| `anticipation` | `STARTING` / round start | short lean and bounce                   |        2 |
| `happy`        | safe tile                | small, medium or big hop + gold spark   |        2 |
| `surprised`    | trap tile                | impact recoil + dust                    |        3 |
| `escape`       | cashout starts           | short loot dash + dust                  |        3 |
| `scared`       | surprise completes       | controlled shake                        |        4 |
| `caught`       | lost round               | compressed defeated pose                |        5 |
| `celebrate`    | won round                | coin burst and victory jumps, then hold |        5 |

Happy variants use one bounded random choice per safe reveal. Timings and easing functions live in
`characterTypes.ts`, not inside event handlers.

## Cancellation and queueing

`play()` compares explicit priorities. A higher-priority state immediately replaces the current
animation after restoring the absolute base pose. A lower-priority request can occupy one pending
slot while a short reaction finishes. Terminal `caught` and `celebrate` states interrupt all smaller
reactions. This bounds the queue and prevents rapid tile input from accumulating animation work.

Every frame is derived from elapsed time and the stored baseline; it never adds transforms to values
from the previous frame. `reset()` clears the pending state and reapplies the base transform before
returning to `idle`.

## Assets and fallback

Critical character states (`idle`, `happy`, `scared`, `celebrate`) are represented in the central
asset manifest and pass through `CharacterAssetLoader`. Their sources remain intentionally empty
until isolated approved art exists, so the loader does not create known 404 requests. Missing or
failed textures select the original reusable PixiJS fallback and log one development-only warning.
When a full sprite sheet arrives, the view can replace state textures while the controller, event
mapping, priorities and lifecycle remain unchanged.

## Layout and reduced motion

The scene owns named background, ambient, character, board, foreground-effect and UI layers. On
desktop, the character sits in the free area left of the board. Portrait mobile scales it to roughly
`0.22–0.30` above the board; compact landscape places it at the far left. Board and HUD remain the
layout priority.

The controller observes `prefers-reduced-motion` for its poses. The global particle and camera
managers separately reduce density, shake, zoom and flash without removing expression or state.

## Disposal and performance

The character owns exactly one callback on the existing Pixi ticker and persistent display objects.
Since Milestone 8, `GameFeelDirector` owns all game-event subscriptions and `ParticleManager` owns
the shared fixed pool. `destroy()` removes the character ticker and media-query listener, clears
pending work and destroys the view tree. Resizes reposition existing objects; resets do not recreate
them.
