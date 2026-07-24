/**
 * Phase 1 — Security (F24).
 *
 * ThinkRank REST endpoints must reject unauthenticated callers. Uses a fresh
 * context with NO stored session, so no cookies/nonce are sent. @free
 */

import { test, expect, request } from '@playwright/test';
import { WP_URL, TR_BASE } from '../fixtures/wp-api.js';

test.describe('@free Security — unauthenticated access is rejected', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let anon;

  test.beforeAll(async () => {
    anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    await anon.dispose();
  });

  const protectedGets = [
    '/global-seo/settings?post_type=post',
    '/global-robot-meta/settings',
    '/site-identity/settings',
    '/sitemap/settings',
    '/schema/settings',
  ];

  for (const path of protectedGets) {
    test(`GET ${path} → 401/403 without auth`, async () => {
      const resp = await anon.get(`${TR_BASE}${path}`);
      expect([401, 403]).toContain(resp.status());
    });
  }

  test('POST write endpoint → 401/403 without auth', async () => {
    const resp = await anon.post(`${TR_BASE}/global-seo/settings`, {
      data: { post_type: 'post', meta_title: 'unauthorized' },
    });
    expect([401, 403]).toContain(resp.status());
  });
});
