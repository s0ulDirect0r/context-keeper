import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toSavedNote, type Database } from '@/lib/supabase/types';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const createNoteSchema = z
  .object({
    summaryId: z.string().uuid('Invalid summary ID'),
    excerptText: z.string().max(2000, 'Excerpt exceeds 2000 chars').optional(),
    note: z.string().max(2000, 'Note exceeds 2000 chars').optional(),
    chunkIndex: z.number().int().min(0).optional(),
    tags: z.array(z.string().max(50)).max(10).default([]),
  })
  .refine((data) => data.excerptText || data.note, {
    message: 'Either excerptText or note is required',
  });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  summaryId: z.string().uuid().optional(),
  tag: z.string().max(50).optional(),
});

// 60 saves per hour per IP
const createLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });
// 30 reads per minute per IP
const listLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = listLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
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

    const { limit, offset, summaryId, tag } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    if (summaryId) {
      // Sidebar view: simple query, no join needed
      const { data, count, error } = await supabase
        .from('notes')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('summary_id', summaryId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch notes', { route: '/api/notes', requestId }, error);
        return NextResponse.json({ error: 'Failed to fetch notes', requestId }, { status: 500 });
      }

      type NoteRow = Database['public']['Tables']['notes']['Row'];
      return NextResponse.json({
        items: ((data ?? []) as NoteRow[]).map(toSavedNote),
        total: count ?? 0,
        limit,
        offset,
      });
    }

    // Dashboard view: join summary title for grouping
    let dashboardQuery = supabase
      .from('notes')
      .select('*, summaries(title)', { count: 'exact' })
      .eq('user_id', user.id);

    if (tag) {
      dashboardQuery = dashboardQuery.contains('tags', [tag]);
    }

    const { data, count, error } = await dashboardQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch notes', { route: '/api/notes', requestId }, error);
      return NextResponse.json({ error: 'Failed to fetch notes', requestId }, { status: 500 });
    }

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('List notes error', { route: '/api/notes', requestId }, error);
    return NextResponse.json({ error: 'Failed to process request', requestId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = createLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const parsed = createNoteSchema.safeParse(body);
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

    const { summaryId, excerptText, note, chunkIndex, tags } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    const insertData: Database['public']['Tables']['notes']['Insert'] = {
      user_id: user.id,
      summary_id: summaryId,
      excerpt_text: excerptText ?? null,
      note: note ?? null,
      chunk_index: chunkIndex ?? null,
      tags,
    };

    const { data, error: insertError } = await supabase
      .from('notes')
      .insert(insertData)
      .select('*')
      .single();

    if (insertError) {
      logger.error('Failed to save note', { route: '/api/notes', requestId }, insertError);
      return NextResponse.json({ error: 'Failed to save note', requestId }, { status: 500 });
    }

    type NoteRow = Database['public']['Tables']['notes']['Row'];
    return NextResponse.json({ item: toSavedNote(data as NoteRow) }, { status: 201 });
  } catch (error) {
    logger.error('Save note error', { route: '/api/notes', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
