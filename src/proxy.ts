import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';
import { PUBLIC_PREFIXES, ROLE_RULES } from '@/lib/routes';

const PASSWORD_PAGE = '/settings/password';
const PENDING_PAGE = '/menunggu';

interface GuardProfile {
  role: string;
  status: string;
  is_admin: boolean;
  is_password_changed: boolean;
}

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Wajib: memperbarui sesi (refresh token) di setiap request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user) {
    return redirectTo('/login', pathname === '/' ? undefined : { next: pathname });
  }

  // 2FA: akun dengan faktor terverifikasi wajib sesi aal2 (RLS juga menolak aal1)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return redirectTo('/login', { mfa: '1', next: pathname });
  }

  const { data: profile, error: profileError } = await supabase
    .rpc('get_my_profile')
    .maybeSingle<GuardProfile>();

  // Gagal tertutup: tanpa profil, status/role tidak dapat dipastikan.
  if (profileError || !profile) {
    return redirectTo('/login', { error: 'profile_unavailable' });
  }

  // Akun NIM dengan password default wajib menggantinya sebelum mengakses halaman lain.
  const usesPassword = user.app_metadata?.provider === 'email';
  if (usesPassword && !profile.is_password_changed) {
    return pathname === PASSWORD_PAGE ? response : redirectTo(PASSWORD_PAGE);
  }

  // Akun yang belum di-ACC hanya boleh ke halaman tunggu (& ganti password)
  if (profile.status !== 'active') {
    return pathname === PENDING_PAGE || pathname === PASSWORD_PAGE ? response : redirectTo(PENDING_PAGE);
  }

  const rule = ROLE_RULES.find((r) => pathname.startsWith(r.prefix));
  if (rule && !rule.roles.some((r) => (r === 'admin' ? profile.is_admin : r === profile.role))) {
    return redirectTo('/', { denied: '1' });
  }

  return response;
}

export const config = {
  matcher: [
    // Lewati aset statis, gambar & kalender dosen
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ics)$).*)',
  ],
};
