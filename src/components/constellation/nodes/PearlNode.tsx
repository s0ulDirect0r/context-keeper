import { Handle, Position } from '@xyflow/react';
import type { ConstellationNode } from '@/lib/types/cedar';

interface PearlNodeProps {
  data: ConstellationNode;
  selected: boolean;
}

export function PearlNode({ data, selected }: PearlNodeProps) {
  const primaryConcept = data.concepts?.[0];

  return (
    <div
      className={`rounded-xl border-2 bg-white dark:bg-zinc-900 p-3 shadow-sm w-72 transition-shadow ${
        selected
          ? 'border-amber-500 shadow-md ring-2 ring-amber-200 dark:ring-amber-800'
          : 'border-amber-300 dark:border-amber-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />

      {/* Quote — the prominent element, capped to 3 lines (full quote in sidebar) */}
      {data.quote ? (
        <blockquote className="text-sm text-foreground italic leading-snug">
          <span className="line-clamp-5">&ldquo;{data.quote}&rdquo;</span>
          {data.speaker && (
            <span className="not-italic text-xs text-muted-foreground font-medium block mt-1">
              — {data.speaker}
            </span>
          )}
        </blockquote>
      ) : (
        <p className="text-sm text-foreground leading-snug">{data.label}</p>
      )}

      {/* Concept tag */}
      {primaryConcept && (
        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
          {primaryConcept}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
