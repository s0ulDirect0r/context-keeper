import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toSavedSummary, type Database } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';
import { DashboardClient } from './DashboardClient';
import type { NoteWithSummary } from '@/components/NotesDashboard';

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

const PAGE_SIZE = 20;
const NOTES_PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Always fetch summaries (needed for default tab)
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
    logger.error('Failed to fetch summaries', { route: '/dashboard' }, error);
  }

  const summaries = ((rows ?? []) as SummaryRow[]).map(toSavedSummary);

  // Fetch notes if notes tab is active
  let noteItems: NoteWithSummary[] = [];
  let notesTotal = 0;

  if (tab === 'notes') {
    const {
      data: noteRows,
      count: notesCount,
      error: notesError,
    } = await supabase
      .from('notes')
      .select('*, summaries(title)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, NOTES_PAGE_SIZE - 1);

    if (notesError) {
      logger.error('Failed to fetch notes', { route: '/dashboard' }, notesError);
    }

    noteItems = (noteRows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      summaryId: row.summary_id as string,
      summaryTitle: (row.summaries as { title: string } | null)?.title ?? 'Untitled',
      excerptText: (row.excerpt_text as string | null) ?? null,
      note: row.note as string | null,
      tags: (row.tags as string[]) ?? [],
      createdAt: row.created_at as string,
    }));
    notesTotal = notesCount ?? 0;
  }

  return (
    <DashboardClient
      initialSummaries={summaries}
      totalCount={count ?? 0}
      initialTab={tab === 'notes' ? 'notes' : 'summaries'}
      initialNotes={noteItems}
      notesTotalCount={notesTotal}
    />
  );
}
