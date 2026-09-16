import { chromium } from '@playwright/test';

const baseURL = process.env['CAESARS_LOOT_PERF_URL'] ?? 'http://localhost:4173';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-precise-memory-info'],
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const samples = [];
  const sample = async (rounds) => {
    await cdp.send('HeapProfiler.collectGarbage');
    const value = await page.evaluate(() => ({
      heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
      heapTotalBytes: performance.memory?.totalJSHeapSize ?? null,
      canvasCount: document.querySelectorAll('canvas.pixi-canvas').length,
    }));
    samples.push({ rounds, ...value });
  };

  await page.goto(baseURL);
  const start = page.getByRole('button', { name: 'START HEIST' });
  const cashout = page.getByRole('button', { name: 'ESCAPE WITH LOOT' });
  await start.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('.start-heist');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await sample(0);

  for (let round = 1; round <= 50; round += 1) {
    await start.click();
    await page.getByText('PLAYING', { exact: true }).waitFor({ state: 'visible' });
    await page.locator('canvas.pixi-canvas').click({ position: { x: 195, y: 350 } });
    await page.waitForFunction(() => {
      const cashoutButton = document.querySelector('.cash-out');
      return (
        (cashoutButton instanceof HTMLButtonElement && !cashoutButton.disabled) ||
        Boolean(document.querySelector('.result-overlay'))
      );
    });
    if (await cashout.isEnabled()) await cashout.click();
    await page.locator('.result-overlay').waitFor({ state: 'visible' });
    await page.locator('.result-overlay button').click();
    await page.waitForFunction(() => {
      const button = document.querySelector('.start-heist');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    if ([10, 25, 50].includes(round)) await sample(round);
  }

  console.log(JSON.stringify({ baseURL, measuredAt: new Date().toISOString(), samples }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
