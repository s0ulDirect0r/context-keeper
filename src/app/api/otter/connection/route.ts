import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];

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

    const { data, error } = await supabase
      .from('otter_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // PGRST116 = no rows found — not an error
      if (error.code === 'PGRST116') {
        return NextResponse.json({ connection: null });
      }
      logger.error('Failed to fetch otter connection', { route: '/api/otter/connection' }, error);
      return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
    }

    const row = data as OtterConnectionRow;
    return NextResponse.json({
      connection: {
        email: row.otter_email,
        userId: row.otter_user_id,
        cookies: row.cookies,
        csrfToken: row.csrf_token ?? undefined,
      },
    });
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

    const { error } = await supabase.from('otter_connections').upsert({
      user_id: user.id,
      otter_email: parsed.data.otter_email,
      otter_user_id: parsed.data.otter_user_id,
      cookies: parsed.data.cookies,
      csrf_token: parsed.data.csrf_token ?? null,
    });

    if (error) {
      logger.error('Failed to upsert otter connection', { route: '/api/otter/connection' }, error);
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { error } = await supabase.from('otter_connections').delete().eq('user_id', user.id);

    if (error) {
      logger.error('Failed to delete otter connection', { route: '/api/otter/connection' }, error);
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('Delete otter connection error', { route: '/api/otter/connection' }, error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
