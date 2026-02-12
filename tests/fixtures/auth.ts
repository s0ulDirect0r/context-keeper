/**
 * Auth test fixtures — real Supabase users for E2E tests.
 * Creates/deletes users via Admin API, signs in via the app's UI form.
 */
import type { Page } from '@playwright/test';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Create a test user via Supabase Admin API.
 * Auto-confirmed — no email verification needed.
 */
export async function createTestUser(
  email = `test-${crypto.randomUUID()}@example.com`,
  password = 'test-password-123',
): Promise<TestUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create test user: ${res.status} ${body}`);
  }

  const data = await res.json();
  return { id: data.id, email, password };
}

/**
 * Sign in on the page using the app's auth dialog.
 * Navigates to /, opens sign-in form, fills credentials, submits.
 */
export async function signInOnPage(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');

  // Open sign-in dialog
  await page.getByText('Already have an account? Sign in').click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor({ state: 'visible' });

  // Fill and submit
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Wait for dialog to close (auth successful)
  await page
    .getByRole('heading', { name: 'Sign in' })
    .waitFor({ state: 'hidden', timeout: 10_000 });
}

/**
 * Delete a test user and all their data via Admin API.
 * CASCADE deletes summaries, pearls, decisions, etc.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Failed to delete test user: ${res.status} ${body}`);
  }
}
