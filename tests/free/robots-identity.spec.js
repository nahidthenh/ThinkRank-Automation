/**
 * FREE — Robots Meta & Site Identity (deep). Feature #5.
 *
 *   R  site-identity settings / robots content / title templates / breadcrumb
 *      types; global-robot-meta settings
 *   W  both settings save paths
 *   E  empty settings → 400 (both)
 *   F  homepage robots meta directives; Organization/Person JSON-LD
 *
 * Also documents a known bug: the plugin generates robots.txt content but
 * /robots.txt is served with HTTP 404 (see FINDINGS.md #2) — encoded as a
 * test.fail() so the suite stays green and flips red once it's fixed. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Robots Meta & Site Identity', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let originalIdentity;
  let originalRobotMeta;

  test.beforeAll(async () => {
    api = await createApiContext();
    originalIdentity = (await trGet(api, '/site-identity/settings')).body?.data?.settings;
    originalRobotMeta = (await trGet(api, '/global-robot-meta/settings')).body?.settings;
  });

  test.afterAll(async () => {
    if (api && originalIdentity) {
      await trPost(api, '/site-identity/settings', { settings: originalIdentity });
    }
    if (api && originalRobotMeta) {
      await trPost(api, '/global-robot-meta/settings', { settings: originalRobotMeta });
    }
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: site-identity settings, robots content, templates, breadcrumb types', async () => {
    const settings = await trGet(api, '/site-identity/settings');
    expect(settings.status).toBe(200);
    expect(typeof settings.body?.data?.settings).toBe('object');

    const robots = await trGet(api, '/site-identity/robots');
    expect(robots.status).toBe(200);
    expect(String(robots.body?.data?.content)).toContain('User-agent:');

    const templates = await trGet(api, '/site-identity/title/templates');
    expect(templates.status).toBe(200);
    expect(templates.body?.data?.templates).toBeTruthy();

    const crumbs = await trGet(api, '/site-identity/breadcrumbs/types');
    expect(crumbs.status).toBe(200);
    expect(crumbs.body?.data?.breadcrumb_types).toBeTruthy();
  });

  test('R: global-robot-meta settings', async () => {
    const { status, body } = await trGet(api, '/global-robot-meta/settings');
    expect(status).toBe(200);
    expect(typeof body?.settings?.index).toBe('boolean');
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: empty settings → 400 (both)', async () => {
    expect((await trPost(api, '/site-identity/settings', {})).status).toBe(400);
    expect((await trPost(api, '/global-robot-meta/settings', {})).status).toBe(400);
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: settings save paths accept valid settings (both)', async () => {
    const si = await trPost(api, '/site-identity/settings', { settings: originalIdentity });
    expect(si.status).toBe(200);

    const rm = await trPost(api, '/global-robot-meta/settings', { settings: originalRobotMeta });
    expect(rm.status).toBe(200);
  });

  // ── F ──────────────────────────────────────────────────────────────────
  test('F: homepage emits robots meta and org/person JSON-LD', async ({ page }) => {
    await page.goto('/');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/index|follow|max-/);

    const html = await page.content();
    expect(html).toMatch(/"@type":\s*"(Organization|Person)"/);
  });

  // ── Known bug (documented) ───────────────────────────────────────────────
  test('F: /robots.txt should be served with HTTP 200', async ({ request }) => {
    test.fail(true, 'Known bug: physical robots.txt present but /robots.txt 404s. FINDINGS.md #2.');
    const resp = await request.get('/robots.txt');
    expect(resp.status()).toBe(200);
  });
});
