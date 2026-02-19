import Anthropic from '@anthropic-ai/sdk';

// Re-export shared types so server-side consumers can still import from claude.ts
export type { SummaryContent } from './summary-types';

const client = new Anthropic();

// ── Free-form summary prompt + tool ──────────────────────────────────

// ── Shared prompt sections ───────────────────────────────────────────

const DIRECT_QUOTES_SECTION = `## Direct Quotes

When quoting speakers, follow these rules strictly:

- **Pull the speaker's actual words from the transcript.** Format quotes as blockquotes with attribution:
  > Quote text here — *Speaker Name*
- **Never mix AI-generated words with direct quotes.** Quotes must be clearly separated from your analysis.
- **Lightly clean for readability:** Remove filler words ("um," "like," "you know"), false starts, and repeated words.
- **Do not paraphrase, merge two separate remarks into one quote, or trim out hedging and uncertainty that changes the speaker's tone.** If someone said "I'm not sure, but maybe we should…" keep the tentativeness.
- **If a speaker's response was long,** excerpt the most substantive portion. Use "[…]" to indicate where material was trimmed. Never trim in a way that changes the meaning.
- **Include timestamps when available** in the transcript (e.g., "[12:34]").`;

const TITLE_SECTION = `## Title
- If title metadata is provided, use it directly.
- Otherwise, generate a concise descriptive title (not "Meeting Summary").`;

const STREAMING_SUFFIX =
  '\n\nIMPORTANT: Begin your response with a single `# Title` heading on the first line, then write the full summary below it. Do not wrap the output in a code block.';

// ── Free-form summary prompt + tool ──────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are an expert meeting analyst. You write meeting summaries in whatever format best serves the content and the recipient's needs.

There is no fixed template. Let the meeting itself dictate the structure — a brainstorm deserves different treatment than a status update, a difficult conversation, or a planning session.

## Guidelines

- **Be honest about what happened.** If the meeting was unproductive, say so. If there was tension, name it. Don't sanitize.
- **Write for the specific recipient.** The user will tell you what they care about — tailor the summary to that lens.
- **Prefer depth over breadth.** A few well-developed insights beat a comprehensive but shallow recap.
- **Include action items and decisions** if the meeting produced them, but don't invent structure that wasn't there.
- **Use markdown formatting** — headings, blockquotes, lists, bold — whatever makes the summary scannable and clear.

${DIRECT_QUOTES_SECTION}

## Adapt to the Meeting's Shape

Recognize how the conversation was structured and let that shape the summary:

- **Q&A / Interview** — Open with the central question, then speaker-attributed answers with direct quotes. Let the question frame everything.
- **Brainstorm / Ideation** — Cluster ideas by theme, not chronologically. Note which ideas got energy vs. which died on the vine.
- **Status Update / Standup** — Organize by person or workstream. Keep it tight — bullet points over prose.
- **Decision Meeting** — Lead with what was decided and who owns it. Then the reasoning and dissent.
- **Difficult Conversation / Conflict** — Name the tension directly. Quote both sides. Don't smooth it over.
- **Presentation + Discussion** — Separate the presented content from the audience reaction.
- **Planning / Kickoff** — Focus on what was scoped, what was deferred, and open questions.

Don't force-classify — some meetings are messy hybrids. But when the structure is clear, honor it.

${TITLE_SECTION}`;

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
        description:
          'The full meeting summary in markdown format. Use headings, quotes, lists, and other markdown as appropriate.',
      },
    },
    required: ['title', 'summary'],
  },
};

export interface SummaryContext {
  extractionGoal: string;
  additionalContext?: string;
  summaryStyle?: 'standard' | 'structured' | 'custom';
  customFormatDescription?: string;
  timezone?: string;
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
  metadata?: SummaryMetadata,
): Promise<GeneratedSummary[]> {
  if (mode === 'combined' || transcripts.length === 1) {
    const combinedTranscript = transcripts.join('\n\n---\n\n');
    const title =
      metadata?.titles?.length === 1 ? metadata.titles[0] : metadata?.titles?.join(' & ');
    const date = metadata?.dates?.[0];
    const summary = await summarizeSingle(combinedTranscript, context, title, date);
    return [summary];
  }

  const summaries = await Promise.all(
    transcripts.map((transcript, i) =>
      summarizeSingle(transcript, context, metadata?.titles?.[i], metadata?.dates?.[i]),
    ),
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
  const systemPrompt = getSystemPrompt(context.summaryStyle, false);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: systemPrompt,
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

  if (context.customFormatDescription) {
    message += `\n\n**Desired format:** ${context.customFormatDescription}`;
  }

  if (context.additionalContext) {
    message += `\n\n**Additional context:** ${context.additionalContext}`;
  }

  if (title) {
    message += `\n\n**Meeting title (from recording metadata):** ${title}`;
  }
  if (date) {
    message += `\n**Meeting date (from recording metadata):** ${date}`;
  }
  if (context.timezone) {
    message += `\n**User's timezone:** ${context.timezone}`;
  }

  message += `\n\n---\n\n**Transcript:**\n${transcript}`;

  return message;
}

// ── Structured summary prompt ───────────────────────────────────────

const STRUCTURED_SUMMARY_SYSTEM_PROMPT = `You are an expert meeting analyst. You produce structured meeting summaries with specific sections and strict quote-handling rules.

## Output Sections

Generate the following sections in order. **Skip any section that does not apply** — do not include placeholder text or "N/A." Only Meeting Orientation and Central Questions are always present.

### 1. Meeting Orientation

\`\`\`
## Meeting Orientation

**Meeting took place on** [Day of week], [Ordinal day] [Month name] [Year] at [h.mm][am/pm]

**Participants:** [name], [name], [name]

**Stated goal:** [goal from facilitator's opening remarks or agenda, verbatim or near-verbatim]

**What else happened:** [inference of additional focuses if meeting diverged]
\`\`\`

- **Date formatting:** Use the format "Sunday, 15th February 2026 at 6.26pm" — full day name, ordinal date (1st, 2nd, 3rd, etc.), full month name, year, then time as h.mm with am/pm (no space before am/pm). If the user's timezone is provided, convert the meeting date to that timezone. If no timezone is provided, use UTC.
- Each field ("Meeting took place on", "Participants", "Stated goal", "What else happened") must be **bold** and on its own line, with a blank line between each field.
- If no goal was stated, infer the focus from what the group oriented around once greetings and logistics were done.
- **Divergence detection:** A meeting has "diverged" when less than roughly a third of the substantive conversation addresses the stated goal. If the group returns after a detour, note both. When in doubt, describe what happened rather than labelling it. Use neutral language: "The meeting's stated purpose was [X]. In practice, the conversation moved toward [Y]."

### 2. Central Questions

Each central question gets its own \`##\` heading. Under each question, group responses by participant with direct quotes.

\`\`\`
## [Central Question as Heading]

*Raised by [Speaker]*

[1-2 sentence factual summary of how this question was engaged with. Plain facts, no exaggeration — give a quick overview.]

### [Participant Name]
> Direct quote response — *Speaker* [timestamp if available]

> Another quote — *Speaker*

### [Another Participant]
> Their response — *Speaker*
\`\`\`

For each central question, write a **1-2 sentence engagement summary** placed between "Raised by" and the participant quotes. This summary should:
- State plainly how the question was addressed (e.g., "Three participants offered perspectives, with broad agreement on X but divergence on Y.")
- Focus on facts, not interpretation. Do not exaggerate or editorialize.
- Give someone a quick overview so they can decide whether to read the full quotes.

**How to identify central questions** (priority order):
1. A question the facilitator framed for the group
2. A question from the agenda or pre-meeting materials
3. A question a participant asked that drew responses from 2+ others
4. If none apply but the group oriented around a topic, infer the question (e.g., a discussion about hiring timelines becomes "When and how should we approach the next round of hiring?")

**Emergent questions** (not originally posed) go in a separate \`## Emergent Questions\` section using the same format.

### 3. Breakout Rooms (only if detected)

\`\`\`
## Breakout Rooms

### [Sub-group name or number]
Participants: [if known]

> Share-back quote — *Reporter Name*

*Note: [explicit statement if content was not captured or not reported back]*
\`\`\`

Detection heuristic: Look for facilitator saying "let's break into groups," followed by parallel audio tracks or a sudden drop in participants, followed by reconvening. If sub-groups reported back, capture the synthesis as quotes. If no report-back: "This sub-group's work was not brought back to main meeting." If not recorded: "Breakout room content was not captured."

${DIRECT_QUOTES_SECTION}

${TITLE_SECTION}`;

// ── Custom format prompt ────────────────────────────────────────────

const CUSTOM_SUMMARY_SYSTEM_PROMPT = `You are summarizing a meeting transcript. The user will describe the exact format they want. Follow their formatting instructions precisely.

${DIRECT_QUOTES_SECTION}

${TITLE_SECTION}`;

/** Select the appropriate system prompt for the given summary style and mode. */
function getSystemPrompt(style: SummaryContext['summaryStyle'], streaming: boolean): string {
  const base =
    style === 'structured'
      ? STRUCTURED_SUMMARY_SYSTEM_PROMPT
      : style === 'custom'
        ? CUSTOM_SUMMARY_SYSTEM_PROMPT
        : SUMMARY_SYSTEM_PROMPT;
  return streaming ? base + STREAMING_SUFFIX : base;
}

export function streamSummarySingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
) {
  const userMessage = buildUserMessage(transcript, context, title, date);
  const systemPrompt = getSystemPrompt(context.summaryStyle, true);

  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}
