import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders heading and hero content', async ({ page }) => {
    await expect(page.getByText('Cedar').first()).toBeVisible();
    await expect(
      page.getByText('Turn your meeting recordings into clear, useful insights'),
    ).toBeVisible();
  });

  test('"Try it free" enters app mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Try it free' }).first().click();
    // Should now see the InputMethodPicker
    await expect(page.getByText('Choose what you want me to work with')).toBeVisible();
  });

  test('"Sign up" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign up' }).first()).toBeVisible();
  });

  test('"Already have an account? Sign in" link is visible', async ({ page }) => {
    await expect(page.getByText('Already have an account? Sign in')).toBeVisible();
  });

  test('"How it works" section is visible', async ({ page }) => {
    await expect(page.getByText('How it works')).toBeVisible();
  });
});
