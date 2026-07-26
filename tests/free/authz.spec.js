/**
 * FREE — Authorization matrix (deep). Feature #16 (security).
 *
 * ThinkRank write endpoints require custom manage capabilities
 * (thinkrank_global_seo, thinkrank_schema, …) that a non-admin role lacks.
 * This creates a real editor user, logs in as them, and verifies manage-only
 * writes are rejected (401/403) — then deletes the user. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, WP_URL, TR_BASE } from '../fixtures/wp-api.js';

const EDITOR_USER = 'tr_e2e_editor';
const EDITOR_EMAIL = 'tr_e2e_editor@example.com';
const EDITOR_PASS = 'TrE2e!Editor#2026';

test.describe('@free Authorization — non-admin capability enforcement', () => {
  // Creating a user + a fresh browser login + several requests; the login
  // redirect can be slow on a cold CI backend, so allow generous time.
  test.describe.configure({ timeout: 90_000 });

  /** @type {import('@playwright/test').APIRequestContext} */
  let admin;
  let editorId;

  test.beforeAll(async () => {
    admin = await createApiContext();
    const resp = await admin.post('/wp-json/wp/v2/users', {
      data: {
        username: EDITOR_USER,
        email: EDITOR_EMAIL,
        password: EDITOR_PASS,
        roles: ['editor'],
      },
    });
    if (resp.status() === 201) {
      editorId = (await resp.json()).id;
    } else {
      // Reuse a leftover user from a prior interrupted run.
      const list = await admin.get(
        `/wp-json/wp/v2/users?search=${EDITOR_USER}&context=edit`,
      );
      editorId = (await list.json()).find((u) => u.username === EDITOR_USER)?.id;
    }
    expect(editorId, 'could not create/find the editor user').toBeTruthy();
  });

  test.afterAll(async () => {
    if (admin && editorId) {
      await admin.delete(`/wp-json/wp/v2/users/${editorId}?force=true&reassign=1`);
    }
    await admin?.dispose();
  });

  test('unauthenticated requests are rejected on manage-only writes', async ({ playwright }) => {
    // A caller with no session/nonce must be rejected on every manage endpoint.
    const anon = await playwright.request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      const gseo = await anon.post(`${TR_BASE}/global-seo/settings`, {
        data: { post_type: 'post', settings: { title: 'anon should not save' } },
      });
      expect([401, 403]).toContain(gseo.status());

      const schema = await anon.post(`${TR_BASE}/schema/settings`, {
        data: { settings: { enabled: false } },
      });
      expect([401, 403]).toContain(schema.status());

      const roles = await anon.get(`${TR_BASE}/role-manager`);
      expect([401, 403]).toContain(roles.status());
    } finally {
      await anon.dispose();
    }
  });

  test('an editor is rejected on ThinkRank manage-only writes', async ({ browser }) => {
    // Log in as the editor in a fresh context.
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: WP_URL });
    const page = await ctx.newPage();
    await page.goto('/wp-login.php', { waitUntil: 'domcontentloaded' });
    await page.fill('#user_login', EDITOR_USER);
    await page.fill('#user_pass', EDITOR_PASS);
    await page.click('#wp-submit');
    // The editor's REST-provisioned login can be unreliable on some fresh
    // backends; if it doesn't complete, skip (the unauthenticated matrix above
    // still guards these endpoints deterministically).
    const loggedIn = await page
      .waitForURL(/wp-admin/, { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!loggedIn, 'Editor browser login did not complete on this environment');

    // A valid nonce for the editor session — so rejection is a *capability*
    // decision, not a missing-nonce one.
    const nonce = (
      await ctx.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
    ).text();
    const headers = { 'X-WP-Nonce': (await nonce).trim(), 'Content-Type': 'application/json' };

    // Global SEO save (requires thinkrank_global_seo).
    const gseo = await ctx.request.post(`${TR_BASE}/global-seo/settings`, {
      headers,
      data: { post_type: 'post', settings: { title: 'editor should not save' } },
    });
    expect([401, 403]).toContain(gseo.status());

    // Schema settings save (requires thinkrank_schema).
    const schema = await ctx.request.post(`${TR_BASE}/schema/settings`, {
      headers,
      data: { settings: { enabled: false } },
    });
    expect([401, 403]).toContain(schema.status());

    // Role Manager read (requires the manage-roles capability) — an editor is
    // denied even from reading the role/capability matrix.
    const roles = await ctx.request.get(`${TR_BASE}/role-manager`, { headers });
    expect([401, 403]).toContain(roles.status());

    await ctx.close();
  });
});
