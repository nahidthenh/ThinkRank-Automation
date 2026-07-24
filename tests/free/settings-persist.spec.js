/**
 * Phase 2b — FREE settings save & persist (F2, Global SEO).
 *
 * Proves a real write round-trips: read current settings → save a modified
 * value → confirm it persisted → restore the original. The original is captured
 * up front and restored in afterAll no matter what, so the target site is left
 * exactly as it was found. @free
 *
 * GET  /global-seo/settings?post_type=post  → { success, data: {settings}, ... }
 * POST /global-seo/settings                 ← { post_type, settings: {...} }
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Settings persist — Global SEO', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {object} */
  let original;

  const SENTINEL = 'TR-E2E-PERSIST-CHECK';

  test.beforeAll(async () => {
    api = await createApiContext();
    const { status, body } = await trGet(api, '/global-seo/settings?post_type=post');
    expect(status).toBe(200);
    original = body.data;
  });

  test.afterAll(async () => {
    // Safety net: always restore the original settings.
    if (api && original) {
      await trPost(api, '/global-seo/settings', { post_type: 'post', settings: original });
    }
    await api?.dispose();
  });

  test('saving a title format persists, then restores to the original', async () => {
    expect(original, 'could not read original settings').toBeTruthy();
    expect(original.title).not.toBe(SENTINEL);

    // 1. Save a modified title.
    const save = await trPost(api, '/global-seo/settings', {
      post_type: 'post',
      settings: { ...original, title: SENTINEL },
    });
    expect(save.status).toBe(200);

    // 2. Read back — the change persisted.
    const after = await trGet(api, '/global-seo/settings?post_type=post');
    expect(after.body.data.title).toBe(SENTINEL);

    // 3. Restore the original — and confirm the restore also persisted.
    const restore = await trPost(api, '/global-seo/settings', {
      post_type: 'post',
      settings: original,
    });
    expect(restore.status).toBe(200);

    const restored = await trGet(api, '/global-seo/settings?post_type=post');
    expect(restored.body.data.title).toBe(original.title);
  });
});
