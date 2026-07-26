/**
 * Phase 11 — Settings management: export / import round-trip (FREE).
 *
 * The most write-heavy free surface. We cover it SAFELY:
 *
 *   R — export returns a parseable payload (metadata + settings) and NEVER leaks
 *       secrets (API keys / OAuth tokens are stripped from exports).
 *   E — import rejects missing data (400) and unparseable data (400).
 *   W — a real export → import(overwrite) → export round-trip:
 *         • idempotence: re-importing an export reproduces it byte-for-byte;
 *         • mutate & restore: flipping one benign flag persists, then the
 *           original snapshot is imported back and verified restored.
 *
 * Safety design (why this can run on a live/production site):
 *   • We operate ONLY on a manager-backed, SECRET-FREE category (exports strip
 *     secrets, so overwriting an export back must never touch a category that
 *     holds keys — we pick one that doesn't).
 *   • Every value written is the site's OWN exported data, so the round-trip is
 *     idempotent; the single mutation is a boolean flag we flip and put back.
 *   • afterAll unconditionally re-imports the original snapshot as a safety net,
 *     so even a mid-test failure leaves settings exactly as they started.
 *   • If no suitable category exists (bare site), the W tests self-skip.
 *
 * @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, trPost } from '../fixtures/wp-api.js';

const SM = '/settings-management';

// Secrets are stripped from exports, so overwriting an export back would wipe
// these if they lived in the target category. Never target a category holding
// one of these; also used to assert exports don't leak them.
const SENSITIVE_KEYS = [
  'openai_api_key', 'claude_api_key', 'gemini_api_key', 'openrouter_api_key',
  'google_analytics_api_key', 'google_search_console_api_key',
  'google_pagespeed_api_key', 'google_access_token', 'google_refresh_token',
];

// Preferred manager-backed, secret-free categories to round-trip (first with
// data + a boolean flag wins). `integrations` is intentionally excluded — it
// tracks live Google-connection state we'd rather not rewrite.
const CANDIDATE_CATEGORIES = ['seo_analytics', 'schema_management', 'social_media', 'sitemap'];

const exportCategory = async (api, category) => {
  const { status, body } = await trPost(api, `${SM}/export`, {
    categories: [category],
    format: 'json',
  });
  expect(status).toBe(200);
  return JSON.parse(body?.data?.export_data || '{}');
};

const importPayload = (api, payloadObj, overwrite = true) =>
  trPost(api, `${SM}/import`, {
    import_data: JSON.stringify(payloadObj),
    format: 'json',
    overwrite_existing: overwrite,
  });

// Import can coerce scalar types (e.g. an int 3600 comes back as "3600"), so
// compare settings by value with scalars normalized to strings — this still
// catches added/removed keys or genuinely changed values.
function normalizeSettings(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return out;
}

test.describe('@free Settings management — export/import round-trip', () => {
  // The write tests mutate a shared settings category, so they must run in
  // order on one worker (fullyParallel would otherwise race them).
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {string|null} chosen secret-free category with data */
  let target = null;
  /** @type {string|null} a boolean setting key inside target we can flip */
  let flagKey = null;
  /** @type {object|null} original export payload for `target` (restore artifact) */
  let snapshot = null;

  test.beforeAll(async () => {
    api = await createApiContext();

    for (const cat of CANDIDATE_CATEGORIES) {
      const payload = await exportCategory(api, cat);
      const settings = payload?.settings?.[cat];
      if (!settings || Array.isArray(settings) || typeof settings !== 'object') continue;
      const keys = Object.keys(settings);
      if (keys.length === 0) continue;
      // Never round-trip a category that carries a secret (it'd be stripped).
      if (keys.some((k) => SENSITIVE_KEYS.includes(k))) continue;

      target = cat;
      snapshot = payload;
      flagKey = keys.find((k) => typeof settings[k] === 'boolean') || null;
      break;
    }
  });

  test.afterAll(async () => {
    // Safety net: always put the original settings back, whatever happened.
    if (api && target && snapshot) {
      await importPayload(api, snapshot, true).catch(() => {});
    }
    await api?.dispose();
  });

  // R — export shape + secret redaction (across ALL categories).
  test('export returns a parseable payload and never leaks secrets', async () => {
    const { status, body } = await trPost(api, `${SM}/export`, { format: 'json' });
    expect(status).toBe(200);
    expect(body?.success).toBe(true);

    const parsed = JSON.parse(body?.data?.export_data || '{}');
    expect(parsed).toHaveProperty('metadata');
    expect(parsed).toHaveProperty('settings');
    expect(parsed.metadata).toHaveProperty('site_url');

    // No sensitive key may appear anywhere in the exported settings.
    for (const [, settings] of Object.entries(parsed.settings || {})) {
      if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
        for (const key of Object.keys(settings)) {
          expect(SENSITIVE_KEYS).not.toContain(key);
        }
      }
    }
  });

  // E — import with no data is rejected.
  test('E: import with missing data → 400', async () => {
    const { status } = await trPost(api, `${SM}/import`, {});
    expect(status).toBe(400);
  });

  // E — import with an unparseable payload is rejected.
  test('E: import with unparseable data → 400', async () => {
    const { status } = await trPost(api, `${SM}/import`, {
      import_data: 'not-json-at-all {{{',
      format: 'json',
    });
    expect(status).toBe(400);
  });

  // R — schema and global reads respond.
  test('schema and global reads respond', async () => {
    const schema = await trGet(api, `${SM}/schema`);
    expect(schema.status).toBe(200);

    const global = await trGet(api, `${SM}/global`);
    expect(global.status).toBe(200);
    expect(global.body?.success).toBe(true);
    expect(global.body?.data).toHaveProperty('settings');
  });

  // W — idempotence: re-importing an export reproduces the exact same settings.
  test('round-trip is idempotent (export → import → export unchanged)', async () => {
    test.skip(!target, 'No secret-free category with stored settings on this site');

    const imp = await importPayload(api, snapshot, true);
    expect(imp.status).toBe(200);
    expect(imp.body?.success).toBe(true);

    const after = await exportCategory(api, target);
    expect(normalizeSettings(after.settings[target])).toEqual(
      normalizeSettings(snapshot.settings[target])
    );
  });

  // W — mutate & restore: prove import actually persists, then put it back.
  test('a mutated setting persists on import and is restored', async () => {
    test.skip(!target || !flagKey, 'No boolean flag available to safely mutate');

    const original = snapshot.settings[target][flagKey];

    // Flip the flag and import it.
    const mutated = JSON.parse(JSON.stringify(snapshot));
    mutated.settings[target][flagKey] = !original;
    const impMut = await importPayload(api, mutated, true);
    expect(impMut.status).toBe(200);

    const afterMutate = await exportCategory(api, target);
    expect(String(afterMutate.settings[target][flagKey])).toBe(String(!original));

    // Restore the original snapshot and confirm it's back.
    const impRestore = await importPayload(api, snapshot, true);
    expect(impRestore.status).toBe(200);

    const afterRestore = await exportCategory(api, target);
    expect(String(afterRestore.settings[target][flagKey])).toBe(String(original));
    expect(normalizeSettings(afterRestore.settings[target])).toEqual(
      normalizeSettings(snapshot.settings[target])
    );
  });
});
