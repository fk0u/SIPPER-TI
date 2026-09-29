import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ATTACHMENT_BUCKET } from '@/lib/supabase/config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Batalkan izin pending. Penghapusan baris memakai sesi pengguna (RLS: mahasiswanya / pengajunya);
// lampiran yang tak lagi dirujuk dibersihkan dengan service key — termasuk lampiran izin proxy
// yang tersimpan di folder pengaju, yang tidak bisa dihapus sendiri oleh mahasiswanya.
export async function POST(request: Request) {
  const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 415 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Pengajuan tidak valid.' }, { status: 400 });

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('file_urls');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Pengajuan sudah diverifikasi atau bukan milik Anda.' }, { status: 409 });
  }

  // file_urls JSONB bisa berbentuk apa saja: ambil hanya entri { path: string }
  const files: unknown = rows[0].file_urls;
  const paths = (Array.isArray(files) ? files : [])
    .map((f) => (f && typeof f === 'object' ? (f as { path?: unknown }).path : null))
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  if (paths.length > 0) {
    try {
      const admin = createAdminClient();
      const orphan: string[] = [];
      for (const path of paths) {
        // Lampiran batch dipakai bersama baris matkul lain: hapus hanya bila tak dirujuk lagi
        const { count, error: refError } = await admin
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .contains('file_urls', [{ path }]);
        if (refError) throw refError; // jangan hapus bila rujukan tak bisa dipastikan
        if (count === 0) orphan.push(path);
      }
      if (orphan.length > 0) {
        const { error: removeError } = await admin.storage.from(ATTACHMENT_BUCKET).remove(orphan);
        if (removeError) throw removeError;
      }
    } catch (err) {
      // Pembatalan tetap sah; berkas yatim hanya memakan ruang
      console.error('[cancel-leave] pembersihan lampiran gagal', err);
    }
  }
  return NextResponse.json({ ok: true });
}
