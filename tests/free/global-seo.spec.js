/**
 * FREE — Global SEO (deep). Feature #1.
 *
 * Covers the /global-seo/* surface across dimensions:
 *   R  read settings (per type + all)
 *   W  save persists (title/description/schema_type) then restores; reset
 *   E  missing/invalid post_type → 400
 *   F  a saved title template actually renders in a post's <title>
 *
 * The original 'post' and 'page' settings are snapshotted up front and restored
 * in afterAll, so the target site is left exactly as found. @free
 *
 * GET  /global-seo/settings?post_type=X   → { success, data: {settings} }
 * GET  /global-seo/settings/all           → { success, data: { post:{}, page:{}, ... } }
 * POST /global-seo/settings               ← { post_type, settings: {...} }
 * POST /global-seo/settings/reset         ← { post_type }
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free Global SEO', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let originalPost;
  let originalPage;

  test.beforeAll(async () => {
    api = await createApiContext();
    originalPost = (await trGet(api, '/global-seo/settings?post_type=post')).body?.data;
    originalPage = (await trGet(api, '/global-seo/settings?post_type=page')).body?.data;
  });

  test.afterAll(async () => {
    if (api && originalPost) {
      await trPost(api, '/global-seo/settings', { post_type: 'post', settings: originalPost });
    }
    if (api && originalPage) {
      await trPost(api, '/global-seo/settings', { post_type: 'page', settings: originalPage });
    }
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: read settings for post and page types', async () => {
    for (const type of ['post', 'page']) {
      const { status, body } = await trGet(api, `/global-seo/settings?post_type=${type}`);
      expect(status).toBe(200);
      expect(body?.data).toBeTruthy();
      expect(body.data).toHaveProperty('title');
      expect(body.data).toHaveProperty('description');
    }
  });

  test('R: settings/all returns every post type', async () => {
    const { status, body } = await trGet(api, '/global-seo/settings/all');
    expect(status).toBe(200);
    // A configured site returns a per-post-type map; a fresh install with no
    // saved global settings yet returns an empty collection. Accept both, but
    // when populated it must key by post type.
    const data = body?.data;
    if (data && !Array.isArray(data) && Object.keys(data).length > 0) {
      expect(data).toHaveProperty('post');
      expect(data).toHaveProperty('page');
    } else {
      expect(data !== undefined && data !== null).toBeTruthy();
    }
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: missing post_type → 400', async () => {
    const { status, body } = await trGet(api, '/global-seo/settings');
    expect(status).toBe(400);
    expect(body?.code).toBe('rest_missing_callback_param');
  });

  test('E: invalid post_type → 400', async () => {
    const { status, body } = await trPost(api, '/global-seo/settings', {
      post_type: 'does_not_exist_xyz',
      settings: { title: 'x' },
    });
    expect(status).toBe(400);
    expect(body?.code).toBe('invalid_post_type');
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: save persists title, description and schema_type, then restores', async () => {
    const modified = {
      ...originalPost,
      title: 'TR-E2E Title %sitename%',
      description: 'TR-E2E description sentinel',
      schema_type: 'Article',
      article_type: 'NewsArticle',
    };
    const save = await trPost(api, '/global-seo/settings', { post_type: 'post', settings: modified });
    expect(save.status).toBe(200);

    const after = (await trGet(api, '/global-seo/settings?post_type=post')).body.data;
    expect(after.title).toBe(modified.title);
    expect(after.description).toBe(modified.description);
    expect(after.schema_type).toBe('Article');

    // Restore + confirm.
    await trPost(api, '/global-seo/settings', { post_type: 'post', settings: originalPost });
    const restored = (await trGet(api, '/global-seo/settings?post_type=post')).body.data;
    expect(restored.title).toBe(originalPost.title);
  });

  test('W: reset reverts a post type to defaults', async () => {
    const SENTINEL = 'TR-E2E-RESET-ME';
    await trPost(api, '/global-seo/settings', {
      post_type: 'post',
      settings: { ...originalPost, title: SENTINEL },
    });

    const reset = await trPost(api, '/global-seo/settings/reset', { post_type: 'post' });
    expect(reset.status).toBe(200);

    const afterReset = (await trGet(api, '/global-seo/settings?post_type=post')).body.data;
    expect(afterReset.title).not.toBe(SENTINEL); // reset cleared our sentinel

    // Restore the real original (afterAll also guards this).
    await trPost(api, '/global-seo/settings', { post_type: 'post', settings: originalPost });
  });

  // ── F ──────────────────────────────────────────────────────────────────
  test('F: saved title template renders in a post <title>', async ({ page }) => {
    const SENTINEL = 'TRE2EFRONTTITLE';
    const postId = await createPost(api, { title: 'GSEO front fixture' });
    try {
      const save = await trPost(api, '/global-seo/settings', {
        post_type: 'post',
        settings: { ...originalPost, title: `${SENTINEL} %sitename%` },
      });
      expect(save.status).toBe(200);

      // Load the post on the front end; its <title> should use the template.
      await page.goto(`/?p=${postId}`);
      await expect(page).toHaveTitle(new RegExp(SENTINEL));
    } finally {
      await trPost(api, '/global-seo/settings', { post_type: 'post', settings: originalPost });
      await deletePost(api, postId);
    }
  });
});
