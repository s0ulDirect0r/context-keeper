import { test, expect } from '@playwright/test';
import { MOCK_TRANSCRIPT } from './fixtures/mock-data';
import { mockSummarizeRoute, mockPearlsRoute } from './helpers/api-mocks';

test.describe('Guest happy path', () => {
  test('completes full flow from landing to summary', async ({ page }) => {
    // Set up API mocks before navigation
    await mockSummarizeRoute(page);
    await mockPearlsRoute(page);

    // 1. Navigate to landing page
    await page.goto('/');
    await expect(page.getByText('Cedar').first()).toBeVisible();

    // 2. Click "Try it free" to enter app mode
    await page.getByRole('button', { name: 'Try it free' }).first().click();

    // 3. See InputMethodPicker with three options
    await expect(page.getByText('Paste text')).toBeVisible();

    // 4. Click "Paste text" to enter paste flow
    await page.getByText('Paste text').click();

    // 5. See PasteTranscript with textarea
    await expect(page.getByText('Paste your transcript')).toBeVisible();

    // 6. Fill textarea
    await page
      .getByPlaceholder('Paste your meeting transcript or notes here...')
      .fill(MOCK_TRANSCRIPT);

    // 7. Click "Looks good"
    await page.getByRole('button', { name: 'Looks good' }).click();

    // 8. See ContextWizard step 1 with intent-based templates
    await expect(page.getByText('Catch me up')).toBeVisible();

    // 9. Click "Catch me up" template
    await page.getByText('Catch me up').click();

    // 10. Click "Next" to go to format selection
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // 11. See format selection step (Standard pre-selected)
    await expect(page.getByText('Choose a summary format.')).toBeVisible();

    // 12. Click "Next" to go to additional context
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // 13. See additional context step
    await expect(page.getByText('Anything else I should know?')).toBeVisible();

    // 14. Skip additional context
    await page.getByRole('button', { name: "That's all" }).click();

    // 15. Wait for SummaryView to appear (SSE mock delivers instantly)
    await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });

    // 16. Verify summary content rendered
    await expect(page.getByText('Meeting Summary')).toBeVisible();

    // 17. Verify action buttons
    await expect(page.getByRole('button', { name: /Copy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Markdown/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create another summary' })).toBeVisible();
  });
});
