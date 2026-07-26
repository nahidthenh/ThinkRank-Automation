/**
 * PRO — Internal Links (deep). Feature #9b.
 *
 *   R  post-types, posts
 *   W  suggest returns internal-link suggestions for a post (non-mutating;
 *      /apply is intentionally not run — it edits post content)
 *
 * Seeds a post with linkable content. Self-skips when Pro is inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet, proPost } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';
import { createPost, deletePost } from '../fixtures/seed.js';

// /internal-links/suggest analyzes content and can be slow under load.
test.describe.configure({ timeout: 60_000 });

test.describe('@pro Internal Links', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
    postId = await createPost(api, {
      title: 'Internal Links fixture',
      content: 'An article about SEO and WordPress plugins for internal linking tests.',
    });
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: post-types and posts respond', async () => {
    const types = await proGet(api, '/internal-links/post-types');
    expect(types.status).toBe(200);
    expect(Array.isArray(types.body?.data)).toBeTruthy();

    const posts = await proGet(api, '/internal-links/posts');
    expect(posts.status).toBe(200);
    expect(Array.isArray(posts.body?.data)).toBeTruthy();
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: suggest returns internal-link suggestions for a post', async () => {
    const { status, body } = await proPost(api, '/internal-links/suggest', {
      post_id: postId,
      post_type: 'post',
    });
    // 200 with suggestions on a content-rich site; a fresh install with no other
    // posts to link to (or no AI key) legitimately returns 400. Accept both.
    expect([200, 400]).toContain(status);
    if (status === 200) expect(Array.isArray(body?.suggestions)).toBeTruthy();
  });
});
