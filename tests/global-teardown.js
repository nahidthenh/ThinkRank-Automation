/**
 * Run-level cleanup: sweep fixtures left behind by a crashed or killed run.
 *
 * This used to live in each @pro spec's `test.afterAll`, but the sweeps are
 * site-wide and match on a name prefix, and `fullyParallel: true` lets
 * Playwright split ONE file's tests across workers — each worker then runs its
 * own afterAll. A worker finishing its slice early therefore swept fixtures
 * that another worker was still mid-test with, deleting a redirect between its
 * create and its 301 assertion.
 *
 * A global teardown runs exactly once, after every worker has exited, so a
 * sweep can no longer race a live test. The specs still delete their own
 * fixtures inline — that stays the primary path, and this is only the net for
 * runs that died before their cleanup could execute.
 */

import { createApiContext, proGet, PRO_BASE } from './fixtures/wp-api.js';
import { isProActive } from './fixtures/pro.js';

/**
 * Each sweepable resource: where to list it, how to spot ours, and how to
 * address it for deletion.
 *
 * @type {Array<{
 *   label: string,
 *   list: string,
 *   items: (body: any) => any[],
 *   mine: (item: any) => boolean,
 *   id: (item: any) => string,
 *   path: string,
 * }>}
 */
const SWEEPS = [
  {
    label: 'custom-schema entries',
    list: '/custom-schema/entries',
    items: (body) => body?.data || [],
    mine: (e) => typeof e.title === 'string' && e.title.startsWith('TR E2E'),
    id: (e) => e.id,
    path: '/custom-schema/entries',
  },
  {
    label: 'locations',
    list: '/locations',
    items: (body) => body?.data?.items || [],
    mine: (i) => typeof i.name === 'string' && i.name.startsWith('TR E2E Location'),
    id: (i) => i.id,
    path: '/locations',
  },
  {
    label: 'rank-tracker keywords',
    list: '/rank-tracker/keywords',
    items: (body) => body?.data || [],
    mine: (k) => typeof k.keyword === 'string' && k.keyword.startsWith('tr-e2e-kw-'),
    // Keywords are addressed by hash, not by id.
    id: (k) => k.hash,
    path: '/rank-tracker/keywords',
  },
  {
    label: 'redirections',
    list: '/redirections',
    items: (body) => body?.data?.items || [],
    mine: (i) => typeof i.source_url === 'string' && i.source_url.includes('tr-e2e'),
    id: (i) => i.id,
    path: '/redirections',
  },
];

export default async function globalTeardown() {
  // Every sweep below targets a Pro route; on a Free-only site they would all
  // 404 and there is nothing this suite could have left behind anyway.
  if (!(await isProActive())) return;

  let api;
  try {
    api = await createApiContext();
  } catch {
    // No saved admin session (auth.setup failed) — nothing was created either.
    return;
  }

  let swept = 0;
  for (const s of SWEEPS) {
    try {
      const { body } = await proGet(api, s.list);
      for (const item of s.items(body)) {
        if (!s.mine(item)) continue;
        const id = s.id(item);
        if (!id) continue;
        await api.delete(`${PRO_BASE}${s.path}/${id}`);
        swept++;
      }
    } catch {
      // Teardown must never fail a run that already reported its result.
      // A leftover is swept by the next run instead.
    }
  }

  if (swept > 0) console.log(`\nglobal teardown: swept ${swept} leftover E2E fixture(s).`);

  await api.dispose();
}
