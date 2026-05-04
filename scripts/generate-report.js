#!/usr/bin/env node
/**
 * Reads test-results/playwright-results.json and prints the formatted test report.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const branch      = process.argv[2] || 'unknown';
const resultsFile = process.argv[3] || path.resolve(__dirname, '../test-results/playwright-results.json');
const divider     = '─'.repeat(60);

if (!fs.existsSync(resultsFile)) {
  console.log(`\n${divider}`);
  console.log(`## Test Report — Branch: ${branch}`);
  console.log('**Status:** ERROR — no results file found');
  console.log(divider);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

// ── Aggregate counts ────────────────────────────────────────────────────────
let total = 0, passed = 0, failed = 0, skipped = 0;
const failedTests = [];

function processSpec(spec) {
  for (const test of (spec.tests || [])) {
    for (const result of (test.results || [])) {
      total++;
      if (result.status === 'passed') {
        passed++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        // failed or timed out
        if (!test.results.some(r => r.status === 'passed')) {
          // Only count as failed if it never passed on any retry
          failed++;
          const errors = result.errors || [];
          const errMsg = errors.map(e => (e.message || '').replace(/\x1B\[[0-9;]*m/g, '')).join('\n').trim();
          failedTests.push({
            title:   test.title,
            suite:   spec.file ? path.relative(process.cwd(), spec.file) : 'unknown',
            line:    test.line,
            error:   errMsg.slice(0, 300),
          });
        } else {
          // Passed on retry — count as passed
          passed++;
          failed--;
          total--;
        }
      }
    }
  }
}

function walk(suite) {
  for (const spec of (suite.specs || [])) {
    processSpec(spec);
  }
  for (const sub of (suite.suites || [])) {
    walk(sub);
  }
}

for (const suite of (results.suites || [])) {
  walk(suite);
}

// ── Build report ────────────────────────────────────────────────────────────
const lines = [];
lines.push('');
lines.push(divider);
lines.push(`## Test Report — Branch: ${branch}`);
lines.push(`**Total tests:** ${total}`);
lines.push(`**Passed:** ${passed}`);
lines.push(`**Failed:** ${failed}`);
lines.push(`**Skipped:** ${skipped}`);
lines.push(divider);

if (failedTests.length > 0) {
  lines.push('');
  lines.push('### Failed tests:');
  lines.push('');
  failedTests.forEach((t, i) => {
    lines.push(`**${i + 1}. ${t.title}**`);
    lines.push(`- Suite: \`${t.suite}\``);
    if (t.error) {
      // Extract "Expected ... Received ..." lines if present
      const expectedM = t.error.match(/Expected[:\s]+([^\n]+)/i);
      const receivedM = t.error.match(/Received[:\s]+([^\n]+)/i);
      if (expectedM) lines.push(`- Expected: \`${expectedM[1].trim()}\``);
      if (receivedM) lines.push(`- Got:      \`${receivedM[1].trim()}\``);
      if (!expectedM && !receivedM) {
        lines.push(`- Error: \`${t.error.split('\n')[0]}\``);
      }
    }
    lines.push('');
  });
}

// ── Summary ─────────────────────────────────────────────────────────────────
lines.push('### Summary:');
lines.push('');

if (failed === 0 && total > 0) {
  lines.push(`✅ All ${passed} feature tests **passed** on branch \`${branch}\`. The plugin is working correctly.`);
} else if (total === 0) {
  lines.push(`⚠️  No tests were collected. Check that the plugin is active and the manifest was generated.`);
} else {
  // Categorize failures
  const apiFailures = failedTests.filter(t => t.suite.includes('/api/')).length;
  const uiFailures  = failedTests.filter(t => t.suite.includes('/feature/')).length;
  const parts = [];
  if (apiFailures > 0) parts.push(`${apiFailures} REST API endpoint(s) broken`);
  if (uiFailures  > 0) parts.push(`${uiFailures} admin page(s) failing`);
  const summary = parts.length > 0 ? parts.join(', ') : `${failed} test(s) failing`;

  lines.push(`❌ Branch \`${branch}\` has ${failed} failing test(s). ${summary}. ${passed} test(s) passed.`);
}

lines.push('');
lines.push(divider);

const report = lines.join('\n');
console.log(report);

// Save report
const reportPath = path.join(path.dirname(resultsFile), 'last-report.md');
fs.writeFileSync(reportPath, report);
