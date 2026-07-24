# ThinkRank E2E Test Roadmap

Playwright end-to-end coverage for **ThinkRank Free** and **ThinkRank Pro**, run
against any live WordPress site that has the plugins active.

---

## 1. Principles

1. **Site-agnostic.** Nothing is hardcoded. The target site is `WP_URL` in `.env`.
   Delete `thinkrank.test` and point at any site with ThinkRank — tests are unchanged.
2. **Self-seeding.** Tests create the data they need (posts, terms, settings) via the
   WP/ThinkRank REST API in setup, assert, then clean up. Never assume pre-existing content.
3. **Free vs Pro gating.** Free tests run on any ThinkRank site. Pro tests **auto-skip**
   when `thinkrank-pro/v1` is not active, so the same suite is honest on a Free-only site.
4. **Two layers per feature.** API layer (fast, checks contracts) + UI layer (checks the
   admin screen renders, saves, and reflects state). Prefer API for data setup, UI for behavior.
5. **No destructive writes on shared/production sites.** Every write is scoped to test
   fixtures and reverted in teardown.

---

## 2. Test layers

| Layer | What it proves | Speed |
|-------|----------------|-------|
| **Setup / precondition** | Site reachable, Free active (required), Pro active (else skip Pro), admin login works | — |
| **API** (`tests/api/`) | Each REST endpoint: auth required, correct status, response shape, GET/POST round-trip | fast |
| **UI feature** (`tests/free/`, `tests/pro/`) | Admin page loads, React app mounts, settings save & persist, controls work | medium |
| **Frontend output** (`tests/frontend/`) | Rendered `<head>` meta, JSON-LD schema, sitemap XML, robots.txt on public pages | medium |
| **E2E flows** (`tests/flows/`) | Multi-step journeys (e.g. set focus keyword → score updates → meta appears on front) | slow |

### Proposed directory layout
```
tests/
  auth.setup.js            # login + Free(required)/Pro(optional) precondition
  fixtures/
    wp-api.js              # authed REST client, nonce handling
    seed.js                # create/delete posts, terms, reset settings
  api/                     # REST contract tests (free + pro, tagged)
  free/                    # Free admin UI feature tests
  pro/                     # Pro admin UI feature tests (tagged @pro, auto-skip)
  frontend/                # public-facing output
  flows/                   # end-to-end journeys
```

### Tagging & running subsets
Tag every test `@free` or `@pro` (plus `@api`/`@ui` optionally).
```
npm test                       # everything (Pro tests skip if Pro inactive)
npx playwright test --grep @free
npx playwright test --grep @pro
npx playwright test tests/api  # contract layer only
```

---

## 3. Coverage matrix — FREE

Feature areas map 1:1 to the plugin's REST endpoints + admin screens.

| # | Feature area | API | UI | Frontend | Priority |
|---|--------------|-----|----|----|----------|
| F1 | Dashboard | — | ✅ mounts, widgets load | — | P0 ✅ done |
| F2 | Global SEO (Essential SEO) | ✅ GET/POST settings per post_type | ✅ save & persist | ✅ title/desc/OG in `<head>` | P1 |
| F3 | Global Robots Meta | ✅ settings round-trip | ✅ toggles save | ✅ `<meta robots>` output | P1 |
| F4 | Site Identity | ✅ settings | ✅ save | ✅ org/person schema | P1 |
| F5 | Social (media + platforms) | ✅ settings | ✅ save | ✅ OG/Twitter tags | P1 |
| F6 | Schema (basic) | ✅ settings per type | ✅ save | ✅ JSON-LD present | P1 |
| F7 | Sitemap | ✅ settings | ✅ toggles | ✅ `sitemap.xml` valid & reachable | P1 |
| F8 | Image SEO | ✅ settings | ✅ save | ✅ alt/title applied | P2 |
| F9 | Author Archives | ✅ settings | ✅ save | ✅ archive noindex honored | P2 |
| F10 | Post SEO metabox / focus keyword | ✅ get/update post SEO + checks | ✅ metabox in editor, keyword input | ✅ meta on that post | P1 |
| F11 | Term SEO | ✅ get/update term SEO + checks | ✅ term edit screen | ✅ meta on term archive | P2 |
| F12 | SEO Score | ✅ score endpoint returns 0–100 + checks | ✅ score panel renders | — | P1 |
| F13 | SEO Analyzer | ✅ run + get analyzer | ✅ run from UI, results render | — | P2 |
| F14 | SEO Analytics | ✅ analytics data | ✅ charts render | — | P3 |
| F15 | Instant Indexing | ✅ settings + submit URLs (mock/guard) | ✅ settings save | — | P2 |
| F16 | LLMs.txt | ✅ settings + generate + status | ✅ generate from UI | ✅ `/llms.txt` reachable | P2 |
| F17 | Integrations | ✅ settings + test-connections | ✅ connect/disconnect UI | — | P2 |
| F18 | Settings Mgmt (import/export) | ✅ export → import round-trip | ✅ export/import buttons | — | P2 |
| F19 | AI Content Tools (brief, pillar) | ✅ generate brief, pillar content | ✅ tools screen | — | P3 |
| F20 | Performance / Usage analytics | ✅ endpoints respond | ✅ screens render | — | P3 |
| F21 | Migration (Yoast/RankMath) | ✅ detect sources, run import | ✅ migration screen | — | P3 |
| F22 | Setup Wizard | — | ✅ wizard steps complete | — | P3 |
| F23 | Roles / Capabilities | ✅ role-manager endpoint | ✅ non-admin access denied | — | P2 |
| F24 | Security (all write endpoints) | ✅ unauth POST → 401/403 | — | — | P1 |

---

## 4. Coverage matrix — PRO

All Pro tests tagged `@pro`; auto-skip when `thinkrank-pro/v1` is inactive.

| # | Feature area | API | UI | Frontend | Priority |
|---|--------------|-----|----|----|----------|
| P0 | Pro activation & license | ✅ `thinkrank-pro/v1` namespace present; license status endpoint | ✅ License screen, Pro menu items visible | — | P1 |
| P1 | Redirections | ✅ CRUD a redirect via endpoint | ✅ add/edit/delete in UI | ✅ 301 actually redirects on front | P1 |
| P2 | Broken Links | ✅ scan + list endpoint | ✅ scanner UI, results table | — | P2 |
| P3 | Internal Links | ✅ suggestions endpoint | ✅ suggestions in editor/screen | — | P2 |
| P4 | Local SEO (locations) | ✅ locations CRUD | ✅ location editor | ✅ LocalBusiness schema on front | P2 |
| P5 | Rank Tracker (keywords) | ✅ keywords CRUD + tracking data | ✅ tracker UI | — | P2 |
| P6 | Custom Schema | ✅ custom schema CRUD + file import | ✅ schema builder UI | ✅ custom JSON-LD on front | P2 |
| P7 | Advanced Sitemaps | ✅ pro sitemap settings/endpoint | ✅ settings | ✅ extra sitemaps reachable | P3 |
| P8 | WooCommerce SEO | ✅ woo endpoint (skip if Woo inactive) | ✅ product SEO fields | ✅ product schema | P3 |
| P9 | Google Analytics / Search Console | ✅ GA + URL inspection endpoints | ✅ connect flow (mock) | — | P3 |
| P10 | Top Content | ✅ top-content endpoint | ✅ report renders | — | P3 |

> WooCommerce (P8) further gates on WooCommerce being active — skip otherwise.

---

## 5. Phased rollout

Sliced **API-first**: the data/contract + public-output layers land first (fast, fully
verifiable over HTTP), then the admin UI feature tests, then Pro. Each phase is independently
green and committable.

- **Phase 0 — Foundation** ✅ *done*
  Config (env-driven, HTTPS, worker cap), auth + Free/Pro precondition, smoke, dashboard mount.
- **Phase 1 — Free data layer** ✅ *done*
  Fixtures (`wp-api.js` nonce auth, `seed.js`), Free REST contracts (F2–F7, F12), Security
  (F24), and Frontend output (F2/F3/F6/F7 head meta, JSON-LD, sitemap). 25 tests green.
- **Phase 2 — Free admin UI** *(in progress)*
  - ✅ Every free admin screen (Dashboard, Essential SEO, AI Tools, Usages, Settings) loads
    without fatal error and mounts its React app.
  - ✅ Save & persist round-trip proven for Global SEO (F2): read → save → verify persisted
    → restore original (safe, self-reverting). Same pattern extends to F3–F7 once each
    endpoint's POST contract is mapped.
  - ✅ Post-editor metabox (F10): block-editor loads the ThinkRank SEO metabox with its
    focus-keyword, SEO title, and meta-description fields. Runs in an isolated `@editor`
    lane (`npm run test:editor`) since the block editor's async metabox loader starves
    under parallel load; `npm test` excludes it.
  - ⏳ Next: extend persist round-trips to F3–F7; SEO score panel (F12 UI); analyzer run (F13).
- **Phase 3 — Free tooling**
  F8, F9, F11, F15–F18, F23. Image SEO, author archives, term SEO, indexing, llms.txt,
  integrations, import/export round-trip, roles/capabilities.
- **Phase 4 — Pro core** *(in progress)*
  - ✅ Portability wiring: precondition now requires Free only; Pro is detected
    (`fixtures/pro.js`) and every `@pro` spec self-skips when Pro is inactive.
  - ✅ Activation/license: license REST endpoint responds, License admin screen mounts,
    Pro "License" menu item present.
  - ✅ Redirections CRUD + a real 301 on the front end (create → list → 301 → toggle off
    → delete), with a self-cleaning sweep of `/tr-e2e-*` redirects.
- **Phase 5 — Pro features**
  Broken links, internal links, local SEO (+LocalBusiness schema), rank tracker, custom schema.
- **Phase 6 — Long tail**
  Analytics, AI tools, migration, wizard, WooCommerce, GA/Search Console, advanced sitemaps.
- **Phase 7 — Hardening**
  Frontend regression snapshots, cross-browser (firefox/webkit), CI wiring, flake triage.

---

## 6. Conventions

- **Fixtures over assumptions.** Use `fixtures/seed.js` to create a known post/term,
  return its ID, and delete it in `afterAll`/`afterEach`.
- **Settings safety.** Snapshot a settings group before a save test, restore after, so
  runs are idempotent and safe on staging.
- **Skip, don't fail, for missing capabilities.** Pro-inactive → skip `@pro`.
  Woo-inactive → skip Woo. Third-party keys missing → skip external-call tests.
- **Assert contracts, not exact copy.** Check status codes, response shape, and presence
  of meta/schema — avoid brittle assertions on marketing text that changes between versions.
- **One feature per file**, named after the area (`free/global-seo.spec.js`, `pro/redirections.spec.js`).

---

## 7. Definition of done (per feature)

A feature area is "covered" when it has:
1. An **API contract test** (auth + shape + round-trip where writable).
2. A **UI test** (screen loads, app mounts, a real save persists).
3. A **frontend assertion** *if* the feature emits public output (meta/schema/sitemap/redirect).
4. Fixtures that leave the site in its original state.
