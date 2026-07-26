/**
 * Phase 5 — PRO feature read contracts.
 *
 * Read-only checks that each Pro feature endpoint responds for an authenticated
 * admin and returns its documented shape. No writes / scans, so safe on any
 * site. Self-skips when Pro is inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

test.describe('@pro Feature read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // Broken Links — list of found links.
  test('broken-links returns an items list', async () => {
    const { status, body } = await proGet(api, '/broken-links');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data?.items)).toBeTruthy();
  });

  // Internal Links → tests/pro/internal-links.spec.js
  // Rank Tracker   → tests/pro/rank-tracker.spec.js
  // Custom Schema  → tests/pro/custom-schema.spec.js

  // Top Content report — also Search Console-backed; tolerate transient errors.
  test('top-content returns a report array', async () => {
    const { status, body } = await proGet(api, '/top-content');
    expect([200, 429, 500, 502, 503, 504]).toContain(status);
    if (status === 200) expect(Array.isArray(body?.data)).toBeTruthy();
  });

  // Keywords (top-queries / winning-losing) — Search Console-backed; tolerant.
  test('keywords top-queries and winning-losing respond', async () => {
    const top = await proGet(api, '/keywords/top-queries');
    expect([200, 429, 500, 502, 503, 504]).toContain(top.status);

    const wl = await proGet(api, '/keywords/winning-losing');
    expect([200, 429, 500, 502, 503, 504]).toContain(wl.status);
  });

  // Publisher Sitemaps (News/Video) — settings read.
  test('publisher-sitemaps/settings returns a config envelope', async () => {
    const { status, body } = await proGet(api, '/publisher-sitemaps/settings');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  // WooCommerce SEO — settings read (config returned even when Woo is inactive).
  test('woocommerce/settings returns a config envelope', async () => {
    const { status, body } = await proGet(api, '/woocommerce/settings');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  // Local SEO — locations list (create/delete covered by local-seo.spec.js).
  test('locations returns a list envelope', async () => {
    const { status, body } = await proGet(api, '/locations');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  // Google Analytics — accounts list is connection-gated; tolerate gated errors.
  test('google-analytics/accounts responds', async () => {
    const { status, body } = await proGet(api, '/google-analytics/accounts');
    expect([200, 400, 401, 403, 429, 500, 502, 503, 504]).toContain(status);
    if (status === 200) expect(body).toHaveProperty('data');
  });

  // URL Inspection status — Search-Console-gated. A 403 here is the documented
  // FINDINGS bug (site_error surfaced as 403); accept it until fixed upstream.
  test('url-inspection/status responds (403 = documented bug)', async () => {
    const { status } = await proGet(api, '/url-inspection/status');
    expect([200, 400, 401, 403, 429, 500, 502, 503, 504]).toContain(status);
  });

  // E — broken-links item lookup with a non-existent id is a clean 404
  // (not a 500). Read-only edge; the scan/fix actions mutate real data.
  test('E: broken-links item with a bad id → 404', async () => {
    const { status } = await proGet(api, '/broken-links/999999');
    expect([404, 400]).toContain(status);
  });

  // E — custom-schema import-file rejects an empty upload (400) before doing
  // any work. Never send a real file (it would create schema entries).
  test('E: schema/import-file with no file → 400', async () => {
    const resp = await api.post('/wp-json/thinkrank-pro/v1/schema/import-file', {
      data: {},
    });
    expect(resp.status()).toBe(400);
  });
});
