import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a meeting summary assistant. Generate concise, scannable summaries tailored to what the recipient cares about.

Rules:
- Output ONLY the summary content (no greetings, sign-offs, or meta-commentary)
- Use bullet points and headers for scannability
- Focus on what's relevant to the recipient based on context provided
- Be concise but don't omit important details
- Use markdown formatting for structure`;

export interface SummaryContext {
  who: 'myself' | 'someone-else' | 'group';
  whatMatters: string;
  why: string;
  additionalContext?: string;
}

export async function generateSummary(
  transcripts: string[],
  context: SummaryContext,
  mode: 'combined' | 'separate'
): Promise<string[]> {
  const recipientDescription =
    context.who === 'myself'
      ? 'yourself'
      : context.who === 'someone-else'
        ? 'another person'
        : 'a group of people';

  if (mode === 'combined' || transcripts.length === 1) {
    const combinedTranscript = transcripts.join('\n\n---\n\n');
    const summary = await summarizeSingle(combinedTranscript, context, recipientDescription);
    return [summary];
  }

  // Separate summaries
  const summaries = await Promise.all(
    transcripts.map((transcript) => summarizeSingle(transcript, context, recipientDescription))
  );

  return summaries;
}

async function summarizeSingle(
  transcript: string,
  context: SummaryContext,
  recipientDescription: string
): Promise<string> {
  const userMessage = buildUserMessage(transcript, context, recipientDescription);

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
  context: SummaryContext,
  recipientDescription: string
): string {
  let message = `Create a summary of this meeting transcript for ${recipientDescription}.

**What matters to them:** ${context.whatMatters}

**Purpose of this summary:** ${context.why}`;

  if (context.additionalContext) {
    message += `\n\n**Additional context:** ${context.additionalContext}`;
  }

  message += `\n\n---\n\n**Transcript:**\n${transcript}`;

  return message;
}
