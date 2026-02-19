'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { StickyNote, Trash2, Pencil, Check, X, Loader2, FileText, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

export interface VaultItemWithSummary {
  id: string;
  summaryId: string;
  summaryTitle: string;
  excerptText: string | null;
  note: string | null;
  tags: string[];
  createdAt: string; // ISO string (serialized from server)
}

interface VaultDashboardProps {
  initialItems: VaultItemWithSummary[];
  totalCount: number;
}

/** Group vault items by summary, maintaining reverse-chronological order of first item per group. */
function groupBySummary(items: VaultItemWithSummary[]) {
  const groups = new Map<
    string,
    { summaryId: string; summaryTitle: string; items: VaultItemWithSummary[] }
  >();

  for (const item of items) {
    const existing = groups.get(item.summaryId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.summaryId, {
        summaryId: item.summaryId,
        summaryTitle: item.summaryTitle,
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

function deserializeVaultRow(item: Record<string, unknown>): VaultItemWithSummary {
  return {
    id: item.id as string,
    summaryId: item.summary_id as string,
    summaryTitle: (item.summaries as { title: string } | null)?.title ?? 'Untitled',
    excerptText: (item.excerpt_text as string | null) ?? null,
    note: item.note as string | null,
    tags: (item.tags as string[]) ?? [],
    createdAt: item.created_at as string,
  };
}

export function VaultDashboard({ initialItems, totalCount }: VaultDashboardProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 50;
  const hasMore = items.length < total;

  // Fetch data client-side when mounted with no initial items (tab click)
  useEffect(() => {
    if (initialItems.length > 0 || total > 0) return;

    let cancelled = false;
    async function fetchVaultItems() {
      setLoading(true);
      try {
        const res = await fetch(`/api/vault?limit=${PAGE_SIZE}&offset=0`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items.map(deserializeVaultRow));
        setTotal(data.total);
      } catch (err) {
        if (!cancelled) {
          toast.error('Failed to load vault items');
          Sentry.captureException(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVaultItems();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only run on mount

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(items.length),
      });
      const res = await fetch(`/api/vault?${params}`);
      if (!res.ok) throw new Error('Load more failed');
      const data = await res.json();
      const newItems = data.items.map(deserializeVaultRow);
      setItems((prev) => [...prev, ...newItems]);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load more items');
      Sentry.captureException(err);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this note?')) return;
    try {
      const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      toast.success('Note removed');
    } catch (err) {
      toast.error('Failed to remove note');
      Sentry.captureException(err);
    }
  };

  const handleNoteUpdate = async (id: string, newNote: string | null) => {
    try {
      const res = await fetch(`/api/vault/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, note: data.item.note } : item)),
      );
    } catch (err) {
      toast.error('Failed to update note');
      Sentry.captureException(err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <StickyNote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No notes yet</h2>
        <p className="text-muted-foreground mb-4">Open a summary and jot down your thoughts.</p>
        <Link href="/dashboard">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Browse summaries
          </Button>
        </Link>
      </div>
    );
  }

  const groups = groupBySummary(items);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.summaryId}>
          <Link
            href={`/summary/${group.summaryId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors mb-3"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            {group.summaryTitle}
          </Link>

          <div className="space-y-2 ml-6 border-l-2 border-amber-200 dark:border-amber-800/40 pl-4">
            {group.items.map((item) => (
              <VaultDashboardItem
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onNoteUpdate={handleNoteUpdate}
              />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${items.length} of ${total})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function VaultDashboardItem({
  item,
  onDelete,
  onNoteUpdate,
}: {
  item: VaultItemWithSummary;
  onDelete: (id: string) => void;
  onNoteUpdate: (id: string, note: string | null) => Promise<void>;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note ?? '');
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    const trimmed = noteValue.trim();
    const newNote = trimmed || null;
    if (newNote === item.note) {
      setEditingNote(false);
      return;
    }
    setSavingNote(true);
    try {
      await onNoteUpdate(item.id, newNote);
      setEditingNote(false);
    } catch {
      // error already toasted by parent
    } finally {
      setSavingNote(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(item.createdAt));

  return (
    <div className="group rounded-lg border border-amber-200/80 dark:border-amber-800/30 bg-white dark:bg-amber-950/10 p-3 text-sm space-y-2">
      {/* Excerpt (if from a selection) */}
      {item.excerptText && (
        <p className="leading-relaxed text-foreground/70 italic border-l-2 border-amber-300 dark:border-amber-700 pl-2">
          &ldquo;{item.excerptText}&rdquo;
        </p>
      )}

      {/* Note body */}
      {editingNote ? (
        <div className="space-y-1">
          <Textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            className="min-h-[40px] text-xs"
            maxLength={2000}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSaveNote();
              }
              if (e.key === 'Escape') {
                setNoteValue(item.note ?? '');
                setEditingNote(false);
              }
            }}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={handleSaveNote}
              disabled={savingNote}
            >
              {savingNote ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => {
                setNoteValue(item.note ?? '');
                setEditingNote(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : item.note ? (
        <p
          className="text-sm leading-relaxed cursor-pointer hover:text-foreground/80 transition-colors"
          onClick={() => setEditingNote(true)}
          title="Click to edit"
        >
          {item.note}
        </p>
      ) : null}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              setNoteValue(item.note ?? '');
              setEditingNote(true);
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Edit note"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="rounded p-0.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-muted transition-colors"
            aria-label="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
