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

export interface Theme {
  id: string;
  label: string;
  quotes: ThemeQuote[];
}

export interface Speaker {
  id: string;
  name: string;
  quotes: ThemeQuote[];
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

const THEME_EXTRACTION_PROMPT = `You are analyzing meeting transcripts to identify abstract conceptual themes - the philosophical, emotional, or interpersonal undercurrents of the conversation.

IMPORTANT DISTINCTION:
- WANTED: Abstract concepts like "Accountability", "Trust", "Growth", "Tension", "Momentum", "Clarity", "Burnout", "Authority", "Alignment", "Ownership"
- NOT WANTED: Surface-level topics like "Q2 Budget", "Dashboard Redesign", "Mike's Review", "Friday Deadline"

Think about the EMOTIONAL and PHILOSOPHICAL SUBTEXT, not the literal agenda items.

For each theme, provide 2-5 verbatim quotes from the transcript that embody that theme. Include the speaker name if identifiable.

Rules:
- Extract 5-7 themes
- Labels should be 1-2 words, abstract concepts
- Quotes must be VERBATIM from the transcript
- Each theme needs 2-5 supporting quotes
- Focus on themes relevant to what the recipient cares about`;

const THEME_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_themes',
  description: 'Submit the extracted abstract conceptual themes from the meeting transcript.',
  input_schema: {
    type: 'object' as const,
    properties: {
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for the theme' },
            label: { type: 'string', description: '1-2 word abstract concept' },
            quotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Verbatim quote from transcript' },
                  speaker: { type: 'string', description: 'Speaker name if identifiable' },
                },
                required: ['text'],
              },
              minItems: 2,
              maxItems: 5,
            },
          },
          required: ['id', 'label', 'quotes'],
        },
        minItems: 3,
        maxItems: 7,
      },
    },
    required: ['themes'],
  },
};

export async function extractThemes(
  transcript: string,
  context: SummaryContext
): Promise<Theme[]> {
  const userMessage = `Identify the abstract conceptual themes in this meeting transcript.

**What the user wants to extract:** ${context.extractionGoal}
${context.additionalContext ? `\n**Additional context:** ${context.additionalContext}` : ''}

Filter themes to focus on what's relevant to these concerns.

---

**Transcript:**
${transcript}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: THEME_EXTRACTION_PROMPT,
    tools: [THEME_EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'extract_themes' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    const input = toolBlock.input as { themes?: Theme[] };
    return input.themes || [];
  }

  throw new Error('Failed to extract themes from transcript');
}

const SPEAKER_EXTRACTION_PROMPT = `You are analyzing a meeting transcript to identify all speakers and extract their key quotes.

Rules:
- Identify all distinct speakers in the transcript
- Use actual names when identifiable from the transcript text
- Use "Speaker 1", "Speaker 2", etc. when names aren't identifiable
- Group unattributed speech under "Unknown" if present
- Extract 3-5 key/representative quotes per speaker (verbatim from transcript)
- Order speakers by amount of speaking time (most first)
- Quotes should capture that speaker's most important or characteristic contributions`;

const SPEAKER_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_speakers',
  description: 'Submit the extracted speakers and their key quotes from the meeting transcript.',
  input_schema: {
    type: 'object' as const,
    properties: {
      speakers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for the speaker' },
            name: { type: 'string', description: 'Speaker name' },
            quotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Verbatim quote from transcript' },
                },
                required: ['text'],
              },
              minItems: 1,
              maxItems: 5,
            },
          },
          required: ['id', 'name', 'quotes'],
        },
      },
    },
    required: ['speakers'],
  },
};

export async function extractSpeakers(
  transcript: string,
  knownSpeakerNames?: string[]
): Promise<Speaker[]> {
  const knownNames = knownSpeakerNames?.length
    ? `\n\nThe known speakers in this meeting are: ${knownSpeakerNames.join(', ')}. Use these exact names.`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SPEAKER_EXTRACTION_PROMPT,
    tools: [SPEAKER_EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'extract_speakers' },
    messages: [{
      role: 'user',
      content: `Identify all speakers and their key quotes from this transcript:${knownNames}\n\n${transcript}`,
    }],
  });

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    const input = toolBlock.input as { speakers?: Speaker[] };
    return input.speakers || [];
  }

  return [];
}
