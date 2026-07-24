/**
 * Phase 5 — PRO Local SEO / Locations (CRUD).
 *
 * Creates a location via the Pro REST API, confirms it is listed, then deletes
 * it — leaving the site clean. Self-skips when Pro is inactive, and sweeps any
 * leftover "TR E2E" locations. @pro
 *
 * GET    /locations            → { success, data: { items: [...] } }
 * POST   /locations            ← { name, ... }  → created location with id
 * DELETE /locations/{id}
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, proPost, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

const NAME = `TR E2E Location ${Date.now()}`;

test.describe('@pro Local SEO — Locations', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let locationId;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    if (!api) return;
    const { body } = await proGet(api, '/locations');
    for (const it of body?.data?.items || []) {
      if (typeof it.name === 'string' && it.name.startsWith('TR E2E Location')) {
        await api.delete(`${PRO_BASE}/locations/${it.id}`);
      }
    }
    await api.dispose();
  });

  test('create → listed → delete', async () => {
    // List starts as a known shape.
    const before = await proGet(api, '/locations');
    expect(before.status).toBe(200);
    expect(Array.isArray(before.body?.data?.items)).toBeTruthy();

    // Create.
    const create = await proPost(api, '/locations', {
      name: NAME,
      address: '123 Test St',
    });
    expect([200, 201]).toContain(create.status);
    locationId = create.body?.data?.id ?? create.body?.id;
    expect(locationId, 'create did not return an id').toBeTruthy();

    // Listed.
    const list = await proGet(api, '/locations');
    const names = (list.body?.data?.items || []).map((i) => i.name);
    expect(names).toContain(NAME);

    // Delete → gone.
    const del = await api.delete(`${PRO_BASE}/locations/${locationId}`);
    expect(del.ok()).toBeTruthy();
    locationId = undefined;

    const after = await proGet(api, '/locations');
    const stillThere = (after.body?.data?.items || []).map((i) => i.name);
    expect(stillThere).not.toContain(NAME);
  });
});
