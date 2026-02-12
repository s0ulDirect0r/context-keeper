'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { ConstellationData, ConstellationNode } from '@/lib/types/cedar';
import { MOCK_TEAM_CONSTELLATION } from '@/lib/mock-team-data';
import { loadAllGuestDecisions } from '@/lib/cedar-storage';

type ViewMode = 'personal' | 'team';

export function ConstellationClient() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightSummaryId = searchParams.get('highlight');
  const shouldSurface = searchParams.get('surface') === 'true';

  const [viewMode, setViewMode] = useState<ViewMode>('personal');
  const [data, setData] = useState<ConstellationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null);
  const [surfacing, setSurfacing] = useState(false);
  const surfacingAttempted = useRef(false);

  const fetchPersonalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        const res = await fetch('/api/constellation');
        if (!res.ok) throw new Error('Failed to fetch constellation data');
        const json = await res.json();
        setData(json);
      } else {
        // Guest: build constellation from localStorage
        const decisions = loadAllGuestDecisions();
        setData({
          nodes: decisions.map((d) => ({
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        setData(json);
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

  const isEmpty =
    !loading && !surfacing && (!data || (data.nodes.length === 0 && viewMode === 'personal'));

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
          ) : data ? (
            <ConstellationFlow
              data={data}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeClick={handleNodeClick}
            />
          ) : null}
        </div>

        {/* Detail sidebar */}
        {selectedNode && data && (
          <DetailSidebar node={selectedNode} data={data} onClose={handleCloseSidebar} />
        )}
      </div>
    </div>
  );
}
