import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { OtterConnection } from './types';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];

export async function getOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ data: OtterConnection | null; error: 'fetch_failed' | null }> {
  const { data, error } = await supabase
    .from('otter_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = no rows found — not an error
    if (error.code === 'PGRST116') return { data: null, error: null };
    return { data: null, error: 'fetch_failed' };
  }

  const row = data as OtterConnectionRow;
  return {
    data: {
      email: row.otter_email,
      userId: row.otter_user_id,
      cookies: row.cookies,
      csrfToken: row.csrf_token ?? undefined,
    },
    error: null,
  };
}

export async function saveOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  connection: {
    email: string;
    otterUserId: string;
    cookies: string;
    csrfToken?: string | null;
  },
): Promise<{ error: 'save_failed' | null }> {
  const { error } = await supabase.from('otter_connections').upsert(
    {
      user_id: userId,
      otter_email: connection.email,
      otter_user_id: connection.otterUserId,
      cookies: connection.cookies,
      csrf_token: connection.csrfToken ?? null,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { error: 'save_failed' };
  return { error: null };
}

export async function deleteOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ error: 'delete_failed' | null }> {
  const { error } = await supabase.from('otter_connections').delete().eq('user_id', userId);

  if (error) return { error: 'delete_failed' };
  return { error: null };
}
