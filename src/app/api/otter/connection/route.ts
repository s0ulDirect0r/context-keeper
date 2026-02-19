import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getOtterConnection, saveOtterConnection, deleteOtterConnection } from '@/models/otter';

const upsertSchema = z.object({
  otter_email: z.string().email().max(320),
  otter_user_id: z.string().min(1).max(200),
  cookies: z.string().min(1),
  csrf_token: z.string().max(500).nullable().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getOtterConnection(supabase, user.id);

    return NextResponse.json({ connection });
  } catch (error) {
    logger.error('Get otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    await saveOtterConnection(supabase, user.id, parsed.data);

    return NextResponse.json({ saved: true });
  } catch (error) {
    logger.error('Upsert otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await deleteOtterConnection(supabase, user.id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('Delete otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
