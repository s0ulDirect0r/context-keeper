import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSummaries, toSavedSummary } from '@/models/summaries';
import { DashboardClient } from './DashboardClient';

const PAGE_SIZE = 20;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const result = await getSummaries(supabase, user.id, { limit: PAGE_SIZE, offset: 0 });
  const summaries = (result?.summaries ?? []).map(toSavedSummary);

  return <DashboardClient initialSummaries={summaries} totalCount={result?.total ?? 0} />;
}
