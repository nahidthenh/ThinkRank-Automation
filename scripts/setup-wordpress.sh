#!/bin/bash
# HOST script — First-run setup.
# Builds Docker, starts containers, installs WordPress, activates plugin.

set -e
cd "$(dirname "$0")/.."

PLUGIN_DIR="../Herd/thinkrank/wp-content/plugins/thinkrank"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       ThinkRank Docker Test Environment — Setup          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Load environment ────────────────────────────────────────────────────
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# ── 2. Build and start containers ─────────────────────────────────────────
echo "▶ Building Docker image..."
docker compose build --no-cache

echo ""
echo "▶ Starting containers..."
docker compose up -d

echo ""
echo "▶ Waiting for WordPress container to be healthy..."
ATTEMPTS=0
until docker exec thinkrank_wordpress php -r "echo 'ok';" 2>/dev/null | grep -q ok; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ $ATTEMPTS -gt 30 ]; then
        echo "ERROR: WordPress container did not become ready in time."
        docker compose logs wordpress
        exit 1
    fi
    echo "  ... waiting ($ATTEMPTS/30)..."
    sleep 5
done
echo "  Container is ready."

# ── 3. Run WordPress setup inside container ────────────────────────────────
echo ""
echo "▶ Running WordPress installation via WP-CLI..."
docker exec \
    -e WP_SITE_URL="${WP_SITE_URL:-http://localhost:8080}" \
    -e WP_SITE_TITLE="${WP_SITE_TITLE:-ThinkRank Test Site}" \
    -e WP_ADMIN_USER="${WP_ADMIN_USER:-admin}" \
    -e WP_ADMIN_PASS="${WP_ADMIN_PASS:-admin123}" \
    -e WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@thinkrank.test}" \
    thinkrank_wordpress bash /var/www/html/wp-content/plugins/thinkrank/../../../scripts/docker-setup.sh 2>/dev/null || \
docker exec \
    -e WP_SITE_URL="${WP_SITE_URL:-http://localhost:8080}" \
    -e WP_SITE_TITLE="${WP_SITE_TITLE:-ThinkRank Test Site}" \
    -e WP_ADMIN_USER="${WP_ADMIN_USER:-admin}" \
    -e WP_ADMIN_PASS="${WP_ADMIN_PASS:-admin123}" \
    -e WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@thinkrank.test}" \
    thinkrank_wordpress bash -c "$(cat scripts/docker-setup.sh)"

# ── 4. Create phpunit.xml in plugin dir (gitignored) ──────────────────────
echo ""
echo "▶ Creating phpunit.xml in plugin directory..."
cat > "$PLUGIN_DIR/phpunit.xml" << 'PHPUNITXML'
<?xml version="1.0" encoding="UTF-8"?>
<phpunit
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.5/phpunit.xsd"
    bootstrap="tests/bootstrap.php"
    colors="false"
    stopOnFailure="false"
    verbose="false"
>
    <testsuites>
        <testsuite name="ThinkRank — Existing Tests">
            <directory suffix=".php">tests/importers</directory>
        </testsuite>
        <testsuite name="ThinkRank — Auto-Generated Stubs">
            <directory suffix=".php">tests/auto-generated</directory>
        </testsuite>
    </testsuites>

    <coverage>
        <include>
            <directory suffix=".php">includes</directory>
        </include>
        <exclude>
            <file>includes/index.php</file>
        </exclude>
    </coverage>

    <logging>
        <junit outputFile="/tmp/test-results/results.xml"/>
    </logging>
</phpunit>
PHPUNITXML
echo "  phpunit.xml created."

# ── 5. Verify plugin activation ────────────────────────────────────────────
echo ""
echo "▶ Verifying plugin activation..."
wp_status=$(docker exec thinkrank_wordpress wp --allow-root plugin list --fields=name,status --format=csv 2>/dev/null)
echo "$wp_status" | grep thinkrank || echo "  (plugin status check inconclusive)"

# ── 6. Done ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ ThinkRank test environment is ready!                 ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  WordPress  : http://localhost:${WP_PORT:-8080}                     ║"
echo "║  WP Admin   : http://localhost:${WP_PORT:-8080}/wp-admin            ║"
echo "║  phpMyAdmin : http://localhost:${PMA_PORT:-8081}                     ║"
echo "║  Login      : ${WP_ADMIN_USER:-admin} / ${WP_ADMIN_PASS:-admin123}                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Next step: give me a branch name to run the test cycle  ║"
echo "╚══════════════════════════════════════════════════════════╝"
