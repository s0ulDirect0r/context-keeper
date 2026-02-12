import { Page } from '@playwright/test';
import {
  MOCK_SUMMARY_MARKDOWN,
  MOCK_TAGS,
  MOCK_PEARLS,
  MOCK_DECISIONS,
  MOCK_ACTIONS,
  MOCK_CONSTELLATION,
  MOCK_TEAM_CONSTELLATION,
} from '../fixtures/mock-data';

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

// ── Cedar mock routes ──────────────────────────────────────────────

/**
 * Mock POST /api/decisions/generate — returns AI-generated decisions.
 */
export async function mockDecisionsGenerateRoute(page: Page) {
  await page.route('**/api/decisions/generate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ decisions: MOCK_DECISIONS }),
    });
  });
}

/**
 * Mock POST /api/decisions (persist) and PATCH /api/decisions/:id (update).
 */
export async function mockDecisionsCrudRoute(page: Page) {
  // POST /api/decisions — persist a decision
  await page.route('**/api/decisions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'decision-new-1' }),
    });
  });

  // PATCH /api/decisions/:id — update a decision
  await page.route('**/api/decisions/*', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'decision-1', ...body }),
    });
  });
}

/**
 * Mock POST /api/actions/generate — returns AI-generated actions.
 */
export async function mockActionsGenerateRoute(page: Page) {
  await page.route('**/api/actions/generate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ actions: MOCK_ACTIONS }),
    });
  });
}

/**
 * Mock POST /api/actions (persist) and PATCH /api/actions/:id (update).
 */
export async function mockActionsCrudRoute(page: Page) {
  // POST /api/actions — persist an action
  await page.route('**/api/actions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'action-new-1' }),
    });
  });

  // PATCH /api/actions/:id — update an action
  await page.route('**/api/actions/*', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'action-1', ...body }),
    });
  });
}

/**
 * Mock GET /api/constellation — returns constellation graph data.
 * Supports ?view=team query param for team view.
 */
export async function mockConstellationRoute(page: Page) {
  await page.route('**/api/constellation**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const view = url.searchParams.get('view');
    const data = view === 'team' ? MOCK_TEAM_CONSTELLATION : MOCK_CONSTELLATION;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}
