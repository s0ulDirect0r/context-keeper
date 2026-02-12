import type { Pearl } from '@/lib/claude';
import type { Decision, Action, ConstellationData } from '@/lib/types/cedar';

export const MOCK_TRANSCRIPT = `Sarah: We need to push the API migration to next sprint.
James: I can have the auth refactor done by Thursday.
Sarah: OK, let's flag it as a blocker in the sprint retro.`;

export const MOCK_SUMMARY_MARKDOWN = `## Meeting Summary

### Key Decisions
- API migration pushed to next sprint due to auth service dependency

### Action Items
- **James**: Complete auth service refactor by Thursday
- **Sarah**: Escalate compliance review if no response by Friday`;

export const MOCK_TAGS = [
  {
    name: 'Technical Dependencies',
    description: 'Cross-team technical blockers',
    quotes: ['auth service refactor is blocking it'],
  },
  {
    name: 'Timeline Pressure',
    description: 'Deadline-driven urgency',
    quotes: ['promised the client a demo in three weeks'],
  },
];

// ── Cedar mock data ──────────────────────────────────────────────────

export const MOCK_PEARLS: Pearl[] = [
  {
    id: 'pearl-1',
    insight: 'Timeline pressure is mounting fast.',
    concepts: ['urgency', 'timeline'],
    quote: {
      text: 'We need to push the API migration to next sprint.',
      speaker: 'Sarah',
    },
  },
  {
    id: 'pearl-2',
    insight: 'James takes ownership of blockers.',
    concepts: ['ownership', 'accountability'],
    quote: {
      text: 'I can have the auth refactor done by Thursday.',
      speaker: 'James',
    },
  },
  {
    id: 'pearl-3',
    insight: 'Process discipline keeps things visible.',
    concepts: ['process', 'transparency'],
    quote: {
      text: "OK, let's flag it as a blocker in the sprint retro.",
      speaker: 'Sarah',
    },
  },
  {
    id: 'pearl-4',
    insight: 'Dependencies are driving scope decisions.',
    concepts: ['dependencies', 'prioritization'],
    quote: {
      text: 'auth service refactor is blocking it',
      speaker: 'James',
    },
  },
  {
    id: 'pearl-5',
    insight: 'Client deadline shapes everything else.',
    concepts: ['urgency', 'accountability'],
    quote: {
      text: 'promised the client a demo in three weeks',
      speaker: 'Sarah',
    },
  },
];

export const MOCK_DECISIONS: Decision[] = [
  {
    id: 'decision-1',
    userId: 'user-1',
    summaryId: 'summary-1',
    statement: 'Prioritize the auth refactor over new feature work to unblock the API migration.',
    reasoning:
      'The API migration is blocked by the auth refactor, and the client demo deadline in three weeks creates urgency. Clearing this blocker first is the critical path.',
    confidence: 'high',
    status: 'emerging',
    supportingPearls: [
      { pearlId: 'pearl-1', relationship: 'supports' },
      { pearlId: 'pearl-4', relationship: 'supports' },
      { pearlId: 'pearl-5', relationship: 'supports' },
    ],
    createdAt: '2026-02-11T10:00:00Z',
    updatedAt: '2026-02-11T10:00:00Z',
  },
  {
    id: 'decision-2',
    userId: 'user-1',
    summaryId: 'summary-1',
    statement: 'Use the sprint retro to formally track cross-team blockers going forward.',
    reasoning:
      "Sarah's instinct to flag blockers in retro suggests the team lacks a structured way to surface dependencies. Formalizing this could prevent future surprises.",
    confidence: 'medium',
    status: 'emerging',
    supportingPearls: [
      { pearlId: 'pearl-3', relationship: 'supports' },
      { pearlId: 'pearl-4', relationship: 'supports' },
    ],
    createdAt: '2026-02-11T10:00:00Z',
    updatedAt: '2026-02-11T10:00:00Z',
  },
  {
    id: 'decision-3',
    userId: 'user-1',
    summaryId: 'summary-1',
    statement:
      'Delegate the auth refactor entirely to James and shield him from other work until Thursday.',
    reasoning:
      "James volunteered ownership and committed to a timeline. The risk is distraction — if he's pulled onto other tasks, the blocker persists.",
    confidence: 'low',
    status: 'emerging',
    supportingPearls: [
      { pearlId: 'pearl-2', relationship: 'supports' },
      { pearlId: 'pearl-1', relationship: 'contradicts' },
    ],
    createdAt: '2026-02-11T10:00:00Z',
    updatedAt: '2026-02-11T10:00:00Z',
  },
];

export const MOCK_ACTIONS: Action[] = [
  {
    id: 'action-1',
    userId: 'user-1',
    decisionId: 'decision-1',
    description: 'Confirm with James that auth refactor is his sole priority until Thursday.',
    contextCard: {
      sourcePearlQuote: 'I can have the auth refactor done by Thursday.',
      sourcePearlSpeaker: 'James',
      sourcePearlInsight: 'James takes ownership of blockers.',
      parentDecisionStatement:
        'Prioritize the auth refactor over new feature work to unblock the API migration.',
      framing:
        'Position this as support, not micromanagement. James volunteered — reinforce that ownership.',
      timing: 'Before end of day today',
      talkingPoints: [
        'Acknowledge his initiative on the auth refactor',
        'Ask what he needs to stay unblocked',
        'Confirm no other tasks will compete for his time',
      ],
    },
    status: 'pending',
    dueDate: null,
    createdAt: '2026-02-11T10:05:00Z',
    updatedAt: '2026-02-11T10:05:00Z',
  },
  {
    id: 'action-2',
    userId: 'user-1',
    decisionId: 'decision-1',
    description: 'Draft the sprint retro agenda item flagging the API migration blocker.',
    contextCard: {
      sourcePearlQuote: "OK, let's flag it as a blocker in the sprint retro.",
      sourcePearlSpeaker: 'Sarah',
      sourcePearlInsight: 'Process discipline keeps things visible.',
      parentDecisionStatement:
        'Prioritize the auth refactor over new feature work to unblock the API migration.',
      framing:
        'Frame as "how do we prevent this pattern" rather than "who dropped the ball." Focus forward.',
    },
    status: 'pending',
    dueDate: null,
    createdAt: '2026-02-11T10:05:00Z',
    updatedAt: '2026-02-11T10:05:00Z',
  },
  {
    id: 'action-3',
    userId: 'user-1',
    decisionId: 'decision-2',
    description: 'Propose a "dependency radar" section in the weekly standup format.',
    contextCard: {
      sourcePearlQuote: "OK, let's flag it as a blocker in the sprint retro.",
      sourcePearlSpeaker: 'Sarah',
      sourcePearlInsight: 'Process discipline keeps things visible.',
      parentDecisionStatement:
        'Use the sprint retro to formally track cross-team blockers going forward.',
      framing:
        'This is a lightweight process improvement — a 2-minute section, not a new ceremony. Low cost, high signal.',
      timing: 'At the upcoming sprint retro',
    },
    status: 'pending',
    dueDate: null,
    createdAt: '2026-02-11T10:05:00Z',
    updatedAt: '2026-02-11T10:05:00Z',
  },
];

export const MOCK_CONSTELLATION: ConstellationData = {
  nodes: [
    // Pearl cluster nodes
    {
      id: 'cluster-urgency',
      type: 'pearl-cluster',
      label: 'urgency',
      concept: 'urgency',
      pearlCount: 2,
      size: 24,
      recency: 0.9,
    },
    {
      id: 'cluster-accountability',
      type: 'pearl-cluster',
      label: 'accountability',
      concept: 'accountability',
      pearlCount: 2,
      size: 24,
      recency: 0.9,
    },
    {
      id: 'cluster-process',
      type: 'pearl-cluster',
      label: 'process',
      concept: 'process',
      pearlCount: 1,
      size: 16,
      recency: 0.8,
    },
    {
      id: 'cluster-dependencies',
      type: 'pearl-cluster',
      label: 'dependencies',
      concept: 'dependencies',
      pearlCount: 1,
      size: 16,
      recency: 0.85,
    },
    // Decision nodes
    {
      id: 'decision-1',
      type: 'decision',
      label: 'Prioritize auth refactor',
      confidence: 'high',
      decisionStatus: 'emerging',
      size: 20,
      recency: 0.95,
    },
    {
      id: 'decision-2',
      type: 'decision',
      label: 'Formalize blocker tracking',
      confidence: 'medium',
      decisionStatus: 'emerging',
      size: 18,
      recency: 0.95,
    },
    // Action nodes
    {
      id: 'action-1',
      type: 'action',
      label: 'Confirm James priority',
      actionStatus: 'pending',
      size: 12,
      recency: 0.95,
    },
    {
      id: 'action-2',
      type: 'action',
      label: 'Draft retro agenda item',
      actionStatus: 'pending',
      size: 12,
      recency: 0.95,
    },
  ],
  edges: [
    // Pearl clusters → Decisions
    {
      source: 'cluster-urgency',
      target: 'decision-1',
      type: 'supports',
      strength: 0.9,
    },
    {
      source: 'cluster-dependencies',
      target: 'decision-1',
      type: 'supports',
      strength: 0.85,
    },
    {
      source: 'cluster-process',
      target: 'decision-2',
      type: 'supports',
      strength: 0.7,
    },
    // Decisions → Actions
    {
      source: 'decision-1',
      target: 'action-1',
      type: 'derives',
      strength: 1.0,
    },
    {
      source: 'decision-1',
      target: 'action-2',
      type: 'derives',
      strength: 1.0,
    },
  ],
};

export const MOCK_TEAM_CONSTELLATION: ConstellationData = {
  nodes: [
    // Sandra's pearl clusters
    {
      id: 'cluster-trust-sandra',
      type: 'pearl-cluster',
      label: 'trust',
      concept: 'trust',
      pearlCount: 3,
      size: 28,
      recency: 0.9,
      contributor: 'Sandra',
    },
    {
      id: 'cluster-budget-sandra',
      type: 'pearl-cluster',
      label: 'budget',
      concept: 'budget',
      pearlCount: 2,
      size: 20,
      recency: 0.85,
      contributor: 'Sandra',
    },
    // Marcus's pearl clusters
    {
      id: 'cluster-trust-marcus',
      type: 'pearl-cluster',
      label: 'trust',
      concept: 'trust',
      pearlCount: 2,
      size: 20,
      recency: 0.8,
      contributor: 'Marcus',
    },
    {
      id: 'cluster-hiring-marcus',
      type: 'pearl-cluster',
      label: 'hiring',
      concept: 'hiring',
      pearlCount: 4,
      size: 32,
      recency: 0.95,
      contributor: 'Marcus',
    },
    // Priya's pearl clusters
    {
      id: 'cluster-timeline-priya',
      type: 'pearl-cluster',
      label: 'timeline',
      concept: 'timeline',
      pearlCount: 3,
      size: 24,
      recency: 0.92,
      contributor: 'Priya',
    },
    // Shared decision
    {
      id: 'team-decision-1',
      type: 'decision',
      label: 'Rebuild team trust before Q2 push',
      confidence: 'medium',
      decisionStatus: 'active',
      size: 22,
      recency: 0.9,
      contributor: 'Team',
    },
    // Team actions
    {
      id: 'team-action-1',
      type: 'action',
      label: 'Schedule trust retrospective',
      actionStatus: 'in_progress',
      size: 14,
      recency: 0.88,
      contributor: 'Sandra',
    },
    {
      id: 'team-action-2',
      type: 'action',
      label: 'Draft hiring timeline for Q2',
      actionStatus: 'pending',
      size: 14,
      recency: 0.92,
      contributor: 'Marcus',
    },
  ],
  edges: [
    {
      source: 'cluster-trust-sandra',
      target: 'team-decision-1',
      type: 'supports',
      strength: 0.8,
    },
    {
      source: 'cluster-trust-marcus',
      target: 'team-decision-1',
      type: 'supports',
      strength: 0.7,
    },
    {
      source: 'team-decision-1',
      target: 'team-action-1',
      type: 'derives',
      strength: 1.0,
    },
    {
      source: 'cluster-hiring-marcus',
      target: 'team-action-2',
      type: 'derives',
      strength: 0.9,
    },
  ],
};
