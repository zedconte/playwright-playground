import { test, expect } from '../../../framework/fixtures';

test.describe('product search', () => {
  test('finds products matching a term', async ({ page }) => {
    await page.goto('/products');
    await page.locator('#search_product').fill('top');
    await page.locator('#submit_search').click();

    await expect(page).toHaveURL(/search=top/);
    await expect(page.getByRole('heading', { name: 'Searched Products' })).toBeVisible();
    await expect(page.locator('.features_items .productinfo').first()).toBeVisible();
  });

  test('opens a product from the results', async ({ page }) => {
    await page.goto('/products?search=jeans');
    await page.locator('.features_items a[href^="/product_details/"]').first().click();

    await expect(page).toHaveURL(/\/product_details\/\d+/);
    await expect(page.locator('.product-information h2')).toContainText(/jeans/i);
  });
});
