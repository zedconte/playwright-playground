import { test, expect } from '../../framework/fixtures';
import { site } from '../../framework/site';
import { DISCOVERED_TAG, elementsOf, inventory, requireInventory, skipLink } from '../../framework/discovered';

/**
 * Checks every discovered link target over HTTP. Each link is checked once, in the test
 * for the first page it was found on; every link element pointing at a good URL is marked verified.
 */
test.describe('discovered links', { tag: DISCOVERED_TAG }, () => {
  if (!requireInventory('links')) return;
  if (!site.checks.links.enabled) return;

  const origin = new URL(site.baseURL).origin;
  const checked = new Set<string>();

  for (const p of inventory!.pages.filter(p => !p.error)) {
    // href -> signatures of the link elements pointing at it
    const targets = new Map<string, string[]>();
    for (const el of elementsOf(inventory!, p.elements)) {
      if (el.kind !== 'link' || !el.href || el.pages[0] !== p.key) continue;
      const url = new URL(el.href);
      url.hash = '';
      if (!/^https?:$/.test(url.protocol)) continue;
      if (url.origin !== origin && !site.checks.links.external) continue;
      if (skipLink(url.href)) continue;
      targets.set(url.href, [...(targets.get(url.href) ?? []), el.sig]);
    }
    const hrefs = [...targets.keys()].filter(href => !checked.has(href));
    hrefs.forEach(href => checked.add(href));
    if (!hrefs.length) continue;

    test(`${p.key} links resolve (${hrefs.length})`, async ({ request, coverage }) => {
      const queue = [...hrefs];
      const worker = async () => {
        for (let href = queue.shift(); href; href = queue.shift()) {
          const response = await request.get(href, { failOnStatusCode: false, maxRedirects: 5 }).catch(e => e as Error);
          if (response instanceof Error) {
            expect.soft(null, `${href}: ${response.message.split('\n')[0]}`).toBeTruthy();
            continue;
          }
          expect.soft(response.status(), href).toBeLessThan(400);
          if (response.ok()) {
            // Every link element with this href counts as verified, wherever it was first seen.
            for (const el of Object.values(inventory!.elements)) {
              if (el.kind === 'link' && el.href && el.href.split('#')[0] === href) coverage.verify(el.sig);
            }
          }
        }
      };
      await Promise.all(Array.from({ length: site.checks.links.concurrency }, worker));
    });
  }
});
