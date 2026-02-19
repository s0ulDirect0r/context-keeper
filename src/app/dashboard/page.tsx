import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toSavedSummary, type Database } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';
import { DashboardClient } from './DashboardClient';
import type { VaultItemWithSummary } from '@/components/VaultDashboard';

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

const PAGE_SIZE = 20;
const VAULT_PAGE_SIZE = 50;

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

  // Fetch vault items if vault tab is active
  let vaultItems: VaultItemWithSummary[] = [];
  let vaultTotal = 0;

  if (tab === 'vault') {
    const {
      data: vaultRows,
      count: vaultCount,
      error: vaultError,
    } = await supabase
      .from('vault_items')
      .select('*, summaries(title)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, VAULT_PAGE_SIZE - 1);

    if (vaultError) {
      logger.error('Failed to fetch vault items', { route: '/dashboard' }, vaultError);
    }

    vaultItems = (vaultRows ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      summaryId: row.summary_id as string,
      summaryTitle: (row.summaries as { title: string } | null)?.title ?? 'Untitled',
      excerptText: (row.excerpt_text as string | null) ?? null,
      note: row.note as string | null,
      tags: (row.tags as string[]) ?? [],
      createdAt: row.created_at as string,
    }));
    vaultTotal = vaultCount ?? 0;
  }

  return (
    <DashboardClient
      initialSummaries={summaries}
      totalCount={count ?? 0}
      initialTab={tab === 'vault' ? 'vault' : 'summaries'}
      initialVaultItems={vaultItems}
      vaultTotalCount={vaultTotal}
    />
  );
}
