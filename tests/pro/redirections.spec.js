/**
 * Phase 4 — PRO Redirections (CRUD + a real 301).
 *
 * Creates a redirect via the Pro REST API, confirms it is listed, verifies the
 * front end actually issues a 301 to the target, toggles it off (redirect stops),
 * then deletes it. Self-skips when Pro is inactive, and sweeps any leftover
 * /tr-e2e-* redirects so the target site is left clean. @pro
 *
 * POST /thinkrank-pro/v1/redirections ← { source_url, target_url, match_type, http_code, status }
 *   → 201 { success, data: { id, ... } }
 * GET  /thinkrank-pro/v1/redirections → { success, data: { items: [...] } }
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, proPost, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

const SOURCE = `/tr-e2e-redirect-${Date.now()}`;
const TARGET = 'https://thinkrank.test/?tr-e2e-target=1';

test.describe('@pro Redirections', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let redirectId;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    if (!api) return;
    // Sweep every redirect this suite may have created (incl. failed runs).
    const { body } = await proGet(api, '/redirections');
    const items = body?.data?.items || [];
    for (const it of items) {
      if (typeof it.source_url === 'string' && it.source_url.includes('tr-e2e')) {
        await api.delete(`${PRO_BASE}/redirections/${it.id}`);
      }
    }
    await api.dispose();
  });

  test('create → listed → 301 on front → toggle off → delete', async ({ request }) => {
    // 1. Create.
    const create = await proPost(api, '/redirections', {
      source_url: SOURCE,
      target_url: TARGET,
      match_type: 'exact',
      http_code: 301,
      status: 'active',
    });
    expect(create.status).toBe(201);
    redirectId = create.body?.data?.id;
    expect(redirectId, 'create did not return an id').toBeTruthy();

    // 2. Appears in the list.
    const list = await proGet(api, '/redirections');
    const sources = (list.body?.data?.items || []).map((i) => i.source_url);
    expect(sources).toContain(SOURCE);

    // 3. Front end issues a real 301 to the target.
    const hit = await request.get(SOURCE, { maxRedirects: 0 });
    expect(hit.status()).toBe(301);
    expect(hit.headers()['location']).toBe(TARGET);

    // 4. Toggle off → the redirect stops firing.
    const toggle = await proPost(api, `/redirections/${redirectId}/toggle`);
    expect(toggle.status).toBe(200);
    const afterToggle = await request.get(SOURCE, { maxRedirects: 0 });
    expect(afterToggle.status()).not.toBe(301);

    // 5. Delete → gone from the list.
    const del = await api.delete(`${PRO_BASE}/redirections/${redirectId}`);
    expect(del.ok()).toBeTruthy();
    redirectId = undefined;

    const after = await proGet(api, '/redirections');
    const stillThere = (after.body?.data?.items || []).map((i) => i.source_url);
    expect(stillThere).not.toContain(SOURCE);
  });

  test('R: 404-logs returns an items list', async () => {
    const { status, body } = await proGet(api, '/redirections/404-logs');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data?.items)).toBeTruthy();
  });

  test('E: invalid match_type → 400', async () => {
    const { status, body } = await proPost(api, '/redirections', {
      source_url: '/tr-e2e-bad',
      target_url: '/x',
      match_type: 'not_a_real_type',
    });
    expect(status).toBe(400);
    expect(body?.code).toBe('invalid_match');
  });

  test('regex redirect: a matching URL 301s to the target', async ({ request }) => {
    const pattern = '^/tr-e2e-rx-.*$';
    const target = 'https://thinkrank.test/?tr-e2e-rx=1';
    let id;
    try {
      const create = await proPost(api, '/redirections', {
        source_url: pattern,
        target_url: target,
        match_type: 'regex',
        http_code: 301,
        status: 'active',
      });
      expect(create.status).toBe(201);
      id = create.body?.data?.id;

      // Any URL matching the pattern should 301 to the target.
      const hit = await request.get('/tr-e2e-rx-anything-here', { maxRedirects: 0 });
      expect(hit.status()).toBe(301);
      expect(hit.headers()['location']).toBe(target);
    } finally {
      if (id) await api.delete(`${PRO_BASE}/redirections/${id}`);
    }
  });
});
