/**
 * FREE — AI Insights (AI traffic / auto-AI) read contracts.
 *
 * The controller registers exactly two routes: `/ai-insights/traffic` and
 * `/ai-insights/auto-ai`. Both reads are derived from stored analytics and are
 * safe on any site.
 *
 * Brand visibility used to live under `/ai-insights/brand*` and was removed in
 * plugin 1.30.0 (#301) — the v2 rebuild moved it to `/brand-visibility/*`,
 * which `tests/free/brand-visibility.spec.js` covers, including its own 404
 * error contract. Nothing here should reference the v1 brand paths. @free
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

  // ── A ────────────────────────────────────────────────────────────────────
  test('A: unauthenticated reads are rejected', async () => {
    const anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      for (const path of ['/ai-insights/traffic', '/ai-insights/auto-ai']) {
        const resp = await anon.get(`${TR_BASE}${path}`);
        expect([401, 403], `${path} should reject anonymous callers`).toContain(resp.status());
      }
    } finally {
      await anon.dispose();
    }
  });
});
