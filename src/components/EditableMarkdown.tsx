'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, Check } from 'lucide-react';

/**
 * Parse markdown into discrete editable chunks.
 * A "chunk" is either a paragraph (block of non-list text) or a single bullet point.
 * Headings are kept as their own chunk.
 * Consecutive blank lines between blocks are preserved.
 */
function parseChunks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const chunks: string[] = [];
  let currentBlock: string[] = [];

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      chunks.push(currentBlock.join('\n'));
      currentBlock = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Bullet point: each one is its own chunk (includes nested sub-bullets)
    if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      flushBlock();
      const baseIndent = line.length - line.trimStart().length;
      const bulletLines = [line];
      // Collect continuation and nested lines (anything more indented than base)
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() !== '' &&
        !/^#{1,6}\s/.test(lines[i + 1].trimStart()) &&
        (lines[i + 1].length - lines[i + 1].trimStart().length > baseIndent ||
          (!(
            /^[-*+]\s/.test(lines[i + 1].trimStart()) || /^\d+\.\s/.test(lines[i + 1].trimStart())
          ) &&
            (lines[i + 1].startsWith('  ') || lines[i + 1].startsWith('\t'))))
      ) {
        i++;
        bulletLines.push(lines[i]);
      }
      chunks.push(bulletLines.join('\n'));
      continue;
    }

    // Heading: its own chunk
    if (/^#{1,6}\s/.test(trimmed)) {
      flushBlock();
      chunks.push(line);
      continue;
    }

    // Blockquote line: accumulate into current block
    if (trimmed.startsWith('>')) {
      currentBlock.push(line);
      continue;
    }

    // Blank line: flush current block
    if (trimmed === '') {
      flushBlock();
      continue;
    }

    // Regular text: accumulate into paragraph
    currentBlock.push(line);
  }

  flushBlock();
  return chunks;
}

/**
 * Reassemble chunks back into a single markdown string.
 * Chunks are joined with blank lines between them, except consecutive
 * bullet points which get single newlines.
 */
function assembleChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';

  const parts: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prevIsBullet = /^[\s]*[-*+]\s|^[\s]*\d+\.\s/.test(chunks[i - 1]);
    const currIsBullet = /^[\s]*[-*+]\s|^[\s]*\d+\.\s/.test(chunks[i]);

    if (prevIsBullet && currIsBullet) {
      // Consecutive bullets: single newline
      parts.push(chunks[i]);
    } else {
      // Everything else: blank line separator
      parts.push('');
      parts.push(chunks[i]);
    }
  }
  return parts.join('\n');
}

interface EditableChunkProps {
  chunk: string;
  onSave: (newText: string) => void;
  readOnly?: boolean;
}

function EditableChunk({ chunk, onSave, readOnly }: EditableChunkProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(chunk);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes
  useEffect(() => {
    if (!editing) {
      setEditValue(chunk); // eslint-disable-line react-hooks/set-state-in-effect -- intentional prop-to-state sync
    }
  }, [chunk, editing]);

  // Auto-resize textarea and focus when editing starts
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      // Place cursor at end
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chunk) {
      onSave(trimmed);
    } else {
      setEditValue(chunk);
    }
    setEditing(false);
  }, [editValue, chunk, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(chunk);
      setEditing(false);
    }
    // Ctrl/Cmd+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (editing) {
    return (
      <div className="group relative">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-resize
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full resize-none rounded-md border border-ring bg-background pl-3 pr-10 py-2 text-sm font-mono leading-relaxed outline-none ring-2 ring-ring/30"
          rows={1}
        />
        <button
          onMouseDown={(e) => {
            // Prevent blur from firing before click
            e.preventDefault();
            handleSave();
          }}
          className="absolute right-2 top-2 rounded-md p-1 text-primary hover:bg-primary/10 transition-colors"
          aria-label="Save edit"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative pr-8">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{chunk}</Markdown>
      </div>
      {!readOnly && (
        <button
          onClick={() => setEditing(true)}
          className="absolute -right-1 top-0 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all"
          aria-label="Edit this section"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface EditableMarkdownProps {
  markdown: string;
  onChange: (newMarkdown: string) => void;
  readOnly?: boolean;
}

export function EditableMarkdown({ markdown, onChange, readOnly }: EditableMarkdownProps) {
  const chunks = useMemo(() => parseChunks(markdown), [markdown]);

  const handleChunkSave = useCallback(
    (index: number, newText: string) => {
      const updated = [...chunks];
      updated[index] = newText;
      onChange(assembleChunks(updated));
    },
    [chunks, onChange],
  );

  return (
    <div className="space-y-4">
      {chunks.map((chunk, index) => (
        <EditableChunk
          key={index}
          chunk={chunk}
          onSave={(newText) => handleChunkSave(index, newText)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
