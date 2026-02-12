import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toSavedSummary, type Database } from '@/lib/supabase/types';
import { DashboardClient } from './DashboardClient';

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

const PAGE_SIZE = 20;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const {
    data: rows,
    count,
    error,
  } = await supabase
    .from('summaries')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    console.error('Failed to fetch summaries:', error);
  }

  const summaries = ((rows ?? []) as SummaryRow[]).map(toSavedSummary);

  return <DashboardClient initialSummaries={summaries} totalCount={count ?? 0} />;
}
