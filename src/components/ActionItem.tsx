'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Circle, Clock, CheckCircle2 } from 'lucide-react';
import type { Action, ActionStatus } from '@/lib/types/cedar';

interface ActionItemProps {
  action: Action;
  /** Called when the user cycles the status (pending → in_progress → done) */
  onStatusChange?: (actionId: string, newStatus: ActionStatus) => void;
}

// ── Status visual mapping ───────────────────────────────────────────

const STATUS_CONFIG: Record<
  ActionStatus,
  { icon: typeof Circle; label: string; className: string }
> = {
  pending: {
    icon: Circle,
    label: 'Pending',
    className: 'text-muted-foreground',
  },
  in_progress: {
    icon: Clock,
    label: 'In progress',
    className: 'text-blue-600 dark:text-blue-400',
  },
  done: {
    icon: CheckCircle2,
    label: 'Done',
    className: 'text-green-600 dark:text-green-400',
  },
};

const NEXT_STATUS: Record<ActionStatus, ActionStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'done', // terminal — no further transition
};

/**
 * Individual action item with status toggle and expandable context card.
 */
export function ActionItem({ action, onStatusChange }: ActionItemProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = STATUS_CONFIG[action.status];
  const StatusIcon = statusConfig.icon;
  const isDone = action.status === 'done';
  const hasContext = action.contextCard !== null;

  const handleStatusToggle = () => {
    if (isDone) return; // done is terminal
    const next = NEXT_STATUS[action.status];
    onStatusChange?.(action.id, next);
  };

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm transition-opacity ${isDone ? 'opacity-60' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 p-3">
        {/* Status toggle button */}
        <button
          onClick={handleStatusToggle}
          disabled={isDone}
          className={`mt-0.5 shrink-0 transition-colors ${statusConfig.className} ${
            isDone ? 'cursor-default' : 'hover:opacity-70 cursor-pointer'
          }`}
          aria-label={`Status: ${statusConfig.label}. ${isDone ? '' : 'Click to advance.'}`}
          title={statusConfig.label}
        >
          <StatusIcon className="h-4 w-4" />
        </button>

        {/* Description */}
        <p className={`flex-1 text-sm leading-snug ${isDone ? 'line-through' : ''}`}>
          {action.description}
        </p>

        {/* Expand/collapse chevron — only when context card exists */}
        {hasContext && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse context' : 'Expand context'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Expandable context card */}
      {expanded && action.contextCard && (
        <div className="border-t px-3 py-2.5 space-y-2 bg-muted/30">
          {/* Source pearl quote */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Evidence
            </p>
            <p className="text-xs italic">
              &ldquo;{action.contextCard.sourcePearlQuote}&rdquo;
              {action.contextCard.sourcePearlSpeaker && (
                <span className="not-italic text-muted-foreground">
                  {' '}
                  &mdash; {action.contextCard.sourcePearlSpeaker}
                </span>
              )}
            </p>
          </div>

          {/* Framing */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Framing
            </p>
            <p className="text-xs text-muted-foreground">{action.contextCard.framing}</p>
          </div>

          {/* Timing (optional) */}
          {action.contextCard.timing && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                Timing
              </p>
              <p className="text-xs text-muted-foreground">{action.contextCard.timing}</p>
            </div>
          )}

          {/* Talking points (optional) */}
          {action.contextCard.talkingPoints && action.contextCard.talkingPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                Talking points
              </p>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                {action.contextCard.talkingPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
