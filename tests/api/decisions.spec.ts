import { test, expect } from '@playwright/test';
import { mockDecisionsGenerateRoute, mockDecisionsCrudRoute } from '../helpers/api-mocks';

test.describe('Decision generation API', () => {
  test('POST /api/decisions/generate with valid input returns decisions (mocked)', async ({
    page,
  }) => {
    await mockDecisionsGenerateRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/decisions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryId: 'summary-1',
          summaryMarkdown: '## Test Summary\nSome content here.',
          pearls: [
            {
              id: 'pearl-1',
              insight: 'Timeline pressure is mounting.',
              concepts: ['urgency'],
              quote: { text: 'We need to ship by March.' },
            },
          ],
          context: { extractionGoal: 'Key decisions for Q2' },
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.decisions).toBeDefined();
    expect(response.body.decisions.length).toBeGreaterThan(0);
  });

  test('POST /api/decisions/generate with empty pearls returns 400', async ({ request }) => {
    const response = await request.post('/api/decisions/generate', {
      data: {
        summaryId: 'summary-1',
        summaryMarkdown: '## Test',
        pearls: [],
        context: { extractionGoal: 'test' },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  test('POST /api/decisions/generate with missing fields returns 400', async ({ request }) => {
    const response = await request.post('/api/decisions/generate', {
      data: { summaryId: 'summary-1' },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Decision CRUD API', () => {
  test('POST /api/decisions without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/decisions', {
      data: {
        summaryId: '00000000-0000-0000-0000-000000000000',
        statement: 'Test decision',
        confidence: 'medium',
        status: 'active',
        supportingPearls: [],
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('PATCH /api/decisions/:id without auth returns 401', async ({ request }) => {
    const response = await request.patch('/api/decisions/some-id', {
      data: { status: 'active' },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Decision state transitions (mocked)', () => {
  test('decision CRUD mock returns expected shape', async ({ page }) => {
    await mockDecisionsCrudRoute(page);
    await page.goto('/');

    const postResult = await page.evaluate(async () => {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(postResult.status).toBe(200);
    expect(postResult.body.id).toBeDefined();

    const patchResult = await page.evaluate(async () => {
      const res = await fetch('/api/decisions/decision-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(patchResult.status).toBe(200);
    expect(patchResult.body.status).toBe('active');
  });
});
