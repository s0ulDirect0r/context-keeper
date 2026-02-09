'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Gem } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gem className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-sm">Pearls</h3>
      </div>
      <div className="space-y-3">
        {pearls.map((pearl) => (
          <PearlCard key={pearl.id} insight={pearl.insight} concepts={pearl.concepts} quote={pearl.quote} />
        ))}
      </div>
    </div>
  );
}

function PearlsCuration({ pearls, summaryId, onSaved, isLoggedIn }: CurationProps) {
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'discard'>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (pearls.length === 0) return null;

  const allDecided = pearls.every((p) => p.id in decisions);
  const keptPearls = pearls.filter((p) => decisions[p.id] === 'keep');

  const handleDecision = (pearlId: string, decision: 'keep' | 'discard') => {
    setDecisions((prev) => ({ ...prev, [pearlId]: decision }));
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gem className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-sm">Pearls</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Hidden truths the summary missed. Keep the ones that resonate.
      </p>

      <div className="space-y-3">
        {pearls.map((pearl) => {
          const decision = decisions[pearl.id];
          if (decision === 'discard') {
            return (
              <div key={pearl.id} className="opacity-40 line-through text-xs text-muted-foreground py-1">
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

          return (
            <div key={pearl.id} className={`relative ${decision === 'keep' ? 'ring-1 ring-amber-400/50 rounded-lg' : ''}`}>
              <PearlCard insight={pearl.insight} concepts={pearl.concepts} quote={pearl.quote} />
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
      {isLoggedIn && summaryId && !saved && allDecided && keptPearls.length > 0 && (
        <Button
          size="sm"
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
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
        <p className="text-xs text-green-600 dark:text-green-400 text-center">
          Pearls saved
        </p>
      )}

      {!isLoggedIn && allDecided && keptPearls.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Sign up to save your pearls
        </p>
      )}
    </div>
  );
}

function PearlCard({ insight, concepts, quote }: {
  insight: string;
  concepts: string[];
  quote?: { text: string; speaker?: string } | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-sm space-y-2">
      <p className="leading-relaxed">{insight}</p>
      {quote && (
        <blockquote className="border-l-2 border-amber-400/50 pl-2 text-xs text-muted-foreground italic">
          &ldquo;{quote.text}&rdquo;
          {quote.speaker && <span className="not-italic"> — {quote.speaker}</span>}
        </blockquote>
      )}
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
