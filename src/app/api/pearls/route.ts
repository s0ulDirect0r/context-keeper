import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Pearl } from '@/lib/claude';
import { toSavedPearl, type Database } from '@/lib/supabase/types';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const pearlItemSchema = z.object({
  id: z.string().optional(),
  insight: z.string().min(1, 'Insight is required').max(500, 'Insight exceeds 500 chars'),
  concepts: z
    .array(z.string().max(50))
    .min(1, 'At least one concept required')
    .max(5, 'Maximum 5 concepts'),
  quote: z
    .object({
      text: z.string().min(1).max(2000),
      speaker: z.string().optional(),
      isUser: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

const savePearlsSchema = z.object({
  pearls: z
    .array(pearlItemSchema)
    .min(1, 'At least one pearl required')
    .max(50, 'Maximum 50 pearls'),
  summaryId: z.string().uuid('Invalid summary ID'),
  selectedTags: z.array(z.string()).optional(),
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

    const parsed = savePearlsSchema.safeParse(body);
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

    const { pearls, summaryId, selectedTags } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    // Delete existing pearls for this summary (handles regeneration case)
    const { error: deleteError } = await supabase
      .from('pearls')
      .delete()
      .eq('summary_id', summaryId)
      .eq('user_id', user.id);

    if (deleteError) {
      logger.error(
        'Failed to delete existing pearls',
        { route: '/api/pearls', requestId },
        deleteError,
      );
      return NextResponse.json({ error: 'Failed to update pearls', requestId }, { status: 500 });
    }

    // Insert kept pearls
    const rows = (pearls as Pearl[]).map((pearl) => ({
      user_id: user.id,
      summary_id: summaryId,
      insight: pearl.insight,
      concepts: pearl.concepts,
      quote: (pearl.quote ?? null) as Database['public']['Tables']['pearls']['Insert']['quote'],
    }));

    const { data, error: insertError } = await supabase.from('pearls').insert(rows).select('*');

    if (insertError) {
      logger.error('Failed to save pearls', { route: '/api/pearls', requestId }, insertError);
      return NextResponse.json({ error: 'Failed to save pearls', requestId }, { status: 500 });
    }

    // Store selected tags on the summary if provided
    if (selectedTags && selectedTags.length > 0) {
      await supabase
        .from('summaries')
        .update({ selected_tags: selectedTags })
        .eq('id', summaryId)
        .eq('user_id', user.id);
    }

    type PearlRow = Database['public']['Tables']['pearls']['Row'];
    return NextResponse.json({
      pearls: ((data ?? []) as PearlRow[]).map(toSavedPearl),
    });
  } catch (error) {
    logger.error('Save pearls error', { route: '/api/pearls', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
