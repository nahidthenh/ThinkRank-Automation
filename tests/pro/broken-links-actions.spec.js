/**
 * PRO — Broken Links per-item actions.
 *
 * Previously 2 of 8 routes covered — every item action was untested because
 * they mutate real link records on the site. Each action is exercised against
 * a link id that cannot exist, which proves the route is registered, the
 * permission gate passes for an admin, and a missing record is reported as
 * 404 rather than a silent 200. No stored link is ever touched.
 *
 * `/broken-links/scan` is deliberately not run — it crawls every link on the
 * site (slow, and it hits third-party URLs). See ROADMAP §8 "Deferred". @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

// An id far past any real row; these all resolve the record before acting.
const GHOST_ID = 999999;
const NOT_FOUND_ACTIONS = ['dismiss', 'recheck', 'restore', 'unlink'];

test.describe('@pro Broken Links — item actions', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  for (const action of NOT_FOUND_ACTIONS) {
    test(`E: ${action} on a non-existent link → 404`, async () => {
      const resp = await api.post(`${PRO_BASE}/broken-links/${GHOST_ID}/${action}`, { data: {} });
      expect(resp.status()).toBe(404);
      expect((await resp.json())?.code).toBe('not_found');
    });
  }

  // `edit` needs a replacement URL, so its arg guard fires before the lookup —
  // a different (and correct) rejection than the four above.
  test('E: edit without a replacement URL → 400', async () => {
    const resp = await api.post(`${PRO_BASE}/broken-links/${GHOST_ID}/edit`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  // The list read is what the actions operate on — assert the id field the
  // action routes consume actually exists on listed items.
  test('R: listed items expose the id the action routes take', async () => {
    const resp = await api.get(`${PRO_BASE}/broken-links`);
    expect(resp.status()).toBe(200);

    const items = (await resp.json())?.data?.items ?? [];
    expect(Array.isArray(items)).toBeTruthy();
    if (items.length) expect(items[0], 'a listed broken link needs an id').toHaveProperty('id');
  });
});
