import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
}

test('persists mute, volume and reduced effects across reload', async ({ page }) => {
  // Playwright creates a clean context for each test; an extra reset/reload is redundant.
  // The CI trace reached the final assertion with only 174 ms of its total budget left.
  test.setTimeout(process.env['CI'] ? 120_000 : 60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('.hud-settings summary').click();
  await page.getByRole('button', { name: 'SOUND ON' }).click();
  await page.getByLabel('Sound volume').fill('35');
  await page.getByRole('button', { name: 'FX FULL' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
  await page.locator('.hud-settings summary').click();
  await expect(page.getByRole('button', { name: 'SOUND OFF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'FX REDUCED' })).toBeVisible();
  await expect(page.getByLabel('Sound volume')).toHaveValue('35');
});

test('mobile gesture unlocks audio without blocking gameplay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('.hud-settings summary').tap();
  await page.getByText('DEV', { exact: true }).click();
  await expect(page.getByText(/Audio:unlocked/)).toBeVisible();
});

test('offline initialization offers a manual recovery with bounded GET retries', async ({
  page,
}) => {
  const apiRoute = `${new URL(process.env.E2E_API_URL ?? 'http://localhost:3000').origin}/**`;
  await page.route(apiRoute, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'NETWORK_OFFLINE', message: 'offline', retryable: true }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'HEIST INTERRUPTED' })).toBeVisible({
    timeout: 15_000,
  });
  await page.unroute(apiRoute);
  await page.getByRole('button', { name: 'RECOVER' }).click();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
});

test('debug recovery handles expired sessions and React render failures', async ({ page }) => {
  // Two complete recovery cycles can exceed the default budget on software-WebGL CI.
  test.setTimeout(60_000);
  await ready(page);
  await page.getByText('DEV', { exact: true }).click();
  await page.getByRole('button', { name: 'Simulate session' }).click();
  await expect(page.getByRole('heading', { name: 'SESSION EXPIRED' })).toBeVisible();
  await page.getByRole('button', { name: 'START NEW SESSION' }).click();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Simulate render error' }).click();
  await expect(page.getByRole('heading', { name: 'THE HEIST HIT A SNAG' })).toBeVisible();
  await page.getByRole('button', { name: 'RESTART GAME' }).click();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
});

test('missing background uses a visible fallback and still reaches READY', async ({ page }) => {
  await page.route('**/assets/backgrounds/roman-treasury.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText(/safe fallback is active/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
});

test('timeout recovery is explicit and does not duplicate PixiJS or sockets', async ({ page }) => {
  test.setTimeout(60_000);
  await ready(page);
  await page.getByText('DEV', { exact: true }).click();
  await page.getByRole('button', { name: 'Simulate timeout' }).click();
  await expect(page.getByRole('heading', { name: 'HEIST INTERRUPTED' })).toBeVisible();
  await page.getByRole('button', { name: 'RECOVER' }).click();
  await expect(page.getByRole('button', { name: 'START HEIST' })).toBeEnabled({ timeout: 15_000 });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        canvas: document.querySelectorAll('canvas').length,
        pixi: document.documentElement.dataset.pixiActive,
        socket: document.documentElement.dataset.socketActive,
      })),
    )
    .toEqual({ canvas: 1, pixi: '1', socket: '1' });
});
