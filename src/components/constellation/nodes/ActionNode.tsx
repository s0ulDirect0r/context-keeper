import { Handle, Position } from '@xyflow/react';
import type { ConstellationNode } from '@/lib/types/cedar';

interface ActionNodeProps {
  data: ConstellationNode;
  selected: boolean;
}

const STATUS_STYLES = {
  pending: {
    border: 'border-gray-300 dark:border-gray-600',
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  },
  in_progress: {
    border: 'border-amber-400 dark:border-amber-600',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300',
  },
  done: {
    border: 'border-green-400 dark:border-green-600',
    badge: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  },
} as const;

export function ActionNode({ data, selected }: ActionNodeProps) {
  const status = data.actionStatus ?? 'pending';
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.pending;

  return (
    <div
      className={`rounded-lg border-2 bg-white dark:bg-zinc-900 p-3 shadow-sm w-50 transition-shadow ${
        selected
          ? 'border-green-500 shadow-md ring-2 ring-green-200 dark:ring-green-800'
          : styles.border
      }`}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${styles.badge}`}>
          {status.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-foreground line-clamp-2">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
