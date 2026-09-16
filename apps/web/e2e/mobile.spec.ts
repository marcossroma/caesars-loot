import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1366, height: 768 },
] as const;

async function waitUntilReady(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
}

for (const viewport of viewports) {
  test(`${viewport.width}x${viewport.height} keeps the board and primary HUD inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await waitUntilReady(page);

    await expect(page.locator('canvas.pixi-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'START HEIST' })).toBeVisible();
    await expect(page.getByText('Multiplier', { exact: true })).toBeVisible();
    await expect(page.getByText('Potential loot', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
}

test('touch flow accepts one primary tap and reaches a server-authoritative result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitUntilReady(page);
  await page.getByRole('button', { name: 'START HEIST' }).tap();
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();

  const canvas = page.locator('canvas.pixi-canvas');
  await canvas.tap({ position: { x: 195, y: 350 } });
  await expect
    .poll(
      async () => {
        const state = (await page.locator('.hud-state').textContent())?.trim();
        const safeVaults = Number(
          (await page.locator('.hud-stats > div').nth(3).locator('strong').textContent()) ?? 0,
        );
        return state === 'LOST' || safeVaults > 0;
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  if (await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).isEnabled()) {
    await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).tap();
    await expect(page.getByRole('heading', { name: /loot secured/i })).toBeVisible({
      timeout: 10_000,
    });
  } else {
    await expect(page.getByRole('dialog')).toBeVisible();
  }
});

test('rotation keeps the active round and the single PixiJS application', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitUntilReady(page);
  await page.getByRole('button', { name: 'START HEIST' }).tap();
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.layoutMode))
    .toBe('compact-landscape');
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.layoutMode))
    .toBe('mobile');
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        canvas: document.querySelectorAll('canvas').length,
        active: document.documentElement.dataset.pixiActive,
        max: document.documentElement.dataset.pixiMaxActive,
      })),
    )
    .toEqual({ canvas: 1, active: '1', max: '1' });
});

test('critical asset delay keeps the responsive loading experience visible', async ({ page }) => {
  await page.route('**/assets/backgrounds/roman-treasury.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByText(/Loading treasures/i)).toBeVisible();
  await expect(page.locator('canvas.pixi-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
});

test('React teardown releases and restores PixiJS without duplication', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitUntilReady(page);
  await page.getByRole('button', { name: 'Dispose test runtime' }).press('Enter');
  await expect.poll(() => page.locator('canvas').count()).toBe(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.pixiActive))
    .toBe('0');
  await page.getByRole('button', { name: 'Restore test runtime' }).press('Enter');
  await expect(page.locator('canvas.pixi-canvas')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: document.documentElement.dataset.pixiActive,
        max: document.documentElement.dataset.pixiMaxActive,
      })),
    )
    .toEqual({ active: '1', max: '1' });
});

test('20 mobile rounds keep PixiJS, character and pooled effects stable', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await waitUntilReady(page);
  await page.locator('.hud-settings summary').click();
  await page.getByRole('button', { name: /SOUND/ }).click();
  await page.getByRole('button', { name: /SOUND/ }).click();
  await page.locator('.hud-settings summary').click();

  const displayCensus = () =>
    page.evaluate(() => ({
      objects: document.documentElement.dataset.pixiObjects,
      sprites: document.documentElement.dataset.pixiSprites,
      graphics: document.documentElement.dataset.pixiGraphics,
      containers: document.documentElement.dataset.pixiContainers,
      text: document.documentElement.dataset.pixiText,
      tickers: document.documentElement.dataset.pixiTickers,
    }));
  const readyCensus = await displayCensus();

  for (let round = 0; round < 20; round += 1) {
    await page.getByRole('button', { name: 'START HEIST' }).tap();
    await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
    if (round === 0) expect(await displayCensus()).toEqual(readyCensus);
    await page.locator('canvas.pixi-canvas').tap({ position: { x: 195, y: 350 } });
    await expect
      .poll(
        async () =>
          (await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).isEnabled()) ||
          (await page.getByRole('dialog').isVisible()),
        { timeout: 10_000 },
      )
      .toBe(true);
    if (await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).isEnabled()) {
      await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).tap();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    }
    if (round === 0) expect(await displayCensus()).toEqual(readyCensus);
    await page.locator('.result-overlay button').tap();
    await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled();
  }

  expect(await displayCensus()).toEqual(readyCensus);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        canvas: document.querySelectorAll('canvas').length,
        active: document.documentElement.dataset.pixiActive,
        max: document.documentElement.dataset.pixiMaxActive,
      })),
    )
    .toEqual({ canvas: 1, active: '1', max: '1' });
  await expect(page.locator('.debug-overlay output').filter({ hasText: 'Audio:' })).toContainText(
    'Voices:0',
  );
  await expect(
    page.locator('.debug-overlay output').filter({ hasText: 'Character:' }),
  ).toContainText('Ticker:1');
  await expect(
    page.locator('.debug-overlay output').filter({ hasText: 'Pool created/available/peak:' }),
  ).toContainText('250/');
});

test('captures the Milestone 9 visual review set', async ({ page }) => {
  test.setTimeout(90_000);
  const screenshotPath = (name: string) =>
    path.resolve(process.cwd(), '../../docs/screenshots/m9', name);
  await page.setViewportSize({ width: 360, height: 800 });
  await waitUntilReady(page);
  await page.screenshot({ path: screenshotPath('360x800-ready.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'START HEIST' }).tap();
  await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath('390x844-playing.png') });

  const revealPositions = [195, 125, 265, 55, 335];
  for (const x of revealPositions) {
    await page.locator('canvas.pixi-canvas').tap({ position: { x, y: 350 } });
    await expect
      .poll(
        async () =>
          (await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).isEnabled()) ||
          (await page.getByRole('dialog').isVisible()),
        { timeout: 10_000 },
      )
      .toBe(true);
    if (await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).isEnabled()) break;
    await page.getByRole('button', { name: 'TRY AGAIN' }).tap();
    await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled();
    await page.getByRole('button', { name: 'START HEIST' }).tap();
    await expect(page.getByText('PLAYING', { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'ESCAPE WITH LOOT' })).toBeEnabled();
  await page.getByRole('button', { name: 'ESCAPE WITH LOOT' }).tap();
  await expect(page.getByRole('heading', { name: /loot secured/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.screenshot({ path: screenshotPath('430x932-won.png') });

  await page.getByRole('button', { name: 'CONTINUE' }).tap();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: screenshotPath('844x390-landscape.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: screenshotPath('1366x768-desktop.png') });
});
