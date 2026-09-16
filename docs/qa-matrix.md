# QA Matrix

| Area                 | Automated evidence                                                            | Manual evidence              | Status  |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------- | ------- |
| Math/RNG             | Valid/invalid matrix, rounding, 500 deterministic trap generations            | N/A                          | Pass    |
| State/controller     | Transition table, stale response, double input, dismissed-result resync       | Desktop/mobile rounds        | Pass    |
| REST/backend         | HTTP integration, DTO fuzz-lite, ownership, history, concurrent commands      | Health and startup           | Pass    |
| WebSocket            | Gateway rooms/events plus client order, dedupe, malformed payload and cleanup | Disconnect/reconnect         | Pass    |
| React UI             | HUD availability and ErrorBoundary component tests                            | Settings and result overlays | Pass    |
| Rendering/mobile     | Layout calculations, Pixi lifecycle, 20-cycle soak, Playwright matrix         | 1366×768 and 390×844         | Pass    |
| Accessibility        | Reduced-motion behavior and labelled controls                                 | Keyboard/settings inspection | Partial |
| Persistence/recovery | Settings store, session replacement, active-round resync                      | Reload and backend recovery  | Pass    |

The authoritative source for exact commands and current totals is `PROJECT_STATUS.md`.
