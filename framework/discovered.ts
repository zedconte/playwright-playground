/** Helpers shared by the generated suites in `tests/discovered/`. */
import { test } from './fixtures';
import { site } from './site';
import { loadInventory, type DiscoveredElement, type FormField, type Inventory } from './inventory';
import { DISCOVERED_TAG } from './reporter/model';

export { DISCOVERED_TAG };

export const inventory: Inventory | null = loadInventory(site);

/** Registers a skipped placeholder when there is no inventory, so the suite explains itself instead of vanishing. Call inside a tagged describe. */
export function requireInventory(suite: string): boolean {
  if (inventory) return true;
  test(`${suite}: inventory available`, () => {
    test.skip(true, `No inventory for "${site.name}". Run \`npm run discover\` first.`);
  });
  return false;
}

export function elementsOf(inv: Inventory, keys: string[]): DiscoveredElement[] {
  return keys.map(sig => inv.elements[sig]).filter(Boolean);
}

/** URLs the link checker must never request: crawl excludes (logout, delete…) plus link ignores. */
export function skipLink(href: string): boolean {
  return [...site.crawl.exclude, ...site.checks.links.ignore].some(re => re.test(href));
}

export function sampleValue(field: FormField): string {
  if (field.type === 'number') return '1';
  if (field.type === 'date') return '2026-01-15';
  const haystack = `${field.name} ${field.type ?? ''} ${field.placeholder} ${field.label}`;
  return site.checks.forms.sampleValues.find(s => s.match.test(haystack))?.value ?? site.checks.forms.fallbackValue;
}
