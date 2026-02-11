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
  await page.getByText('Paste or upload transcript').click();
  await page.getByPlaceholder('Paste your transcript here...').fill(MOCK_TRANSCRIPT);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Handle speaker-select step (transcript has multiple speakers)
  await expect(page.getByText('Which speaker are you?')).toBeVisible();
  await page.getByRole('button', { name: 'None of these / Skip' }).click();

  await page.getByText('For my manager').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();

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
    await expect(page.getByText('Paste or upload transcript')).toBeVisible();
  });

  test('guest sees "Sign up to save this summary" button', async ({ page }) => {
    await navigateToSummary(page);

    await expect(page.getByRole('button', { name: 'Sign up to save this summary' })).toBeVisible();
  });

  test('context card shows extraction goal', async ({ page }) => {
    await navigateToSummary(page);

    await expect(page.getByText('What to extract:')).toBeVisible();
    await expect(
      page.getByText('Key decisions, blockers raised, and status updates'),
    ).toBeVisible();
  });
});
