import { test, expect } from '../../../framework/fixtures';

test('contact form submits after confirmation', async ({ page }) => {
  await page.goto('/contact_us');
  await page.locator('[data-qa="name"]').fill('Pat Playwright');
  await page.locator('[data-qa="email"]').fill('pw.tester@example.com');
  await page.locator('[data-qa="subject"]').fill('Coverage demo');
  await page.locator('[data-qa="message"]').fill('Sent by an automated Playwright test.');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-qa="submit-button"]').click();

  await expect(page.locator('.status')).toHaveText('Success! Your details have been submitted successfully.');
});
