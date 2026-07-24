/**
 * Phase 3 — FREE tooling read contracts.
 *
 * Read-only checks that the free tooling endpoints respond for an authenticated
 * admin and return their documented shapes: image SEO, author archives, instant
 * indexing, llms.txt, integrations, roles, the SEO analyzer (F13), and
 * performance recommendations. No writes, so safe on any site. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet } from '../fixtures/wp-api.js';

test.describe('@free REST — tooling read contracts', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  // F8 — Image SEO (returns the settings object at the top level).
  test('image-seo/settings returns an alt/title config', async () => {
    const { status, body } = await trGet(api, '/image-seo/settings');
    expect(status).toBe(200);
    expect(body).toHaveProperty('add_missing_alt');
  });

  // F9 — Author Archives.
  test('author-archives/settings returns config', async () => {
    const { status, body } = await trGet(api, '/author-archives/settings');
    expect(status).toBe(200);
    expect(body?.data).toBeTruthy();
    expect(typeof body.data.enabled).toBe('boolean');
  });

  // F15 — Instant Indexing.
  test('instant-indexing/settings returns config', async () => {
    const { status, body } = await trGet(api, '/instant-indexing/settings');
    expect(status).toBe(200);
    expect(typeof body?.data).toBe('object');
  });

  // F16 — LLMs.txt.
  test('llms-txt settings and status respond', async () => {
    const settings = await trGet(api, '/llms-txt/settings');
    expect(settings.status).toBe(200);
    expect(settings.body?.data?.settings).toBeTruthy();

    const status = await trGet(api, '/llms-txt/status');
    expect(status.status).toBe(200);
    expect(typeof status.body?.data?.file_exists).toBe('boolean');
  });

  // F17 — Integrations.
  test('integrations/settings returns config', async () => {
    const { status, body } = await trGet(api, '/integrations/settings');
    expect(status).toBe(200);
    expect(typeof body?.data?.settings).toBe('object');
  });

  // F23 — Roles / Capabilities.
  test('role-manager returns the editable roles', async () => {
    const { status, body } = await trGet(api, '/role-manager');
    expect(status).toBe(200);
    expect(Array.isArray(body?.data?.roles)).toBeTruthy();
  });

  // F13 — SEO Analyzer: covered in depth by tests/free/seo-score.spec.js.

  // F20 — Performance recommendations.
  test('performance/recommendations returns grouped recommendations', async () => {
    const { status, body } = await trGet(api, '/performance/recommendations');
    expect(status).toBe(200);
    expect(body?.data).toBeTruthy();
    expect(body.data).toHaveProperty('minor');
  });
});
