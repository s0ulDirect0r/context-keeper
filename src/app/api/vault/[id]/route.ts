import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toSavedVaultItem, type Database } from '@/lib/supabase/types';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const updateVaultItemSchema = z.object({
  note: z.string().max(2000, 'Note exceeds 2000 chars').nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// 60 updates per hour per IP
const updateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });
// 30 deletes per hour per IP
const deleteLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = updateLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const parsed = updateVaultItemSchema.safeParse(body);
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    const updateFields: Database['public']['Tables']['vault_items']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.note !== undefined) updateFields.note = parsed.data.note;
    if (parsed.data.tags !== undefined) updateFields.tags = parsed.data.tags;

    const { data, error: updateError } = await supabase
      .from('vault_items')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      logger.error(
        'Failed to update vault item',
        { route: '/api/vault/[id]', requestId },
        updateError,
      );
      return NextResponse.json(
        { error: 'Failed to update vault item', requestId },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Vault item not found', requestId }, { status: 404 });
    }

    type VaultRow = Database['public']['Tables']['vault_items']['Row'];
    return NextResponse.json({ item: toSavedVaultItem(data as VaultRow) });
  } catch (error) {
    logger.error('Update vault item error', { route: '/api/vault/[id]', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  const { allowed, retryAfter } = deleteLimiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter, requestId },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required', requestId }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      logger.error(
        'Failed to delete vault item',
        { route: '/api/vault/[id]', requestId },
        deleteError,
      );
      return NextResponse.json(
        { error: 'Failed to delete vault item', requestId },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete vault item error', { route: '/api/vault/[id]', requestId }, error);
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
