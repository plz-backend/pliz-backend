import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Supabase is created on first storage use so the process can boot without
 * SUPABASE_* when uploads are unused or unconfigured locally.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env).'
    );
  }
  if (!client) {
    client = createClient(url, key);
  }
  return client;
}
