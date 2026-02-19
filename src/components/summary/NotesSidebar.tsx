'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { StickyNote, Loader2, Trash2, Pencil, Check, X, Tag, Plus } from 'lucide-react';
import type { SavedVaultItem } from '@/lib/supabase/types';

interface NotesSidebarProps {
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
  /** Called after an item is updated */
  onItemUpdated: (item: SavedVaultItem) => void;
}

export function NotesSidebar({
  summaryId,
  items,
  selectedExcerpt,
  onClearSelection,
  onItemSaved,
  onItemDeleted,
  onItemUpdated,
}: NotesSidebarProps) {
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNewNote, setShowNewNote] = useState(true);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  // When an excerpt is selected, show the note form
  useEffect(() => {
    if (selectedExcerpt) {
      setShowNewNote(true);
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [selectedExcerpt]);

  const handleSave = async () => {
    const trimmedNote = noteText.trim();
    if (!selectedExcerpt && !trimmedNote) return;

    // Flush any pending tag input so it doesn't get lost
    const pendingTag = newTagInput.trim().toLowerCase();
    const finalTags =
      pendingTag && !newTags.includes(pendingTag) ? [...newTags, pendingTag] : newTags;

    setSaving(true);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryId,
          excerptText: selectedExcerpt || undefined,
          note: trimmedNote || undefined,
          tags: finalTags.length > 0 ? finalTags : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onItemSaved(data.item);
      setNoteText('');
      setNewTags([]);
      setNewTagInput('');
      setShowNewNote(false);
      onClearSelection();
      toast.success('Note saved');
    } catch (err) {
      toast.error('Failed to save note');
      Sentry.captureException(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this note?')) return;
    try {
      const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onItemDeleted(id);
      toast.success('Note removed');
    } catch (err) {
      toast.error('Failed to remove note');
      Sentry.captureException(err);
    }
  };

  const handleUpdate = async (id: string, updates: { note?: string | null; tags?: string[] }) => {
    try {
      const res = await fetch(`/api/vault/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      onItemUpdated(data.item);
    } catch (err) {
      toast.error('Failed to update note');
      Sentry.captureException(err);
      throw err;
    }
  };

  const handleCancel = () => {
    setNoteText('');
    setNewTags([]);
    setNewTagInput('');
    setShowNewNote(false);
    onClearSelection();
  };

  const existingTags = getAllTags(items);
  const newTagSuggestions = existingTags.filter(
    (t) => !newTags.includes(t) && t.toLowerCase().includes(newTagInput.toLowerCase()),
  );

  const handleAddNewTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || newTags.includes(normalized)) return;
    setNewTags((prev) => [...prev, normalized]);
    setNewTagInput('');
  };

  const handleRemoveNewTag = (tag: string) => {
    setNewTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="font-semibold text-sm tracking-wide uppercase text-amber-900 dark:text-amber-200">
          Notes
        </h3>
        {items.length > 0 && (
          <span className="text-xs text-amber-600/70 dark:text-amber-400/60">{items.length}</span>
        )}
        {!showNewNote && !selectedExcerpt && (
          <button
            onClick={() => {
              setShowNewNote(true);
              setTimeout(() => noteRef.current?.focus(), 50);
            }}
            className="ml-auto rounded-md p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-800/30 transition-colors"
            aria-label="Add a note"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New note form */}
      {(showNewNote || selectedExcerpt) && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-amber-950/30 shadow-sm p-3 space-y-2">
          {selectedExcerpt && (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  From summary
                </p>
                <p className="text-sm leading-relaxed text-foreground line-clamp-3 italic">
                  &ldquo;{selectedExcerpt}&rdquo;
                </p>
              </div>
              <button
                onClick={onClearSelection}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
                aria-label="Remove quote"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <Textarea
            ref={noteRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={selectedExcerpt ? 'Add your thoughts...' : 'Write a note...'}
            className="min-h-[120px] text-sm"
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') handleCancel();
            }}
          />
          {/* Tags for new note */}
          <div className="flex flex-wrap gap-1 items-center">
            {newTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5"
              >
                {tag}
                <button
                  onClick={() => handleRemoveNewTag(tag)}
                  className="ml-0.5 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <div className="relative">
              <input
                ref={newTagInputRef}
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewTag(newTagInput);
                  }
                  if (e.key === 'Escape') {
                    setNewTagInput('');
                    newTagInputRef.current?.blur();
                  }
                }}
                placeholder="add tag..."
                className="w-20 h-5 text-[10px] px-1.5 rounded border border-amber-300 dark:border-amber-700 bg-transparent outline-none focus:ring-1 focus:ring-amber-400"
              />
              {newTagInput && newTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border rounded shadow-lg z-10 max-h-24 overflow-y-auto">
                  {newTagSuggestions.slice(0, 5).map((s) => (
                    <button
                      key={s}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddNewTag(s);
                      }}
                      className="block w-full text-left text-[10px] px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || (!selectedExcerpt && !noteText.trim())}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <StickyNote className="h-3.5 w-3.5 mr-1" />
                  Save
                </>
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showNewNote && !selectedExcerpt && (
        <p className="text-xs text-amber-700/70 dark:text-amber-400/60">
          Select text or click + to jot a note.
        </p>
      )}

      {/* Notes list */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              allTags={getAllTags(items)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Collect all unique tags across items for autocomplete */
function getAllTags(items: SavedVaultItem[]): string[] {
  const tagSet = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

function NoteCard({
  item,
  onDelete,
  onUpdate,
  allTags,
}: {
  item: SavedVaultItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: { note?: string | null; tags?: string[] }) => Promise<void>;
  allTags: string[];
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags.filter(
    (t) => !item.tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()),
  );

  const handleSaveNote = async () => {
    const trimmed = noteValue.trim();
    const newNote = trimmed || null;
    if (newNote === item.note) {
      setEditingNote(false);
      return;
    }
    setSavingNote(true);
    try {
      await onUpdate(item.id, { note: newNote });
      setEditingNote(false);
    } catch {
      // error toasted by parent
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddTag = async (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || item.tags.includes(normalized)) return;
    try {
      await onUpdate(item.id, { tags: [...item.tags, normalized] });
      setTagInput('');
      setShowTagInput(false);
    } catch {
      // error toasted by parent
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await onUpdate(item.id, { tags: item.tags.filter((t) => t !== tag) });
    } catch {
      // error toasted by parent
    }
  };

  return (
    <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/30 bg-white dark:bg-amber-950/30 shadow-sm p-3 text-sm space-y-2 group">
      {/* Excerpt (if from a selection) */}
      {item.excerptText && (
        <p className="text-sm leading-relaxed text-foreground/70 italic border-l-2 border-amber-300 dark:border-amber-700 pl-2">
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
      <div className="flex flex-wrap gap-1 items-center">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5"
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="ml-0.5 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {showTagInput ? (
          <div className="relative">
            <input
              ref={tagInputRef}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
                if (e.key === 'Escape') {
                  setShowTagInput(false);
                  setTagInput('');
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowTagInput(false);
                  setTagInput('');
                }, 150);
              }}
              placeholder="tag..."
              className="w-20 h-5 text-[10px] px-1.5 rounded border border-amber-300 dark:border-amber-700 bg-transparent outline-none focus:ring-1 focus:ring-amber-400"
              autoFocus
            />
            {tagInput && suggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border rounded shadow-lg z-10 max-h-24 overflow-y-auto">
                {suggestions.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddTag(s);
                    }}
                    className="block w-full text-left text-[10px] px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setShowTagInput(true);
              setTimeout(() => tagInputRef.current?.focus(), 50);
            }}
            className="rounded-full p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-600 dark:hover:text-amber-400 transition-all"
            aria-label="Add tag"
          >
            <Tag className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
            new Date(item.createdAt),
          )}
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
            aria-label="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
