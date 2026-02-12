import { test, expect } from '@playwright/test';
import { createTestUser, signInOnPage, deleteTestUser, type TestUser } from './fixtures/auth';
import { MOCK_TRANSCRIPT, MOCK_PEARLS } from './fixtures/mock-data';
import { mockSummarizeRoute, mockPearlsRoute, mockPearlsSaveRoute } from './helpers/api-mocks';

const FAKE_SUMMARY_ID = '00000000-0000-4000-a000-000000000001';

let testUser: TestUser;

test.beforeAll(async () => {
  testUser = await createTestUser();
});

test.afterAll(async () => {
  if (testUser) await deleteTestUser(testUser.id);
});

/**
 * Navigate through the full flow to the summary view as a logged-in user.
 * AI routes are mocked; the pearl sidebar interaction is real.
 *
 * Logged-in users skip the landing page and go straight to InputMethodPicker.
 */
async function navigateToSummaryAsLoggedIn(
  page: import('@playwright/test').Page,
  opts?: { captured?: { payload: unknown } },
) {
  // Mock AI routes (must be set up before navigation triggers them)
  await mockSummarizeRoute(page, { savedSummaryId: FAKE_SUMMARY_ID });
  await mockPearlsRoute(page);
  await mockPearlsSaveRoute(page, opts?.captured);

  // Sign in — after auth, user lands on InputMethodPicker (no landing page)
  await signInOnPage(page, testUser);

  // Navigate summary flow (logged-in users skip "Try it free")
  await page.getByText('Paste or upload transcript').click();
  await page.getByPlaceholder('Paste your transcript here...').fill(MOCK_TRANSCRIPT);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Handle speaker-select step
  await expect(page.getByText('Which speaker are you?')).toBeVisible();
  await page.getByRole('button', { name: 'None of these / Skip' }).click();

  // Context wizard
  await page.getByText('For my manager').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();

  // Wait for summary to appear
  await expect(page.getByText('Your Summary')).toBeVisible({ timeout: 15_000 });

  // Skip tag selection to trigger pearl generation
  // (TagSelector shows "Skip" in compact mode after summary is ready)
  const skipButton = page.getByRole('button', { name: 'Skip' });
  await expect(skipButton).toBeVisible({ timeout: 5_000 });
  await skipButton.click();

  // Wait for pearls to appear in the sidebar
  await expect(page.getByText(MOCK_PEARLS[0].insight)).toBeVisible({ timeout: 10_000 });
}

test.describe('Pearl save button', () => {
  test('save button appears after keeping one pearl (without deciding all)', async ({ page }) => {
    await navigateToSummaryAsLoggedIn(page);

    // Keep only the first pearl — leave others undecided
    const keepButtons = page.getByRole('button', { name: 'Keep' });
    await keepButtons.first().click();

    // Save button should be visible with "Save 1 pearl"
    await expect(page.getByRole('button', { name: /Save 1 pearl/ })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('only explicitly kept pearls are saved (default = discard)', async ({ page }) => {
    const captured: { payload: unknown } = { payload: null };
    await navigateToSummaryAsLoggedIn(page, { captured });

    // Keep only the first pearl
    const keepButtons = page.getByRole('button', { name: 'Keep' });
    await keepButtons.first().click();

    // Click save
    await page.getByRole('button', { name: /Save 1 pearl/ }).click();

    // After save, the sidebar transitions from curate → display mode.
    // ConstellationPrompt appears once pearls are saved.
    await expect(page.getByText('view in your constellation', { exact: false })).toBeVisible({
      timeout: 5_000,
    });

    // Verify the captured payload contains exactly 1 pearl
    const payload = captured.payload as { pearls: unknown[]; summaryId: string };
    expect(payload.pearls).toHaveLength(1);
    expect(payload.summaryId).toBe(FAKE_SUMMARY_ID);
  });

  test('save button hidden when no pearls explicitly kept', async ({ page }) => {
    await navigateToSummaryAsLoggedIn(page);

    // Don't click any keep buttons — all pearls undecided
    // Verify no save button is visible
    await expect(page.getByRole('button', { name: /Save.*pearl/ })).not.toBeVisible();
  });
});
