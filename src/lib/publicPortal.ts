import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import type { ClassBoardResult, LecturerPortalResult } from '@/types/database';

/** RPC SECURITY DEFINER untuk halaman tanpa login (akses anonim, tanpa cookie sesi). */
async function publicRpc<T extends { status: string }>(fn: string, token: string): Promise<T | { status: 'unavailable' }> {
  if (!isSupabaseConfigured()) return { status: 'unavailable' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc(fn, { p_token: token });
  if (error || !data) {
    // Gangguan layanan ≠ token tidak valid
    console.error(`[${fn}] RPC gagal:`, error?.message ?? 'tanpa data');
    return { status: 'unavailable' };
  }
  return data as T;
}

export const fetchLecturerPortal = (token: string) =>
  publicRpc<LecturerPortalResult>('get_lecturer_portal', token) as Promise<LecturerPortalResult>;

export const fetchClassBoard = (token: string) =>
  publicRpc<ClassBoardResult>('get_class_board', token) as Promise<ClassBoardResult>;
