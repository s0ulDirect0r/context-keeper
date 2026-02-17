import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

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

## Title
- If title metadata is provided, use it directly.
- Otherwise, generate a concise descriptive title (not "Meeting Summary").`;

// ── Structured summary prompt ────────────────────────────────────────

const STRUCTURED_SUMMARY_SYSTEM_PROMPT = `You are Cedar, an expert meeting analyst who produces structured, quote-driven summaries. Your summaries follow a specific format with clearly defined sections. You never paraphrase — you pull actual words from the transcript.

## Output Structure

Your summary MUST use these sections in order. Omit any section that does not apply to this meeting — do not include sections with filler or "N/A."

### Date line

Immediately after the \`# Title\` heading, on the very next line, output the meeting date as an italic subtitle:

*Meeting Date: February 16, 2026*

If a time or timezone is available, include it: *Meeting Date: February 16, 2026, 2:00-3:30 PM PST*

Do NOT put this inside a section or use a bold label like "Date and time:". It should stand alone as a clean subtitle.

### Section 1: Meeting Orientation

Start with this section. It helps the reader immediately understand what happened.

- **Stated goal or agenda:** If the meeting had a stated goal (from facilitator's opening remarks or agenda), display it verbatim or near-verbatim.
- **Divergence detection:** If the actual conversation diverged from the stated goal — meaning less than roughly one-third of substantive discussion addressed it — flag this plainly:
  *"The meeting's stated purpose was [X]. In practice, the conversation moved toward [Y]."*
  Do NOT frame divergence as a failure or problem. Use neutral language.
- **Inferred focus:** If no goal was stated, infer the focus — the topic the group oriented around once greetings and logistics were done.
- If the group returned to the stated goal after a detour, note both the detour and the return.

### Section 2: Central Questions

This is the core of the summary. Organize around questions, not topics.

**Identifying central questions (priority order):**
1. A question the facilitator framed for the group
2. A question from the agenda or pre-meeting materials
3. A question a participant asked that drew responses from 2+ others
4. If none of the above apply but the group clearly oriented around a topic, frame it as a question (e.g., a discussion about hiring timelines becomes "When and how should we approach the next round of hiring?")

**Format for each question:**

Use a ### heading for each question. Show who raised it. Then list participant responses as **direct quotes**, grouped under speaker-name subheadings with bullet points.

Each question MUST carry a status label — one of:
- **Resolved** — a clear decision was made or explicit agreement was reached
- **Explored** — substantive responses were given but no resolution or decision emerged
- **Surfaced** — the question was raised but not substantively discussed

**Emergent questions** — questions that emerged during the conversation (not originally posed) — go in a separate "## Emergent Questions" subsection, following the same format and status labels.

**Direct quote rules:**
- Pull the speaker's ACTUAL WORDS from the transcript
- Lightly clean for readability: remove filler words ("um," "like," "you know"), false starts, and repeated words
- Do NOT paraphrase, merge two separate remarks into one quote, or trim hedging/uncertainty that changes tone. If someone said "I'm not sure, but maybe we should…" — keep the tentativeness
- For long responses, excerpt the most substantive portion. Use "[…]" to mark where material was trimmed. Never trim in a way that changes meaning
- Always attribute quotes to the speaker by name

### Section 3: Breakout Rooms / Sub-Groups

Only include this section if breakout rooms or sub-groups occurred.

- Note when breakout/sub-groups happened and who participated (if available)
- If sub-groups reported back, capture the share-back as **direct quotes** from the person who reported
- If no report-back occurred, note: *"This sub-group's work was not brought back to the main meeting."*
- If sub-group content is unavailable (e.g., breakout rooms not recorded), note: *"Breakout room content was not captured."*

Detect breakout rooms from transcript patterns: facilitator saying "let's break into groups," sudden drop in participants, followed by reconvening.

### Section 4: Cedar's Read on the Room (only if requested)

**Only include this section if the user message explicitly says to include Cedar's perspective.** If the user message says to skip it, end the summary after the previous sections.

Use EXACTLY this heading: \`## Cedar's Read on the Room\`

This section is your interpretive analysis — the relational dynamics and "warm data" that don't show up in a structural summary. You speak as an outside consultant with a background in relational group practices and organisational behaviour.

**Keep it concise — 2-4 short paragraphs maximum.** Surface the 2-3 most notable dynamics, not an exhaustive inventory. Each observation should be specific and grounded in something from the transcript.

**What to pay attention to (pick the most salient, not all):**
- Who spoke and who stayed quiet
- Shifts in energy — activation, deflation, tension, or relief
- Topics the group avoided or moved past quickly
- People talking past each other
- Something important said casually that no one picked up

**Hard boundaries:**
- NEVER evaluate individuals (e.g., "Jared wasn't contributing enough")
- NEVER prescribe what should have happened
- DO name patterns and ask questions (e.g., "The group moved away from the budget discussion twice. It might be worth asking what makes that topic hard to stay with.")
- Do NOT assign causation

**Tone:** Warm, observational, curious. Hedging language ("it seems like," "it might be worth noticing") — you're working from a transcript, not from being in the room.

## Global Rules

- The user will provide an extraction goal — use it as an additional lens on the meeting, but always follow the structured format above
- Sections 1-3 are purely structural and quote-based. NO AI voice or interpretation in those sections.
- Section 4 (Cedar's Read) is the ONLY place for interpretive commentary
- Use markdown formatting: headings, blockquotes for quotes, bold for emphasis, bullet lists
- Be honest. If the meeting was unproductive, say so. If there was tension, name it.

## Title
- If title metadata is provided, use it directly
- Otherwise, generate a concise descriptive title (not "Meeting Summary")`;

const STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT =
  STRUCTURED_SUMMARY_SYSTEM_PROMPT +
  '\n\nIMPORTANT: Begin your response with a single `# Title` heading on the first line, then write the full summary below it. Do not wrap the output in a code block.';

// ── Free-form summary tool ──────────────────────────────────────────

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

export interface ThemeQuote {
  text: string;
  speaker?: string;
  isUser?: boolean;
}

export interface Pearl {
  id: string;
  insight: string;
  concepts: string[];
  quote?: ThemeQuote;
}

export type SummaryStyle = 'standard' | 'structured';

export interface SummaryContext {
  extractionGoal: string;
  additionalContext?: string;
  summaryStyle?: SummaryStyle;
  includeCedarView?: boolean;
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
  const systemPrompt =
    context.summaryStyle === 'structured'
      ? STRUCTURED_SUMMARY_SYSTEM_PROMPT
      : SUMMARY_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6144,
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
  const instruction =
    context.summaryStyle === 'structured'
      ? 'Write a structured meeting summary for this transcript. Follow the section format defined in your system instructions.'
      : 'Write a meeting summary for this transcript. Use whatever format best serves the content.';

  let message = `${instruction}

**What to extract:** ${context.extractionGoal}`;

  if (context.summaryStyle === 'structured') {
    if (context.includeCedarView) {
      message += `\n\n**Include Cedar's Read on the Room** — provide your interpretive perspective on the relational dynamics.`;
    } else {
      message += `\n\n**Skip Cedar's Read on the Room** — do not include Section 4.`;
    }
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

  message += `\n\n---\n\n**Transcript:**\n${transcript}`;

  return message;
}

// ── Streaming summary (no tool_use, raw markdown output) ────────────

const STREAMING_SUMMARY_SYSTEM_PROMPT =
  SUMMARY_SYSTEM_PROMPT +
  '\n\nIMPORTANT: Begin your response with a single `# Title` heading on the first line, then write the full summary below it. Do not wrap the output in a code block.';

export function streamSummarySingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
) {
  const userMessage = buildUserMessage(transcript, context, title, date);
  const systemPrompt =
    context.summaryStyle === 'structured'
      ? STRUCTURED_STREAMING_SUMMARY_SYSTEM_PROMPT
      : STREAMING_SUMMARY_SYSTEM_PROMPT;

  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6144,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}

// ── Tag extraction (first pass) ──────────────────────────────────────

const TAG_EXTRACTION_PROMPT = `You are a field researcher preparing to study a conversation. Before collecting observations, you need to identify the conceptual landscape — the themes, dynamics, and domains present in this meeting.

Extract 10-15 concept tags that represent the key themes, dynamics, and patterns in this conversation. These tags should be:
- EXACTLY ONE WORD each, matching the regex /^\\S+$/ — no spaces, no exceptions. If a concept is naturally two words (e.g. "team dynamics"), find the single word that captures the essence ("dynamics"). Hyphenated compounds like "decision-making" are acceptable.
- Abstract and reusable (e.g. "trust", "ownership", "momentum", "alignment"), not surface-level topics
- Mix of interpersonal dynamics ("conflict", "delegation"), process patterns ("prioritization"), and conceptual themes ("innovation", "risk")
- Specific enough to be meaningful, broad enough to apply across meetings

Think of these as the axes along which evidence might accumulate over time.`;

const TAG_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_tags',
  description: 'Submit concept tags identified in the conversation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The concept tag (exactly one word, lowercase)' },
            reason: {
              type: 'string',
              description: 'Brief explanation of why this tag is present (1 sentence)',
            },
          },
          required: ['name', 'reason'],
        },
        minItems: 10,
        maxItems: 15,
        description: 'Concept tags found in the conversation',
      },
    },
    required: ['tags'],
  },
};

export interface ConceptTag {
  name: string;
  reason: string;
}

export async function extractTags(
  transcript: string,
  context: SummaryContext,
): Promise<ConceptTag[]> {
  try {
    const userMessage = `What conceptual themes, dynamics, and patterns are present in this conversation?

**What the user cares about:** ${context.extractionGoal}
${context.additionalContext ? `\n**Additional context:** ${context.additionalContext}` : ''}

---

**Transcript:**
${transcript}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: TAG_EXTRACTION_PROMPT,
      tools: [TAG_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_tags' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (toolBlock && toolBlock.type === 'tool_use') {
      const input = toolBlock.input as { tags?: ConceptTag[] };
      // Enforce single-word tags — drop any with whitespace
      return (input.tags || []).filter((tag) => /^\S+$/.test(tag.name));
    }

    return [];
  } catch (error) {
    logger.error('Tag extraction failed', { transcriptLength: transcript.length }, error);
    return [];
  }
}

// ── Pearl extraction (second pass — scoped to selected tags) ─────────

const PEARL_EXTRACTION_PROMPT = `You are a reflective mirror — someone who watches conversations carefully and gently surfaces what's really happening for the person reading this.

Your job is to write pearls: short observations that help someone see patterns in their own work and relationships. Each pearl is anchored by a quote from the conversation and followed by a brief insight that connects the quote to something worth noticing.

A good pearl makes someone pause and think: "Huh... I hadn't seen it that way."

You have the summary (how the meeting was understood) and the transcript (what was actually said). Look for patterns in both.

## Voice

The user message will tell you who the reader is (or that they're not a speaker). Follow those instructions for voice:
- When the reader IS a speaker: use "you" for pearls about them, use the speaker's name (third person) for pearls about others.
- When the reader is NOT a speaker: use the quoted speaker's name as the subject for all pearls. Never use "you."

If you know the reader's name, you may use it occasionally for warmth (e.g. "Sarah, there's a pattern here..."), but don't overdo it — mostly use "you" for their pearls.

The tone is a reflective mirror: gentle, observational, not prescriptive. You surface what's there — you don't tell them what to do about it.

Insights must be **short and punchy — 6 to 12 words.** Think caption, not commentary.

- GOOD: "You extend trust before it's earned."
- GOOD: "You pull back when Alex raises timelines."
- GOOD: "Alex deflects whenever ownership comes up."
- GOOD: "You're carrying more weight than anyone sees."
- BAD (too long): "There's a pattern of you extending trust early — something that seems to come naturally"
- BAD (prescriptive): "You should be more careful with trust"

## Rules

- Extract 3-7 pearls
- **Every pearl must have a grounding quote.** No exceptions. The quote is the anchor — the insight explains why it matters.
- The insight is **one short sentence, 6-12 words.** If it's longer, cut it. No em-dashes, no clauses, no elaboration.
- The insight text must never contain quoted speech or transcript fragments. Quotes belong only in the quote field.
- Observations, not prescriptions. Surface patterns, don't give advice.
- Reflect what's genuinely there. Don't project dynamics that aren't present.
- Tag each pearl with 1-3 concept words — abstract and reusable (e.g. "trust", "ownership", "momentum"), not surface-level topics.
- Always attribute quotes to specific speakers when names are present in the transcript.
- Each pearl should stand alone as a meaningful data point, but become more powerful in a collection.
- If you are told which speaker is the user, set is_user to true on quotes from that speaker.`;

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
            insight: {
              type: 'string',
              description: 'One punchy sentence, 6-12 words, addressed to "you." No quoted speech.',
            },
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
                text: {
                  type: 'string',
                  description: 'Verbatim quote from transcript — the anchor for this pearl',
                },
                speaker: { type: 'string', description: 'Speaker name if identifiable' },
                is_user: {
                  type: 'boolean',
                  description:
                    'True if this quote is from the user (the person reading the summary). Only set if user identity is provided.',
                },
              },
              required: ['text'],
              description: 'Grounding quote from the conversation (required)',
            },
          },
          required: ['id', 'insight', 'concepts', 'quote'],
        },
        minItems: 3,
        maxItems: 7,
      },
    },
    required: ['pearls'],
  },
};

export interface SpeakerIdentity {
  /** The speaker name in the transcript that corresponds to the logged-in user */
  userName?: string;
}

export async function extractPearls(
  transcript: string,
  summaryMarkdown: string,
  context: SummaryContext,
  speakerIdentity?: SpeakerIdentity,
  selectedTags?: string[],
): Promise<Pearl[]> {
  try {
    let userIdentityNote = '';
    if (speakerIdentity?.userName) {
      userIdentityNote = `\n\n**The person reading this is "${speakerIdentity.userName}" in the transcript.** For pearls about this speaker, use "you" and occasionally their name for warmth. Set is_user to true on quotes from this speaker. You may also write pearls about OTHER speakers — for those, use the speaker's name as the subject (third person), not "you."`;
    } else {
      userIdentityNote = `\n\n**The reader is NOT one of the speakers in this conversation.** Do not use "you" in insight text. Instead, make the quoted speaker the subject of each insight (e.g. "Sarah extends trust before it's earned" instead of "You extend trust before it's earned").`;
    }

    let tagFocusNote = '';
    if (selectedTags && selectedTags.length > 0) {
      tagFocusNote = `\n\n**Focus your observations on these concept areas:** ${selectedTags.join(', ')}. Use these tags (and closely related ones) for the concept labels on each pearl. Only extract pearls that are relevant to these themes.`;
    }

    const userMessage = `Here is how this meeting was summarized:

---
${summaryMarkdown}
---

Now collect observations. What patterns, dynamics, or trajectories do you see in the conversation? What evidence is here?

**What the user cares about:** ${context.extractionGoal}
${context.additionalContext ? `\n**Additional context:** ${context.additionalContext}` : ''}${userIdentityNote}${tagFocusNote}

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
      const input = toolBlock.input as { pearls?: RawPearl[] };
      return (input.pearls || []).map(normalizePearl);
    }

    return [];
  } catch (error) {
    // Pearl extraction is non-critical — log and return empty
    logger.error('Pearl extraction failed', { transcriptLength: transcript.length }, error);
    return [];
  }
}

/** Raw pearl shape from Claude's tool response (uses snake_case) */
interface RawPearl {
  id: string;
  insight: string;
  concepts: string[];
  quote?: { text: string; speaker?: string; is_user?: boolean };
}

/** Normalize snake_case tool response to camelCase Pearl type */
function normalizePearl(raw: RawPearl): Pearl {
  const pearl: Pearl = {
    id: raw.id,
    insight: raw.insight,
    concepts: raw.concepts,
  };
  if (raw.quote) {
    pearl.quote = {
      text: raw.quote.text,
      speaker: raw.quote.speaker,
      isUser: raw.quote.is_user ?? false,
    };
  }
  return pearl;
}
