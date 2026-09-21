'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { UserRole } from '@/types/database';
import {
  GraduationCap,
  LogOut,
  ChevronDown,
  User,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
  Check,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated, switchRole, logout, profiles, switchUser } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const roleColors: Record<UserRole, string> = {
    mahasiswa: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    sipen: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    km: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 group-hover:bg-blue-600/30 transition">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-white tracking-tight">SIPPER-TI</span>
              <span className="text-[10px] font-mono font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded">
                UMKT
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Perizinan Presensi TI Internasional</p>
          </div>
        </Link>

        {/* User Navigation / Role Switcher */}
        {isAuthenticated && user ? (
          <div className="relative flex items-center gap-2">
            
            {/* User Profile & Role Dropdown Button */}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold font-mono">
                {user.full_name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[130px]">
                  {user.full_name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">NIM: {user.nim}</span>
              </div>
              <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border ${roleColors[user.role]}`}>
                {user.role}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 top-12 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 space-y-3 animate-in fade-in zoom-in-95">
                  <div className="border-b border-slate-800 pb-2 px-1">
                    <p className="text-xs font-semibold text-white">{user.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>

                  {/* Quick Role Switcher for seamless QA/Testing */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 px-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Ganti Peran (Role Switch):
                    </span>
                    <div className="grid grid-cols-3 gap-1 pt-1">
                      {(['mahasiswa', 'sipen', 'km'] as UserRole[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            switchRole(r);
                            setIsDropdownOpen(false);
                          }}
                          className={`py-1 px-2 rounded-lg text-[10px] font-semibold uppercase transition border text-center ${
                            user.role === r
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Demo User Switcher */}
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 px-1">
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
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                            user.id === p.id
                              ? 'bg-blue-600/20 text-blue-300 font-medium'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{p.full_name} ({p.role})</span>
                          {user.id === p.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
          >
            Masuk
          </Link>
        )}

      </div>
    </header>
  );
};
