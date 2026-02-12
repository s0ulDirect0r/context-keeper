// Cedar types — Decisions, Actions, and Constellation graph structures.
// Kept separate from claude.ts to avoid pulling AI SDK into the browser bundle.

import type { Pearl, SummaryContext } from '../claude';

// ── Decisions ──────────────────────────────────────────────────────

export type DecisionConfidence = 'low' | 'medium' | 'high';
export type DecisionStatus = 'emerging' | 'active' | 'resolved' | 'revised' | 'dismissed';

export interface DecisionPearl {
  pearlId: string;
  relationship: 'supports' | 'contradicts';
}

export interface Decision {
  id: string;
  userId: string;
  summaryId: string;
  statement: string;
  reasoning: string;
  confidence: DecisionConfidence;
  status: DecisionStatus;
  supportingPearls: DecisionPearl[];
  createdAt: string;
  updatedAt: string;
}

// AI generation input/output
export interface GenerateDecisionsInput {
  summaryMarkdown: string;
  pearls: Pearl[];
  context: SummaryContext;
}

export interface GenerateDecisionsOutput {
  decisions: Omit<Decision, 'id' | 'userId' | 'summaryId' | 'createdAt' | 'updatedAt'>[];
}

// ── Actions ────────────────────────────────────────────────────────

export type ActionStatus = 'pending' | 'in_progress' | 'done';

export interface ActionContextCard {
  sourcePearlQuote: string;
  sourcePearlSpeaker?: string;
  sourcePearlInsight: string;
  parentDecisionStatement: string;
  framing: string;
  timing?: string;
  talkingPoints?: string[];
}

export interface Action {
  id: string;
  userId: string;
  decisionId: string;
  description: string;
  contextCard: ActionContextCard | null;
  status: ActionStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateActionsInput {
  decision: Pick<Decision, 'statement' | 'reasoning'>;
  pearls: Pearl[];
  context: SummaryContext;
}

export interface GenerateActionsOutput {
  actions: { description: string; contextCard: ActionContextCard }[];
}

// ── Constellation ──────────────────────────────────────────────────

export type ConstellationNodeType = 'pearl-cluster' | 'decision' | 'action';

export interface ConstellationNode {
  id: string;
  type: ConstellationNodeType;
  label: string;
  // Pearl cluster fields
  concept?: string;
  pearlCount?: number;
  insights?: string[]; // Top insight previews for cluster cards
  // Decision fields
  confidence?: DecisionConfidence;
  decisionStatus?: DecisionStatus;
  // Action fields
  actionStatus?: ActionStatus;
  // Visual encoding
  size: number;
  recency: number; // 0-1, newer = higher
  // Team view
  contributor?: string;
}

export interface ConstellationEdge {
  source: string;
  target: string;
  type: 'supports' | 'contradicts' | 'derives';
  strength: number; // 0-1
}

export interface ConstellationData {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
}

// ── State transition validation ────────────────────────────────────

const VALID_DECISION_TRANSITIONS: Record<string, DecisionStatus[]> = {
  emerging: ['active', 'dismissed'],
  active: ['resolved', 'revised'],
  resolved: ['revised'],
  revised: ['active'],
  dismissed: [], // terminal state
};

const VALID_ACTION_TRANSITIONS: Record<string, ActionStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['done', 'pending'],
  done: [], // terminal state
};

export function isValidDecisionTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return VALID_DECISION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidActionTransition(from: ActionStatus, to: ActionStatus): boolean {
  return VALID_ACTION_TRANSITIONS[from]?.includes(to) ?? false;
}
