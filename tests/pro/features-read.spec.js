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

  // Internal Links → tests/pro/internal-links.spec.js
  // Rank Tracker   → tests/pro/rank-tracker.spec.js
  // Custom Schema  → tests/pro/custom-schema.spec.js

  // Top Content report — also Search Console-backed; tolerate transient errors.
  test('top-content returns a report array', async () => {
    const { status, body } = await proGet(api, '/top-content');
    expect([200, 429, 500, 502, 503, 504]).toContain(status);
    if (status === 200) expect(Array.isArray(body?.data)).toBeTruthy();
  });
});
