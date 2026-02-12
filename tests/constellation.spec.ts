import { test, expect } from '@playwright/test';
import { MOCK_CONSTELLATION } from './fixtures/mock-data';

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
