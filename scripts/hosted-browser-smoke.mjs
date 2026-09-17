import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const frontend = process.env.SMOKE_WEB_URL;
assert(
  frontend && new URL(frontend).protocol === 'https:',
  'Set SMOKE_WEB_URL to the hosted HTTPS frontend',
);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    baseURL: frontend,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const socketUrls = new Set();
  page.on('websocket', (socket) => socketUrls.add(socket.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'START HEIST', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.locator('.debug-overlay')).toHaveCount(0);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('canvas.pixi-canvas')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'START HEIST', exact: true })).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    console.log(`Hosted layout verified: ${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'START HEIST', exact: true }).tap();
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
  await page.locator('canvas.pixi-canvas').tap({ position: { x: 195, y: 350 } });
  const escape = page.getByRole('button', { name: 'ESCAPE WITH LOOT', exact: true });
  await expect
    .poll(async () => (await escape.isEnabled()) || (await page.getByRole('dialog').isVisible()), {
      timeout: 15_000,
    })
    .toBe(true);
  if (await escape.isEnabled()) await escape.tap();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^(CONTINUE|TRY AGAIN)$/ }).tap();
  await expect(page.getByRole('button', { name: 'START HEIST', exact: true })).toBeEnabled();
  const creditsBefore = await page
    .locator('.hud-stats > div')
    .first()
    .locator('strong')
    .textContent();
  await page.reload();
  await expect(page.getByRole('button', { name: 'START HEIST', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.locator('.hud-stats > div').first().locator('strong')).toHaveText(
    creditsBefore,
  );
  await expect(page.locator('canvas.pixi-canvas')).toHaveCount(1);
  assert(
    socketUrls.size > 0 && [...socketUrls].every((url) => new URL(url).protocol === 'wss:'),
    'Expected secure realtime transport',
  );
  assert.deepEqual(failures, [], 'Unexpected browser application errors');
  console.log(
    'Hosted browser smoke passed: responsive layout, touch round, reload restoration, WSS and one canvas',
  );
  await context.close();
} finally {
  await browser.close();
}
