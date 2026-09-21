'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { UserRole } from '@/types/database';
import { ThemeToggle } from './ThemeToggle';
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  Sparkles,
  Check,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, switchRole, logout, profiles, switchUser } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const roleColors: Record<UserRole, { badge: string; dot: string }> = {
    mahasiswa: {
      badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
      dot: 'bg-blue-500 dark:bg-blue-400',
    },
    sipen: {
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
    km: {
      badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
      dot: 'bg-purple-500 dark:bg-purple-400',
    },
  };

  return (
    <header className="sticky top-0 z-50 px-4 sm:px-6 pt-3 pointer-events-none">
      <div className="max-w-5xl mx-auto rounded-2xl bg-white/90 dark:bg-slate-950/85 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 px-4 sm:px-6 py-2.5 shadow-lg dark:shadow-2xl flex items-center justify-between pointer-events-auto transition-all">
        
        {/* Brand Mark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">SIPPER-TI</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-medium text-blue-700 dark:text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
              TI-UMKT
            </span>
          </div>
        </Link>

        {/* Desktop Quick Nav Links */}
        {isAuthenticated && user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                pathname === '/' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Beranda
            </Link>
            <Link
              href="/leave/new"
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                pathname === '/leave/new' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Ajukan Izin
            </Link>
            {(user.role === 'sipen' || user.role === 'km') && (
              <Link
                href="/approval"
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  pathname === '/approval' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Approval
              </Link>
            )}
            <Link
              href="/admin/tokens"
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                pathname === '/admin/tokens' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Link Dosen
            </Link>
          </nav>
        )}

        {/* Right Section: Theme Switcher & User Pill */}
        <div className="flex items-center gap-2.5">
          
          {/* Theme Switcher Component */}
          <div className="scale-90 sm:scale-100 origin-right">
            <ThemeToggle />
          </div>

          {/* User Profile & Role Switcher */}
          {isAuthenticated && user ? (
            <div className="relative flex items-center gap-2">
              
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition active:scale-[0.98]"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold font-mono">
                  {user.full_name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white hidden sm:block truncate max-w-[110px]">
                  {user.full_name}
                </span>
                <span
                  className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${roleColors[user.role].badge}`}
                >
                  {user.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </button>

              {/* Dropdown Card */}
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-12 mt-2 w-72 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 space-y-3.5 animate-in fade-in zoom-in-95">
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{user.full_name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">NIM: {user.nim}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                    </div>

                    {/* Role Switcher */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Ganti Peran (Role):
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                        {(['mahasiswa', 'sipen', 'km'] as UserRole[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              switchRole(r);
                              setIsDropdownOpen(false);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider transition border text-center ${
                              user.role === r
                                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Demo Account Switcher */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                        Ganti Akun Demo:
                      </span>
                      <div className="space-y-1">
                        {profiles.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              switchUser(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                              user.id === p.id
                                ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/30'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                            }`}
                          >
                            <span className="truncate">{p.full_name} ({p.role.toUpperCase()})</span>
                            {user.id === p.id && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logout Button */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition active:scale-[0.98]"
            >
              Masuk
            </Link>
          )}

        </div>

      </div>
    </header>
  );
};
