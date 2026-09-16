import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env['CAESARS_LOOT_DEV_URL'] ?? 'http://localhost:5173';
const directory = resolve('docs/images/performance');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'START HEIST' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('.start-heist');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.getByText('DEV', { exact: true }).click();
  await page.waitForTimeout(5_000);
  const path = resolve(directory, 'dev-performance-overlay-1366x768.png');
  await page.screenshot({ path });
  console.log(path);
} finally {
  await browser.close();
}
