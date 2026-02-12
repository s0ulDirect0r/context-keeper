import { test, expect } from '@playwright/test';
import { createTestUser, signInOnPage, deleteTestUser, type TestUser } from '../fixtures/auth';
import { seedSummary, seedPearls, seedDecisions } from '../fixtures/seed';

let testUser: TestUser;

test.beforeAll(async () => {
  testUser = await createTestUser();
});

test.afterAll(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

test.describe('Action generation API', () => {
  test('POST /api/actions/generate with valid input returns actions via AI mock', async ({
    page,
  }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/actions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId: 'decision-1',
          decision: {
            statement: 'Prioritize auth refactor',
            reasoning: 'It unblocks the API migration.',
          },
          pearls: [
            {
              id: 'pearl-1',
              insight: 'Timeline pressure.',
              concepts: ['urgency'],
              quote: { text: 'We need to ship by March.', speaker: 'Sarah' },
            },
          ],
          context: { extractionGoal: 'Key actions for Q2' },
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.actions).toBeDefined();
    expect(result.body.actions.length).toBeGreaterThan(0);

    const action = result.body.actions[0];
    expect(action.description).toBeTruthy();
    expect(action.contextCard).toBeDefined();
    expect(action.contextCard.sourcePearlQuote).toBeTruthy();
    expect(action.contextCard.sourcePearlInsight).toBeTruthy();
    expect(action.contextCard.parentDecisionStatement).toContain('Prioritize auth refactor');
    expect(action.contextCard.framing).toBeTruthy();
  });

  test('POST /api/actions/generate without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/actions/generate', {
      data: {
        decisionId: 'decision-1',
        decision: { statement: 'test', reasoning: 'test' },
        pearls: [{ id: 'p1', insight: 'test', concepts: ['x'] }],
        context: { extractionGoal: 'test' },
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /api/actions/generate missing decisionId returns 400', async ({ page }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/actions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: { statement: 'test', reasoning: 'test' },
          pearls: [{ id: 'p1', insight: 'test', concepts: ['x'] }],
          context: { extractionGoal: 'test' },
        }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });

  test('POST /api/actions/generate missing decision returns 400', async ({ page }) => {
    await signInOnPage(page, testUser);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/actions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId: 'decision-1',
          pearls: [{ id: 'p1', insight: 'test', concepts: ['x'] }],
          context: { extractionGoal: 'test' },
        }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });
});

test.describe('Action CRUD API', () => {
  test('POST /api/actions without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/actions', {
      data: {
        decisionId: '00000000-0000-0000-0000-000000000000',
        description: 'Test action',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('PATCH /api/actions/:id without auth returns 401', async ({ request }) => {
    const response = await request.patch('/api/actions/some-id', {
      data: { status: 'in_progress' },
    });

    expect(response.status()).toBe(401);
  });

  test('real CRUD: create action then transition pending → in_progress', async ({ page }) => {
    // Seed: summary → pearls → decision so we have a valid decisionId
    const summary = await seedSummary(testUser.id, {
      markdown: '## Action CRUD Test',
    });
    const pearls = await seedPearls(testUser.id, summary.id, [
      {
        insight: 'Test insight for action CRUD',
        concepts: ['testing'],
        quote: { text: 'Test pearl quote' },
      },
    ]);
    const decisions = await seedDecisions(testUser.id, summary.id, [
      {
        statement: 'Test decision for action CRUD',
        reasoning: 'Created for integration test',
        confidence: 'medium',
        supportingPearlIds: [pearls[0].id],
      },
    ]);

    await signInOnPage(page, testUser);

    // POST /api/actions — create
    const createResult = await page.evaluate(async (decisionId: string) => {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId,
          description: 'Test action for CRUD',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, decisions[0].id);

    expect(createResult.status).toBe(200);
    expect(createResult.body.id).toBeTruthy();
    const actionId = createResult.body.id;

    // PATCH /api/actions/:id — transition pending → in_progress
    const patchResult = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      return { status: res.status, body: await res.json() };
    }, actionId);

    expect(patchResult.status).toBe(200);
    expect(patchResult.body.status).toBe('in_progress');
  });

  test('real CRUD: create action with contextCard', async ({ page }) => {
    const summary = await seedSummary(testUser.id, {
      markdown: '## Action Context Card Test',
    });
    const decisions = await seedDecisions(testUser.id, summary.id, [
      {
        statement: 'Decision with context card action',
        reasoning: 'Testing context card persistence',
        confidence: 'high',
      },
    ]);

    await signInOnPage(page, testUser);

    const result = await page.evaluate(async (decisionId: string) => {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId,
          description: 'Follow up with team',
          contextCard: {
            sourcePearlQuote: 'We need to ship by March.',
            sourcePearlInsight: 'Timeline pressure is mounting.',
            parentDecisionStatement: 'Decision with context card action',
            framing: 'Approach as collaborative check-in.',
          },
        }),
      });
      return { status: res.status, body: await res.json() };
    }, decisions[0].id);

    expect(result.status).toBe(200);
    expect(result.body.id).toBeTruthy();
  });
});
