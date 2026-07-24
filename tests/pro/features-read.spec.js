/**
 * Phase 5 — PRO feature read contracts.
 *
 * Read-only checks that each Pro feature endpoint responds for an authenticated
 * admin and returns its documented shape. No writes / scans, so safe on any
 * site. Self-skips when Pro is inactive. @pro
 */

import { test, expect } from '@playwright/test';
import { createApiContext, proGet } from '../fixtures/wp-api.js';
import { isProActive } from '../fixtures/pro.js';

test.describe('@pro Feature read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // Broken Links — list of found links.
  test('broken-links returns an items list', async () => {
    const { status, body } = await proGet(api, '/broken-links');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data?.items)).toBeTruthy();
  });

  // Internal Links — post-type and post pickers.
  test('internal-links exposes post types and posts', async () => {
    const types = await proGet(api, '/internal-links/post-types');
    expect(types.status).toBe(200);
    expect(Array.isArray(types.body?.data)).toBeTruthy();

    const posts = await proGet(api, '/internal-links/posts');
    expect(posts.status).toBe(200);
    expect(Array.isArray(posts.body?.data)).toBeTruthy();
  });

  // Rank Tracker — tracked keywords + suggestions. These pull from Google
  // Search Console, so tolerate transient upstream failures; assert the array
  // shape when the data is actually returned.
  test('rank-tracker returns keywords and suggestions', async () => {
    const kw = await proGet(api, '/rank-tracker/keywords');
    expect([200, 429, 500, 502, 503, 504]).toContain(kw.status);
    if (kw.status === 200) expect(Array.isArray(kw.body?.data)).toBeTruthy();

    const sug = await proGet(api, '/rank-tracker/suggestions');
    expect([200, 429, 500, 502, 503, 504]).toContain(sug.status);
    if (sug.status === 200) expect(Array.isArray(sug.body?.data)).toBeTruthy();
  });

  // Custom Schema — entries list + available targets.
  test('custom-schema returns entries and targets', async () => {
    const entries = await proGet(api, '/custom-schema/entries');
    expect(entries.status).toBe(200);
    expect(Array.isArray(entries.body?.data)).toBeTruthy();

    const targets = await proGet(api, '/custom-schema/targets');
    expect(targets.status).toBe(200);
    expect(Array.isArray(targets.body?.data?.post_types)).toBeTruthy();
  });

  // Top Content report — also Search Console-backed; tolerate transient errors.
  test('top-content returns a report array', async () => {
    const { status, body } = await proGet(api, '/top-content');
    expect([200, 429, 500, 502, 503, 504]).toContain(status);
    if (status === 200) expect(Array.isArray(body?.data)).toBeTruthy();
  });
});
