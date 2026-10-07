import { test, expect } from '@playwright/test';

test.describe('App Shell E2E Smoke Tests', () => {
  test('redirects root / to #/advisor, updates title and renders advisor placeholder', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/.*#\/advisor/);
    await expect(page).toHaveTitle(
      /(What should I buy this month\?|AI Advisor) · Token Price Analyzer/,
    );

    const heading = page.getByRole('heading', {
      level: 1,
      name: /What should I buy this month\?|AI Advisor/,
    });
    await expect(heading).toBeVisible();
  });

  test('navigates through feature routes and updates document title', async ({ page }) => {
    await page.goto('/#/explorer');
    await expect(page).toHaveTitle(/Model Explorer · Token Price Analyzer/);
    await expect(page.getByRole('heading', { level: 1, name: 'Model Explorer' })).toBeVisible();

    await page.goto('/#/budget');
    await expect(page).toHaveTitle(/Budget reach calculator · Token Price Analyzer/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Budget reach calculator' }),
    ).toBeVisible();
  });

  test('switches language to PL and persists on page reload', async ({ page }) => {
    await page.goto('/');

    const langSelect = page.getByRole('combobox', { name: 'Language' });
    await langSelect.selectOption('pl');

    await expect(page.getByRole('link', { name: 'Doradca' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Eksplorator' })).toBeVisible();
    await expect(page).toHaveTitle(/(Co kupić w tym miesiącu\?|Doradca AI) · Token Price Analyzer/);

    // Reload page
    await page.reload();

    await expect(page.getByRole('link', { name: 'Doradca' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Eksplorator' })).toBeVisible();
  });

  test('header does not overflow and keeps controls reachable at supported widths', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tpa-lang', 'en'));

    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/advisor');

      if (width < 1280) {
        const menuButton = page.getByRole('button', { name: 'Open main menu' });
        await menuButton.click();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Currency' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Theme' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'VAT' })).toBeVisible();
        await expect(page.getByRole('switch', { name: 'Live prices' })).toBeVisible();
      } else {
        await expect(page.getByRole('link', { name: 'Advisor' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
      }

      await expect
        .poll(() =>
          page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true);

      const language = page.getByRole('combobox', { name: 'Language' });
      await language.selectOption('pl');
      await expect(page.getByRole('link', { name: 'Doradca' })).toBeVisible();
      await expect
        .poll(() =>
          page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true);
    }
  });

  test('handles unknown routes with NotFound page', async ({ page }) => {
    await page.goto('/#/unknown-route');

    await expect(
      page.getByRole('heading', { level: 1, name: /Page Not Found|Strona nie znaleziona/ }),
    ).toBeVisible();
  });
});
