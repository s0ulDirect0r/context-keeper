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

    // 3. See InputMethodPicker
    await expect(page.getByText('Paste or upload transcript')).toBeVisible();

    // 4. Click "Paste or upload transcript"
    await page.getByText('Paste or upload transcript').click();

    // 5. See ManualTranscript with textarea
    await expect(page.getByPlaceholder('Paste your transcript here...')).toBeVisible();

    // 6. Fill textarea
    await page.getByPlaceholder('Paste your transcript here...').fill(MOCK_TRANSCRIPT);

    // 7. Click "Continue"
    await page.getByRole('button', { name: 'Continue' }).click();

    // 7b. Handle speaker-select step (transcript has multiple speakers)
    await expect(page.getByText('Which speaker are you?')).toBeVisible();
    await page.getByRole('button', { name: 'None of these / Skip' }).click();

    // 8. See ContextWizard step 1 with template buttons
    await expect(page.getByText('What do you want to extract from this recording?')).toBeVisible();

    // 9. Click "For my manager" template
    await page.getByText('For my manager').click();

    // 10. Click "Continue"
    await page.getByRole('button', { name: 'Continue' }).click();

    // 11. See ContextWizard step 2
    await expect(page.getByText('Any other relevant context?')).toBeVisible();

    // 12. Skip additional context
    await page.getByRole('button', { name: 'Skip' }).click();

    // 13. Wait for SummaryView to appear (SSE mock delivers instantly)
    await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });

    // 14. Verify summary content rendered
    await expect(page.getByText('Meeting Summary')).toBeVisible();

    // 15. Verify action buttons
    await expect(page.getByRole('button', { name: /Copy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Markdown/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create another summary' })).toBeVisible();
  });
});
