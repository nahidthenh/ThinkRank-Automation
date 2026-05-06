# Yoast SEO → ThinkRank Migration Test Report

**Date:** 2026-05-06  
**ThinkRank Version:** 1.9.0 (plugin: `thinkrank-1`)  
**Yoast SEO Version:** 27.5 (plugin: `wordpress-seo`)  
**Test Post ID:** 45 — *"Yoast SEO Migration Test Post"*  
**Test Category:** SEO Tips (ID: 3) | **Test Tag:** migration-test (ID: 4)  
**Migration Method:** Two-phase (Export Snapshot → Start Migration) via ThinkRank Import/Export UI  

---

## Migration Flow Summary

| Step | Action | Result |
|------|--------|--------|
| 1 | Deactivate all plugins | ✅ All deactivated |
| 2 | Activate Yoast SEO | ✅ Activated |
| 3 | Configure global Yoast settings | ✅ All 4 option groups set |
| 4 | Create test post + category + tag | ✅ Post ID 45, Cat ID 3, Tag ID 4 |
| 5 | Set all per-page Yoast SEO meta | ✅ 17 meta fields written |
| 6 | Activate ThinkRank | ✅ Activated alongside Yoast |
| 7 | Export Snapshot (UI: Export Selected Data → Start Export) | ✅ Exported at 09:47 AM — 4 postmeta records, 1 settings record |
| 8 | Start Migration (UI) | ⚠️ UI button ran but used old snapshot (09:33); post 45 was skipped |
| 8b | Migration via PHP direct call (fix) | ✅ 1 processed (post 45), 3 skipped (already migrated) |
| 9 | Verify DB post-migration | ✅ All mapped fields confirmed in `_thinkrank_*` meta |

> **UI Bug Note:** The Playwright automation clicked "Start Migration" and the UI showed "complete" — but this reflected the *previous* migration run (09:33 AM). The React app does not visually distinguish a fresh migration from an already-completed one. The migration itself is correct when triggered; the UI feedback is misleading.

---

## Per-Page Meta Migration — Post 45

### ✅ Migrated Successfully

| Yoast Meta Key | Yoast Value | ThinkRank Meta Key | ThinkRank Value | Match |
|---|---|---|---|---|
| `_yoast_wpseo_title` | `Yoast Migration Test \| Custom SEO Title \| ThinkRank` | `_thinkrank_seo_title` | `Yoast Migration Test \| Custom SEO Title \| ThinkRank` | ✅ Exact |
| `_yoast_wpseo_metadesc` | `This is a custom meta description set in Yoast SEO for migration testing purposes. It contains 155 characters of test content.` | `_thinkrank_meta_description` | *(same)* | ✅ Exact |
| `_yoast_wpseo_focuskw` | `yoast seo migration test` | `_thinkrank_focus_keyword` | `yoast seo migration test` | ✅ Exact |
| `_yoast_wpseo_canonical` | `http://localhost:8080/yoast-seo-migration-test-post/` | `_thinkrank_canonical_url` | `http://localhost:8080/yoast-seo-migration-test-post/` | ✅ Exact |
| `_yoast_wpseo_opengraph-image` | `http://localhost:8080/wp-content/uploads/2026/05/test-og-image.jpg` | `_thinkrank_og_image` | *(same)* | ✅ Exact |
| `_yoast_wpseo_opengraph-title` | `OG Title: Yoast Migration Test Post` | `_thinkrank_og_title` | `OG Title: Yoast Migration Test Post` | ✅ Exact |
| `_yoast_wpseo_opengraph-description` | `OG Description: This post is used to test migration from Yoast SEO to ThinkRank plugin.` | `_thinkrank_og_description` | *(same)* | ✅ Exact |
| `_yoast_wpseo_twitter-image` | `http://localhost:8080/wp-content/uploads/2026/05/test-og-image.jpg` | `_thinkrank_twitter_image` | *(same)* | ✅ Exact |
| `_yoast_wpseo_twitter-title` | `Twitter Title: Yoast Migration Test Post` | `_thinkrank_twitter_title` | `Twitter Title: Yoast Migration Test Post` | ✅ Exact |
| `_yoast_wpseo_twitter-description` | `Twitter Description: Testing Yoast to ThinkRank migration.` | `_thinkrank_twitter_description` | `Twitter Description: Testing Yoast to ThinkRank migration.` | ✅ Exact |
| `_yoast_wpseo_schema_page_type` | `WebPage` | `_thinkrank_selected_schema_type` | `WebPage` | ✅ Exact |
| `_yoast_wpseo_meta-robots-noindex` | `0` (index) | `_thinkrank_robots_meta` (JSON) | `{"noindex":false,"nofollow":false,"noarchive":false,"noimageindex":false,"nosnippet":false,"index":true}` | ✅ Correct (JSON composed) |
| `_yoast_wpseo_meta-robots-nofollow` | `0` (follow) | *(included in robots JSON above)* | `"nofollow":false` | ✅ Correct |
| — | *(audit trail)* | `_thinkrank_imported_from` | `yoast` | ✅ Written |

**Migrated: 14/17 Yoast fields → 14 ThinkRank meta keys** *(some Yoast fields combine into one ThinkRank key)*

---

### ❌ Not Migrated — Missing from ThinkRank

| Yoast Meta Key | Yoast Value | Reason Not Migrated |
|---|---|---|
| `_yoast_wpseo_schema_article_type` | `Article` | Stored in `extended[]` (not in `META_MAP`). Snapshot preserves it but migrator explicitly skips `extended`. No ThinkRank key currently mapped. |
| `_yoast_wpseo_opengraph-image-id` | `46` | In `extended[]` — image ID not migrated. ThinkRank uses URL only. |
| `_yoast_wpseo_twitter-image-id` | `46` | In `extended[]` — same as above. |

---

## Global Settings Migration

### ✅ Migrated Successfully

| Setting | Yoast Source | ThinkRank Option | ThinkRank Value | Match |
|---|---|---|---|---|
| Title separator | `sc-dash` (wpseo_titles) | `thinkrank_global_seo_settings[separator]` | `-` (normalized) | ✅ Correct (dash converted) |
| Homepage title | `ThinkRank Test Site - %%sitedesc%%` | `thinkrank_site_identity_settings[homepage_title]` | `ThinkRank Test Site -` | ⚠️ Partial (template var `%%sitedesc%%` stripped) |
| Social: LinkedIn | `https://linkedin.com/company/thinkrank` | `thinkrank_social_media_settings[linkedin]` | `https://linkedin.com/company/thinkrank` | ✅ Exact |
| Social: YouTube | `https://youtube.com/thinkrank` | `thinkrank_social_media_settings[youtube]` | `https://youtube.com/thinkrank` | ✅ Exact |

### ⚠️ Not Migrated — Pre-existing ThinkRank Data Blocked Overwrite

> ThinkRank's migrator rule: **"Never overwrite existing ThinkRank data"**. The following settings already existed in ThinkRank and were NOT overwritten.

| Setting | Yoast Value | ThinkRank Existing Value | Action Taken |
|---|---|---|---|
| Homepage description | *(empty)* | `Welcome to our test site` | Skipped (Yoast was empty) |
| Organization name | *(empty — wpseo company_name was blank)* | `Test Company` | Skipped (Yoast was empty) |
| Social: Facebook | `https://facebook.com/thinkrank` | `https://facebook.com/testcompany` | ❌ Not overwritten (existing ThinkRank value kept) |
| Social: Twitter | `thinkrank` | `testcompany` | ❌ Not overwritten (existing ThinkRank value kept) |

### ❌ Not Migrated — No ThinkRank Mapping

| Yoast Setting | Yoast Value | Reason |
|---|---|---|
| Breadcrumbs (enabled, home label, separator) | `true`, `Home`, `>>` | No ThinkRank option key for breadcrumb settings |
| XML Sitemap settings | `enabled=true`, `1000 per page` | No ThinkRank sitemap option mapped |
| Social: Instagram, Pinterest, Wikipedia | *(empty)* | Empty, skipped |
| Site type | `blog` | No ThinkRank mapping |
| Company/person type | `organization`, `ThinkRank Inc` | wpseo company_name was empty at export time |
| OG frontpage title/desc | `ThinkRank - AI-Native SEO` / `ThinkRank is an AI-native...` | In `extended[]`, not mapped to ThinkRank option |
| Post type title templates | `%%title%% %%page%% %%sep%% %%sitename%%` (post, page, attachment) | No ThinkRank per-post-type template option |
| Taxonomy title templates | `%%term_title%% Archives...` (category, post_tag) | No ThinkRank per-taxonomy template option |
| Verification codes | Google, Bing, Yandex (all empty) | Empty, skipped |
| Archive noindex settings | date=false, author=false | Both false, nothing to migrate |

---

## Summary Scorecard

### Per-Page Meta (Post-Level)

| Category | Count | Status |
|---|---|---|
| Fully migrated (exact match) | 11 | ✅ |
| Migrated (transformed — robots JSON composed) | 2 | ✅ |
| Audit trail written | 1 | ✅ |
| Not migrated (in `extended[]`, no ThinkRank key) | 3 | ❌ |
| **Total Yoast fields tested** | **17** | |
| **Migration success rate** | **82%** | |

### Global Settings

| Category | Count | Status |
|---|---|---|
| Migrated successfully | 4 | ✅ |
| Partially migrated (template vars stripped) | 1 | ⚠️ |
| Blocked by existing ThinkRank data (no overwrite) | 4 | ⚠️ |
| No ThinkRank mapping exists | 12 | ❌ |
| **Total Yoast global settings tested** | **21** | |
| **Migration success rate** | **19%** | |

---

## Issues & Recommendations

### Bug / UX Issues

1. **UI false-positive on "Migration complete"** — After clicking "Start Migration", the React UI displayed "Status: complete" which was carried over from a previous migration run. There is no distinct visual indicator that a *new* migration just completed vs. the old status. The migration UI should refresh the snapshot details panel after a successful REST call to show the new `last_migrated` timestamp.

2. **"Export Selected Data" → "Start Export" flow unclear** — Clicking "Export Selected Data" opens the checkboxes, but "Start Export" is a separate button that is visible only after. In Playwright automation, `page.waitForSelector` found the old "complete" text before the new export could update the UI, causing the migration step to run on the old snapshot. The export + migrate flow needs either a loading state or a page refresh after export before the migrate button is clickable.

### Missing Mappings (Recommended Additions)

| Missing Field | Yoast Key | Suggested ThinkRank Key |
|---|---|---|
| Schema article type | `_yoast_wpseo_schema_article_type` | `_thinkrank_schema_article_type` |
| OG image attachment ID | `_yoast_wpseo_opengraph-image-id` | `_thinkrank_og_image_id` |
| Twitter image attachment ID | `_yoast_wpseo_twitter-image-id` | `_thinkrank_twitter_image_id` |
| Breadcrumb title | `_yoast_wpseo_bctitle` | `_thinkrank_breadcrumb_title` |
| Cornerstone content flag | `_yoast_wpseo_is_cornerstone` | `_thinkrank_is_cornerstone` |
| Breadcrumb global settings | `wpseo_titles[breadcrumbs-*]` | `thinkrank_breadcrumb_settings` |
| OG frontpage title/desc | `wpseo_social[og_frontpage_title/desc]` | `thinkrank_site_identity_settings` |

### Settings Overwrite Policy
The "never overwrite" rule protects existing ThinkRank data but prevents correcting pre-set placeholder values (e.g. `testcompany` was not updated to the real Yoast `thinkrank` value). Consider adding an "overwrite existing settings" toggle option in the migration UI.

---

*Report generated: 2026-05-06 | ThinkRank Automation Suite*
