import { Page } from '@playwright/test';
import { MOCK_SUMMARY_MARKDOWN, MOCK_TAGS } from '../fixtures/mock-data';

/**
 * Mock the POST /api/summarize endpoint with SSE streaming.
 * Sends all events as a single body — the client's SSE parser handles buffered events.
 */
export async function mockSummarizeRoute(page: Page) {
  await page.route('**/api/summarize', async (route) => {
    const events = [
      `event: summary_chunk\ndata: ${JSON.stringify({ text: MOCK_SUMMARY_MARKDOWN })}\n\n`,
      `event: summary_done\ndata: ${JSON.stringify({ summaries: [MOCK_SUMMARY_MARKDOWN] })}\n\n`,
      `event: tags_extracting\ndata: ${JSON.stringify({})}\n\n`,
      `event: tags_done\ndata: ${JSON.stringify({ tags: MOCK_TAGS })}\n\n`,
      `event: complete\ndata: ${JSON.stringify({ summaries: [MOCK_SUMMARY_MARKDOWN], tags: MOCK_TAGS })}\n\n`,
    ];

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: events.join(''),
    });
  });
}

/**
 * Mock the POST /api/pearls/generate endpoint.
 */
export async function mockPearlsRoute(page: Page) {
  await page.route('**/api/pearls/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pearls: [] }),
    });
  });
}
