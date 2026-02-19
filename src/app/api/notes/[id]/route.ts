import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toSavedNote, type Database } from '@/lib/supabase/types';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const updateNoteSchema = z.object({
  note: z.string().max(2000, 'Note exceeds 2000 chars').nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// 60 updates per hour per IP
const updateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });
// 30 deletes per hour per IP
const deleteLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = updateLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => i.message),
          requestId,
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    const updateFields: Database['public']['Tables']['notes']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.note !== undefined) updateFields.note = parsed.data.note;
    if (parsed.data.tags !== undefined) updateFields.tags = parsed.data.tags;

    const { data, error: updateError } = await supabase
      .from('notes')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Failed to update note', { route: '/api/notes/[id]', requestId }, updateError);
      return NextResponse.json({ error: 'Failed to update note', requestId }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Note not found', requestId }, { status: 404 });
    }

    type NoteRow = Database['public']['Tables']['notes']['Row'];
    return NextResponse.json({ item: toSavedNote(data as NoteRow) });
  } catch (error) {
    logger.error('Update note error', { route: '/api/notes/[id]', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = deleteLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      logger.error('Failed to delete note', { route: '/api/notes/[id]', requestId }, deleteError);
      return NextResponse.json({ error: 'Failed to delete note', requestId }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete note error', { route: '/api/notes/[id]', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
