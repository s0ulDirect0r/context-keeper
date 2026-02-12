import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isValidDecisionTransition, type DecisionStatus } from '@/lib/types/cedar';

const updateDecisionSchema = z.object({
  statement: z.string().min(1).max(2000).optional(),
  reasoning: z.string().max(5000).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['emerging', 'active', 'resolved', 'revised']).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const parsed = updateDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const updates = parsed.data;

  // If status is being changed, validate the transition
  if (updates.status) {
    const { data: existing, error: fetchError } = await supabase
      .from('decisions')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: 'Decision not found' }, { status: 404 });
    }

    if (!isValidDecisionTransition(existing.status as DecisionStatus, updates.status)) {
      return Response.json(
        { error: `Invalid state transition: ${existing.status} → ${updates.status}` },
        { status: 400 },
      );
    }
  }

  // Build the update payload
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.statement !== undefined) updatePayload.statement = updates.statement;
  if (updates.reasoning !== undefined) updatePayload.reasoning = updates.reasoning;
  if (updates.confidence !== undefined) updatePayload.confidence = updates.confidence;
  if (updates.status !== undefined) updatePayload.status = updates.status;

  const { data, error } = await supabase
    .from('decisions')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, statement, reasoning, confidence, status, updated_at')
    .single();

  if (error || !data) {
    return Response.json({ error: 'Decision not found' }, { status: 404 });
  }

  return Response.json(data);
}
