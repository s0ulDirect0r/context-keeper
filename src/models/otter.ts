import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { OtterConnection } from './types';

type OtterConnectionRow = Database['public']['Tables']['otter_connections']['Row'];

export async function getOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OtterConnection | null> {
  const { data, error } = await supabase
    .from('otter_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // PGRST116 = no rows found — not an error
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const row = data as OtterConnectionRow;
  return {
    email: row.otter_email,
    userId: row.otter_user_id,
    cookies: row.cookies,
    csrfToken: row.csrf_token ?? undefined,
  };
}

export async function saveOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  connection: {
    otter_email: string;
    otter_user_id: string;
    cookies: string;
    csrf_token?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('otter_connections').upsert({
    user_id: userId,
    otter_email: connection.otter_email,
    otter_user_id: connection.otter_user_id,
    cookies: connection.cookies,
    csrf_token: connection.csrf_token ?? null,
  });

  if (error) throw error;
}

export async function deleteOtterConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('otter_connections').delete().eq('user_id', userId);

  if (error) throw error;
}
