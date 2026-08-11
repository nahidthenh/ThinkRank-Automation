/**
 * FREE — AI content-tool request guards.
 *
 * ai/* was 5 of 10 routes covered; the four uncovered ones are all AI
 * generation calls. We assert their *guard* behaviour only — a request missing
 * its required params must be rejected BEFORE any provider call is made, so no
 * API key is needed and no tokens are spent. That also pins the contract that
 * these endpoints never silently no-op on a malformed request. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, TR_BASE } from '../fixtures/wp-api.js';

// Route → the params it requires. Sending `{}` must produce a 400 naming them.
const GUARDED = [
  { path: '/ai/improve-title', requires: ['content'] },
  { path: '/ai/improve-meta-description', requires: ['content'] },
  { path: '/ai/explain-suggestion', requires: ['content', 'suggestion'] },
  { path: '/ai/add-dofollow-link', requires: ['content'] },
];

test.describe('@free AI tools — request guards', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const { path, requires } of GUARDED) {
    test(`E: ${path} without ${requires.join(' + ')} → 400 (no provider call)`, async () => {
      const resp = await api.post(`${TR_BASE}${path}`, { data: {} });
      expect(resp.status()).toBe(400);

      const body = await resp.json();
      expect(body?.code).toBe('rest_missing_callback_param');

      // The rejection must name every missing parameter, not fail opaquely.
      const reported = JSON.stringify(body?.data?.params ?? body?.message ?? '');
      for (const param of requires) {
        expect(reported, `the 400 should name the missing "${param}" param`).toContain(param);
      }
    });
  }
});
