/**
 * WordPress / ThinkRank REST API helper.
 *
 * ThinkRank endpoints require an authenticated admin (they return 401
 * "thinkrank_forbidden" otherwise). We reuse the browser session saved by
 * auth.setup.js (cookies) and fetch a WP REST nonce so cookie-authenticated
 * requests are accepted.
 *
 * Nothing is site-specific — WP_URL comes from .env via the Playwright config.
 */

import { request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const WP_URL = process.env.WP_URL || 'https://thinkrank.test';
const AUTH_FILE = path.resolve('playwright/.auth/admin.json');
const TR_BASE = '/wp-json/thinkrank/v1';
const PRO_BASE = '/wp-json/thinkrank-pro/v1';

/**
 * Build an APIRequestContext authenticated against WP, carrying a REST nonce.
 * @returns {Promise<import('@playwright/test').APIRequestContext>}
 */
export async function createApiContext() {
  const storageState = fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined;

  // Session-only context to fetch the nonce.
  const seed = await request.newContext({
    baseURL: WP_URL,
    ignoreHTTPSErrors: true,
    storageState,
  });

  let nonce = '';
  const resp = await seed.get('/wp-admin/admin-ajax.php?action=rest-nonce');
  if (resp.ok()) nonce = (await resp.text()).trim();
  await seed.dispose();

  // Real context with the nonce attached to every request.
  return request.newContext({
    baseURL: WP_URL,
    ignoreHTTPSErrors: true,
    storageState,
    extraHTTPHeaders: {
      'X-WP-Nonce': nonce,
      Accept: 'application/json',
    },
  });
}

/** GET a ThinkRank (free) endpoint. `p` starts with `/`. */
export async function trGet(ctx, p) {
  return unwrap(await ctx.get(`${TR_BASE}${p}`));
}

/** POST to a ThinkRank (free) endpoint. */
export async function trPost(ctx, p, data = {}) {
  return unwrap(await ctx.post(`${TR_BASE}${p}`, { data }));
}

/** GET a ThinkRank Pro endpoint. */
export async function proGet(ctx, p) {
  return unwrap(await ctx.get(`${PRO_BASE}${p}`));
}

/** POST to a ThinkRank Pro endpoint. */
export async function proPost(ctx, p, data = {}) {
  return unwrap(await ctx.post(`${PRO_BASE}${p}`, { data }));
}

/** Normalize a response into { status, ok, body }. */
async function unwrap(resp) {
  let body;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text();
  }
  return { status: resp.status(), ok: resp.ok(), body };
}

export { WP_URL, TR_BASE, PRO_BASE };
