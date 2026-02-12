import { test, expect } from '@playwright/test';

test.describe('Constellation API', () => {
  test('GET /api/constellation without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/constellation');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });
});
