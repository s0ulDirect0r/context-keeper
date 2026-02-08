import Anthropic from '@anthropic-ai/sdk';

// Re-export shared types so server-side consumers can still import from claude.ts
export type {
  AttributedQuote,
  QuestionAnswer,
  EmergingTheme,
  MomentumItem,
  StructuredSummary,
  SummaryContent,
} from './summary-types';
export { isStructuredSummary } from './summary-types';

import type { StructuredSummary } from './summary-types';

const client = new Anthropic();

// ── Structured summary prompt + tool ──────────────────────────────────

const STRUCTURED_SYSTEM_PROMPT = `You are an expert meeting analyst. You produce structured, quote-driven summaries tailored to the recipient's needs.

Your job is to call the structured_summary tool with sections that are warranted by the meeting content. Every section is optional — only include a section if the transcript contains strong, relevant content for it.

## Section guidance

**Key Moments** (1–3): The most pivotal statements — turning points, commitments, surprises, or moments of clarity. Choose quotes that would make someone say "I wish I'd been there for that." Always attribute to a speaker.

**Questions & Answers** (1–3): Questions that were explicitly asked. Include the answer if one was given. Mark as unanswered if the question was deflected or left open. Unanswered questions are especially valuable.

**Emerging Themes** (1–3): Abstract undercurrents — not agenda topics but the philosophical, emotional, or interpersonal dynamics at play. Each theme gets 2–4 concise bullet points explaining how it surfaced.

**Key Insights** (1–3): Non-obvious realizations, data points, or conclusions that emerged. Quotes that reveal something the recipient might not have noticed.

**Momentum** (AI determines count): Concrete next steps, action items, decisions made, or commitments. Only include if the meeting produced clear forward motion.

**Observer's Perspective** (1–2 sentences): Your honest, conversational read on the meeting as a whole — the vibe, what it means, what's unspoken. Write as an insightful colleague, not a robot.

## Quote selection philosophy
- Prefer quotes that carry WEIGHT — emotion, commitment, disagreement, insight
- Never paraphrase when a verbatim quote is available
- Include timestamps when they appear in the transcript
- Attribute every quote to a speaker

## When to OMIT sections
- No clear questions asked → omit Q&A
- No action items or decisions → omit Momentum
- Meeting was purely informational → omit Key Moments if nothing pivotal happened
- Short or shallow meeting → fewer sections is better than padded sections

## Title & Date
- If title/date metadata is provided, use it directly
- Otherwise, generate a concise descriptive title (not "Meeting Summary")
- For date, attempt to extract from transcript content; omit if not determinable`;

const STRUCTURED_SUMMARY_TOOL: Anthropic.Tool = {
  name: 'structured_summary',
  description: 'Submit a structured meeting summary with only the sections warranted by the content.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Meeting title — use provided metadata or generate a descriptive one' },
      date: { type: 'string', description: 'Meeting date if determinable (ISO 8601 or human-readable)' },
      keyMoments: {
        type: 'object',
        properties: {
          moments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Verbatim quote' },
                speaker: { type: 'string', description: 'Speaker name' },
                timestamp: { type: 'string', description: 'Timestamp if available' },
              },
              required: ['text', 'speaker'],
            },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['moments'],
      },
      questionsAndAnswers: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                questionSpeaker: { type: 'string' },
                answer: { type: 'string' },
                answerSpeaker: { type: 'string' },
                unanswered: { type: 'boolean' },
              },
              required: ['question'],
            },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['items'],
      },
      emergingThemes: {
        type: 'object',
        properties: {
          themes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: '1–2 word abstract concept' },
                bullets: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 2,
                  maxItems: 4,
                },
              },
              required: ['label', 'bullets'],
            },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['themes'],
      },
      keyInsights: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Verbatim quote' },
                speaker: { type: 'string', description: 'Speaker name' },
                timestamp: { type: 'string', description: 'Timestamp if available' },
              },
              required: ['text', 'speaker'],
            },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['insights'],
      },
      momentum: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Action item, decision, or next step' },
              },
              required: ['text'],
            },
          },
        },
        required: ['items'],
      },
      observersPerspective: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '1–2 sentence honest read on the meeting' },
        },
        required: ['content'],
      },
    },
    // All sections optional — Claude decides what to include
    required: [],
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

export async function generateSummary(
  transcripts: string[],
  context: SummaryContext,
  mode: 'combined' | 'separate',
  metadata?: SummaryMetadata
): Promise<StructuredSummary[]> {
  if (mode === 'combined' || transcripts.length === 1) {
    const combinedTranscript = transcripts.join('\n\n---\n\n');
    const title = metadata?.titles?.length === 1
      ? metadata.titles[0]
      : metadata?.titles?.join(' & ');
    const date = metadata?.dates?.[0];
    const summary = await summarizeSingleStructured(combinedTranscript, context, title, date);
    return [summary];
  }

  const summaries = await Promise.all(
    transcripts.map((transcript, i) =>
      summarizeSingleStructured(
        transcript,
        context,
        metadata?.titles?.[i],
        metadata?.dates?.[i]
      )
    )
  );

  return summaries;
}

/** Strip sections with missing or malformed arrays so the UI never crashes on bad data. */
function sanitizeStructuredSummary(raw: Record<string, unknown>): StructuredSummary {
  const result: StructuredSummary = { formatVersion: 2 };

  if (typeof raw.title === 'string') result.title = raw.title;
  if (typeof raw.date === 'string') result.date = raw.date;

  const km = raw.keyMoments as { moments?: unknown } | undefined;
  if (km && Array.isArray(km.moments) && km.moments.length > 0) {
    result.keyMoments = { moments: km.moments };
  }

  const qa = raw.questionsAndAnswers as { items?: unknown } | undefined;
  if (qa && Array.isArray(qa.items) && qa.items.length > 0) {
    result.questionsAndAnswers = { items: qa.items };
  }

  const et = raw.emergingThemes as { themes?: unknown } | undefined;
  if (et && Array.isArray(et.themes) && et.themes.length > 0) {
    result.emergingThemes = { themes: et.themes };
  }

  const ki = raw.keyInsights as { insights?: unknown } | undefined;
  if (ki && Array.isArray(ki.insights) && ki.insights.length > 0) {
    result.keyInsights = { insights: ki.insights };
  }

  const mom = raw.momentum as { items?: unknown } | undefined;
  if (mom && Array.isArray(mom.items) && mom.items.length > 0) {
    result.momentum = { items: mom.items };
  }

  const op = raw.observersPerspective as { content?: unknown } | undefined;
  if (op && typeof op.content === 'string' && op.content.length > 0) {
    result.observersPerspective = { content: op.content };
  }

  return result;
}

async function summarizeSingleStructured(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
): Promise<StructuredSummary> {
  const userMessage = buildStructuredUserMessage(transcript, context, title, date);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6144,
    system: STRUCTURED_SYSTEM_PROMPT,
    tools: [STRUCTURED_SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'structured_summary' },
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract tool call input
  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock && toolBlock.type === 'tool_use') {
    return sanitizeStructuredSummary(toolBlock.input as Record<string, unknown>);
  }

  // Fallback: try to parse text response as JSON
  const textBlock = response.content.find((block) => block.type === 'text');
  if (textBlock && textBlock.type === 'text') {
    try {
      const parsed = JSON.parse(textBlock.text);
      return sanitizeStructuredSummary(parsed);
    } catch {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return sanitizeStructuredSummary(parsed);
        } catch {
          // Fall through
        }
      }
    }
  }

  // Last resort: couldn't get structured output, throw so caller gets an error
  throw new Error('Failed to get structured summary from Claude');
}

function buildStructuredUserMessage(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
): string {
  let message = `Analyze this meeting transcript and call the structured_summary tool with the appropriate sections.

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
