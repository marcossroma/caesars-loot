import { chromium } from '@playwright/test';

const baseURL = process.env['CAESARS_LOOT_PERF_URL'] ?? 'http://localhost:4173';
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const start = page.getByRole('button', { name: 'START HEIST' });
  const cashout = page.getByRole('button', { name: 'ESCAPE WITH LOOT' });
  const canvas = page.locator('canvas.pixi-canvas');
  const positions = [207, 281, 355, 429, 503].flatMap((y) =>
    [46, 120, 194, 268, 342].map((x) => ({ x, y })),
  );
  const result = { safeAttempts: 0, safeReveals: 0, cashout: false, trap: false };

  const waitReady = async () => {
    await page.waitForFunction(() => {
      const button = document.querySelector('.start-heist');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
  };
  const reveal = async (position) => {
    const before = Number(
      await page.locator('.hud-stats > div').nth(3).locator('strong').innerText(),
    );
    await canvas.click({ position });
    await page.waitForFunction((previous) => {
      const value = Number(
        document.querySelector('.hud-stats > div:nth-child(4) strong')?.textContent,
      );
      return value > previous || Boolean(document.querySelector('.result-overlay'));
    }, before);
    return {
      safeReveals: Number(
        await page.locator('.hud-stats > div').nth(3).locator('strong').innerText(),
      ),
      hasResult: await page.locator('.result-overlay').isVisible(),
    };
  };

  await page.goto(baseURL);
  await waitReady();

  while (!result.cashout && result.safeAttempts < 20) {
    result.safeAttempts += 1;
    await start.click();
    await page.getByText('PLAYING', { exact: true }).waitFor({ state: 'visible' });
    for (const position of positions) {
      const outcome = await reveal(position);
      result.safeReveals = outcome.safeReveals;
      if (outcome.hasResult) {
        await page.locator('.result-overlay button').click();
        await waitReady();
        break;
      }
      if (outcome.safeReveals >= 3) {
        await cashout.click();
        await page.getByRole('heading', { name: 'LOOT SECURED!' }).waitFor({ state: 'visible' });
        result.cashout = true;
        await page.locator('.result-overlay button').click();
        await waitReady();
        break;
      }
    }
  }

  if (!result.cashout) throw new Error('Unable to complete three safe reveals and cashout.');

  await start.click();
  await page.getByText('PLAYING', { exact: true }).waitFor({ state: 'visible' });
  for (const position of positions) {
    const outcome = await reveal(position);
    if (!outcome.hasResult) continue;
    result.trap = await page.getByRole('heading', { name: 'CAUGHT!' }).isVisible();
    await page.locator('.result-overlay button').click();
    await waitReady();
    break;
  }
  if (!result.trap) throw new Error('Unable to complete the trap flow.');

  console.log(
    JSON.stringify(
      {
        ...result,
        finalState: await page.locator('.hud-state').innerText(),
        canvasCount: await canvas.count(),
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
}
