/**
 * Phase 1 — FREE REST contract tests.
 *
 * Verifies the core settings endpoints are reachable by an authenticated admin
 * and return a settings object. These are read-contract checks (no writes), so
 * they are safe to run against any site. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';

test.describe('@free REST — core settings endpoints', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  // F2 — Global SEO
  test('GET /global-seo/settings returns settings for a post type', async () => {
    const { status, body } = await trGet(api, '/global-seo/settings?post_type=post');
    expect(status).toBe(200);
    expect(body).toBeTruthy();
    expect(typeof body).toBe('object');
  });

  // F3 — Global Robots Meta
  test('GET /global-robot-meta/settings returns robots config', async () => {
    const { status, body } = await trGet(api, '/global-robot-meta/settings');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  // F4 — Site Identity
  test('GET /site-identity/settings returns site identity data', async () => {
    const { status, body } = await trGet(api, '/site-identity/settings');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  // F5 — Social
  test('GET /social-media/settings returns social config', async () => {
    const { status, body } = await trGet(api, '/social-media/settings');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  test('GET /social-platforms/settings returns platform config', async () => {
    const { status } = await trGet(api, '/social-platforms/settings');
    expect(status).toBe(200);
  });

  // F6 — Schema
  test('GET /schema/settings returns schema config', async () => {
    const { status, body } = await trGet(api, '/schema/settings');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  // F7 — Sitemap
  test('GET /sitemap/settings returns sitemap config', async () => {
    const { status, body } = await trGet(api, '/sitemap/settings');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });
});
