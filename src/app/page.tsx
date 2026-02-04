'use client';

import { useState } from 'react';
import { InputMethodPicker } from '@/components/InputMethodPicker';
import { OtterLogin } from '@/components/OtterLogin';
import { RecordingList } from '@/components/RecordingList';
import { ManualTranscript } from '@/components/ManualTranscript';
import { ContextWizard } from '@/components/ContextWizard';
import { SummaryModeSelector } from '@/components/SummaryModeSelector';
import { SummaryView } from '@/components/SummaryView';
import { LoadingState } from '@/components/LoadingState';
import type { Recording } from '@/lib/otter';
import type { SummaryContext } from '@/lib/claude';
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
  const [step, setStep] = useState<Step>('choose-method');
  const [inputMethod, setInputMethod] = useState<'otter' | 'manual' | null>(null);
  const [otterSession, setOtterSession] = useState<StoredOtterSession | null>(
    () => getStoredSession()
  );
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [context, setContext] = useState<SummaryContext | null>(null);
  const [summaryMode, setSummaryMode] = useState<'combined' | 'separate'>('combined');
  const [summaries, setSummaries] = useState<string[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (remember) {
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

      setTranscripts(validTranscripts);
      setStep('context-wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcripts');
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleManualTranscript = (transcript: string) => {
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

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts,
          context: ctx,
          mode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary');
      }

      setSummaries(data.summaries);
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
    setContext(null);
    setSummaries([]);
    setError(null);
  };

  const goBack = (to: Step) => {
    setError(null);
    setStep(to);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 rounded-md bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {step === 'choose-method' && <InputMethodPicker onSelect={handleMethodSelect} />}

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
            onBack={() => goBack('otter-login')}
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
          <SummaryView summaries={summaries} onStartOver={handleStartOver} />
        )}
      </main>
    </div>
  );
}
