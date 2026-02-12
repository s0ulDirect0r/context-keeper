import type {
  ConstellationData,
  ConstellationNode,
  ConstellationEdge,
  DecisionConfidence,
  DecisionStatus,
  ActionStatus,
} from './types/cedar';
/** Database row shapes for constellation building */
interface PearlRow {
  id: string;
  concepts: string[];
  created_at: string;
}

interface DecisionRow {
  id: string;
  statement: string;
  confidence: string;
  status: string;
  created_at: string;
}

interface DecisionPearlRow {
  decision_id: string;
  pearl_id: string;
  relationship: string;
}

interface ActionRow {
  id: string;
  description: string;
  decision_id: string;
  status: string;
  created_at: string;
}

/**
 * Build constellation graph data from raw database rows.
 * Groups pearls by concept into cluster nodes, connects decisions
 * and actions via edges.
 */
export function buildConstellationData(
  pearls: PearlRow[],
  decisions: DecisionRow[],
  decisionPearls: DecisionPearlRow[],
  actions: ActionRow[],
): ConstellationData {
  const now = Date.now();
  const nodes: ConstellationNode[] = [];
  const edges: ConstellationEdge[] = [];

  // Group pearls by concept → clusters
  const conceptMap = new Map<string, { pearlIds: Set<string>; latestTs: number }>();
  for (const pearl of pearls) {
    const ts = new Date(pearl.created_at).getTime();
    for (const concept of pearl.concepts) {
      const existing = conceptMap.get(concept);
      if (existing) {
        existing.pearlIds.add(pearl.id);
        existing.latestTs = Math.max(existing.latestTs, ts);
      } else {
        conceptMap.set(concept, { pearlIds: new Set([pearl.id]), latestTs: ts });
      }
    }
  }

  // Build pearl-to-cluster mapping (pearl → which cluster IDs it belongs to)
  const pearlToCluster = new Map<string, string[]>();
  for (const [concept, { pearlIds }] of conceptMap) {
    const clusterId = `cluster-${concept}`;
    for (const pearlId of pearlIds) {
      const existing = pearlToCluster.get(pearlId) ?? [];
      existing.push(clusterId);
      pearlToCluster.set(pearlId, existing);
    }
  }

  // Create pearl cluster nodes
  for (const [concept, { pearlIds, latestTs }] of conceptMap) {
    const count = pearlIds.size;
    nodes.push({
      id: `cluster-${concept}`,
      type: 'pearl-cluster',
      label: concept,
      concept,
      pearlCount: count,
      size: 12 + count * 4, // Scale with frequency
      recency: computeRecency(latestTs, now),
    });
  }

  // Create decision nodes
  for (const decision of decisions) {
    const ts = new Date(decision.created_at).getTime();
    nodes.push({
      id: decision.id,
      type: 'decision',
      label: truncate(decision.statement, 40),
      confidence: decision.confidence as DecisionConfidence,
      decisionStatus: decision.status as DecisionStatus,
      size: 18,
      recency: computeRecency(ts, now),
    });
  }

  // Create action nodes
  for (const action of actions) {
    const ts = new Date(action.created_at).getTime();
    nodes.push({
      id: action.id,
      type: 'action',
      label: truncate(action.description, 40),
      actionStatus: action.status as ActionStatus,
      size: 12,
      recency: computeRecency(ts, now),
    });
  }

  // Build edges: pearl clusters → decisions (via decision_pearls)
  const addedEdges = new Set<string>();
  for (const dp of decisionPearls) {
    const clusterIds = pearlToCluster.get(dp.pearl_id) ?? [];
    for (const clusterId of clusterIds) {
      const edgeKey = `${clusterId}→${dp.decision_id}`;
      if (!addedEdges.has(edgeKey)) {
        addedEdges.add(edgeKey);
        edges.push({
          source: clusterId,
          target: dp.decision_id,
          type: dp.relationship as 'supports' | 'contradicts',
          strength: dp.relationship === 'supports' ? 0.8 : 0.5,
        });
      }
    }
  }

  // Build edges: decisions → actions
  for (const action of actions) {
    edges.push({
      source: action.decision_id,
      target: action.id,
      type: 'derives',
      strength: 1.0,
    });
  }

  return { nodes, edges };
}

/** Compute recency as 0-1 value. Items from the last 7 days are > 0.5. */
function computeRecency(timestamp: number, now: number): number {
  const ageMs = now - timestamp;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, 1 - ageMs / (sevenDaysMs * 4)); // Fade over ~28 days
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}
