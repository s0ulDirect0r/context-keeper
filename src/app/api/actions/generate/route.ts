import { z } from 'zod';
import { generateActions } from '@/lib/cedar-ai';
import { createRateLimiter } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import type { SummaryContext, Pearl } from '@/lib/claude';

const generateSchema = z.object({
  decisionId: z.string().min(1),
  decision: z.object({
    statement: z.string().min(1).max(2000),
    reasoning: z.string().max(5000),
  }),
  pearls: z.array(
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
  ),
  context: z.object({
    extractionGoal: z.string().min(1).max(1000),
    additionalContext: z.string().max(2000).optional(),
  }),
});

// Share the 10/hour rate limit with summarize
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  // Auth check — AI generation requires authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { decision, pearls, context } = parsed.data;

  try {
    const result = await generateActions(decision, pearls as Pearl[], context as SummaryContext);
    return Response.json(result);
  } catch (err) {
    console.error('Action generation failed:', err);
    return Response.json({ error: 'Failed to generate actions' }, { status: 500 });
  }
}
