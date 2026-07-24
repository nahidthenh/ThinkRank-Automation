# ThinkRank E2E Automation

Playwright end-to-end tests for the **ThinkRank Free** and **ThinkRank Pro**
WordPress plugins. The suite is **site-agnostic** — point it at any WordPress
site that has ThinkRank Free (and optionally Pro) active by setting one env var.
See [`ROADMAP.md`](./ROADMAP.md) for coverage and phasing.

## Requirements

- Node.js 18+
- A target WordPress site with ThinkRank Free active (Pro optional — `@pro`
  tests self-skip when Pro is not installed)

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env      # then edit .env
```

`.env` (git-ignored):

```
WP_URL=https://thinkrank.test        # any site with ThinkRank Free (+ Pro)
WP_ADMIN_USER=admin
WP_ADMIN_PASS=your-admin-password
```

## Running

```bash
npm test              # fast lane — everything except the heavy editor test
npm run test:editor   # the Gutenberg metabox test, isolated (workers=1)
npm run test:all      # both, sequentially
npm run report        # open the last HTML report
```

Run a subset by tag or path:

```bash
npx playwright test --grep @free        # free-only
npx playwright test --grep @pro         # pro-only (auto-skips if Pro inactive)
npx playwright test tests/api           # REST contracts only
```

### Notes

- **Portability:** change `WP_URL` in `.env` to target a different site — no code
  changes. Delete the local site and nothing breaks.
- **Self-cleaning:** tests seed their own posts/redirects/locations and remove
  them; settings writes snapshot → change → restore.
- **Local backend concurrency:** a single local WP site (e.g. Herd) has limited
  request concurrency, so workers default to 2. Override with `WP_WORKERS=N` or
  `--workers=N` against a beefier host.

## Continuous integration (ephemeral WordPress)

`.github/workflows/e2e.yml` stands up a throwaway WordPress via
[`wp-env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/)
(`.wp-env.json`), builds + installs ThinkRank Free and Pro into it, then runs the
suite against `http://localhost:8888`.

Because the plugin `assets/`, `dist/`, and `vendor/` directories are build
outputs (git-ignored), CI checks out each plugin's **source** and builds it
(`composer install` + `pnpm run build`) before starting WordPress.

**Required repository secret:**

- `THINKRANK_TOKEN` — a GitHub token with **read** access to the private repos
  `WPDevelopers/thinkrank` and `WPDevelopers/thinkrank-pro`.

> Status: the workflow is authored but needs its first run with `THINKRANK_TOKEN`
> configured to validate end-to-end (plugin builds + wp-env boot depend on that
> access and on the plugins' build scripts succeeding in CI).

### Running the wp-env environment locally

```bash
# Put the plugin sources where .wp-env.json expects them:
mkdir -p .wp-plugins
ln -s /path/to/thinkrank     .wp-plugins/thinkrank
ln -s /path/to/thinkrank-pro .wp-plugins/thinkrank-pro

npx wp-env start                                   # http://localhost:8888
npx wp-env run cli wp plugin activate thinkrank thinkrank-pro
WP_URL=http://localhost:8888 WP_ADMIN_USER=admin WP_ADMIN_PASS=password npm test
npx wp-env stop
```

## Layout

```
tests/
  auth.setup.js         login + Free(required)/Pro(optional) precondition
  fixtures/             wp-api.js (nonce REST client) · seed.js · pro.js
  api/                  free REST contracts + security
  free/                 free admin UI (screens, settings persist, editor)
  frontend/             public SEO output (meta, JSON-LD, sitemap)
  pro/                  license, redirections, local SEO, feature contracts
  smoke.spec.js  dashboard.spec.js
```
