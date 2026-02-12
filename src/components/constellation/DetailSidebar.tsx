'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2, Sparkles } from 'lucide-react';
import type {
  ConstellationData,
  ConstellationNode,
  Decision,
  Action,
  ActionStatus,
} from '@/lib/types/cedar';
import type { Pearl } from '@/lib/claude';
import { DecisionCard } from '@/components/DecisionCard';
import { ActionList } from '@/components/ActionList';

interface PearlDetail {
  id: string;
  insight: string;
  quote: { text: string; speaker?: string } | null;
  concepts: string[];
  created_at: string;
}

interface DetailSidebarProps {
  node: ConstellationNode;
  data: ConstellationData;
  /** Full Decision object when a decision node is selected */
  decision?: Decision;
  /** Actions belonging to the selected decision */
  actions?: Action[];
  /** All pearls keyed by ID (for resolving pearl references) */
  pearls?: Record<string, Pearl>;
  isGuest?: boolean;
  onClose: () => void;
  onAcceptDecision?: (decisionId: string) => void;
  onDismissDecision?: (decisionId: string) => void;
  onEditDecision?: (
    decisionId: string,
    updates: { statement?: string; confidence?: string },
  ) => void;
  onGenerateActions?: (decisionId: string) => void;
  generatingActions?: boolean;
  onActionStatusChange?: (actionId: string, newStatus: ActionStatus) => void;
  onAddAction?: (decisionId: string) => void;
}

export function DetailSidebar({
  node,
  data,
  decision,
  actions: decisionActions,
  pearls: pearlMap,
  isGuest,
  onClose,
  onAcceptDecision,
  onDismissDecision,
  onEditDecision,
  onGenerateActions,
  generatingActions,
  onActionStatusChange,
  onAddAction,
}: DetailSidebarProps) {
  const [pearlDetails, setPearlDetails] = useState<PearlDetail[]>([]);
  const [fetchedConcept, setFetchedConcept] = useState<string | null>(null);
  const isPearlCluster = node.type === 'pearl-cluster' && !!node.concept;

  // Derive loading: viewing a cluster whose data hasn't arrived yet
  const loadingPearls = isPearlCluster && fetchedConcept !== node.concept;

  // Fetch pearl details when a pearl cluster is selected
  useEffect(() => {
    if (!isPearlCluster) return;
    let cancelled = false;
    fetch('/api/constellation/cluster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept: node.concept }),
    })
      .then((res) => (res.ok ? res.json() : { pearls: [] }))
      .then((json) => {
        if (!cancelled) {
          setPearlDetails(json.pearls ?? []);
          setFetchedConcept(node.concept!);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPearlDetails([]);
          setFetchedConcept(node.concept!);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isPearlCluster, node.concept]);

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
          {/* Hide label for decisions when DecisionCard will render it */}
          {!(node.type === 'decision' && decision) && (
            <h3 className="text-sm font-semibold leading-tight">{node.label}</h3>
          )}
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

          {/* Pearl insights + quotes */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Insights
            </h4>
            {loadingPearls ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading pearls...</span>
              </div>
            ) : pearlDetails.length > 0 ? (
              pearlDetails.map((pearl) => (
                <div
                  key={pearl.id}
                  className="text-xs p-2 rounded border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 space-y-1"
                >
                  <p className="text-foreground">{pearl.insight}</p>
                  {pearl.quote && (
                    <blockquote className="border-l-2 border-amber-300 dark:border-amber-700 pl-2 text-muted-foreground italic">
                      &ldquo;{pearl.quote.text}&rdquo;
                      {pearl.quote.speaker && (
                        <span className="not-italic font-medium"> — {pearl.quote.speaker}</span>
                      )}
                    </blockquote>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic">No insights available</p>
            )}
          </div>

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

      {/* Decision detail — use DecisionCard when full data is available */}
      {node.type === 'decision' && decision && pearlMap && (
        <div className="space-y-3">
          <DecisionCard
            decision={decision}
            pearls={decision.supportingPearls.map((sp) => pearlMap[sp.pearlId]).filter(Boolean)}
            onAccept={onAcceptDecision}
            onEdit={onEditDecision}
            onDismiss={onDismissDecision}
          />

          {/* Actions section */}
          <div className="space-y-2">
            <ActionList
              actions={decisionActions ?? []}
              onStatusChange={onActionStatusChange}
              onAdd={onAddAction ? () => onAddAction(decision.id) : undefined}
            />

            {/* Generate actions button — shown when no actions exist yet */}
            {(!decisionActions || decisionActions.length === 0) &&
              (isGuest ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Sign up to generate AI-powered actions
                </p>
              ) : onGenerateActions ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={generatingActions}
                  onClick={() => onGenerateActions(decision.id)}
                >
                  {generatingActions ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1.5" />
                      Generate Actions
                    </>
                  )}
                </Button>
              ) : null)}
          </div>
        </div>
      )}

      {/* Decision detail — fallback when enriched data isn't available */}
      {node.type === 'decision' && !decision && (
        <div className="space-y-3">
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
