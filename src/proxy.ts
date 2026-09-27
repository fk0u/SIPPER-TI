import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';

// Rute yang membutuhkan peran tertentu (mode live). Mode demo dijaga di sisi klien oleh <RequireRole>.
const ROLE_RULES: { prefix: string; roles: string[] }[] = [
  { prefix: '/approval', roles: ['km', 'sipen'] },
  { prefix: '/admin', roles: ['km', 'sipen'] },
];

const PUBLIC_PREFIXES = ['/login', '/lecturer/', '/api/auth/'];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  const rule = ROLE_RULES.find((r) => pathname.startsWith(r.prefix));
  if (rule) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !rule.roles.includes(profile.role)) {
      return redirectTo('/', { denied: '1' });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Lewati aset statis & gambar
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
