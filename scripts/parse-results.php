#!/usr/bin/env php
<?php
/**
 * Parses PHPUnit JUnit XML output and formats the test report.
 *
 * Usage: php parse-results.php <branch> <results-xml> <phpunit-output-txt>
 */

declare(strict_types=1);

$branch      = $argv[1] ?? 'unknown';
$resultsFile = $argv[2] ?? '/tmp/test-results/results.xml';
$outputFile  = $argv[3] ?? '/tmp/test-results/phpunit-output.txt';

// ── Read raw output for fallback ───────────────────────────────────────────
$rawOutput = file_exists($outputFile) ? file_get_contents($outputFile) : '';

if (!file_exists($resultsFile)) {
    echo "\n## Test Report — Branch: {$branch}\n";
    echo "**Status:** ERROR — results.xml not found\n\n";
    echo "**PHPUnit output:**\n```\n" . substr($rawOutput, 0, 2000) . "\n```\n";
    exit(1);
}

$xml = @simplexml_load_file($resultsFile);
if (!$xml) {
    echo "\n## Test Report — Branch: {$branch}\n";
    echo "**Status:** ERROR — could not parse results.xml\n\n";
    echo "**PHPUnit output:**\n```\n" . substr($rawOutput, 0, 2000) . "\n```\n";
    exit(1);
}

// ── Parse JUnit XML ────────────────────────────────────────────────────────
$totalTests  = 0;
$passed      = 0;
$failed      = 0;
$errors      = 0;
$skipped     = 0;
$incomplete  = 0;
$failedTests = [];

// JUnit XML from PHPUnit 9 can have nested testsuites
$allTestcases = [];

function collect_testcases(SimpleXMLElement $suite, array &$out): void {
    foreach ($suite->testcase as $tc) {
        $out[] = $tc;
    }
    foreach ($suite->testsuite as $sub) {
        collect_testcases($sub, $out);
    }
}

foreach ($xml->testsuite as $suite) {
    collect_testcases($suite, $allTestcases);
}
// Also handle flat structure
foreach ($xml->testcase as $tc) {
    $allTestcases[] = $tc;
}

foreach ($allTestcases as $testcase) {
    $totalTests++;

    if (isset($testcase->failure)) {
        $failed++;
        $failedTests[] = [
            'name'    => (string) $testcase['name'],
            'class'   => (string) $testcase['classname'],
            'file'    => (string) $testcase['file'],
            'line'    => (string) $testcase['line'],
            'type'    => 'Failure',
            'message' => (string) $testcase->failure,
        ];
    } elseif (isset($testcase->error)) {
        $errors++;
        $failedTests[] = [
            'name'    => (string) $testcase['name'],
            'class'   => (string) $testcase['classname'],
            'file'    => (string) $testcase['file'],
            'line'    => (string) $testcase['line'],
            'type'    => 'Error',
            'message' => (string) $testcase->error,
        ];
    } elseif (isset($testcase->skipped)) {
        $skipped++;
    } elseif (isset($testcase->{'incomplete'})) {
        $incomplete++;
    } else {
        // Check for markTestIncomplete in the message body
        $lowerMsg = strtolower((string) ($testcase->failure ?? $testcase->error ?? ''));
        if (str_contains((string) $testcase->asXML(), 'markTestIncomplete') ||
            str_contains((string) $testcase->asXML(), 'Incomplete')) {
            $incomplete++;
        } else {
            $passed++;
        }
    }
}

// Re-count passed (incomplete are not failures)
$realPassed = $passed;

// ── Build report ───────────────────────────────────────────────────────────
$divider = str_repeat('─', 60);

$report = <<<HEADER

{$divider}
## Test Report — Branch: {$branch}
**Total tests:** {$totalTests}
**Passed:** {$realPassed}
**Failed:** {$failed}
**Errors:** {$errors}
**Skipped/Incomplete:** {$skipped + $incomplete}
{$divider}

HEADER;

if (!empty($failedTests)) {
    $report .= "### Failed tests:\n\n";
    foreach ($failedTests as $i => $test) {
        $num      = $i + 1;
        $shortFile = str_replace('/var/www/html/wp-content/plugins/thinkrank/', '', $test['file']);
        $rawMsg   = trim($test['message']);

        // Try to parse "Expected X but got Y" from PHPUnit failure messages
        $expected = '';
        $got      = '';
        if (preg_match('/Expected\s*[:\-]?\s*(.+?)(?:\n|Got|but)/si', $rawMsg, $em)) {
            $expected = trim($em[1]);
        }
        if (preg_match('/(?:Got|but got|was)\s*[:\-]?\s*(.+?)(?:\n|$)/si', $rawMsg, $gm)) {
            $got = trim($gm[1]);
        }

        $report .= "**{$num}. {$test['name']}**\n";
        $report .= "- Type: {$test['type']}\n";
        $report .= "- Class: `{$test['class']}`\n";
        if ($expected) {
            $report .= "- Expected: `" . substr($expected, 0, 120) . "`\n";
        }
        if ($got) {
            $report .= "- Got: `" . substr($got, 0, 120) . "`\n";
        }
        if (!$expected && !$got) {
            $report .= "- Details: `" . substr($rawMsg, 0, 200) . "`\n";
        }
        $report .= "- File: `{$shortFile}:{$test['line']}`\n\n";
    }
}

// ── Summary paragraph ──────────────────────────────────────────────────────
$report .= "### Summary:\n\n";

if ($failed === 0 && $errors === 0 && $totalTests > 0) {
    $autoGenNote = $incomplete > 0
        ? " ({$incomplete} auto-generated stub(s) are marked incomplete — replace them with real assertions to increase coverage)"
        : '';
    $report .= "✅ All {$realPassed} substantive tests **passed** on branch `{$branch}`.{$autoGenNote}\n";
} elseif ($totalTests === 0) {
    $report .= "⚠️  No tests were collected on branch `{$branch}`. Check that PHPUnit is configured correctly and test files exist.\n";
} else {
    // Identify failure patterns
    $patterns = [];
    foreach ($failedTests as $t) {
        $msg = strtolower($t['message']);
        if (str_contains($msg, 'could not find') || str_contains($msg, 'class not found')) {
            $patterns[] = 'missing class definitions';
        }
        if (str_contains($msg, 'call to undefined') || str_contains($msg, 'method not found')) {
            $patterns[] = 'undefined method calls';
        }
        if (str_contains($msg, 'failed asserting')) {
            $patterns[] = 'assertion mismatches';
        }
        if (str_contains($msg, 'exception') || $t['type'] === 'Error') {
            $patterns[] = 'unexpected exceptions';
        }
    }
    $patterns = array_unique($patterns);
    $patternStr = !empty($patterns)
        ? 'Noticed patterns: ' . implode(', ', $patterns) . '.'
        : '';

    $report .= "❌ Branch `{$branch}` has {$failed} failing test(s) and {$errors} error(s). ";
    $report .= "{$realPassed} test(s) passed. {$patternStr}\n";
}

$report .= "\n{$divider}\n";

// ── Output ─────────────────────────────────────────────────────────────────
echo $report;

// Save to file
$reportPath = dirname($resultsFile) . '/last-report.md';
file_put_contents($reportPath, $report);
