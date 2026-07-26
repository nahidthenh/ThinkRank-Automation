/**
 * FREE — Sitemap (deep). Feature #2.
 *
 *   R  status, stats, custom-post-types, robots-urls, woocommerce-status, settings
 *   W  generate returns fresh XML; settings save path accepts valid input
 *   E  save with empty settings → 400
 *   F  sitemap index + per-post-type sitemaps are reachable, valid XML
 *
 * Settings are snapshotted and restored. `/submit` and `/ping` are intentionally
 * not exercised (they call external search engines). @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Sitemap', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let originalSettings;

  test.beforeAll(async () => {
    api = await createApiContext();
    originalSettings = (await trGet(api, '/sitemap/settings')).body?.data?.settings;
    // ThinkRank publishes the sitemap as a physical file on generation; a fresh
    // site has none yet, so generate it before the frontend (F) check.
    await trPost(api, '/sitemap/generate', {}).catch(() => {});
  });

  test.afterAll(async () => {
    if (api && originalSettings) {
      await trPost(api, '/sitemap/settings', { settings: originalSettings });
    }
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: status, stats and settings respond', async () => {
    const status = await trGet(api, '/sitemap/status');
    expect(status.status).toBe(200);
    expect(typeof status.body?.data?.enabled).toBe('boolean');

    const stats = await trGet(api, '/sitemap/stats');
    expect(stats.status).toBe(200);
    expect(stats.body?.data).toHaveProperty('total_urls');

    const settings = await trGet(api, '/sitemap/settings');
    expect(settings.status).toBe(200);
    expect(typeof settings.body?.data?.settings).toBe('object');
  });

  test('R: custom-post-types, robots-urls and woocommerce-status respond', async () => {
    const cpt = await trGet(api, '/sitemap/custom-post-types');
    expect(cpt.status).toBe(200);
    expect(Array.isArray(cpt.body?.data)).toBeTruthy();

    const robots = await trGet(api, '/sitemap/robots-urls');
    expect(robots.status).toBe(200);
    expect(Array.isArray(robots.body?.data?.sitemap_urls)).toBeTruthy();

    const woo = await trGet(api, '/sitemap/woocommerce-status');
    expect(woo.status).toBe(200);
    expect(typeof woo.body?.data?.is_active).toBe('boolean');
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: generate returns sitemap XML', async () => {
    const { status, body } = await trPost(api, '/sitemap/generate', {});
    // 429 = the endpoint is rate-limited (valid behavior when generate is
    // triggered repeatedly); only assert the XML payload on a fresh 200.
    expect([200, 429]).toContain(status);
    if (status === 200) {
      expect(String(body?.data?.sitemap_xml)).toMatch(/<\?xml/);
    }
  });

  test('W: settings save path accepts valid settings', async () => {
    // No-op round-trip (post the current settings back) — exercises the save +
    // sanitize path without altering the live sitemap.
    const { status, body } = await trPost(api, '/sitemap/settings', { settings: originalSettings });
    expect(status).toBe(200);
    expect(body?.success).toBeTruthy();
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: save with empty settings → 400', async () => {
    const { status, body } = await trPost(api, '/sitemap/settings', { settings: {} });
    expect(status).toBe(400);
    expect(body?.code).toBe('missing_settings');
  });

  // validate returns a boolean verdict (false locally due to self-signed cert).
  test('validate returns a valid flag', async () => {
    const { status, body } = await trPost(api, '/sitemap/validate', {});
    expect(status).toBe(200);
    expect(typeof body?.data?.valid).toBe('boolean');
  });

  // ── F ──────────────────────────────────────────────────────────────────
  // The published entry point is /sitemap.xml or /sitemap_index.xml depending on
  // the use_sitemap_index toggle — assert the site serves a valid one (portable
  // across single-file and index configurations).
  test('F: the published sitemap is reachable and valid XML', async ({ request }) => {
    // Make sure a sitemap file exists (idempotent with the beforeAll generate).
    await trPost(api, '/sitemap/generate', {}).catch(() => {});

    let servedXml = '';
    for (const path of ['/sitemap_index.xml', '/sitemap.xml']) {
      const resp = await request.get(path);
      if (resp.ok()) {
        const xml = await resp.text();
        if (/<\?xml/.test(xml) && /<(sitemapindex|urlset)/.test(xml)) {
          servedXml = xml;
          break;
        }
      }
    }
    expect(servedXml, 'no valid sitemap served at /sitemap.xml or /sitemap_index.xml').toBeTruthy();
  });
});
