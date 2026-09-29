import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ATTACHMENT_BUCKET } from '@/lib/supabase/config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lampiran surat izin untuk portal dosen: token divalidasi di database, lalu
// dialihkan ke signed URL berumur pendek (path storage tidak pernah dikirim ke klien).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; leave: string; index: string }> }
) {
  const { token, leave, index } = await params;
  const i = Number(index);
  if (!UUID_RE.test(leave) || !Number.isInteger(i) || i < 0) {
    return new Response('Lampiran tidak ditemukan.', { status: 404 });
  }
  try {
    const admin = createAdminClient();
    const { data: file, error } = await admin.rpc('lecturer_attachment', { p_token: token, p_leave: leave, p_index: i });
    if (error) throw error;
    if (!file?.path) return new Response('Lampiran tidak ditemukan.', { status: 404 });
    const download = new URL(request.url).searchParams.has('download') ? (file.name as string) || true : undefined;
    const { data: signed, error: signError } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(file.path as string, 300, download ? { download } : undefined);
    if (signError || !signed) throw signError ?? new Error('signed URL kosong');
    const res = NextResponse.redirect(signed.signedUrl, 302);
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex');
    res.headers.set('Referrer-Policy', 'no-referrer');
    return res;
  } catch (err) {
    console.error('[lampiran-dosen]', err);
    return new Response('Lampiran sementara tidak dapat dibuka.', { status: 503 });
  }
}
