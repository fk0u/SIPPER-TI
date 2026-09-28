'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useHydrated } from '@/lib/useHydrated';
import type { UserRole } from '@/types/database';

interface RequireRoleProps {
  /** Kosongkan untuk sekadar mewajibkan login + akun aktif. `admin` = superadmin. */
  roles?: (UserRole | 'admin')[];
  children: React.ReactNode;
}

export function PageLoader({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="min-h-[50dvh] flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

/** Penjaga rute sisi klien (lapisan UX; server dijaga src/proxy.ts + RLS). */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { user, isAuthenticated, isReady } = useAuthStore();

  const ready = hydrated && isReady;
  const loggedIn = Boolean(isAuthenticated && user);

  useEffect(() => {
    if (ready && !loggedIn) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, loggedIn, pathname, router]);

  // Akun pending dialihkan AuthBootstrap ke /menunggu
  if (!ready || !loggedIn || !user || user.status !== 'active') return <PageLoader />;

  const allowed =
    !roles || roles.some((r) => (r === 'admin' ? user.is_admin : r === user.role));
  if (!allowed) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center p-4">
        <div className="doppelrand-shell max-w-md w-full">
          <div className="doppelrand-core p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Akses Ditolak</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Halaman ini hanya untuk peran{' '}
                <strong className="font-mono uppercase">{roles!.join(' / ')}</strong>. Peran Anda saat ini:{' '}
                <strong className="font-mono uppercase">{user.role}</strong>.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition active:scale-95"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
