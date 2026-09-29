import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reset kata sandi anggota ke NIM-nya (tanpa SMTP). Otorisasi di database
// (authorize_password_reset: KM kelas tsb / superadmin); anggota wajib menggantinya saat login.
export async function POST(request: Request) {
  // JSON wajib: form lintas situs tidak bisa mengirim content-type ini tanpa preflight CORS
  const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 415 });
  }
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Anggota tidak valid.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: nim, error: authzError } = await supabase.rpc('authorize_password_reset', { p_user: userId });
  if (authzError || typeof nim !== 'string' || !nim) {
    return NextResponse.json({ error: authzError?.message ?? 'Tidak berwenang.' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password: nim });
    if (pwError) throw pwError;
    // Trigger auth menandai "sudah diganti" saat password berubah; kembalikan agar wajib ganti
    const { error: flagError } = await admin.from('profiles').update({ is_password_changed: false }).eq('id', userId);
    if (flagError) throw flagError;
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Gagal mereset kata sandi. Coba lagi.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
