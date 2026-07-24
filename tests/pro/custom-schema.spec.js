/**
 * PRO — Custom Schema (deep). Feature #8.
 *
 *   R  entries list, targets
 *   W  create entry (valid JSON) → listed → delete
 *   E  an entry with invalid JSON is flagged valid_json=false
 *
 * Self-skips when Pro is inactive; sweeps any leftover tr_e2e_ entries. @pro
 *
 * GET    /custom-schema/entries   → { success, data: [ {id, title, json, valid_json} ] }
 * POST   /custom-schema/entries   ← { id, title, enabled, json, conditions }
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

test.describe('@pro Custom Schema', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    if (!api) return;
    const { body } = await proGet(api, '/custom-schema/entries');
    for (const e of body?.data || []) {
      if (typeof e.id === 'string' && e.id.startsWith('tr_e2e_')) {
        await api.delete(`${PRO_BASE}/custom-schema/entries/${e.id}`);
      }
    }
    await api.dispose();
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
    const id = `tr_e2e_cs_${Date.now()}`;
    const create = await proPost(api, '/custom-schema/entries', {
      id,
      title: 'TR E2E Custom Schema',
      enabled: true,
      json: VALID_JSON,
      conditions: [],
    });
    expect(create.status).toBe(200);
    expect(create.body?.data?.valid_json).toBe(true);

    const list = await proGet(api, '/custom-schema/entries');
    expect((list.body?.data || []).map((e) => e.id)).toContain(id);

    const del = await api.delete(`${PRO_BASE}/custom-schema/entries/${id}`);
    expect(del.ok()).toBeTruthy();

    const after = await proGet(api, '/custom-schema/entries');
    expect((after.body?.data || []).map((e) => e.id)).not.toContain(id);
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: an entry with invalid JSON is flagged valid_json=false', async () => {
    const id = `tr_e2e_cs_bad_${Date.now()}`;
    try {
      const create = await proPost(api, '/custom-schema/entries', {
        id,
        title: 'TR E2E Bad JSON',
        enabled: true,
        json: '{ this is not valid json',
        conditions: [],
      });
      expect(create.status).toBe(200);
      expect(create.body?.data?.valid_json).toBe(false);
    } finally {
      await api.delete(`${PRO_BASE}/custom-schema/entries/${id}`);
    }
  });
});
