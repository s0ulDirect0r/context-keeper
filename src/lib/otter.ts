// Otter.ai unofficial API client
// Based on https://github.com/gmchad/otterai-api

const BASE_URL = 'https://otter.ai/forward/api/v1';

export interface OtterSession {
  userId: string;
  cookies: string;
  csrfToken?: string;
}

export interface Recording {
  id: string;
  title: string;
  createdAt: Date;
  duration: number; // seconds
  summary?: string;
}

export interface OtterApiResponse<T> {
  status: number;
  data: T;
}

interface SpeechData {
  otid: string;
  title: string;
  created_at: number;
  duration?: number;
  audio_duration?: number;
  summary?: string;
}

interface SpeechesResponse {
  speeches: SpeechData[];
}

interface OtterSpeaker {
  id: number;
  speaker_name: string;
}

interface SpeechDetailResponse {
  speech: {
    otid: string;
    title: string;
    speakers?: OtterSpeaker[];
    transcripts?: Array<{
      transcript: string;
      start_offset: number;
      end_offset: number;
      speaker_id?: number;
    }>;
    monologues?: Array<{
      elements: Array<{
        type: string;
        value: string;
      }>;
      speaker_id?: number;
    }>;
  };
}

export async function otterLogin(
  email: string,
  password: string
): Promise<OtterSession> {
  const authHeader = Buffer.from(`${email}:${password}`).toString('base64');

  const response = await fetch(`${BASE_URL}/login?username=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  // Node.js 18+ has getSetCookie() to get all Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  // Extract cookie name=value pairs and combine them
  const cookiePairs = setCookieHeaders.map((cookie) => {
    const [nameValue] = cookie.split(';');
    return nameValue;
  });
  const cookies = cookiePairs.join('; ');

  // Extract CSRF token
  const csrfCookie = setCookieHeaders.find((c) => c.startsWith('csrftoken='));
  const csrfMatch = csrfCookie?.match(/csrftoken=([^;]+)/);

  const result = (await response.json()) as { status: string; userid: number };

  if (result.status !== 'OK' || !result.userid) {
    throw new Error('Invalid credentials');
  }

  return {
    userId: String(result.userid),
    cookies,
    csrfToken: csrfMatch?.[1],
  };
}

async function fetchSpeeches(
  session: OtterSession,
  source: string,
  pageSize: number
): Promise<SpeechData[]> {
  const url = `${BASE_URL}/speeches?userid=${session.userId}&folder=0&page_size=${pageSize}&source=${source}`;

  try {
    const response = await fetch(url, {
      headers: {
        Cookie: session.cookies,
      },
    });

    if (!response.ok) return [];

    const result = (await response.json()) as { status: string; speeches?: SpeechData[] };
    return result.speeches || [];
  } catch (e) {
    console.error(`[otter] fetchSpeeches(${source}) error:`, e);
    return [];
  }
}

export async function otterGetRecordings(
  session: OtterSession,
  pageSize = 50
): Promise<Recording[]> {
  const [owned, shared] = await Promise.all([
    fetchSpeeches(session, 'owned', pageSize),
    fetchSpeeches(session, 'shared_with_me', pageSize),
  ]);

  const seen = new Set<string>();
  const recordings: Recording[] = [];

  for (const speech of [...owned, ...shared]) {
    if (seen.has(speech.otid)) continue;
    seen.add(speech.otid);

    recordings.push({
      id: speech.otid,
      title: speech.title || 'Untitled',
      createdAt: new Date(speech.created_at * 1000),
      duration: speech.audio_duration || speech.duration || 0,
      summary: speech.summary,
    });
  }

  recordings.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return recordings;
}

export interface TranscriptResult {
  text: string;
  speakerNames: string[];
}

export async function otterGetTranscript(
  session: OtterSession,
  speechId: string
): Promise<TranscriptResult> {
  const url = `${BASE_URL}/speech?userid=${session.userId}&otid=${speechId}`;

  const response = await fetch(url, {
    headers: {
      Cookie: session.cookies,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`);
  }

  const result = (await response.json()) as { status: string; speech?: SpeechDetailResponse['speech'] };

  // Try to extract transcript text from various possible formats
  const speech = result.speech;
  if (!speech) {
    throw new Error('Speech not found');
  }

  // Build speaker ID → name map
  const speakerMap = new Map<number, string>();
  if (speech.speakers) {
    for (const s of speech.speakers) {
      speakerMap.set(s.id, s.speaker_name);
    }
  }

  // Method 1: Direct transcripts array
  if (speech.transcripts && speech.transcripts.length > 0) {
    let lastSpeakerId: number | undefined;
    const parts: string[] = [];

    for (const t of speech.transcripts) {
      if (t.speaker_id !== undefined && t.speaker_id !== lastSpeakerId) {
        const name = speakerMap.get(t.speaker_id) || `Speaker ${t.speaker_id}`;
        parts.push(`\n${name}: ${t.transcript}`);
        lastSpeakerId = t.speaker_id;
      } else {
        parts.push(t.transcript);
      }
    }

    return { text: parts.join(' ').trim(), speakerNames: [...speakerMap.values()] };
  }

  // Method 2: Monologues format
  if (speech.monologues && speech.monologues.length > 0) {
    let lastSpeakerId: number | undefined;
    const parts: string[] = [];

    for (const m of speech.monologues) {
      const text = m.elements
        .filter((e) => e.type === 'text')
        .map((e) => e.value)
        .join(' ');

      if (m.speaker_id !== undefined && m.speaker_id !== lastSpeakerId) {
        const name = speakerMap.get(m.speaker_id) || `Speaker ${m.speaker_id}`;
        parts.push(`\n${name}: ${text}`);
        lastSpeakerId = m.speaker_id;
      } else {
        parts.push(text);
      }
    }

    return { text: parts.join(' ').trim(), speakerNames: [...speakerMap.values()] };
  }

  throw new Error('No transcript content found');
}
