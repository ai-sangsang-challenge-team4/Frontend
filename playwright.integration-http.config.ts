import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  testDir: './tests/integration',
  use: { ...baseConfig.use, baseURL: 'http://127.0.0.1:5186', timezoneId: 'Asia/Seoul' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186',
    env: { VITE_API_BASE_URL: '/api', VITE_AUTH_API: 'http', VITE_MESSAGE_API: 'http', VITE_ESCALATION_API: 'http' },
    reuseExistingServer: false,
  },
});
