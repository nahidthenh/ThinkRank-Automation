/**
 * Phase 4 — PRO activation, license & menu (Pro P0).
 *
 * Confirms ThinkRank Pro is wired in: the license REST endpoint responds, the
 * License admin screen loads and mounts, and the Pro "License" menu item is
 * present. Read-only — makes no changes. Self-skips when Pro is inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proPost } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

test.describe('@pro Activation, license & menu', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('license REST endpoint responds', async () => {
    // get-license is registered as CREATABLE (POST).
    const { status, body } = await proPost(api, '/license/get-license');
    expect(status).toBe(200);
    expect(body).toBeTruthy();
  });

  test('License admin screen loads and mounts', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=thinkrank-license');
    expect(await page.content()).not.toContain('Fatal error');

    const root = page.locator('#thinkrank-pro-license-root');
    await expect(root).toBeAttached({ timeout: 30_000 });
    await expect(root.locator(':scope > *').first()).toBeVisible({ timeout: 30_000 });
  });

  test('Pro "License" menu item is present', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=thinkrank');
    await expect(page.locator('a[href*="page=thinkrank-license"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
