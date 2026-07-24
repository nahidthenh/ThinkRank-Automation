/**
 * Self-seeding helpers.
 *
 * Tests must not assume a site already has content — on a fresh ThinkRank site
 * it won't. These create the fixtures a test needs via the WP core REST API
 * (nonce-authenticated) and clean them up afterward, so runs are idempotent and
 * safe on any target site.
 */

/**
 * Create a published post and return its id.
 * @param {import('@playwright/test').APIRequestContext} ctx  authed context from createApiContext()
 * @param {{title?: string, content?: string, status?: string}} [opts]
 * @returns {Promise<number>} post id
 */
export async function createPost(ctx, opts = {}) {
  const resp = await ctx.post('/wp-json/wp/v2/posts', {
    data: {
      title: opts.title || `TR E2E post ${uniqueSuffix()}`,
      content: opts.content || 'Automated test content for ThinkRank E2E.',
      status: opts.status || 'publish',
    },
  });
  if (!resp.ok()) {
    throw new Error(`createPost failed: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  return body.id;
}

/**
 * Permanently delete a post (skip trash). Safe to call in teardown.
 */
export async function deletePost(ctx, id) {
  if (!id) return;
  await ctx.delete(`/wp-json/wp/v2/posts/${id}?force=true`);
}

/**
 * A stable-ish unique suffix without Date.now()/Math.random (which are fine in
 * tests, but this keeps labels readable). Uses high-res time.
 */
function uniqueSuffix() {
  return `${process.pid}-${process.hrtime.bigint().toString().slice(-6)}`;
}
