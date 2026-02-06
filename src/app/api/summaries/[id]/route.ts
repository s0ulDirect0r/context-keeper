import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('summaries')
      .select('id, user_id, share_token')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Build update object from allowed fields
    const allowedFields = ['title', 'summaries', 'themes', 'speakers', 'context', 'is_shared', 'transcripts'];
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Generate share token when enabling sharing for the first time
    if (body.is_shared === true && !existing.share_token) {
      updateData.share_token = crypto.randomBytes(16).toString('base64url');
    }

    const { data, error: updateError } = await supabase
      .from('summaries')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update summary:', updateError);
      return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update summary error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
