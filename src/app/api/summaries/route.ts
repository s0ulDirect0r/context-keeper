import { NextResponse } from 'next/server';
import { type SummaryContext } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function POST(request: Request) {
  try {
    const { summaries, themes, context, recordingTitles, transcripts, speakers } = await request.json();

    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      return NextResponse.json({ error: 'Summaries required' }, { status: 400 });
    }

    if (!context?.extractionGoal) {
      return NextResponse.json({ error: 'Context (extractionGoal) required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const summaryContext: SummaryContext = {
      extractionGoal: context.extractionGoal,
      additionalContext: context.additionalContext,
    };

    const title = deriveTitle(recordingTitles);

    const insertData: Database['public']['Tables']['summaries']['Insert'] = {
      user_id: user.id,
      title,
      summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
      themes: (themes || []) as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
      context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
      transcripts: transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
      speakers: (speakers || []) as unknown as Database['public']['Tables']['summaries']['Insert']['speakers'],
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
