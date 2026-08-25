/**
 * FREE — Schema (deep). Feature #3.
 *
 *   R  settings, types, deployed, per-post schema dashboard
 *   W  settings save path; generate schema for a post
 *   E  generate without schema_types / generate with an empty schema_types /
 *      preview without params / settings without settings → 400
 *   F  a published post exposes JSON-LD with an @type
 *
 * Seeds a post and snapshots schema settings; both restored afterward. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free Schema', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;
  let originalSettings;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: 'Schema fixture post' });
    originalSettings = (await trGet(api, '/schema/settings')).body?.data?.settings;
  });

  test.afterAll(async () => {
    if (api && originalSettings) {
      await trPost(api, '/schema/settings', { settings: originalSettings });
    }
    await deletePost(api, postId);
    await api?.dispose();
  });

  // ── R ──────────────────────────────────────────────────────────────────
  test('R: settings, types and deployed respond', async () => {
    const settings = await trGet(api, '/schema/settings');
    expect(settings.status).toBe(200);
    expect(typeof settings.body?.data?.settings?.enabled).toBe('boolean');

    const types = await trGet(api, '/schema/types');
    expect(types.status).toBe(200);
    expect(types.body?.data).toHaveProperty('Organization');

    const deployed = await trGet(api, '/schema/deployed');
    expect(deployed.status).toBe(200);
    expect(typeof deployed.body?.data).toBe('object');
  });

  test('R: per-post schema dashboard responds', async () => {
    const { status, body } = await trGet(api, `/schema/post/${postId}`);
    expect(status).toBe(200);
    expect(body?.data?.schema_dashboard).toHaveProperty('total_schemas');
  });

  // ── E ──────────────────────────────────────────────────────────────────
  // `schema_types` is declared `required => true, minItems => 1` in the route's
  // args, so WordPress rejects both shapes in has_valid_params() — before the
  // callback runs. That means the rejection carries a core validation code, not
  // the handler's own `missing_schema_types`, which is now unreachable for these
  // inputs. Assert the codes the route actually returns, and name the offending
  // param, so a future arg-schema change that drops the requirement fails here
  // rather than silently letting an empty generate request through.
  test('E: generate without schema_types → 400', async () => {
    const { status, body } = await trPost(api, '/schema/generate', {
      post_id: postId,
      context_type: 'post',
      context_id: postId,
    });
    expect(status).toBe(400);
    expect(body?.code).toBe('rest_missing_callback_param');
    expect(body?.data?.params, 'schema_types should be the missing param').toContain('schema_types');
  });

  test('E: generate with an empty schema_types list → 400', async () => {
    const { status, body } = await trPost(api, '/schema/generate', {
      post_id: postId,
      context_type: 'post',
      context_id: postId,
      schema_types: [],
    });
    expect(status).toBe(400);
    expect(body?.code).toBe('rest_invalid_param');
    expect(Object.keys(body?.data?.params ?? {})).toContain('schema_types');
  });

  test('E: preview without params → 400', async () => {
    const { status } = await trPost(api, '/schema/preview', {});
    expect(status).toBe(400);
  });

  test('E: settings without settings → 400', async () => {
    const { status } = await trPost(api, '/schema/settings', {});
    expect(status).toBe(400);
  });

  // ── W ──────────────────────────────────────────────────────────────────
  test('W: settings save path accepts valid settings', async () => {
    const { status, body } = await trPost(api, '/schema/settings', { settings: originalSettings });
    expect(status).toBe(200);
    expect(body?.success).toBeTruthy();
  });

  test('W: generate schema for a post responds', async () => {
    const { status } = await trPost(api, '/schema/generate', {
      post_id: postId,
      context_type: 'post',
      context_id: postId,
      schema_types: ['Article'],
    });
    expect([200, 201]).toContain(status);
  });

  // ── F ──────────────────────────────────────────────────────────────────
  test('F: a published post exposes JSON-LD with an @type', async ({ page }) => {
    await page.goto(`/?p=${postId}`);
    const blocks = page.locator('script[type="application/ld+json"]');
    expect(await blocks.count()).toBeGreaterThan(0);

    // At least one JSON-LD block parses and declares an @type.
    let hasType = false;
    for (const raw of await blocks.allTextContents()) {
      let json;
      expect(() => (json = JSON.parse(raw))).not.toThrow();
      const nodes = Array.isArray(json) ? json : json['@graph'] || [json];
      if (nodes.some((n) => typeof n?.['@type'] !== 'undefined')) hasType = true;
    }
    expect(hasType, 'no JSON-LD node declared an @type').toBeTruthy();
  });
});
