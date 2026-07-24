/**
 * Phase 2 — FREE admin screens.
 *
 * Each ThinkRank admin page must load without a PHP fatal/critical error and
 * mount its React app into the expected container. Reuses the admin session
 * from auth.setup.js. @free
 *
 * Menu slug (?page=) → React mount id (#thinkrank-<key>).
 */

import { test, expect } from '@playwright/test';

const SCREENS = [
  { name: 'Dashboard', slug: 'thinkrank', mount: '#thinkrank-dashboard' },
  { name: 'Essential SEO', slug: 'thinkrank-essential-seo', mount: '#thinkrank-essential-seo' },
  { name: 'AI Tools', slug: 'thinkrank-ai-tools', mount: '#thinkrank-ai-tools' },
  { name: 'Usages', slug: 'thinkrank-usages', mount: '#thinkrank-analytics' },
  { name: 'Settings', slug: 'thinkrank-settings', mount: '#thinkrank-settings' },
];

for (const screen of SCREENS) {
  test.describe(`@free Admin screen — ${screen.name}`, () => {
    test('loads without fatal errors and mounts the React app', async ({ page }) => {
      await page.goto(`/wp-admin/admin.php?page=${screen.slug}`);

      const html = await page.content();
      expect(html, 'PHP fatal error on page').not.toContain('Fatal error');
      expect(html, 'WP critical error on page').not.toContain('There has been a critical error');

      // Container exists and the app renders a visible child into it.
      const app = page.locator(screen.mount);
      await expect(app).toBeAttached();
      await expect(app.locator(':scope > *').first()).toBeVisible({ timeout: 30_000 });
    });
  });
}
