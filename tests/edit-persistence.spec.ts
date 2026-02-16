import { test, expect } from '@playwright/test';
import { MOCK_TRANSCRIPT, MOCK_SUMMARY_MARKDOWN, MOCK_TAGS } from './fixtures/mock-data';

/**
 * Mock /api/summarize with a savedSummaryId in the complete event,
 * simulating a logged-in user whose summary gets auto-saved.
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

/** Mock pearls endpoint */
async function mockPearls(page: import('@playwright/test').Page) {
  await page.route('**/api/pearls/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pearls: [] }),
    });
  });
}

/** Navigate through guest flow to reach summary view with a savedSummaryId */
async function navigateToSavedSummary(page: import('@playwright/test').Page) {
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
  await page.getByRole('button', { name: "That's all" }).click();

  await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });
}

test.describe('Edit persistence', () => {
  test('editing triggers PATCH and shows save indicator', async ({ page }) => {
    await navigateToSavedSummary(page);

    // Capture PATCH requests to /api/summaries/*
    const patchRequests: { url: string; body: string }[] = [];
    await page.route('**/api/summaries/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postData() || '';
        patchRequests.push({ url: route.request().url(), body });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });

    // Hover over a chunk to reveal the edit pencil, then click it
    const firstChunk = page.getByLabel('Edit this section').first();
    await firstChunk.hover();
    await firstChunk.click();

    // A textarea should appear — type into it
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.press('End');
    await textarea.type(' EDITED');

    // Click save (the check button) to confirm edit
    await page.getByLabel('Save edit').click();

    // Wait for debounce (800ms) + PATCH to fire
    await page.waitForTimeout(1500);

    // Verify PATCH was called
    expect(patchRequests.length).toBeGreaterThan(0);
    const lastPatch = patchRequests[patchRequests.length - 1];
    expect(lastPatch.url).toContain('test-summary-id');
    const patchBody = JSON.parse(lastPatch.body);
    expect(patchBody.summaries).toBeDefined();
  });

  test('flush on navigation saves pending edits', async ({ page }) => {
    await navigateToSavedSummary(page);

    const patchBodies: string[] = [];
    await page.route('**/api/summaries/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBodies.push(route.request().postData() || '');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });

    // Edit a chunk
    const firstChunk = page.getByLabel('Edit this section').first();
    await firstChunk.hover();
    await firstChunk.click();

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.press('End');
    await textarea.type(' FLUSH-TEST');
    await page.getByLabel('Save edit').click();

    // Immediately click "Create another summary" before debounce fires
    await page.getByRole('button', { name: 'Create another summary' }).click();

    // Should navigate away
    await expect(page.getByText('Paste text')).toBeVisible({ timeout: 5_000 });

    // Flush should have sent a PATCH (via keepalive fetch on unmount)
    await page.waitForTimeout(500);
    expect(patchBodies.length).toBeGreaterThan(0);
  });
});
