import { z } from 'zod';
import {
  generateSummary,
  extractTags,
  streamSummarySingle,
  type SummaryContext,
} from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter } from '@/lib/rate-limit';
import { buildSearchText } from '@/lib/search-text';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/supabase/types';

const MAX_TRANSCRIPT_BYTES = 500_000; // 500KB per transcript

const summarizeSchema = z.object({
  transcripts: z
    .array(z.string().max(MAX_TRANSCRIPT_BYTES, 'Transcript exceeds 500KB limit'))
    .min(1, 'At least one transcript required')
    .max(10, 'Maximum 10 transcripts'),
  context: z
    .object({
      extractionGoal: z.string().min(1).max(1000, 'Extraction goal exceeds 1000 chars'),
      additionalContext: z.string().max(2000, 'Additional context exceeds 2000 chars').optional(),
      summaryStyle: z.enum(['standard', 'structured', 'custom']).optional(),
      customFormatDescription: z
        .string()
        .max(2000, 'Custom format description exceeds 2000 chars')
        .optional(),
    })
    .refine(
      (ctx) =>
        ctx.summaryStyle !== 'custom' || (ctx.customFormatDescription ?? '').trim().length > 0,
      {
        message: 'Custom format description is required when using custom style',
        path: ['customFormatDescription'],
      },
    ),
  mode: z.enum(['combined', 'separate']).optional(),
  save: z.boolean().optional(),
  recordingTitles: z.array(z.string()).optional(),
  recordingDates: z.array(z.string()).optional(),
  timezone: z.string().max(100).optional(),
});

// 10 requests per hour per IP
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

/** Strip quotation marks from blockquote pull-quotes so they render as clean Substack-style pullquotes. */
function stripBlockquoteQuotes(markdown: string): string {
  return markdown.replace(/^>\s*.+$/gm, (line) =>
    line.replace(/^(>\s*)["\u201C\u201D]/, '$1').replace(/["\u201C\u201D]\s*$/, ''),
  );
}

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? 'unknown';

  // Rate limit check
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { transcripts, context, mode, save, recordingTitles, recordingDates, timezone } =
    parsed.data;

  const summaryContext: SummaryContext = {
    extractionGoal: context.extractionGoal,
    additionalContext: context.additionalContext,
    summaryStyle: context.summaryStyle,
    customFormatDescription: context.customFormatDescription,
    timezone,
  };

  const summaryMode = mode === 'separate' ? 'separate' : 'combined';
  const combinedTranscript = transcripts.join('\n\n---\n\n');

  // Get user before streaming starts (calls cookies() internally)
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  if (save) {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  logger.info('Generation started', {
    requestId,
    userId: userId ?? undefined,
    transcriptCount: transcripts.length,
    transcriptLength: combinedTranscript.length,
    mode: summaryMode,
  });

  const generationStart = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Start tag extraction in parallel — it only needs the transcript + context.
        // Use .then() to send tags_done as soon as tags resolve, even if summary
        // is still streaming (JS is single-threaded so enqueue calls are safe).
        send('tags_extracting', {});
        let resolvedTags: Awaited<ReturnType<typeof extractTags>> = [];
        const tagPromise = extractTags(combinedTranscript, summaryContext).then((tags) => {
          resolvedTags = tags;
          send('tags_done', { tags });
          return tags;
        });

        if (summaryMode === 'separate' && transcripts.length > 1) {
          // Non-streaming fallback for separate mode
          const generatedSummaries = await generateSummary(
            transcripts,
            summaryContext,
            'separate',
            {
              titles: recordingTitles,
              dates: recordingDates,
            },
          );

          const summaries = generatedSummaries.map((s) => stripBlockquoteQuotes(s.markdown));
          send('summary_done', { summaries });

          // Ensure tags are done before proceeding
          await tagPromise;

          // Save summary to DB (pearls saved later after tag selection)
          let savedSummaryId: string | null = null;
          if (userId && supabase) {
            let title = deriveTitle(recordingTitles);
            if (title === 'Untitled Summary' && generatedSummaries[0]?.title) {
              title = generatedSummaries[0].title;
            }

            const summariesMap: Record<string, string> = {};
            summaries.forEach((s, i) => {
              summariesMap[String(i)] = s;
            });

            const { data, error: saveError } = await supabase
              .from('summaries')
              .insert({
                user_id: userId,
                title,
                summaries:
                  summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
                context:
                  summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
                transcripts:
                  transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
                search_text: buildSearchText(title, summariesMap),
              })
              .select('id')
              .single();

            if (saveError) {
              logger.error(
                'Summary save failed',
                { requestId, userId, route: '/api/summarize', mode: 'separate' },
                saveError,
              );
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', {
            savedSummaryId,
            summaries,
            tags: resolvedTags,
            saveError: !savedSummaryId && !!userId,
          });
        } else {
          // Streaming mode: single/combined summary
          const title =
            recordingTitles?.length === 1 ? recordingTitles[0] : recordingTitles?.join(' & ');
          const date = recordingDates?.[0];

          const messageStream = streamSummarySingle(
            combinedTranscript,
            summaryContext,
            title,
            date,
          );

          let accumulatedText = '';
          messageStream.on('text', (chunk) => {
            accumulatedText += chunk;
            send('summary_chunk', { text: chunk });
          });

          await messageStream.finalMessage();
          accumulatedText = stripBlockquoteQuotes(accumulatedText);
          send('summary_done', { summaries: [accumulatedText] });

          // Ensure tags are done before proceeding
          await tagPromise;

          // Extract title from first heading in the accumulated markdown
          const titleMatch = accumulatedText.match(/^#\s+(.+)$/m);
          const extractedTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Summary';

          // Determine display title
          let displayTitle = deriveTitle(recordingTitles);
          if (displayTitle === 'Untitled Summary') {
            displayTitle = extractedTitle;
          }

          // Save summary to DB (pearls saved later after tag selection)
          let savedSummaryId: string | null = null;
          if (userId && supabase) {
            const { data, error: saveError } = await supabase
              .from('summaries')
              .insert({
                user_id: userId,
                title: displayTitle,
                summaries: [
                  accumulatedText,
                ] as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
                context:
                  summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
                transcripts:
                  transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
                search_text: buildSearchText(displayTitle, { '0': accumulatedText }),
              })
              .select('id')
              .single();

            if (saveError) {
              logger.error(
                'Summary save failed',
                { requestId, userId, route: '/api/summarize', mode: 'combined' },
                saveError,
              );
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', {
            savedSummaryId,
            summaries: [accumulatedText],
            tags: resolvedTags,
            saveError: !savedSummaryId && !!userId,
          });
        }

        logger.info('Generation complete', {
          requestId,
          userId: userId ?? undefined,
          duration: Date.now() - generationStart,
        });
      } catch (err) {
        logger.error('SSE stream error', { requestId, route: '/api/summarize' }, err);
        send('error', { task: 'summary', message: 'Failed to generate summary' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
