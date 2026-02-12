import { createClient } from '@/lib/supabase/server';
import { buildConstellationData } from '@/lib/constellation';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all user data in parallel
  const [pearlsResult, decisionsResult, decisionPearlsResult, actionsResult] = await Promise.all([
    supabase.from('pearls').select('id, concepts, created_at').eq('user_id', user.id),
    supabase
      .from('decisions')
      .select('id, statement, confidence, status, created_at')
      .eq('user_id', user.id),
    supabase.from('decision_pearls').select('decision_id, pearl_id, relationship'),
    supabase
      .from('actions')
      .select('id, description, decision_id, status, created_at')
      .eq('user_id', user.id),
  ]);

  // Cedar tables may not exist yet (migration not applied) — return empty constellation
  if (pearlsResult.error || decisionsResult.error || actionsResult.error) {
    return Response.json({ nodes: [], edges: [] });
  }

  const data = buildConstellationData(
    pearlsResult.data ?? [],
    decisionsResult.data ?? [],
    decisionPearlsResult.data ?? [],
    actionsResult.data ?? [],
  );

  return Response.json(data);
}
