import { test, expect } from '@playwright/test';

test('has title and heading', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Token Price Analyzer/);

  const heading = page.getByRole('heading', { level: 1, name: 'Token Price Analyzer' });
  await expect(heading).toBeVisible();
});
