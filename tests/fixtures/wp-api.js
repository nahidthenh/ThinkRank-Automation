/**
 * WordPress REST API helper.
 * Gets a nonce from the admin and provides authenticated fetch().
 */

const { request } = require('@playwright/test');

const WP_URL = process.env.WP_URL || 'http://localhost:8080';
const WP_USER = process.env.WP_ADMIN_USER || 'admin';
const WP_PASS = process.env.WP_ADMIN_PASS || 'admin123';

/** Encode credentials for Basic Auth */
const basicAuth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

/**
 * Returns an APIRequestContext authenticated against the WP REST API.
 * Uses HTTP Basic Auth (Application Passwords style header works for test environments).
 */
async function createApiContext() {
  const ctx = await request.newContext({
    baseURL: WP_URL,
    extraHTTPHeaders: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
  });
  return ctx;
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
