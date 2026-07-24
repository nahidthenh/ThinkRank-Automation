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

    // The app renders content into its mount node. Assert on a visible child
    // element (web-first, auto-retrying) with a generous timeout — the local
    // site can be slow while other workers exercise it in parallel.
    await expect(app.locator(':scope > *').first()).toBeVisible({ timeout: 30_000 });
  });
});
