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
import type { Database } from '@/lib/supabase/types';

const MAX_TRANSCRIPT_BYTES = 500_000; // 500KB per transcript

const summarizeSchema = z.object({
  transcripts: z
    .array(z.string().max(MAX_TRANSCRIPT_BYTES, 'Transcript exceeds 500KB limit'))
    .min(1, 'At least one transcript required')
    .max(10, 'Maximum 10 transcripts'),
  context: z.object({
    extractionGoal: z.string().min(1).max(1000, 'Extraction goal exceeds 1000 chars'),
    additionalContext: z.string().max(2000, 'Additional context exceeds 2000 chars').optional(),
  }),
  mode: z.enum(['combined', 'separate']).optional(),
  save: z.boolean().optional(),
  recordingTitles: z.array(z.string()).optional(),
  recordingDates: z.array(z.string()).optional(),
});

// 10 requests per hour per IP
const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function POST(request: Request) {
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

  const { transcripts, context, mode, save, recordingTitles, recordingDates } = parsed.data;

  const summaryContext: SummaryContext = {
    extractionGoal: context.extractionGoal,
    additionalContext: context.additionalContext,
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

          const summaries = generatedSummaries.map((s) => s.markdown);
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
              console.error('Failed to save summary:', saveError);
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', { savedSummaryId, summaries, tags: resolvedTags });
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
              console.error('Failed to save summary:', saveError);
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', { savedSummaryId, summaries: [accumulatedText], tags: resolvedTags });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate summary';
        send('error', { task: 'summary', message });
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
