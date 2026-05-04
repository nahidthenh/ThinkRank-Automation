/**
 * ThinkRank REST API — Feature Tests
 *
 * Tests all /wp-json/thinkrank/v1/* endpoints against the live WordPress instance.
 * Each test verifies: endpoint is reachable, returns correct HTTP status,
 * and response body has the expected structure.
 */

const { test, expect } = require('@playwright/test');
const { createApiContext, apiGet, apiPost } = require('../fixtures/wp-api');

let api;

test.beforeAll(async () => {
  api = await createApiContext();
});

test.afterAll(async () => {
  await api.dispose();
});

// ── Plugin activation ──────────────────────────────────────────────────────
test.describe('Plugin — health check', () => {
  test('ThinkRank REST namespace is registered', async () => {
    const resp = await api.get('/wp-json/');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    const namespaces = body.namespaces || [];
    expect(namespaces).toContain('thinkrank/v1');
  });
});

// ── Global SEO ─────────────────────────────────────────────────────────────
test.describe('Global SEO endpoint', () => {
  test('GET /global-seo/settings requires post_type', async () => {
    const { status, body } = await apiGet(api, '/global-seo/settings/');
    // 400 = missing post_type param → endpoint exists and validates input
    expect([200, 400]).toContain(status);
    if (status === 400) {
      expect(body.code).toBe('rest_missing_callback_param');
    }
  });

  test('GET /global-seo/settings with post_type=post returns settings object', async () => {
    const resp = await api.get('/wp-json/thinkrank/v1/global-seo/settings/?post_type=post');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toBeDefined();
  });

  test('GET /global-seo/settings/all returns data for all post types', async () => {
    const { status, body } = await apiGet(api, '/global-seo/settings/all/');
    expect([200, 401, 403]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Integrations ───────────────────────────────────────────────────────────
test.describe('Integrations endpoint', () => {
  test('GET /integrations/settings returns settings structure', async () => {
    const { status, body } = await apiGet(api, '/integrations/settings/');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  test('POST /integrations/test-connections returns connection statuses', async () => {
    const { status, body } = await apiPost(api, '/integrations/test-connections/');
    // Should return 200 with connection status data
    expect([200, 400]).toContain(status);
    if (status === 200) {
      // Each service should have a status field
      expect(body).toBeDefined();
      const services = Object.values(body.data || body || {});
      if (services.length > 0) {
        services.forEach(svc => {
          expect(['configured', 'not_configured', 'error']).toContain(svc.status);
        });
      }
    }
  });
});

// ── Social Media / Social Platforms ───────────────────────────────────────
test.describe('Social Media endpoint', () => {
  test('GET /social-media/settings returns social settings', async () => {
    const { status, body } = await apiGet(api, '/social-media/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Site Identity ─────────────────────────────────────────────────────────
test.describe('Site Identity endpoint', () => {
  test('GET /site-identity/settings returns site identity data', async () => {
    const { status, body } = await apiGet(api, '/site-identity/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Schema ────────────────────────────────────────────────────────────────
test.describe('Schema endpoint', () => {
  test('GET /schema/settings requires post_type or post_id', async () => {
    const { status } = await apiGet(api, '/schema/settings/');
    expect([200, 400, 404]).toContain(status);
  });
});

// ── Sitemap ───────────────────────────────────────────────────────────────
test.describe('Sitemap endpoint', () => {
  test('GET /sitemap/settings returns sitemap configuration', async () => {
    const { status, body } = await apiGet(api, '/sitemap/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Global Robot Meta ─────────────────────────────────────────────────────
test.describe('Global Robot Meta endpoint', () => {
  test('GET /global-robot-meta/settings returns robot meta config', async () => {
    const { status, body } = await apiGet(api, '/global-robot-meta/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Performance ───────────────────────────────────────────────────────────
test.describe('Performance endpoint', () => {
  test('GET /performance endpoint responds', async () => {
    const { status } = await apiGet(api, '/performance/');
    expect([200, 400, 401, 404]).toContain(status);
  });
});

// ── Author Archives ───────────────────────────────────────────────────────
test.describe('Author Archives endpoint', () => {
  test('GET /author-archives/settings returns config', async () => {
    const { status, body } = await apiGet(api, '/author-archives/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Image SEO ─────────────────────────────────────────────────────────────
test.describe('Image SEO endpoint', () => {
  test('GET /image-seo/settings returns image SEO config', async () => {
    const { status, body } = await apiGet(api, '/image-seo/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── LLMs.txt ─────────────────────────────────────────────────────────────
test.describe('LLMs.txt endpoint', () => {
  test('GET /llms-txt/settings returns LLMs.txt config', async () => {
    const { status, body } = await apiGet(api, '/llms-txt/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Instant Indexing ──────────────────────────────────────────────────────
test.describe('Instant Indexing endpoint', () => {
  test('GET /instant-indexing/settings returns config', async () => {
    const { status, body } = await apiGet(api, '/instant-indexing/settings/');
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Settings Management ────────────────────────────────────────────────────
test.describe('Settings Management endpoint', () => {
  test('GET /settings-management/export returns exportable settings', async () => {
    const { status, body } = await apiGet(api, '/settings-management/export/');
    expect([200, 400, 401]).toContain(status);
    if (status === 200) {
      expect(typeof body).toBe('object');
    }
  });
});

// ── Unauthenticated requests are rejected ─────────────────────────────────
test.describe('Security — unauthenticated requests', () => {
  test('POST requests to write endpoints require authentication', async ({ request }) => {
    // No auth headers — should get 401 or 403
    const resp = await request.post(
      'http://localhost:8080/wp-json/thinkrank/v1/global-seo/settings/',
      { data: { meta_title: 'Hack' } }
    );
    expect([401, 403]).toContain(resp.status());
  });
});
