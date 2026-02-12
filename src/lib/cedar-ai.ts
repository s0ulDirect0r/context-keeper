import Anthropic from '@anthropic-ai/sdk';
import type { Pearl, SummaryContext } from './claude';
import type {
  GenerateDecisionsOutput,
  GenerateActionsOutput,
  ActionContextCard,
  DecisionPearl,
  DecisionConfidence,
} from './types/cedar';

const client = new Anthropic();

// ── Decision surfacing ──────────────────────────────────────────────

const DECISION_SYSTEM_PROMPT = `You are a strategic advisor who reads evidence carefully and surfaces the decisions it implies. You never manufacture urgency or invent action items to seem useful.

You receive:
1. A meeting summary (how the evidence was interpreted)
2. Pearls — crystallized observations with quotes and insights
3. The user's strategic context (what they care about)

Your job: identify 2-5 decision points that the evidence suggests. Each decision is a HYPOTHESIS — a testable prediction about what to do.

## Rules

- Every decision must be grounded in at least one Pearl. Reference them by their ID.
- Decisions can have supporting AND contradicting evidence. Surface both.
- Confidence reflects evidence strength:
  - "low" — suggestive but incomplete. More evidence needed.
  - "medium" — reasonable hypothesis with supporting evidence.
  - "high" — strong evidence, clear direction.
- "No decisions needed" is a valid output. Return an empty array if the evidence doesn't imply action. Do not force decisions that aren't there.
- Decisions should be specific and testable, not vague platitudes.
  BAD: "Improve communication with the team"
  GOOD: "Prioritize the Q2 deadline over feature completeness"
- Frame decisions as hypotheses: "Based on [evidence], [action] would [expected outcome]"`;

const DECISION_TOOL: Anthropic.Tool = {
  name: 'surface_decisions',
  description: 'Submit decision hypotheses surfaced from the evidence (Pearls).',
  input_schema: {
    type: 'object' as const,
    properties: {
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            statement: {
              type: 'string',
              description: 'The hypothesis — 1-2 sentences, specific and testable',
            },
            reasoning: {
              type: 'string',
              description: 'Why this hypothesis, grounded in the evidence — 2-3 sentences',
            },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Evidence strength assessment',
            },
            supporting_pearls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pearl_id: { type: 'string' },
                  relationship: {
                    type: 'string',
                    enum: ['supports', 'contradicts'],
                  },
                },
                required: ['pearl_id', 'relationship'],
              },
              description: 'Pearl references with support/contradict relationship',
            },
          },
          required: ['statement', 'reasoning', 'confidence', 'supporting_pearls'],
        },
        minItems: 0,
        maxItems: 5,
      },
    },
    required: ['decisions'],
  },
};

/** Raw decision shape from Claude tool response (snake_case) */
interface RawDecision {
  statement: string;
  reasoning: string;
  confidence: string;
  supporting_pearls: { pearl_id: string; relationship: string }[];
}

export async function surfaceDecisions(
  summaryMarkdown: string,
  pearls: Pearl[],
  context: SummaryContext,
): Promise<GenerateDecisionsOutput> {
  const pearlSummary = pearls
    .map(
      (p) =>
        `- [${p.id}] "${p.quote?.text ?? '(no quote)'}" — ${p.insight} (concepts: ${p.concepts.join(', ')})`,
    )
    .join('\n');

  const userMessage = `Here is the evidence to analyze:

## Summary
${summaryMarkdown}

## Pearls (evidence)
${pearlSummary}

## User's strategic context
**What they care about:** ${context.extractionGoal}
${context.additionalContext ? `**Additional context:** ${context.additionalContext}` : ''}

Surface the decision hypotheses this evidence implies. If none are warranted, return an empty array.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: DECISION_SYSTEM_PROMPT,
    tools: [DECISION_TOOL],
    tool_choice: { type: 'tool', name: 'surface_decisions' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    const input = toolBlock.input as { decisions?: RawDecision[] };
    const decisions = (input.decisions || []).map((raw) => ({
      statement: raw.statement,
      reasoning: raw.reasoning,
      confidence: raw.confidence as DecisionConfidence,
      status: 'emerging' as const,
      supportingPearls: (raw.supporting_pearls || []).map(
        (sp): DecisionPearl => ({
          pearlId: sp.pearl_id,
          relationship: sp.relationship as 'supports' | 'contradicts',
        }),
      ),
    }));
    return { decisions };
  }

  return { decisions: [] };
}

// ── Action generation ───────────────────────────────────────────────

const ACTION_SYSTEM_PROMPT = `You are a thoughtful advisor who helps turn decisions into concrete next steps. You draft actions that are specific, grounded, and wise.

You receive:
1. A decision (hypothesis to test)
2. The Pearls supporting that decision
3. The user's strategic context

Your job: suggest 1-3 concrete actions that test or advance this decision.

## Rules

- Each action has:
  - A lightweight description (1 sentence, imperative: "Follow up with Sarah about budget")
  - A context card with:
    - The source Pearl quote (verbatim, attributed)
    - The parent decision statement
    - Suggested framing (how to approach this conversation/task)
    - Timing if relevant (before/after a specific event)
    - Key talking points if the action involves a conversation

- Actions should be WISE, not just productive:
  - Sometimes the right action is to observe more before acting
  - Sometimes the right action is a conversation, not a deliverable
  - Sometimes the right action is to wait
  - Frame timing advice relative to upcoming events when known

- If the decision has contradicting evidence, acknowledge it:
  "Note: evidence is mixed on this. Consider [Pearl X] alongside [Pearl Y] when approaching."

- Keep framing concise — 2-3 sentences max. Not a playbook, just orientation.`;

const ACTION_TOOL: Anthropic.Tool = {
  name: 'generate_actions',
  description: 'Submit concrete action items grounded in a decision.',
  input_schema: {
    type: 'object' as const,
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Lightweight imperative description (1 sentence)',
            },
            context_card: {
              type: 'object',
              properties: {
                source_pearl_quote: {
                  type: 'string',
                  description: 'Verbatim quote from the source Pearl',
                },
                source_pearl_speaker: {
                  type: 'string',
                  description: 'Speaker attribution if available',
                },
                source_pearl_insight: {
                  type: 'string',
                  description: 'The Pearl insight text',
                },
                parent_decision_statement: {
                  type: 'string',
                  description: 'The decision this action supports',
                },
                framing: {
                  type: 'string',
                  description: 'How to approach this — 2-3 sentences',
                },
                timing: {
                  type: 'string',
                  description: 'Suggested timing if relevant',
                },
                talking_points: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key points for conversations',
                },
              },
              required: [
                'source_pearl_quote',
                'source_pearl_insight',
                'parent_decision_statement',
                'framing',
              ],
            },
          },
          required: ['description', 'context_card'],
        },
        minItems: 1,
        maxItems: 3,
      },
    },
    required: ['actions'],
  },
};

/** Raw action shape from Claude tool response (snake_case) */
interface RawActionContextCard {
  source_pearl_quote: string;
  source_pearl_speaker?: string;
  source_pearl_insight: string;
  parent_decision_statement: string;
  framing: string;
  timing?: string;
  talking_points?: string[];
}

interface RawAction {
  description: string;
  context_card: RawActionContextCard;
}

export async function generateActions(
  decision: { statement: string; reasoning: string },
  pearls: Pearl[],
  context: SummaryContext,
): Promise<GenerateActionsOutput> {
  const pearlSummary = pearls
    .map(
      (p) =>
        `- "${p.quote?.text ?? '(no quote)'}" (${p.quote?.speaker ?? 'unknown'}) — ${p.insight}`,
    )
    .join('\n');

  const userMessage = `## Decision to act on
**Hypothesis:** ${decision.statement}
**Reasoning:** ${decision.reasoning}

## Supporting Pearls
${pearlSummary}

## User's strategic context
**What they care about:** ${context.extractionGoal}
${context.additionalContext ? `**Additional context:** ${context.additionalContext}` : ''}

Suggest 1-3 concrete actions that test or advance this decision.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: ACTION_SYSTEM_PROMPT,
    tools: [ACTION_TOOL],
    tool_choice: { type: 'tool', name: 'generate_actions' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    const input = toolBlock.input as { actions?: RawAction[] };
    const actions = (input.actions || []).map((raw) => ({
      description: raw.description,
      contextCard: normalizeContextCard(raw.context_card),
    }));
    return { actions };
  }

  return { actions: [] };
}

function normalizeContextCard(raw: RawActionContextCard): ActionContextCard {
  return {
    sourcePearlQuote: raw.source_pearl_quote,
    sourcePearlSpeaker: raw.source_pearl_speaker,
    sourcePearlInsight: raw.source_pearl_insight,
    parentDecisionStatement: raw.parent_decision_statement,
    framing: raw.framing,
    timing: raw.timing,
    talkingPoints: raw.talking_points,
  };
}
