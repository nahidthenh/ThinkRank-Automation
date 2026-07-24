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

  // Rank Tracker — tracked keywords + suggestions.
  test('rank-tracker returns keywords and suggestions', async () => {
    const kw = await proGet(api, '/rank-tracker/keywords');
    expect(kw.status).toBe(200);
    expect(Array.isArray(kw.body?.data)).toBeTruthy();

    const sug = await proGet(api, '/rank-tracker/suggestions');
    expect(sug.status).toBe(200);
    expect(Array.isArray(sug.body?.data)).toBeTruthy();
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

  // Top Content report.
  test('top-content returns a report array', async () => {
    const { status, body } = await proGet(api, '/top-content');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data)).toBeTruthy();
  });
});
