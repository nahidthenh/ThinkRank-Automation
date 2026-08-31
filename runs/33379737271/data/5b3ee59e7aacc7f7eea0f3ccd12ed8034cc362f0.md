# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pro/apply-guards.spec.js >> @pro Apply-write guards >> E: deleting a 404-log row that does not exist reports success (see FINDINGS #6)
- Location: tests/pro/apply-guards.spec.js:82:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1  | /**
  2  |  * PRO — "apply" write guards (internal links, metadata, content brief) and
  3  |  * 404-log deletion.
  4  |  *
  5  |  * These four routes were untested because they all mutate published content or
  6  |  * stored records:
  7  |  *   /internal-links/apply      → rewrites post content to insert a link
  8  |  *   /metadata/{id}/apply       → overwrites a post's SEO metadata
  9  |  *   /content-brief/insert-post → creates a post from a brief
  10 |  *   /redirections/404-logs/{id} (DELETE) → removes a log row
  11 |  *
  12 |  * Each is asserted at its guard boundary: a request with no payload (or a row
  13 |  * that cannot exist) must be rejected, so nothing on the site changes. The
  14 |  * happy paths belong on a disposable site. @pro
  15 |  */
  16 | 
  17 | import { test, expect } from '@playwright/test';
  18 | import { createApiContext, PRO_BASE } from '../fixtures/wp-api.js';
  19 | import { isProActive } from '../fixtures/pro.js';
  20 | import { createPost, deletePost } from '../fixtures/seed.js';
  21 | 
  22 | test.describe('@pro Apply-write guards', () => {
  23 |   /** @type {import('@playwright/test').APIRequestContext} */
  24 |   let api;
  25 | 
  26 |   test.beforeAll(async () => {
  27 |     test.skip(!(await isProActive()), 'ThinkRank Pro not active on the target site');
  28 |     api = await createApiContext();
  29 |   });
  30 | 
  31 |   test.afterAll(async () => {
  32 |     await api?.dispose();
  33 |   });
  34 | 
  35 |   test('E: internal-links apply without a payload → 400 (no content rewritten)', async () => {
  36 |     const resp = await api.post(`${PRO_BASE}/internal-links/apply`, { data: {} });
  37 |     expect(resp.status()).toBe(400);
  38 |     expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  39 |   });
  40 | 
  41 |   test('E: content-brief insert-post without a brief → 400 (no post created)', async () => {
  42 |     const resp = await api.post(`${PRO_BASE}/content-brief/insert-post`, { data: {} });
  43 |     expect(resp.status()).toBe(400);
  44 |     expect((await resp.json())?.code).toBe('rest_missing_callback_param');
  45 |   });
  46 | 
  47 |   // metadata/apply resolves the post in its permission callback, so a
  48 |   // non-existent post is refused at the gate rather than reaching the handler.
  49 |   test('A: metadata apply for a non-existent post is refused', async () => {
  50 |     const resp = await api.post(`${PRO_BASE}/metadata/999999/apply`, { data: {} });
  51 |     expect([400, 403, 404]).toContain(resp.status());
  52 |   });
  53 | 
  54 |   // An empty apply is a reported NO-OP, not a wipe: it answers 200 with an
  55 |   // explicit `applied: []`. This is the guard that matters — FINDINGS #3
  56 |   // documents sibling endpoints that DO clear fields on an empty payload, so
  57 |   // this test exists to catch metadata/apply ever regressing into that.
  58 |   test('W: an empty apply is a no-op and clears nothing', async () => {
  59 |     const postId = await createPost(api, { title: 'TR metadata apply guard fixture' });
  60 |     try {
  61 |       const resp = await api.post(`${PRO_BASE}/metadata/${postId}/apply`, { data: {} });
  62 |       expect(resp.status()).toBe(200);
  63 | 
  64 |       const body = await resp.json();
  65 |       expect(body?.success).toBe(true);
  66 |       expect(body?.applied, 'an empty apply must apply nothing').toEqual([]);
  67 |       expect(Number(body?.post_id)).toBe(postId);
  68 | 
  69 |       // The post itself must survive untouched.
  70 |       const check = await api.get(`/wp-json/wp/v2/posts/${postId}`);
  71 |       expect(check.status()).toBe(200);
  72 |     } finally {
  73 |       await deletePost(api, postId);
  74 |     }
  75 |   });
  76 | 
  77 |   // Current behaviour: this route answers {success:true} for ANY id — including
  78 |   // one that never existed (and id 0) — so a caller cannot tell a real delete
  79 |   // from a no-op. Broken-links' item actions 404 correctly in the same
  80 |   // situation, so the plugin is inconsistent with itself. Logged as FINDINGS #6.
  81 |   // Pinned as-is; flip to expecting 404 when that is fixed.
  82 |   test('E: deleting a 404-log row that does not exist reports success (see FINDINGS #6)', async () => {
  83 |     const resp = await api.delete(`${PRO_BASE}/redirections/404-logs/999999`);
> 84 |     expect(resp.status()).toBe(200);
     |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  85 |     expect((await resp.json())?.success).toBe(true);
  86 |   });
  87 | });
  88 | 
```