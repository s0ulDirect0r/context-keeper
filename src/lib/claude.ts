import Anthropic from '@anthropic-ai/sdk';

// Re-export shared types so server-side consumers can still import from claude.ts
export type { SummaryContent } from './summary-types';

const client = new Anthropic();

// ── Free-form summary prompt + tool ──────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are an expert meeting analyst. You write meeting summaries in whatever format best serves the content and the recipient's needs.

There is no fixed template. Let the meeting itself dictate the structure — a brainstorm deserves different treatment than a status update, a difficult conversation, or a planning session.

## Guidelines

- **Use verbatim quotes liberally.** When someone said something important, use their exact words. Always attribute quotes to the speaker.
- **Be honest about what happened.** If the meeting was unproductive, say so. If there was tension, name it. Don't sanitize.
- **Write for the specific recipient.** The user will tell you what they care about — tailor the summary to that lens.
- **Prefer depth over breadth.** A few well-developed insights beat a comprehensive but shallow recap.
- **Include action items and decisions** if the meeting produced them, but don't invent structure that wasn't there.
- **Use markdown formatting** — headings, blockquotes, lists, bold — whatever makes the summary scannable and clear.

## Title
- If title metadata is provided, use it directly.
- Otherwise, generate a concise descriptive title (not "Meeting Summary").`;

const SUMMARY_TOOL: Anthropic.Tool = {
  name: 'meeting_summary',
  description: 'Submit a meeting summary with a title and free-form markdown content.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Concise meeting title — use provided metadata or generate a descriptive one',
      },
      summary: {
        type: 'string',
        description: 'The full meeting summary in markdown format. Use headings, quotes, lists, and other markdown as appropriate.',
      },
    },
    required: ['title', 'summary'],
  },
};

export interface ThemeQuote {
  text: string;
  speaker?: string;
}

export interface Pearl {
  id: string;
  insight: string;
  concepts: string[];
  quote?: ThemeQuote;
}

export interface SummaryContext {
  extractionGoal: string;
  additionalContext?: string;
}

export interface SummaryMetadata {
  titles?: string[];
  dates?: string[];
}

export interface GeneratedSummary {
  title: string;
  markdown: string;
}

export async function generateSummary(
  transcripts: string[],
  context: SummaryContext,
  mode: 'combined' | 'separate',
  metadata?: SummaryMetadata
): Promise<GeneratedSummary[]> {
  if (mode === 'combined' || transcripts.length === 1) {
    const combinedTranscript = transcripts.join('\n\n---\n\n');
    const title = metadata?.titles?.length === 1
      ? metadata.titles[0]
      : metadata?.titles?.join(' & ');
    const date = metadata?.dates?.[0];
    const summary = await summarizeSingle(combinedTranscript, context, title, date);
    return [summary];
  }

  const summaries = await Promise.all(
    transcripts.map((transcript, i) =>
      summarizeSingle(
        transcript,
        context,
        metadata?.titles?.[i],
        metadata?.dates?.[i]
      )
    )
  );

  return summaries;
}

async function summarizeSingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
): Promise<GeneratedSummary> {
  const userMessage = buildUserMessage(transcript, context, title, date);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6144,
    system: SUMMARY_SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'meeting_summary' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    const input = toolBlock.input as { title?: string; summary?: string };
    return {
      title: input.title || 'Untitled Summary',
      markdown: input.summary || '',
    };
  }

  // Fallback: use text response directly as markdown
  const textBlock = response.content.find((block) => block.type === 'text');
  if (textBlock && textBlock.type === 'text') {
    return {
      title: title || 'Untitled Summary',
      markdown: textBlock.text,
    };
  }

  throw new Error('Failed to generate summary from Claude');
}

function buildUserMessage(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
): string {
  let message = `Write a meeting summary for this transcript. Use whatever format best serves the content.

**What to extract:** ${context.extractionGoal}`;

  if (context.additionalContext) {
    message += `\n\n**Additional context:** ${context.additionalContext}`;
  }

  if (title) {
    message += `\n\n**Meeting title (from recording metadata):** ${title}`;
  }
  if (date) {
    message += `\n**Meeting date (from recording metadata):** ${date}`;
  }

  message += `\n\n---\n\n**Transcript:**\n${transcript}`;

  return message;
}

// ── Streaming summary (no tool_use, raw markdown output) ────────────

const STREAMING_SUMMARY_SYSTEM_PROMPT = SUMMARY_SYSTEM_PROMPT +
  '\n\nIMPORTANT: Begin your response with a single `# Title` heading on the first line, then write the full summary below it. Do not wrap the output in a code block.';

export function streamSummarySingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
) {
  const userMessage = buildUserMessage(transcript, context, title, date);

  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6144,
    system: STREAMING_SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
}

// ── Pearl extraction ──────────────────────────────────────────────────

const PEARL_EXTRACTION_PROMPT = `You are a field researcher studying how people and teams actually work. Your job is to collect observations — units of evidence about patterns, dynamics, and trajectories in a conversation.

A pearl is not a conclusion or advice. It's an observation that carries interpretive weight. Think field notes, not verdicts. Each pearl should be specific enough to be evidence and open enough to gain meaning alongside future observations.

A good pearl makes someone think: "I wonder if that keeps showing up."

You have the summary (how the meeting was understood) and the transcript (what was actually said). Look for patterns in both.

Rules:
- Extract 3-7 pearls
- Each pearl is 1-2 sentences — a specific, grounded observation
- Observations, not prescriptions. "Trust is being extended before it's been earned" not "they should build more trust first."
- Reflect what's genuinely there. Don't project dynamics that aren't present.
- Name patterns with clarity, not judgment. "Authority is moving from decisions to questions" not "someone is losing control."
- Tag each pearl with 1-3 concept words — these are the axes along which evidence accumulates across meetings. Make them abstract and reusable (e.g. "trust", "ownership", "momentum"), not surface-level topics (e.g. "Q2 budget", "hiring").
- Ground with a verbatim quote when it strengthens the observation
- Each pearl should stand alone as a meaningful data point, but become more powerful in a collection`;

const PEARL_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_pearls',
  description: 'Submit field observations — evidence of patterns and dynamics from the meeting.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pearls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for the pearl' },
            insight: { type: 'string', description: '1-2 sentence distilled truth' },
            concepts: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 3,
              description: 'Abstract concept tags (e.g. "trust", "ownership")',
            },
            quote: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Verbatim quote from transcript' },
                speaker: { type: 'string', description: 'Speaker name if identifiable' },
              },
              required: ['text'],
              description: 'Optional grounding quote',
            },
          },
          required: ['id', 'insight', 'concepts'],
        },
        minItems: 3,
        maxItems: 7,
      },
    },
    required: ['pearls'],
  },
};

export async function extractPearls(
  transcript: string,
  summaryMarkdown: string,
  context: SummaryContext
): Promise<Pearl[]> {
  try {
    const userMessage = `Here is how this meeting was summarized:

---
${summaryMarkdown}
---

Now collect observations. What patterns, dynamics, or trajectories do you see in the conversation? What evidence is here?

**What the user cares about:** ${context.extractionGoal}
${context.additionalContext ? `\n**Additional context:** ${context.additionalContext}` : ''}

---

**Original transcript:**
${transcript}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PEARL_EXTRACTION_PROMPT,
      tools: [PEARL_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_pearls' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      const input = toolBlock.input as { pearls?: Pearl[] };
      return input.pearls || [];
    }

    return [];
  } catch (error) {
    // Pearl extraction is non-critical — log and return empty
    console.error('Pearl extraction failed:', error);
    return [];
  }
}
