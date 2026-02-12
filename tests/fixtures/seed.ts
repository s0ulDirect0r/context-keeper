/**
 * DB seeding fixtures for E2E tests.
 * Uses Supabase REST API with service role key to bypass RLS.
 */

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
  Prefer: 'return=representation',
};

/** Insert a summary row for the test user. Returns the inserted row. */
export async function seedSummary(
  userId: string,
  data: {
    id?: string;
    title?: string;
    markdown: string;
    context?: Record<string, unknown>;
  },
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/summaries`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...(data.id && { id: data.id }),
      user_id: userId,
      title: data.title ?? 'Test Summary',
      summaries: JSON.stringify([data.markdown]),
      context: JSON.stringify(data.context ?? { extractionGoal: 'Test extraction' }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to seed summary: ${res.status} ${body}`);
  }

  const rows = await res.json();
  return rows[0];
}

export interface SeedPearl {
  insight: string;
  concepts: string[];
  quote?: { text: string; speaker?: string };
}

/** Insert pearl rows linked to a summary. Returns inserted rows. */
export async function seedPearls(userId: string, summaryId: string, pearls: SeedPearl[]) {
  const rows = pearls.map((p) => ({
    user_id: userId,
    summary_id: summaryId,
    insight: p.insight,
    concepts: p.concepts,
    quote: p.quote ? JSON.stringify(p.quote) : null,
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/pearls`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to seed pearls: ${res.status} ${body}`);
  }

  return res.json();
}

export interface SeedDecision {
  statement: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  status?: string;
  /** Pearl IDs to link with 'supports' relationship */
  supportingPearlIds?: string[];
}

/** Insert decision rows and their pearl links. Returns inserted decisions. */
export async function seedDecisions(userId: string, summaryId: string, decisions: SeedDecision[]) {
  const insertedDecisions = [];

  for (const d of decisions) {
    // Insert decision
    const res = await fetch(`${SUPABASE_URL}/rest/v1/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        summary_id: summaryId,
        statement: d.statement,
        reasoning: d.reasoning,
        confidence: d.confidence,
        status: d.status ?? 'emerging',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to seed decision: ${res.status} ${body}`);
    }

    const rows = await res.json();
    const decision = rows[0];
    insertedDecisions.push(decision);

    // Insert decision_pearls links
    if (d.supportingPearlIds && d.supportingPearlIds.length > 0) {
      const links = d.supportingPearlIds.map((pearlId) => ({
        decision_id: decision.id,
        pearl_id: pearlId,
        relationship: 'supports',
      }));

      const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/decision_pearls`, {
        method: 'POST',
        headers,
        body: JSON.stringify(links),
      });

      if (!linkRes.ok) {
        const body = await linkRes.text();
        throw new Error(`Failed to seed decision_pearls: ${linkRes.status} ${body}`);
      }
    }
  }

  return insertedDecisions;
}
