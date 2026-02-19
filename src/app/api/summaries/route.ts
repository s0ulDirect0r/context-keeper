import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getSummaries, saveSummary, deriveTitle } from '@/models/summaries';

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

    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await getSummaries(auth.supabase, auth.user.id, { q, limit, offset });

    if (!result) {
      logger.error('Failed to fetch summaries', {
        route: '/api/summaries',
        requestId: request.headers.get('x-request-id') ?? undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
    }

    return NextResponse.json({
      summaries: result.summaries,
      total: result.total,
      limit,
      offset,
    });
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

    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const title = deriveTitle(recordingTitles);

    const savedSummaryId = await saveSummary(auth.supabase, {
      userId: auth.user.id,
      title,
      summaries,
      context: {
        extractionGoal: context.extractionGoal,
        additionalContext: context.additionalContext,
      },
      transcripts,
    });

    if (!savedSummaryId) {
      logger.error('Failed to save summary', {
        route: '/api/summaries',
        requestId: request.headers.get('x-request-id') ?? undefined,
      });
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }

    return NextResponse.json({ savedSummaryId, title });
  } catch (error) {
    logger.error(
      'Save summary error',
      { route: '/api/summaries', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
