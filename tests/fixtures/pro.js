/**
 * Pro-detection helper.
 *
 * @pro specs call this in beforeAll and skip themselves when the Pro feature
 * set is not available on the target site — so the same suite runs green
 * against a Free-only site.
 *
 * Detection is deliberately NOT "does the thinkrank-pro/v1 namespace exist".
 * Pro gates its feature components behind a licence check
 * (License\Manager::is_valid(), thinkrank-pro #93): unlicensed, only
 * `license` and `admin` load, so API\Manager never registers any feature
 * route. But the licensing SDK registers /license/* unconditionally, so the
 * NAMESPACE is present on an unlicensed site. A namespace check therefore
 * reports Pro as active, nothing skips, and ~37 specs fail on 404s while the
 * handful that assert `→ 404` for a bad id pass for the wrong reason.
 *
 * So we look for a feature route instead — any route in the namespace that is
 * neither the root nor a /license/* route. That is generic on purpose: it
 * survives a module being renamed or removed, unlike pinning one endpoint.
 */

import { request } from '@playwright/test';

const WP_URL = process.env.WP_URL || 'https://thinkrank.test';
const PRO_NS = '/wp-json/thinkrank-pro/v1';

/**
 * @typedef {'absent'|'unlicensed'|'active'} ProState
 *   absent     — the Pro plugin is not active (no thinkrank-pro/v1 namespace)
 *   unlicensed — Pro is active but no licence, so only /license/* is exposed
 *   active     — Pro is active and licensed; the feature routes are registered
 */

/** Memoised per worker process — the state cannot change mid-run. */
let cached;

/** @returns {Promise<ProState>} */
export async function getProState() {
  if (cached) return cached;

  const ctx = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
  try {
    const root = await ctx.get('/wp-json/');
    if (!root.ok()) return (cached = 'absent');

    const { namespaces = [] } = await root.json();
    if (!namespaces.includes('thinkrank-pro/v1')) return (cached = 'absent');

    const ns = await ctx.get(PRO_NS);
    if (!ns.ok()) return (cached = 'unlicensed');

    const routes = Object.keys((await ns.json())?.routes ?? {});
    const hasFeatureRoute = routes.some(
      (r) => r !== PRO_NS.replace('/wp-json', '') && !r.startsWith('/thinkrank-pro/v1/license'),
    );

    return (cached = hasFeatureRoute ? 'active' : 'unlicensed');
  } catch {
    return (cached = 'absent');
  } finally {
    await ctx.dispose();
  }
}

/** @returns {Promise<boolean>} true when Pro's feature routes are actually reachable */
export async function isProActive() {
  return (await getProState()) === 'active';
}
