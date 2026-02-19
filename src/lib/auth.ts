import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/server';

interface AuthResult {
  supabase: SupabaseClient<Database>;
  user: User;
}

/**
 * Authenticate the current request via Supabase session cookie.
 * Returns { supabase, user } on success, or null if unauthenticated.
 */
export async function requireAuth(): Promise<AuthResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
