/**
 * Phase 14 — FREE analytics, performance & data read contracts (deepening).
 *
 * Read-only coverage for the remaining 🟡 partial areas: SEO analytics
 * (status/dashboard/indexing/branded/countries), performance history/monitor,
 * email report config, setup-wizard state, and the migration (import) read
 * surface. No writes — safe on any site.
 *
 * Several SEO-analytics endpoints are Google-Search-Console-backed: they answer
 * 200 when a connection exists and may surface a transient/gated error
 * otherwise, so those are asserted tolerantly (envelope shape when 200). The
 * purely-local endpoints (status/history/monitor/config/state) must be 200. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';

// Search-Console-backed endpoints: 200 when connected; 400/401/403 when the
// site has no Google connection (e.g. a fresh install), plus transient errors.
const SC_OK = [200, 400, 401, 403, 429, 500, 502, 503, 504];

test.describe('@free analytics, performance & data reads', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // --- SEO analytics (local status is always available) ---
  test('seo-analytics/status returns a connection status envelope', async () => {
    const { status, body } = await trGet(api, '/seo-analytics/status');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body).toHaveProperty('data');
  });

  test('seo-analytics dashboard and indexing-status respond', async () => {
    const dash = await trGet(api, '/seo-analytics/dashboard');
    expect(SC_OK).toContain(dash.status);
    if (dash.status === 200) expect(dash.body).toHaveProperty('data');

    const idx = await trGet(api, '/seo-analytics/indexing-status');
    expect(SC_OK).toContain(idx.status);
    if (idx.status === 200) expect(idx.body).toHaveProperty('data');
  });

  test('seo-analytics branded and countries respond (SC-backed, tolerant)', async () => {
    expect(SC_OK).toContain((await trGet(api, '/seo-analytics/branded')).status);
    expect(SC_OK).toContain((await trGet(api, '/seo-analytics/countries')).status);
  });

  // E — search-totals requires a date range; without it the endpoint 400s.
  test('E: seo-analytics/search-totals without params → 400', async () => {
    const { status } = await trGet(api, '/seo-analytics/search-totals');
    expect(status).toBe(400);
  });

  // --- Performance (local, computed on the site) ---
  test('performance history and monitor return data envelopes', async () => {
    const hist = await trGet(api, '/performance/history');
    expect(hist.status).toBe(200);
    expect(hist.body?.success).toBe(true);

    const mon = await trGet(api, '/performance/monitor');
    expect(mon.status).toBe(200);
    expect(mon.body).toHaveProperty('data');
  });

  // --- Email report configuration (read) ---
  test('email-report/config returns config, capabilities and sections', async () => {
    const { status, body } = await trGet(api, '/email-report/config');
    expect(status).toBe(200);
    expect(body).toHaveProperty('config');
    expect(body).toHaveProperty('capabilities');
    expect(body).toHaveProperty('sections');
  });

  // --- Setup wizard state (read) ---
  test('setup-wizard/state reports progress flags', async () => {
    const { status, body } = await trGet(api, '/setup-wizard/state');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(typeof body?.completed).toBe('boolean');
    expect(typeof body?.total_steps).toBe('number');
  });

  // --- Migration / import read surface (no migrate/export, read-only) ---
  test('import snapshots and detect respond', async () => {
    const snaps = await trGet(api, '/import/snapshots');
    expect(snaps.status).toBe(200);
    expect(snaps.body).toHaveProperty('snapshots');

    const detect = await trGet(api, '/import/detect');
    expect(detect.status).toBe(200);
    expect(detect.body).toHaveProperty('detected');
  });
});
