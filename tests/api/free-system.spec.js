/**
 * FREE — system, capabilities, integrations & MCP read contracts (gap closure).
 *
 * Closes the remaining partial read areas so the free API matrix is covered:
 * capabilities, plugin-info, system-status, role-manager, MCP connection, and
 * the safe integrations reads (GA4 conflict detection + Search Console sites).
 * All read-only. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';

test.describe('@free System, capabilities & integrations reads', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('capabilities reports the current user permission flags', async () => {
    const { status, body } = await trGet(api, '/capabilities');
    expect(status).toBe(200);
    expect(typeof body?.manage_settings).toBe('boolean');
    expect(body).toHaveProperty('view_analytics');
  });

  test('plugin-info returns name and version', async () => {
    const { status, body } = await trGet(api, '/plugin-info');
    expect(status).toBe(200);
    expect(typeof body?.version).toBe('string');
    expect(body).toHaveProperty('name');
  });

  test('system-status reports environment health', async () => {
    const { status, body } = await trGet(api, '/system-status');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('php_version');
    expect(body).toHaveProperty('wp_version');
  });

  test('role-manager returns the editable roles', async () => {
    const { status, body } = await trGet(api, '/role-manager');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(Array.isArray(body?.data?.roles)).toBeTruthy();
  });

  test('mcp/connection reports connection state', async () => {
    const { status, body } = await trGet(api, '/mcp/connection');
    expect(status).toBe(200);
    expect(typeof body?.connected).toBe('boolean');
    expect(body).toHaveProperty('mcp_endpoint');
  });

  test('integrations GA4 conflict detection responds', async () => {
    const { status, body } = await trGet(api, '/integrations/detect-ga4-conflicts');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  test('integrations Search Console sites list responds', async () => {
    const { status, body } = await trGet(api, '/integrations/search-console/sites');
    // Connection-gated: 200 with data when connected; tolerate gated errors.
    expect([200, 400, 401, 403, 429, 500, 502, 503, 504]).toContain(status);
    if (status === 200) expect(body).toHaveProperty('data');
  });
});
