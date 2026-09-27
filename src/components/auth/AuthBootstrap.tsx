'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, isDemoMode } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';

const PASSWORD_PAGE = '/settings/password';

/** Memuat sesi & data awal, serta memaksa ganti password untuk akun NIM default. */
export function AuthBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const initialize = useAuthStore((s) => s.initialize);
  const userId = useAuthStore((s) => s.user?.id);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const load = useLeaveStore((s) => s.load);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (userId) {
      void load();
    } else if (!isDemoMode()) {
      // Logout / sesi berakhir: jangan biarkan data pengguna sebelumnya tetap di memori.
      useLeaveStore.setState({ requests: [], courses: [], courseSipen: [], lecturerTokens: [], isLoaded: false });
    }
  }, [userId, load]);

  useEffect(() => {
    if (mustChangePassword && pathname !== PASSWORD_PAGE && !pathname.startsWith('/lecturer/')) {
      router.replace(PASSWORD_PAGE);
    }
  }, [mustChangePassword, pathname, router]);

  return null;
}
