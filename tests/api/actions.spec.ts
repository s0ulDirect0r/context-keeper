import { test, expect } from '@playwright/test';
import { mockActionsGenerateRoute, mockActionsCrudRoute } from '../helpers/api-mocks';

test.describe('Action generation API (mocked)', () => {
  test('POST /api/actions/generate returns actions with context cards', async ({ page }) => {
    await mockActionsGenerateRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
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
              quote: { text: 'We need to ship by March.' },
            },
          ],
          context: { extractionGoal: 'Key actions for Q2' },
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.actions).toBeDefined();
    expect(response.body.actions.length).toBeGreaterThan(0);

    // Verify action structure
    const action = response.body.actions[0];
    expect(action.description).toBeTruthy();
    expect(action.contextCard).toBeDefined();
    expect(action.contextCard.sourcePearlQuote).toBeTruthy();
    expect(action.contextCard.parentDecisionStatement).toBeTruthy();
  });
});

test.describe('Action CRUD API (mocked)', () => {
  test('POST /api/actions returns id', async ({ page }) => {
    await mockActionsCrudRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId: '00000000-0000-0000-0000-000000000000',
          description: 'Test action',
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBeDefined();
  });

  test('PATCH /api/actions/:id returns updated fields', async ({ page }) => {
    await mockActionsCrudRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/actions/action-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('in_progress');
  });
});
