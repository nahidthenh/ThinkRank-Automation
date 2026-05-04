#!/bin/bash
# Runs INSIDE the WordPress container.
# Installs WordPress via WP-CLI and activates the ThinkRank plugin.
# Called once by setup-wordpress.sh on the host.

set -e

WP_DIR="/var/www/html"
PLUGIN_DIR="$WP_DIR/wp-content/plugins/thinkrank"

# ── 1. Wait for WordPress files to be ready ────────────────────────────────
echo "[setup] Waiting for WordPress files..."
until [ -f "$WP_DIR/wp-login.php" ]; do sleep 2; done
echo "[setup] WordPress files are ready."

# ── 2. Wait for wp-config.php (set by entrypoint) ─────────────────────────
echo "[setup] Waiting for wp-config.php..."
until [ -f "$WP_DIR/wp-config.php" ]; do sleep 2; done
echo "[setup] wp-config.php found."

# ── 3. Wait for DB connection ──────────────────────────────────────────────
echo "[setup] Waiting for database..."
until wp --allow-root --path="$WP_DIR" db check 2>/dev/null; do
    echo "[setup]   ... still waiting for DB ..."
    sleep 3
done
echo "[setup] Database connection OK."

# ── 4. Install WordPress if not already installed ─────────────────────────
if ! wp --allow-root --path="$WP_DIR" core is-installed 2>/dev/null; then
    echo "[setup] Installing WordPress..."
    wp --allow-root --path="$WP_DIR" core install \
        --url="${WP_SITE_URL:-http://localhost:8080}" \
        --title="${WP_SITE_TITLE:-ThinkRank Test Site}" \
        --admin_user="${WP_ADMIN_USER:-admin}" \
        --admin_password="${WP_ADMIN_PASS:-admin123}" \
        --admin_email="${WP_ADMIN_EMAIL:-admin@thinkrank.test}" \
        --skip-email
    echo "[setup] WordPress installed."
else
    echo "[setup] WordPress already installed — skipping."
fi

# ── 5. Activate ThinkRank plugin ──────────────────────────────────────────
echo "[setup] Activating ThinkRank plugin..."
wp --allow-root --path="$WP_DIR" plugin activate thinkrank 2>/dev/null \
    && echo "[setup] thinkrank activated." \
    || echo "[setup] WARNING: Could not activate thinkrank (may need composer install first)"

wp --allow-root --path="$WP_DIR" plugin activate thinkrank-pro 2>/dev/null \
    && echo "[setup] thinkrank-pro activated." \
    || echo "[setup] NOTE: thinkrank-pro not activated (optional)."

# ── 6. Install Composer dependencies in plugin ────────────────────────────
echo "[setup] Installing Composer dependencies in plugin..."
cd "$PLUGIN_DIR"
if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist --no-progress 2>&1
    echo "[setup] Composer install complete."
else
    echo "[setup] vendor/ already exists — skipping composer install."
fi

# ── 7. Create tests directory ─────────────────────────────────────────────
mkdir -p "$PLUGIN_DIR/tests/auto-generated"
mkdir -p /tmp/test-results

echo ""
echo "[setup] ✅ Setup complete!"
echo "[setup]    WordPress URL : ${WP_SITE_URL:-http://localhost:8080}"
echo "[setup]    phpMyAdmin    : http://localhost:${PMA_PORT:-8081}"
echo "[setup]    WP Admin      : ${WP_SITE_URL:-http://localhost:8080}/wp-admin"
echo "[setup]    Login         : ${WP_ADMIN_USER:-admin} / ${WP_ADMIN_PASS:-admin123}"
