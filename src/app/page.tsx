'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useAppMode } from '@/components/AppModeProvider';
import { AuthDialog, type AuthMode } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { InputMethodPicker } from '@/components/InputMethodPicker';
import { OtterLogin } from '@/components/OtterLogin';
import { RecordingList } from '@/components/RecordingList';
import { ManualTranscript } from '@/components/ManualTranscript';
import { ContextWizard } from '@/components/ContextWizard';
import { SummaryModeSelector } from '@/components/SummaryModeSelector';
import { SummaryView } from '@/components/SummaryView';
import { StreamingGenerationView } from '@/components/StreamingGenerationView';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import type { Recording } from '@/lib/otter';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];
import type { SummaryContext, Pearl, ConceptTag } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';
import { SpeakerSelect } from '@/components/SpeakerSelect';
import { TagSelector } from '@/components/TagSelector';
import {
  getStoredSession,
  storeSession,
  clearSession,
  type StoredOtterSession,
} from '@/lib/storage';
import type { User } from '@supabase/supabase-js';

/** Try to auto-match a speaker name to the logged-in user */
function autoMatchUserSpeaker(
  speakerNames: string[],
  otterEmail?: string,
  user?: User | null,
): string | null {
  if (speakerNames.length === 0) return null;

  // Build candidate name fragments from available identity info
  const candidates: string[] = [];

  // From Otter email: e.g. "john.doe@gmail.com" -> ["john", "doe", "john doe"]
  if (otterEmail) {
    const localPart = otterEmail.split('@')[0].replace(/[._+]/g, ' ').trim();
    candidates.push(localPart);
    candidates.push(...localPart.split(' '));
  }

  // From Supabase user metadata
  if (user) {
    const meta = user.user_metadata;
    if (meta?.full_name) candidates.push(meta.full_name);
    if (meta?.name) candidates.push(meta.name);
    if (meta?.first_name) candidates.push(meta.first_name);
    // From user email
    if (user.email) {
      const localPart = user.email.split('@')[0].replace(/[._+]/g, ' ').trim();
      candidates.push(localPart);
      candidates.push(...localPart.split(' '));
    }
  }

  // Case-insensitive match: check if any speaker name contains or matches a candidate
  const lower = candidates.map(c => c.toLowerCase()).filter(c => c.length >= 2);

  for (const speaker of speakerNames) {
    const speakerLower = speaker.toLowerCase();
    for (const candidate of lower) {
      if (speakerLower === candidate || speakerLower.includes(candidate) || candidate.includes(speakerLower)) {
        return speaker;
      }
    }
  }

  return null;
}

/** Extract speaker names from transcript text with "Name: text" format */
function parseSpeakerNames(transcript: string): string[] {
  const speakerPattern = /^([A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)*):\s/gm;
  const names = new Set<string>();
  let match;
  while ((match = speakerPattern.exec(transcript)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

type Step =
  | 'choose-method'
  | 'otter-login'
  | 'otter-recordings'
  | 'manual-transcript'
  | 'speaker-select'
  | 'context-wizard'
  | 'summary-mode'
  | 'generating'
  | 'summary';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { isAppMode, setAppMode } = useAppMode();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [step, setStep] = useState<Step>('choose-method');
  const [inputMethod, setInputMethod] = useState<'otter' | 'manual' | null>(null);
  const [otterSession, setOtterSession] = useState<StoredOtterSession | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [context, setContext] = useState<SummaryContext | null>(null);
  const [summaryMode, setSummaryMode] = useState<'combined' | 'separate'>('combined');
  const [summaries, setSummaries] = useState<SummaryContent>([]);
  const [recordingTitles, setRecordingTitles] = useState<string[]>([]);
  const [recordingDates, setRecordingDates] = useState<string[]>([]);
  const [pearls, setPearls] = useState<Pearl[]>([]);
  const [conceptTags, setConceptTags] = useState<ConceptTag[]>([]);
  const [generatingPearls, setGeneratingPearls] = useState(false);
  // Lifted tag selection state so it survives generating→summary step transition
  const [tagSelection, setTagSelection] = useState<Set<string>>(new Set());
  const [tagCustomTags, setTagCustomTags] = useState<Set<string>>(new Set());
  const [savedSummaryId, setSavedSummaryId] = useState<string | null>(null);

  // Tag extraction state
  const [tagsExtracting, setTagsExtracting] = useState(false);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Speaker identification state
  const [speakerNames, setSpeakerNames] = useState<string[]>([]);
  const [userSpeakerName, setUserSpeakerName] = useState<string | undefined>(undefined);

  // Streaming generation state
  const [streamingMarkdown, setStreamingMarkdown] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMarkdownRef = useRef('');

  // Prefetch state
  const [prefetchedRecordings, setPrefetchedRecordings] = useState<Recording[] | null>(null);
  const prefetchedForSession = useRef<string | null>(null);
  const prefetchPromise = useRef<Promise<Recording[] | null> | null>(null);

  // Load Otter connection based on auth state
  useEffect(() => {
    const loadOtterConnection = async () => {
      setOtterSession(null);

      if (user) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('otter_connections')
          .select('*')
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('Failed to load Otter connection:', error);
          }
          return;
        }

        const row = data as OtterConnectionRow;
        if (row) {
          setOtterSession({
            email: row.otter_email,
            userId: row.otter_user_id,
            cookies: row.cookies,
            csrfToken: row.csrf_token ?? undefined,
          });
        }
      } else {
        setOtterSession(getStoredSession());
      }
    };

    loadOtterConnection();
  }, [user]);

  // Prefetch recordings when we have a cached Otter session
  useEffect(() => {
    if (!otterSession) return;

    // Don't refetch for the same session
    if (prefetchedForSession.current === otterSession.userId) return;
    prefetchedForSession.current = otterSession.userId;

    const doFetch = async (): Promise<Recording[] | null> => {
      try {
        const response = await fetch('/api/otter/recordings', {
          headers: {
            'X-Otter-UserId': otterSession.userId,
            'X-Otter-Cookies': otterSession.cookies,
          },
        });

        if (!response.ok) return null;

        const data = await response.json();
        const recs = data.recordings.map((r: Recording & { createdAt: string }) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }));

        setPrefetchedRecordings(recs);
        return recs;
      } catch {
        return null;
      }
    };

    prefetchPromise.current = doFetch();
  }, [otterSession]);

  const handleMethodSelect = async (method: 'otter' | 'manual') => {
    setInputMethod(method);
    if (method === 'manual') {
      setStep('manual-transcript');
      return;
    }

    if (!otterSession) {
      setStep('otter-login');
      return;
    }

    // Prefetch already completed — use cached recordings instantly
    if (prefetchedRecordings) {
      setRecordings(prefetchedRecordings);
      setStep('otter-recordings');
      return;
    }

    // Prefetch in progress — show loading and wait for it
    if (prefetchPromise.current) {
      setLoadingRecordings(true);
      setStep('otter-recordings');
      const result = await prefetchPromise.current;
      if (result) {
        setRecordings(result);
        setLoadingRecordings(false);
      } else {
        // Prefetch failed (likely expired session), fall through to normal fetch
        setLoadingRecordings(false);
        await fetchRecordings(otterSession);
      }
      return;
    }

    // No prefetch at all, do normal fetch
    await fetchRecordings(otterSession);
  };

  const handleOtterLogin = async (email: string, password: string, remember: boolean) => {
    const response = await fetch('/api/otter/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    const session: StoredOtterSession = {
      email,
      userId: data.userId,
      cookies: data.cookies,
      csrfToken: data.csrfToken,
    };

    if (user) {
      const supabase = createClient();
      const { error } = await supabase.from('otter_connections').upsert({
        user_id: user.id,
        otter_email: email,
        otter_user_id: data.userId,
        cookies: data.cookies,
        csrf_token: data.csrfToken,
      });
      if (error) {
        console.error('Failed to save Otter connection:', error);
      }
    } else if (remember) {
      storeSession(session);
    }

    setOtterSession(session);
    await fetchRecordings(session);
  };

  const fetchRecordings = async (session: StoredOtterSession) => {
    setLoadingRecordings(true);
    setError(null);

    try {
      const response = await fetch('/api/otter/recordings', {
        headers: {
          'X-Otter-UserId': session.userId,
          'X-Otter-Cookies': session.cookies,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recordings');
      }

      setRecordings(
        data.recordings.map((r: Recording & { createdAt: string }) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }))
      );
      setStep('otter-recordings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recordings');
      clearSession();
      setOtterSession(null);
      setStep('otter-login');
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleRecordingSelect = async (recordingIds: string[]) => {
    if (!otterSession) return;

    setLoadingRecordings(true);
    setError(null);

    try {
      const response = await fetch('/api/otter/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Otter-UserId': otterSession.userId,
          'X-Otter-Cookies': otterSession.cookies,
        },
        body: JSON.stringify({ recordingIds }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transcripts');
      }

      const validTranscripts = data.transcripts
        .filter((t: { text: string | null }) => t.text)
        .map((t: { text: string }) => t.text);

      if (validTranscripts.length === 0) {
        throw new Error('No transcripts could be retrieved');
      }

      const selected = recordingIds.map(
        (id: string) => recordings.find((r) => r.id === id)
      );
      setRecordingTitles(selected.map((r) => r?.title || 'Untitled'));
      setRecordingDates(selected.map((r) => r?.createdAt?.toISOString() || ''));

      // Capture speaker names and try to auto-identify the user
      const returnedSpeakers: string[] = data.speakerNames ?? [];
      setSpeakerNames(returnedSpeakers);

      // Auto-match: try the Otter account email's local part or the user's display name
      const matched = autoMatchUserSpeaker(returnedSpeakers, otterSession.email, user);
      setUserSpeakerName(matched ?? undefined);

      setTranscripts(validTranscripts);
      if (returnedSpeakers.length > 1 && !matched) {
        // Multiple speakers but couldn't auto-match — ask the user
        setStep('speaker-select');
      } else {
        setStep('context-wizard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcripts');
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleManualTranscript = (transcript: string) => {
    setRecordingTitles([]);
    setRecordingDates([]);
    setTranscripts([transcript]);

    // Try to extract speaker names from pasted transcript (lines like "Name: ...")
    const parsedSpeakers = parseSpeakerNames(transcript);
    setSpeakerNames(parsedSpeakers);

    if (parsedSpeakers.length > 1) {
      // Try auto-matching against user's display name or email
      const matched = autoMatchUserSpeaker(parsedSpeakers, undefined, user);
      setUserSpeakerName(matched ?? undefined);

      if (!matched) {
        setStep('speaker-select');
        return;
      }
    }

    setStep('context-wizard');
  };

  const handleContextComplete = (ctx: SummaryContext) => {
    setContext(ctx);
    if (transcripts.length > 1) {
      setStep('summary-mode');
    } else {
      startSummaryGeneration(ctx, 'combined');
    }
  };

  const handleSummaryModeSelect = (mode: 'combined' | 'separate') => {
    setSummaryMode(mode);
    startSummaryGeneration(context!, mode);
  };

  const startSummaryGeneration = async (ctx: SummaryContext, mode: 'combined' | 'separate') => {
    // Reset streaming state
    setStreamingMarkdown('');
    streamingMarkdownRef.current = '';
    setIsStreaming(false);
    setPearls([]);
    setConceptTags([]);
    setTagSelection(new Set());
    setTagCustomTags(new Set());
    setStep('generating');
    setError(null);
    setSavedSummaryId(null);
    setTagsExtracting(false);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts,
          context: ctx,
          mode,
          save: !!user,
          recordingTitles,
          recordingDates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (separated by double newlines)
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          let eventName = '';
          let eventData = '';

          for (const line of eventStr.split('\n')) {
            if (line.startsWith('event: ')) {
              eventName = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (eventName && eventData) {
            handleSSEEvent(eventName, JSON.parse(eventData));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      setStep('context-wizard');
    }
  };

  const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case 'summary_chunk':
        streamingMarkdownRef.current += data.text as string;
        setStreamingMarkdown(streamingMarkdownRef.current);
        setIsStreaming(true);
        break;

      case 'summary_done':
        setIsStreaming(false);
        if (data.summaries) {
          setSummaries(data.summaries as string[]);
        }
        break;

      case 'tags_extracting':
        setTagsExtracting(true);
        break;

      case 'tags_done':
        setTagsExtracting(false);
        setConceptTags((data.tags || []) as ConceptTag[]);
        break;

      case 'complete': {
        if (data.savedSummaryId) {
          setSavedSummaryId(data.savedSummaryId as string);
        }
        if (data.summaries) {
          setSummaries(data.summaries as string[]);
        }
        if (data.tags) {
          setConceptTags(data.tags as ConceptTag[]);
        }
        setStep('summary');
        break;
      }

      case 'error':
        break;
    }
  };

  const handleTagSelection = async (selectedTags: string[]) => {
    setGeneratingPearls(true);
    setError(null);

    let generatedPearls: Pearl[] = [];
    try {
      const combinedTranscript = transcripts.join('\n\n---\n\n');

      // Use finalized summaries if available, fall back to streaming markdown
      // (tags_done can fire before summary_done, so summaries may still be empty)
      let summaryMarkdown = Array.isArray(summaries) && summaries.length > 0
        ? summaries.join('\n\n---\n\n')
        : streamingMarkdownRef.current;

      if (!combinedTranscript || !summaryMarkdown || !context?.extractionGoal) {
        throw new Error('Summary is still generating — please wait a moment and try again.');
      }

      const response = await fetch('/api/pearls/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: combinedTranscript,
          summaryMarkdown,
          context,
          speakerIdentity: userSpeakerName ? { userName: userSpeakerName } : undefined,
          selectedTags,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      generatedPearls = data.pearls || [];
      setPearls(generatedPearls);
    } catch (err) {
      console.error('Pearl generation failed:', err);
    }

    // Don't auto-save pearls — let the user curate (keep/discard/edit) first.
    // PearlsSidebar handles saving after curation.
    setGeneratingPearls(false);
    // Don't force step transition — the 'complete' SSE event handles moving
    // from 'generating' to 'summary'. If already on 'summary', no change needed.
  };

  const handleTagSkip = async () => {
    await handleTagSelection([]);
  };

  const handleStartOver = () => {
    setStep('choose-method');
    setInputMethod(null);
    setRecordings([]);
    setTranscripts([]);
    setRecordingTitles([]);
    setRecordingDates([]);
    setContext(null);
    setSummaries([]);
    setPearls([]);
    setConceptTags([]);
    setTagSelection(new Set());
    setTagCustomTags(new Set());
    setSavedSummaryId(null);
    setError(null);
    setStreamingMarkdown('');
    streamingMarkdownRef.current = '';
    setSpeakerNames([]);
    setUserSpeakerName(undefined);
    setTagsExtracting(false);
  };

  const handleDisconnectOtter = async () => {
    if (user) {
      const supabase = createClient();
      await supabase.from('otter_connections').delete().eq('user_id', user.id);
    } else {
      clearSession();
    }
    setOtterSession(null);
    setPrefetchedRecordings(null);
    prefetchedForSession.current = null;
    prefetchPromise.current = null;
  };

  const goBack = (to: Step) => {
    setError(null);
    setStep(to);
  };

  // Landing page for non-authenticated users who haven't clicked "Try it out"
  if (!user && !isAppMode) {
    return (
      <main className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">Context Keeper</h1>
          <p className="text-xl text-muted-foreground">
            Stay connected to what matters the most
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => { setAuthMode('sign-up'); setAuthDialogOpen(true); }}>
              Sign Up
            </Button>
            <Button size="lg" variant="outline" onClick={() => { setAuthMode('sign-in'); setAuthDialogOpen(true); }}>
              Sign In
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setAppMode(true)}>
              Try it out
            </Button>
          </div>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} initialMode={authMode} />
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 rounded-md bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {step === 'choose-method' && (
          <InputMethodPicker
            onSelect={handleMethodSelect}
            connectedOtterEmail={otterSession?.email}
            onDisconnectOtter={handleDisconnectOtter}
            prefetchedRecordingCount={prefetchedRecordings ? prefetchedRecordings.length : otterSession ? null : undefined}
          />
        )}

        {step === 'otter-login' && (
          <OtterLogin
            onLogin={handleOtterLogin}
            onBack={() => goBack('choose-method')}
            initialEmail={otterSession?.email}
          />
        )}

        {step === 'otter-recordings' && (
          <RecordingList
            recordings={recordings}
            onSelect={handleRecordingSelect}
            onBack={() => goBack('choose-method')}
            loading={loadingRecordings}
          />
        )}

        {step === 'manual-transcript' && (
          <ManualTranscript
            onSubmit={handleManualTranscript}
            onBack={() => goBack('choose-method')}
          />
        )}

        {step === 'speaker-select' && (
          <SpeakerSelect
            speakerNames={speakerNames}
            onSelect={(name) => {
              setUserSpeakerName(name ?? undefined);
              setStep('context-wizard');
            }}
            onBack={() =>
              goBack(inputMethod === 'otter' ? 'otter-recordings' : 'manual-transcript')
            }
          />
        )}

        {step === 'context-wizard' && (
          <ContextWizard
            onComplete={handleContextComplete}
            onBack={() =>
              goBack(inputMethod === 'otter' ? 'otter-recordings' : 'manual-transcript')
            }
            recordingCount={transcripts.length}
          />
        )}

        {step === 'summary-mode' && (
          <SummaryModeSelector
            recordingCount={transcripts.length}
            onSelect={handleSummaryModeSelect}
            onBack={() => goBack('context-wizard')}
          />
        )}

        {step === 'generating' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="min-w-0 flex-1 max-w-3xl">
              <StreamingGenerationView
                markdown={streamingMarkdown}
                isStreaming={isStreaming}
              />
            </div>
            <aside className="w-full lg:w-72 xl:w-80 lg:sticky lg:top-8 lg:self-start shrink-0 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:overscroll-contain">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  Focus your pearls
                </h3>
                {conceptTags.length > 0 ? (
                  <TagSelector
                    tags={conceptTags}
                    generating={generatingPearls}
                    onSubmit={handleTagSelection}
                    onSkip={handleTagSkip}
                    selected={tagSelection}
                    onSelectedChange={setTagSelection}
                    customTags={tagCustomTags}
                    onCustomTagsChange={setTagCustomTags}
                    compact
                  />
                ) : (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                    Identifying themes...
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {step === 'summary' && (
          <SummaryView
            data={{
              summaries,
              context,
              transcripts,
              recordingTitles,
            }}
            pearls={pearls}
            savedSummaryId={savedSummaryId}
            onSaved={setSavedSummaryId}
            onStartOver={handleStartOver}
            conceptTags={pearls.length === 0 ? conceptTags : undefined}
            onTagSubmit={pearls.length === 0 ? handleTagSelection : undefined}
            onTagSkip={pearls.length === 0 ? handleTagSkip : undefined}
            generatingPearls={generatingPearls}
            tagSelection={tagSelection}
            onTagSelectionChange={setTagSelection}
            tagCustomTags={tagCustomTags}
            onTagCustomTagsChange={setTagCustomTags}
          />
        )}
      </main>
  );
}
