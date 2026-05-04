# ThinkRank Branch Feature Tester

You are running a full feature test cycle for the ThinkRank WordPress plugin on a specific Git branch.

**Branch to test:** $ARGUMENTS

Work through every step below in order. Do not skip steps. Use the tools available (Bash, Read, Write) to execute each step directly — do not just describe what you would do.

---

## Step 1 — Validate input

If `$ARGUMENTS` is empty, tell the user:
> Please provide a branch name. Usage: `/test-branch <branch-name>`
> 
> Available branches:
Then run: `cd ../Herd/thinkrank/wp-content/plugins/thinkrank && git branch -a --format='%(refname:short)' | sed 's|origin/||' | sort -u`
Stop here and wait for the user to retry.

---

## Step 2 — Switch branch

```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
git fetch --quiet origin 2>/dev/null || true
git checkout $ARGUMENTS 2>&1
git pull --quiet --ff-only origin $ARGUMENTS 2>/dev/null || true
git log -1 --format="HEAD: %h — %s (%cr by %an)"
```

If the checkout fails (branch does not exist), tell the user and stop.

---

## Step 3 — Analyse what changed on this branch

Run this to find the merge base with main:

```bash
cd /Users/md.nahidhasan/Herd/thinkrank/wp-content/plugins/thinkrank
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo "")
if [ -z "$BASE" ]; then
  git log --oneline -15
else
  echo "=== Commits on this branch ==="
  git log --oneline $BASE..HEAD
  echo ""
  echo "=== Changed files ==="
  git diff --name-status $BASE..HEAD
  echo ""
  echo "=== Diff summary ==="
  git diff --stat $BASE..HEAD
fi
```

Read the output carefully. Identify:
- Which PHP files changed (includes/ paths)
- Which JS/React files changed (src/ paths)
- Which test files changed (tests/ paths)
- Which REST API endpoints are affected
- Which admin pages are affected
- What kind of changes: new feature, bug fix, refactor, etc.

Write a **Change Summary** block (you will include this in the final report).

---

## Step 4 — Scan the plugin and generate the test manifest

```bash
cd /Users/md.nahidhasan/ThinkRank-Automation
node scripts/scan-plugin.js "$ARGUMENTS"
```

Read `test-results/plugin-manifest.json` and note:
- How many admin pages exist on this branch
- How many REST endpoints exist
- Which features are active

---

## Step 5 — Verify WordPress is running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null
```

If the result is not `200`, run:
```bash
cd /Users/md.nahidhasan/ThinkRank-Automation && docker compose up -d 2>&1 | tail -5
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
```

If still not `200`, tell the user WordPress is not reachable and stop.

---

## Step 6 — Run the Playwright feature tests

```bash
cd /Users/md.nahidhasan/ThinkRank-Automation
rm -f test-results/playwright-results.json test-results/last-report.md
mkdir -p test-results/.auth test-results/artifacts

# Auth setup
WP_URL="http://localhost:8080" WP_ADMIN_USER="admin" WP_ADMIN_PASS="admin123" \
  npx playwright test --project=setup 2>&1

# Feature tests
WP_URL="http://localhost:8080" WP_ADMIN_USER="admin" WP_ADMIN_PASS="admin123" \
  npx playwright test --project=feature-tests 2>&1
```

Capture the Playwright console output. Note every PASS and FAIL line.

---

## Step 7 — Write the full Markdown report

After all steps above are complete, create the file:
`/Users/md.nahidhasan/ThinkRank-Automation/test-results/report-$ARGUMENTS.md`

The report must follow this exact structure:

---

```markdown
# ThinkRank Test Report — Branch: $ARGUMENTS

**Date:** <today's date>
**Tester:** Claude (automated)
**Site:** http://localhost:8080

---

## Branch Summary

<2–3 sentences: what this branch is about, based on commit messages and changed files>

**Commits on this branch:**
- <list each commit: hash + subject>

**Changed files:**
- `<file>` — <what changed: new endpoint / bug fix / UI update / etc.>
- ...

---

## Plugin Snapshot (this branch)

| Item | Count |
|---|---|
| Admin pages | N |
| REST endpoints | N |
| PHP classes | N |
| Active features | feature1, feature2, ... |

---

## Test Results

**Total:** N  **Passed:** N  **Failed:** N  **Skipped:** N

### ✅ Passed Tests

List every test that passed, grouped by suite:

**Plugin — health check**
- [ ] ThinkRank REST namespace is registered

**Admin pages**
- [ ] Dashboard page loads without errors
- ... (every page)

**REST API endpoints**
- [ ] GET /integrations/settings
- ... (every endpoint)

**Feature-specific**
- [ ] <feature name> — <test name>
- ...

### ❌ Failed Tests

For each failed test:

**<Test name>**
- Suite: `<file>`
- Error: `<error message>`
- Likely cause: <your analysis of why it failed>
- Fix suggestion: <what to look at>

---

## What Was Tested

<Short paragraph: which parts of the plugin were covered — admin UI, REST API, frontend SEO output, specific features.>

---

## What Was NOT Tested (Manual Testing Needed)

List everything that requires human interaction or that the automated tests cannot cover:

- [ ] <item> — <why it needs manual testing>
- [ ] Real API key flows (Google Analytics, Search Console, PageSpeed) — requires live credentials
- [ ] AI content generation (Claude/OpenAI/Gemini) — requires live API keys
- [ ] File upload / media handling
- [ ] Cross-browser rendering (only Chromium was used)
- [ ] Any items specific to the changed files on this branch that require domain knowledge

---

## Recommended Next Tests

Based on what changed on this branch, these are the highest-priority tests to add or run manually:

1. **<Test name>** — <why it's important for this branch>
2. ...

---

## Conclusion

<2–3 sentences: overall health of the branch, any blocking issues, whether it looks safe to merge.>
```

---

## Step 8 — Print the report

After writing the file, print the full report to the conversation so the user can read it immediately.

Also tell the user:
> Report saved to: `test-results/report-$ARGUMENTS.md`

---

## Important rules

- Run every Bash command with the actual tool — do not simulate output.
- If any step produces an error, include it in the report under the relevant failed test.
- Keep the report honest: if a test was skipped or inconclusive, say so.
- Do not invent test results — only report what the tools actually returned.
- The report file must be real and written to disk, not just printed.
