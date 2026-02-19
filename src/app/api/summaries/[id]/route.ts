import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { updateSummary, deleteSummary } from '@/models/summaries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 30 mutations per minute per IP (shared across PATCH + DELETE)
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

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
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid summary ID' }, { status: 400 });
    }

    const body = await request.json();

    const parsed = patchSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Map API snake_case to model camelCase
    const { is_shared, ...rest } = parsed.data;
    const result = await updateSummary(auth.supabase, id, auth.user.id, {
      ...rest,
      isShared: is_shared,
    });

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    if (result.error === 'update_failed') {
      logger.error('Failed to update summary', {
        route: '/api/summaries/[id]',
        requestId: request.headers.get('x-request-id') ?? undefined,
      });
      return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error(
      'Update summary error',
      { route: '/api/summaries/[id]', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid summary ID' }, { status: 400 });
    }

    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await deleteSummary(auth.supabase, id, auth.user.id);

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }
    if (result.error === 'delete_failed') {
      logger.error('Failed to delete summary', {
        route: '/api/summaries/[id]',
        requestId: request.headers.get('x-request-id') ?? undefined,
      });
      return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error(
      'Delete summary error',
      {
        route: '/api/summaries/[id]',
        requestId: request.headers.get('x-request-id') ?? undefined,
      },
      error,
    );
    return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
  }
}
