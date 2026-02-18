'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { Bookmark, Loader2, Trash2, Pencil, Check, X } from 'lucide-react';
import type { SavedVaultItem } from '@/lib/supabase/types';

interface VaultSidebarProps {
  summaryId: string;
  items: SavedVaultItem[];
  /** Text the user has selected in the summary */
  selectedExcerpt: string | null;
  /** Clear the selection after save or dismiss */
  onClearSelection: () => void;
  /** Called after a new item is saved */
  onItemSaved: (item: SavedVaultItem) => void;
  /** Called after an item is deleted */
  onItemDeleted: (id: string) => void;
  /** Called after an item's note is updated */
  onItemUpdated: (item: SavedVaultItem) => void;
}

export function VaultSidebar({
  summaryId,
  items,
  selectedExcerpt,
  onClearSelection,
  onItemSaved,
  onItemDeleted,
  onItemUpdated,
}: VaultSidebarProps) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Focus note field when a new excerpt is selected
  useEffect(() => {
    if (selectedExcerpt && noteRef.current) {
      noteRef.current.focus();
    }
  }, [selectedExcerpt]);

  const handleSave = async () => {
    if (!selectedExcerpt) return;
    setSaving(true);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryId,
          excerptText: selectedExcerpt,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onItemSaved(data.item);
      setNote('');
      onClearSelection();
      toast.success('Saved to vault');
    } catch (err) {
      toast.error('Failed to save highlight');
      Sentry.captureException(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this highlight from your vault?')) return;
    try {
      const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onItemDeleted(id);
      toast.success('Removed from vault');
    } catch (err) {
      toast.error('Failed to remove highlight');
      Sentry.captureException(err);
    }
  };

  const handleNoteUpdated = async (id: string, newNote: string | null) => {
    try {
      const res = await fetch(`/api/vault/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      onItemUpdated(data.item);
    } catch (err) {
      toast.error('Failed to update note');
      Sentry.captureException(err);
      throw err; // re-throw so VaultItemCard can handle UI state
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-blue-500" />
        <h3 className="font-semibold text-sm tracking-wide uppercase text-blue-900 dark:text-blue-200">
          Vault
        </h3>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-blue-600/70 dark:text-blue-400/60">
            {items.length}
          </span>
        )}
      </div>

      {/* Save form — appears when text is selected */}
      {selectedExcerpt ? (
        <div className="rounded-lg border border-blue-300 dark:border-blue-700/50 bg-white dark:bg-blue-950/30 shadow-sm p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Selected text
          </p>
          <p className="text-sm leading-relaxed text-foreground line-clamp-4">
            &ldquo;{selectedExcerpt}&rdquo;
          </p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Note <span className="normal-case font-normal">(optional)</span>
          </p>
          <Textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why does this resonate?"
            className="min-h-[60px] text-sm"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  Save
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNote('');
                onClearSelection();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-blue-700/70 dark:text-blue-400/60">
          Select text in the summary to save it to your vault.
        </p>
      ) : null}

      {/* Saved items */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <VaultItemCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onNoteUpdated={handleNoteUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultItemCard({
  item,
  onDelete,
  onNoteUpdated,
}: {
  item: SavedVaultItem;
  onDelete: (id: string) => void;
  onNoteUpdated: (id: string, note: string | null) => Promise<void>;
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
      await onNoteUpdated(item.id, newNote);
      setEditingNote(false);
    } catch {
      // error already toasted by parent
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/30 bg-white dark:bg-blue-950/30 shadow-sm p-3 text-sm space-y-2 group">
      <p className="text-sm leading-relaxed text-foreground">&ldquo;{item.excerptText}&rdquo;</p>

      {editingNote ? (
        <div className="space-y-1">
          <Textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            className="min-h-[40px] text-xs"
            maxLength={1000}
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
          className="text-xs text-muted-foreground italic cursor-pointer hover:text-foreground transition-colors"
          onClick={() => setEditingNote(true)}
          title="Click to edit note"
        >
          {item.note}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(item.createdAt))}
        </span>
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
            aria-label="Delete highlight"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
