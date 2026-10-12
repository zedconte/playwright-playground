import { test, expect } from '../../framework/fixtures';

test.describe('cart', () => {
  test('adds a product with a quantity and shows it in the cart', async ({ page }) => {
    await page.goto('/product_details/1');
    const name = (await page.locator('.product-information h2').textContent())!.trim();

    await page.locator('#quantity').fill('3');
    await page.getByRole('button', { name: 'Add to cart' }).click();

    const modal = page.locator('#cartModal');
    await expect(modal).toContainText('Your product has been added to cart.');
    await modal.getByRole('link', { name: 'View Cart' }).click();

    await expect(page).toHaveURL(/\/view_cart/);
    const row = page.locator('#cart_info_table tbody tr').filter({ hasText: name });
    await expect(row.locator('.cart_quantity')).toHaveText('3');
  });

  test('adds from the product grid and continues shopping', async ({ page }) => {
    await page.goto('/products');
    await page.locator('.productinfo [data-product-id="2"]').click();

    const modal = page.locator('#cartModal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Continue Shopping' }).click();
    await expect(modal).toBeHidden();
  });

  test('empty cart points back to products', async ({ page }) => {
    await page.goto('/view_cart');
    await expect(page.locator('#empty_cart')).toContainText('Cart is empty!');
    await page.locator('#empty_cart').getByRole('link', { name: 'here' }).click();
    await expect(page).toHaveURL(/\/products/);
  });
});
