# Code Tour

Study these real files in order, then run a complete round while explaining ownership.

1. `apps/web/src/App.tsx`: application composition and recovery boundary.
2. `apps/web/src/game/runtime/PixiRuntime.ts`: one application, assets, resize and cleanup.
3. `apps/web/src/game/scenes/MainScene.ts`: scene layers and reusable entities.
4. `apps/web/src/game/controller/GameController.ts`: transitions, commands and authoritative resync.
5. `apps/web/src/game/board/BoardContainer.ts`: tile identities, layout and input.
6. `apps/web/src/game/character/CharacterController.ts`: cancellable reactions, independent of networking.
7. `apps/web/src/services/api/ApiClient.ts`: bounded requests, safe errors and cancellation.
8. `apps/server/src/game/game-engine.service.ts`: validation, random traps and transactional outcomes.
9. `apps/server/src/realtime/game.gateway.ts`: validated room membership and event delivery.
10. `apps/server/src/database/postgres-round.repository.ts`: persistent round mapping and locks.
11. `apps/server/src/database/postgres-session.repository.ts`: persistent fictional-credit sessions.

## Short Interview Answers

Why React plus Pixi? DOM controls suit the HUD; WebGL entities/ticker suit realtime game feedback.

Why REST plus WebSockets? Commands get explicit HTTP responses; committed events synchronize clients.

Why server authority? It protects hidden information, valid transitions and recoverable shared state.

Hard bug? After backend restart, low new event sequences were discarded as stale. Authoritative
resync now establishes the publisher's new epoch; focused regression tests protect this behavior.

Real performance improvement? The critical background lost 90.24% of its bytes and narrower
React subscriptions reduced idle HUD commits. Do not claim hardware FPS from software WebGL.

Mobile? Central layout, touch targets, safe areas, capped DPR and lower effect density. Physical
Safari/Android verification still needs real devices.

What remains? Procedural art/audio, keyboard canvas access and distributed scaling are documented
tradeoffs, not secretly completed features. Explain your own contribution and AI support honestly.
