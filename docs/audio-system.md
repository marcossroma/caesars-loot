# Audio system

## Architecture

`SoundManager` is a browser-level service independent from React, PixiJS and networking. It owns at most one `AudioContext`, one master gain, active voices, cue rate limits, priority interruption and lifecycle cleanup. `GameSettingsStore` is its only state dependency.

Gameplay does not call audio directly. Controller transitions emit typed `GameEventBus` events; `GameFeelDirector` converts each event into coordinated character, camera, particle and sound responses. React UI controls may play the small `button` cue directly because they are presentation-only actions.

```text
REST/socket state -> GameController -> GameEventBus -> GameFeelDirector -> SoundManager
React settings ---------------------------> GameSettingsStore -----------^
```

## Cues and assets

Cues are semantic (`tilePress`, `safeLoot`, `trap`, `cashout`, `win`, `lose`) rather than filename-driven. Milestone 10 implements lightweight Web Audio oscillators, providing a zero-byte encoded-audio fallback and avoiding an audio download on mobile. The `assets/audio/{ui,gameplay,character,ambient}` folders reserve production categories.

Minor cues are rate-limited. Terminal trap/win/lose cues stop lower-priority voices. `stopAll` runs on reset, error, unmount and page backgrounding.

## Mobile behavior

The context is created only after the first `pointerdown` or `keydown`, satisfying mobile autoplay policies. If Web Audio is blocked or unavailable, `unlock()` returns `false` and gameplay continues silently. Page hiding stops voices and suspends the context; returning resumes it only when sound is enabled.

Mute, volume and Reduced Effects are validated, clamped and stored together in `localStorage`. Storage failure degrades to in-memory settings. No music, mixer, streaming or large audio dependency is included.

## Interview answers

**Why is audio outside React?** React rendering is not an audio lifecycle. A service keeps one context and stable rate limits across HUD rerenders and Pixi scene rebuilds.

**How do you prevent autoplay failures?** Context creation/resume happens on the first trusted user gesture; failure is non-fatal.

**How do you prevent sound spam?** Semantic cue rate limits reject duplicates, while terminal-priority cues interrupt minor voices.

**What is cleaned up?** Gesture listeners, active oscillators, settings subscription, gain/context resources and subscribers.
