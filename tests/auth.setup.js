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
const ADMIN_PASS = process.env.WP_ADMIN_PASS || '';

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

// ── Log in and persist the admin session ────────────────────────────────────
setup('authenticate as WordPress admin', async ({ page }) => {
  if (!ADMIN_PASS) {
    throw new Error(
      'WP_ADMIN_PASS is empty. Copy .env.example to .env and set the admin password.',
    );
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto(`${WP_URL}/wp-login.php`);
  await page.fill('#user_login', ADMIN_USER);
  await page.fill('#user_pass', ADMIN_PASS);
  await page.click('#wp-submit');

  // Successful login lands on wp-admin
  await expect(page).toHaveURL(/wp-admin/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
