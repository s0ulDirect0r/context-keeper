import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { surfaceDecisions } from '@/lib/cedar-ai';
import { buildConstellationData } from '@/lib/constellation';
import { createRateLimiter } from '@/lib/rate-limit';

const surfaceSchema = z.object({ summaryId: z.string().uuid() });
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  // Rate limit
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return Response.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = surfaceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { summaryId } = parsed.data;

  // Fetch summary + pearls from DB
  const [summaryResult, pearlsResult] = await Promise.all([
    supabase
      .from('summaries')
      .select('id, summaries')
      .eq('id', summaryId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('pearls')
      .select('id, insight, concepts, quote')
      .eq('summary_id', summaryId)
      .eq('user_id', user.id),
  ]);

  if (summaryResult.error || !summaryResult.data) {
    return Response.json({ error: 'Summary not found' }, { status: 404 });
  }
  const summaryRow = summaryResult.data as { id: string; summaries: unknown };

  if (!pearlsResult.data?.length) {
    return Response.json({ nodes: [], edges: [] });
  }

  // Idempotency: check if decisions already exist for these pearls
  const pearlRows = pearlsResult.data as {
    id: string;
    insight: string;
    concepts: string[] | null;
    quote: unknown;
  }[];
  const pearlIds = pearlRows.map((p) => p.id);
  const { data: existingLinks } = await supabase
    .from('decision_pearls')
    .select('decision_id')
    .in('pearl_id', pearlIds);

  if (existingLinks && existingLinks.length > 0) {
    // Decisions already surfaced — skip AI, build constellation from existing data
    return buildAndReturnConstellation(supabase, user.id);
  }

  // Call AI to surface decisions
  const pearls = pearlRows.map((p) => ({
    id: p.id,
    insight: p.insight,
    concepts: p.concepts ?? [],
    quote: p.quote as { text: string; speaker?: string } | undefined,
  }));
  const rawSummaries = summaryRow.summaries;
  const summaryMarkdown = Array.isArray(rawSummaries)
    ? (rawSummaries[0] as string)
    : (rawSummaries as string);
  const context = { extractionGoal: 'Strategic decisions from this meeting' };

  const { decisions } = await surfaceDecisions(summaryMarkdown, pearls, context);

  // Persist decisions
  for (const decision of decisions) {
    const { data: inserted } = await supabase
      .from('decisions')
      .insert({
        user_id: user.id,
        summary_id: summaryId,
        statement: decision.statement,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        status: decision.status,
      })
      .select('id')
      .single();

    if (inserted) {
      const links = decision.supportingPearls.map((sp) => ({
        decision_id: inserted.id,
        pearl_id: sp.pearlId,
        relationship: sp.relationship,
      }));
      if (links.length) {
        await supabase.from('decision_pearls').insert(links);
      }
    }
  }

  return buildAndReturnConstellation(supabase, user.id);
}

async function buildAndReturnConstellation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [pearlsResult, decisionsResult, linksResult, actionsResult] = await Promise.all([
    supabase.from('pearls').select('id, concepts, created_at').eq('user_id', userId),
    supabase
      .from('decisions')
      .select('id, statement, confidence, status, created_at')
      .eq('user_id', userId),
    supabase.from('decision_pearls').select('decision_id, pearl_id, relationship'),
    supabase
      .from('actions')
      .select('id, description, decision_id, status, created_at')
      .eq('user_id', userId),
  ]);

  // If tables don't exist yet, return empty
  if (pearlsResult.error || decisionsResult.error || actionsResult.error) {
    return Response.json({ nodes: [], edges: [] });
  }

  const data = buildConstellationData(
    pearlsResult.data ?? [],
    decisionsResult.data ?? [],
    linksResult.data ?? [],
    actionsResult.data ?? [],
  );

  return Response.json(data);
}
