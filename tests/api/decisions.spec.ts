import { test, expect } from '@playwright/test';
import { createTestUser, signInOnPage, deleteTestUser, type TestUser } from '../fixtures/auth';
import { seedSummary, seedPearls } from '../fixtures/seed';

let testUser: TestUser;

test.beforeAll(async () => {
  testUser = await createTestUser();
});

test.afterAll(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

test.describe('Decision generation API', () => {
  test('POST /api/decisions/generate with valid input returns decisions via AI mock', async ({
    page,
  }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
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
            {
              id: 'pearl-2',
              insight: 'Dependencies are blocking progress.',
              concepts: ['dependencies'],
              quote: { text: 'Auth refactor is the bottleneck.' },
            },
          ],
          context: { extractionGoal: 'Key decisions for Q2' },
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.decisions).toBeDefined();
    expect(result.body.decisions.length).toBe(2);

    const d = result.body.decisions[0];
    expect(d.statement).toBeTruthy();
    expect(d.reasoning).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(d.confidence);
    expect(d.status).toBe('emerging');
    expect(d.supportingPearls).toBeDefined();
    expect(d.supportingPearls[0].pearlId).toBe('pearl-1');
    expect(d.supportingPearls[1].pearlId).toBe('pearl-2');
  });

  test('POST /api/decisions/generate without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/decisions/generate', {
      data: {
        summaryId: 'summary-1',
        summaryMarkdown: '## Test',
        pearls: [{ id: 'p1', insight: 'test', concepts: ['test'], quote: { text: 'test' } }],
        context: { extractionGoal: 'test' },
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /api/decisions/generate with empty pearls returns 400', async ({ page }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/decisions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryId: 'summary-1',
          summaryMarkdown: '## Test',
          pearls: [],
          context: { extractionGoal: 'test' },
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Validation failed');
  });

  test('POST /api/decisions/generate with missing fields returns 400', async ({ page }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/decisions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId: 'summary-1' }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });

  test('POST /api/decisions/generate with oversized summary returns 400', async ({ page }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async (bigSummary: string) => {
      const res = await fetch('/api/decisions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryId: 'summary-1',
          summaryMarkdown: bigSummary,
          pearls: [{ id: 'pearl-1', insight: 'test', concepts: ['test'], quote: { text: 'test' } }],
          context: { extractionGoal: 'test' },
        }),
      });
      return { status: res.status };
    }, 'x'.repeat(50_001));

    expect(result.status).toBe(400);
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

  test('real CRUD: create decision then transition emerging → active', async ({ page }) => {
    // Seed a summary so we have a valid summaryId
    const summary = await seedSummary(testUser.id, {
      markdown: '## CRUD Test Summary',
    });
    const pearls = await seedPearls(testUser.id, summary.id, [
      {
        insight: 'Test insight for CRUD',
        concepts: ['testing'],
        quote: { text: 'This is a test pearl' },
      },
    ]);

    await signInOnPage(page, testUser);

    // POST /api/decisions — create
    const createResult = await page.evaluate(
      async ({ summaryId, pearlId }) => {
        const res = await fetch('/api/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summaryId,
            statement: 'Test CRUD decision',
            reasoning: 'Created for integration test',
            confidence: 'medium',
            status: 'emerging',
            supportingPearls: [{ pearlId, relationship: 'supports' }],
          }),
        });
        return { status: res.status, body: await res.json() };
      },
      { summaryId: summary.id, pearlId: pearls[0].id },
    );

    expect(createResult.status).toBe(200);
    expect(createResult.body.id).toBeTruthy();
    const decisionId = createResult.body.id;

    // PATCH /api/decisions/:id — transition emerging → active
    const patchResult = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      return { status: res.status, body: await res.json() };
    }, decisionId);

    expect(patchResult.status).toBe(200);
    expect(patchResult.body.status).toBe('active');
  });
});
