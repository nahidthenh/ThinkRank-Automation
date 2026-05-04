#!/bin/bash
# Runs INSIDE the WordPress container.
# 1. Ensures dependencies are installed
# 2. Optionally generates test stubs for new classes
# 3. Runs PHPUnit and writes results to /tmp/test-results/

set -e

PLUGIN_DIR="/var/www/html/wp-content/plugins/thinkrank"
RESULTS_DIR="/tmp/test-results"
GENERATE="${GENERATE_TESTS:-1}"   # set to 0 to skip auto-generation

cd "$PLUGIN_DIR"

echo "[tests] Plugin dir : $PLUGIN_DIR"
echo "[tests] Results dir: $RESULTS_DIR"
echo ""

mkdir -p "$RESULTS_DIR"

# ── 1. Composer install ────────────────────────────────────────────────────
if [ ! -f vendor/autoload.php ]; then
    echo "[tests] Running composer install..."
    composer install --no-interaction --prefer-dist --no-progress 2>&1
    echo "[tests] Done."
else
    echo "[tests] vendor/ exists — skipping composer install."
fi

# ── 2. Verify bootstrap ────────────────────────────────────────────────────
if [ ! -f tests/bootstrap.php ]; then
    echo "[tests] ERROR: tests/bootstrap.php not found!"
    exit 1
fi

# ── 3. Ensure phpunit.xml exists (it's gitignored — create if missing) ─────
if [ ! -f phpunit.xml ]; then
    echo "[tests] Creating phpunit.xml..."
    php -r "
    file_put_contents('phpunit.xml', <<<'XML'
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<phpunit
    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
    xsi:noNamespaceSchemaLocation=\"https://schema.phpunit.de/9.5/phpunit.xsd\"
    bootstrap=\"tests/bootstrap.php\"
    colors=\"false\"
    stopOnFailure=\"false\"
    verbose=\"false\"
>
    <testsuites>
        <testsuite name=\"ThinkRank — Existing Tests\">
            <directory suffix=\".php\">tests/importers</directory>
        </testsuite>
        <testsuite name=\"ThinkRank — Auto-Generated Stubs\">
            <directory suffix=\".php\">tests/auto-generated</directory>
        </testsuite>
    </testsuites>
    <logging>
        <junit outputFile=\"/tmp/test-results/results.xml\"/>
    </logging>
</phpunit>
XML
    );
"
fi

# ── 4. Auto-generate test stubs ────────────────────────────────────────────
if [ "$GENERATE" = "1" ]; then
    echo "[tests] Auto-generating test stubs..."
    php /usr/local/bin/generate-tests.php "$PLUGIN_DIR" 2>&1
fi

# ── 5. Run PHPUnit ─────────────────────────────────────────────────────────
echo ""
echo "[tests] Running PHPUnit..."
echo "─────────────────────────────────────────────"

# Capture both stdout and exit code
set +e
./vendor/bin/phpunit 2>&1 | tee "$RESULTS_DIR/phpunit-output.txt"
PHPUNIT_EXIT=${PIPESTATUS[0]}
set -e

echo "─────────────────────────────────────────────"
echo "[tests] PHPUnit exit code: $PHPUNIT_EXIT"

# Write a simple status file
echo "$PHPUNIT_EXIT" > "$RESULTS_DIR/exit-code.txt"

exit "$PHPUNIT_EXIT"
