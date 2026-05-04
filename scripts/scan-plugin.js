#!/usr/bin/env node
/**
 * Plugin Scanner — reads the ThinkRank plugin source and produces a manifest
 * of what exists on the current branch:
 *   - Admin pages (slug, title, URL)
 *   - REST API endpoints (method, path, description)
 *   - PHP classes in includes/
 *
 * Output: test-results/plugin-manifest.json
 * This manifest drives auto-generated feature tests in tests/feature/branch-specific.spec.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PLUGIN_DIR  = path.resolve(__dirname, '../../Herd/thinkrank/wp-content/plugins/thinkrank');
const INCLUDES    = path.join(PLUGIN_DIR, 'includes');
const OUTPUT_FILE = path.resolve(__dirname, '../test-results/plugin-manifest.json');

// ── Helpers ────────────────────────────────────────────────────────────────
function readFile(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch { return ''; }
}

function walkDir(dir, ext = '.php') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, ext));
    else if (entry.isFile() && entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

// ── 1. Scan admin pages from class-manager.php ─────────────────────────────
function scanAdminPages() {
  const src = readFile(path.join(INCLUDES, 'admin', 'class-manager.php'));
  const slugs = new Set();

  // The menu_slug (4th arg to add_menu_page, 5th arg to add_submenu_page) is always:
  //   - a plain quoted string (no __() wrapper)
  //   - immediately following a 'manage_options' or 'edit_posts' capability line
  // Pattern per block: capability string on one line, then slug on the next
  const lines = src.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line.includes("'manage_options'") || line.includes("'edit_posts'")) {
      const next = lines[i + 1].trim();
      // Next line should be a bare string like 'thinkrank-...',
      const slugM = next.match(/^'(thinkrank[a-z0-9\-]*)',?\s*$/);
      if (slugM) slugs.add(slugM[1]);
    }
  }

  // Map slugs to titles
  const titles = {
    'thinkrank':               'Dashboard',
    'thinkrank-essential-seo': 'Essential SEO',
    'thinkrank-ai-tools':      'AI Tools',
    'thinkrank-settings':      'Settings',
    'thinkrank-analytics':     'Analytics',
    'thinkrank-import-export': 'Import / Export',
  };

  return [...slugs].map(slug => ({
    slug,
    url:   `/wp-admin/admin.php?page=${slug}`,
    title: titles[slug] || slug.replace('thinkrank-', '').replace(/-/g, ' '),
  }));
}

// ── 2. Scan REST endpoints from api/ ──────────────────────────────────────
function scanRestEndpoints() {
  const apiDir = path.join(INCLUDES, 'api');
  const files  = walkDir(apiDir);
  const endpoints = [];

  for (const fp of files) {
    if (path.basename(fp) === 'class-manager.php' || path.basename(fp) === 'index.php') continue;
    const src = readFile(fp);

    // Get rest_base
    const baseM = src.match(/protected\s+\$rest_base\s*=\s*['"]([^'"]+)['"]/);
    if (!baseM) continue;
    const restBase = baseM[1];

    // Extract all route strings passed to register_rest_route (handles multiline blocks)
    // Pattern: second arg is the route string (single or double quoted)
    const routeRe = /register_rest_route\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/g;
    let rm;
    const seen = new Set();

    while ((rm = routeRe.exec(src)) !== null) {
      const fullRoute = rm[1]; // e.g. /global-seo/settings or /global-seo
      // Strip the restBase prefix to get the sub-path
      const subPath = fullRoute.replace(new RegExp(`^/?${restBase}/?`), '').replace(/^\/+|\/+$/g, '');

      const apiPath = `/${restBase}${subPath ? '/' + subPath : ''}`;
      const key = apiPath;
      if (seen.has(key)) continue;
      seen.add(key);

      // Try to find the method for this route by looking nearby in the source
      const routeOffset = src.indexOf(rm[0]);
      const block = src.slice(routeOffset, routeOffset + 600);
      const methodM = block.match(/['"]methods['"]\s*=>\s*['"]?([A-Z,\s]+)['"]?/);
      const method = methodM ? methodM[1].trim().split(/[\s,]+/)[0] : 'GET';

      endpoints.push({
        file:    path.relative(PLUGIN_DIR, fp),
        restBase,
        apiPath,
        method:  method.toUpperCase(),
      });
    }

    // If no register_rest_route found but class has rest_base, add a root GET
    if (!endpoints.find(e => e.restBase === restBase)) {
      endpoints.push({
        file:    path.relative(PLUGIN_DIR, fp),
        restBase,
        apiPath: `/${restBase}`,
        method:  'GET',
      });
    }
  }

  return endpoints;
}

// ── 3. Scan classes ────────────────────────────────────────────────────────
function scanClasses() {
  const files   = walkDir(INCLUDES);
  const classes = [];

  for (const fp of files) {
    if (path.basename(fp) === 'index.php') continue;
    const src  = readFile(fp);
    const nsM  = src.match(/^namespace\s+([\w\\]+)\s*;/m);
    const clsM = src.match(/^(?:abstract\s+)?class\s+(\w+)/m);
    if (!clsM) continue;
    classes.push({
      file:      path.relative(PLUGIN_DIR, fp),
      namespace: nsM ? nsM[1] : 'ThinkRank',
      class:     clsM[1],
      fqcn:      `${nsM ? nsM[1] + '\\' : ''}${clsM[1]}`,
    });
  }

  return classes;
}

// ── 4. Detect new/changed features vs base branch ─────────────────────────
function detectFeatures() {
  // Simple heuristic: scan for feature-specific patterns in each class file
  const featureKeywords = {
    'import':       ['import', 'export', 'migrate', 'snapshot'],
    'schema':       ['schema', 'json_ld', 'structured'],
    'social':       ['og_', 'twitter', 'social', 'opengraph'],
    'sitemap':      ['sitemap', 'xml'],
    'ai':           ['claude', 'openai', 'gemini', 'ai_', 'gpt'],
    'analytics':    ['analytics', 'ga4', 'search_console'],
    'performance':  ['pagespeed', 'performance', 'core_web'],
    'author':       ['author', 'archives'],
    'image-seo':    ['image_seo', 'alt_text', 'image_title'],
    'instant-indexing': ['instant_indexing', 'google_indexing'],
  };

  const active = new Set();
  const files  = walkDir(INCLUDES);

  for (const fp of files) {
    const src = readFile(fp).toLowerCase();
    for (const [feature, kws] of Object.entries(featureKeywords)) {
      if (kws.some(kw => src.includes(kw))) {
        active.add(feature);
      }
    }
  }

  return [...active];
}

// ── Main ───────────────────────────────────────────────────────────────────
const branch = (process.argv[2] || 'unknown').trim();

const manifest = {
  branch,
  scannedAt: new Date().toISOString(),
  pluginDir: PLUGIN_DIR,
  adminPages:    scanAdminPages(),
  restEndpoints: scanRestEndpoints(),
  classes:       scanClasses(),
  activeFeatures: detectFeatures(),
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

console.log(`[scan] Branch   : ${branch}`);
console.log(`[scan] Pages    : ${manifest.adminPages.length}`);
console.log(`[scan] Endpoints: ${manifest.restEndpoints.length}`);
console.log(`[scan] Classes  : ${manifest.classes.length}`);
console.log(`[scan] Features : ${manifest.activeFeatures.join(', ')}`);
console.log(`[scan] Manifest : ${OUTPUT_FILE}`);
