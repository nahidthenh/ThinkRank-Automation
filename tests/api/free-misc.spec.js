/**
 * FREE — remaining read contracts (#14–15).
 *
 * Analytics, performance, per-post metadata, MCP connection, global settings,
 * and SEO-analytics insights/opportunities. Read-only. Search-Console-backed
 * endpoints are asserted tolerantly. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

// Search-Console-backed endpoints: 200 when connected; 401/403 when the site
// has no Google connection (fresh installs), plus transient upstream errors.
const OK = [200, 401, 403, 429, 500, 502, 503, 504];

test.describe('@free REST — remaining read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  let postId;

  test.beforeAll(async () => {
    api = await createApiContext();
    postId = await createPost(api, { title: 'Metadata fixture' });
  });

  test.afterAll(async () => {
    await deletePost(api, postId);
    await api?.dispose();
  });

  test('analytics overview, usage and costs respond', async () => {
    expect((await trGet(api, '/analytics/overview')).status).toBe(200);
    expect((await trGet(api, '/analytics/usage')).status).toBe(200);
    // costs is a documented not-yet-implemented stub — still a 200 envelope.
    const costs = await trGet(api, '/analytics/costs');
    expect(costs.status).toBe(200);
    expect(costs.body).toHaveProperty('success');
  });

  test('performance diagnostics and opportunities respond', async () => {
    const diag = await trGet(api, '/performance/diagnostics');
    expect(diag.status).toBe(200);
    expect(Array.isArray(diag.body?.data)).toBeTruthy();

    const opp = await trGet(api, '/performance/opportunities');
    expect(opp.status).toBe(200);
  });

  test('per-post metadata responds with SEO fields', async () => {
    const { status, body } = await trGet(api, `/metadata/${postId}`);
    expect(status).toBe(200);
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('seo_score');
  });

  test('mcp connection and global settings respond', async () => {
    const conn = await trGet(api, '/mcp/connection');
    expect(conn.status).toBe(200);
    expect(conn.body).toHaveProperty('connected');

    const settings = await trGet(api, '/settings');
    expect(settings.status).toBe(200);
    expect(settings.body).toHaveProperty('ai_provider');
  });

  test('seo-analytics insights and opportunities respond', async () => {
    const insights = await trGet(api, '/seo-analytics/insights');
    expect(OK).toContain(insights.status);

    const opp = await trGet(api, '/seo-analytics/opportunities');
    expect(OK).toContain(opp.status);
  });

  test('E: focus-keyword-usage without a keyword param → 400', async () => {
    expect((await trGet(api, '/focus-keyword-usage')).status).toBe(400);
  });
});
