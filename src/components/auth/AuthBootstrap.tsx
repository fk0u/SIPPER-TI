'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { PUBLIC_PREFIXES } from '@/lib/routes';

const PASSWORD_PAGE = '/settings/password';
const PENDING_PAGE = '/menunggu';

/** Memuat sesi & data awal; memaksa ganti password (akun NIM default) dan menahan akun pending. */
export function AuthBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const initialize = useAuthStore((s) => s.initialize);
  const userId = useAuthStore((s) => s.user?.id);
  const status = useAuthStore((s) => s.user?.status);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const mfaPending = useAuthStore((s) => s.mfaPending);
  const load = useLeaveStore((s) => s.load);
  const clear = useLeaveStore((s) => s.clear);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    // Logout / sesi berakhir / pending: jangan biarkan data pengguna sebelumnya tetap di memori.
    if (userId && status === 'active' && !mfaPending) void load();
    else clear();
  }, [userId, status, mfaPending, load, clear]);

  useEffect(() => {
    if (!userId || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (mfaPending) {
      router.replace(`/login?mfa=1&next=${encodeURIComponent(pathname)}`);
    } else if (mustChangePassword && pathname !== PASSWORD_PAGE) {
      router.replace(PASSWORD_PAGE);
    } else if (!mustChangePassword && status === 'pending' && pathname !== PENDING_PAGE) {
      router.replace(PENDING_PAGE);
    } else if (status === 'active' && pathname === PENDING_PAGE) {
      router.replace('/');
    }
  }, [userId, status, mustChangePassword, mfaPending, pathname, router]);

  return null;
}
