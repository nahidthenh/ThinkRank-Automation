/**
 * Pro-detection helper.
 *
 * @pro specs call this in beforeAll and skip themselves when ThinkRank Pro is
 * not active on the target site — so the same suite runs green against a
 * Free-only site.
 */

import { request } from '@playwright/test';

const WP_URL = process.env.WP_URL || 'https://thinkrank.test';

/** @returns {Promise<boolean>} true if the thinkrank-pro/v1 REST namespace exists */
export async function isProActive() {
  const ctx = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
  try {
    const resp = await ctx.get('/wp-json/');
    if (!resp.ok()) return false;
    const { namespaces = [] } = await resp.json();
    return namespaces.includes('thinkrank-pro/v1');
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}
