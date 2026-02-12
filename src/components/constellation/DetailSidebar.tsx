'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ConstellationData, ConstellationNode } from '@/lib/types/cedar';

interface DetailSidebarProps {
  node: ConstellationNode;
  data: ConstellationData;
  onClose: () => void;
}

export function DetailSidebar({ node, data, onClose }: DetailSidebarProps) {
  // Find connected nodes via edges
  const connectedEdges = data.edges.filter((e) => e.source === node.id || e.target === node.id);
  const connectedNodeIds = new Set(
    connectedEdges.flatMap((e) => [e.source, e.target]).filter((id) => id !== node.id),
  );
  const connectedNodes = data.nodes.filter((n) => connectedNodeIds.has(n.id));

  return (
    <aside className="w-80 border-l bg-background overflow-y-auto p-4 space-y-4 shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {node.type === 'pearl-cluster'
              ? 'Pearl Cluster'
              : node.type === 'decision'
                ? 'Decision'
                : 'Action'}
          </span>
          <h3 className="text-sm font-semibold leading-tight">{node.label}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -mt-1 -mr-2">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Pearl cluster detail */}
      {node.type === 'pearl-cluster' && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{node.pearlCount}</span>
            <span className="text-sm text-muted-foreground">
              pearl{node.pearlCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Concept: <span className="font-medium text-foreground">{node.concept}</span>
          </p>

          {/* Connected decisions */}
          {connectedNodes.filter((n) => n.type === 'decision').length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Related decisions
              </h4>
              {connectedNodes
                .filter((n) => n.type === 'decision')
                .map((d) => (
                  <div
                    key={d.id}
                    className="text-xs p-2 rounded border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40"
                  >
                    {d.label}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Decision detail */}
      {node.type === 'decision' && (
        <div className="space-y-3">
          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                node.confidence === 'high'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : node.confidence === 'medium'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              {node.confidence} confidence
            </span>
            <span className="text-xs text-muted-foreground">{node.decisionStatus}</span>
          </div>

          {/* Supporting pearl clusters */}
          {connectedNodes.filter((n) => n.type === 'pearl-cluster').length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Evidence
              </h4>
              {connectedNodes
                .filter((n) => n.type === 'pearl-cluster')
                .map((p) => {
                  const edge = connectedEdges.find(
                    (e) =>
                      (e.source === p.id && e.target === node.id) ||
                      (e.source === node.id && e.target === p.id),
                  );
                  return (
                    <div
                      key={p.id}
                      className={`text-xs p-2 rounded border ${
                        edge?.type === 'contradicts'
                          ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40'
                          : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40'
                      }`}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        ({p.pearlCount} pearl{p.pearlCount !== 1 ? 's' : ''})
                      </span>
                      {edge?.type === 'contradicts' && (
                        <span className="text-red-600 dark:text-red-400 ml-1">(contradicts)</span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Connected actions */}
          {connectedNodes.filter((n) => n.type === 'action').length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </h4>
              {connectedNodes
                .filter((n) => n.type === 'action')
                .map((a) => (
                  <div
                    key={a.id}
                    className="text-xs p-2 rounded border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        a.actionStatus === 'done'
                          ? 'bg-green-500'
                          : a.actionStatus === 'in_progress'
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    {a.label}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Action detail */}
      {node.type === 'action' && (
        <div className="space-y-3">
          {/* Status badge */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              node.actionStatus === 'done'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : node.actionStatus === 'in_progress'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
            }`}
          >
            {node.actionStatus?.replace('_', ' ')}
          </span>

          {/* Parent decision */}
          {connectedNodes.filter((n) => n.type === 'decision').length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Parent decision
              </h4>
              {connectedNodes
                .filter((n) => n.type === 'decision')
                .map((d) => (
                  <div
                    key={d.id}
                    className="text-xs p-2 rounded border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40"
                  >
                    {d.label}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Contributor (team view) */}
      {node.contributor && (
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Contributor: <span className="font-medium text-foreground">{node.contributor}</span>
          </span>
        </div>
      )}
    </aside>
  );
}
