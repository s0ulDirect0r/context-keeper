import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SummaryViewSaved } from '@/app/summary/[id]/SummaryViewSaved';
import type { SavedSummary } from '@/lib/supabase/types';
import type { SummaryContext, Theme, Speaker } from '@/lib/claude';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedSummaryPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // Explicitly omit transcripts — shared links must not expose raw transcript
  const { data: row, error } = await supabase
    .from('summaries')
    .select('id, title, summaries, themes, speakers, context, created_at, updated_at, share_token, is_shared')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single();

  if (error || !row) {
    notFound();
  }

  // Manually map since we're not using toSavedSummary (we omitted some columns)
  const summary: SavedSummary = {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as string[],
    themes: (row.themes as unknown as Theme[]) || [],
    context: row.context as unknown as SummaryContext,
    transcripts: null, // Intentionally hidden for shared views
    speakers: (row.speakers as unknown as Speaker[]) || [],
    shareToken: row.share_token,
    isShared: row.is_shared,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <SummaryViewSaved summary={summary} readOnly />
      </div>
    </div>
  );
}
