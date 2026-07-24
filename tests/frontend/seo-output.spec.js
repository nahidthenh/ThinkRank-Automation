/**
 * Phase 1 — FRONTEND output (F2/F3/F6/F7).
 *
 * Verifies ThinkRank's public-facing SEO output: head meta on the homepage and
 * on a seeded post, valid JSON-LD schema, and a reachable/valid sitemap.
 * Self-seeds the post and removes it afterward. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free Frontend — homepage SEO head', () => {
  test('emits robots, canonical, OpenGraph and Twitter meta', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
  });

  test('emits at least one valid JSON-LD schema block', async ({ page }) => {
    await page.goto('/');
    const blocks = page.locator('script[type="application/ld+json"]');
    expect(await blocks.count()).toBeGreaterThan(0);
    // Every JSON-LD block must be parseable JSON.
    for (const raw of await blocks.allTextContents()) {
      expect(() => JSON.parse(raw), 'JSON-LD block is not valid JSON').not.toThrow();
    }
  });
});

test.describe('@free Frontend — post SEO head', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;
  let link;

  test.beforeAll(async () => {
    api = await createApiContext();
    const resp = await api.post('/wp-json/wp/v2/posts', {
      data: { title: 'TR Frontend fixture', content: 'Body for frontend SEO checks.', status: 'publish' },
    });
    const body = await resp.json();
    postId = body.id;
    link = body.link;
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api.dispose();
  });

  test('single post exposes title, canonical and og:title', async ({ page }) => {
    await page.goto(link);
    await expect(page).toHaveTitle(/.+/);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  });
});

test.describe('@free Frontend — sitemap', () => {
  test('sitemap index is reachable and valid XML', async ({ request }) => {
    const resp = await request.get('/sitemap_index.xml');
    expect(resp.ok()).toBeTruthy();
    const xml = await resp.text();
    expect(xml).toMatch(/<\?xml/);
    expect(xml).toMatch(/<(sitemapindex|urlset)/);
  });
});
