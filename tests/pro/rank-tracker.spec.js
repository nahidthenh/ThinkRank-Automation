/**
 * PRO — Rank Tracker (deep). Feature #9a.
 *
 *   W  add a keyword → listed (with hash) → delete → gone
 *   R  keywords, suggestions, history (Search-Console-backed → tolerant)
 *
 * Self-skips when Pro is inactive; sweeps any leftover tr-e2e keywords. @pro
 *
 * POST   /rank-tracker/keywords         ← { keywords: [...] }  → { success, added, total }
 * GET    /rank-tracker/keywords         → { success, data: [ {keyword, hash, ...} ] }
 * DELETE /rank-tracker/keywords/{hash}
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, proPost, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

const OK = [200, 429, 500, 502, 503, 504];

test.describe('@pro Rank Tracker', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    if (!api) return;
    const { body } = await proGet(api, '/rank-tracker/keywords');
    for (const k of body?.data || []) {
      if (typeof k.keyword === 'string' && k.keyword.startsWith('tr-e2e-kw-')) {
        await api.delete(`${PRO_BASE}/rank-tracker/keywords/${k.hash}`);
      }
    }
    await api.dispose();
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: add a keyword → listed → delete', async () => {
    const kw = `tr-e2e-kw-${Date.now()}`;
    const add = await proPost(api, '/rank-tracker/keywords', { keywords: [kw] });
    expect(add.status).toBe(200);
    expect(add.body?.success).toBeTruthy();

    // The keyword may take a beat to surface in the list (async enrichment).
    const findMine = async () =>
      ((await proGet(api, '/rank-tracker/keywords')).body?.data || []).find(
        (k) => k.keyword === kw,
      );
    await expect.poll(async () => Boolean(await findMine()), { timeout: 10_000 }).toBeTruthy();

    const mine = await findMine();
    expect(mine.hash).toBeTruthy();

    const del = await api.delete(`${PRO_BASE}/rank-tracker/keywords/${mine.hash}`);
    expect(del.ok()).toBeTruthy();

    await expect
      .poll(async () => Boolean(await findMine()), { timeout: 10_000 })
      .toBeFalsy();
  });

  // ── R (Search-Console-backed → tolerant) ─────────────────────────────────
  test('R: keywords and suggestions respond', async () => {
    const kw = await proGet(api, '/rank-tracker/keywords');
    expect(kw.status).toBe(200);
    expect(Array.isArray(kw.body?.data)).toBeTruthy();

    const sug = await proGet(api, '/rank-tracker/suggestions');
    expect(OK).toContain(sug.status);
  });

  // history requires a keyword param — without one it correctly 400s.
  test('E: history without a keyword param → 400', async () => {
    const hist = await proGet(api, '/rank-tracker/history');
    expect(hist.status).toBe(400);
  });
});
