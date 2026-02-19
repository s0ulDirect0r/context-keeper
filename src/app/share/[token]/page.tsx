import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SummaryView } from '@/components/summary/SummaryView';
import type { SavedSummary } from '@/lib/supabase/types';
import type { SummaryContext } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedSummaryPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // Explicitly omit transcripts — shared links must not expose raw transcript
  const { data: row, error } = await supabase
    .from('summaries')
    .select('id, title, summaries, context, created_at, updated_at, share_token, is_shared')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single();

  if (error || !row) {
    notFound();
  }

  const summary: SavedSummary = {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as SummaryContent,
    context: row.context as unknown as SummaryContext,
    transcripts: null, // Intentionally hidden for shared views
    shareToken: row.share_token,
    isShared: row.is_shared,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <SummaryView summary={summary} readOnly />
      </div>
    </div>
  );
}
