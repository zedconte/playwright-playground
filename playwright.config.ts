import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { otherSitesFlows } from './framework/config';
import { site } from './framework/site';

// Flows must live in tests/flows/<site>/; files directly in tests/flows/ match no site and would never run.
const strayFlows = fs.readdirSync('tests/flows').filter(f => /\.(spec|test)\.[cm]?[jt]sx?$/.test(f));
if (strayFlows.length) {
  console.warn(`Ignored tests/flows/${strayFlows.join(', ')}: move hand-written flows into tests/flows/<site>/.`);
}

export default defineConfig({
  testDir: './tests',
  // Generated suites run for every site; hand-written flows only from tests/flows/<active site>/.
  testIgnore: otherSitesFlows(site.name),
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
