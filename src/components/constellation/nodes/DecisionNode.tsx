import { Handle, Position } from '@xyflow/react';
import type { ConstellationNode } from '@/lib/types/cedar';

interface DecisionNodeProps {
  data: ConstellationNode;
  selected: boolean;
}

const CONFIDENCE_STYLES = {
  high: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
} as const;

const STATUS_COLORS = {
  emerging: 'border-blue-300 dark:border-blue-700',
  active: 'border-blue-500 dark:border-blue-500',
  resolved: 'border-green-400 dark:border-green-600',
  revised: 'border-amber-400 dark:border-amber-600',
  dismissed: 'border-gray-300 dark:border-gray-600',
} as const;

export function DecisionNode({ data, selected }: DecisionNodeProps) {
  const confidence = data.confidence ?? 'medium';
  const status = data.decisionStatus ?? 'emerging';
  const borderStyle = data.confidence === 'low' ? 'border-dashed' : 'border-solid';

  return (
    <div
      className={`rounded-xl border-2 ${borderStyle} bg-white dark:bg-zinc-900 p-3 shadow-sm w-60 transition-shadow ${
        selected
          ? 'border-blue-500 shadow-md ring-2 ring-blue-200 dark:ring-blue-800'
          : (STATUS_COLORS[status] ?? STATUS_COLORS.emerging)
      }`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${CONFIDENCE_STYLES[confidence]}`}
        >
          {confidence}
        </span>
        <span className="text-xs text-muted-foreground capitalize">{status}</span>
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-2">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
