import { chromium } from '@playwright/test';

const baseURL = process.env['CAESARS_LOOT_PERF_URL'] ?? 'http://localhost:4173';
const viewports = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'desktop-full-hd', width: 1920, height: 1080 },
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-precise-memory-info'],
});

try {
  const results = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleIssues = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });

    const wallStart = performance.now();
    await page.goto(baseURL, { waitUntil: 'load' });
    await page.locator('.start-heist').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const button = document.querySelector('.start-heist');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    const timeToGameInteractiveMs = performance.now() - wallStart;

    const runtime = await page.evaluate(async () => {
      const deltas = [];
      let previous;
      const startedAt = performance.now();

      await new Promise((resolve) => {
        const sample = (timestamp) => {
          if (previous !== undefined) deltas.push(timestamp - previous);
          previous = timestamp;
          if (performance.now() - startedAt >= 5_000) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });

      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const sortedFrames = [...deltas].sort((left, right) => left - right);
      const averageFrameMs = deltas.reduce((sum, frame) => sum + frame, 0) / deltas.length;
      const p95FrameMs = sortedFrames[Math.floor(sortedFrames.length * 0.95)] ?? 0;
      const memory = performance.memory;
      const userTimings = performance
        .getEntriesByType('measure')
        .filter((entry) => entry.name.startsWith('caesars-loot:'))
        .map((entry) => ({ name: entry.name, durationMs: entry.duration }));

      return {
        navigationMs: navigation?.duration ?? null,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        loadMs: navigation?.loadEventEnd ?? null,
        resources: resources.length,
        transferBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
        decodedBytes: resources.reduce((sum, resource) => sum + (resource.decodedBodySize || 0), 0),
        fpsAverage: 1_000 / averageFrameMs,
        fpsMinimumObserved: 1_000 / Math.max(...deltas),
        averageFrameMs,
        p95FrameMs,
        maxFrameMs: Math.max(...deltas),
        framesOverBudget: deltas.filter((frame) => frame > 16.67).length,
        sampledFrames: deltas.length,
        heapUsedBytes: memory?.usedJSHeapSize ?? null,
        heapTotalBytes: memory?.totalJSHeapSize ?? null,
        dpr: devicePixelRatio,
        userTimings,
      };
    });

    results.push({
      viewport,
      timeToGameInteractiveMs,
      ...runtime,
      consoleIssues,
    });
    await context.close();
  }

  const apiBaseURL = process.env['CAESARS_LOOT_API_URL'] ?? 'http://localhost:3000';
  const network = [];
  const request = async (name, path, init) => {
    const bodyBytes = init?.body ? Buffer.byteLength(init.body) : 0;
    const startedAt = performance.now();
    const response = await fetch(`${apiBaseURL}${path}`, init);
    const responseText = await response.text();
    network.push({
      name,
      status: response.status,
      latencyMs: performance.now() - startedAt,
      requestBytes: bodyBytes,
      responseBytes: Buffer.byteLength(responseText),
    });
    if (!response.ok) throw new Error(`${name} failed with ${response.status}: ${responseText}`);
    return JSON.parse(responseText);
  };
  const post = (name, path, body) =>
    request(name, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  await request('config', '/api/game/config');
  let session = await post('session', '/api/session');
  await request('history', `/api/game/history?sessionId=${session.sessionId}`);
  await request('resync', `/api/session/${session.sessionId}/state`);
  let round = await post('start', '/api/game/start', {
    sessionId: session.sessionId,
    bet: 5,
    trapCount: 3,
  });
  let safeReveal = null;
  for (let attempt = 0; attempt < 8 && !safeReveal; attempt += 1) {
    const reveal = await post('reveal', '/api/game/reveal', {
      sessionId: session.sessionId,
      roundId: round.roundId,
      tileId: 0,
    });
    if (reveal.result === 'safe') {
      safeReveal = reveal;
      break;
    }
    session = await post('session-retry', '/api/session');
    round = await post('start-retry', '/api/game/start', {
      sessionId: session.sessionId,
      bet: 5,
      trapCount: 3,
    });
  }
  if (safeReveal) {
    await post('cashout', '/api/game/cashout', {
      sessionId: session.sessionId,
      roundId: round.roundId,
    });
  }

  console.log(
    JSON.stringify(
      { baseURL, apiBaseURL, measuredAt: new Date().toISOString(), results, network },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
