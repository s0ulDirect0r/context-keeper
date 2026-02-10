import { generateSummary, extractThemes, extractSpeakers, streamSummarySingle, type SummaryContext } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function POST(request: Request) {
  // Parse and validate before streaming — must access cookies() before writing response
  const body = await request.json();
  const { transcripts, context, mode, save, recordingTitles, recordingDates, otterSpeakerNames } = body;

  if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
    return Response.json({ error: 'At least one transcript required' }, { status: 400 });
  }

  if (!context?.extractionGoal) {
    return Response.json({ error: 'Context (extractionGoal) required' }, { status: 400 });
  }

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
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (summaryMode === 'separate' && transcripts.length > 1) {
          // Non-streaming fallback for separate mode
          const [generatedSummaries, themes, speakers] = await Promise.allSettled([
            generateSummary(transcripts, summaryContext, 'separate', {
              titles: recordingTitles,
              dates: recordingDates,
            }),
            extractThemes(combinedTranscript, summaryContext),
            extractSpeakers(combinedTranscript, otterSpeakerNames),
          ]).then(results => {
            const summaries = results[0].status === 'fulfilled' ? results[0].value : null;
            const themes = results[1].status === 'fulfilled' ? results[1].value : [];
            const speakers = results[2].status === 'fulfilled' ? results[2].value : [];

            if (results[1].status === 'rejected') {
              send('error', { task: 'themes', message: results[1].reason?.message || 'Theme extraction failed' });
            }
            if (results[2].status === 'rejected') {
              send('error', { task: 'speakers', message: results[2].reason?.message || 'Speaker extraction failed' });
            }

            return [summaries, themes, speakers] as const;
          });

          if (!generatedSummaries) {
            send('error', { task: 'summary', message: 'Summary generation failed' });
            controller.close();
            return;
          }

          const summaries = generatedSummaries.map(s => s.markdown);
          send('summary_done', { summaries });
          send('themes_done', { themes });
          send('speakers_done', { speakers });

          // Save to DB
          let savedSummaryId: string | null = null;
          if (userId && supabase) {
            let title = deriveTitle(recordingTitles);
            if (title === 'Untitled Summary' && generatedSummaries[0]?.title) {
              title = generatedSummaries[0].title;
            }

            const { data, error: saveError } = await supabase
              .from('summaries')
              .insert({
                user_id: userId,
                title,
                summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
                themes: themes as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
                context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
                speakers: speakers as unknown as Database['public']['Tables']['summaries']['Insert']['speakers'],
                transcripts: transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
              })
              .select('id')
              .single();

            if (saveError) {
              console.error('Failed to save summary:', saveError);
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', { savedSummaryId, summaries });
        } else {
          // Streaming mode: single/combined summary
          const title = recordingTitles?.length === 1
            ? recordingTitles[0]
            : recordingTitles?.join(' & ');
          const date = recordingDates?.[0];

          const messageStream = streamSummarySingle(combinedTranscript, summaryContext, title, date);

          let accumulatedText = '';
          messageStream.on('text', (chunk) => {
            accumulatedText += chunk;
            send('summary_chunk', { text: chunk });
          });

          // Run summary stream + extractions in parallel
          const [, themes, speakers] = await Promise.allSettled([
            messageStream.finalMessage().then(() => {
              send('summary_done', {});
            }),
            extractThemes(combinedTranscript, summaryContext)
              .then(t => { send('themes_done', { themes: t }); return t; }),
            extractSpeakers(combinedTranscript, otterSpeakerNames)
              .then(s => { send('speakers_done', { speakers: s }); return s; }),
          ]).then(results => {
            if (results[1].status === 'rejected') {
              send('error', { task: 'themes', message: results[1].reason?.message || 'Theme extraction failed' });
            }
            if (results[2].status === 'rejected') {
              send('error', { task: 'speakers', message: results[2].reason?.message || 'Speaker extraction failed' });
            }

            return [
              null,
              results[1].status === 'fulfilled' ? results[1].value : [],
              results[2].status === 'fulfilled' ? results[2].value : [],
            ] as const;
          });

          // Extract title from first heading in the accumulated markdown
          const titleMatch = accumulatedText.match(/^#\s+(.+)$/m);
          const extractedTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Summary';

          // Determine display title
          let displayTitle = deriveTitle(recordingTitles);
          if (displayTitle === 'Untitled Summary') {
            displayTitle = extractedTitle;
          }

          // Save to DB
          let savedSummaryId: string | null = null;
          if (userId && supabase) {
            const { data, error: saveError } = await supabase
              .from('summaries')
              .insert({
                user_id: userId,
                title: displayTitle,
                summaries: [accumulatedText] as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
                themes: themes as unknown as Database['public']['Tables']['summaries']['Insert']['themes'],
                context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
                speakers: speakers as unknown as Database['public']['Tables']['summaries']['Insert']['speakers'],
                transcripts: transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
              })
              .select('id')
              .single();

            if (saveError) {
              console.error('Failed to save summary:', saveError);
            } else {
              savedSummaryId = data.id;
            }
          }

          send('complete', { savedSummaryId, summaries: [accumulatedText] });
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
      'Connection': 'keep-alive',
    },
  });
}
