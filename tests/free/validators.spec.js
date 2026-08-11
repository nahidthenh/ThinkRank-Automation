/**
 * FREE — validation / diagnostic endpoints and system connection status.
 *
 * Fills gaps in schema (6/13), site-identity (4/10), llms-txt (3/7) and
 * settings-management (4/10): the pure validate/diagnose routes plus the
 * previously untested `/connection-status`.
 *
 * Every endpoint here is read-only or a pure validator — nothing mutates
 * settings, so this is safe against a shared site. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, TR_BASE } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

test.describe('@free Validators & diagnostics', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── connection-status (previously 0/1) ───────────────────────────────────
  test('R: connection-status reports plugin, MCP, user and database health', async () => {
    const { status, body } = await trGet(api, '/connection-status');
    expect(status).toBe(200);

    for (const key of ['plugin', 'abilities', 'mcp_server', 'user', 'urls', 'database']) {
      expect(body, `connection-status is missing "${key}"`).toHaveProperty(key);
    }
  });

  // ── settings-management/category (previously untested) ───────────────────
  // The endpoint declares an 11-value enum; both the accept and reject sides
  // are asserted so a silently-dropped guard (see FINDINGS #4) would show up.
  test('R: a valid settings category returns its settings', async () => {
    const { status, body } = await trGet(api, '/settings-management/category/site_identity');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  test('E: an unknown settings category → 400', async () => {
    const { status, body } = await trGet(api, '/settings-management/category/not_a_category');
    expect(status).toBe(400);
    // The message should enumerate the permitted categories for the caller.
    expect(JSON.stringify(body)).toMatch(/site_identity/);
  });

  test('E: settings-management validate without a payload → 400', async () => {
    const resp = await api.post(`${TR_BASE}/settings-management/validate`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  // ── schema validate + performance (previously untested) ──────────────────
  test('E: schema validate without a schema → 400', async () => {
    const resp = await api.post(`${TR_BASE}/schema/validate`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  test('R: schema performance responds for a real post', async () => {
    const postId = await createPost(api, { title: 'TR schema performance fixture' });
    try {
      const { status, body } = await trGet(api, `/schema/performance/post/${postId}`);
      expect(status).toBe(200);
      expect(body?.success).toBe(true);
      expect(body).toHaveProperty('data');
    } finally {
      await deletePost(api, postId);
    }
  });

  // ── site-identity validate (previously untested) ─────────────────────────
  test('E: site-identity validate without settings → 400', async () => {
    const resp = await api.post(`${TR_BASE}/site-identity/validate`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  // ── llms-txt validate + optimization results (previously untested) ───────
  test('E: llms-txt validate without content → 400', async () => {
    const resp = await api.post(`${TR_BASE}/llms-txt/validate`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  test('R: llms-txt optimization-results responds with a result envelope', async () => {
    const { status, body } = await trGet(api, '/llms-txt/optimization-results');
    expect(status).toBe(200);
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('data');
  });

  // ── instant-indexing verify-key (previously untested) ────────────────────
  test('R: instant-indexing verify-key reports reachability of the hosted key', async () => {
    const { status, body } = await trGet(api, '/instant-indexing/verify-key');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const d = body?.data ?? {};
    expect(typeof d.reachable, 'reachable should be a boolean').toBe('boolean');
    expect(d).toHaveProperty('url');
    // When the key file is missing the endpoint must explain why, not just fail.
    if (d.reachable === false) expect(d).toHaveProperty('reason');
  });
});
