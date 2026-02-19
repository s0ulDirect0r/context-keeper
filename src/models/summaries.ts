import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { SavedSummary, SummaryContent, SummaryContext } from './types';

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

// ── Row mapper ─────────────────────────────────────────────────────

export function toSavedSummary(row: SummaryRow): SavedSummary {
  return {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as SummaryContent,
    context: row.context as unknown as SummaryContext,
    transcripts: (row.transcripts as unknown as string[] | null) ?? null,
    shareToken: row.share_token ?? null,
    isShared: row.is_shared ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ── Title derivation ───────────────────────────────────────────────

export function deriveTitle(recordingTitles?: string[]): string {
  if (!recordingTitles || recordingTitles.length === 0) return 'Untitled Summary';
  if (recordingTitles.length === 1) return recordingTitles[0];
  if (recordingTitles.length === 2) return recordingTitles.join(' & ');
  return `${recordingTitles[0]} & ${recordingTitles[1]} + ${recordingTitles.length - 2} more`;
}

// ── Search text ────────────────────────────────────────────────────

export function buildSearchText(title: string, summaries: Record<string, string>): string {
  const parts = [title];
  for (const text of Object.values(summaries)) {
    parts.push(text);
  }
  // Cap at 50KB to avoid oversized rows
  return parts.join('\n').slice(0, 50_000);
}

// ── Data access ────────────────────────────────────────────────────

export async function saveSummary(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    title: string;
    summaries: string[];
    context: SummaryContext;
    transcripts?: string[];
  },
): Promise<string | null> {
  const summariesMap: Record<string, string> = {};
  params.summaries.forEach((s, i) => {
    summariesMap[String(i)] = s;
  });

  const { data, error } = await supabase
    .from('summaries')
    .insert({
      user_id: params.userId,
      title: params.title,
      summaries:
        params.summaries as unknown as Database['public']['Tables']['summaries']['Insert']['summaries'],
      context:
        params.context as unknown as Database['public']['Tables']['summaries']['Insert']['context'],
      transcripts: (params.transcripts ??
        null) as unknown as Database['public']['Tables']['summaries']['Insert']['transcripts'],
      search_text: buildSearchText(params.title, summariesMap),
    })
    .select('id')
    .single();

  if (error) return null;
  return data.id;
}

export async function getSummaries(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { q?: string; limit: number; offset: number },
): Promise<{ summaries: SummaryRow[]; total: number } | null> {
  let query = supabase.from('summaries').select('*', { count: 'exact' }).eq('user_id', userId);

  if (opts.q) {
    query = query.textSearch('search_text', opts.q, { type: 'websearch', config: 'english' });
  }

  query = query
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  let { data, count, error } = await query;

  // Fallback: if textSearch failed (column missing), retry with ILIKE on title
  if (error && opts.q) {
    const fallback = supabase
      .from('summaries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .ilike('title', `%${opts.q}%`)
      .order('created_at', { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    ({ data, count, error } = await fallback);
  }

  if (error) return null;
  return { summaries: (data ?? []) as SummaryRow[], total: count ?? 0 };
}

export async function getSummaryById(
  supabase: SupabaseClient<Database>,
  summaryId: string,
  userId: string,
): Promise<SavedSummary | null> {
  const { data: row, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', summaryId)
    .eq('user_id', userId)
    .single();

  if (error || !row) return null;
  return toSavedSummary(row as SummaryRow);
}

export async function getSharedSummary(
  supabase: SupabaseClient<Database>,
  shareToken: string,
): Promise<SavedSummary | null> {
  const { data: row, error } = await supabase
    .from('summaries')
    .select('id, title, summaries, context, created_at, updated_at, share_token, is_shared')
    .eq('share_token', shareToken)
    .eq('is_shared', true)
    .single();

  if (error || !row) return null;

  return {
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
}

export async function updateSummary(
  supabase: SupabaseClient<Database>,
  summaryId: string,
  userId: string,
  updates: {
    title?: string;
    summaries?: string[];
    context?: { extractionGoal: string; additionalContext?: string };
    is_shared?: boolean;
    transcripts?: string[];
  },
): Promise<{ data: SummaryRow | null; error: 'not_found' | 'forbidden' | 'update_failed' | null }> {
  // Verify ownership and get current data for search_text recomputation
  const { data: existing, error: fetchError } = await supabase
    .from('summaries')
    .select('id, user_id, share_token, title, summaries')
    .eq('id', summaryId)
    .single();

  if (fetchError || !existing) {
    return { data: null, error: 'not_found' };
  }

  if (existing.user_id !== userId) {
    return { data: null, error: 'forbidden' };
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.summaries !== undefined) updateData.summaries = updates.summaries;
  if (updates.context !== undefined) updateData.context = updates.context;
  if (updates.is_shared !== undefined) updateData.is_shared = updates.is_shared;
  if (updates.transcripts !== undefined) updateData.transcripts = updates.transcripts;

  // Recompute search_text when title or summaries change
  if (updates.title !== undefined || updates.summaries !== undefined) {
    const newTitle = updates.title ?? existing.title;
    const newSummaries = updates.summaries ?? (existing.summaries as string[]);
    const summariesMap: Record<string, string> = {};
    if (Array.isArray(newSummaries)) {
      newSummaries.forEach((s: string, i: number) => {
        summariesMap[String(i)] = String(s);
      });
    }
    updateData.search_text = buildSearchText(newTitle, summariesMap);
  }

  // Generate share token when enabling sharing for the first time
  if (updates.is_shared === true && !existing.share_token) {
    updateData.share_token = crypto.randomBytes(16).toString('base64url');
  }

  const { data, error: updateError } = await supabase
    .from('summaries')
    .update(updateData)
    .eq('id', summaryId)
    .select('*')
    .single();

  if (updateError) return { data: null, error: 'update_failed' };
  return { data: data as SummaryRow, error: null };
}

export async function deleteSummary(
  supabase: SupabaseClient<Database>,
  summaryId: string,
  userId: string,
): Promise<{ error: 'not_found' | 'forbidden' | 'delete_failed' | null }> {
  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('summaries')
    .select('id, user_id')
    .eq('id', summaryId)
    .single();

  if (fetchError || !existing) {
    return { error: 'not_found' };
  }

  if (existing.user_id !== userId) {
    return { error: 'forbidden' };
  }

  const { error: deleteError } = await supabase.from('summaries').delete().eq('id', summaryId);

  if (deleteError) return { error: 'delete_failed' };
  return { error: null };
}
