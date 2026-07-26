/**
 * Phase 12 — AI tools & content (FREE).
 *
 * ThinkRank's AI features (metadata/title/description generation, content
 * analysis, briefs) call an external LLM provider and need a configured API key.
 * We do NOT exercise the paid generation path here — that would cost money, be
 * slow, and be non-deterministic. Instead we cover the parts that are safe and
 * key-independent on ANY site:
 *
 *   R — read contracts: /ai/status, /ai/providers, /content-brief/list,
 *       /pillar-content/suggestions all respond with their documented shapes.
 *   E — validation & graceful degradation: generation endpoints reject missing
 *       required params (400) BEFORE any provider call, and when no key is
 *       configured they fail gracefully ({success:false}, 400) rather than 500.
 *
 * If the target site DOES have an AI key configured, the graceful-no-key check
 * is skipped (logged) so we never fire a real, billable generation request.
 * No writes; self-cleaning. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free AI tools & content', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {boolean} whether a provider key is configured on the target site */
  let aiConfigured = false;

  test.beforeAll(async () => {
    api = await createApiContext();
    const { body } = await trGet(api, '/ai/status');
    aiConfigured = Boolean(body?.configured);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  // R — AI status reports provider + configured/connected flags.
  test('ai/status returns provider and boolean config flags', async () => {
    const { status, body } = await trGet(api, '/ai/status');
    expect(status).toBe(200);
    expect(typeof body?.provider).toBe('string');
    expect(typeof body?.configured).toBe('boolean');
    expect(typeof body?.connected).toBe('boolean');
  });

  // R — providers catalog lists the supported LLM providers with their models.
  test('ai/providers lists supported providers with models', async () => {
    const { status, body } = await trGet(api, '/ai/providers');
    expect(status).toBe(200);
    // Documented providers; each advertises a name, models[] and requires_key.
    for (const key of ['openai', 'claude', 'gemini']) {
      expect(body).toHaveProperty(key);
      expect(typeof body[key].name).toBe('string');
      expect(Array.isArray(body[key].models)).toBeTruthy();
      expect(body[key].models.length).toBeGreaterThan(0);
      expect(body[key].requires_key).toBe(true);
    }
  });

  // E — generate-metadata requires `content`; the request is rejected by REST
  // arg validation (400) before any provider call, regardless of key config.
  test('ai/generate-metadata rejects a missing content param (400)', async () => {
    const { status } = await trPost(api, '/ai/generate-metadata', {});
    expect(status).toBe(400);
  });

  // E — analyze-content likewise requires `content`.
  test('ai/analyze-content rejects a missing content param (400)', async () => {
    const { status } = await trPost(api, '/ai/analyze-content', {});
    expect(status).toBe(400);
  });

  // E — add-keyword-paragraph requires both content AND target_keyword.
  test('ai/add-keyword-paragraph rejects when required params are missing (400)', async () => {
    const { status } = await trPost(api, '/ai/add-keyword-paragraph', {
      content: 'Some content but no target keyword.',
    });
    expect(status).toBe(400);
  });

  // E — graceful degradation: with content supplied but NO key configured, the
  // endpoint must fail cleanly (success:false, 4xx) instead of throwing a 500.
  // Skipped when a key is present so we never trigger a real billable call.
  test('ai/generate-metadata degrades gracefully without an API key', async () => {
    test.skip(aiConfigured, 'AI key is configured — skipping to avoid a billable generation call');

    const { status, body } = await trPost(api, '/ai/generate-metadata', {
      content: 'A short paragraph of content used only to exercise the no-key path.',
    });
    // No key → client never initializes → handler catches and returns 400.
    expect(status).toBe(400);
    expect(body?.success).toBe(false);
    expect(typeof body?.message).toBe('string');
  });

  // R — content brief list responds (returns an empty list gracefully with no key).
  test('content-brief/list returns a briefs collection', async () => {
    const { status, body } = await trGet(api, '/content-brief/list');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(Array.isArray(body?.data)).toBeTruthy();
    expect(typeof body?.total).toBe('number');
  });

  // E — pillar-content suggestions requires post_id (400 when absent).
  test('pillar-content/suggestions rejects a missing post_id (400)', async () => {
    const { status } = await trGet(api, '/pillar-content/suggestions');
    expect(status).toBe(400);
  });

  // R — pillar-content suggestions returns an array for a real post (empty is
  // valid — a fresh post has no linked pillar content). Self-cleaning seed post.
  test('pillar-content/suggestions returns an array for a real post', async () => {
    let postId;
    try {
      postId = await createPost(api, { title: 'TR pillar suggestions probe' });
      const { status, body } = await trGet(
        api,
        `/pillar-content/suggestions?post_id=${postId}`
      );
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBeTruthy();
    } finally {
      await deletePost(api, postId);
    }
  });
});
