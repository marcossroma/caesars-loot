# Caesar’s Loot — Portfolio Package

Original mobile-first instant-game prototype using React, TypeScript, PixiJS, NestJS,
Socket.IO and Supabase PostgreSQL. Fictional credits only: no payments or real-money gameplay.

## Goal and decisions

Explore responsive realtime interfaces without mixing rendering with business rules.
React owns accessible HUD controls; one persistent PixiJS application owns the scene.
REST carries commands, Socket.IO carries committed events, and PostgreSQL transactions
protect server-authoritative outcomes and concurrent settlement.

## Evidence and limitations

See [technical summary](technical-summary.md), [performance case study](../performance-case-study.md)
and [release checklist](../release-checklist.md). Procedural character/audio are intentional
fallbacks; hardware mobile validation and recorded gameplay remain manual. Do not describe
the prototype as a commercial gambling product or claim hardware FPS from headless tests.

## Links

- [Demo](https://caesars-loot-server.vercel.app/) — see README for current deployment status.
- [Source](https://github.com/marcossroma/caesars-loot)
- [Video recording plan](../portfolio/gameplay-video.md) — no published video URL yet.
- [Code tour](../interview/code-tour.md)
- [Presentation scripts](../interview/demo-scripts.md)
- [Curriculum and LinkedIn drafts](career-drafts.md)
- [Final review and owner actions](../portfolio/final-review.md)

## Repository presentation

Suggested description: Original instant-game prototype built with React, TypeScript,
PixiJS, NestJS and WebSockets.

Suggested topics: react, typescript, pixijs, nestjs, websockets, webgl, game-development, portfolio.
Use a clean production desktop gameplay screenshot for the social preview, not a debug overlay.

No open-source license is granted by this package; choosing one remains the owner's decision.
The project background is original/generated, graphics and audio are procedural. Reference
boards guide the direction and are not copied into the production scene as extracted sprites.
