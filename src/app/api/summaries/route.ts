import { NextResponse } from 'next/server';
import { generateTitle, type SummaryContext, type Theme } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const { summaries, themes, context } = await request.json();

    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      return NextResponse.json({ error: 'Summaries required' }, { status: 400 });
    }

    if (!context?.who || !context?.whatMatters || !context?.why) {
      return NextResponse.json({ error: 'Context (who, whatMatters, why) required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const summaryContext: SummaryContext = {
      who: context.who,
      whatMatters: context.whatMatters,
      why: context.why,
      additionalContext: context.additionalContext,
    };

    // Generate a punchy title
    const combinedSummary = summaries.join('\n\n');
    const title = await generateTitle(combinedSummary);

    const insertData: Database['public']['Tables']['summaries']['Insert'] = {
      user_id: user.id,
      title,
      summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
      themes: (themes || []) as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
      context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
    };

    const { data, error: saveError } = await supabase
      .from('summaries')
      .insert(insertData)
      .select('id')
      .single();

    if (saveError) {
      console.error('Failed to save summary:', saveError);
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }

    return NextResponse.json({ savedSummaryId: data.id, title });
  } catch (error) {
    console.error('Save summary error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
