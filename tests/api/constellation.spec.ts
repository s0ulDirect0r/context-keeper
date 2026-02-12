import { test, expect } from '@playwright/test';
import { mockConstellationRoute } from '../helpers/api-mocks';

test.describe('Constellation API', () => {
  test('GET /api/constellation without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/constellation');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('constellation mock returns nodes and edges (personal view)', async ({ page }) => {
    await mockConstellationRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/constellation');
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.nodes).toBeDefined();
    expect(response.body.edges).toBeDefined();
    expect(response.body.nodes.length).toBeGreaterThan(0);
    expect(response.body.edges.length).toBeGreaterThan(0);

    // Verify node types are present
    const nodeTypes = new Set(response.body.nodes.map((n: { type: string }) => n.type));
    expect(nodeTypes.has('pearl-cluster')).toBe(true);
    expect(nodeTypes.has('decision')).toBe(true);
    expect(nodeTypes.has('action')).toBe(true);
  });

  test('constellation mock returns team data with contributors', async ({ page }) => {
    await mockConstellationRoute(page);
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/constellation?view=team');
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.nodes.length).toBeGreaterThan(0);

    // Team nodes should have contributor field
    const contributors = new Set(
      response.body.nodes
        .filter((n: { contributor?: string }) => n.contributor)
        .map((n: { contributor: string }) => n.contributor),
    );
    expect(contributors.size).toBeGreaterThan(1);
  });
});
