/**
 * Auth setup — logs into WordPress admin once and saves the session.
 * All feature tests reuse this session (no repeated logins).
 */

const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const STORAGE_PATH = 'test-results/.auth/admin.json';

setup('authenticate as WordPress admin', async ({ page }) => {
  const wpUrl = process.env.WP_URL || 'http://localhost:8080';

  // Ensure storage dir exists
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });

  await page.goto(`${wpUrl}/wp-login.php`);
  await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
  await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'admin123');
  await page.click('#wp-submit');

  // Wait for redirect to admin dashboard
  await expect(page).toHaveURL(/wp-admin/, { timeout: 15_000 });

  // Save auth state
  await page.context().storageState({ path: STORAGE_PATH });
  console.log('✓ Auth state saved to', STORAGE_PATH);
});
