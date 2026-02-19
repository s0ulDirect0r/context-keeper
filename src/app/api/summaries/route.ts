import { z } from 'zod';
import { NextResponse } from 'next/server';
import { type SummaryContext } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import { buildSearchText } from '@/lib/search-text';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// 30 requests per minute for read operations
const listLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const listQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const saveSummarySchema = z.object({
  summaries: z.array(z.string()).min(1, 'At least one summary required'),
  context: z.object({
    extractionGoal: z.string().min(1).max(1000),
    additionalContext: z.string().max(2000).optional(),
  }),
  recordingTitles: z.array(z.string()).optional(),
  transcripts: z.array(z.string()).optional(),
});

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function GET(request: Request) {
  const { allowed, retryAfter } = listLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const { q, limit, offset } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let query = supabase.from('summaries').select('*', { count: 'exact' }).eq('user_id', user.id);

    if (q) {
      // Full-text search via GIN index (requires search_text column from migration)
      // Falls back to ILIKE on title if column doesn't exist yet
      query = query.textSearch('search_text', q, { type: 'websearch', config: 'english' });
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    let { data: summaries, count, error } = await query;

    // Fallback: if textSearch failed (column missing), retry with ILIKE on title
    if (error && q) {
      const fallback = supabase
        .from('summaries')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .ilike('title', `%${q}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      ({ data: summaries, count, error } = await fallback);
    }

    if (error) {
      logger.error(
        'Failed to fetch summaries',
        { route: '/api/summaries', requestId: request.headers.get('x-request-id') ?? undefined },
        error,
      );
      return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
    }

    return NextResponse.json({ summaries: summaries ?? [], total: count ?? 0, limit, offset });
  } catch (error) {
    logger.error(
      'List summaries error',
      { route: '/api/summaries', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = saveSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const { summaries, context, recordingTitles, transcripts } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const summaryContext: SummaryContext = {
      extractionGoal: context.extractionGoal,
      additionalContext: context.additionalContext,
    };

    const title = deriveTitle(recordingTitles);

    const summariesMap: Record<string, string> = {};
    summaries.forEach((s, i) => {
      summariesMap[String(i)] = s;
    });

    const insertData: Database['public']['Tables']['summaries']['Insert'] = {
      user_id: user.id,
      title,
      summaries:
        summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
      context:
        summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
      transcripts:
        transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
      search_text: buildSearchText(title, summariesMap),
    };

    const { data, error: saveError } = await supabase
      .from('summaries')
      .insert(insertData)
      .select('id')
      .single();

    if (saveError) {
      logger.error(
        'Failed to save summary',
        { route: '/api/summaries', requestId: request.headers.get('x-request-id') ?? undefined },
        saveError,
      );
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }

    return NextResponse.json({ savedSummaryId: data.id, title });
  } catch (error) {
    logger.error(
      'Save summary error',
      { route: '/api/summaries', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
