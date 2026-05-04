/**
 * ThinkRank Admin UI — Core Feature Tests (static, not branch-specific)
 *
 * Tests plugin presence, frontend SEO output, and post editor integration.
 * Branch-specific page tests are in branch-specific.spec.js (generated from manifest).
 */

const { test, expect } = require('@playwright/test');

const WP_URL = process.env.WP_URL || 'http://localhost:8080';

// Capture JS console errors per test
function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// ── Plugin activation in admin ─────────────────────────────────────────────
test.describe('Plugin — admin presence', () => {
  test('ThinkRank menu appears in WP admin sidebar', async ({ page }) => {
    await page.goto(`${WP_URL}/wp-admin/`);
    const thinkrankMenu = page.locator('#menu-posts-thinkrank, #toplevel_page_thinkrank, a[href*="thinkrank"]').first();
    await expect(thinkrankMenu).toBeVisible({ timeout: 10_000 });
  });

  test('Plugins list shows ThinkRank as active', async ({ page }) => {
    await page.goto(`${WP_URL}/wp-admin/plugins.php`);
    const row = page.locator('tr[data-plugin="thinkrank/thinkrank.php"]');
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/active/);
  });
});

// ── Post editor integration ────────────────────────────────────────────────
test.describe('Post editor — ThinkRank metabox', () => {
  test('ThinkRank scripts are enqueued in post editor', async ({ page }) => {
    // Create a draft post to check metabox
    await page.goto(`${WP_URL}/wp-admin/post-new.php`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Fatal error');

    // Check script tags for ThinkRank assets
    const scripts = await page.locator('script[src*="thinkrank"]').count();
    // At least one ThinkRank script should be enqueued in the editor
    expect(scripts).toBeGreaterThan(0);
  });
});

// ── Frontend SEO output ────────────────────────────────────────────────────
test.describe('Frontend — SEO meta tags', () => {
  test('Homepage has robots meta tag', async ({ page }) => {
    await page.goto(WP_URL);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toBeTruthy();
  });

  test('Homepage has no fatal errors in source', async ({ page }) => {
    const response = await page.goto(WP_URL);
    expect(response.ok()).toBeTruthy();
    const html = await page.content();
    expect(html).not.toContain('Fatal error');
    expect(html).not.toContain('WordPress database error');
  });

  test('WordPress REST API root is accessible', async ({ page }) => {
    const response = await page.goto(`${WP_URL}/wp-json/`);
    expect(response.ok()).toBeTruthy();
  });
});
