import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * Client service role — HANYA untuk route handler server (melewati RLS).
 * Kunci dibaca dari env server `SUPABASE_SECRET_KEY` (tanpa prefix NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) throw new Error('SUPABASE_SECRET_KEY belum dikonfigurasi di server.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
