/**
 * Phase 13 — Setup wizard & migration flow (FREE).
 *
 * The onboarding wizard and the SEO-data migration (import) pipeline. These
 * feature a lot of state-changing endpoints (save step, mark/deactivate source
 * plugins, export-to-snapshot, migrate, cleanup) — all genuinely destructive or
 * site-altering, so we do NOT exercise their happy paths here.
 *
 * IMPORTANT — why the edge tests only send EMPTY bodies, never bad values:
 * these write endpoints enforce `required` params (missing → 400, handler never
 * runs) but do NOT enforce their `enum` / min-max arg schemas. Posting an
 * out-of-enum `plugin` actually RUNS the handler and mutates state (e.g. appends
 * the bogus slug to the migrated-plugins list). So the only safe negative input
 * is "omit the required params" — that is rejected before the callback fires and
 * changes nothing. (The missing enum enforcement is a separate finding.)
 *
 *   R — read the wizard/migration state surface (safe, no side effects).
 *   E — required-param guards reject empty writes (400) without acting.
 *
 * @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

test.describe('@free Setup wizard & migration flow', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ---- R: read-only wizard/migration state ----

  test('wizard state reports progress flags', async () => {
    const { status, body } = await trGet(api, '/setup-wizard/state');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(typeof body?.completed).toBe('boolean');
    expect(typeof body?.started).toBe('boolean');
    expect(typeof body?.current_step).toBe('number');
    expect(body?.total_steps).toBeGreaterThan(0);
  });

  test('wizard migrated-site-data returns a settings map', async () => {
    const { status, body } = await trGet(api, '/setup-wizard/migrated-site-data');
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    // `settings` is only populated when a prior migration wrote site identity;
    // on a fresh site it is an empty object. Either way it must be an object.
    expect(typeof body?.settings).toBe('object');
  });

  test('migration detect reports sources and snapshots', async () => {
    const { status, body } = await trGet(api, '/import/detect');
    expect(status).toBe(200);
    expect(body).toHaveProperty('detected');
    expect(body).toHaveProperty('snapshots');
  });

  test('migration snapshots list responds', async () => {
    const { status, body } = await trGet(api, '/import/snapshots');
    expect(status).toBe(200);
    expect(body).toHaveProperty('snapshots');
  });

  // ---- E: required-param guards (empty body → 400, handler never runs) ----
  // These are the ONLY safe negative inputs — see the file header. Each asserts
  // the endpoint refuses to act without its required params, changing nothing.

  test('E: install-plugins without slugs → 400 (no install)', async () => {
    const { status } = await trPost(api, '/setup-wizard/install-plugins', {});
    expect(status).toBe(400);
  });

  test('E: import/export without params → 400 (no export)', async () => {
    const { status } = await trPost(api, '/import/export', {});
    expect(status).toBe(400);
  });

  test('E: import/migrate without params → 400 (no migration)', async () => {
    const { status } = await trPost(api, '/import/migrate', {});
    expect(status).toBe(400);
  });

  test('E: import/cleanup without a plugin → 400 (no cleanup)', async () => {
    const { status } = await trPost(api, '/import/cleanup', {});
    expect(status).toBe(400);
  });

  test('E: import/snapshot DELETE without a plugin → 400', async () => {
    const resp = await api.delete('/wp-json/thinkrank/v1/import/snapshot');
    expect(resp.status()).toBe(400);
  });
});
