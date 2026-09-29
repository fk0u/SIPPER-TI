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
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  const { data: nim, error: authzError } = await supabase.rpc('authorize_password_reset', { p_user: userId });
  if (authzError || typeof nim !== 'string' || !nim) {
    return NextResponse.json({ error: authzError?.message ?? 'Tidak berwenang.' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    // Audit & pencabutan sesi DULU: bila langkah berikutnya gagal, tidak ada reset yang tak tercatat
    // dan tidak ada sesi lama yang tertinggal. Semua langkah idempoten, aman diulang.
    const { data: targetInfo } = await admin.from('profiles').select('class_id, full_name').eq('id', userId).single();
    const { data: actor } = await admin.from('profiles').select('nim').eq('id', caller?.id ?? '').maybeSingle();
    const { error: auditError } = await admin.from('audit_log').insert({
      actor: caller?.id ?? null,
      action: 'password.reset',
      target_user: userId,
      class_id: targetInfo?.class_id ?? null,
      details: { target_nim: nim, target_name: targetInfo?.full_name ?? null, actor_nim: actor?.nim ?? null },
    });
    if (auditError) throw auditError;
    const revoke = async () => {
      const { error: revokeError } = await admin.rpc('revoke_user_sessions', { p_user: userId });
      if (revokeError) throw revokeError;
    };
    await revoke();
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password: nim });
    if (pwError) throw pwError;
    // Trigger auth menandai "sudah diganti" saat password berubah; kembalikan agar wajib ganti
    const { error: flagError } = await admin.from('profiles').update({ is_password_changed: false }).eq('id', userId);
    if (flagError) throw flagError;
    // Sesi yang sempat dibuat di antara dua langkah ikut diakhiri
    await revoke();
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Gagal mereset kata sandi. Coba lagi.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
