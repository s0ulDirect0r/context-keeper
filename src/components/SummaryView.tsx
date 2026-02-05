'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeBubbles } from './ThemeBubbles';
import { AuthDialog } from './AuthDialog';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { markdownToPlainText } from '@/lib/utils';
import type { Theme, SummaryContext } from '@/lib/claude';

interface Props {
  summaries: string[];
  themes: Theme[];
  context: SummaryContext | null;
  onStartOver: () => void;
  savedSummaryId?: string | null;
  onSaved?: (id: string) => void;
}

export function SummaryView({ summaries, themes, context, onStartOver, savedSummaryId, onSaved }: Props) {
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
        body: JSON.stringify({ summaries, themes, context }),
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
  }, [user, pendingSave, savedSummaryId, summaries, themes, context, onSaved, router]);

  const handleSignUpToSave = () => {
    setPendingSave(true);
    setAuthDialogOpen(true);
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      const plainText = markdownToPlainText(text);
      await navigator.clipboard.writeText(plainText);
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

      {themes.length > 0 && (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            Key themes (click to see quotes)
          </p>
          <ThemeBubbles themes={themes} />
        </div>
      )}

      {summaries.map((summary, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {summaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(summary, index)}
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{summary}</Markdown>
            </div>
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
