import { test, expect } from '../../../framework/fixtures';

test.describe('navigation', () => {
  test('browses a category from the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="#Women"]').click();
    await page.locator('#Women').getByRole('link', { name: 'Dress' }).click();

    await expect(page).toHaveURL(/\/category_products\/1/);
    await expect(page.getByRole('heading', { name: /Women - Dress Products/i })).toBeVisible();
  });

  test('browses a brand', async ({ page }) => {
    await page.goto('/products');
    await page.locator('.brands-name').getByRole('link', { name: /Polo/ }).click();

    await expect(page).toHaveURL(/\/brand_products\/Polo/);
    await expect(page.getByRole('heading', { name: /Brand - Polo Products/i })).toBeVisible();
  });

  test('header links reach the main sections', async ({ page }) => {
    await page.goto('/');
    for (const [name, url] of [
      ['Products', /\/products/],
      ['Cart', /\/view_cart/],
      ['Signup / Login', /\/login/],
      ['Contact us', /\/contact_us/],
    ] as const) {
      await page.locator('#header').getByRole('link', { name }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('footer subscription confirms', async ({ page }) => {
    await page.goto('/');
    await page.locator('#susbscribe_email').fill('pw.tester@example.com');
    await page.locator('#subscribe').click();
    await expect(page.locator('#success-subscribe')).toContainText('You have been successfully subscribed!');
  });
});
