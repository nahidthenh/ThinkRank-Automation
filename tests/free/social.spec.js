/**
 * FREE — Social (deep). Feature #4.
 *
 *   R  social-media settings, social-platforms settings, per-post OG tags
 *   W  social-media settings save path
 *   E  empty settings / generate-og without data / preview without data → 400
 *   F  a published post exposes og:title, og:type and twitter:card
 *
 * Seeds a post and snapshots settings; both restored afterward. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

const TITLE = 'Social OG Fixture';

test.describe('@free Social', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;
  let originalSettings;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: TITLE });
    originalSettings = (await trGet(api, '/social-media/settings')).body?.data?.settings;
  });

  test.afterAll(async () => {
    if (api && originalSettings) {
      await trPost(api, '/social-media/settings', { settings: originalSettings });
    }
    await deletePost(api, postId);
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: social-media and social-platforms settings respond', async () => {
    const sm = await trGet(api, '/social-media/settings');
    expect(sm.status).toBe(200);
    expect(sm.body?.data?.settings).toHaveProperty('enable_open_graph');

    const sp = await trGet(api, '/social-platforms/settings');
    expect(sp.status).toBe(200);
    expect(typeof sp.body?.data?.settings).toBe('object');
  });

  test('R: per-post OG tags reflect the post', async () => {
    const { status, body } = await trGet(api, `/social-media/post/${postId}`);
    expect(status).toBe(200);
    const og = body?.data?.og_tags;
    expect(og?.['og:title']).toBe(TITLE);
    expect(og).toHaveProperty('og:url');
  });

  // ── E ──────────────────────────────────────────────────────────────────
  test('E: empty settings → 400', async () => {
    const { status } = await trPost(api, '/social-media/settings', {});
    expect(status).toBe(400);
  });

  test('E: generate-og without data → 400', async () => {
    const { status } = await trPost(api, '/social-media/generate-og', {});
    expect(status).toBe(400);
  });

  test('E: preview without data → 400', async () => {
    const { status } = await trPost(api, '/social-media/preview', {});
    expect(status).toBe(400);
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: social-media settings save path accepts valid settings', async () => {
    const { status, body } = await trPost(api, '/social-media/settings', {
      settings: originalSettings,
    });
    expect(status).toBe(200);
    expect(body?.success).toBeTruthy();
  });

  // ── F ──────────────────────────────────────────────────────────────────
  test('F: a published post exposes OG and Twitter tags', async ({ page }) => {
    await page.goto(`/?p=${postId}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle?.length).toBeGreaterThan(0);
  });
});
