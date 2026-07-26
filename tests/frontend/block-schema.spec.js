/**
 * Phase 17 — Gutenberg block schema output (Frontend / F dimension).
 *
 * ThinkRank ships three blocks that emit structured data on the front end via a
 * server-side `render_block` filter (so KSES can't strip it):
 *   thinkrank/faq   → FAQPage
 *   thinkrank/howto → HowTo (+ HowToStep)
 *   thinkrank/toc   → SiteNavigationElement graph
 *
 * These features had ZERO coverage. Here we seed a post containing each block
 * (via the core REST API — no editor needed), fetch the PUBLIC page, parse every
 * JSON-LD script, and assert the block emitted the right schema with our data.
 * Self-cleaning. @free
 */

import { test, expect } from '@playwright/test';
import { createApiContext } from '../fixtures/wp-api.js';
import { deletePost } from '../fixtures/seed.js';

/** Extract and JSON.parse every ld+json <script> in an HTML string. */
function extractJsonLd(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

/** Flatten a schema doc into its @type-bearing nodes (handles @graph). */
function schemaNodes(docs) {
  const nodes = [];
  for (const doc of docs) {
    if (Array.isArray(doc?.['@graph'])) nodes.push(...doc['@graph']);
    nodes.push(doc);
  }
  return nodes;
}

test.describe('@free Block schema output (frontend)', () => {
  /** @type {import('@playwright/test').APIRequestContext} */
  let api;

  test.beforeAll(async () => {
    api = await createApiContext();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  /** Create a published post with the given block content and return its rendered HTML. */
  async function renderPost(title, content) {
    const resp = await api.post('/wp-json/wp/v2/posts', {
      data: { title, content, status: 'publish' },
    });
    expect(resp.status(), 'seed post created').toBe(201);
    const post = await resp.json();
    const html = await (await api.get(post.link)).text();
    return { id: post.id, link: post.link, html };
  }

  test('FAQ block emits FAQPage schema with the question and answer', async () => {
    const question = 'What does the ThinkRank FAQ block do?';
    const answer = 'It renders an accordion and FAQPage structured data.';
    const content = `<!-- wp:thinkrank/faq {"faqs":[{"question":${JSON.stringify(
      question
    )},"answer":${JSON.stringify(answer)}}]} /-->`;

    let id;
    try {
      const { id: postId, html } = await renderPost('TR FAQ block', content);
      id = postId;

      const faq = schemaNodes(extractJsonLd(html)).find((n) => n?.['@type'] === 'FAQPage');
      expect(faq, 'FAQPage schema present').toBeTruthy();

      const entities = Array.isArray(faq.mainEntity) ? faq.mainEntity : [faq.mainEntity];
      const q = entities.find((e) => e?.name === question);
      expect(q, 'Question entity present').toBeTruthy();
      expect(q['@type']).toBe('Question');
      expect(q.acceptedAnswer?.text).toContain(answer);
    } finally {
      await deletePost(api, id);
    }
  });

  test('HowTo block emits HowTo schema with a HowToStep', async () => {
    const stepTitle = 'Install ThinkRank';
    const stepText = 'Upload the plugin zip and click Activate.';
    const content = `<!-- wp:thinkrank/howto {"steps":[{"title":${JSON.stringify(
      stepTitle
    )},"text":${JSON.stringify(stepText)}}]} /-->`;

    let id;
    try {
      const { id: postId, html } = await renderPost('TR HowTo block', content);
      id = postId;

      const howto = schemaNodes(extractJsonLd(html)).find((n) => n?.['@type'] === 'HowTo');
      expect(howto, 'HowTo schema present').toBeTruthy();

      const steps = Array.isArray(howto.step) ? howto.step : [howto.step];
      const step = steps.find((s) => s?.name === stepTitle);
      expect(step, 'HowToStep present').toBeTruthy();
      expect(step['@type']).toBe('HowToStep');
      expect(step.text).toContain(stepText);
    } finally {
      await deletePost(api, id);
    }
  });

  test('TOC block emits a SiteNavigationElement graph', async () => {
    const heading = 'Getting Started';
    const anchor = 'getting-started';
    const content = `<!-- wp:thinkrank/toc {"headings":[{"content":${JSON.stringify(
      heading
    )},"anchor":${JSON.stringify(anchor)}}]} /-->`;

    let id;
    try {
      const { id: postId, link, html } = await renderPost('TR TOC block', content);
      id = postId;

      const nav = schemaNodes(extractJsonLd(html)).find(
        (n) => n?.['@type'] === 'SiteNavigationElement'
      );
      expect(nav, 'SiteNavigationElement present').toBeTruthy();
      expect(nav.name).toBe(heading);
      expect(nav.url).toBe(`${link}#${anchor}`);
    } finally {
      await deletePost(api, id);
    }
  });
});
