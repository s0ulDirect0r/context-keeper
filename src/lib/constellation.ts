import type {
  ConstellationData,
  ConstellationNode,
  ConstellationEdge,
  EnrichedConstellationResponse,
  Decision,
  Action,
  DecisionConfidence,
  DecisionStatus,
  ActionStatus,
  ActionContextCard,
  DecisionPearl,
} from './types/cedar';
import type { Pearl } from './claude';

/** Database row shapes for constellation building */
interface PearlRow {
  id: string;
  concepts: string[];
  insight?: string;
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

/** Extended row shapes for enriched response (includes all columns) */
export interface FullDecisionRow extends DecisionRow {
  user_id: string;
  summary_id: string;
  reasoning: string | null;
  updated_at: string;
}

export interface FullActionRow extends ActionRow {
  user_id: string;
  context_card: ActionContextCard | null;
  due_date: string | null;
  updated_at: string;
}

export interface FullPearlRow extends PearlRow {
  quote: { text: string; speaker?: string; isUser?: boolean } | null;
}

/**
 * Build constellation graph data from raw database rows.
 * Creates individual pearl nodes (with quote + concept tag), connects
 * decisions and actions via edges.
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

  // Create individual pearl nodes
  for (const pearl of pearls) {
    const ts = new Date(pearl.created_at).getTime();
    // Use quote as primary label, fall back to insight
    const fullPearl = pearl as FullPearlRow;
    const quoteText = fullPearl.quote?.text;
    const label = quoteText ?? pearl.insight ?? pearl.concepts[0] ?? 'Pearl';
    nodes.push({
      id: pearl.id,
      type: 'pearl',
      label,
      quote: quoteText,
      speaker: fullPearl.quote?.speaker,
      concepts: pearl.concepts,
      size: 14,
      recency: computeRecency(ts, now),
    });
  }

  // Create decision nodes
  for (const decision of decisions) {
    const ts = new Date(decision.created_at).getTime();
    nodes.push({
      id: decision.id,
      type: 'decision',
      label: decision.statement,
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
      label: action.description,
      actionStatus: action.status as ActionStatus,
      size: 12,
      recency: computeRecency(ts, now),
    });
  }

  // Build edges: pearls → decisions (via decision_pearls)
  for (const dp of decisionPearls) {
    edges.push({
      source: dp.pearl_id,
      target: dp.decision_id,
      type: dp.relationship as 'supports' | 'contradicts',
      strength: dp.relationship === 'supports' ? 0.8 : 0.5,
    });
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

/**
 * Build an enriched constellation response with full Decision/Action/Pearl objects
 * alongside the graph data. Used by the sidebar for interactive display.
 */
export function buildEnrichedResponse(
  graph: ConstellationData,
  fullDecisions: FullDecisionRow[],
  decisionPearls: DecisionPearlRow[],
  fullActions: FullActionRow[],
  fullPearls: FullPearlRow[],
): EnrichedConstellationResponse {
  // Build decision-pearl links lookup
  const dpByDecision = new Map<string, DecisionPearl[]>();
  for (const dp of decisionPearls) {
    const existing = dpByDecision.get(dp.decision_id) ?? [];
    existing.push({
      pearlId: dp.pearl_id,
      relationship: dp.relationship as 'supports' | 'contradicts',
    });
    dpByDecision.set(dp.decision_id, existing);
  }

  // Map decision rows → Decision objects
  const decisions: Record<string, Decision> = {};
  for (const row of fullDecisions) {
    decisions[row.id] = {
      id: row.id,
      userId: row.user_id,
      summaryId: row.summary_id,
      statement: row.statement,
      reasoning: row.reasoning ?? '',
      confidence: row.confidence as DecisionConfidence,
      status: row.status as DecisionStatus,
      supportingPearls: dpByDecision.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Map action rows → Action objects grouped by decision ID
  const actions: Record<string, Action[]> = {};
  for (const row of fullActions) {
    const action: Action = {
      id: row.id,
      userId: row.user_id,
      decisionId: row.decision_id,
      description: row.description,
      contextCard: row.context_card,
      status: row.status as ActionStatus,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const existing = actions[row.decision_id] ?? [];
    existing.push(action);
    actions[row.decision_id] = existing;
  }

  // Map pearl rows → Pearl objects
  const pearls: Record<string, Pearl> = {};
  for (const row of fullPearls) {
    pearls[row.id] = {
      id: row.id,
      insight: row.insight ?? '',
      concepts: row.concepts,
      quote: row.quote ?? undefined,
    };
  }

  return { ...graph, decisions, actions, pearls };
}

/** Compute recency as 0-1 value. Items from the last 7 days are > 0.5. */
function computeRecency(timestamp: number, now: number): number {
  const ageMs = now - timestamp;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, 1 - ageMs / (sevenDaysMs * 4)); // Fade over ~28 days
}
