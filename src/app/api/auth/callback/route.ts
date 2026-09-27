import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isCampusEmail, safeNextPath } from '@/lib/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  // Registrasi pertama akun non-UMKT ditolak trigger DB sebelum kode dibuat;
  // Supabase mengalihkan ke sini dengan error_description.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    const isDomainError = /umkt|database error saving new user/i.test(providerError);
    return NextResponse.redirect(`${origin}/login?error=${isDomainError ? 'domain' : 'auth_callback_failed'}`);
  }

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Parameter `hd` Google hanya petunjuk UI — validasi domain wajib di server.
      if (!isCampusEmail(data.user?.email)) {
        // Hapus cookie sesi lokal meskipun pemanggilan logout ke server gagal
        await supabase.auth.signOut({ scope: 'local' });
        return NextResponse.redirect(`${origin}/login?error=domain`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
