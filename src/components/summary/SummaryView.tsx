'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { EditableMarkdown } from './EditableMarkdown';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { copyRichText, structuredSummaryToMarkdown } from '@/lib/utils';
import { consumeSSEToCompletion } from '@/lib/sse';
import { Pencil, Loader2, Share2, Check, Link, Copy, FileDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { downloadMarkdown, downloadPdf } from '@/lib/export';
import type { SummaryContext } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';
import type { SavedSummary } from '@/lib/supabase/types';
import { isStructuredSummary } from '@/lib/summary-types';

// ── Prop shapes ──────────────────────────────────────────────────────

interface InlineData {
  summaries: SummaryContent;
  context: SummaryContext | null;
  transcripts?: string[];
  recordingTitles?: string[];
}

interface BaseProps {
  /** Read-only mode (shared view) */
  readOnly?: boolean;
  /** Back to start */
  onStartOver?: () => void;
}

interface InlineProps extends BaseProps {
  /** Fresh generation data (not yet saved) */
  data: InlineData;
  /** Existing saved summary ID (if auto-saved during generation) */
  savedSummaryId?: string | null;
  /** Called when guest signs up and summary gets saved */
  onSaved?: (id: string) => void;
}

interface SavedProps extends BaseProps {
  /** Loaded from DB */
  summary: SavedSummary;
}

export type SummaryViewProps = InlineProps | SavedProps;

function isSavedProps(props: SummaryViewProps): props is SavedProps {
  return 'summary' in props;
}

// ── Component ────────────────────────────────────────────────────────

export function SummaryView(props: SummaryViewProps) {
  const { user } = useAuth();
  const router = useRouter();
  const saved = isSavedProps(props);

  // Normalize data — either from saved summary or inline generation
  const initialSummaries = saved ? props.summary.summaries : props.data.summaries;
  const initialContext = saved ? props.summary.context : props.data.context;
  const transcripts = saved ? props.summary.transcripts : props.data.transcripts;
  const recordingTitles = saved ? undefined : props.data.recordingTitles;

  // Mutable state for regeneration
  const [summaries, setSummaries] = useState(initialSummaries);
  const [context, setContext] = useState(initialContext);

  // Copy state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Guest sign-up-to-save
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const savedSummaryId = saved ? props.summary.id : ((props as InlineProps).savedSummaryId ?? null);

  // Title editing (saved mode only)
  const [title, setTitle] = useState(saved ? props.summary.title : '');
  const [editingTitle, setEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Save indicator for inline edits
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEditsRef = useRef<string[] | null>(null);

  // Context editing (saved mode with transcripts)
  const [editingContext, setEditingContext] = useState(false);
  const [editExtractionGoal, setEditExtractionGoal] = useState(context?.extractionGoal ?? '');
  const [editAdditional, setEditAdditional] = useState(context?.additionalContext ?? '');
  const [regenerating, setRegenerating] = useState(false);

  // Share state (saved mode only)
  const [isShared, setIsShared] = useState(saved ? props.summary.isShared : false);
  const [shareToken, setShareToken] = useState(saved ? props.summary.shareToken : null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const readOnly = props.readOnly ?? false;
  const summaryId = saved ? props.summary.id : savedSummaryId;
  const hasTranscripts =
    transcripts !== null && transcripts !== undefined && transcripts.length > 0;

  // Guest sign-up-to-save flow
  useEffect(() => {
    if (!saved && user && pendingSave && !savedSummaryId && context) {
      setSaving(true);
      const inlineProps = props as InlineProps;
      fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaries,
          context,
          recordingTitles: inlineProps.data.recordingTitles,
          transcripts: inlineProps.data.transcripts,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.savedSummaryId) {
            inlineProps.onSaved?.(data.savedSummaryId);
            router.push(`/summary/${data.savedSummaryId}`);
          }
        })
        .catch((err) => {
          toast.error('Failed to save summary');
          Sentry.captureException(err);
          setSaving(false);
          setPendingSave(false);
        });
    }
  }, [user, pendingSave, savedSummaryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert old structured summaries to markdown for uniform rendering,
  // then track as mutable state so inline edits are reflected immediately.
  const initialMarkdown = useMemo<string[]>(
    () =>
      isStructuredSummary(summaries)
        ? summaries.map((s) => structuredSummaryToMarkdown(s))
        : summaries,
    [summaries],
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

  // Debounce-save edits to the database for saved summaries
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSavedEdits = useCallback(
    (updated: string[]) => {
      if (!summaryId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingEditsRef.current = updated;
      setSaveStatus('saving');
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/summaries/${summaryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summaries: updated }),
          });
          pendingEditsRef.current = null;
          if (!res.ok) throw new Error('Save failed');
          Sentry.addBreadcrumb({ category: 'summary', message: 'Saved summary edits' });
          setSaveStatus('saved');
          if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
          saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
          toast.error('Failed to save changes', { id: 'save-edits' });
          Sentry.captureException(err);
          setSaveStatus('error');
        }
      }, 800);
    },
    [summaryId],
  );

  // Flush pending edits on unmount and beforeunload
  useEffect(() => {
    const flushPendingEdits = () => {
      if (pendingEditsRef.current && summaryId) {
        fetch(`/api/summaries/${summaryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summaries: pendingEditsRef.current }),
          keepalive: true,
        });
        pendingEditsRef.current = null;
      }
    };

    window.addEventListener('beforeunload', flushPendingEdits);
    return () => {
      window.removeEventListener('beforeunload', flushPendingEdits);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      flushPendingEdits();
    };
  }, [summaryId]);

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

  // ── Handlers ─────────────────────────────────────────────────────

  const getExportTitle = (index: number) => {
    if (recordingTitles && recordingTitles.length > 0) {
      return recordingTitles[index] || recordingTitles[0] || 'summary';
    }
    return saved ? props.summary.title || 'summary' : 'summary';
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await copyRichText(text);
      setCopiedIndex(index);
      toast.success('Copied!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSignUpToSave = () => {
    setPendingSave(true);
    setAuthDialogOpen(true);
  };

  const saveTitle = async (newTitle: string) => {
    if (!saved || savingTitle) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === props.summary.title) {
      setTitle(props.summary.title);
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/summaries/${props.summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error('Save failed');
      setTitle(trimmed);
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      toast.error('Failed to save title');
      Sentry.captureException(err);
      setTitle(props.summary.title);
      setSaveStatus('error');
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  };

  const handleRegenerate = async (mode: 'replace' | 'new') => {
    if (!saved || !transcripts) return;

    setRegenerating(true);
    try {
      const newContext = {
        extractionGoal: editExtractionGoal,
        additionalContext: editAdditional || undefined,
      };

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts,
          context: newContext,
          mode: summaries.length > 1 ? 'separate' : 'combined',
          save: mode === 'new',
        }),
      });

      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
          const err = await response.json();
          message = err.error || message;
        } catch {
          /* non-JSON error response */
        }
        throw new Error(message);
      }

      // /api/summarize returns SSE, not JSON — consume the stream properly
      const data = await consumeSSEToCompletion(response);

      if (mode === 'replace') {
        const newSummaries = data.summaries ?? [];
        await fetch(`/api/summaries/${props.summary.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summaries: newSummaries,
            context: newContext,
          }),
        });

        setSummaries(newSummaries);
        setContext(newContext);
        setEditingContext(false);
      } else {
        if (data.savedSummaryId) {
          router.push(`/summary/${data.savedSummaryId}`);
        }
      }
    } catch (err) {
      toast.error('Regeneration failed');
      Sentry.captureException(err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleShare = async () => {
    if (!summaryId) return;
    try {
      const response = await fetch(`/api/summaries/${summaryId}`, {
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
      toast.error('Failed to enable sharing');
      Sentry.captureException(err);
    }
  };

  const toggleSharing = async () => {
    if (!summaryId) return;
    const newValue = !isShared;
    try {
      await fetch(`/api/summaries/${summaryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_shared: newValue }),
      });
      setIsShared(newValue);
      Sentry.addBreadcrumb({
        category: 'sharing',
        message: `Toggled sharing ${newValue ? 'on' : 'off'}`,
      });
    } catch (err) {
      toast.error('Failed to update sharing');
      Sentry.captureException(err);
    }
  };

  const copyShareLink = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6 min-w-0 flex-1 max-w-3xl">
      {/* Header */}
      {saved ? (
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
                if (e.key === 'Escape') {
                  setTitle(props.summary.title);
                  setEditingTitle(false);
                }
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
              }).format(props.summary.createdAt)}
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
                    {copiedShareLink ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Link className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
              {!isShared && (
                <p className="text-xs text-muted-foreground">
                  Link is currently disabled. Toggle on to allow anyone with the link to view this
                  summary.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
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
            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
                <Check className="h-4 w-4" />
                <span>Saved to your library</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={shareToken ? () => setShowSharePanel(!showSharePanel) : handleShare}
              >
                <Share2 className="h-3.5 w-3.5 mr-1" />
                Share
              </Button>
            </div>
          )}
          {/* Share panel (inline mode) */}
          {showSharePanel && shareToken && (
            <div className="mt-3 p-3 rounded-md border bg-muted/50 space-y-3 text-left max-w-md mx-auto">
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
                    {copiedShareLink ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Link className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
              {!isShared && (
                <p className="text-xs text-muted-foreground">
                  Link is currently disabled. Toggle on to allow anyone with the link to view this
                  summary.
                </p>
              )}
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
      )}

      {/* Summary cards */}
      {markdownSummaries.map((summaryText, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {markdownSummaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
              </CardTitle>
              <div className="flex items-center gap-1.5 no-print">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(summaryText, index)}
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {copiedIndex === index ? 'Copied!' : 'Copy'}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadMarkdown(summaryText, getExportTitle(index))}
                  title="Download as Markdown"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Markdown</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPdf(summaryText, getExportTitle(index))}
                  title="Download as PDF"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <EditableMarkdown
              markdown={summaryText}
              readOnly={readOnly}
              saveStatus={saveStatus}
              onChange={(newText) => {
                setMarkdownSummaries((prev) => {
                  const updated = [...prev];
                  updated[index] = newText;
                  if (summaryId) {
                    persistSavedEdits(updated);
                  } else {
                    persistGuestEdits(updated);
                  }
                  return updated;
                });
              }}
            />
          </CardContent>
        </Card>
      ))}

      {/* Context card */}
      {context && (
        <div className="pt-4">
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Context used for this summary
                </CardTitle>
                {saved && !readOnly && !editingContext && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditExtractionGoal(context?.extractionGoal ?? '');
                      setEditAdditional(context?.additionalContext ?? '');
                      setEditingContext(true);
                    }}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditExtractionGoal(context?.extractionGoal ?? '');
                          setEditAdditional(context?.additionalContext ?? '');
                          setEditingContext(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {context?.extractionGoal ? (
                    <p>
                      <span className="font-medium">What to extract: </span>
                      {context.extractionGoal}
                    </p>
                  ) : (
                    <>
                      {context && 'whatMatters' in context && (
                        <p>
                          <span className="font-medium">What matters: </span>
                          {(context as unknown as { whatMatters: string }).whatMatters}
                        </p>
                      )}
                      {context && 'why' in context && (
                        <p>
                          <span className="font-medium">Purpose: </span>
                          {(context as unknown as { why: string }).why}
                        </p>
                      )}
                    </>
                  )}
                  {context?.additionalContext && (
                    <p>
                      <span className="font-medium">Additional context: </span>
                      {context.additionalContext}
                    </p>
                  )}
                  {saved && !hasTranscripts && !readOnly && (
                    <p className="text-xs text-muted-foreground italic">
                      Original transcript not available for re-generation
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Start over button — inline mode */}
      {!saved && props.onStartOver && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={props.onStartOver}>
            Create another summary
          </Button>
        </div>
      )}

      {!saved && <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />}
    </div>
  );
}
