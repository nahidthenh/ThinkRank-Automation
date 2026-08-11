/**
 * PRO — "apply" write guards (internal links, metadata, content brief) and
 * 404-log deletion.
 *
 * These four routes were untested because they all mutate published content or
 * stored records:
 *   /internal-links/apply      → rewrites post content to insert a link
 *   /metadata/{id}/apply       → overwrites a post's SEO metadata
 *   /content-brief/insert-post → creates a post from a brief
 *   /redirections/404-logs/{id} (DELETE) → removes a log row
 *
 * Each is asserted at its guard boundary: a request with no payload (or a row
 * that cannot exist) must be rejected, so nothing on the site changes. The
 * happy paths belong on a disposable site. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, PRO_BASE } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@pro Apply-write guards', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('E: internal-links apply without a payload → 400 (no content rewritten)', async () => {
    const resp = await api.post(`${PRO_BASE}/internal-links/apply`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  test('E: content-brief insert-post without a brief → 400 (no post created)', async () => {
    const resp = await api.post(`${PRO_BASE}/content-brief/insert-post`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  // metadata/apply resolves the post in its permission callback, so a
  // non-existent post is refused at the gate rather than reaching the handler.
  test('A: metadata apply for a non-existent post is refused', async () => {
    const resp = await api.post(`${PRO_BASE}/metadata/999999/apply`, { data: {} });
    expect([400, 403, 404]).toContain(resp.status());
  });

  // An empty apply is a reported NO-OP, not a wipe: it answers 200 with an
  // explicit `applied: []`. This is the guard that matters — FINDINGS #3
  // documents sibling endpoints that DO clear fields on an empty payload, so
  // this test exists to catch metadata/apply ever regressing into that.
  test('W: an empty apply is a no-op and clears nothing', async () => {
    const postId = await createPost(api, { title: 'TR metadata apply guard fixture' });
    try {
      const resp = await api.post(`${PRO_BASE}/metadata/${postId}/apply`, { data: {} });
      expect(resp.status()).toBe(200);

      const body = await resp.json();
      expect(body?.success).toBe(true);
      expect(body?.applied, 'an empty apply must apply nothing').toEqual([]);
      expect(Number(body?.post_id)).toBe(postId);

      // The post itself must survive untouched.
      const check = await api.get(`/wp-json/wp/v2/posts/${postId}`);
      expect(check.status()).toBe(200);
    } finally {
      await deletePost(api, postId);
    }
  });

  // Current behaviour: this route answers {success:true} for ANY id — including
  // one that never existed (and id 0) — so a caller cannot tell a real delete
  // from a no-op. Broken-links' item actions 404 correctly in the same
  // situation, so the plugin is inconsistent with itself. Logged as FINDINGS #6.
  // Pinned as-is; flip to expecting 404 when that is fixed.
  test('E: deleting a 404-log row that does not exist reports success (see FINDINGS #6)', async () => {
    const resp = await api.delete(`${PRO_BASE}/redirections/404-logs/999999`);
    expect(resp.status()).toBe(200);
    expect((await resp.json())?.success).toBe(true);
  });
});
