/**
 * FREE — MCP server: connection state, OAuth guards and JSON-RPC contract.
 *
 * Previously 1 of 10 routes covered. This adds the read + guard surface.
 *
 * DELIBERATELY NOT TESTED — these mutate a live integration and would break any
 * MCP client (Claude, editors) currently paired with the target site:
 *   /mcp/connect · /mcp/disconnect · /mcp/rotate · /mcp/apps/revoke (valid id)
 * They need a disposable site, not a shared one. See ROADMAP §8 "Deferred".
 * @free
 */

import { test, expect, request } from '@playwright/test';
import { createApiContext, trGet, WP_URL, TR_BASE } from '../fixtures/wp-api.js';

test.describe('@free MCP server', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ── R ────────────────────────────────────────────────────────────────────
  test('R: connection reports state and site-derived endpoints', async () => {
    const { status, body } = await trGet(api, '/mcp/connection');
    expect(status).toBe(200);
    expect(typeof body?.connected, 'connected should be a boolean').toBe('boolean');

    // Endpoints must be derived from the site under test — nothing hardcoded.
    for (const key of ['mcp_endpoint', 'mcp_endpoint_rest']) {
      expect(body, `connection is missing "${key}"`).toHaveProperty(key);
      if (body[key]) expect(String(body[key])).toContain(WP_URL.replace(/^https?:\/\//, ''));
    }

    // A token must never be exposed while disconnected.
    if (body.connected === false) {
      expect(body.connection_token ?? '', 'a disconnected server must not expose a token').toBeFalsy();
    }
  });

  test('R: apps returns the registered OAuth client list', async () => {
    const { status, body } = await trGet(api, '/mcp/apps');
    expect(status).toBe(200);
    expect(Array.isArray(body?.oauth_apps), 'oauth_apps should be a list').toBeTruthy();

    // Client secrets must never be returned in a listing.
    for (const app of body.oauth_apps ?? []) {
      expect(app, 'an OAuth app listing must not include client_secret').not.toHaveProperty('client_secret');
    }
  });

  // ── E ────────────────────────────────────────────────────────────────────
  test('E: OAuth register without a valid redirect_uri → 400', async () => {
    const resp = await api.post(`${TR_BASE}/mcp/oauth/register`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('invalid_redirect_uri');
  });

  test('E: OAuth token without a grant → 400 in OAuth error format', async () => {
    const resp = await api.post(`${TR_BASE}/mcp/oauth/token`, { data: {} });
    expect(resp.status()).toBe(400);

    // RFC 6749 §5.2 error body, not WP's rest_* envelope.
    const body = await resp.json();
    expect(body, 'token errors must use the OAuth error shape').toHaveProperty('error');
    expect(body).toHaveProperty('error_description');
  });

  test('E: revoking an app without an id → 400', async () => {
    const resp = await api.post(`${TR_BASE}/mcp/apps/revoke`, { data: {} });
    expect(resp.status()).toBe(400);
    expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  });

  // ── A ────────────────────────────────────────────────────────────────────
  test('A: the JSON-RPC endpoint rejects an unauthenticated call in JSON-RPC form', async () => {
    const anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      const resp = await anon.post(`${TR_BASE}/mcp`, {
        data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      });
      expect(resp.status()).toBe(401);

      // Even when rejecting, the transport must stay JSON-RPC — an MCP client
      // parses this, so a bare WP error envelope would break the handshake.
      const body = await resp.json();
      expect(body?.jsonrpc).toBe('2.0');
      expect(body, 'a rejected JSON-RPC call must carry an error member').toHaveProperty('error');
    } finally {
      await anon.dispose();
    }
  });

  test('A: connection state is not readable anonymously', async () => {
    const anon = await request.newContext({ baseURL: WP_URL, ignoreHTTPSErrors: true });
    try {
      const resp = await anon.get(`${TR_BASE}/mcp/connection`);
      expect([401, 403]).toContain(resp.status());
    } finally {
      await anon.dispose();
    }
  });
});
