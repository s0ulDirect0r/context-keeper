import { Handle, Position } from '@xyflow/react';
import type { ConstellationNode } from '@/lib/types/cedar';

interface PearlClusterNodeProps {
  data: ConstellationNode;
  selected: boolean;
}

export function PearlClusterNode({ data, selected }: PearlClusterNodeProps) {
  return (
    <div
      className={`rounded-xl border-2 bg-white dark:bg-zinc-900 p-3 shadow-sm w-56 transition-shadow ${
        selected
          ? 'border-amber-500 shadow-md ring-2 ring-amber-200 dark:ring-amber-800'
          : 'border-amber-300 dark:border-amber-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-amber-700 dark:text-amber-400 font-semibold text-sm truncate">
          {data.concept}
        </span>
        <span className="shrink-0 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
          {data.pearlCount}
        </span>
      </div>
      {data.insights && data.insights.length > 0 ? (
        <div className="space-y-0.5">
          {data.insights.slice(0, 2).map((insight, i) => (
            <p key={i} className="text-xs text-muted-foreground truncate">
              {insight}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          {data.pearlCount} insight{data.pearlCount !== 1 ? 's' : ''}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
