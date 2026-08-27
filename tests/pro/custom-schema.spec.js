/**
 * PRO — Custom Schema (deep). Feature #8.
 *
 *   R  entries list, targets
 *   W  create entry (valid JSON) → listed → delete
 *   E  an entry with invalid JSON is flagged valid_json=false
 *   E  posting an unknown id is a 404, not a silent duplicate create
 *
 * Self-skips when Pro is inactive. Each test deletes its own entry; leftovers
 * from a crashed run are swept once by tests/global-teardown.js. @pro
 *
 * GET    /custom-schema/entries   → { success, data: [ {id, title, json, valid_json} ] }
 * POST   /custom-schema/entries   ← { [id], title, enabled, json, conditions }
 *                                   Omit `id` to create — the server mints
 *                                   `cs_<hash>`. A non-blank id that resolves
 *                                   to nothing is a 404 (thinkrank-pro #114),
 *                                   so a client-chosen id cannot create.
 * DELETE /custom-schema/entries/{id}
 * GET    /custom-schema/targets   → { success, data: { post_types: [...] } }
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, proPost, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

const VALID_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'TR-E2E-CS',
});

/** Ids are server-assigned, so leftovers are identified by their title. */
const TITLE_PREFIX = 'TR E2E CS';
const NO_CONDITIONS = { include: [], exclude: [] };

test.describe('@pro Custom Schema', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: entries and targets respond', async () => {
    const entries = await proGet(api, '/custom-schema/entries');
    expect(entries.status).toBe(200);
    expect(Array.isArray(entries.body?.data)).toBeTruthy();

    const targets = await proGet(api, '/custom-schema/targets');
    expect(targets.status).toBe(200);
    expect(Array.isArray(targets.body?.data?.post_types)).toBeTruthy();
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: create entry with valid JSON → listed → delete', async () => {
    const title = `${TITLE_PREFIX} valid ${Date.now()}`;
    const create = await proPost(api, '/custom-schema/entries', {
      title,
      enabled: true,
      json: VALID_JSON,
      conditions: NO_CONDITIONS,
    });
    expect(create.status).toBe(200);
    expect(create.body?.data?.valid_json).toBe(true);

    const id = create.body?.data?.id;
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const list = await proGet(api, '/custom-schema/entries');
    expect((list.body?.data || []).map((e) => e.id)).toContain(id);

    const del = await api.delete(`${PRO_BASE}/custom-schema/entries/${id}`);
    expect(del.ok()).toBeTruthy();

    const after = await proGet(api, '/custom-schema/entries');
    expect((after.body?.data || []).map((e) => e.id)).not.toContain(id);
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: an entry with invalid JSON is flagged valid_json=false', async () => {
    let id;
    try {
      const create = await proPost(api, '/custom-schema/entries', {
        title: `${TITLE_PREFIX} bad json ${Date.now()}`,
        enabled: true,
        json: '{ this is not valid json',
        conditions: NO_CONDITIONS,
      });
      expect(create.status).toBe(200);
      expect(create.body?.data?.valid_json).toBe(false);
      id = create.body?.data?.id;
    } finally {
      if (id) await api.delete(`${PRO_BASE}/custom-schema/entries/${id}`);
    }
  });

  test('E: posting an unknown id is rejected, not forked into a duplicate', async () => {
    const ghost = `tr_e2e_missing_${Date.now()}`;

    const create = await proPost(api, '/custom-schema/entries', {
      id: ghost,
      title: `${TITLE_PREFIX} ghost`,
      enabled: true,
      json: VALID_JSON,
      conditions: NO_CONDITIONS,
    });
    expect(create.status).toBe(404);
    expect(create.body?.code).toBe('thinkrank_pro_not_found');

    // Assert on the id, not the list length — the suite runs fully parallel,
    // so a sibling test's create/delete would race a count snapshot.
    const after = await proGet(api, '/custom-schema/entries');
    expect((after.body?.data || []).map((e) => e.id)).not.toContain(ghost);
  });
});
