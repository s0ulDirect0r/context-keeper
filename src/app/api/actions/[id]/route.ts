import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isValidActionTransition, type ActionStatus } from '@/lib/types/cedar';

const updateActionSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  description: z.string().min(1).max(2000).optional(),
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

  const parsed = updateActionSchema.safeParse(body);
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
      .from('actions')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: 'Action not found' }, { status: 404 });
    }

    if (!isValidActionTransition(existing.status as ActionStatus, updates.status)) {
      return Response.json(
        { error: `Invalid state transition: ${existing.status} → ${updates.status}` },
        { status: 400 },
      );
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) updatePayload.status = updates.status;
  if (updates.description !== undefined) updatePayload.description = updates.description;

  const { data, error } = await supabase
    .from('actions')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, description, status, updated_at')
    .single();

  if (error || !data) {
    return Response.json({ error: 'Action not found' }, { status: 404 });
  }

  return Response.json(data);
}
