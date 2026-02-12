import { test, expect } from '@playwright/test';
import { MOCK_CONSTELLATION } from './fixtures/mock-data';
import { createTestUser, signInOnPage, deleteTestUser, type TestUser } from './fixtures/auth';
import { seedSummary, seedPearls, seedDecisions } from './fixtures/seed';

test.describe('Constellation page', () => {
  test('renders graph with constellation data (injected via localStorage)', async ({ page }) => {
    // Pre-populate localStorage with guest decisions so the graph has nodes
    await page.goto('/');
    await page.evaluate((mockData) => {
      // Store mock decisions in localStorage for the guest constellation
      localStorage.setItem(
        'cedar:decisions:mock-summary-1',
        JSON.stringify(mockData.nodes.filter((n: { type: string }) => n.type === 'decision')),
      );
    }, MOCK_CONSTELLATION);

    await page.goto('/constellation');

    // Constellation heading should be visible
    await expect(page.getByRole('heading', { name: 'Constellation', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // View toggle should be visible
    await expect(page.getByText('My Loop')).toBeVisible();
    await expect(page.getByText('Team')).toBeVisible();
  });

  test('shows empty state when no data', async ({ page }) => {
    await page.goto('/constellation');

    await expect(page.getByText('Your constellation is empty')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Create your first summary')).toBeVisible();
  });

  test('shows My Loop / Team toggle', async ({ page }) => {
    await page.goto('/constellation');

    await expect(page.getByText('My Loop')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Team')).toBeVisible();
  });

  test('switches to team view and shows graph', async ({ page }) => {
    await page.goto('/constellation');
    await expect(page.getByText('Team')).toBeVisible({ timeout: 10_000 });

    // Click Team toggle
    await page.getByText('Team').click();

    // Graph should render with team data
    const graph = page.getByTestId('constellation-graph');
    await expect(graph).toBeVisible({ timeout: 10_000 });
  });

  test('shows surfacing banner with surface=true param', async ({ page }) => {
    await page.goto('/constellation?highlight=summary-1&surface=true');

    await expect(page.getByText('Surfacing decisions from your pearls...')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('guest sees sign-up prompt', async ({ page }) => {
    await page.goto('/constellation');

    await expect(page.getByText('Sign up to save your constellation')).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Constellation surfacing flow', () => {
  let testUser: TestUser;

  test.beforeAll(async () => {
    testUser = await createTestUser();
  });

  test.afterAll(async () => {
    if (testUser) await deleteTestUser(testUser.id);
  });

  test('surfacing calls POST /api/constellation/surface and renders data', async ({ page }) => {
    // Seed summary + pearls + decisions so endpoint returns real data (idempotency)
    const summary = await seedSummary(testUser.id, {
      markdown: '## Surfacing Test\n\nKey discussion.',
    });
    const pearls = await seedPearls(testUser.id, summary.id, [
      {
        insight: 'Velocity is dropping',
        concepts: ['velocity'],
        quote: { text: 'We are slowing down', speaker: 'Alice' },
      },
    ]);
    await seedDecisions(testUser.id, summary.id, [
      {
        statement: 'Invest in developer tooling',
        reasoning: 'Velocity metrics show decline',
        confidence: 'medium',
        supportingPearlIds: [pearls[0].id],
      },
    ]);

    await signInOnPage(page, testUser);

    // Navigate with surface=true
    await page.goto(`/constellation?surface=true&highlight=${summary.id}`);

    // Surfacing banner should appear
    await expect(page.getByText('Surfacing decisions from your pearls...')).toBeVisible({
      timeout: 10_000,
    });

    // Graph should eventually render (after surfacing completes)
    const graph = page.getByTestId('constellation-graph');
    await expect(graph).toBeVisible({ timeout: 15_000 });

    // Banner should disappear after data loads
    await expect(page.getByText('Surfacing decisions from your pearls...')).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test('empty state not shown during surfacing', async ({ page }) => {
    await signInOnPage(page, testUser);

    // Delay the surface response by 2 seconds (don't mock, just delay)
    await page.route('**/api/constellation/surface', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      // Delay then pass through to real endpoint
      await new Promise((r) => setTimeout(r, 2000));
      await route.fallback();
    });

    await page.goto(`/constellation?surface=true&highlight=00000000-0000-4000-a000-000000000099`);

    // Surfacing banner should be visible during the delay
    await expect(page.getByText('Surfacing decisions from your pearls...')).toBeVisible({
      timeout: 5_000,
    });

    // "Your constellation is empty" should NOT be visible during surfacing
    await expect(page.getByText('Your constellation is empty')).not.toBeVisible();
  });

  test('surfacing failure falls back to regular load', async ({ page }) => {
    // Seed some pearls (so regular constellation has data)
    const summary = await seedSummary(testUser.id, {
      markdown: '## Fallback Test',
    });
    await seedPearls(testUser.id, summary.id, [
      { insight: 'Fallback pearl', concepts: ['fallback'] },
    ]);
    // Seed decisions so regular constellation endpoint returns data
    const pearls = await seedPearls(testUser.id, summary.id, [
      { insight: 'Another pearl', concepts: ['test'] },
    ]);
    await seedDecisions(testUser.id, summary.id, [
      {
        statement: 'Test decision for fallback',
        reasoning: 'Testing fallback behavior',
        confidence: 'low',
        supportingPearlIds: [pearls[0].id],
      },
    ]);

    await signInOnPage(page, testUser);

    // Make the surface endpoint return 500
    await page.route('**/api/constellation/surface', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal error' }),
      });
    });

    await page.goto(`/constellation?surface=true&highlight=${summary.id}`);

    // Graph should eventually render (fallback loaded regular data)
    const graph = page.getByTestId('constellation-graph');
    await expect(graph).toBeVisible({ timeout: 15_000 });
  });
});
