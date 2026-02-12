'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Check, X, Loader2, Gem, Pencil } from 'lucide-react';
import type { Pearl } from '@/lib/claude';
import type { SavedPearl } from '@/lib/supabase/types';

interface CurationProps {
  mode: 'curate';
  pearls: Pearl[];
  summaryId: string | null;
  onSaved?: (saved: SavedPearl[]) => void;
  isLoggedIn: boolean;
}

interface DisplayProps {
  mode: 'display';
  pearls: SavedPearl[];
}

type Props = CurationProps | DisplayProps;

export function PearlsSidebar(props: Props) {
  if (props.mode === 'display') {
    return <PearlsDisplay pearls={props.pearls} />;
  }
  return <PearlsCuration {...props} />;
}

function PearlsDisplay({ pearls }: { pearls: SavedPearl[] }) {
  if (pearls.length === 0) return null;

  return (
    <PearlPanel>
      <div className="space-y-3">
        {pearls.map((pearl) => (
          <PearlCard
            key={pearl.id}
            insight={pearl.insight}
            concepts={pearl.concepts}
            quote={pearl.quote}
          />
        ))}
      </div>
    </PearlPanel>
  );
}

function PearlsCuration({ pearls, summaryId, onSaved, isLoggedIn }: CurationProps) {
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'discard'>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Pearl>>({});

  if (pearls.length === 0) return null;

  // Overlay edits onto kept pearls so saves include user modifications
  const keptPearls = pearls.filter((p) => decisions[p.id] === 'keep').map((p) => edits[p.id] ?? p);

  const handleDecision = (pearlId: string, decision: 'keep' | 'discard') => {
    setDecisions((prev) => ({ ...prev, [pearlId]: decision }));
  };

  const startEditing = (pearl: Pearl) => {
    // Seed edit form with current state (use existing edits if already modified)
    setEdits((prev) => ({ ...prev, [pearl.id]: prev[pearl.id] ?? { ...pearl } }));
    setEditingId(pearl.id);
  };

  const handleEditDone = () => {
    setEditingId(null);
  };

  const handleEditCancel = (pearlId: string) => {
    setEditingId(null);
    // Discard edits but preserve any existing keep/discard decision
    setEdits((prev) => {
      const next = { ...prev };
      delete next[pearlId];
      return next;
    });
  };

  const updateEdit = (pearlId: string, patch: Partial<Pearl>) => {
    setEdits((prev) => ({
      ...prev,
      [pearlId]: { ...prev[pearlId], ...patch },
    }));
  };

  const handleSave = async () => {
    if (!summaryId || keptPearls.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch('/api/pearls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pearls: keptPearls, summaryId }),
      });

      const data = await response.json();
      if (response.ok && data.pearls) {
        setSaved(true);
        onSaved?.(data.pearls);
      }
    } catch (err) {
      console.error('Failed to save pearls:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PearlPanel subtitle="Observations from the conversation. Keep the ones worth tracking.">
      <div className="space-y-3">
        {pearls.map((pearl) => {
          const decision = decisions[pearl.id];
          if (decision === 'discard') {
            return (
              <div
                key={pearl.id}
                className="opacity-40 line-through text-xs text-muted-foreground py-1"
              >
                {pearl.insight.slice(0, 60)}...
                <button
                  onClick={() => {
                    setDecisions((prev) => {
                      const next = { ...prev };
                      delete next[pearl.id];
                      return next;
                    });
                  }}
                  className="ml-2 underline no-underline-on-hover"
                >
                  undo
                </button>
              </div>
            );
          }

          if (editingId === pearl.id) {
            return (
              <PearlEditForm
                key={pearl.id}
                draft={edits[pearl.id]}
                onUpdate={(patch) => updateEdit(pearl.id, patch)}
                onDone={handleEditDone}
                onCancel={() => handleEditCancel(pearl.id)}
              />
            );
          }

          // Show the pearl card (with edits overlaid if previously edited)
          const displayPearl = edits[pearl.id] ?? pearl;
          return (
            <div
              key={pearl.id}
              className={`relative ${decision === 'keep' ? 'ring-1 ring-amber-400/50 rounded-lg' : ''}`}
            >
              <PearlCard
                insight={displayPearl.insight}
                concepts={displayPearl.concepts}
                quote={displayPearl.quote}
              />
              {!saved && (
                <div className="flex gap-1 mt-1.5">
                  <Button
                    variant={decision === 'keep' ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => handleDecision(pearl.id, 'keep')}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Keep
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-muted-foreground"
                    onClick={() => startEditing(pearl)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-muted-foreground"
                    onClick={() => handleDecision(pearl.id, 'discard')}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Discard
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button — only for logged-in users with a summary ID */}
      {isLoggedIn && summaryId && !saved && keptPearls.length > 0 && (
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            `Save ${keptPearls.length} pearl${keptPearls.length === 1 ? '' : 's'}`
          )}
        </Button>
      )}

      {saved && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center">Pearls saved</p>
      )}

      {!isLoggedIn && keptPearls.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">Sign up to save your pearls</p>
      )}
    </PearlPanel>
  );
}

function PearlPanel({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gem className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-sm tracking-wide uppercase text-amber-900 dark:text-amber-200">
          Pearls
        </h3>
      </div>
      {subtitle && <p className="text-xs text-amber-700/70 dark:text-amber-400/60">{subtitle}</p>}
      {children}
    </div>
  );
}

function PearlEditForm({
  draft,
  onUpdate,
  onDone,
  onCancel,
}: {
  draft: Pearl;
  onUpdate: (patch: Partial<Pearl>) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [conceptInput, setConceptInput] = useState('');
  const conceptInputRef = useRef<HTMLInputElement>(null);

  const addConcept = () => {
    const trimmed = conceptInput.trim().toLowerCase();
    if (!trimmed || draft.concepts.includes(trimmed)) {
      setConceptInput('');
      return;
    }
    onUpdate({ concepts: [...draft.concepts, trimmed] });
    setConceptInput('');
  };

  const removeConcept = (concept: string) => {
    onUpdate({ concepts: draft.concepts.filter((c) => c !== concept) });
  };

  const handleConceptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addConcept();
    }
    if (e.key === 'Backspace' && conceptInput === '' && draft.concepts.length > 0) {
      removeConcept(draft.concepts[draft.concepts.length - 1]);
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-white dark:bg-amber-950/30 shadow-sm p-3 space-y-2">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Insight
      </label>
      <Textarea
        value={draft.insight}
        onChange={(e) => onUpdate({ insight: e.target.value })}
        className="text-sm min-h-[60px]"
      />
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Concepts
      </label>
      <div
        className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm cursor-text"
        onClick={() => conceptInputRef.current?.focus()}
      >
        {draft.concepts.map((concept) => (
          <span
            key={concept}
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 pl-2 pr-1 py-0.5 text-[10px] font-medium"
          >
            {concept}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeConcept(concept);
              }}
              className="rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
              aria-label={`Remove ${concept}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={conceptInputRef}
          value={conceptInput}
          onChange={(e) => setConceptInput(e.target.value)}
          onKeyDown={handleConceptKeyDown}
          placeholder={draft.concepts.length === 0 ? 'Add concept...' : ''}
          className="flex-1 min-w-[60px] bg-transparent outline-none placeholder:text-muted-foreground text-[11px] py-0.5"
        />
      </div>
      {draft.quote && (
        <>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Quote
          </label>
          <Input
            value={draft.quote.text}
            onChange={(e) => onUpdate({ quote: { ...draft.quote!, text: e.target.value } })}
            className="text-sm"
          />
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Speaker
          </label>
          <Input
            value={draft.quote.speaker ?? ''}
            onChange={(e) =>
              onUpdate({ quote: { ...draft.quote!, speaker: e.target.value || undefined } })
            }
            className="text-sm"
          />
        </>
      )}
      <div className="flex gap-1 pt-1">
        <Button size="sm" className="h-6 text-xs px-2" onClick={onDone}>
          Done
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PearlCard({
  insight,
  concepts,
  quote,
}: {
  insight: string;
  concepts: string[];
  quote?: { text: string; speaker?: string; isUser?: boolean } | null;
}) {
  const isUserQuote = quote?.isUser ?? false;

  return (
    <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/30 bg-white dark:bg-amber-950/30 shadow-sm p-3 text-sm space-y-2">
      {/* Quote as headline */}
      {quote && (
        <div>
          <p className="text-sm font-medium leading-snug text-foreground">
            &ldquo;{quote.text}&rdquo;
          </p>
          {quote.speaker && (
            <p className="text-[11px] mt-1 text-muted-foreground">
              &mdash; {quote.speaker}
              {isUserQuote && <span className="ml-1 font-medium">(you)</span>}
            </p>
          )}
        </div>
      )}
      {/* Insight as supporting text */}
      <p className="text-xs leading-relaxed text-muted-foreground">{insight}</p>
      <div className="flex flex-wrap gap-1">
        {concepts.map((concept) => (
          <span
            key={concept}
            className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium"
          >
            {concept}
          </span>
        ))}
      </div>
    </div>
  );
}
