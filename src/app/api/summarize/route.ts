import { NextResponse } from 'next/server';
import { generateSummary, extractThemes, generateTitle, type SummaryContext } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const { transcripts, context, mode, save } = await request.json();

    if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
      return NextResponse.json({ error: 'At least one transcript required' }, { status: 400 });
    }

    if (!context?.extractionGoal) {
      return NextResponse.json({ error: 'Context (extractionGoal) required' }, { status: 400 });
    }

    const summaryContext: SummaryContext = {
      extractionGoal: context.extractionGoal,
      additionalContext: context.additionalContext,
    };

    const summaryMode = mode === 'separate' ? 'separate' : 'combined';

    // Combine transcripts for theme extraction (always analyze all content together)
    const combinedTranscript = transcripts.join('\n\n---\n\n');

    // Run summary generation and theme extraction in parallel
    const [summaries, themes] = await Promise.all([
      generateSummary(transcripts, summaryContext, summaryMode),
      extractThemes(combinedTranscript, summaryContext),
    ]);

    let savedSummaryId: string | null = null;

    // Auto-save if requested and user is authenticated
    if (save) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Generate a punchy title
        const combinedSummary = summaries.join('\n\n');
        const title = await generateTitle(combinedSummary);

        const insertData: Database['public']['Tables']['summaries']['Insert'] = {
          user_id: user.id,
          title,
          summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
          themes: themes as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
          context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
        };

        const { data, error: saveError } = await supabase
          .from('summaries')
          .insert(insertData)
          .select('id')
          .single();

        if (saveError) {
          console.error('Failed to save summary:', saveError);
        } else {
          savedSummaryId = data.id;
        }
      }
    }

    return NextResponse.json({ summaries, themes, savedSummaryId });
  } catch (error) {
    console.error('Summary generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
