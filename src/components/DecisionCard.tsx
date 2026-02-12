'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import type { Decision, DecisionConfidence, DecisionStatus } from '@/lib/types/cedar';
import type { Pearl } from '@/lib/claude';

interface DecisionCardProps {
  decision: Decision;
  /** Pearls referenced by this decision's supportingPearls list */
  pearls: Pearl[];
  /** Called when user accepts (transitions status to 'active') */
  onAccept?: (decisionId: string) => void;
  /** Called when user saves edits (statement, confidence) */
  onEdit?: (decisionId: string, updates: { statement?: string; confidence?: string }) => void;
  /** Called when user dismisses the decision */
  onDismiss?: (decisionId: string) => void;
}

// ── Confidence badge color mapping ──────────────────────────────────

const CONFIDENCE_STYLES: Record<DecisionConfidence, string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const STATUS_STYLES: Record<DecisionStatus, string> = {
  emerging: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  resolved: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  revised: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  dismissed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

/**
 * Decision card for the constellation detail sidebar.
 * Shows the hypothesis, reasoning, supporting pearls, and action buttons.
 */
export function DecisionCard({ decision, pearls, onAccept, onEdit, onDismiss }: DecisionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStatement, setEditStatement] = useState(decision.statement);
  const [editConfidence, setEditConfidence] = useState<DecisionConfidence>(decision.confidence);

  // Resolve pearl data from the decision's supportingPearls references
  const resolvedPearls = decision.supportingPearls
    .map((sp) => {
      const pearl = pearls.find((p) => p.id === sp.pearlId);
      return pearl ? { pearl, relationship: sp.relationship } : null;
    })
    .filter(Boolean) as { pearl: Pearl; relationship: 'supports' | 'contradicts' }[];

  const isTerminal = decision.status === 'dismissed';

  const handleSaveEdit = () => {
    const updates: { statement?: string; confidence?: string } = {};
    if (editStatement !== decision.statement) updates.statement = editStatement;
    if (editConfidence !== decision.confidence) updates.confidence = editConfidence;
    if (Object.keys(updates).length > 0) {
      onEdit?.(decision.id, updates);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditStatement(decision.statement);
    setEditConfidence(decision.confidence);
    setIsEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {isEditing ? (
          <select
            value={editConfidence}
            onChange={(e) => setEditConfidence(e.target.value as DecisionConfidence)}
            className="text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 border bg-background"
          >
            <option value="low">Low confidence</option>
            <option value="medium">Medium confidence</option>
            <option value="high">High confidence</option>
          </select>
        ) : (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CONFIDENCE_STYLES[decision.confidence]}`}
          >
            {decision.confidence} confidence
          </span>
        )}
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[decision.status]}`}
        >
          {decision.status}
        </span>
      </div>

      {/* Hypothesis statement */}
      {isEditing ? (
        <textarea
          value={editStatement}
          onChange={(e) => setEditStatement(e.target.value)}
          className="w-full text-sm font-medium leading-snug p-2 border rounded resize-none bg-background"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="text-sm font-medium leading-snug">{decision.statement}</p>
      )}

      {/* Reasoning */}
      {decision.reasoning && (
        <p className="text-xs leading-relaxed text-muted-foreground">{decision.reasoning}</p>
      )}

      {/* Supporting pearls */}
      {resolvedPearls.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Supporting evidence
          </p>
          {resolvedPearls.map(({ pearl, relationship }) => (
            <div
              key={pearl.id}
              className={`rounded border px-2.5 py-1.5 text-xs ${
                relationship === 'contradicts'
                  ? 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-950/20'
                  : 'border-amber-200/60 bg-amber-50/30 dark:border-amber-800/20 dark:bg-amber-950/10'
              }`}
            >
              {pearl.quote && (
                <p className="font-medium leading-snug">
                  &ldquo;{pearl.quote.text}&rdquo;
                  {pearl.quote.speaker && (
                    <span className="text-muted-foreground ml-1">
                      &mdash; {pearl.quote.speaker}
                    </span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground mt-0.5">{pearl.insight}</p>
              {relationship === 'contradicts' && (
                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                  contradicts
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit mode: Save/Cancel buttons */}
      {isEditing && (
        <div className="flex gap-1.5 pt-1">
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={handleSaveEdit}
          >
            <Check className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={handleCancelEdit}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Action buttons — hidden for terminal states and during editing */}
      {!isTerminal && !isEditing && (
        <div className="flex gap-1.5 pt-1">
          {decision.status === 'emerging' && onAccept && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => onAccept(decision.id)}
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground"
              onClick={() => onDismiss(decision.id)}
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
