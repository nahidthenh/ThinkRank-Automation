/**
 * Phase 1 — FREE SEO Score (F12).
 *
 * Self-seeds a post, calculates its SEO score, and reads it back. Cleans up the
 * post afterward so the target site is left unchanged. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free REST — SEO Score', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: 'TR SEO Score fixture' });
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api.dispose();
  });

  test('calculate returns a score between 0 and 100', async () => {
    const { status, body } = await trPost(api, '/seo-score/calculate', { post_id: postId });
    expect(status).toBe(200);

    const score = findScore(body);
    expect(score, `no numeric score in response: ${JSON.stringify(body)}`).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('get returns the stored score for the post', async () => {
    const { status, body } = await trGet(api, `/seo-score/get?post_id=${postId}`);
    expect(status).toBe(200);
    expect(body).toBeTruthy();
  });
});

/** Find a 0–100 score anywhere reasonable in the response body. */
function findScore(body) {
  if (body == null || typeof body !== 'object') return null;
  const candidates = [body.score, body.data?.score, body.overall_score, body.data?.overall_score];
  for (const c of candidates) {
    if (typeof c === 'number') return c;
  }
  return null;
}
