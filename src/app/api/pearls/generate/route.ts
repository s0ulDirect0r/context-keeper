import { NextResponse } from 'next/server';
import { extractPearls, type SummaryContext, type SpeakerIdentity } from '@/lib/claude';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { transcript, summaryMarkdown, context, speakerIdentity, selectedTags } =
      (await request.json()) as {
        transcript: string;
        summaryMarkdown: string;
        context: SummaryContext;
        speakerIdentity?: SpeakerIdentity;
        selectedTags?: string[];
      };

    if (!transcript || !summaryMarkdown || !context?.extractionGoal) {
      return NextResponse.json(
        { error: 'transcript, summaryMarkdown, and context required' },
        { status: 400 },
      );
    }

    const pearls = await extractPearls(
      transcript,
      summaryMarkdown,
      context,
      speakerIdentity,
      selectedTags,
    );

    return NextResponse.json({ pearls });
  } catch (error) {
    logger.error(
      'Pearl generation error',
      {
        route: '/api/pearls/generate',
        requestId: request.headers.get('x-request-id') ?? undefined,
      },
      error,
    );
    const message = error instanceof Error ? error.message : 'Failed to generate pearls';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
