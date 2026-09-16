# Regression Checklist

## Automated gate

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run test:e2e:mobile
```

## Manual critical path

- Start frontend/backend with no startup error and no relevant browser-console error.
- Complete one desktop and one mobile win/loss round; validate credits, multiplier and history.
- Resize and rotate during PLAYING; confirm one canvas, one Pixi application and retained round.
- Toggle sound, volume and Reduced Effects, reload and confirm persistence.
- Disconnect/reconnect WebSocket in READY and PLAYING; confirm authoritative state without duplicate result.
- Simulate timeout, expired session, missing asset and render error; use the offered recovery.
- Dispose/recreate runtime and confirm active Pixi/socket counters return to zero then one.
