import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
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
    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await getOtterConnection(auth.supabase, auth.user.id);

    if (result.error) {
      logger.error('Get otter connection error', { route: '/api/otter/connection' });
      return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
    }

    return NextResponse.json({ connection: result.data });
  } catch (error) {
    logger.error('Get otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth) {
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

    // Map API snake_case to model camelCase
    const result = await saveOtterConnection(auth.supabase, auth.user.id, {
      email: parsed.data.otter_email,
      otterUserId: parsed.data.otter_user_id,
      cookies: parsed.data.cookies,
      csrfToken: parsed.data.csrf_token,
    });

    if (result.error) {
      logger.error('Upsert otter connection error', { route: '/api/otter/connection' });
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    logger.error('Upsert otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await deleteOtterConnection(auth.supabase, auth.user.id);

    if (result.error) {
      logger.error('Delete otter connection error', { route: '/api/otter/connection' });
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('Delete otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
