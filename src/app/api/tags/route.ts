import { NextResponse } from 'next/server';
import { extractTags, type SummaryContext } from '@/lib/claude';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { transcript, context } = (await request.json()) as {
      transcript: string;
      context: SummaryContext;
    };

    if (!transcript || !context?.extractionGoal) {
      return NextResponse.json({ error: 'transcript and context required' }, { status: 400 });
    }

    const tags = await extractTags(transcript, context);
    return NextResponse.json({ tags });
  } catch (error) {
    logger.error(
      'Tag extraction error',
      { route: '/api/tags', requestId: request.headers.get('x-request-id') ?? undefined },
      error,
    );
    const message = error instanceof Error ? error.message : 'Failed to extract tags';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
