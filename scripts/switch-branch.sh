#!/bin/bash
# HOST script — Full feature test cycle for a given branch.
# 1. Switches the plugin repo to the specified branch
# 2. Scans the plugin code and generates a manifest
# 3. Runs Playwright E2E feature tests against the live WordPress site
# 4. Formats and prints the test report
#
# Usage: ./scripts/switch-branch.sh <branch-name>
# Example: ./scripts/switch-branch.sh migration-phase-1

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

PLUGIN_DIR="../Herd/thinkrank/wp-content/plugins/thinkrank"
BRANCH="$1"
WP_URL="${WP_SITE_URL:-http://localhost:8080}"

# ── Validate args ──────────────────────────────────────────────────────────
if [ -z "$BRANCH" ]; then
    echo "Usage: $0 <branch-name>"
    echo ""
    echo "Available branches:"
    cd "$PLUGIN_DIR" && git branch -a --format='  %(refname:short)' | sed 's|origin/||' | sort -u
    exit 1
fi

# ── Check WordPress is running ─────────────────────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WP_URL/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: WordPress is not responding at $WP_URL (got HTTP $HTTP_CODE)"
    echo "Start with: docker compose up -d"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ThinkRank Feature Test Cycle"
echo "║  Branch : $BRANCH"
echo "║  Site   : $WP_URL"
echo "╚══════════════════════════════════════════════════════════╝"

# ── 1. Switch branch ───────────────────────────────────────────────────────
echo ""
echo "▶ [1/4] Switching to branch: $BRANCH"
cd "$PLUGIN_DIR"
CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT" = "$BRANCH" ]; then
    echo "  Already on '$BRANCH'."
    git pull --quiet --ff-only 2>/dev/null || true
else
    git fetch --quiet origin 2>/dev/null || true
    git checkout "$BRANCH" 2>&1
    git pull --quiet --ff-only 2>/dev/null || true
    echo "  Switched to '$BRANCH'."
fi
echo "  HEAD: $(git log -1 --format='%h %s' 2>/dev/null)"
cd - > /dev/null

# ── 2. Scan plugin code → manifest ────────────────────────────────────────
echo ""
echo "▶ [2/4] Scanning plugin code..."
node scripts/scan-plugin.js "$BRANCH"

# ── 3. Clear old results ───────────────────────────────────────────────────
rm -f test-results/playwright-results.json test-results/last-report.md
mkdir -p test-results/.auth test-results/artifacts

# ── 4. Run Playwright tests ────────────────────────────────────────────────
echo ""
echo "▶ [3/4] Running feature tests with Playwright..."
echo ""

set +e
WP_URL="$WP_URL" \
WP_ADMIN_USER="${WP_ADMIN_USER:-admin}" \
WP_ADMIN_PASS="${WP_ADMIN_PASS:-admin123}" \
npx playwright test --project=setup 2>&1

WP_URL="$WP_URL" \
WP_ADMIN_USER="${WP_ADMIN_USER:-admin}" \
WP_ADMIN_PASS="${WP_ADMIN_PASS:-admin123}" \
npx playwright test --project=feature-tests 2>&1

set -e

# ── 5. Generate report ─────────────────────────────────────────────────────
echo ""
echo "▶ [4/4] Generating report..."
echo ""
node scripts/generate-report.js "$BRANCH" test-results/playwright-results.json
