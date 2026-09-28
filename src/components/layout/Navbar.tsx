'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import type { UserRole } from '@/types/database';
import { ThemeToggle } from './ThemeToggle';
import { useHydrated } from '@/lib/useHydrated';
import { STANDALONE_PREFIXES } from '@/lib/routes';
import { navItemsFor } from '@/lib/nav';
import { useNavBadges } from './useNavBadges';
import { GraduationCap, LogOut, ChevronDown, KeyRound, ShieldCheck, X } from 'lucide-react';

const ROLE_BADGE: Record<UserRole, string> = {
  mahasiswa: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  sipen: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  km: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
};

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, klass, isAuthenticated, isReady, logout, usesPassword } = useAuthStore();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const hydrated = useHydrated();
  const badges = useNavBadges();

  if (STANDALONE_PREFIXES.some((x) => pathname.startsWith(x))) return null; // portal publik punya header sendiri

  const handleLogout = async () => {
    await logout();
    toast.info('Anda telah keluar.');
    router.push('/login');
  };

  const items = navItemsFor(user);

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 sm:pt-4 pointer-events-none">
      <div className="max-w-6xl mx-auto rounded-2xl liquid-glass px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 pointer-events-auto transition-all duration-300">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-inner">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">SIPPER-TI</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded-md max-w-[140px] truncate">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              {klass?.name ?? 'UMKT'}
            </span>
          </div>
        </Link>

        {/* DESKTOP: menu lengkap (mobile & tablet memakai bottom dock) */}
        {hydrated && items.length > 0 && (
          <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/80 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/5 text-xs">
            {items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {count > 0 && (
                    <span className="ml-1.5 px-1.5 text-[9px] font-mono font-bold bg-amber-500 text-slate-950 rounded-md">{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {!hydrated || !isReady ? (
            <div className="w-20 h-8 rounded-xl bg-slate-200/50 dark:bg-white/5 animate-pulse" />
          ) : isAuthenticated && user ? (
            <div className="relative flex items-center">
              <button
                onClick={() => setIsAccountOpen(!isAccountOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.05] border border-slate-300/60 dark:border-white/10 hover:border-slate-400/50 dark:hover:border-white/20 transition active:scale-95 text-left"
                aria-expanded={isAccountOpen}
                aria-label="Menu akun pengguna"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                  {user.full_name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white hidden sm:block truncate max-w-[90px]">
                  {user.full_name.split(' ')[0]}
                </span>
                <span className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md border ${ROLE_BADGE[user.role]}`}>
                  {user.status === 'pending' ? 'pending' : user.role}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </button>

              {isAccountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAccountOpen(false)} />
                  <div className="absolute right-0 top-11 mt-2 w-72 max-w-[calc(100vw-24px)] liquid-glass rounded-2xl shadow-2xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{user.full_name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">NIM: {user.nim}</p>
                        {klass && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Kelas: {klass.name}</p>}
                        {user.is_admin && (
                          <span className="inline-block mt-1 text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25">
                            Superadmin
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setIsAccountOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                        aria-label="Tutup menu akun"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {usesPassword && (
                      <Link
                        href="/settings/password"
                        onClick={() => setIsAccountOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Ganti Kata Sandi</span>
                      </Link>
                    )}

                    {user.status === 'active' && (
                      <Link
                        href="/settings/keamanan"
                        onClick={() => setIsAccountOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Keamanan (2FA)</span>
                      </Link>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setIsAccountOpen(false);
                          void handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition active:scale-95"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
