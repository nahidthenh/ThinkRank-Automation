/**
 * Basic feature test — ThinkRank Dashboard admin page.
 *
 * Opens the plugin's main admin page and verifies it loads cleanly and that
 * the React app mounts. Uses the admin session saved by auth.setup.js.
 */

import { test, expect } from '@playwright/test';

test.describe('ThinkRank Dashboard', () => {
  test('dashboard page opens without fatal errors', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=thinkrank');

    const html = await page.content();
    expect(html).not.toContain('Fatal error');
    expect(html).not.toContain('There has been a critical error');

    // WordPress admin heading should be present
    await expect(page.locator('#wpwrap')).toBeVisible();
  });

  test('React app mounts into the dashboard container', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=thinkrank');

    const app = page.locator('#thinkrank-dashboard.thinkrank-admin-page');
    await expect(app).toBeAttached();

    // The app should render something into its mount node (not stay empty)
    await expect
      .poll(async () => (await app.innerHTML()).trim().length, { timeout: 10_000 })
      .toBeGreaterThan(0);
  });
});
