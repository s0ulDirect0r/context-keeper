import { test, expect } from '@playwright/test';

/**
 * Vault API auth guard tests.
 * All vault endpoints require authentication — verify they reject anonymous requests.
 */
test.describe('Vault API auth guard', () => {
  test('GET /api/vault returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/vault');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('POST /api/vault returns 401 without auth for valid body', async ({ request }) => {
    const res = await request.post('/api/vault', {
      data: {
        summaryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        excerptText: 'Test excerpt that should require auth',
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('PATCH /api/vault/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.patch('/api/vault/00000000-0000-0000-0000-000000000001', {
      data: { note: 'Updated note' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('DELETE /api/vault/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.delete('/api/vault/00000000-0000-0000-0000-000000000001');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });
});

test.describe('Vault API validation', () => {
  test('POST /api/vault rejects invalid body', async ({ request }) => {
    const res = await request.post('/api/vault', {
      data: { excerptText: '' }, // missing summaryId, empty excerpt
    });
    // Should be 400 (validation) or 401 (auth checked first)
    expect([400, 401]).toContain(res.status());
  });

  test('GET /api/vault rejects invalid query params', async ({ request }) => {
    const res = await request.get('/api/vault?limit=999');
    // Should be 400 (validation) or 401 (auth checked first)
    expect([400, 401]).toContain(res.status());
  });
});
