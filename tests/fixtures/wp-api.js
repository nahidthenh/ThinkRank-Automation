/**
 * WordPress REST API helper.
 * Authenticates using the stored browser session (cookies) from auth.setup.js
 * and fetches a WP nonce to authorize REST requests.
 */

const { request } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const WP_URL = process.env.WP_URL || 'http://localhost:8080';
const STORAGE_PATH = path.resolve('test-results/.auth/admin.json');

/**
 * Returns an APIRequestContext authenticated against the WP REST API.
 * Loads the stored browser session from auth.setup.js, then fetches a
 * WP nonce so REST endpoints that require manage_options will accept the request.
 */
async function createApiContext() {
  // Load stored session if available
  const storageState = fs.existsSync(STORAGE_PATH) ? STORAGE_PATH : undefined;

  const ctx = await request.newContext({
    baseURL: WP_URL,
    storageState,
  });

  // Fetch a WP REST nonce using the authenticated session
  let nonce = '';
  try {
    const nonceResp = await ctx.get('/wp-admin/admin-ajax.php?action=rest-nonce');
    if (nonceResp.ok()) {
      nonce = (await nonceResp.text()).trim();
    }
  } catch {
    // If nonce fetch fails, proceed without — GET endpoints may still work
  }

  // Dispose the session-only context and rebuild with the nonce header
  await ctx.dispose();

  const authedCtx = await request.newContext({
    baseURL: WP_URL,
    storageState,
    extraHTTPHeaders: {
      'X-WP-Nonce': nonce,
      'Content-Type': 'application/json',
    },
  });

  return authedCtx;
}

/**
 * GET a ThinkRank API endpoint and return { status, body, ok }
 */
async function apiGet(ctx, path) {
  const resp = await ctx.get(`/wp-json/thinkrank/v1${path}`);
  let body;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text();
  }
  return { status: resp.status(), body, ok: resp.ok() };
}

/**
 * POST to a ThinkRank API endpoint
 */
async function apiPost(ctx, path, data = {}) {
  const resp = await ctx.post(`/wp-json/thinkrank/v1${path}`, { data });
  let body;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text();
  }
  return { status: resp.status(), body, ok: resp.ok() };
}

module.exports = { createApiContext, apiGet, apiPost, WP_URL };
