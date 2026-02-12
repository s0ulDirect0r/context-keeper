'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import dynamic from 'next/dynamic';

const ConstellationFlow = dynamic(
  () => import('@/components/constellation/ConstellationFlow').then((mod) => mod.ConstellationFlow),
  { ssr: false },
);
import { DetailSidebar } from '@/components/constellation/DetailSidebar';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type {
  ConstellationData,
  ConstellationNode,
  EnrichedConstellationResponse,
  Decision,
  Action,
  ActionStatus,
} from '@/lib/types/cedar';
import type { Pearl } from '@/lib/claude';
import { toast } from 'sonner';
import { MOCK_TEAM_CONSTELLATION } from '@/lib/mock-team-data';
import {
  loadAllGuestDecisions,
  loadGuestActions,
  saveGuestDecisions,
  saveGuestActions,
} from '@/lib/cedar-storage';
import { loadDismissedIds, saveDismissedIds } from '@/lib/dismissed-storage';

type ViewMode = 'personal' | 'team';

export function ConstellationClient() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightSummaryId = searchParams.get('highlight');
  const shouldSurface = searchParams.get('surface') === 'true';

  const [viewMode, setViewMode] = useState<ViewMode>('personal');
  const [data, setData] = useState<ConstellationData | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [actions, setActions] = useState<Record<string, Action[]>>({});
  const [pearls, setPearls] = useState<Record<string, Pearl>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set(loadDismissedIds()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null);
  const [surfacing, setSurfacing] = useState(false);
  const surfacingAttempted = useRef(false);

  /** Parse enriched API response into graph data + entity maps */
  const applyEnrichedResponse = useCallback((json: EnrichedConstellationResponse) => {
    const { decisions: d, actions: a, pearls: p, ...graphData } = json;
    setData(graphData);
    setDecisions(d ?? {});
    setActions(a ?? {});
    setPearls(p ?? {});
  }, []);

  const fetchPersonalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        const res = await fetch('/api/constellation');
        if (!res.ok) throw new Error('Failed to fetch constellation data');
        const json = await res.json();
        applyEnrichedResponse(json);
      } else {
        // Guest: build constellation from localStorage
        const guestDecisions = loadAllGuestDecisions();
        const guestDecisionMap: Record<string, Decision> = {};
        for (const d of guestDecisions) {
          guestDecisionMap[d.id] = d;
        }
        setData({
          nodes: guestDecisions.map((d) => ({
            id: d.id,
            type: 'decision' as const,
            label: d.statement,
            confidence: d.confidence,
            decisionStatus: d.status,
            size: 18,
            recency: 0.9,
          })),
          edges: [],
        });
        setDecisions(guestDecisionMap);
        // Load guest actions for each decision
        const guestActionMap: Record<string, Action[]> = {};
        for (const d of guestDecisions) {
          const acts = loadGuestActions(d.id);
          if (acts.length > 0) guestActionMap[d.id] = acts;
        }
        setActions(guestActionMap);
        setPearls({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [user, applyEnrichedResponse]);

  useEffect(() => {
    if (viewMode === 'team') {
      setData(MOCK_TEAM_CONSTELLATION);
      setLoading(false);
    } else {
      fetchPersonalData();
    }
  }, [viewMode, fetchPersonalData]);

  // Handle decision surfacing from query param (fires once per mount)
  useEffect(() => {
    if (!shouldSurface || !highlightSummaryId || surfacingAttempted.current) return;
    surfacingAttempted.current = true;
    setSurfacing(true);

    fetch('/api/constellation/surface', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryId: highlightSummaryId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Surface failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        applyEnrichedResponse(json);
        setSurfacing(false);
        router.replace('/constellation');
      })
      .catch(() => {
        // Surfacing failed — fall back to regular personal data load
        setSurfacing(false);
        router.replace('/constellation');
        fetchPersonalData();
      });
  }, [shouldSurface, highlightSummaryId, fetchPersonalData]);

  const handleNodeClick = useCallback((node: ConstellationNode) => {
    setSelectedNode(node);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Decision mutations ─────────────────────────────────────────────

  /** Helper: persist guest decisions to localStorage after local state update */
  const persistGuestDecisions = useCallback((updated: Record<string, Decision>) => {
    // Group by summaryId and save each group
    const bySummary = new Map<string, Decision[]>();
    for (const d of Object.values(updated)) {
      const existing = bySummary.get(d.summaryId) ?? [];
      existing.push(d);
      bySummary.set(d.summaryId, existing);
    }
    for (const [summaryId, decs] of bySummary) {
      saveGuestDecisions(summaryId, decs);
    }
  }, []);

  const handleAcceptDecision = useCallback(
    async (decisionId: string) => {
      const prev = decisions[decisionId];
      if (!prev) return;

      const updated = { ...prev, status: 'active' as const };
      setDecisions((d) => ({ ...d, [decisionId]: updated }));

      if (!user) {
        // Guest: persist to localStorage
        const allDecisions = { ...decisions, [decisionId]: updated };
        persistGuestDecisions(allDecisions);
        toast.success('Decision accepted');
        return;
      }

      try {
        await fetch(`/api/decisions/${decisionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        toast.success('Decision accepted');
        fetchPersonalData();
      } catch {
        setDecisions((d) => ({ ...d, [decisionId]: prev }));
        toast.error('Failed to accept decision');
      }
    },
    [decisions, user, fetchPersonalData, persistGuestDecisions],
  );

  const handleDismissDecision = useCallback(
    (decisionId: string) => {
      const prev = decisions[decisionId];
      if (!prev) return;

      // Optimistic: add to dismissed set, close sidebar if viewing this decision
      const newDismissed = new Set(dismissedIds);
      newDismissed.add(decisionId);
      setDismissedIds(newDismissed);
      saveDismissedIds([...newDismissed]);
      if (selectedNode?.id === decisionId) setSelectedNode(null);

      toast('Decision dismissed', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            const restored = new Set(newDismissed);
            restored.delete(decisionId);
            setDismissedIds(restored);
            saveDismissedIds([...restored]);
          },
        },
      });
    },
    [decisions, dismissedIds, selectedNode],
  );

  const handleEditDecision = useCallback(
    async (decisionId: string, updates: { statement?: string; confidence?: string }) => {
      const prev = decisions[decisionId];
      if (!prev) return;

      const updated = {
        ...prev,
        ...(updates.statement !== undefined && { statement: updates.statement }),
        ...(updates.confidence !== undefined && {
          confidence: updates.confidence as Decision['confidence'],
        }),
      };
      setDecisions((d) => ({ ...d, [decisionId]: updated }));

      if (!user) {
        // Guest: persist to localStorage
        const allDecisions = { ...decisions, [decisionId]: updated };
        persistGuestDecisions(allDecisions);
        toast.success('Decision updated');
        return;
      }

      try {
        await fetch(`/api/decisions/${decisionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        toast.success('Decision updated');
        fetchPersonalData();
      } catch {
        setDecisions((d) => ({ ...d, [decisionId]: prev }));
        toast.error('Failed to update decision');
      }
    },
    [decisions, user, fetchPersonalData, persistGuestDecisions],
  );

  // ── Action mutations ───────────────────────────────────────────────

  const [generatingActionsFor, setGeneratingActionsFor] = useState<string | null>(null);

  const handleGenerateActions = useCallback(
    async (decisionId: string) => {
      const decision = decisions[decisionId];
      if (!decision || !user) return;

      setGeneratingActionsFor(decisionId);

      // Resolve supporting pearls for the generate request
      const supportingPearls = decision.supportingPearls
        .map((sp) => pearls[sp.pearlId])
        .filter(Boolean);

      try {
        // 1. Generate actions via AI
        const genRes = await fetch('/api/actions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decisionId,
            decision: { statement: decision.statement, reasoning: decision.reasoning },
            pearls: supportingPearls,
            context: { extractionGoal: 'Strategic actions from this decision' },
          }),
        });
        if (!genRes.ok) throw new Error('Generation failed');
        const { actions: generatedActions } = (await genRes.json()) as {
          actions: { description: string; contextCard: Action['contextCard'] }[];
        };

        // 2. Persist each action
        const persistedActions: Action[] = [];
        for (const genAction of generatedActions) {
          const persistRes = await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              decisionId,
              description: genAction.description,
              contextCard: genAction.contextCard,
            }),
          });
          if (persistRes.ok) {
            const { id } = (await persistRes.json()) as { id: string };
            const now = new Date().toISOString();
            persistedActions.push({
              id,
              userId: user.id,
              decisionId,
              description: genAction.description,
              contextCard: genAction.contextCard,
              status: 'pending',
              dueDate: null,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // 3. Update local actions state
        setActions((a) => ({
          ...a,
          [decisionId]: [...(a[decisionId] ?? []), ...persistedActions],
        }));

        toast.success(
          `Generated ${persistedActions.length} action${persistedActions.length !== 1 ? 's' : ''}`,
        );
        fetchPersonalData(); // Background refetch for graph nodes
      } catch {
        toast.error('Failed to generate actions');
      } finally {
        setGeneratingActionsFor(null);
      }
    },
    [decisions, pearls, user, fetchPersonalData],
  );

  const handleActionStatusChange = useCallback(
    async (actionId: string, newStatus: ActionStatus) => {
      // Find which decision this action belongs to
      let ownerDecisionId: string | null = null;
      let prevAction: Action | null = null;
      for (const [decId, actionList] of Object.entries(actions)) {
        const found = actionList.find((a) => a.id === actionId);
        if (found) {
          ownerDecisionId = decId;
          prevAction = found;
          break;
        }
      }
      if (!ownerDecisionId || !prevAction) return;

      // Optimistic update
      setActions((a) => ({
        ...a,
        [ownerDecisionId!]: a[ownerDecisionId!].map((act) =>
          act.id === actionId ? { ...act, status: newStatus } : act,
        ),
      }));

      try {
        const res = await fetch(`/api/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error('Status update failed');
      } catch {
        // Rollback
        setActions((a) => ({
          ...a,
          [ownerDecisionId!]: a[ownerDecisionId!].map((act) =>
            act.id === actionId ? prevAction! : act,
          ),
        }));
        toast.error('Failed to update action status');
      }
    },
    [actions],
  );

  const handleAddAction = useCallback(
    async (decisionId: string) => {
      const description = prompt('Describe the action:');
      if (!description?.trim()) return;

      try {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decisionId, description: description.trim() }),
        });
        if (!res.ok) throw new Error('Failed to create action');
        const { id } = (await res.json()) as { id: string };
        const now = new Date().toISOString();

        setActions((a) => ({
          ...a,
          [decisionId]: [
            ...(a[decisionId] ?? []),
            {
              id,
              userId: user?.id ?? '',
              decisionId,
              description: description.trim(),
              contextCard: null,
              status: 'pending' as const,
              dueDate: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        toast.success('Action added');
      } catch {
        toast.error('Failed to add action');
      }
    },
    [user],
  );

  // Sync graph nodes with current decision/action state + filter dismissed
  const visibleData = useMemo(() => {
    if (!data) return null;
    return {
      nodes: data.nodes
        .filter((n) => !dismissedIds.has(n.id))
        .map((n) => {
          // Sync decision node status/confidence with current state
          if (n.type === 'decision' && decisions[n.id]) {
            const d = decisions[n.id];
            return {
              ...n,
              label: d.statement,
              confidence: d.confidence,
              decisionStatus: d.status,
            };
          }
          return n;
        }),
      edges: data.edges.filter((e) => !dismissedIds.has(e.source) && !dismissedIds.has(e.target)),
    };
  }, [data, decisions, dismissedIds]);

  const isEmpty =
    !loading &&
    !surfacing &&
    (!visibleData || (visibleData.nodes.length === 0 && viewMode === 'personal'));

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <h1 className="text-lg font-semibold">Constellation</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border p-0.5 text-sm">
            <button
              onClick={() => setViewMode('personal')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'personal'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              My Loop
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'team'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Team
            </button>
          </div>
        </div>
      </div>

      {/* Surfacing banner */}
      {surfacing && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          <span className="text-amber-800 dark:text-amber-200">
            Surfacing decisions from your pearls...
          </span>
        </div>
      )}

      {/* Guest prompt */}
      {!user && (
        <div className="px-6 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/40 text-sm text-blue-800 dark:text-blue-200">
          Sign up to save your constellation across sessions.
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph area */}
        <div className="flex-1 relative">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <div className="rounded-full bg-muted p-6">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground"
                >
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="5" cy="8" r="1.5" />
                  <circle cx="19" cy="8" r="1.5" />
                  <circle cx="7" cy="18" r="1.5" />
                  <circle cx="17" cy="18" r="1.5" />
                  <line x1="12" y1="12" x2="5" y2="8" opacity="0.3" />
                  <line x1="12" y1="12" x2="19" y2="8" opacity="0.3" />
                  <line x1="12" y1="12" x2="7" y2="18" opacity="0.3" />
                  <line x1="12" y1="12" x2="17" y2="18" opacity="0.3" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">Your constellation is empty</h2>
              <p className="text-muted-foreground max-w-md">
                Plant your first Seed to start building your strategic landscape. Your pearls,
                decisions, and actions will appear here as a connected graph.
              </p>
              <Button asChild>
                <Link href="/">Create your first summary</Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={fetchPersonalData}>
                Retry
              </Button>
            </div>
          ) : visibleData ? (
            <ConstellationFlow
              data={visibleData}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeClick={handleNodeClick}
            />
          ) : null}
        </div>

        {/* Detail sidebar */}
        {selectedNode && visibleData && (
          <DetailSidebar
            node={selectedNode}
            data={visibleData}
            decision={selectedNode.type === 'decision' ? decisions[selectedNode.id] : undefined}
            actions={
              selectedNode.type === 'decision' ? (actions[selectedNode.id] ?? []) : undefined
            }
            pearls={pearls}
            onClose={handleCloseSidebar}
            onAcceptDecision={handleAcceptDecision}
            onDismissDecision={handleDismissDecision}
            onEditDecision={handleEditDecision}
            isGuest={!user}
            onGenerateActions={handleGenerateActions}
            generatingActions={generatingActionsFor === selectedNode?.id}
            onActionStatusChange={handleActionStatusChange}
            onAddAction={handleAddAction}
          />
        )}
      </div>
    </div>
  );
}
