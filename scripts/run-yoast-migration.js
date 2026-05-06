const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080';
const WP_USER  = 'admin';
const WP_PASS  = 'admin123';
const RESULTS  = '/tmp/test-results';

fs.mkdirSync(RESULTS, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${RESULTS}/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page    = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [JS Error]', msg.text());
  });

  // ── 1. Login ──────────────────────────────────────────────────────────────
  console.log('\n── Step 1: WordPress login ──');
  await page.goto(`${BASE_URL}/wp-login.php`, { waitUntil: 'networkidle' });
  await page.fill('#user_login', WP_USER);
  await page.fill('#user_pass',  WP_PASS);
  await page.click('#wp-submit');
  await page.waitForURL(`${BASE_URL}/wp-admin/**`, { timeout: 20000 });
  console.log('  ✓ Logged in');
  await shot(page, '01-logged-in');

  // ── 2. Navigate to ThinkRank import/export ────────────────────────────────
  console.log('\n── Step 2: Open ThinkRank Import/Export page ──');
  await page.goto(`${BASE_URL}/wp-admin/admin.php?page=thinkrank-import-export`, { waitUntil: 'domcontentloaded' });

  // Wait for React to boot (loading spinner hides, real content appears)
  console.log('  Waiting for React app to mount...');
  try {
    await page.waitForFunction(
      () => {
        const loading = document.querySelector('.thinkrank-loading');
        return !loading || loading.style.display === 'none' || getComputedStyle(loading).display === 'none';
      },
      { timeout: 30000 }
    );
  } catch {
    console.log('  Loading spinner still visible – continuing anyway');
  }
  // Extra wait for React renders
  await page.waitForTimeout(3000);
  await shot(page, '02-import-export-loaded');

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('  Page text (first 1500 chars):\n', pageText.substring(0, 1500));

  // ── 3. Click Yoast SEO tab (scoped inside ThinkRank container) ────────────
  console.log('\n── Step 3: Find and click Yoast SEO tab ──');
  const container = page.locator('#thinkrank-import-export');

  const tabSelectors = [
    'text=Yoast SEO',
    '[role="tab"]:has-text("Yoast")',
    'button:has-text("Yoast")',
    '.thinkrank-tab:has-text("Yoast")',
    'li:has-text("Yoast")',
    'a:has-text("Yoast")',
  ];

  let tabClicked = false;
  for (const sel of tabSelectors) {
    const el = container.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(2000);
      console.log(`  ✓ Yoast tab clicked (${sel})`);
      tabClicked = true;
      break;
    }
  }
  if (!tabClicked) {
    console.log('  ! Could not find Yoast SEO tab – dumping page HTML');
    fs.writeFileSync(`${RESULTS}/debug-page.html`, await page.content());
  }
  await shot(page, '03-yoast-tab');

  // ── 4. Check/select all data types (postmeta, settings, termmeta) ─────────
  console.log('\n── Step 4: Select all data types for export ──');
  const checkboxSelectors = [
    'input[type="checkbox"]',
    '[role="checkbox"]',
    'input[name*="type"]',
    'input[name*="postmeta"]',
    'input[name*="settings"]',
  ];
  for (const sel of checkboxSelectors) {
    const boxes = container.locator(sel);
    const count = await boxes.count();
    if (count > 0) {
      console.log(`  Found ${count} checkbox(es) – checking all`);
      for (let i = 0; i < count; i++) {
        const box = boxes.nth(i);
        if (!await box.isChecked().catch(() => false)) {
          await box.check().catch(() => {});
        }
      }
      break;
    }
  }
  await shot(page, '04-checkboxes-selected');

  // ── 5. Click "Export Selected Data" ──────────────────────────────────────
  console.log('\n── Step 5: Click "Export Selected Data" ──');
  const exportDataSelectors = [
    'button:has-text("Export Selected Data")',
    'text=Export Selected Data',
    'input[value*="Export Selected"]',
  ];
  let exportDataClicked = false;
  for (const sel of exportDataSelectors) {
    const el = container.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(1500);
      console.log(`  ✓ "Export Selected Data" clicked (${sel})`);
      exportDataClicked = true;
      break;
    }
  }
  if (!exportDataClicked) console.log('  ! "Export Selected Data" button not found');
  await shot(page, '05-after-export-selected-data');

  // ── 6. Click "Start Export" ───────────────────────────────────────────────
  console.log('\n── Step 6: Click "Start Export" ──');
  const startExportSelectors = [
    'button:has-text("Start Export")',
    'text=Start Export',
    'input[value="Start Export"]',
  ];
  let startExportClicked = false;
  for (const sel of startExportSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
      await el.click();
      console.log(`  ✓ "Start Export" clicked (${sel})`);
      startExportClicked = true;
      // Wait for export to complete (REST call)
      await page.waitForTimeout(5000);
      try {
        await page.waitForSelector(
          ':text("Export complete"), :text("exported"), :text("snapshot"), :text("Start Migration")',
          { timeout: 30000 }
        );
      } catch {
        console.log('  (Waiting for export completion timed out – continuing)');
      }
      break;
    }
  }
  if (!startExportClicked) console.log('  ! "Start Export" button not found');
  await shot(page, '06-after-start-export');

  const afterExportText = await page.evaluate(() => document.body.innerText);
  console.log('  Page after export (first 1000 chars):\n', afterExportText.substring(0, 1000));

  // ── 7. Click "Start Migration" ────────────────────────────────────────────
  console.log('\n── Step 7: Click "Start Migration" ──');
  const migrateSelectors = [
    'button:has-text("Start Migration")',
    'text=Start Migration',
    'input[value="Start Migration"]',
    'button:has-text("Migrate")',
  ];
  let migrateClicked = false;
  for (const sel of migrateSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 10000 }).catch(() => false)) {
      await el.click();
      console.log(`  ✓ "Start Migration" clicked (${sel})`);
      migrateClicked = true;
      await page.waitForTimeout(5000);
      try {
        await page.waitForSelector(
          ':text("Migration complete"), :text("migrated"), :text("Success"), :text("Done")',
          { timeout: 60000 }
        );
        console.log('  ✓ Migration completion indicator found');
      } catch {
        console.log('  (Waiting for migration completion timed out – continuing)');
      }
      break;
    }
  }
  if (!migrateClicked) console.log('  ! "Start Migration" button not found');
  await shot(page, '07-migration-complete');

  const finalText = await page.evaluate(() => document.body.innerText);
  console.log('\n  Final page state (first 2000 chars):\n', finalText.substring(0, 2000));

  // Save final HTML for debugging
  fs.writeFileSync(`${RESULTS}/final-page.html`, await page.content());

  console.log('\n── Done. All screenshots saved to', RESULTS, '──\n');
  await browser.close();
})();
