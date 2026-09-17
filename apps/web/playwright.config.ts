import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    hasTouch: true,
    // Keep DOM/action diagnostics without capturing the WebGL canvas on every action.
    // Continuous trace screenshots contend with software rendering on CI runners.
    trace: { mode: 'retain-on-failure', screenshots: false },
  },
  webServer: [
    {
      command: 'npm run dev:server',
      cwd: '../..',
      url: process.env.E2E_API_URL ?? 'http://localhost:3000/health',
      ...(process.env.E2E_API_URL
        ? {
            env: {
              PORT: new URL(process.env.E2E_API_URL).port,
              CORS_ORIGIN: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
            },
          }
        : {}),
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: process.env.E2E_WEB_URL
        ? `npm run dev --workspace=@caesars-loot/web -- --port ${new URL(process.env.E2E_WEB_URL).port}`
        : 'npm run dev:web',
      cwd: '../..',
      url: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
      ...(process.env.E2E_API_URL
        ? {
            env: {
              VITE_API_URL: new URL(process.env.E2E_API_URL).origin,
              VITE_WS_URL: `${new URL(process.env.E2E_API_URL).origin}/game`,
            },
          }
        : {}),
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
