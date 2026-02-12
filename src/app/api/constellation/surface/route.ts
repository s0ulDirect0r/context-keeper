import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { surfaceDecisions } from '@/lib/cedar-ai';
import { buildConstellationData, buildEnrichedResponse } from '@/lib/constellation';
import type { FullDecisionRow, FullActionRow, FullPearlRow } from '@/lib/constellation';
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
    return Response.json({ nodes: [], edges: [], decisions: {}, actions: {}, pearls: {} });
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
  const [summariesResult, pearlsResult, decisionsResult, linksResult, actionsResult] =
    await Promise.all([
      supabase.from('summaries').select('id, title, created_at').eq('user_id', userId),
      supabase
        .from('pearls')
        .select('id, summary_id, concepts, insight, quote, created_at')
        .eq('user_id', userId),
      supabase
        .from('decisions')
        .select(
          'id, user_id, summary_id, statement, reasoning, confidence, status, created_at, updated_at',
        )
        .eq('user_id', userId),
      supabase.from('decision_pearls').select('decision_id, pearl_id, relationship'),
      supabase
        .from('actions')
        .select(
          'id, user_id, description, decision_id, context_card, status, due_date, created_at, updated_at',
        )
        .eq('user_id', userId),
    ]);

  // If tables don't exist yet, return empty
  if (pearlsResult.error || decisionsResult.error || actionsResult.error) {
    return Response.json({
      nodes: [],
      edges: [],
      decisions: {},
      actions: {},
      pearls: {},
      summaries: {},
    });
  }

  const summaryRows = (summariesResult.data ?? []) as {
    id: string;
    title: string;
    created_at: string;
  }[];
  const pearlRows = (pearlsResult.data ?? []) as FullPearlRow[];
  const decisionRows = (decisionsResult.data ?? []) as FullDecisionRow[];
  const dpRows = linksResult.data ?? [];
  const actionRows = (actionsResult.data ?? []) as FullActionRow[];

  const graph = buildConstellationData(summaryRows, pearlRows, decisionRows, dpRows, actionRows);
  const enriched = buildEnrichedResponse(
    graph,
    summaryRows,
    decisionRows,
    dpRows,
    actionRows,
    pearlRows,
  );

  return Response.json(enriched);
}
