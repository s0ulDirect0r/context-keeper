import { Handle, Position } from '@xyflow/react';
import type { ConstellationNode } from '@/lib/types/cedar';

interface SeedNodeProps {
  data: ConstellationNode;
  selected: boolean;
}

export function SeedNode({ data, selected }: SeedNodeProps) {
  const isOrphan = (data.seedPearlCount ?? 0) === 0;

  const formattedDate = data.summaryDate
    ? new Date(data.summaryDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div
      className={`rounded-lg border bg-stone-50 dark:bg-stone-900/50 px-3 py-2 shadow-sm w-50 transition-shadow ${
        selected
          ? 'border-stone-500 shadow-md ring-2 ring-stone-200 dark:ring-stone-700'
          : 'border-stone-300 dark:border-stone-700'
      } ${isOrphan ? 'opacity-50' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />

      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {data.summaryTitle ?? data.label}
      </p>
      <span className="text-[10px] text-stone-500 dark:text-stone-500">{formattedDate}</span>

      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
