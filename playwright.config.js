// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load target site + admin credentials from .env (never committed).
// Reads .env from the project root (the dir you run Playwright from).
dotenv.config({ quiet: true });

// The site under test. Nothing is hardcoded — point this at any WordPress
// site that has ThinkRank Free + Pro active by editing WP_URL in .env.
const WP_URL = process.env.WP_URL || 'https://thinkrank.test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry locally too — the dashboard's async data calls can occasionally
  // lose a race against a busy local backend.
  retries: process.env.CI ? 2 : 1,
  // A single local WordPress site (Herd/PHP-FPM) has limited request
  // concurrency; too many workers saturate it and stall in-app API calls.
  // Override with `--workers=N` or WP_WORKERS when running against a beefier host.
  workers: process.env.WP_WORKERS ? Number(process.env.WP_WORKERS) : process.env.CI ? 2 : 3,
  reporter: 'html',

  use: {
    baseURL: WP_URL,
    // Herd (and most local WP) serve .test over HTTPS with a self-signed cert.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Logs in once and verifies ThinkRank Free + Pro are active.
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },

    // 2. All real tests — reuse the saved admin session from setup.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
});
