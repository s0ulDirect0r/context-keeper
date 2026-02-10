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

