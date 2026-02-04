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

interface SpeechDetailResponse {
  speech: {
    otid: string;
    title: string;
    transcripts?: Array<{
      transcript: string;
      start_offset: number;
      end_offset: number;
      speaker_id?: string;
    }>;
    monologues?: Array<{
      elements: Array<{
        type: string;
        value: string;
      }>;
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

export async function otterGetRecordings(
  session: OtterSession,
  pageSize = 20
): Promise<Recording[]> {
  const url = `${BASE_URL}/speeches?userid=${session.userId}&folder=0&page_size=${pageSize}&source=owned`;

  const response = await fetch(url, {
    headers: {
      Cookie: session.cookies,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recordings: ${response.status}`);
  }

  const result = (await response.json()) as { status: string; speeches?: SpeechData[] };

  if (!result.speeches) {
    return [];
  }

  return result.speeches.map((speech) => ({
    id: speech.otid,
    title: speech.title || 'Untitled',
    createdAt: new Date(speech.created_at * 1000),
    duration: speech.audio_duration || speech.duration || 0,
    summary: speech.summary,
  }));
}

export async function otterGetTranscript(
  session: OtterSession,
  speechId: string
): Promise<string> {
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

  // Method 1: Direct transcripts array
  if (speech.transcripts && speech.transcripts.length > 0) {
    return speech.transcripts.map((t) => t.transcript).join(' ');
  }

  // Method 2: Monologues format
  if (speech.monologues && speech.monologues.length > 0) {
    return speech.monologues
      .flatMap((m) => m.elements.filter((e) => e.type === 'text').map((e) => e.value))
      .join(' ');
  }

  throw new Error('No transcript content found');
}
