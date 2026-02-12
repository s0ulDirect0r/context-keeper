import { Page } from '@playwright/test';
import { MOCK_SUMMARY_MARKDOWN, MOCK_TAGS, MOCK_PEARLS } from '../fixtures/mock-data';

/**
 * Mock the POST /api/summarize endpoint with SSE streaming.
 * Sends all events as a single body — the client's SSE parser handles buffered events.
 *
 * Pass `savedSummaryId` to simulate logged-in auto-save (the complete event includes it).
 */
export async function mockSummarizeRoute(page: Page, opts?: { savedSummaryId?: string }) {
  await page.route('**/api/summarize', async (route) => {
    const completePayload: Record<string, unknown> = {
      summaries: [MOCK_SUMMARY_MARKDOWN],
      tags: MOCK_TAGS,
    };
    if (opts?.savedSummaryId) {
      completePayload.savedSummaryId = opts.savedSummaryId;
    }

    const events = [
      `event: summary_chunk\ndata: ${JSON.stringify({ text: MOCK_SUMMARY_MARKDOWN })}\n\n`,
      `event: summary_done\ndata: ${JSON.stringify({ summaries: [MOCK_SUMMARY_MARKDOWN] })}\n\n`,
      `event: tags_extracting\ndata: ${JSON.stringify({})}\n\n`,
      `event: tags_done\ndata: ${JSON.stringify({ tags: MOCK_TAGS })}\n\n`,
      `event: complete\ndata: ${JSON.stringify(completePayload)}\n\n`,
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
 * Mock POST /api/pearls (save) — returns fake saved pearls.
 * Optionally captures the request payload for assertion.
 */
export async function mockPearlsSaveRoute(page: Page, captured?: { payload: unknown }) {
  await page.route('**/api/pearls', async (route) => {
    // Only intercept POST /api/pearls (not /api/pearls/generate or /api/pearls/*)
    const url = new URL(route.request().url());
    if (route.request().method() !== 'POST' || !url.pathname.endsWith('/api/pearls')) {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON();
    if (captured) captured.payload = body;

    const fakeSaved = (body.pearls || []).map((p: { id?: string; insight: string }, i: number) => ({
      id: `saved-pearl-${i}`,
      summaryId: body.summaryId,
      insight: p.insight,
      concepts: [],
      quote: null,
      createdAt: new Date().toISOString(),
    }));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pearls: fakeSaved }),
    });
  });
}

/**
 * Mock the POST /api/pearls/generate endpoint.
 * Returns realistic pearls so downstream Cedar tests have data to work with.
 */
export async function mockPearlsRoute(page: Page) {
  await page.route('**/api/pearls/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pearls: MOCK_PEARLS }),
    });
  });
}
