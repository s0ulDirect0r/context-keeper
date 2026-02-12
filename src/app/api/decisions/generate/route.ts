import { z } from 'zod';
import { surfaceDecisions } from '@/lib/cedar-ai';
import { createRateLimiter } from '@/lib/rate-limit';
import type { SummaryContext, Pearl } from '@/lib/claude';

const generateSchema = z.object({
  summaryId: z.string().min(1),
  summaryMarkdown: z.string().min(1).max(50_000),
  pearls: z
    .array(
      z.object({
        id: z.string(),
        insight: z.string(),
        concepts: z.array(z.string()),
        quote: z
          .object({
            text: z.string(),
            speaker: z.string().optional(),
            isUser: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .min(1, 'At least one pearl required'),
  context: z.object({
    extractionGoal: z.string().min(1).max(1000),
    additionalContext: z.string().max(2000).optional(),
  }),
});

// Share the 10/hour rate limit with summarize
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { summaryMarkdown, pearls, context } = parsed.data;

  try {
    const result = await surfaceDecisions(
      summaryMarkdown,
      pearls as Pearl[],
      context as SummaryContext,
    );
    return Response.json(result);
  } catch (err) {
    console.error('Decision generation failed:', err);
    return Response.json({ error: 'Failed to generate decisions' }, { status: 500 });
  }
}
