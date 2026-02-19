import { z } from 'zod';
import { NextResponse } from 'next/server';
import { streamAndPersistSummary } from '@/services/summarize';
import type { SummaryContext } from '@/models/types';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const MAX_TRANSCRIPT_BYTES = 500_000; // 500KB per transcript

const summarizeSchema = z.object({
  transcripts: z
    .array(z.string().max(MAX_TRANSCRIPT_BYTES, 'Transcript exceeds 500KB limit'))
    .min(1, 'At least one transcript required')
    .max(10, 'Maximum 10 transcripts'),
  context: z
    .object({
      extractionGoal: z.string().min(1).max(1000, 'Extraction goal exceeds 1000 chars'),
      additionalContext: z.string().max(2000, 'Additional context exceeds 2000 chars').optional(),
      summaryStyle: z.enum(['standard', 'structured', 'custom']).optional(),
      customFormatDescription: z
        .string()
        .max(2000, 'Custom format description exceeds 2000 chars')
        .optional(),
    })
    .refine(
      (ctx) =>
        ctx.summaryStyle !== 'custom' || (ctx.customFormatDescription ?? '').trim().length > 0,
      {
        message: 'Custom format description is required when using custom style',
        path: ['customFormatDescription'],
      },
    ),
  mode: z.enum(['combined', 'separate']).optional(),
  save: z.boolean().optional(),
  recordingTitles: z.array(z.string()).optional(),
  recordingDates: z.array(z.string()).optional(),
  timezone: z
    .string()
    .max(100)
    .regex(/^[A-Za-z_/+-]+$/, 'Invalid timezone format')
    .optional(),
});

// 10 requests per hour per IP
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  // Rate limit check
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { transcripts, context, mode, save, recordingTitles, recordingDates, timezone } =
    parsed.data;

  const summaryContext: SummaryContext = {
    extractionGoal: context.extractionGoal,
    additionalContext: context.additionalContext,
    summaryStyle: context.summaryStyle,
    customFormatDescription: context.customFormatDescription,
    timezone,
  };

  const summaryMode = mode === 'separate' ? 'separate' : 'combined';

  // Get user before streaming starts (calls cookies() internally)
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  if (save) {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  logger.info('Generation started', {
    requestId,
    userId: userId ?? undefined,
    transcriptCount: transcripts.length,
    mode: summaryMode,
  });

  const generationStart = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      await streamAndPersistSummary(
        {
          transcripts,
          context: summaryContext,
          mode: summaryMode,
          recordingTitles,
          recordingDates,
          userId,
          supabase,
          requestId,
        },
        {
          onSummaryChunk: (text) => send('summary_chunk', { text }),
          onSummaryDone: (summaries) => send('summary_done', { summaries }),
          onComplete: (result) => {
            send('complete', result);
            logger.info('Generation complete', {
              requestId,
              userId: userId ?? undefined,
              duration: Date.now() - generationStart,
            });
          },
          onError: (error) => send('error', error),
        },
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
