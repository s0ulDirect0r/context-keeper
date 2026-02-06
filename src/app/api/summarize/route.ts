import { NextResponse } from 'next/server';
import { generateSummary, extractThemes, extractSpeakers, type SummaryContext } from '@/lib/claude';
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
    const { transcripts, context, mode, save, recordingTitles, otterSpeakerNames } = await request.json();

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

    // Run summary generation, theme extraction, and speaker extraction in parallel
    const [summaries, themes, speakers] = await Promise.all([
      generateSummary(transcripts, summaryContext, summaryMode, {
        titles: recordingTitles,
      }),
      extractThemes(combinedTranscript, summaryContext),
      extractSpeakers(combinedTranscript, otterSpeakerNames),
    ]);

    let savedSummaryId: string | null = null;

    // Auto-save if requested and user is authenticated
    if (save) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const title = deriveTitle(recordingTitles);

        const insertData: Database['public']['Tables']['summaries']['Insert'] = {
          user_id: user.id,
          title,
          summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
          themes: themes as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
          context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
          speakers: speakers as unknown as Database['public']['Tables']['summaries']['Insert']['speakers'],
          transcripts: transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
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

    return NextResponse.json({ summaries, themes, speakers, savedSummaryId });
  } catch (error) {
    console.error('Summary generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
