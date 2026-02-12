import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const createDecisionSchema = z.object({
  summaryId: z.string().uuid(),
  statement: z.string().min(1).max(2000),
  reasoning: z.string().max(5000).optional(),
  confidence: z.enum(['low', 'medium', 'high']),
  status: z.enum(['emerging', 'active']),
  supportingPearls: z.array(
    z.object({
      pearlId: z.string(),
      relationship: z.enum(['supports', 'contradicts']),
    }),
  ),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { summaryId, statement, reasoning, confidence, status, supportingPearls } = parsed.data;

  // Insert the decision
  const { data: decision, error: decisionError } = await supabase
    .from('decisions')
    .insert({
      user_id: user.id,
      summary_id: summaryId,
      statement,
      reasoning: reasoning ?? null,
      confidence,
      status,
    })
    .select('id')
    .single();

  if (decisionError) {
    console.error('Failed to save decision:', decisionError);
    return Response.json({ error: 'Failed to save decision' }, { status: 500 });
  }

  // Insert pearl links
  if (supportingPearls.length > 0) {
    const links = supportingPearls.map((sp) => ({
      decision_id: decision.id,
      pearl_id: sp.pearlId,
      relationship: sp.relationship,
    }));

    const { error: linkError } = await supabase.from('decision_pearls').insert(links);

    if (linkError) {
      console.error('Failed to save decision-pearl links:', linkError);
      // Non-fatal — decision itself was saved
    }
  }

  return Response.json({ id: decision.id });
}
