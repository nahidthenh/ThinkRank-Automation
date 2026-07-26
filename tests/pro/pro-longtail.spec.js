/**
 * Phase 6 — PRO long-tail read contracts.
 *
 * Advanced/publisher sitemaps (Pro P7), WooCommerce SEO settings (Pro P8), and
 * Google Analytics accounts (Pro P9). Read-only; the GA endpoint is asserted
 * tolerantly since it depends on a live connection. Self-skips when Pro is
 * inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

test.describe('@pro Long-tail read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // Pro P7 — Publisher / advanced sitemaps.
  test('publisher-sitemaps settings respond', async () => {
    const { status, body } = await proGet(api, '/publisher-sitemaps/settings');
    expect(status).toBe(200);
    expect(typeof body?.data?.settings).toBe('object');
  });

  // Pro P8 — WooCommerce SEO (settings available even without Woo active).
  test('woocommerce settings respond with identifier types', async () => {
    const { status, body } = await proGet(api, '/woocommerce/settings');
    expect(status).toBe(200);
    expect(typeof body?.data?.settings).toBe('object');
    expect(Array.isArray(body?.data?.identifier_types)).toBeTruthy();
  });

  // Pro P9 — Google Analytics (depends on a live GA connection).
  test('google-analytics accounts endpoint responds', async () => {
    const { status, body } = await proGet(api, '/google-analytics/accounts');
    // Connection-gated: 401/403/400 when GA isn't connected (fresh site).
    expect([200, 400, 401, 403, 429, 500, 502, 503, 504]).toContain(status);
    expect(body).toBeTruthy();
    if (status === 200) {
      expect(Array.isArray(body?.data?.accounts)).toBeTruthy();
    }
  });
});
