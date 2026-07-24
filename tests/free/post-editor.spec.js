/**
 * Phase 2 — FREE post-editor integration (F10).
 *
 * ThinkRank adds a classic "ThinkRank SEO" metabox to the post editor with a
 * focus-keyword field, SEO title, and meta description. In the block editor the
 * metabox is injected via WordPress's async meta-box loader (~10-15s), so this
 * test waits for that and asserts on the real fields it renders.
 *
 * Tagged @editor: the block editor is heavy and its async metabox loader starves
 * under parallel load, so this runs in its own single-worker lane
 * (`npm run test:editor`); the default `npm test` excludes it. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe.configure({ timeout: 120_000 });

test.describe('@free @editor Post editor — ThinkRank SEO metabox', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: 'TR Editor fixture', status: 'draft' });
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api.dispose();
  });

  test('metabox loads with focus keyword, SEO title and meta description fields', async ({ page }) => {
    await page.goto(`/wp-admin/post.php?post=${postId}&action=edit`, {
      waitUntil: 'domcontentloaded',
    });

    // Block editor shell ready, then dismiss the welcome guide.
    await expect(page.locator('#editor')).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press('Escape').catch(() => {});

    expect(await page.content()).not.toContain('Fatal error');

    // WordPress injects the classic metabox asynchronously — wait for it.
    await expect(page.locator('#thinkrank-seo-metabox')).toBeAttached({ timeout: 60_000 });
    await expect(page.locator('#thinkrank-metabox-container')).toBeAttached({ timeout: 60_000 });

    // The metabox app rendered its real fields (F10's focus-keyword feature).
    await expect(page.locator('#thinkrank_focus_keyword_input')).toBeAttached({ timeout: 30_000 });
    await expect(page.locator('#thinkrank_seo_title')).toBeAttached();
    await expect(page.locator('#thinkrank_meta_description')).toBeAttached();
  });
});
