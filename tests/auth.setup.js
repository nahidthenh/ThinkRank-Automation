/**
 * Auth + precondition setup.
 *
 * Runs once before the test suite:
 *   1. Verifies the target site has ThinkRank Free + Pro active (fails fast if not).
 *   2. Logs into wp-admin and saves the session so every test starts authenticated.
 *
 * Nothing here is tied to a specific site — WP_URL and the admin credentials
 * come from .env, so this works against any WordPress site with ThinkRank.
 */

import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = 'playwright/.auth/admin.json';

const WP_URL = process.env.WP_URL || 'https://thinkrank.test';
const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.WP_ADMIN_PASS || 'admin';

// ── Precondition: ThinkRank Free must be active (Pro is optional) ────────────
// Free is required for any test to be meaningful. Pro is detected but NOT
// required, so the suite stays honest on a Free-only site — @pro specs
// self-skip when the Pro REST namespace is absent (see fixtures/pro.js).
setup('ThinkRank Free is active on the target site', async ({ request }) => {
  const resp = await request.get(`${WP_URL}/wp-json/`);
  expect(resp.ok(), `Target site ${WP_URL} did not respond to /wp-json/`).toBeTruthy();

  const { namespaces = [] } = await resp.json();

  expect(
    namespaces,
    `ThinkRank Free is not active on ${WP_URL} (missing "thinkrank/v1" REST namespace)`,
  ).toContain('thinkrank/v1');

  if (!namespaces.includes('thinkrank-pro/v1')) {
    console.warn(`\n⚠  ThinkRank Pro not active on ${WP_URL} — @pro tests will be skipped.\n`);
  }
});

// How long to wait for WordPress to answer the login POST. The local backend
// can be slow to redirect while under parallel load.
const LOGIN_TIMEOUT = 45_000;

// Minimum time to spend on the login form before submitting. See the note at
// the submit below — bot-protection plugins treat an instant submit as a script.
const HUMAN_TYPING_FLOOR = 2_500;

// ── Log in and persist the admin session ────────────────────────────────────
setup('authenticate as WordPress admin', async ({ page }) => {
  // The default per-test timeout is 30s, which is SHORTER than LOGIN_TIMEOUT —
  // without this the wait below could never run to completion and every login
  // problem surfaced as a bare "Test timeout of 30000ms exceeded". Headroom on
  // top covers the login page load and writing the storage state.
  setup.setTimeout(LOGIN_TIMEOUT + 30_000);

  if (!ADMIN_PASS) {
    throw new Error(
      'WP_ADMIN_PASS is empty. Copy .env.example to .env and set the admin password.',
    );
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto(`${WP_URL}/wp-login.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('#user_login', ADMIN_USER);
  await page.fill('#user_pass', ADMIN_PASS);

  // Security plugins commonly reject a login form that comes back faster than
  // a person could have typed it (BetterShield's honeypot, active on the local
  // site, uses a 2s floor and answers with a generic "That did not go through"
  // — indistinguishable from a bad password). Playwright fills the form in
  // well under that, so pause past the floor before submitting. Cheap once per
  // run, and it keeps the suite working on sites with that protection on.
  await page.waitForTimeout(HUMAN_TYPING_FLOOR);

  await page.click('#wp-submit');

  // WordPress answers a login POST one of two ways: it redirects into wp-admin,
  // or it re-renders the form with #login_error. Racing them means a rejected
  // credential reports WordPress's own reason ("Unknown username", "The password
  // you entered … is incorrect") instead of stalling until the timeout — the
  // whole suite depends on this step, so a silent stall hides every later skip.
  // Each waiter maps its own timeout to 'stalled' rather than rejecting, so the
  // one that loses the race settles harmlessly instead of surfacing as a late
  // unhandled rejection during teardown.
  // `waitUntil: 'commit'` resolves as soon as the wp-admin response commits —
  // the auth cookie is set by then, which is all storageState needs. The
  // default ('load') would additionally block on every asset the dashboard
  // pulls, including third-party ones the active theme preconnects to; one
  // hung external request there is enough to burn the whole timeout on a login
  // that actually succeeded.
  const loginError = page.locator('#login_error');
  const outcome = await Promise.race([
    page.waitForURL(/wp-admin/, { waitUntil: 'commit', timeout: LOGIN_TIMEOUT }).then(
      () => 'landed',
      () => 'stalled',
    ),
    loginError.waitFor({ state: 'visible', timeout: LOGIN_TIMEOUT }).then(
      () => 'rejected',
      () => 'stalled',
    ),
  ]);

  if (outcome === 'rejected') {
    const reason = (await loginError.innerText()).replace(/\s+/g, ' ').trim();
    throw new Error(
      `WordPress rejected the login for "${ADMIN_USER}" at ${WP_URL}.\n` +
        `  WordPress said: ${reason}\n` +
        '  Fix WP_ADMIN_USER / WP_ADMIN_PASS in .env (or .env.example → .env if missing).',
    );
  }

  if (outcome === 'stalled') {
    throw new Error(
      `Login to ${WP_URL} neither reached wp-admin nor reported an error within ` +
        `${LOGIN_TIMEOUT / 1000}s. Last URL: ${page.url()}\n` +
        '  Is the site up, and is WP_URL correct?',
    );
  }

  await expect(page).toHaveURL(/wp-admin/);

  await page.context().storageState({ path: AUTH_FILE });
});
