/**
 * FREE — AI Insights (AI traffic / brand / auto-AI) read + error contracts.
 *
 * Previously untested area (5 routes, none covered). All three reads are
 * derived from stored analytics and are safe on any site. `brand/run` triggers
 * live LLM queries (billable), so it is not exercised. @free
 */

import { test, expect, request } from '@playwright/test';
import { createApiContext, trGet, WP_URL, TR_BASE } from '../fixtures/wp-api.js';

test.describe('@free AI Insights', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── R ────────────────────────────────────────────────────────────────────
  test('R: brand returns queries, history and plan limits', async () => {
    const { status, body } = await trGet(api, '/ai-insights/brand');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const d = body?.data ?? {};
    expect(Array.isArray(d.queries), 'queries should be a list').toBeTruthy();
    expect(Array.isArray(d.history), 'history should be a list').toBeTruthy();
    expect(typeof d.max_queries, 'max_queries should be numeric').toBe('number');
    expect(d).toHaveProperty('is_pro');
    // `host` should describe the site under test, not a hardcoded domain.
    if (d.host) expect(WP_URL).toContain(String(d.host));
  });

  test('R: traffic returns an AI-referral breakdown', async () => {
    const { status, body } = await trGet(api, '/ai-insights/traffic');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const d = body?.data ?? {};
    for (const key of ['days', 'baseline', 'ai_sessions', 'ai_share', 'platforms', 'trend', 'top_pages', 'crawlers']) {
      expect(d, `traffic payload is missing "${key}"`).toHaveProperty(key);
    }
    // A share is a proportion/percentage — never negative.
    if (typeof d.ai_share === 'number') expect(d.ai_share).toBeGreaterThanOrEqual(0);
  });

  test('R: auto-ai reports its enablement state and eligible post types', async () => {
    const { status, body } = await trGet(api, '/ai-insights/auto-ai');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const d = body?.data ?? {};
    expect(typeof d.enabled, 'enabled should be a boolean').toBe('boolean');
    expect(Array.isArray(d.post_types), 'post_types should be a list').toBeTruthy();
    expect(d).toHaveProperty('available');
  });

  // ── E ────────────────────────────────────────────────────────────────────
  test('E: deleting a history entry that does not exist → 404', async () => {
    const resp = await api.delete(`${TR_BASE}/ai-insights/brand/history/99999999`);
    expect(resp.status()).toBe(404);
  });

  // ── A ────────────────────────────────────────────────────────────────────
  test('A: unauthenticated reads are rejected', async () => {
    const anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      for (const path of ['/ai-insights/brand', '/ai-insights/traffic', '/ai-insights/auto-ai']) {
        const resp = await anon.get(`${TR_BASE}${path}`);
        expect([401, 403], `${path} should reject anonymous callers`).toContain(resp.status());
      }
    } finally {
      await anon.dispose();
    }
  });
});
