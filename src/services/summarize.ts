import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { SummaryContext, SummaryMetadata, GeneratedSummary } from '@/models/types';
import { deriveTitle, saveSummary } from '@/models/summaries';
import { anthropic } from '@/lib/ai-client';
import { SUMMARY_TOOL, getSystemPrompt, buildUserMessage } from './prompts/summary';
import { logger } from '@/lib/logger';

// ── Text transforms ────────────────────────────────────────────────

/** Strip quotation marks from blockquote pull-quotes so they render as clean pullquotes. */
export function stripBlockquoteQuotes(markdown: string): string {
  return markdown.replace(/^>\s*.+$/gm, (line) =>
    line.replace(/^(>\s*)[""\u201C\u201D]/, '$1').replace(/[""\u201C\u201D]\s*$/, ''),
  );
}

// ── Summary generation ─────────────────────────────────────────────

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

  return Promise.all(
    transcripts.map((transcript, i) =>
      summarizeSingle(transcript, context, metadata?.titles?.[i], metadata?.dates?.[i]),
    ),
  );
}

async function summarizeSingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
): Promise<GeneratedSummary> {
  const userMessage = buildUserMessage(transcript, context, title, date);
  const systemPrompt = getSystemPrompt(context.summaryStyle, false);

  const response = await anthropic.messages.create({
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

export function streamSummarySingle(
  transcript: string,
  context: SummaryContext,
  title?: string,
  date?: string,
) {
  const userMessage = buildUserMessage(transcript, context, title, date);
  const systemPrompt = getSystemPrompt(context.summaryStyle, true);

  return anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}

// ── Orchestration: stream, extract title, persist ──────────────────

export interface StreamAndPersistCallbacks {
  onSummaryChunk?: (text: string) => void;
  onSummaryDone: (summaries: string[]) => void;
  onComplete: (result: {
    savedSummaryId: string | null;
    summaries: string[];
    saveError: boolean;
  }) => void;
  onError: (error: { task: string; message: string }) => void;
}

export async function streamAndPersistSummary(
  params: {
    transcripts: string[];
    context: SummaryContext;
    mode: 'combined' | 'separate';
    recordingTitles?: string[];
    recordingDates?: string[];
    userId: string | null;
    supabase: SupabaseClient<Database> | null;
    requestId: string;
  },
  callbacks: StreamAndPersistCallbacks,
): Promise<void> {
  const {
    transcripts,
    context,
    mode,
    recordingTitles,
    recordingDates,
    userId,
    supabase,
    requestId,
  } = params;

  try {
    if (mode === 'separate' && transcripts.length > 1) {
      await handleSeparateMode(
        { transcripts, context, recordingTitles, recordingDates, userId, supabase, requestId },
        callbacks,
      );
    } else {
      await handleCombinedMode(
        { transcripts, context, recordingTitles, recordingDates, userId, supabase, requestId },
        callbacks,
      );
    }
  } catch (err) {
    logger.error('Summary generation error', { requestId, route: '/api/summarize' }, err);
    callbacks.onError({ task: 'summary', message: 'Failed to generate summary' });
  }
}

async function handleSeparateMode(
  params: {
    transcripts: string[];
    context: SummaryContext;
    recordingTitles?: string[];
    recordingDates?: string[];
    userId: string | null;
    supabase: SupabaseClient<Database> | null;
    requestId: string;
  },
  callbacks: StreamAndPersistCallbacks,
) {
  const generatedSummaries = await generateSummary(params.transcripts, params.context, 'separate', {
    titles: params.recordingTitles,
    dates: params.recordingDates,
  });

  const summaries = generatedSummaries.map((s) => stripBlockquoteQuotes(s.markdown));
  callbacks.onSummaryDone(summaries);

  // Resolve title: prefer recording titles, fall back to AI-generated
  let title = deriveTitle(params.recordingTitles);
  if (title === 'Untitled Summary' && generatedSummaries[0]?.title) {
    title = generatedSummaries[0].title;
  }

  const savedSummaryId = await persistSummary(params, title, summaries);

  callbacks.onComplete({
    savedSummaryId,
    summaries,
    saveError: !savedSummaryId && !!params.userId,
  });
}

async function handleCombinedMode(
  params: {
    transcripts: string[];
    context: SummaryContext;
    recordingTitles?: string[];
    recordingDates?: string[];
    userId: string | null;
    supabase: SupabaseClient<Database> | null;
    requestId: string;
  },
  callbacks: StreamAndPersistCallbacks,
) {
  const combinedTranscript = params.transcripts.join('\n\n---\n\n');
  const title =
    params.recordingTitles?.length === 1
      ? params.recordingTitles[0]
      : params.recordingTitles?.join(' & ');
  const date = params.recordingDates?.[0];

  const messageStream = streamSummarySingle(combinedTranscript, params.context, title, date);

  let accumulatedText = '';
  messageStream.on('text', (chunk) => {
    accumulatedText += chunk;
    callbacks.onSummaryChunk?.(chunk);
  });

  await messageStream.finalMessage();
  accumulatedText = stripBlockquoteQuotes(accumulatedText);
  callbacks.onSummaryDone([accumulatedText]);

  // Extract title from first heading in the accumulated markdown
  const titleMatch = accumulatedText.match(/^#\s+(.+)$/m);
  const extractedTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Summary';

  let displayTitle = deriveTitle(params.recordingTitles);
  if (displayTitle === 'Untitled Summary') {
    displayTitle = extractedTitle;
  }

  const savedSummaryId = await persistSummary(params, displayTitle, [accumulatedText]);

  callbacks.onComplete({
    savedSummaryId,
    summaries: [accumulatedText],
    saveError: !savedSummaryId && !!params.userId,
  });
}

async function persistSummary(
  params: {
    userId: string | null;
    supabase: SupabaseClient<Database> | null;
    context: SummaryContext;
    transcripts: string[];
    requestId: string;
  },
  title: string,
  summaries: string[],
): Promise<string | null> {
  if (!params.userId || !params.supabase) return null;

  const savedId = await saveSummary(params.supabase, {
    userId: params.userId,
    title,
    summaries,
    context: params.context,
    transcripts: params.transcripts,
  });

  if (!savedId) {
    logger.error('Summary save failed', {
      requestId: params.requestId,
      userId: params.userId,
      route: '/api/summarize',
    });
  }

  return savedId;
}
