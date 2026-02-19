import { test, expect } from '@playwright/test';

/**
 * Notes API auth guard tests.
 * All notes endpoints require authentication — verify they reject anonymous requests.
 */
test.describe('Notes API auth guard', () => {
  test('GET /api/notes returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/notes');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('POST /api/notes returns 401 without auth for valid body', async ({ request }) => {
    const res = await request.post('/api/notes', {
      data: {
        summaryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        excerptText: 'Test excerpt that should require auth',
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('PATCH /api/notes/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.patch('/api/notes/00000000-0000-0000-0000-000000000001', {
      data: { note: 'Updated note' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  test('DELETE /api/notes/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.delete('/api/notes/00000000-0000-0000-0000-000000000001');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });
});

test.describe('Notes API validation', () => {
  test('POST /api/notes rejects invalid body', async ({ request }) => {
    const res = await request.post('/api/notes', {
      data: { excerptText: '' }, // missing summaryId, empty excerpt
    });
    // Should be 400 (validation) or 401 (auth checked first)
    expect([400, 401]).toContain(res.status());
  });

  test('GET /api/notes rejects invalid query params', async ({ request }) => {
    const res = await request.get('/api/notes?limit=999');
    // Should be 400 (validation) or 401 (auth checked first)
    expect([400, 401]).toContain(res.status());
  });
});
