import { test, expect } from '@playwright/test';
import { MOCK_TRANSCRIPT } from './fixtures/mock-data';
import { mockSummarizeRoute, mockPearlsRoute } from './helpers/api-mocks';

/**
 * Navigate through the guest flow up to the summary view.
 */
async function navigateToSummary(page: import('@playwright/test').Page) {
  await mockSummarizeRoute(page);
  await mockPearlsRoute(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Try it free' }).first().click();
  await page.getByText('Paste text').click();
  await page
    .getByPlaceholder('Paste your meeting transcript or notes here...')
    .fill(MOCK_TRANSCRIPT);
  await page.getByRole('button', { name: 'Looks good' }).click();

  await page.getByText('Catch me up').click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "That's all" }).click();

  await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });
}

test.describe('Summary view', () => {
  test('displays copy, markdown, and PDF buttons', async ({ page }) => {
    await navigateToSummary(page);

    await expect(page.getByRole('button', { name: /Copy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Markdown/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /PDF/ })).toBeVisible();
  });

  test('"Create another summary" resets to InputMethodPicker', async ({ page }) => {
    await navigateToSummary(page);

    await page.getByRole('button', { name: 'Create another summary' }).click();
    await expect(page.getByText('Paste text')).toBeVisible();
  });

  test('guest sees "Sign up to save this summary" button', async ({ page }) => {
    await navigateToSummary(page);

    await expect(page.getByRole('button', { name: 'Sign up to save this summary' })).toBeVisible();
  });

  test('context card shows extraction goal', async ({ page }) => {
    await navigateToSummary(page);

    await expect(page.getByText('What to extract:')).toBeVisible();
    await expect(
      page.getByText(
        'Key context, decisions, and anything the recipient would need to understand the current state',
      ),
    ).toBeVisible();
  });
});
