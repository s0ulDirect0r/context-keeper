'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ActionItem } from './ActionItem';
import type { Action, ActionStatus } from '@/lib/types/cedar';

interface ActionListProps {
  actions: Action[];
  /** Called when an action's status changes */
  onStatusChange?: (actionId: string, newStatus: ActionStatus) => void;
  /** Called when user clicks "Add action" */
  onAdd?: () => void;
}

/**
 * Container that renders a list of ActionItem components under a decision.
 * Includes an "Add action" button at the bottom.
 */
export function ActionList({ actions, onStatusChange, onAdd }: ActionListProps) {
  if (actions.length === 0 && !onAdd) return null;

  return (
    <div className="space-y-2">
      {actions.length > 0 && (
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Actions ({actions.filter((a) => a.status === 'done').length}/{actions.length} done)
        </p>
      )}

      {actions.map((action) => (
        <ActionItem key={action.id} action={action} onStatusChange={onStatusChange} />
      ))}

      {onAdd && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add action
        </Button>
      )}
    </div>
  );
}
