/**
 * Smoke test — verifies the suite connects to the target site and that the
 * admin session from auth.setup.js works. Not a feature test; just proves wiring.
 */

import { test, expect } from '@playwright/test';

test('homepage loads without fatal errors', async ({ page }) => {
  const resp = await page.goto('/');
  expect(resp?.ok()).toBeTruthy();
  const html = await page.content();
  expect(html).not.toContain('Fatal error');
  expect(html).not.toContain('WordPress database error');
});

test('admin is logged in and the ThinkRank menu is present', async ({ page }) => {
  await page.goto('/wp-admin/');
  await expect(page).toHaveURL(/wp-admin/);
  const thinkrankMenu = page
    .locator('#toplevel_page_thinkrank, a[href*="page=thinkrank"]')
    .first();
  await expect(thinkrankMenu).toBeVisible({ timeout: 10_000 });
});
