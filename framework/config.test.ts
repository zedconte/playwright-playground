import { describe, expect, it } from 'vitest';
import { defineSite } from './config';
import { fingerprint, keyFor } from './inventory';

describe('defineSite', () => {
  it('fills every option from the defaults', () => {
    const site = defineSite({ name: 'shop', baseURL: 'https://shop.test' });

    expect(site.title).toBe('shop');
    expect(site.startPaths).toEqual(['/']);
    expect(site.crawl.maxPages).toBe(40);
    expect(site.elements.selectors.link).toBe('a[href]');
    expect(site.checks.links.enabled).toBe(true);
  });

  it('adds profile excludes to the default safety excludes instead of replacing them', () => {
    const site = defineSite({ name: 'shop', baseURL: 'https://shop.test', crawl: { exclude: [/\/admin/] } });
    const excluded = (url: string) => site.crawl.exclude.some(re => re.test(url));

    expect(excluded('https://shop.test/admin')).toBe(true);
    expect(excluded('https://shop.test/logout')).toBe(true);
    expect(excluded('https://shop.test/delete_account')).toBe(true);
    expect(excluded('https://shop.test/products')).toBe(false);
  });

  it('merges nested options one key at a time', () => {
    const site = defineSite({
      name: 'shop',
      baseURL: 'https://shop.test',
      elements: { selectors: { button: 'button' } },
      checks: { links: { external: true } },
    });

    expect(site.elements.selectors.button).toBe('button');
    expect(site.elements.selectors.link).toBe('a[href]');
    expect(site.checks.links).toMatchObject({ external: true, enabled: true });
  });

  it('default page key and template treat numeric segments as one template', () => {
    const site = defineSite({ name: 'shop', baseURL: 'https://shop.test' });
    const url = new URL('https://shop.test/product/42?color=red');

    expect(site.pageKey(url)).toBe('/product/42?color=red');
    expect(site.pageTemplate(url)).toBe('/product/:id');
  });
});

describe('keyFor', () => {
  const site = defineSite({ name: 'shop', baseURL: 'https://shop.test', pageKey: url => url.pathname });

  it('keys same-origin URLs with the profile pageKey, including relative ones', () => {
    expect(keyFor(site, 'https://shop.test/cart?x=1')).toBe('/cart');
    expect(keyFor(site, '/cart')).toBe('/cart');
  });

  it('returns null for other origins', () => {
    expect(keyFor(site, 'https://youtube.com/watch')).toBeNull();
  });
});

describe('fingerprint', () => {
  it('changes when a discovery setting changes, so stale inventories are re-crawled', () => {
    const base = defineSite({ name: 'shop', baseURL: 'https://shop.test' });

    expect(fingerprint(base)).toBe(fingerprint(defineSite({ name: 'shop', baseURL: 'https://shop.test' })));
    expect(fingerprint(base)).not.toBe(
      fingerprint(defineSite({ name: 'shop', baseURL: 'https://shop.test', crawl: { maxDepth: 5 } })),
    );
    expect(fingerprint(base)).not.toBe(
      fingerprint(defineSite({ name: 'shop', baseURL: 'https://shop.test', pageKey: url => url.pathname })),
    );
  });

  it('ignores settings that do not affect discovery', () => {
    const base = defineSite({ name: 'shop', baseURL: 'https://shop.test' });
    const reportOnly = defineSite({ name: 'shop', baseURL: 'https://shop.test', report: { failOnThreshold: true } });
    expect(fingerprint(reportOnly)).toBe(fingerprint(base));
  });
});
