/**
 * PRO — License endpoint guards.
 *
 * Previously 1 of 6 routes covered. The five uncovered routes all mutate a
 * REAL licence against the WPDeveloper licensing server — activating,
 * deactivating or deleting a licence on the target site would consume an
 * activation slot or de-license the user's install. So this spec asserts ONLY
 * the parameter guards: each write must reject an empty request BEFORE any
 * outbound call to the licensing API.
 *
 * A licence happy-path needs a disposable site and a throwaway key; it stays
 * out of the suite on purpose. See ROADMAP §8 "Deferred". @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

const GUARDED_WRITES = ['/license/activate', '/license/submit-otp'];

test.describe('@pro License — request guards', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const path of GUARDED_WRITES) {
    test(`E: ${path} without a licence key → 400 (no call to the licensing server)`, async () => {
      const resp = await api.post(`${PRO_BASE}${path}`, { data: {} });
      expect(resp.status()).toBe(400);
      expect((await resp.json())?.code).toBe('rest_missing_callback_param');
    });
  }

  // Every licence route must be POST-only — a licence must not be mutable by a
  // GET (which is CSRF-able from a link and cacheable by proxies).
  test('A: licence routes are not exposed over GET', async () => {
    const resp = await api.get(`${PRO_BASE}/license/activate`);
    expect([404, 405]).toContain(resp.status());
  });
});
