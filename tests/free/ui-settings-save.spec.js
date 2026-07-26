/**
 * FREE — Admin UI settings save (U dimension).
 *
 * The first true UI *interaction* flow: drive the React admin like a user —
 * open Essential SEO, edit the Site Identity name field, click "Save Settings",
 * and verify the value actually persisted server-side (read back via the API).
 * Then restore the original settings.
 *
 * Runs in the isolated single-worker lane (@editor) on purpose: it mutates the
 * site-identity settings, and the parallel fast lane has other specs that
 * snapshot/restore that same object — the isolated lane guarantees no cross-file
 * contention. Self-restoring via an afterAll safety net. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe.configure({ timeout: 120_000 });

test.describe('@free @editor Admin UI — Essential SEO settings save', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {object|undefined} full site-identity settings snapshot (restore artifact) */
  let originalSettings;

  test.beforeAll(async () => {
    api = await createApiContext();
    originalSettings = (await trGet(api, '/site-identity/settings')).body?.data?.settings;
    expect(originalSettings, 'could not snapshot site-identity settings').toBeTruthy();
  });

  test.afterAll(async () => {
    // Safety net — always put the original settings back.
    if (api && originalSettings) {
      await trPost(api, '/site-identity/settings', { settings: originalSettings }).catch(() => {});
    }
    await api?.dispose();
  });

  test('editing the site name in the UI and saving persists it (verified via API)', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=thinkrank-essential-seo', {
      waitUntil: 'domcontentloaded',
    });

    // The Site Identity → Basic Info panel is the default view.
    const nameField = page.locator('#tr-si-name');
    await expect(nameField).toBeVisible({ timeout: 45_000 });

    const probe = 'E2E UI Save Probe';
    await nameField.fill(probe);

    // Click Save and wait for the settings write to complete.
    const saved = page.waitForResponse(
      (r) =>
        r.url().includes('/thinkrank/v1/site-identity/settings') &&
        r.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await page.getByRole('button', { name: /save settings/i }).first().click();
    const resp = await saved;
    expect(resp.status()).toBe(200);

    // Verify the typed value actually persisted server-side.
    await expect
      .poll(
        async () =>
          (await trGet(api, '/site-identity/settings')).body?.data?.settings?.site_name,
        { timeout: 15_000, message: 'site name did not persist after UI save' }
      )
      .toBe(probe);
  });
});
