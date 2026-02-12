import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rate-limit';

const conceptSchema = z.object({ concept: z.string().min(1).max(200) });
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

export async function POST(request: Request) {
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return Response.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = conceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { concept } = parsed.data;

  // Fetch pearls that contain this concept, ordered by recency
  const { data: pearls, error } = await supabase
    .from('pearls')
    .select('id, insight, quote, concepts, created_at')
    .eq('user_id', user.id)
    .contains('concepts', [concept])
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: 'Failed to fetch pearls' }, { status: 500 });
  }

  return Response.json({ pearls: pearls ?? [] });
}
