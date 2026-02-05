import { NextResponse } from 'next/server';
import { generateSummary, extractThemes, type SummaryContext } from '@/lib/claude';

export async function POST(request: Request) {
  try {
    const { transcripts, context, mode } = await request.json();

    if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
      return NextResponse.json({ error: 'At least one transcript required' }, { status: 400 });
    }

    if (!context?.who || !context?.whatMatters || !context?.why) {
      return NextResponse.json({ error: 'Context (who, whatMatters, why) required' }, { status: 400 });
    }

    const summaryContext: SummaryContext = {
      who: context.who,
      whatMatters: context.whatMatters,
      why: context.why,
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

    return NextResponse.json({ summaries, themes });
  } catch (error) {
    console.error('Summary generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
