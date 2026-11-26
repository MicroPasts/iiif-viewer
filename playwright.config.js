import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  use: {
    baseURL: 'http://127.0.0.1:46781',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 46781 --strictPort',
    url: 'http://127.0.0.1:46781/',
    reuseExistingServer: false,
  },
});
