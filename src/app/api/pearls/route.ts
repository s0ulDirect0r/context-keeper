import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Pearl } from '@/lib/claude';
import { toSavedPearl, type Database } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const { pearls, summaryId } = await request.json() as {
      pearls: Pearl[];
      summaryId: string;
    };

    if (!pearls || !Array.isArray(pearls) || pearls.length === 0) {
      return NextResponse.json({ error: 'At least one pearl required' }, { status: 400 });
    }

    if (!summaryId) {
      return NextResponse.json({ error: 'summaryId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Delete existing pearls for this summary (handles regeneration case)
    await supabase
      .from('pearls')
      .delete()
      .eq('summary_id', summaryId)
      .eq('user_id', user.id);

    // Insert kept pearls
    const rows = pearls.map((pearl) => ({
      user_id: user.id,
      summary_id: summaryId,
      insight: pearl.insight,
      concepts: pearl.concepts,
      quote: (pearl.quote ?? null) as Database['public']['Tables']['pearls']['Insert']['quote'],
    }));

    const { data, error: insertError } = await supabase
      .from('pearls')
      .insert(rows)
      .select('*');

    if (insertError) {
      console.error('Failed to save pearls:', insertError);
      return NextResponse.json({ error: 'Failed to save pearls' }, { status: 500 });
    }

    type PearlRow = Database['public']['Tables']['pearls']['Row'];
    return NextResponse.json({
      pearls: ((data ?? []) as PearlRow[]).map(toSavedPearl),
    });
  } catch (error) {
    console.error('Save pearls error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save pearls';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
