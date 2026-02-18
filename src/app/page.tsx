'use client';

import { useState, useEffect, useRef, useReducer } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useAppMode } from '@/components/AppModeProvider';
import { AuthDialog, type AuthMode } from '@/components/AuthDialog';
import { LandingPage } from '@/components/LandingPage';
import { InputMethodPicker } from '@/components/InputMethodPicker';
import { OtterLogin } from '@/components/OtterLogin';
import { RecordingList } from '@/components/RecordingList';
import { ManualTranscript } from '@/components/ManualTranscript';
import { PasteTranscript } from '@/components/PasteTranscript';
import { ContextWizard } from '@/components/ContextWizard';
import { SummaryModeSelector } from '@/components/SummaryModeSelector';
import { SummaryView } from '@/components/SummaryView';
import { StreamingGenerationView } from '@/components/StreamingGenerationView';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import type { Recording } from '@/lib/otter';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];
import type { SummaryContext, ConceptTag } from '@/lib/claude';
import {
  getStoredSession,
  storeSession,
  clearSession,
  type StoredOtterSession,
} from '@/lib/storage';
import type { User } from '@supabase/supabase-js';
import { generationReducer, initialState } from '@/lib/generation-reducer';
import { consumeSSE } from '@/lib/sse';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

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
  const lower = candidates.map((c) => c.toLowerCase()).filter((c) => c.length >= 2);

  for (const speaker of speakerNames) {
    const speakerLower = speaker.toLowerCase();
    for (const candidate of lower) {
      if (
        speakerLower === candidate ||
        speakerLower.includes(candidate) ||
        candidate.includes(speakerLower)
      ) {
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

export default function Home() {
  const { user } = useAuth();
  const { isAppMode, setAppMode } = useAppMode();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');

  // Consolidated generation state
  const [state, dispatch] = useReducer(generationReducer, initialState);

  // Otter session — external to reducer (loaded from DB/localStorage)
  const [otterSession, setOtterSession] = useState<StoredOtterSession | null>(null);

  // Refs that can't live in the reducer
  const streamingMarkdownRef = useRef('');
  const prefetchedForSession = useRef<string | null>(null);
  const prefetchPromise = useRef<Promise<Recording[] | null> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = null;
      }
      abortControllerRef.current?.abort('unmount');
      abortControllerRef.current = null;
    };
  }, []);

  // Load Otter connection based on auth state
  useEffect(() => {
    const loadOtterConnection = async () => {
      setOtterSession(null);

      if (user) {
        const supabase = createClient();
        const { data, error } = await supabase.from('otter_connections').select('*').single();

        if (error) {
          if (error.code !== 'PGRST116') {
            Sentry.captureException(error);
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

        dispatch({ type: 'SET_PREFETCHED_RECORDINGS', recordings: recs });
        return recs;
      } catch {
        return null;
      }
    };

    prefetchPromise.current = doFetch();
  }, [otterSession]);

  const handleMethodSelect = async (method: 'otter' | 'manual' | 'paste') => {
    dispatch({ type: 'SET_INPUT_METHOD', method });
    if (method === 'manual') {
      dispatch({ type: 'SET_STEP', step: 'manual-transcript' });
      return;
    }
    if (method === 'paste') {
      dispatch({ type: 'SET_STEP', step: 'paste-transcript' });
      return;
    }

    if (!otterSession) {
      dispatch({ type: 'SET_STEP', step: 'otter-login' });
      return;
    }

    // Prefetch already completed — use cached recordings instantly
    if (state.prefetchedRecordings) {
      dispatch({ type: 'SET_RECORDINGS', recordings: state.prefetchedRecordings });
      dispatch({ type: 'SET_STEP', step: 'otter-recordings' });
      return;
    }

    // Prefetch in progress — show loading and wait for it
    if (prefetchPromise.current) {
      dispatch({ type: 'SET_LOADING_RECORDINGS', loading: true });
      dispatch({ type: 'SET_STEP', step: 'otter-recordings' });
      const result = await prefetchPromise.current;
      if (result) {
        dispatch({ type: 'SET_RECORDINGS', recordings: result });
        dispatch({ type: 'SET_LOADING_RECORDINGS', loading: false });
      } else {
        // Prefetch failed (likely expired session), fall through to normal fetch
        dispatch({ type: 'SET_LOADING_RECORDINGS', loading: false });
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
        Sentry.captureException(error);
      }
    } else if (remember) {
      storeSession(session);
    }

    setOtterSession(session);
    Sentry.addBreadcrumb({ category: 'otter', message: 'Connected to Otter.ai' });
    await fetchRecordings(session);
  };

  const fetchRecordings = async (session: StoredOtterSession) => {
    dispatch({ type: 'SET_LOADING_RECORDINGS', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });

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

      dispatch({
        type: 'SET_RECORDINGS',
        recordings: data.recordings.map((r: Recording & { createdAt: string }) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })),
      });
      dispatch({ type: 'SET_STEP', step: 'otter-recordings' });
    } catch (err) {
      clearSession();
      setOtterSession(null);
      dispatch({
        type: 'SET_STEP_WITH_ERROR',
        step: 'otter-login',
        error: err instanceof Error ? err.message : 'Failed to fetch recordings',
      });
    } finally {
      dispatch({ type: 'SET_LOADING_RECORDINGS', loading: false });
    }
  };

  const handleRecordingSelect = async (recordingIds: string[]) => {
    if (!otterSession) return;

    dispatch({ type: 'SET_LOADING_RECORDINGS', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });

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

      const selected = recordingIds.map((id: string) => state.recordings.find((r) => r.id === id));
      const titles = selected.map((r) => r?.title || 'Untitled');
      const dates = selected.map((r) => r?.createdAt?.toISOString() || '');

      // Capture speaker names and try to auto-identify the user
      const returnedSpeakers: string[] = data.speakerNames ?? [];
      const matched = autoMatchUserSpeaker(returnedSpeakers, otterSession.email, user);

      dispatch({
        type: 'TRANSCRIPTS_LOADED',
        transcripts: validTranscripts,
        recordingTitles: titles,
        recordingDates: dates,
        speakerNames: returnedSpeakers,
        userSpeakerName: matched ?? undefined,
        nextStep: 'context-wizard',
      });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch transcripts',
      });
    } finally {
      dispatch({ type: 'SET_LOADING_RECORDINGS', loading: false });
    }
  };

  const handleManualTranscript = (transcript: string) => {
    // Try to extract speaker names from pasted transcript (lines like "Name: ...")
    const parsedSpeakers = parseSpeakerNames(transcript);
    const matched =
      parsedSpeakers.length > 1 ? autoMatchUserSpeaker(parsedSpeakers, undefined, user) : null;

    dispatch({
      type: 'TRANSCRIPTS_LOADED',
      transcripts: [transcript],
      recordingTitles: [],
      recordingDates: [],
      speakerNames: parsedSpeakers,
      userSpeakerName: matched ?? undefined,
      nextStep: 'context-wizard',
    });
  };

  const handleContextComplete = (ctx: SummaryContext) => {
    dispatch({ type: 'SET_CONTEXT', context: ctx });
    if (state.transcripts.length > 1) {
      dispatch({ type: 'SET_STEP', step: 'summary-mode' });
    } else {
      startSummaryGeneration(ctx, 'combined');
    }
  };

  const handleSummaryModeSelect = (mode: 'combined' | 'separate') => {
    dispatch({ type: 'SET_SUMMARY_MODE', mode });
    startSummaryGeneration(state.context!, mode);
  };

  const cancelGeneration = () => {
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
    abortControllerRef.current?.abort('user_cancel');
    abortControllerRef.current = null;
  };

  const startSummaryGeneration = async (ctx: SummaryContext, mode: 'combined' | 'separate') => {
    // Cancel any in-progress generation
    cancelGeneration();

    // Reset streaming ref (can't be in reducer)
    streamingMarkdownRef.current = '';
    // Clear stale guest edits so they don't overwrite the new summary on mount
    try {
      localStorage.removeItem('context-keeper-guest-edits');
    } catch {
      /* noop */
    }
    dispatch({ type: 'GENERATION_START' });
    Sentry.addBreadcrumb({ category: 'generation', message: 'Started summary generation' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 120-second timeout safety net
    generationTimeoutRef.current = setTimeout(() => {
      controller.abort('timeout');
    }, 120_000);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: state.transcripts,
          context: ctx,
          mode,
          save: !!user,
          recordingTitles: state.recordingTitles,
          recordingDates: state.recordingDates,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Failed to generate summary';
        if (response.status === 429) {
          toast.error('Rate limit reached. Try again later.', { duration: Infinity });
        }
        throw new Error(errorMsg);
      }

      await consumeSSE(response, handleSSEEvent);
    } catch (err) {
      // Don't report user cancellations as errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        const reason = controller.signal.reason;
        if (reason === 'timeout') {
          dispatch({
            type: 'GENERATION_FAILED',
            error: 'Generation timed out. Try a shorter transcript or try again.',
            stayOnGenerating: true,
          });
        } else {
          // User cancelled — go back to context wizard
          dispatch({ type: 'SET_STEP', step: 'context-wizard' });
        }
        return;
      }
      dispatch({
        type: 'GENERATION_FAILED',
        error: err instanceof Error ? err.message : 'Failed to generate summary',
      });
    } finally {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
    }
  };

  const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
    if (abortControllerRef.current?.signal.aborted) return;

    switch (event) {
      case 'summary_chunk':
        streamingMarkdownRef.current += data.text as string;
        dispatch({ type: 'SSE_SUMMARY_CHUNK', text: data.text as string });
        break;

      case 'summary_done':
        dispatch({
          type: 'SSE_SUMMARY_DONE',
          summaries: data.summaries as string[] | undefined,
        });
        break;

      case 'tags_extracting':
        dispatch({ type: 'SSE_TAGS_EXTRACTING' });
        break;

      case 'tags_done':
        dispatch({
          type: 'SSE_TAGS_DONE',
          tags: (data.tags || []) as ConceptTag[],
        });
        break;

      case 'complete':
        dispatch({
          type: 'SSE_COMPLETE',
          savedSummaryId: data.savedSummaryId as string | undefined,
          summaries: data.summaries as string[] | undefined,
          tags: data.tags as ConceptTag[] | undefined,
        });
        // Notify user if DB save failed during generation
        if (data.saveError) {
          toast.error('Summary generated but could not be saved. Try saving manually.');
        }
        Sentry.addBreadcrumb({ category: 'generation', message: 'Summary generation complete' });
        break;

      case 'error': {
        const message = (data.message as string) || 'Something went wrong during generation';
        toast.error(message);
        Sentry.captureException(new Error(message));
        dispatch({
          type: 'GENERATION_FAILED',
          error: message,
        });
        break;
      }
    }
  };

  const handleStartOver = () => {
    streamingMarkdownRef.current = '';
    try {
      localStorage.removeItem('context-keeper-guest-edits');
    } catch {
      /* noop */
    }
    dispatch({ type: 'START_OVER' });
  };

  const handleDisconnectOtter = async () => {
    if (user) {
      const supabase = createClient();
      await supabase.from('otter_connections').delete().eq('user_id', user.id);
    } else {
      clearSession();
    }
    setOtterSession(null);
    dispatch({ type: 'SET_PREFETCHED_RECORDINGS', recordings: null });
    prefetchedForSession.current = null;
    prefetchPromise.current = null;
  };

  const goBack = (to: typeof state.step) => {
    dispatch({ type: 'SET_STEP', step: to });
  };

  // Landing page for non-authenticated users who haven't clicked "Try it out"
  if (!user && !isAppMode) {
    return (
      <>
        <LandingPage
          onTryFree={() => setAppMode(true)}
          onSignUp={() => {
            setAuthMode('sign-up');
            setAuthDialogOpen(true);
          }}
          onSignIn={() => {
            setAuthMode('sign-in');
            setAuthDialogOpen(true);
          }}
        />
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} initialMode={authMode} />
      </>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
      {state.error && state.step !== 'generating' && (
        <div className="max-w-2xl mx-auto mb-6 rounded-md bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200">
          {state.error}
        </div>
      )}

      {state.step === 'choose-method' && (
        <InputMethodPicker
          onSelect={handleMethodSelect}
          connectedOtterEmail={otterSession?.email}
          onDisconnectOtter={handleDisconnectOtter}
          prefetchedRecordingCount={
            state.prefetchedRecordings
              ? state.prefetchedRecordings.length
              : otterSession
                ? null
                : undefined
          }
        />
      )}

      {state.step === 'otter-login' && (
        <OtterLogin
          onLogin={handleOtterLogin}
          onBack={() => goBack('choose-method')}
          initialEmail={otterSession?.email}
        />
      )}

      {state.step === 'otter-recordings' && (
        <RecordingList
          recordings={state.recordings}
          onSelect={handleRecordingSelect}
          onBack={() => goBack('choose-method')}
          loading={state.loadingRecordings}
        />
      )}

      {state.step === 'manual-transcript' && (
        <ManualTranscript
          onSubmit={handleManualTranscript}
          onBack={() => goBack('choose-method')}
        />
      )}

      {state.step === 'paste-transcript' && (
        <PasteTranscript onSubmit={handleManualTranscript} onBack={() => goBack('choose-method')} />
      )}

      {state.step === 'context-wizard' && (
        <ContextWizard
          onComplete={handleContextComplete}
          onBack={() =>
            goBack(
              state.inputMethod === 'otter'
                ? 'otter-recordings'
                : state.inputMethod === 'paste'
                  ? 'paste-transcript'
                  : 'manual-transcript',
            )
          }
          recordingCount={state.transcripts.length}
        />
      )}

      {state.step === 'summary-mode' && (
        <SummaryModeSelector
          recordingCount={state.transcripts.length}
          onSelect={handleSummaryModeSelect}
          onBack={() => goBack('context-wizard')}
        />
      )}

      {state.step === 'generating' && (
        <StreamingGenerationView
          markdown={state.streamingMarkdown}
          isStreaming={state.isStreaming}
          error={state.error}
          onCancel={() => {
            cancelGeneration();
            dispatch({ type: 'SET_STEP', step: 'context-wizard' });
          }}
          onRetry={() => {
            if (state.context) {
              startSummaryGeneration(state.context, state.summaryMode);
            }
          }}
        />
      )}

      {state.step === 'summary' && (
        <SummaryView
          data={{
            summaries: state.summaries,
            context: state.context,
            transcripts: state.transcripts,
            recordingTitles: state.recordingTitles,
          }}
          savedSummaryId={state.savedSummaryId}
          onSaved={(id) => dispatch({ type: 'SET_SAVED_SUMMARY_ID', id })}
          onStartOver={handleStartOver}
        />
      )}
    </main>
  );
}
