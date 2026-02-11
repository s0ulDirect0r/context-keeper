import { z } from 'zod';
import { NextResponse } from 'next/server';
import { type SummaryContext, type Pearl } from '@/lib/claude';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

const pearlSchema = z.object({
  insight: z.string().min(1),
  concepts: z.array(z.string()),
  quote: z.string().nullable().optional(),
});

const saveSummarySchema = z.object({
  summaries: z.array(z.string()).min(1, 'At least one summary required'),
  context: z.object({
    extractionGoal: z.string().min(1).max(1000),
    additionalContext: z.string().max(2000).optional(),
  }),
  recordingTitles: z.array(z.string()).optional(),
  transcripts: z.array(z.string()).optional(),
  pearls: z.array(pearlSchema).optional(),
});

function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = saveSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const { summaries, context, recordingTitles, transcripts, pearls } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const summaryContext: SummaryContext = {
      extractionGoal: context.extractionGoal,
      additionalContext: context.additionalContext,
    };

    const title = deriveTitle(recordingTitles);

    const insertData: Database['public']['Tables']['summaries']['Insert'] = {
      user_id: user.id,
      title,
      summaries: summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
      context: summaryContext as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
      transcripts: transcripts as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
    };

    const { data, error: saveError } = await supabase
      .from('summaries')
      .insert(insertData)
      .select('id')
      .single();

    if (saveError) {
      console.error('Failed to save summary:', saveError);
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }

    // Save pearls if provided (guest sign-up-to-save flow)
    if (pearls && pearls.length > 0) {
      const pearlRows = (pearls as Pearl[]).map((pearl) => ({
        user_id: user.id,
        summary_id: data.id,
        insight: pearl.insight,
        concepts: pearl.concepts,
        quote: (pearl.quote ?? null) as Database['public']['Tables']['pearls']['Insert']['quote'],
      }));

      const { error: pearlError } = await supabase
        .from('pearls')
        .insert(pearlRows);

      if (pearlError) {
        console.error('Failed to save pearls during summary save:', pearlError);
      }
    }

    return NextResponse.json({ savedSummaryId: data.id, title });
  } catch (error) {
    console.error('Save summary error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
