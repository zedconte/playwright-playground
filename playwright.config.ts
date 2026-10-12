import { defineConfig, devices } from '@playwright/test';
import { site } from './framework/site';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Public practice site: keep the load modest.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['./framework/reporter/coverage-reporter.ts']],
  use: {
    baseURL: site.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(site.userAgent && { userAgent: site.userAgent }) },
    },
  ],
});
