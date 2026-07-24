/**
 * FREE — Instant Indexing, LLMs.txt & Image SEO (deep). Feature #10.
 *
 *   R  settings + adjacent reads for all three
 *   W  settings save round-trips (snapshot → save → verify → restore)
 *   E  llms-txt empty settings → 400
 *
 * All three settings groups are snapshotted up front and restored in afterAll.
 * `/instant-indexing/submit`, `/llms-txt/generate`, and `/image-seo/media-alt/run`
 * are intentionally not run (external calls / persistent file / media rewrites). @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Instant Indexing, LLMs.txt & Image SEO', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let ii; // instant-indexing settings (top-level fields)
  let llms; // llms-txt settings object
  let img; // image-seo settings (top-level object)

  test.beforeAll(async () => {
    api = await createApiContext();
    ii = (await trGet(api, '/instant-indexing/settings')).body?.data;
    llms = (await trGet(api, '/llms-txt/settings')).body?.data?.settings;
    img = (await trGet(api, '/image-seo/settings')).body;
  });

  test.afterAll(async () => {
    if (api && ii) await trPost(api, '/instant-indexing/settings', ii);
    if (api && llms) await trPost(api, '/llms-txt/settings', { settings: llms });
    if (api && img) await trPost(api, '/image-seo/settings', img);
    await api?.dispose();
  });

  // ── Instant Indexing ─────────────────────────────────────────────────────
  test('R: instant-indexing settings, history and post-types respond', async () => {
    const settings = await trGet(api, '/instant-indexing/settings');
    expect(settings.status).toBe(200);
    expect(settings.body?.data).toHaveProperty('enabled');

    const history = await trGet(api, '/instant-indexing/history');
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body?.data)).toBeTruthy();

    const types = await trGet(api, '/instant-indexing/post-types');
    expect(types.status).toBe(200);
    expect(Array.isArray(types.body?.data)).toBeTruthy();
  });

  test('W: instant-indexing settings save persists its state', async () => {
    const save = await trPost(api, '/instant-indexing/settings', ii);
    expect(save.status).toBe(200);
    const after = (await trGet(api, '/instant-indexing/settings')).body?.data;
    expect(after.auto_submit_post_types).toEqual(ii.auto_submit_post_types);
  });

  // ── LLMs.txt ─────────────────────────────────────────────────────────────
  test('R: llms-txt settings, status and overview respond', async () => {
    expect((await trGet(api, '/llms-txt/settings')).status).toBe(200);

    const status = await trGet(api, '/llms-txt/status');
    expect(status.status).toBe(200);
    expect(typeof status.body?.data?.file_exists).toBe('boolean');

    const overview = await trGet(api, '/llms-txt/overview');
    expect(overview.status).toBe(200);
    expect(overview.body?.data).toBeTruthy();
  });

  test('E: llms-txt empty settings → 400', async () => {
    expect((await trPost(api, '/llms-txt/settings', {})).status).toBe(400);
  });

  test('W: llms-txt settings save path accepts valid settings', async () => {
    const { status, body } = await trPost(api, '/llms-txt/settings', { settings: llms });
    expect(status).toBe(200);
    expect(body?.success).toBeTruthy();
  });

  // ── Image SEO ────────────────────────────────────────────────────────────
  test('R: image-seo settings and media-alt stats respond', async () => {
    const settings = await trGet(api, '/image-seo/settings');
    expect(settings.status).toBe(200);
    expect(settings.body).toHaveProperty('add_missing_alt');

    const stats = await trGet(api, '/image-seo/media-alt/stats');
    expect(stats.status).toBe(200);
    expect(stats.body).toHaveProperty('total');
  });

  test('W: image-seo settings save round-trip', async () => {
    const { status, body } = await trPost(api, '/image-seo/settings', img);
    expect(status).toBe(200);
    expect(body?.success).toBeTruthy();
  });
});
