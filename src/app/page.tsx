'use client';

import { useState, useEffect } from 'react';
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
import { LoadingState } from '@/components/LoadingState';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import type { Recording } from '@/lib/otter';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];
import type { SummaryContext, Theme, Speaker } from '@/lib/claude';
import {
  getStoredSession,
  storeSession,
  clearSession,
  type StoredOtterSession,
} from '@/lib/storage';

type Step =
  | 'choose-method'
  | 'otter-login'
  | 'otter-recordings'
  | 'manual-transcript'
  | 'context-wizard'
  | 'summary-mode'
  | 'generating'
  | 'summary';

export default function Home() {
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
  const [summaries, setSummaries] = useState<string[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [recordingTitles, setRecordingTitles] = useState<string[]>([]);
  const [savedSummaryId, setSavedSummaryId] = useState<string | null>(null);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Otter connection based on auth state
  // Logged in: Supabase is source of truth
  // Guest: localStorage is source of truth
  useEffect(() => {
    const loadOtterConnection = async () => {
      // Clear existing state first to avoid stale data
      setOtterSession(null);

      if (user) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('otter_connections')
          .select('*')
          .single();

        if (error) {
          // PGRST116 = no rows found, which is fine
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
        // Guest mode: use localStorage
        setOtterSession(getStoredSession());
      }
    };

    loadOtterConnection();
  }, [user]);

  const handleMethodSelect = async (method: 'otter' | 'manual') => {
    setInputMethod(method);
    if (method === 'manual') {
      setStep('manual-transcript');
    } else {
      // Check for existing session
      if (otterSession) {
        // Try to use existing session
        await fetchRecordings(otterSession);
      } else {
        setStep('otter-login');
      }
    }
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

    // Save Otter connection based on auth state
    if (user) {
      // Logged in: save to Supabase
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
      // Guest mode: save to localStorage if "remember me" checked
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
      // If session is invalid, clear it and go to login
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

      // Capture Otter recording titles for use as summary title
      const titles = recordingIds.map(
        (id: string) => recordings.find((r) => r.id === id)?.title || 'Untitled'
      );
      setRecordingTitles(titles);
      setTranscripts(validTranscripts);
      setStep('context-wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcripts');
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleManualTranscript = (transcript: string) => {
    setRecordingTitles([]);
    setTranscripts([transcript]);
    setStep('context-wizard');
  };

  const handleContextComplete = (ctx: SummaryContext) => {
    setContext(ctx);
    if (transcripts.length > 1) {
      setStep('summary-mode');
    } else {
      generateSummary(ctx, 'combined');
    }
  };

  const handleSummaryModeSelect = (mode: 'combined' | 'separate') => {
    setSummaryMode(mode);
    generateSummary(context!, mode);
  };

  const generateSummary = async (ctx: SummaryContext, mode: 'combined' | 'separate') => {
    setStep('generating');
    setError(null);
    setSavedSummaryId(null);

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
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary');
      }

      setSummaries(data.summaries);
      setThemes(data.themes || []);
      setSpeakers(data.speakers || []);
      setSavedSummaryId(data.savedSummaryId || null);
      setStep('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      setStep('context-wizard');
    }
  };

  const handleStartOver = () => {
    setStep('choose-method');
    setInputMethod(null);
    setRecordings([]);
    setTranscripts([]);
    setRecordingTitles([]);
    setContext(null);
    setSummaries([]);
    setThemes([]);
    setSpeakers([]);
    setSavedSummaryId(null);
    setError(null);
  };

  const handleDisconnectOtter = async () => {
    if (user) {
      const supabase = createClient();
      await supabase.from('otter_connections').delete().eq('user_id', user.id);
    } else {
      clearSession();
    }
    setOtterSession(null);
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

        {step === 'generating' && <LoadingState />}

        {step === 'summary' && (
          <SummaryView
            summaries={summaries}
            themes={themes}
            context={context}
            onStartOver={handleStartOver}
            savedSummaryId={savedSummaryId}
            onSaved={setSavedSummaryId}
            recordingTitles={recordingTitles}
            speakers={speakers}
            transcripts={transcripts}
          />
        )}
      </main>
  );
}
