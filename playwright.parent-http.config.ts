import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

// HTTP adapter browser regression checks with intercepted backend responses.
export default defineConfig({
  ...baseConfig,
  testDir: './tests/parent',
  use: { ...baseConfig.use, baseURL: 'http://127.0.0.1:5185', timezoneId: 'Asia/Seoul' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5185 --strictPort',
    url: 'http://127.0.0.1:5185',
    env: { VITE_API_BASE_URL: '/api', VITE_AUTH_API: 'mock', VITE_MESSAGE_API: 'http', VITE_ESCALATION_API: 'http' },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
