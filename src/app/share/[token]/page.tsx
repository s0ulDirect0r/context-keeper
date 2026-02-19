import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSharedSummary } from '@/models/summaries';
import { SummaryView } from '@/components/summary/SummaryView';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedSummaryPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const summary = await getSharedSummary(supabase, token);

  if (!summary) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <SummaryView summary={summary} readOnly />
      </div>
    </div>
  );
}
