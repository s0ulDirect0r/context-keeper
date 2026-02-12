import { test, expect } from '@playwright/test';

test.describe('Auth dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking "Sign up" opens dialog in sign-up mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign up' }).first().click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('switches from sign-up to sign-in mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign up' }).first().click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    // Click "Already have an account? Sign in"
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('switches from sign-in to sign-up mode', async ({ page }) => {
    // Open in sign-in mode via the landing page link
    await page.getByText('Already have an account? Sign in').click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Click "Don't have an account? Sign up"
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('switches to magic link form', async ({ page }) => {
    await page.getByText('Already have an account? Sign in').click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in with magic link' }).click();
    await expect(page.getByRole('heading', { name: 'Magic link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
  });

  test('closes dialog on Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign up' }).first().click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Create account' })).not.toBeVisible();
  });

  test('"Already have an account? Sign in" link opens sign-in dialog', async ({ page }) => {
    await page.getByText('Already have an account? Sign in').click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });
});
