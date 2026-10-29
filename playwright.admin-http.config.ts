import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// Isolated HTTP adapter UI checks. All escalation requests are intercepted by the tests.
export default defineConfig({
  ...baseConfig,
  testDir: './tests/admin',
  use: { ...baseConfig.use, baseURL: 'http://127.0.0.1:5182', timezoneId: 'UTC' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182',
    env: {
      VITE_API_BASE_URL: '/api',
      VITE_AUTH_API: 'mock',
      VITE_MESSAGE_API: 'mock',
      VITE_ESCALATION_API: 'http',
    },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
