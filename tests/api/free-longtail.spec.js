/**
 * Phase 6 — FREE long-tail read contracts.
 *
 * Analytics (F14), AI tools/providers + content briefs (F19), migration
 * snapshots (F21), setup wizard state (F22), email report, and plugin/system
 * info. Read-only. Endpoints that depend on an external connection (GA) are
 * asserted tolerantly so they stay portable to sites without that connection.
 * @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';

test.describe('@free REST — long-tail read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  // F14 — SEO Analytics.
  test('seo-analytics status and dashboard respond', async () => {
    const status = await trGet(api, '/seo-analytics/status');
    expect(status.status).toBe(200);
    expect(typeof status.body?.data).toBe('object');

    // Dashboard needs a GA connection — accept connected (200) or not.
    const dash = await trGet(api, '/seo-analytics/dashboard');
    expect([200, 400, 403]).toContain(dash.status);
    expect(dash.body).toBeTruthy();
  });

  // F19 — AI tools.
  test('ai status and providers respond', async () => {
    const status = await trGet(api, '/ai/status');
    expect(status.status).toBe(200);
    expect(typeof status.body?.connected).toBe('boolean');

    const providers = await trGet(api, '/ai/providers');
    expect(providers.status).toBe(200);
    expect(providers.body).toHaveProperty('openai');
  });

  test('content-brief list responds', async () => {
    const { status, body } = await trGet(api, '/content-brief/list');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data)).toBeTruthy();
  });

  // F21 — Migration.
  test('import snapshots respond', async () => {
    const { status, body } = await trGet(api, '/import/snapshots');
    expect(status).toBe(200);
    expect(typeof body?.snapshots).toBe('object');
  });

  // F22 — Setup wizard.
  test('setup-wizard state reports steps', async () => {
    const { status, body } = await trGet(api, '/setup-wizard/state');
    expect(status).toBe(200);
    expect(typeof body?.total_steps).toBe('number');
  });

  // Email report config.
  test('email-report config responds', async () => {
    const { status, body } = await trGet(api, '/email-report/config');
    expect(status).toBe(200);
    expect(body?.config).toBeTruthy();
  });

  // System + plugin info + capabilities.
  test('system-status, plugin-info and capabilities respond', async () => {
    const sys = await trGet(api, '/system-status');
    expect(sys.status).toBe(200);
    expect(sys.body).toHaveProperty('status');

    const info = await trGet(api, '/plugin-info');
    expect(info.status).toBe(200);
    expect(info.body).toHaveProperty('version');

    const caps = await trGet(api, '/capabilities');
    expect(caps.status).toBe(200);
    expect(typeof caps.body?.manage_settings).toBe('boolean');
  });
});
