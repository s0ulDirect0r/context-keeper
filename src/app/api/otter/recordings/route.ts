import { NextResponse } from 'next/server';
import { otterGetRecordings, otterGetTranscript, type OtterSession } from '@/lib/otter';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('X-Otter-UserId');
    const cookies = request.headers.get('X-Otter-Cookies');

    if (!userId || !cookies) {
      return NextResponse.json({ error: 'Missing Otter session' }, { status: 401 });
    }

    const session: OtterSession = { userId, cookies };
    const recordings = await otterGetRecordings(session);

    return NextResponse.json({ recordings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recordings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Fetch transcripts for specific recordings
  try {
    const userId = request.headers.get('X-Otter-UserId');
    const cookies = request.headers.get('X-Otter-Cookies');
    const { recordingIds } = await request.json();

    if (!userId || !cookies) {
      return NextResponse.json({ error: 'Missing Otter session' }, { status: 401 });
    }

    if (!recordingIds || !Array.isArray(recordingIds)) {
      return NextResponse.json({ error: 'recordingIds array required' }, { status: 400 });
    }

    const session: OtterSession = { userId, cookies };

    const results = await Promise.all(
      recordingIds.map(async (id: string) => {
        try {
          const result = await otterGetTranscript(session, id);
          return { id, text: result.text, speakerNames: result.speakerNames };
        } catch (error) {
          return { id, text: null, speakerNames: [], error: (error as Error).message };
        }
      })
    );

    // Deduplicate speaker names across all recordings
    const allSpeakerNames = [...new Set(results.flatMap((r) => r.speakerNames))];

    return NextResponse.json({ transcripts: results, speakerNames: allSpeakerNames });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transcripts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
