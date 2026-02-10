import { NextResponse } from 'next/server';
import { extractTags, type SummaryContext } from '@/lib/claude';

export async function POST(request: Request) {
  try {
    const { transcript, context } = await request.json() as {
      transcript: string;
      context: SummaryContext;
    };

    if (!transcript || !context?.extractionGoal) {
      return NextResponse.json(
        { error: 'transcript and context required' },
        { status: 400 }
      );
    }

    const tags = await extractTags(transcript, context);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Tag extraction error:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract tags';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
