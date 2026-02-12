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

test.describe('POST /api/constellation/surface', () => {
  test('returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/constellation/surface', {
      data: { summaryId: '00000000-0000-4000-a000-000000000001' },
    });
    expect(response.status()).toBe(401);
  });

  test('returns 400 with missing summaryId', async ({ page }) => {
    await signInOnPage(page, testUser);

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/constellation/surface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(400);
  });

  test('returns 400 with invalid summaryId format', async ({ page }) => {
    await signInOnPage(page, testUser);

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/constellation/surface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId: 'not-a-uuid' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(400);
  });

  test('returns constellation data for summary with existing decisions (idempotency)', async ({
    page,
  }) => {
    // Seed data: summary → pearls → decisions (so AI call is skipped)
    const summary = await seedSummary(testUser.id, {
      markdown: '## Test Summary\n\nKey discussion about priorities.',
    });
    const pearls = await seedPearls(testUser.id, summary.id, [
      {
        insight: 'Team pressure is building',
        concepts: ['urgency', 'pressure'],
        quote: { text: 'We need to move fast', speaker: 'Alice' },
      },
      {
        insight: 'Technical debt is slowing us',
        concepts: ['debt', 'velocity'],
        quote: { text: 'The codebase fights back', speaker: 'Bob' },
      },
    ]);
    await seedDecisions(testUser.id, summary.id, [
      {
        statement: 'Prioritize tech debt cleanup over new features',
        reasoning: 'Velocity is suffering due to accumulated debt',
        confidence: 'medium',
        supportingPearlIds: [pearls[0].id, pearls[1].id],
      },
    ]);

    await signInOnPage(page, testUser);

    const response = await page.evaluate(async (summaryId: string) => {
      const res = await fetch('/api/constellation/surface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId }),
      });
      return { status: res.status, body: await res.json() };
    }, summary.id);

    expect(response.status).toBe(200);
    expect(response.body.nodes).toBeDefined();
    expect(response.body.edges).toBeDefined();
    // Should have at least pearl clusters + decision nodes
    expect(response.body.nodes.length).toBeGreaterThan(0);
  });

  test('returns empty constellation for summary with no pearls', async ({ page }) => {
    const summary = await seedSummary(testUser.id, {
      markdown: '## Empty Summary\n\nNo pearls here.',
    });

    await signInOnPage(page, testUser);

    const response = await page.evaluate(async (summaryId: string) => {
      const res = await fetch('/api/constellation/surface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId }),
      });
      return { status: res.status, body: await res.json() };
    }, summary.id);

    expect(response.status).toBe(200);
    expect(response.body.nodes).toEqual([]);
    expect(response.body.edges).toEqual([]);
  });
});
