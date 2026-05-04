#!/bin/bash
# HOST script — Run feature tests on the current branch without switching.
# Usage: ./scripts/run-tests.sh

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

WP_URL="${WP_SITE_URL:-http://localhost:8080}"
PLUGIN_DIR="../Herd/thinkrank/wp-content/plugins/thinkrank"
BRANCH=$(cd "$PLUGIN_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo ""
echo "▶ Running feature tests on current branch: $BRANCH"
echo "  Site: $WP_URL"
echo ""

# ── Scan plugin ────────────────────────────────────────────────────────────
node scripts/scan-plugin.js "$BRANCH"

# ── Clear old results ──────────────────────────────────────────────────────
rm -f test-results/playwright-results.json test-results/last-report.md
mkdir -p test-results/.auth test-results/artifacts

# ── Run Playwright ─────────────────────────────────────────────────────────
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

# ── Report ─────────────────────────────────────────────────────────────────
echo ""
node scripts/generate-report.js "$BRANCH" test-results/playwright-results.json
