import { test, expect } from '@playwright/test';
import { MOCK_TRANSCRIPT, MOCK_SUMMARY_MARKDOWN, MOCK_TAGS } from './fixtures/mock-data';

/**
 * Mock /api/summarize with a savedSummaryId, simulating an auto-saved summary.
 */
async function mockSummarizeWithSave(page: import('@playwright/test').Page) {
  await page.route('**/api/summarize', async (route) => {
    const events = [
      `event: summary_chunk\ndata: ${JSON.stringify({ text: MOCK_SUMMARY_MARKDOWN })}\n\n`,
      `event: summary_done\ndata: ${JSON.stringify({ summaries: [MOCK_SUMMARY_MARKDOWN] })}\n\n`,
      `event: tags_extracting\ndata: ${JSON.stringify({})}\n\n`,
      `event: tags_done\ndata: ${JSON.stringify({ tags: MOCK_TAGS })}\n\n`,
      `event: complete\ndata: ${JSON.stringify({ summaries: [MOCK_SUMMARY_MARKDOWN], tags: MOCK_TAGS, savedSummaryId: 'test-summary-id' })}\n\n`,
    ];

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: events.join(''),
    });
  });
}

async function mockPearls(page: import('@playwright/test').Page) {
  await page.route('**/api/pearls/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pearls: [] }),
    });
  });
}

async function navigateToSummary(page: import('@playwright/test').Page) {
  await mockSummarizeWithSave(page);
  await mockPearls(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Try it free' }).first().click();
  await page.getByText('Paste text').click();
  await page
    .getByPlaceholder('Paste your meeting transcript or notes here...')
    .fill(MOCK_TRANSCRIPT);
  await page.getByRole('button', { name: 'Looks good' }).click();

  await page.getByText('Catch me up').click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // Format step — Standard is pre-selected, click Next to skip
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "That's all" }).click();

  await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });
}

test.describe('Vault — guest restrictions', () => {
  test('vault sidebar does not appear for guest users', async ({ page }) => {
    await navigateToSummary(page);

    // Summary content should be visible
    await expect(page.getByText('Meeting Summary')).toBeVisible();

    // Vault sidebar header should NOT be present
    await expect(page.getByText('Vault')).not.toBeVisible();

    // No vault-related UI elements
    await expect(page.getByText('Select text in the summary to save it')).not.toBeVisible();
  });

  test('dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to landing page
    await expect(page).toHaveURL('/', { timeout: 5_000 });
  });

  test('dashboard vault tab URL also redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard?tab=vault');

    // Should redirect to landing page
    await expect(page).toHaveURL('/', { timeout: 5_000 });
  });
});
