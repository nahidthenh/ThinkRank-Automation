/**
 * Phase 19 — Frontend value-correctness (F dimension).
 *
 * We already assert head meta / JSON-LD are *present*; this asserts the values
 * are *correct for the configured site* — not just that a tag exists:
 *   • canonical URL equals the actual permalink (post) / home URL (front page)
 *   • a normal published post is indexable (robots: index, follow) and og:type=article
 *   • the homepage WebSite schema name matches the configured site name + has a
 *     SearchAction, and the identity schema type matches identity_type config
 *   • a post's BreadcrumbList ends at that post's title
 *
 * Read-only: seeds throwaway posts and reads live config via the API; nothing is
 * mutated. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext, trGet, WP_URL } from '../fixtures/wp-api.js';
import { createPost, deletePost } from '../fixtures/seed.js';

/** Parse every JSON-LD script and flatten @graph nodes. */
function jsonLdNodes(html) {
  const nodes = [];
  const re = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const doc = JSON.parse(m[1]);
      if (Array.isArray(doc['@graph'])) nodes.push(...doc['@graph']);
      else nodes.push(doc);
    } catch {
      /* ignore */
    }
  }
  return nodes;
}

const attr = (html, re) => (html.match(re) || [])[1] || '';

test.describe('@free Frontend head value-correctness', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;
  /** @type {object} site-identity settings snapshot (read-only) */
  let identity;

  test.beforeAll(async () => {
    api = await createApiContext();
    identity = (await trGet(api, '/site-identity/settings')).body?.data?.settings || {};
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('a post canonical + robots + og:type reflect an indexable article', async () => {
    let id;
    try {
      id = await createPost(api, { title: 'TR canonical probe' });
      const link = (await (await api.get(`/wp-json/wp/v2/posts/${id}`)).json()).link;
      const html = await (await api.get(link)).text();

      // Canonical points at the real permalink.
      const canonical = attr(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      expect(canonical).toBe(link);

      // A normal published post is indexable.
      const robots = attr(html, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
      expect(robots).toMatch(/index/);
      expect(robots).toMatch(/follow/);
      expect(robots).not.toMatch(/noindex/);

      // Posts are articles.
      const ogType = attr(html, /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i);
      expect(ogType).toBe('article');
    } finally {
      await deletePost(api, id);
    }
  });

  test('the homepage WebSite schema matches the configured site name + has search', async () => {
    const html = await (await api.get('/')).text();
    const nodes = jsonLdNodes(html);

    const website = nodes.find((n) => n['@type'] === 'WebSite');
    expect(website, 'WebSite schema present').toBeTruthy();
    expect(website.name).toBe(identity.site_name);

    const action = Array.isArray(website.potentialAction)
      ? website.potentialAction[0]
      : website.potentialAction;
    expect(action?.['@type']).toBe('SearchAction');

    // Home canonical is the site root.
    const canonical = attr(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    expect(canonical.replace(/\/$/, '')).toBe(WP_URL.replace(/\/$/, ''));
  });

  test('the homepage identity schema type matches identity_type config', async () => {
    const html = await (await api.get('/')).text();
    const nodes = jsonLdNodes(html);

    // identity_type "person" → Person; anything else (blog/organization) → Organization.
    const expectedType = identity.identity_type === 'person' ? 'Person' : 'Organization';
    const entity = nodes.find((n) => n['@type'] === expectedType);
    expect(entity, `${expectedType} schema present for identity_type=${identity.identity_type}`).toBeTruthy();
    expect(typeof entity.name).toBe('string');
    expect(entity.name.length).toBeGreaterThan(0);
    expect(entity).toHaveProperty('url');
  });

  test("a post's BreadcrumbList ends at that post's title", async () => {
    let id;
    try {
      const title = 'TR breadcrumb probe';
      id = await createPost(api, { title });
      const link = (await (await api.get(`/wp-json/wp/v2/posts/${id}`)).json()).link;
      const html = await (await api.get(link)).text();

      const crumbs = jsonLdNodes(html).find((n) => n['@type'] === 'BreadcrumbList');
      expect(crumbs, 'BreadcrumbList present').toBeTruthy();
      expect(Array.isArray(crumbs.itemListElement)).toBeTruthy();

      const last = crumbs.itemListElement[crumbs.itemListElement.length - 1];
      const lastName = last?.name ?? last?.item?.name;
      expect(lastName).toBe(title);
    } finally {
      await deletePost(api, id);
    }
  });
});
