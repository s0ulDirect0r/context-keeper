'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ConceptTag } from '@/lib/claude';

interface TagSelectorProps {
  tags: ConceptTag[];
  generating?: boolean;
  onSubmit: (selectedTags: string[]) => void;
  onSkip: () => void;
  /** Compact layout for sidebar use */
  compact?: boolean;
  /** Controlled selection state (lifted to parent so it survives remounts) */
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  customTags: Set<string>;
  onCustomTagsChange: (next: Set<string>) => void;
}

export function TagSelector({ tags, generating, onSubmit, onSkip, compact, selected, onSelectedChange, customTags, onCustomTagsChange }: TagSelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const aiTagNames = new Set(tags.map((t) => t.name));

  const toggleTag = (tagName: string) => {
    const next = new Set(selected);
    if (next.has(tagName)) next.delete(tagName);
    else next.add(tagName);
    onSelectedChange(next);
  };

  const removeTag = (tagName: string) => {
    const next = new Set(selected);
    next.delete(tagName);
    onSelectedChange(next);
    if (customTags.has(tagName)) {
      const nextCustom = new Set(customTags);
      nextCustom.delete(tagName);
      onCustomTagsChange(nextCustom);
    }
  };

  const addCustomTag = () => {
    const trimmed = customInput.trim().toLowerCase();
    if (!trimmed) return;
    if (aiTagNames.has(trimmed)) {
      onSelectedChange(new Set(selected).add(trimmed));
    } else {
      onCustomTagsChange(new Set(customTags).add(trimmed));
      onSelectedChange(new Set(selected).add(trimmed));
    }
    setCustomInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
    // Backspace on empty input removes last selected tag
    if (e.key === 'Backspace' && customInput === '' && selected.size > 0) {
      const lastTag = Array.from(selected).pop();
      if (lastTag) removeTag(lastTag);
    }
  };

  const selectedArray = Array.from(selected);
  const selectedCount = selected.size;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      {/* AI-suggested tags — click to toggle */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {compact ? 'Themes' : 'Themes found in the conversation'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => toggleTag(tag.name)}
              disabled={generating}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selected.has(tag.name)
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              } ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={tag.reason}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chip input — selected tags as removable chips + text input */}
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
          generating ? 'opacity-50' : 'cursor-text'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedArray.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-white pl-2.5 pr-1 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              disabled={generating}
              className="rounded-full p-0.5 hover:bg-amber-600 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={generating}
          placeholder={selectedCount === 0 ? 'Type to add a theme...' : ''}
          className="flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground text-xs py-0.5"
        />
      </div>

      {/* Actions */}
      <div className={compact ? 'flex flex-col gap-2 pt-1' : 'flex gap-3 pt-2'}>
        <Button
          size={compact ? 'sm' : 'default'}
          onClick={() => onSubmit(selectedArray)}
          disabled={selectedCount === 0 || generating}
        >
          {generating
            ? 'Generating pearls...'
            : `Generate pearls${selectedCount > 0 ? ` (${selectedCount})` : ''}`
          }
        </Button>
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'default'}
          onClick={onSkip}
          disabled={generating}
        >
          {compact ? 'Skip' : 'Skip — generate without focus'}
        </Button>
      </div>
    </div>
  );
}
