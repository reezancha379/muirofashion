import { defineConfig } from '@playwright/test';
import { verifyStaticOutput } from './scripts/verify-static.mjs';

const liveUrl = process.env.STATIC_TEST_URL;
if (!liveUrl) verifyStaticOutput('site');

export default defineConfig({
  testDir: './tests',
  testMatch: 'static-e2e.test.ts',
  use: {
    baseURL: liveUrl || 'http://127.0.0.1:8889',
    browserName: 'chromium',
  },
  webServer: liveUrl ? undefined : {
    command: 'python3 -m http.server 8889 --bind 127.0.0.1 --directory site',
    url: 'http://127.0.0.1:8889',
    reuseExistingServer: false,
  },
});
