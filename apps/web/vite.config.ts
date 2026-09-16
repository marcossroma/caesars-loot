import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (process.env.VERCEL === '1') {
    for (const key of ['VITE_API_URL', 'VITE_WS_URL']) {
      const value = env[key];
      if (!value || !['https:', 'wss:'].includes(new URL(value).protocol)) {
        throw new Error(`${key} must be configured with a secure production URL.`);
      }
    }
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
    test: {
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
    build: { sourcemap: false },
  };
});
