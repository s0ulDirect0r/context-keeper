'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import type { SavedSummary } from '@/lib/supabase/types';
import type { Theme, Speaker } from '@/lib/claude';
import { isStructuredSummary } from '@/lib/summary-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ThemeBubbles } from '@/components/ThemeBubbles';
import { SpeakerToolbar } from '@/components/SpeakerToolbar';
import { StructuredSummaryView } from '@/components/StructuredSummaryView';
import { copyRichText } from '@/lib/utils';
import { Pencil, Loader2, Share2, Check, Link } from 'lucide-react';

interface Props {
  summary: SavedSummary;
  readOnly?: boolean;
}

export function SummaryViewSaved({ summary: initialSummary, readOnly }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [title, setTitle] = useState(summary.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Edit context state
  const [editingContext, setEditingContext] = useState(false);
  const [editExtractionGoal, setEditExtractionGoal] = useState(summary.context.extractionGoal);
  const [editAdditional, setEditAdditional] = useState(summary.context.additionalContext || '');
  const [regenerating, setRegenerating] = useState(false);

  // Share state
  const [isShared, setIsShared] = useState(initialSummary.isShared);
  const [shareToken, setShareToken] = useState(initialSummary.shareToken);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await copyRichText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const saveTitle = async (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === summary.title) {
      setTitle(summary.title);
      setEditingTitle(false);
      return;
    }
    try {
      await fetch(`/api/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      setTitle(trimmed);
    } catch (err) {
      console.error('Failed to save title:', err);
      setTitle(summary.title);
    }
    setEditingTitle(false);
  };

  const handleRegenerate = async (mode: 'replace' | 'new') => {
    if (!summary.transcripts) return;

    setRegenerating(true);
    try {
      const newContext = {
        extractionGoal: editExtractionGoal,
        additionalContext: editAdditional || undefined,
      };

      // Generate new summary + themes + speakers
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: summary.transcripts,
          context: newContext,
          mode: summary.summaries.length > 1 ? 'separate' : 'combined',
          save: mode === 'new',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (mode === 'replace') {
        // PATCH the current summary with new data
        await fetch(`/api/summaries/${summary.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summaries: data.summaries,
            themes: data.themes,
            speakers: data.speakers,
            context: newContext,
          }),
        });

        // Update local state
        setSummary({
          ...summary,
          summaries: data.summaries,
          themes: data.themes || [],
          speakers: data.speakers || [],
          context: newContext,
        });
        setEditingContext(false);
      } else {
        // Redirect to new summary
        if (data.savedSummaryId) {
          router.push(`/summary/${data.savedSummaryId}`);
        }
      }
    } catch (err) {
      console.error('Re-generation failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const startEditContext = () => {
    setEditExtractionGoal(summary.context.extractionGoal);
    setEditAdditional(summary.context.additionalContext || '');
    setEditingContext(true);
  };

  const cancelEditContext = () => {
    setEditExtractionGoal(summary.context.extractionGoal);
    setEditAdditional(summary.context.additionalContext || '');
    setEditingContext(false);
  };

  const handleShare = async () => {
    try {
      const response = await fetch(`/api/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.share_token) {
        throw new Error(data.error || 'Failed to generate share link');
      }
      setShareToken(data.share_token);
      setIsShared(true);
      setShowSharePanel(true);
    } catch (err) {
      console.error('Failed to enable sharing:', err);
    }
  };

  const toggleSharing = async () => {
    const newValue = !isShared;
    try {
      await fetch(`/api/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: newValue }),
      });
      setIsShared(newValue);
    } catch (err) {
      console.error('Failed to toggle sharing:', err);
    }
  };

  const copyShareLink = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  const hasTranscripts = summary.transcripts !== null && summary.transcripts.length > 0;

  return (
    <div className="space-y-6">
      {/* Editable title */}
      <div className="mb-2">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="text-3xl font-bold bg-transparent border-b-2 border-primary outline-none w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveTitle(title)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { setTitle(summary.title); setEditingTitle(false); }
            }}
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-3xl font-bold">{title}</h1>
            {!readOnly && (
              <button
                onClick={() => setEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                aria-label="Edit title"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <p className="text-muted-foreground">
            {new Intl.DateTimeFormat('en-US', {
              dateStyle: 'long',
              timeStyle: 'short',
            }).format(summary.createdAt)}
          </p>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={shareToken ? () => setShowSharePanel(!showSharePanel) : handleShare}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Share
            </Button>
          )}
        </div>

        {/* Share panel */}
        {showSharePanel && shareToken && !readOnly && (
          <div className="mt-3 p-3 rounded-md border bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Public link sharing</span>
              <button
                onClick={toggleSharing}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isShared ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                role="switch"
                aria-checked={isShared}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isShared ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isShared && (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded border truncate">
                  {window.location.origin}/share/{shareToken}
                </code>
                <Button size="sm" variant="outline" onClick={copyShareLink}>
                  {copiedShareLink ? <Check className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
            {!isShared && (
              <p className="text-xs text-muted-foreground">
                Link is currently disabled. Toggle on to allow anyone with the link to view this summary.
              </p>
            )}
          </div>
        )}
      </div>

      {summary.themes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Key themes (click to see quotes)
          </p>
          <ThemeBubbles themes={summary.themes} />
        </div>
      )}

      {summary.speakers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Speakers (click to see quotes)
          </p>
          <SpeakerToolbar speakers={summary.speakers} />
        </div>
      )}

      {isStructuredSummary(summary.summaries) ? (
        summary.summaries.map((s, index) => (
          <StructuredSummaryView
            key={index}
            summary={s}
            index={index}
            total={summary.summaries.length}
          />
        ))
      ) : (
        summary.summaries.map((summaryText, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {summary.summaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
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
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{summaryText}</Markdown>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Context card — read-only or editable */}
      <div className="pt-4">
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Context used for this summary
              </CardTitle>
              {!readOnly && !editingContext && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditContext}
                  disabled={!hasTranscripts}
                  title={!hasTranscripts ? 'Original transcript not available' : undefined}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {editingContext ? (
              <>
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">What to extract</label>
                  <Textarea
                    value={editExtractionGoal}
                    onChange={(e) => setEditExtractionGoal(e.target.value)}
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Additional context</label>
                  <Textarea
                    value={editAdditional}
                    onChange={(e) => setEditAdditional(e.target.value)}
                    className="min-h-20"
                    placeholder="Optional"
                  />
                </div>
                {regenerating ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Re-generating...</span>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleRegenerate('replace')}
                      disabled={!editExtractionGoal.trim()}
                    >
                      Replace current
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerate('new')}
                      disabled={!editExtractionGoal.trim()}
                    >
                      Save as new
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditContext}>
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {summary.context.extractionGoal ? (
                  <p>
                    <span className="font-medium">What to extract: </span>
                    {summary.context.extractionGoal}
                  </p>
                ) : (
                  <>
                    {'whatMatters' in summary.context && (
                      <p>
                        <span className="font-medium">What matters: </span>
                        {(summary.context as unknown as { whatMatters: string }).whatMatters}
                      </p>
                    )}
                    {'why' in summary.context && (
                      <p>
                        <span className="font-medium">Purpose: </span>
                        {(summary.context as unknown as { why: string }).why}
                      </p>
                    )}
                  </>
                )}
                {summary.context.additionalContext && (
                  <p>
                    <span className="font-medium">Additional context: </span>
                    {summary.context.additionalContext}
                  </p>
                )}
                {!hasTranscripts && !readOnly && (
                  <p className="text-xs text-muted-foreground italic">
                    Original transcript not available for re-generation
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
