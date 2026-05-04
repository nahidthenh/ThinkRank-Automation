# ThinkRank Branch Code Review + E2E Test Writer

You are performing a deep code review of a ThinkRank WordPress plugin branch and writing targeted E2E tests for every new feature found.

**Branch to review:** $ARGUMENTS

Work through every step below in order. Do not skip steps. Use your tools (Bash, Read, Write) to execute directly — do not just describe what you would do.

---

## Step 1 — Validate input

If `$ARGUMENTS` is empty, tell the user:
> Please provide a branch name. Usage: `/review-branch <branch-name>`
>
> Available branches:
Then run:
```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
git branch -a --format='%(refname:short)' | sed 's|origin/||' | sort -u
```
Stop and wait for the user to retry.

---

## Step 2 — Switch to the branch

```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
git fetch --quiet origin 2>/dev/null || true
git checkout $ARGUMENTS 2>&1
git pull --quiet --ff-only origin $ARGUMENTS 2>/dev/null || true
git log -1 --format="HEAD: %h — %s (%cr by %an)"
```

If checkout fails, tell the user the branch does not exist and stop.

---

## Step 3 — Get changed code vs main

```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo "")
if [ -z "$BASE" ]; then
  echo "Could not find merge base — showing last 20 commits"
  git log --oneline -20
else
  echo "=== Commits on this branch ==="
  git log --oneline $BASE..HEAD
  echo ""
  echo "=== Changed files ==="
  git diff --name-status $BASE..HEAD
  echo ""
  echo "=== Full diff (PHP and JS only) ==="
  git diff $BASE..HEAD -- '*.php' '*.js' '*.jsx' '*.ts' '*.tsx'
fi
```

Read the full output carefully. Note every changed file and what kind of change it is.

---

## Step 4 — Deep code review

For every changed PHP and JS file listed in Step 3, read the actual file content:

```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
# Read each changed file (replace FILE with actual paths from Step 3)
cat <FILE>
```

While reading, identify and note:

**A. New / changed REST API endpoints**
- What route? (path, method)
- What parameters does it accept?
- What does it return?
- Any permission callbacks?

**B. New / changed Admin pages**
- What slug? What menu title?
- What React components are loaded?
- Any settings forms? Buttons? Tables?

**C. New PHP classes or major refactors**
- What does the class do?
- What hooks/filters does it register?
- Any `add_action`, `add_filter` calls?

**D. New frontend / React components**
- What UI elements?
- What API calls does it make?
- Any form submissions?

**E. Any dependency on external WordPress plugins**
Look specifically for these patterns in all PHP files:
- `is_plugin_active('plugin-slug/plugin-file.php')`
- `function_exists('plugin_function_name')`
- `class_exists('PluginClassName')`
- `defined('PLUGIN_CONSTANT')`
- `do_action('plugin_hook_name')`
- `apply_filters('plugin_filter_name', ...)`
- Comments or README mentions of "requires", "depends on", "integration with"

For each dependency found, determine:
1. Plugin name (human readable)
2. WordPress.org slug (e.g. `woocommerce`, `contact-form-7`, `elementor`)
3. Whether it is free (on WordPress.org) or requires a paid/pro version

---

## Step 5 — Handle plugin dependencies

### 5a. Check what plugins are already installed

Run:
```bash
cd /Users/md.nahidhasan/ThinkRank-Automation
# Check if WP-CLI is available
docker compose exec wordpress wp plugin list --format=table 2>/dev/null || \
wp plugin list --path=/Users/md.nahidhasan/Herd/thinkrank --format=table 2>/dev/null || \
echo "WP-CLI not available via docker/herd — will use WordPress admin API"
```

If WP-CLI is available via Docker, use it for all installs. If not, note it and install via the WordPress.org API approach below.

### 5b. Install free dependencies from WordPress.org

For each **free** dependency plugin found in Step 4 that is NOT already active:

**Via WP-CLI in Docker (preferred):**
```bash
docker compose exec wordpress wp plugin install <wordpress-org-slug> --activate --allow-root 2>&1
```

**Via WP-CLI in Herd (if not using Docker):**
```bash
wp plugin install <wordpress-org-slug> --activate --path=/Users/md.nahidhasan/Herd/thinkrank 2>&1
```

After each install, confirm with:
```bash
docker compose exec wordpress wp plugin is-active <wordpress-org-slug> --allow-root && echo "ACTIVE" || echo "NOT ACTIVE"
```

### 5c. Ask user to upload pro/premium dependencies

For each **pro or premium** dependency found, do NOT try to install it automatically. Instead, STOP and tell the user:

> **Pro plugin required:** `<Plugin Name>`
>
> This branch depends on `<Plugin Name>` which is a premium plugin and cannot be installed automatically from WordPress.org.
>
> Please upload the plugin ZIP manually:
> 1. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**
> 2. Upload the ZIP file for `<Plugin Name>`
> 3. Activate it
> 4. Then type `/review-branch $ARGUMENTS continue` to resume from Step 6

Wait for the user to confirm before continuing.

If there are **no dependencies**, skip Steps 5a–5c and continue to Step 6.

---

## Step 6 — Write targeted E2E test cases

Based on your code review in Step 4, create a new Playwright test file:

**File path:** `/Users/md.nahidhasan/ThinkRank-Automation/tests/feature/branch-$ARGUMENTS.spec.js`

Write test cases that specifically target what changed on this branch. Follow these rules:

1. **Every new REST endpoint** → at least 2 tests (happy path + invalid/missing params)
2. **Every new Admin page** → at least 2 tests (page loads, no PHP errors + specific UI element check)
3. **Every new UI form or button** → at least 1 test (fills form or clicks button, checks response)
4. **Every integration with an external plugin** → at least 1 test (checks the integration is active/working)
5. **Any data validation or permission check** → at least 1 test (unauthenticated request gets 401/403)

Use this template structure:

```javascript
/**
 * E2E Tests — Branch: $ARGUMENTS
 * Generated by /review-branch skill
 * Date: <today's date>
 *
 * Tests specifically targeting the changes introduced on this branch:
 * <list the changes you found in Step 4, one per line as a comment>
 */

const { test, expect } = require('@playwright/test');
const { createApiContext, apiGet, apiPost } = require('../fixtures/wp-api');

const WP_URL = process.env.WP_URL || 'http://localhost:8080';

// === NEW REST ENDPOINTS ===
// (only if this branch adds REST endpoints)
test.describe('New REST API: <feature name>', () => {
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('<endpoint> — happy path returns expected structure', async () => {
    const resp = await api.get('/wp-json/thinkrank/v1/<route>');
    expect([200, 400]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(typeof body).toBe('object');
      // Add field-level assertions based on what you read in the code
    }
  });

  test('<endpoint> — missing required param returns 400', async () => {
    const resp = await api.get('/wp-json/thinkrank/v1/<route>');
    // If param is required, missing it should give 400 or 200 with defaults
    expect([200, 400]).toContain(resp.status());
  });

  test('<endpoint> — unauthenticated POST is rejected', async ({ request }) => {
    const resp = await request.post(`${WP_URL}/wp-json/thinkrank/v1/<route>`, {
      data: {}
    });
    expect([401, 403]).toContain(resp.status());
  });
});

// === NEW ADMIN PAGES ===
// (only if this branch adds admin pages)
test.describe('New Admin page: <page title>', () => {
  test('<Page title> loads without errors', async ({ page }) => {
    const jsErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });
    page.on('pageerror', e => jsErrors.push(e.message));

    const resp = await page.goto(`${WP_URL}/wp-admin/admin.php?page=<slug>`);
    expect(resp.status()).not.toBe(500);

    const body = await page.textContent('body');
    expect(body).not.toContain('Fatal error');
    expect(body).not.toContain('Parse error');
    expect(body).not.toContain('WordPress database error');

    const critical = jsErrors.filter(e => e.includes('thinkrank') || e.includes('ThinkRank'));
    expect(critical).toHaveLength(0);
  });

  test('<Page title> shows expected UI elements', async ({ page }) => {
    await page.goto(`${WP_URL}/wp-admin/admin.php?page=<slug>`);
    await page.waitForLoadState('networkidle');
    // Add locator checks for the specific UI elements you saw in the code
    // e.g. await expect(page.locator('h1')).toContainText('<expected heading>');
  });
});

// === EXTERNAL PLUGIN INTEGRATION ===
// (only if this branch integrates with another plugin)
test.describe('Integration: <plugin name>', () => {
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('<plugin> integration endpoint is registered', async () => {
    const resp = await api.get('/wp-json/thinkrank/v1/<integration-route>');
    expect(resp.status()).not.toBe(404);
  });

  test('<plugin> integration returns valid data structure', async () => {
    const resp = await api.get('/wp-json/thinkrank/v1/<integration-route>');
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toBeDefined();
      // Add specific field checks based on the integration code you reviewed
    }
  });
});
```

**Important:** Replace ALL placeholder comments and template variables with real values from your code review. The test file must be specific to what actually changed on this branch — not generic. Use real route paths, real page slugs, real field names from the actual code you read.

---

## Step 7 — Verify tests are valid

After writing the test file, verify it has no syntax errors:

```bash
cd /Users/md.nahidhasan/ThinkRank-Automation
node --check tests/feature/branch-$ARGUMENTS.spec.js && echo "SYNTAX OK" || echo "SYNTAX ERROR"
```

If there is a syntax error, fix it immediately using the Edit tool.

---

## Step 8 — Write the review report

Create the file:
`/Users/md.nahidhasan/ThinkRank-Automation/test-results/review-$ARGUMENTS.md`

Use this structure:

```markdown
# Code Review Report — Branch: $ARGUMENTS

**Date:** <today's date>
**Reviewer:** Claude (automated)

---

## Branch Summary

<2–3 sentences: what this branch is about, based on commits and changed files>

**Commits:**
- `<hash>` — <subject>

---

## Changed Files

| File | Type | What changed |
|------|------|--------------|
| `<path>` | PHP / JS / CSS | <brief description> |

---

## Code Review Findings

### New Features
<List each new feature with: what it does, how it works, any concerns>

### Changed Features
<List each changed/refactored feature with: what changed and why it matters>

### Code Quality Notes
<Anything worth flagging: missing error handling, potential edge cases, security concerns, performance issues>

---

## Plugin Dependencies

| Plugin | Type | Status | Action taken |
|--------|------|--------|--------------|
| <name> | Free / Pro | Installed / Already active / Needs manual upload | <what was done> |

*(No dependencies found)* — if none

---

## E2E Tests Written

**File:** `tests/feature/branch-$ARGUMENTS.spec.js`

| Test suite | Tests | What is covered |
|------------|-------|-----------------|
| <suite> | N | <description> |

---

## What Needs Manual Testing

- [ ] <item> — <why automation cannot cover it>
- [ ] Any pro plugin flows (requires license activation)
- [ ] Visual/layout checks for new UI components
- [ ] Edge cases that require specific data setup

---

## Recommended Actions Before Merge

1. <action> — <reason>
2. ...

---

## Conclusion

<2–3 sentences: overall quality of the branch, any blockers, merge readiness.>
```

---

## Step 9 — Print results

After writing both files, print:

1. The full review report
2. A summary of what test cases were written and where the file is

Tell the user:
> **Review report:** `test-results/review-$ARGUMENTS.md`
> **E2E tests written:** `tests/feature/branch-$ARGUMENTS.spec.js`
>
> To run only the new tests: `npx playwright test tests/feature/branch-$ARGUMENTS.spec.js`
> To run the full suite: `/test-branch $ARGUMENTS`

---

## Important rules

- Read the actual source code — do not guess or assume what it does.
- Run every Bash command with the actual tool — never simulate output.
- The test file must contain real route paths and real page slugs from the code, not placeholder strings.
- If you cannot determine a dependency's WordPress.org slug with confidence, say so and ask the user instead of guessing.
- Never install a plugin that requires a paid license automatically — always ask the user.
- Both output files (report and test spec) must be written to disk, not just printed.
