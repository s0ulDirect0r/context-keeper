import { z } from 'zod';
import { NextResponse } from 'next/server';
import { extractTags } from '@/lib/claude';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MAX_TRANSCRIPT_BYTES = 500_000;

const tagSchema = z.object({
  transcript: z
    .string()
    .min(1, 'Transcript is required')
    .max(MAX_TRANSCRIPT_BYTES, 'Transcript exceeds 500KB limit'),
  context: z.object({
    extractionGoal: z
      .string()
      .min(1, 'Extraction goal is required')
      .max(1000, 'Extraction goal exceeds 1000 chars'),
    additionalContext: z.string().max(2000, 'Additional context exceeds 2000 chars').optional(),
  }),
});

// 30 requests per hour per IP
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = limiter.check(request);
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

    const parsed = tagSchema.safeParse(body);
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

    const { transcript, context } = parsed.data;
    const tags = await extractTags(transcript, context);
    return NextResponse.json({ tags });
  } catch (error) {
    logger.error('Tag extraction error', { route: '/api/tags', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
