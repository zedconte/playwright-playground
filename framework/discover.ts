/**
 * Crawls the active site and writes `.discovery/<site>.json`: every page reached and
 * every interactive element on it. Tests in `tests/discovered/` are generated from it,
 * and the coverage dashboard measures tests against it.
 *
 *   npm run discover              # always crawl
 *   npm run discover -- --if-stale  # only when missing, expired, or the config changed
 */
import { chromium, type BrowserContext } from '@playwright/test';
import { site } from './site';
import { inPageScript } from './in-page';
import {
  applyRequestBlocking,
  fingerprint,
  keyFor,
  loadInventory,
  saveInventory,
  type CatalogEntry,
  type DiscoveredElement,
  type DiscoveredPage,
  type Inventory,
} from './inventory';

interface QueueItem {
  url: URL;
  depth: number;
  from: string | null;
}

const NON_HTML = /\.(pdf|jpe?g|png|gif|webp|svg|zip|csv|xlsx?|docx?|mp4|mp3)$/i;

function isStale(): string | null {
  const existing = loadInventory(site);
  if (!existing) return 'no inventory yet';
  if (existing.fingerprint !== fingerprint(site)) return 'site config changed';
  const ageHours = (Date.now() - Date.parse(existing.generatedAt)) / 3_600_000;
  if (ageHours > site.crawl.maxAgeHours) return `inventory is ${ageHours.toFixed(1)}h old`;
  return null;
}

function crawlable(url: URL): boolean {
  if (url.origin !== new URL(site.baseURL).origin) return false;
  if (NON_HTML.test(url.pathname)) return false;
  const href = url.href;
  if (site.crawl.exclude.some(re => re.test(href))) return false;
  if (site.crawl.include.length && !site.crawl.include.some(re => re.test(href))) return false;
  return true;
}

async function crawl(context: BrowserContext): Promise<Inventory> {
  const pages: DiscoveredPage[] = [];
  const elements: Record<string, DiscoveredElement> = {};
  const seen = new Set<string>();
  const perTemplate = new Map<string, number>();
  const queue: QueueItem[] = site.startPaths.map(p => ({ url: new URL(p, site.baseURL), depth: 0, from: null }));
  let active = 0;

  // Claims a URL for crawling; returns false if it is a duplicate or over a limit.
  const claim = (url: URL): boolean => {
    const key = site.pageKey(url);
    if (seen.has(key) || seen.size >= site.crawl.maxPages) return false;
    const template = site.pageTemplate(url);
    const count = perTemplate.get(template) ?? 0;
    if (count >= site.crawl.maxPerTemplate) return false;
    seen.add(key);
    perTemplate.set(template, count + 1);
    return true;
  };

  const visit = async ({ url, depth, from }: QueueItem) => {
    const key = site.pageKey(url);
    const entry: DiscoveredPage = {
      key,
      url: url.href,
      template: site.pageTemplate(url),
      title: '',
      status: 0,
      depth,
      discoveredFrom: from,
      elements: [],
    };
    const page = await context.newPage();
    try {
      const response = await page.goto(url.href, {
        waitUntil: 'domcontentloaded',
        timeout: site.crawl.navigationTimeout,
      });
      entry.status = response?.status() ?? 0;
      const contentType = response?.headers()['content-type'] ?? '';
      if (contentType && !contentType.includes('html')) return;

      // A redirect to a page we already have (e.g. /checkout -> /login) adds nothing new.
      const finalKey = keyFor(site, page.url());
      if (finalKey !== key) {
        entry.error = `redirected to ${page.url()}`;
        if (finalKey === null || seen.has(finalKey)) {
          pages.push(entry);
          return;
        }
      }

      await page.waitForTimeout(site.crawl.settleMs);
      entry.title = await page.title();
      const catalog = (await page.evaluate('window.__pwcov.catalog()')) as {
        elements: CatalogEntry[];
        links: string[];
      };
      for (const item of catalog.elements) {
        entry.elements.push(item.sig);
        const known = elements[item.sig];
        if (known) known.pages.push(key);
        else elements[item.sig] = { ...item, pages: [key] };
      }
      if (depth < site.crawl.maxDepth) {
        for (const href of catalog.links) {
          const next = new URL(href);
          next.hash = '';
          if (crawlable(next) && site.pageKey(next) !== key) queue.push({ url: next, depth: depth + 1, from: key });
        }
      }
      pages.push(entry);
      console.log(`  ✓ [d${depth}] ${key}  (${catalog.elements.length} elements)`);
    } catch (error) {
      entry.error = (error as Error).message.split('\n')[0];
      pages.push(entry);
      console.log(`  ✗ [d${depth}] ${key}  ${entry.error}`);
    } finally {
      await page.close();
    }
  };

  await new Promise<void>((resolve, reject) => {
    const pump = () => {
      if (!queue.length && !active) return resolve();
      while (active < site.crawl.concurrency && queue.length) {
        const item = queue.shift()!;
        if (!crawlable(item.url) || !claim(item.url)) continue;
        active++;
        visit(item)
          .catch(reject)
          .finally(() => {
            active--;
            pump();
          });
      }
      if (!queue.length && !active) resolve();
    };
    pump();
  });

  pages.sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key));
  return {
    site: site.name,
    baseURL: site.baseURL,
    generatedAt: new Date().toISOString(),
    fingerprint: fingerprint(site),
    pages,
    elements,
  };
}

async function main() {
  if (process.argv.includes('--if-stale')) {
    const reason = isStale();
    if (!reason) {
      console.log(`Discovery: inventory for "${site.name}" is fresh, skipping (npm run discover to force).`);
      return;
    }
    console.log(`Discovery: ${reason}, crawling.`);
  }

  console.log(`Discovering ${site.baseURL} (max ${site.crawl.maxPages} pages, depth ${site.crawl.maxDepth})`);
  const started = Date.now();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: site.userAgent });
    await applyRequestBlocking(context, site);
    await context.addInitScript({ content: inPageScript(site) });
    const inventory = await crawl(context);
    const file = saveInventory(site, inventory);

    const kinds: Record<string, number> = {};
    for (const el of Object.values(inventory.elements)) kinds[el.kind] = (kinds[el.kind] ?? 0) + 1;
    const ok = inventory.pages.filter(p => !p.error).length;
    console.log(
      `\nDiscovered ${ok} pages and ${Object.keys(inventory.elements).length} unique elements ` +
        `(${Object.entries(kinds)
          .map(([k, n]) => `${n} ${k}`)
          .join(', ')}) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    console.log(`Inventory written to ${file}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
