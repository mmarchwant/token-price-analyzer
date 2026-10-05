import { test, expect } from '@playwright/test';

test.describe('App Shell E2E Smoke Tests', () => {
  test('redirects root / to #/advisor, updates title and renders advisor placeholder', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/.*#\/advisor/);
    await expect(page).toHaveTitle(/AI Advisor · Token Price Analyzer/);

    const heading = page.getByRole('heading', { level: 1, name: 'AI Advisor' });
    await expect(heading).toBeVisible();
  });

  test('navigates through feature routes and updates document title', async ({ page }) => {
    await page.goto('/#/explorer');
    await expect(page).toHaveTitle(/Model Explorer · Token Price Analyzer/);
    await expect(page.getByRole('heading', { level: 1, name: 'Model Explorer' })).toBeVisible();

    await page.goto('/#/budget');
    await expect(page).toHaveTitle(/Budget Planner · Token Price Analyzer/);
    await expect(page.getByRole('heading', { level: 1, name: 'Budget Planner' })).toBeVisible();
  });

  test('switches language to PL and persists on page reload', async ({ page }) => {
    await page.goto('/');

    const langSelect = page.getByRole('combobox', { name: 'Language' });
    await langSelect.selectOption('pl');

    await expect(page.getByRole('link', { name: 'Doradca' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Eksplorator' })).toBeVisible();
    await expect(page).toHaveTitle(/Doradca AI · Token Price Analyzer/);

    // Reload page
    await page.reload();

    await expect(page.getByRole('link', { name: 'Doradca' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Eksplorator' })).toBeVisible();
  });

  test('handles unknown routes with NotFound page', async ({ page }) => {
    await page.goto('/#/unknown-route');

    await expect(
      page.getByRole('heading', { level: 1, name: /Page Not Found|Strona nie znaleziona/ }),
    ).toBeVisible();
  });
});
