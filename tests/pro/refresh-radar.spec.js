/**
 * PRO — Refresh Radar (stale-content detection) contracts.
 *
 * Previously untested area (3 routes, none covered). `scan` is a read that
 * degrades to a "not connected" envelope without Search Console, so it is safe
 * anywhere. `brief` and `apply` are asserted at the guard level only — `apply`
 * rewrites post content, so it is never called with a real payload here.
 * Self-skips when Pro is inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

test.describe('@pro Refresh Radar', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── R ────────────────────────────────────────────────────────────────────
  test('R: scan responds and degrades cleanly without a Google connection', async () => {
    const { status, body } = await proGet(api, '/refresh-radar/scan');
    expect(status).toBe(200);
    expect(body).toHaveProperty('success');

    if (body?.not_connected) {
      // The disconnected path must explain itself rather than return an empty 200.
      expect(body?.message, 'a not_connected scan should carry a message').toBeTruthy();
    } else if (body?.success) {
      expect(body).toHaveProperty('data');
    }
  });

  // ── E ────────────────────────────────────────────────────────────────────
  test('E: brief without a post → 400', async () => {
    const resp = await api.post(`${PRO_BASE}/refresh-radar/brief`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  test('E: apply without a payload → 400 (no content is rewritten)', async () => {
    const resp = await api.post(`${PRO_BASE}/refresh-radar/apply`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });
});
