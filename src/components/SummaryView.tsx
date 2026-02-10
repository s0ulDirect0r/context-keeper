'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditableMarkdown } from './EditableMarkdown';
import { AuthDialog } from './AuthDialog';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { copyRichText, structuredSummaryToMarkdown } from '@/lib/utils';
import type { SummaryContext } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';
import { isStructuredSummary } from '@/lib/summary-types';

interface Props {
  summaries: SummaryContent;
  context: SummaryContext | null;
  onStartOver: () => void;
  savedSummaryId?: string | null;
  onSaved?: (id: string) => void;
  recordingTitles?: string[];
  transcripts?: string[];
}

export function SummaryView({ summaries, context, onStartOver, savedSummaryId, onSaved, recordingTitles, transcripts }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // When user signs in and we have a pending save, save the summary and redirect
  useEffect(() => {
    if (user && pendingSave && !savedSummaryId && context) {
      setSaving(true);
      fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaries, context, recordingTitles, transcripts }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.savedSummaryId) {
            onSaved?.(data.savedSummaryId);
            router.push(`/summary/${data.savedSummaryId}`);
          }
        })
        .catch((err) => {
          console.error('Failed to save summary:', err);
          setSaving(false);
          setPendingSave(false);
        });
    }
  }, [user, pendingSave, savedSummaryId, summaries, context, onSaved, router]);

  // Convert old structured summaries to markdown for uniform rendering,
  // then track as mutable state so inline edits are reflected immediately.
  const initialMarkdown = useMemo<string[]>(() =>
    isStructuredSummary(summaries)
      ? summaries.map(s => structuredSummaryToMarkdown(s))
      : summaries,
    [summaries]
  );
  const [markdownSummaries, setMarkdownSummaries] = useState(initialMarkdown);

  // Re-sync if summaries prop changes (e.g. regeneration)
  useEffect(() => {
    setMarkdownSummaries(initialMarkdown);
  }, [initialMarkdown]);

  // Persist guest edits to localStorage so they survive page refreshes
  const persistGuestEdits = useCallback((updated: string[]) => {
    try {
      localStorage.setItem('context-keeper-guest-edits', JSON.stringify(updated));
    } catch {
      // localStorage full or unavailable — ignore
    }
  }, []);

  // Restore guest edits on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('context-keeper-guest-edits');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (parsed.length === initialMarkdown.length) {
          setMarkdownSummaries(parsed);
        } else {
          localStorage.removeItem('context-keeper-guest-edits');
        }
      }
    } catch {
      // Corrupted data — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignUpToSave = () => {
    setPendingSave(true);
    setAuthDialogOpen(true);
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await copyRichText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Your Summary</h2>
        <p className="text-muted-foreground mt-1">
          Copy and paste into WhatsApp, email, or anywhere else
        </p>
        {saving && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving to your library...</span>
          </div>
        )}
        {savedSummaryId && !saving && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
            <Check className="h-4 w-4" />
            <span>Saved to your library</span>
          </div>
        )}
        {!user && !savedSummaryId && !saving && (
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={handleSignUpToSave}>
              Sign up to save this summary
            </Button>
          </div>
        )}
      </div>

      {markdownSummaries.map((summaryText, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {markdownSummaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(summaryText, index)}
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <EditableMarkdown
              markdown={summaryText}
              onChange={(newText) => {
                setMarkdownSummaries(prev => {
                  const updated = [...prev];
                  updated[index] = newText;
                  persistGuestEdits(updated);
                  return updated;
                });
              }}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={onStartOver}>
          Create another summary
        </Button>
      </div>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
}
