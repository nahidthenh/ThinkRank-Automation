// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.WP_URL || 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/fixtures/auth.setup.js',
    },
    {
      name: 'feature-tests',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'test-results/.auth/admin.json',
      },
      testMatch: ['**/feature/**/*.spec.js', '**/api/**/*.spec.js'],
    },
  ],
  outputDir: 'test-results/artifacts',
});
