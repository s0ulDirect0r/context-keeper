import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const createActionSchema = z.object({
  decisionId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  contextCard: z
    .object({
      sourcePearlQuote: z.string(),
      sourcePearlSpeaker: z.string().optional(),
      sourcePearlInsight: z.string(),
      parentDecisionStatement: z.string(),
      framing: z.string(),
      timing: z.string().optional(),
      talkingPoints: z.array(z.string()).optional(),
    })
    .optional(),
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

  const parsed = createActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { decisionId, description, contextCard } = parsed.data;

  const { data, error } = await supabase
    .from('actions')
    .insert({
      user_id: user.id,
      decision_id: decisionId,
      description,
      context_card: contextCard ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save action:', error);
    return Response.json({ error: 'Failed to save action' }, { status: 500 });
  }

  return Response.json({ id: data.id });
}
