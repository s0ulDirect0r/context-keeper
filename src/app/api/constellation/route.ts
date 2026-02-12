import { createClient } from '@/lib/supabase/server';
import { buildConstellationData, buildEnrichedResponse } from '@/lib/constellation';
import type { FullDecisionRow, FullActionRow, FullPearlRow } from '@/lib/constellation';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all user data in parallel — full rows for enriched response
  const [pearlsResult, decisionsResult, decisionPearlsResult, actionsResult] = await Promise.all([
    supabase
      .from('pearls')
      .select('id, concepts, insight, quote, created_at')
      .eq('user_id', user.id),
    supabase
      .from('decisions')
      .select(
        'id, user_id, summary_id, statement, reasoning, confidence, status, created_at, updated_at',
      )
      .eq('user_id', user.id),
    supabase.from('decision_pearls').select('decision_id, pearl_id, relationship'),
    supabase
      .from('actions')
      .select(
        'id, user_id, description, decision_id, context_card, status, due_date, created_at, updated_at',
      )
      .eq('user_id', user.id),
  ]);

  // Cedar tables may not exist yet (migration not applied) — return empty constellation
  if (pearlsResult.error || decisionsResult.error || actionsResult.error) {
    return Response.json({ nodes: [], edges: [], decisions: {}, actions: {}, pearls: {} });
  }

  const pearlRows = (pearlsResult.data ?? []) as FullPearlRow[];
  const decisionRows = (decisionsResult.data ?? []) as FullDecisionRow[];
  const dpRows = decisionPearlsResult.data ?? [];
  const actionRows = (actionsResult.data ?? []) as FullActionRow[];

  const graph = buildConstellationData(pearlRows, decisionRows, dpRows, actionRows);
  const enriched = buildEnrichedResponse(graph, decisionRows, dpRows, actionRows, pearlRows);

  return Response.json(enriched);
}
