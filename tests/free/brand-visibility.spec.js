/**
 * FREE — Brand Visibility (AI brand tracking) read + error contracts.
 *
 * Previously untested area (5 routes, none covered). Reads are safe anywhere.
 * `generate-queries` and `run` call external LLM providers (billable, slow), so
 * they are deliberately NOT exercised — only the config/history reads, the
 * not-found path and the auth gate. @free
 */

import { test, expect, request } from '@playwright/test';
import { createApiContext, trGet, WP_URL, TR_BASE } from '../fixtures/wp-api.js';

test.describe('@free Brand Visibility', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── R ────────────────────────────────────────────────────────────────────
  test('R: config returns the brand tracking configuration', async () => {
    const { status, body } = await trGet(api, '/brand-visibility/config');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const d = body?.data ?? {};
    // Documented config surface — present even when never configured.
    for (const key of ['brand', 'variants', 'location', 'category', 'competitors', 'queries', 'platforms']) {
      expect(d, `config is missing "${key}"`).toHaveProperty(key);
    }
    expect(Array.isArray(d.platforms), 'platforms should be a list').toBeTruthy();
  });

  test('R: runs returns a run-history envelope', async () => {
    const { status, body } = await trGet(api, '/brand-visibility/runs');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(Array.isArray(body?.data?.runs), 'data.runs should be a list').toBeTruthy();
    // `limited` tells the UI whether the free plan truncated the history.
    expect(body?.data).toHaveProperty('limited');
  });

  // ── E ────────────────────────────────────────────────────────────────────
  test('E: a run id that does not exist → 404', async () => {
    const { status, body } = await trGet(api, '/brand-visibility/run/99999999');
    expect(status).toBe(404);
    expect(body?.success).toBe(false);
  });

  // ── A ────────────────────────────────────────────────────────────────────
  test('A: unauthenticated reads are rejected', async () => {
    const anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      for (const path of ['/brand-visibility/config', '/brand-visibility/runs']) {
        const resp = await anon.get(`${TR_BASE}${path}`);
        expect([401, 403], `${path} should reject anonymous callers`).toContain(resp.status());
      }
    } finally {
      await anon.dispose();
    }
  });
});
