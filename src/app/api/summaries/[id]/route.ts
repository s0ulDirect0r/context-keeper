import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSearchText } from '@/lib/search-text';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

const patchSummarySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summaries: z.array(z.string()).optional(),
  context: z
    .object({
      extractionGoal: z.string().min(1).max(1000),
      additionalContext: z.string().max(2000).optional(),
    })
    .optional(),
  is_shared: z.boolean().optional(),
  transcripts: z.array(z.string()).optional(),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = patchSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const validatedBody = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify ownership and get current data for search_text recomputation
    const { data: existing, error: fetchError } = await supabase
      .from('summaries')
      .select('id, user_id, share_token, title, summaries')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Build update object from validated fields
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (validatedBody.title !== undefined) updateData.title = validatedBody.title;
    if (validatedBody.summaries !== undefined) updateData.summaries = validatedBody.summaries;
    if (validatedBody.context !== undefined) updateData.context = validatedBody.context;
    if (validatedBody.is_shared !== undefined) updateData.is_shared = validatedBody.is_shared;
    if (validatedBody.transcripts !== undefined) updateData.transcripts = validatedBody.transcripts;

    // Recompute search_text when title or summaries change
    if (validatedBody.title !== undefined || validatedBody.summaries !== undefined) {
      const newTitle = validatedBody.title ?? existing.title;
      const newSummaries = validatedBody.summaries ?? (existing.summaries as string[]);
      const summariesMap: Record<string, string> = {};
      if (Array.isArray(newSummaries)) {
        newSummaries.forEach((s: string, i: number) => {
          summariesMap[String(i)] = String(s);
        });
      }
      updateData.search_text = buildSearchText(newTitle, summariesMap);
    }

    // Generate share token when enabling sharing for the first time
    if (validatedBody.is_shared === true && !existing.share_token) {
      updateData.share_token = crypto.randomBytes(16).toString('base64url');
    }

    const { data, error: updateError } = await supabase
      .from('summaries')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error(
        'Failed to update summary',
        {
          route: '/api/summaries/[id]',
          requestId: request.headers.get('x-request-id') ?? undefined,
        },
        updateError,
      );
      return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error(
      'Update summary error',
      { route: '/api/summaries/[id]', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Props) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('summaries')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Delete associated data first (foreign key constraints)
    await supabase.from('pearls').delete().eq('summary_id', id);

    // Delete the summary
    const { error: deleteError } = await supabase.from('summaries').delete().eq('id', id);

    if (deleteError) {
      logger.error(
        'Failed to delete summary',
        {
          route: '/api/summaries/[id]',
          requestId: _request.headers.get('x-request-id') ?? undefined,
        },
        deleteError,
      );
      return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error(
      'Delete summary error',
      {
        route: '/api/summaries/[id]',
        requestId: _request.headers.get('x-request-id') ?? undefined,
      },
      error,
    );
    return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
  }
}
