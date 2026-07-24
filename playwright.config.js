// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load target site + admin credentials from .env (never committed)
dotenv.config({ path: path.resolve(__dirname, '.env') });

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
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
