import { test, expect } from '../../framework/fixtures';
import { site } from '../../framework/site';
import { DISCOVERED_TAG, inventory, requireInventory } from '../../framework/discovered';

/** One smoke test per discovered page: it loads, has a title, no JS errors, no broken images, no drift. */
test.describe('discovered pages', { tag: DISCOVERED_TAG }, () => {
  if (!requireInventory('pages')) return;

  for (const p of inventory!.pages.filter(p => !p.error)) {
    test(`${p.key} loads cleanly`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() !== 'error') return;
        if (!site.checks.ignoreConsoleErrors.some(re => re.test(message.text()))) errors.push(message.text());
      });

      const response = await page.goto(p.url);
      expect(response?.status(), 'HTTP status').toBeLessThan(400);
      await expect(page).toHaveTitle(/\S/);

      if (site.checks.brokenImages) {
        const broken = await page
          .locator('img')
          .evaluateAll(imgs =>
            (imgs as HTMLImageElement[])
              .filter(img => img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
              .map(img => img.currentSrc || img.src),
          );
        expect.soft(broken, 'broken images').toEqual([]);
      }

      if (site.checks.drift !== 'off') {
        const { elements } = (await page.evaluate('window.__pwcov.catalog()')) as { elements: { sig: string }[] };
        const now = new Set(elements.map(e => e.sig));
        const missing = p.elements.filter(sig => !now.has(sig));
        if (site.checks.drift === 'fail') {
          expect.soft(missing, 'elements missing since discovery (re-run `npm run discover` if intended)').toEqual([]);
        } else if (missing.length) {
          testInfo.annotations.push({
            type: 'drift',
            description: `${missing.length} element(s) missing since discovery: ${missing.slice(0, 5).join(' | ')}`,
          });
        }
      }

      if (site.checks.consoleErrors) expect.soft(errors, 'console / page errors').toEqual([]);
    });
  }
});
