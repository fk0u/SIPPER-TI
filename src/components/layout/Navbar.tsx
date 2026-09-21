'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import { UserRole } from '@/types/database';
import { ThemeToggle } from './ThemeToggle';
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  Sparkles,
  Check,
  Home,
  PlusCircle,
  CheckSquare,
  KeyRound,
  X,
  User as UserIcon,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, switchRole, logout, profiles, switchUser } = useAuthStore();
  const { requests } = useLeaveStore();
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleLogout = () => {
    logout();
    toast.info('Anda telah keluar.');
    router.push('/login');
  };

  const roleStyles: Record<UserRole, { badge: string; dot: string; label: string }> = {
    mahasiswa: {
      badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
      dot: 'bg-blue-500',
      label: 'Mahasiswa',
    },
    sipen: {
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-500',
      label: 'Sipen',
    },
    km: {
      badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
      dot: 'bg-purple-500',
      label: 'Ketua Kelas',
    },
  };

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 sm:pt-4 pointer-events-none">
      <div className="max-w-5xl mx-auto rounded-2xl liquid-glass px-3 sm:px-5 py-2.5 flex items-center justify-between pointer-events-auto transition-all duration-300">
        
        {/* Brand Mark (Both Desktop & Mobile) */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-inner">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
              SIPPER-TI
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              UMKT
            </span>
          </div>
        </Link>

        {/* ========================================================================= */}
        {/* DESKTOP EXCLUSIVE: Full App Bar Navigation Links (Hidden on Mobile)       */}
        {/* ========================================================================= */}
        {isAuthenticated && user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/5 text-xs">
            <Link
              href="/"
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                pathname === '/'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Beranda
            </Link>
            <Link
              href="/leave/new"
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                pathname === '/leave/new'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Ajukan Izin
            </Link>
            {(user.role === 'sipen' || user.role === 'km') && (
              <Link
                href="/approval"
                className={`relative px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  pathname === '/approval'
                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Approval
                {pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-500 text-slate-950 rounded-md">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/admin/tokens"
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                pathname === '/admin/tokens'
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Link Dosen
            </Link>
          </nav>
        )}

        {/* Right Section: Theme Toggle + User Popover */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Switcher */}
          <ThemeToggle />

          {/* User Account & Role Switcher */}
          {isAuthenticated && user ? (
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
                <span
                  className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md border ${roleStyles[user.role].badge}`}
                >
                  {user.role}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </button>

              {/* Account Dropdown Popover (Safe & Non-blocking) */}
              {isAccountOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]"
                    onClick={() => setIsAccountOpen(false)}
                  />
                  <div className="absolute right-0 top-11 mt-2 w-72 max-w-[calc(100vw-24px)] liquid-glass rounded-2xl shadow-2xl p-4 z-50 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{user.full_name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">NIM: {user.nim}</p>
                      </div>
                      <button
                        onClick={() => setIsAccountOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Role Switcher */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Beralih Peran:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        {(['mahasiswa', 'sipen', 'km'] as UserRole[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              switchRole(r);
                              toast.info(`Peran aktif dialihkan ke: ${r.toUpperCase()}`);
                              setIsAccountOpen(false);
                            }}
                            className={`py-1.5 px-1.5 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider transition border text-center active:scale-95 ${
                              user.role === r
                                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Demo Profile Switcher */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                        Profil Demo Cepat:
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {profiles.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              switchUser(p.id);
                              toast.success(`Beralih ke akun: ${p.full_name}`);
                              setIsAccountOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                              user.id === p.id
                                ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/30'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className="truncate">{p.full_name} ({p.role.toUpperCase()})</span>
                            {user.id === p.id && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logout */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setIsAccountOpen(false);
                          handleLogout();
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
