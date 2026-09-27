import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

export { isSupabaseConfigured } from './config';

let browserClient: SupabaseClient | null = null;

/** Client Supabase untuk komponen klien. Hanya dipanggil pada mode live. */
export function createClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
