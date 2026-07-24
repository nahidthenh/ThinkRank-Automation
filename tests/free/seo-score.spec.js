/**
 * FREE — SEO Score & Analyzer (deep). Feature #6.
 *
 *   seo-score:  W calculate · R get/latest/history · E missing/invalid post_id
 *   seo-analyzer: R report · W run
 *
 * Seeds a post, scores it, and cleans up. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

function findScore(body) {
  const c = [body?.score, body?.data?.score, body?.overall_score, body?.data?.overall_score];
  for (const v of c) {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n === 'number' && !Number.isNaN(n)) return n;
  }
  return null;
}

test.describe('@free SEO Score & Analyzer', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: 'SEO Score fixture' });
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api?.dispose();
  });

  // ── seo-score W/R ────────────────────────────────────────────────────────
  test('W: calculate returns a score 0–100', async () => {
    const { status, body } = await trPost(api, '/seo-score/calculate', { post_id: postId });
    expect(status).toBe(200);
    const score = findScore(body);
    expect(score, `no score in ${JSON.stringify(body)}`).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('R: get returns the stored score, grade and breakdown', async () => {
    const { status, body } = await trGet(api, `/seo-score/get?post_id=${postId}`);
    expect(status).toBe(200);
    expect(findScore(body)).not.toBeNull();
    expect(body?.data).toHaveProperty('grade');
    expect(body?.data).toHaveProperty('score_breakdown');
  });

  test('R: latest returns the most recent score record', async () => {
    const { status, body } = await trGet(api, `/seo-score/latest?post_id=${postId}`);
    expect(status).toBe(200);
    expect(findScore(body)).not.toBeNull();
  });

  test('R: history returns an array of score records', async () => {
    const { status, body } = await trGet(api, `/seo-score/history?post_id=${postId}`);
    expect(status).toBe(200);
    expect(Array.isArray(body?.data)).toBeTruthy();
  });

  // ── seo-score E ──────────────────────────────────────────────────────────
  test('E: calculate without post_id → 400', async () => {
    expect((await trPost(api, '/seo-score/calculate', {})).status).toBe(400);
  });

  test('E: get with a non-existent post_id → 400', async () => {
    expect((await trGet(api, '/seo-score/get?post_id=99999999')).status).toBe(400);
  });

  // ── seo-analyzer R/W ─────────────────────────────────────────────────────
  test('R: seo-analyzer returns a scored report', async () => {
    const { status, body } = await trGet(api, '/seo-analyzer');
    expect(status).toBe(200);
    const score = findScore(body);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(body?.data).toHaveProperty('grade');
  });

  test('W: seo-analyzer run returns a fresh scored report', async () => {
    const { status, body } = await trPost(api, '/seo-analyzer/run', {});
    expect(status).toBe(200);
    expect(findScore(body)).not.toBeNull();
    expect(body?.data?.summary).toBeTruthy();
  });
});
