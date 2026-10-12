import { test, expect } from '../../framework/fixtures';
import { site } from '../../framework/site';
import { DISCOVERED_TAG, inventory, requireInventory, sampleValue } from '../../framework/discovered';

/**
 * For every discovered form: every field is visible, enabled and accepts input.
 * Forms are never submitted here; submission belongs in authored flows with real assertions.
 */
test.describe('discovered forms', { tag: DISCOVERED_TAG }, () => {
  if (!requireInventory('forms')) return;
  if (!site.checks.forms.enabled) return;

  const forms = Object.values(inventory!.elements).filter(
    el => el.kind === 'form' && el.fields?.length && !site.checks.forms.ignore.some(re => re.test(el.sig)),
  );

  for (const form of forms) {
    const host = inventory!.pages.find(p => p.key === form.pages[0])!;

    test(`${form.sig} accepts input on ${host.key}`, async ({ page }) => {
      await page.goto(host.url);
      await expect(page.locator(form.selector).first()).toBeVisible();

      for (const field of form.fields!) {
        const control = page.locator(field.selector).first();

        await test.step(field.sig, async () => {
          await expect(control).toBeVisible();
          await expect(control).toBeEnabled();
          switch (field.kind) {
            case 'input':
              if (field.type === 'checkbox' || field.type === 'radio') {
                await control.check();
                await expect(control).toBeChecked();
              } else if (field.type === 'file') {
                await control.setInputFiles({
                  name: 'playwright.txt',
                  mimeType: 'text/plain',
                  buffer: Buffer.from('hi'),
                });
              } else {
                const value = sampleValue(field);
                await control.fill(value);
                await expect(control).toHaveValue(value);
              }
              break;
            case 'textarea': {
              const value = sampleValue(field);
              await control.fill(value);
              await expect(control).toHaveValue(value);
              break;
            }
            case 'select': {
              const options = await control
                .locator('option')
                .evaluateAll(opts => (opts as HTMLOptionElement[]).map(o => o.value).filter(Boolean));
              if (options.length) await control.selectOption(options[options.length > 1 ? 1 : 0]);
              break;
            }
            // Buttons are only checked for visibility and enabled state: clicking would submit.
          }
        });
      }
    });
  }
});
