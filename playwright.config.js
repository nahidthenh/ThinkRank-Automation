// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load target site + admin credentials from .env (never committed).
// Reads .env from the project root (the dir you run Playwright from).
dotenv.config({ quiet: true });

// The site under test. Nothing is hardcoded — point this at any WordPress
// site that has ThinkRank Free + Pro active by editing WP_URL in .env.
const WP_URL = process.env.WP_URL || 'https://thinkrank.test';

// Slack reporter — posts a run summary to the configured channel(s).
// Enabled whenever SLACK_BOT_TOKEN is set (local runs included). Leave the token
// blank in .env to disable, or set SLACK_REPORT=0 to skip a specific run.
const slackEnabled =
  Boolean(process.env.SLACK_BOT_TOKEN) && process.env.SLACK_REPORT !== '0';

const slackReporter = [
  './node_modules/playwright-slack-report/dist/src/SlackReporter.js',
  {
    slackOAuthToken: process.env.SLACK_BOT_TOKEN,
    channels: [process.env.SLACK_CHANNEL_ID].filter(Boolean),
    sendResults: 'always',
    maxNumberOfFailuresToShow: 0,
    meta: [
      {
        key: ':thinkrank: ThinkRank Automation — Test Results',
        value: process.env.PAGES_URL
          ? `🖥️ <${process.env.PAGES_URL}|View Results!>`
          : 'Local run',
      },
      // Which plugin build was tested (set by the CI workflow for branch runs).
      ...(process.env.TEST_BUILD_LABEL
        ? [{ key: 'Build under test', value: process.env.TEST_BUILD_LABEL }]
        : []),
    ],
  },
];

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
  // concurrency; the React-heavy admin screens each fire several API calls on
  // mount, so >2 workers saturate the backend and stall those calls. 2 workers
  // runs the whole suite clean with no retries. Override with `--workers=N` or
  // WP_WORKERS when running against a beefier host.
  workers: process.env.WP_WORKERS ? Number(process.env.WP_WORKERS) : 2,
  reporter: [
    process.env.CI ? ['github'] : ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(slackEnabled ? [slackReporter] : []),
  ],

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
