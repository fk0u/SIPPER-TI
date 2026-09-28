import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import type { LecturerPortalResult } from '@/types/database';

/** Data portal dosen via RPC SECURITY DEFINER (akses anonim, tanpa cookie sesi). */
export async function fetchLecturerPortal(token: string): Promise<LecturerPortalResult> {
  if (!isSupabaseConfigured()) return { status: 'unavailable' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('get_lecturer_portal', { p_token: token });
  if (error || !data) {
    // Gangguan layanan ≠ token tidak valid
    console.error('[lecturer-portal] RPC gagal:', error?.message ?? 'tanpa data');
    return { status: 'unavailable' };
  }
  return data as LecturerPortalResult;
}
