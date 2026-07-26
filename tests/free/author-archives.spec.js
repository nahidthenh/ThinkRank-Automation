/**
 * FREE — Author Archives (gap closure): R / E / W.
 *
 * R — settings expose the archive config (enabled + SEO title/description).
 * E — a save with no `settings` object is rejected (400).
 * W — round-trip the (cosmetic) archive title template: snapshot → change →
 *     verify persisted → restore → verify restored. Self-restoring; we mutate
 *     only the title string (no behavioral toggle). @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Author Archives', () => {
  // Snapshot/restore of a shared setting — keep the writes ordered.
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {string} original archive title template (restore artifact) */
  let originalTitle = '';

  test.beforeAll(async () => {
    api = await createApiContext();
    const { body } = await trGet(api, '/author-archives/settings');
    originalTitle = body?.data?.title ?? '';
  });

  test.afterAll(async () => {
    // Safety net — always put the original title back.
    if (api) {
      await trPost(api, '/author-archives/settings', {
        settings: { title: originalTitle },
      }).catch(() => {});
      await api.dispose();
    }
  });

  test('R: settings expose the archive config', async () => {
    const { status, body } = await trGet(api, '/author-archives/settings');
    expect(status).toBe(200);
    expect(typeof body?.data?.enabled).toBe('boolean');
    expect(body?.data).toHaveProperty('title');
    expect(body?.data).toHaveProperty('meta_description');
  });

  test('E: a save without a settings object → 400', async () => {
    const { status } = await trPost(api, '/author-archives/settings', {});
    expect(status).toBe(400);
  });

  test('W: the archive title template round-trips and restores', async () => {
    const probe = 'E2E archive title %author_name%';

    const write = await trPost(api, '/author-archives/settings', {
      settings: { title: probe },
    });
    expect(write.status).toBe(200);

    const after = await trGet(api, '/author-archives/settings');
    expect(after.body?.data?.title).toBe(probe);

    // Restore and confirm.
    const restore = await trPost(api, '/author-archives/settings', {
      settings: { title: originalTitle },
    });
    expect(restore.status).toBe(200);

    const restored = await trGet(api, '/author-archives/settings');
    expect(restored.body?.data?.title).toBe(originalTitle);
  });
});
