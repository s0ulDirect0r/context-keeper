import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a meeting summary assistant. Generate concise, scannable summaries tailored to what the recipient cares about.

Rules:
- Output ONLY the summary content (no greetings, sign-offs, or meta-commentary)
- Use bullet points and headers for scannability
- Focus on what's relevant to the recipient based on context provided
- Be concise but don't omit important details
- Use markdown formatting for structure`;

export interface ThemeQuote {
  text: string;
  speaker?: string;
}

export interface Theme {
  id: string;
  label: string;
  quotes: ThemeQuote[];
}

export interface SummaryContext {
  extractionGoal: string;
  additionalContext?: string;
}

export async function generateSummary(
  transcripts: string[],
  context: SummaryContext,
  mode: 'combined' | 'separate'
): Promise<string[]> {
  if (mode === 'combined' || transcripts.length === 1) {
    const combinedTranscript = transcripts.join('\n\n---\n\n');
    const summary = await summarizeSingle(combinedTranscript, context);
    return [summary];
  }

  // Separate summaries
  const summaries = await Promise.all(
    transcripts.map((transcript) => summarizeSingle(transcript, context))
  );

  return summaries;
}

async function summarizeSingle(
  transcript: string,
  context: SummaryContext
): Promise<string> {
  const userMessage = buildUserMessage(transcript, context);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textBlock.text;
}

function buildUserMessage(
  transcript: string,
  context: SummaryContext
): string {
  let message = `Create a summary of this meeting transcript.

**What to extract:** ${context.extractionGoal}`;

  if (context.additionalContext) {
    message += `\n\n**Additional context:** ${context.additionalContext}`;
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

Return your response as valid JSON with this exact structure:
{
  "themes": [
    {
      "id": "unique-id",
      "label": "ThemeName",
      "quotes": [
        { "text": "Exact verbatim quote from transcript", "speaker": "Speaker Name" }
      ]
    }
  ]
}

Rules:
- Extract 5-7 themes
- Labels should be 1-2 words, abstract concepts
- Quotes must be VERBATIM from the transcript
- Each theme needs 2-5 supporting quotes
- Focus on themes relevant to what the recipient cares about`;

const TITLE_GENERATION_PROMPT = `Generate a punchy, memorable 2-5 word title for a meeting summary.

The title should:
- Be catchy and evocative (like a news headline or book chapter title)
- Capture the essence or key conflict/topic of the meeting
- NOT be generic (avoid "Team Meeting", "Weekly Sync", "Project Update")

Good examples: "The Budget Showdown", "Alignment Crisis", "Launch Day Panic", "The Pivot Decision", "Hiring Debate"
Bad examples: "Meeting Notes", "Summary of Discussion", "Team Call", "Q2 Planning"

Respond with ONLY the title, no quotes or explanation.`;

export async function generateTitle(summaryText: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 50,
    system: TITLE_GENERATION_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a title for this meeting summary:\n\n${summaryText.slice(0, 2000)}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return 'Meeting Summary';
  }

  return textBlock.text.trim().replace(/^["']|["']$/g, '');
}

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
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    return parsed.themes || [];
  } catch {
    // Attempt to extract JSON from the response if it has extra text
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.themes || [];
    }
    throw new Error('Failed to parse themes response as JSON');
  }
}
