# ThinkRank E2E Test Roadmap

Playwright end-to-end coverage for **ThinkRank Free** and **ThinkRank Pro**, run
against any live WordPress site that has the plugins active.

This is the **master coverage tracker** — every feature (all 201 REST routes +
admin screens + frontend output) is listed with the test dimensions it needs.
We work through it **feature by feature, deeply** (not one smoke test per area).

---

## 1. Principles

1. **Site-agnostic.** Nothing hardcoded; the target is `WP_URL` in `.env`.
2. **Self-seeding & self-restoring.** Tests create their own posts/terms/data and
   remove them; settings writes snapshot → change → verify → restore.
3. **Free vs Pro gating.** Free runs anywhere; `@pro` specs self-skip when Pro is inactive.
4. **Assert contracts + behavior**, not brittle marketing copy.
5. **No destructive writes** on shared/production sites — everything reverts.

## 2. Test dimensions (what "deep" means per feature)

For each feature we aim to cover every applicable dimension:

| Code | Dimension | Meaning |
|------|-----------|---------|
| **R** | Read contract | GET endpoints: auth required, status, response shape |
| **W** | Write round-trip | POST/PUT/DELETE: change persists, then restore/delete |
| **E** | Edge & errors | missing/invalid params → 4xx, disabled toggle, empty data, boundaries |
| **A** | Authz / roles | admin allowed; non-admin (editor/author) rejected; unauth → 401/403 |
| **U** | Admin UI | screen mounts, form fills, save via UI, tab switching, live update |
| **F** | Frontend | public output correct for the configured value (meta/schema/xml/redirect) |

Status legend: ✅ deep · 🟡 partial (contract/smoke only) · ⬜ none

## 3. Test layers & layout

```
tests/
  auth.setup.js            login + Free(required)/Pro(optional) precondition
  fixtures/                wp-api.js (nonce REST) · seed.js · pro.js
  api/                     REST contract + behavior specs
  free/                    free admin UI + write flows
  frontend/                public output
  pro/                     pro API + UI
  flows/                   multi-step journeys (to add)
```
Tags: `@free` / `@pro` (+ `@editor` for the heavy block-editor lane).

---

## 4. FREE feature coverage (31 areas · 153 routes)

> Each line: **area** (route count) — dimensions to cover — current status.

### Core SEO settings
- ✅ **global-seo** (3): `/settings` `/settings/all` `/settings/reset` — R✅(post/page/all) W✅(title/desc/schema + reset) E✅(missing/invalid post_type→400) F✅(title template renders in post `<title>`) · remaining: **A⬜(non-admin) U⬜(form save)** → roles/UI passes
- ✅ **global-robot-meta** (1): `/settings` — R✅ W✅(save) E✅(empty→400) F✅(homepage `<meta robots>` directives) · U⬜
- ✅ **site-identity** (10): `/settings` `/robots` `/validate` `/optimize` `/title/*` `/breadcrumbs/*` `/ai-optimize-*` — R✅(settings/robots/title-templates/breadcrumb-types) W✅(save) E✅(empty→400) F✅(Org/Person JSON-LD) · not run: validate/optimize/ai-optimize/generate · U⬜ · ⚠ robots.txt 404 documented via test.fail (FINDINGS #2)
- ✅ **social-media** (7): `/settings` `/preview` `/validate` `/generate-og` `/generate-twitter` `/optimize-image` `/{ctx}/{id}` — R✅(settings + per-post og_tags) W✅(settings save) E✅(empty/generate-og/preview→400) F✅(og:title/type + twitter:card) · not run: generate-twitter/optimize-image · U⬜
- ✅ **social-platforms** (1): `/settings` — R✅
- ✅ **schema** (13): `/settings` `/types` `/generate` `/validate` `/preview` `/deploy` `/deployed` `/bulk` `/optimize` `/import` `/enable-for-post` `/{ctx}/{id}` `/performance/{ctx}/{id}` — R✅(settings/types/deployed/per-post) W✅(settings save + generate) E✅(generate/preview/settings→400) F✅(post JSON-LD `@type`) · not run: deploy/bulk/optimize/import · U⬜
- ✅ **sitemap** (11): `/settings` `/generate` `/validate` `/status` `/stats` `/ping` `/submit` `/cleanup` `/custom-post-types` `/robots-urls` `/woocommerce-status` — R✅(status/stats/settings/cpt/robots-urls/woo) W✅(generate XML + settings save) E✅(empty→400) validate✅ F✅(index + per-type xml) · not run: submit/ping (external), cleanup · U⬜
- ✅ **image-seo** (3): `/settings` `/media-alt/run` `/media-alt/stats` — R✅(settings/stats) W✅(settings round-trip) · not run: media-alt/run (mutates media) · F⬜
- 🟡 **author-archives** (1): `/settings` — R✅ **W⬜ E⬜ F⬜(archive noindex honored)**
- ✅ **metadata** (1): `/metadata/{post_id}` — R✅(per-post SEO fields) · W⬜(update)
- ✅ **focus-keyword-usage** (1): `/focus-keyword-usage` — E✅(missing keyword param→400)

### SEO scoring & analysis
- ✅ **seo-score** (4): `/calculate` `/get` `/latest` `/history` — R✅(get/latest/history) W✅(calculate) E✅(missing/invalid post_id→400) · U⬜(score panel)
- ✅ **seo-analyzer** (2): `/seo-analyzer` `/run` — R✅ W✅(run returns fresh scored report) · U⬜
- ✅ **performance** (6): `/recommendations` `/opportunities` `/diagnostics` `/history` `/monitor` `/collect` — R✅(recommendations/opportunities/diagnostics/history/monitor envelopes) · collect⬜(POST/mutating) U⬜
- ✅ **seo-analytics** (14): `/status` `/dashboard` `/insights` `/opportunities` `/branded` `/countries` `/indexing-status` `/intelligent-*` `/search-daily` `/search-totals` `/refresh` `/setup/search-console` `/test-connections` — R✅(status/dashboard/indexing/branded/countries/insights/opportunities, SC-backed tolerant) E✅(search-totals no-params→400) · refresh/setup/test-connections⬜(POST/connection) U⬜
- ✅ **analytics** (3): `/overview` `/usage` `/costs` — R✅

### AI & content
- ✅ **ai** (10): `/status` `/providers` `/test-connection` `/analyze-content` `/generate-metadata` `/improve-title` `/improve-meta-description` `/add-dofollow-link` `/add-keyword-paragraph` `/explain-suggestion` — R✅(status shape + providers catalog w/ models/requires_key) E✅(generate-metadata/analyze-content missing content→400; add-keyword-paragraph missing keyword→400; no-key graceful degrade→400 success:false, self-skips when key present) · generation happy-path skipped (billable/external)
- ✅ **content-brief** (4): `/list` `/generate` `/{id}` `/{id}/export` — R✅(list returns success/data[]/total, empty-graceful w/o key) · generate/export⬜ (billable)
- ✅ **pillar-content** (1): `/suggestions` — R✅(array for real post) E✅(missing post_id→400) · self-cleaning seed post

### Indexing, llms, integrations
- ✅ **instant-indexing** (5): `/settings` `/history` `/post-types` `/submit` `/regenerate-key` — R✅(settings/history/post-types) W✅(settings save persists) · not run: submit (external), regenerate-key
- ✅ **llms-txt** (7): `/settings` `/status` `/generate` `/validate` `/overview` `/ai-optimize` `/optimization-results` — R✅(settings/status/overview) W✅(settings save) E✅(empty→400) · not run: generate (persistent file), F(`/llms.txt`)⬜
- 🟡 **integrations** (6): `/settings` `/test-connections` `/detect-ga4-conflicts` `/verify-ga4-tracking` `/search-console/sites` `/google/disconnect` — R🟡(settings) **rest⬜ W⬜**

### Data, wizard, admin, system
- ✅ **settings-management** (10): `/export` `/import` `/backup` `/restore` `/reset` `/validate` `/global` `/schema` `/category/{cat}` `/maintenance/performance-indexes` — R✅(export payload + secret redaction; schema/global reads) W✅(export→import overwrite round-trip: idempotence + mutate-flag-persists-then-restore, on a secret-free category, self-restoring w/ afterAll safety net) E✅(import missing→400, unparseable→400) · backup/restore/reset⬜(destructive) maintenance⬜
- ✅ **setup-wizard** (8): `/state` `/step` `/complete` `/consent` `/install-plugins` `/deactivate-plugin` `/migrated-plugins` `/migrated-site-data` — R✅(state flags + migrated-site-data) E✅(install-plugins missing slugs→400) · step/complete/consent/migrated-plugins/deactivate⬜(mutating; ⚠ enum NOT enforced — see FINDINGS, bad values run the handler) U⬜(wizard flow)
- ✅ **import** (migration) (6): `/snapshots` `/snapshot` `/detect` `/migrate` `/export` `/cleanup` — R✅(snapshots + detect) E✅(export/migrate/cleanup/snapshot-delete missing-required→400) · migrate/export/cleanup happy-path⬜(mutating; ⚠ enum on plugin/type NOT enforced) U⬜
- ✅ **email-report** (2): `/config` `/test-send` — R✅(config: config/capabilities/sections/tokens) · test-send⬜(sends email)
- 🟡 **role-manager** (1): `/role-manager` — R✅ **W⬜ A⬜(non-admin denied)**
- 🟡 **mcp** (7): `/mcp` `/connect` `/connection` `/disconnect` `/rotate` `/oauth/*` — R✅(connection) · connect/disconnect/rotate/oauth⬜ (mutating/auth flows)
- ✅ **settings** (1): `/settings` — R✅
- 🟡 **capabilities** (1) · 🟡 **plugin-info** (1) · 🟡 **system-status** (1) — R✅

### Cross-cutting (free)
- 🟡 **Security**: unauth → 401/403 — done for 5 endpoints; extend to all write endpoints
- ✅ **Authz/roles**: real editor user created via REST → rejected (401/403) on manage
  writes (global-seo, schema); user cleaned up. Extend to more roles/endpoints as needed.
- 🟡 **Frontend**: homepage+post meta, JSON-LD, sitemap index — **extend: robots meta values, canonical correctness, per-config schema, robots.txt, llms.txt**

---

## 5. PRO feature coverage (15 areas · 48 routes)

- ✅ **redirections** (7): `/redirections`(GET/POST) `/{id}`(POST/DELETE) `/{id}/toggle` `/404-logs` `/404-logs/{id}` `/404-logs/clear` `/from-404` — CRUD+301+toggle✅ 404-logs R✅ E✅(invalid match→400) F✅(regex redirect 301s on front) · not run: from-404/404-logs delete/clear (would mutate real logs)
- ✅ **locations** (2): `/locations` `/{id}` — CRUD✅ **update(POST /{id})⬜ E⬜ U⬜ F⬜(LocalBusiness schema)**
- 🟡 **license** (6): `/get-license` `/activate` `/deactivate` `/delete-license` `/resend-otp` `/submit-otp` — R🟡(get) U🟡(screen) **activate/deactivate flow⬜ E⬜**
- 🟡 **broken-links** (8): `/broken-links` `/scan` `/{id}` `/{id}/dismiss` `/{id}/edit` `/{id}/recheck` `/{id}/restore` `/{id}/unlink` — R🟡(list) **scan flow⬜ item actions⬜ E⬜**
- ✅ **internal-links** (4): `/post-types` `/posts` `/suggest` `/apply` — R✅(types/posts) W✅(suggest returns suggestions) · apply⬜(mutates content)
- ✅ **rank-tracker** (5): `/keywords`(GET/POST) `/keywords/{hash}` `/suggestions` `/history` `/refresh` — R✅(keywords/suggestions) W✅(add keyword → listed → delete) E✅(history without param→400) · refresh⬜(external)
- ✅ **custom-schema** (3): `/entries`(GET/POST) `/entries/{id}` `/targets` — R✅(entries/targets) W✅(create→listed→delete) E✅(invalid JSON → valid_json=false) · F⬜(custom JSON-LD needs targeting conditions)
- ✅ **google-analytics** (4): `/accounts` `/properties` `/data-streams` `/run-report` — R✅(accounts, connection-gated tolerant) · properties/data-streams/run-report⬜(connection-gated)
- ✅ **publisher-sitemaps** (1): `/settings` — R✅(config envelope) · W⬜ F⬜(news sitemap)
- ✅ **woocommerce** (1): `/settings` — R✅(config envelope) · W⬜ F⬜(product schema, gate on Woo)
- 🟡 **top-content** (1): `/top-content` — R🟡
- ✅ **keywords** (2): `/top-queries` `/winning-losing` — R✅ (Search-Console-backed, tolerant)
- ✅ **url-inspection** (2): `/status` `/batch-inspect` — R✅(status tolerant; ⚠ 403 on site_error documented as FINDINGS bug, file to `thinkrank-pro`) · batch-inspect⬜(external)
- ⬜ **schema/import-file** (1): `/schema/import-file` — **W⬜**
- 🟡 **Pro precondition/menu**: license screen + menu ✅

---

## 6. Admin screens (UI mount + interaction)

- 🟡 dashboard · essential-seo · ai-tools · usages · settings — **mount ✅; interaction (tabs, forms, save) ⬜**
- 🟡 pro **license** — mount ✅
- ⬜ **migration** screen · **setup-wizard** flow

## 7. Frontend outputs (F)

- 🟡 head meta (robots/canonical/OG/Twitter) presence — **value correctness ⬜**
- 🟡 JSON-LD present — **type/shape per schema config ⬜**
- 🟡 sitemap index xml — **per-type sitemaps, lastmod, woo ⬜**
- ⬜ robots.txt · llms.txt · breadcrumbs · redirect (regex) · LocalBusiness/product schema

---

## 8. Execution order (feature by feature, deep)

Work top-down; each feature = one comprehensive spec covering its R/W/E/A/U/F
dimensions, self-cleaning, verified green before commit. Proposed priority
(highest user-facing value + write surface first):

1. ✅ **Global SEO** — R/W/E/F done (all/reset, per-type, save+restore, title-template renders on front). A/U deferred to roles/UI passes.
2. ✅ **Sitemap** — R/W/E/F done (reads, generate XML, validate, per-type sitemap XML). submit/ping skipped (external); U deferred. ⚠ found robots.txt 404 bug (see FINDINGS.md).
3. ✅ **Schema** — R/W/E/F done (settings/types/deployed/per-post, generate, JSON-LD @type on front). deploy/bulk/optimize/import + U deferred.
4. ✅ **Social** — R/W/E/F done (settings, per-post og_tags, OG/Twitter tags on front). generate-twitter/optimize-image + U deferred.
5. ✅ **Robots meta + Site identity** — R/W/E/F done (settings, robots content, templates, head robots meta, Org/Person JSON-LD). robots.txt 404 documented (test.fail). validate/optimize + U deferred.
6. ✅ **SEO score & analyzer** — score calculate/get/latest/history + E; analyzer report/run. Score-panel U deferred.
7. ✅ **Redirections (finish)** — 404-logs read, invalid match_type E, regex redirect 301 on front. from-404/clear skipped (mutate real logs).
8. ✅ **Custom schema (Pro)** — create→listed→delete, valid_json flag. Front JSON-LD deferred (targeting conditions).
9. ✅ **Rank tracker / Internal links (Pro)** — rank-tracker add→list→delete (poll-hardened) + reads; internal-links suggest + reads. Broken-links write flows (scan/item actions) deferred (mutate real data).
10. ✅ **Instant indexing · llms.txt · image SEO** — reads + settings save round-trips (snapshot/restore) + llms empty→400. submit/generate/media-run skipped (external/persistent/mutating).
11. ✅ **Settings-management** — export→import round-trip: secret-safe, idempotent, mutate-flag-persists-then-restores (self-restoring, secret-free category, afterAll safety net). backup/restore/reset still deferred (destructive).
12. ✅ **AI tools & content** — R (status/providers/content-brief-list/pillar-suggestions) + E (missing-param 400s, no-key graceful degrade). Billable generation happy-paths skipped (self-skip when key present).
13. ✅ **Migration / Setup wizard** — safe surface only: reads (state, migrated-site-data, detect, snapshots) + required-param guards (empty write → 400, handler never runs). Happy-path steps/migrate/export/cleanup deferred (destructive). ⚠ Caught a validation gap: enum/min-max NOT enforced on these write args (bad `plugin`/`step` runs the handler & mutates) — see FINDINGS.md.
14. ✅ **Analytics / seo-analytics / performance / data reads** — remaining reads covered: seo-analytics (status/dashboard/indexing/branded/countries + search-totals E), performance (history/monitor), email-report config, setup-wizard state, import snapshots/detect; Pro reads (publisher-sitemaps, woocommerce, locations, google-analytics, url-inspection).
15. ✅ **MCP (connection) · metadata · focus-keyword-usage · keywords (Pro)** — reads/E covered.
    (schema import-file, MCP connect/oauth flows deferred — mutating/auth.)
16. 🟡 **Cross-cutting** — ✅ role/authz matrix (editor rejected on manage writes);
    ⏳ security on ALL writes, frontend value correctness, cross-browser, CI validation.

### Deferred by request (destructive / external-dependency)
- settings-management `reset/restore/import` (could wipe all settings)
- AI generation endpoints (need a real API key)
- migration `import/migrate` + setup-wizard `complete/install-plugins` (mutate the site)
- broken-links `scan` + item actions, instant-indexing `submit`, sitemap `submit/ping`,
  llms-txt `generate`, image-seo `media-alt/run` (external calls / persistent side effects)

## 9. Definition of done (per feature)

A feature is **deeply covered** when its applicable **R/W/E/A/U/F** dimensions all
have passing specs, writes self-restore, error/edge and (where relevant) non-admin
paths are asserted, and any public output is verified for the configured value —
not just presence.
