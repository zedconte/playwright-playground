import { test, expect } from '../../framework/fixtures';

test.describe('account', () => {
  test('rejects an unknown login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="login-email"]').fill('nobody.pw@example.com');
    await page.locator('[data-qa="login-password"]').fill('not-the-password');
    await page.locator('[data-qa="login-button"]').click();

    await expect(page.getByText('Your email or password is incorrect!')).toBeVisible();
  });

  test('signup starts account details for a new email', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="signup-name"]').fill('Pat Playwright');
    // Unique per run so the "email already exists" branch is never hit. No account is created.
    await page.locator('[data-qa="signup-email"]').fill(`pw.${Date.now()}@example.com`);
    await page.locator('[data-qa="signup-button"]').click();

    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText('Enter Account Information')).toBeVisible();
  });
});
