import { z } from 'zod';
import { NextResponse } from 'next/server';
import { otterGetRecordings, otterGetTranscript, type OtterSession } from '@/lib/otter';
import { logger } from '@/lib/logger';

const recordingsPostSchema = z.object({
  recordingIds: z
    .array(z.string().min(1))
    .min(1, 'At least one recording ID required')
    .max(20, 'Maximum 20 recordings'),
});

function getOtterSession(request: Request): OtterSession | null {
  const userId = request.headers.get('X-Otter-UserId');
  const cookies = request.headers.get('X-Otter-Cookies');
  if (!userId || !cookies) return null;
  return { userId, cookies };
}

export async function GET(request: Request) {
  try {
    const session = getOtterSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Missing Otter session' }, { status: 401 });
    }

    const recordings = await otterGetRecordings(session);

    return NextResponse.json({ recordings });
  } catch (error) {
    logger.error(
      'Failed to fetch recordings',
      {
        route: '/api/otter/recordings',
        requestId: request.headers.get('x-request-id') ?? undefined,
      },
      error,
    );
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = getOtterSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Missing Otter session' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = recordingsPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const { recordingIds } = parsed.data;

    const results = await Promise.all(
      recordingIds.map(async (id: string) => {
        try {
          const result = await otterGetTranscript(session, id);
          return { id, text: result.text, speakerNames: result.speakerNames };
        } catch (error) {
          return { id, text: null, speakerNames: [], error: (error as Error).message };
        }
      }),
    );

    // Deduplicate speaker names across all recordings
    const allSpeakerNames = [...new Set(results.flatMap((r) => r.speakerNames))];

    return NextResponse.json({ transcripts: results, speakerNames: allSpeakerNames });
  } catch (error) {
    logger.error(
      'Failed to fetch transcripts',
      {
        route: '/api/otter/recordings',
        requestId: request.headers.get('x-request-id') ?? undefined,
      },
      error,
    );
    return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
  }
}
