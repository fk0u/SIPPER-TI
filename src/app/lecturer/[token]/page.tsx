import { connection } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { GuestLecturerView } from '@/components/lecturer/GuestLecturerView';
import { DemoLecturerRecap } from '@/components/lecturer/DemoLecturerRecap';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import type { LecturerRecapResult } from '@/types/database';

export const metadata = {
  title: 'Portal Akses Dosen - SIPPER-TI',
  description: 'Rekap Presensi & Perizinan Mahasiswa TI Internasional UMKT',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

async function fetchRecap(token: string): Promise<LecturerRecapResult> {
  // Akses anonim: tidak memakai cookie sesi; hak akses ditentukan RPC SECURITY DEFINER.
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('get_lecturer_recap', { p_token: token });
  if (error || !data) {
    // Gangguan layanan / migrasi belum diterapkan ≠ token tidak valid
    console.error('[lecturer-recap] RPC gagal:', error?.message ?? 'tanpa data');
    return { status: 'unavailable' };
  }
  return data as LecturerRecapResult;
}

export default async function LecturerGuestPage({ params }: PageProps) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="py-4 sm:py-6">
        <DemoLecturerRecap tokenString={token} />
      </div>
    );
  }

  await connection();
  const recap = await fetchRecap(token);

  return (
    <div className="py-4 sm:py-6">
      <GuestLecturerView recap={recap} />
    </div>
  );
}
