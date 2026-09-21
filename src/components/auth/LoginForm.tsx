'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  Lock,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { loginWithGoogle, loginWithNIM, error, clearError, isLoading, switchUser } =
    useAuthStore();

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    const res = await loginWithGoogle();
    if (res.success) {
      router.push('/');
    }
  };

  const handleNimLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!nim.trim()) {
      setLocalError('NIM wajib diisi.');
      return;
    }

    if (!password) {
      setLocalError('Kata sandi wajib diisi.');
      return;
    }

    const res = await loginWithNIM(nim, password);
    if (res.success) {
      router.push('/');
    }
  };

  const handleQuickDemo = (userId: string) => {
    switchUser(userId);
    router.push('/');
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      
      {/* Top Bar with Theme Switcher */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 mb-2 shadow-inner">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">SIPPER-TI</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
          Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT
        </p>
      </div>

      {/* Error Banner */}
      {(error || localError) && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{localError || error}</span>
        </div>
      )}

      {/* Login Card */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-6 sm:p-8 space-y-6">
          
          {/* Option 1: Google SSO (@umkt.ac.id) */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs sm:text-sm rounded-xl shadow border border-slate-200 transition flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Masuk dengan Akun Kampus (@umkt.ac.id)</span>
            </button>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              Kuncian domain wajib: <strong className="text-blue-600 dark:text-blue-400 font-mono">@umkt.ac.id</strong>
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-white/10 w-full" />
            <span className="bg-transparent px-3 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              atau gunakan NIM
            </span>
            <div className="border-t border-slate-200 dark:border-white/10 w-full" />
          </div>

          {/* Option 2: NIM & Password Fallback */}
          <form onSubmit={handleNimLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Nomor Induk Mahasiswa (NIM)</label>
              <input
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                placeholder="Contoh: 2311102441101"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kata Sandi</label>
                <span className="text-[10px] text-slate-500 font-mono">Default: NIM</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Lock className="w-4 h-4" /> Masuk dengan NIM
            </button>
          </form>

        </div>
      </div>

      {/* Quick Demo Switcher Cards (Non-pill rounded-xl) */}
      <div className="bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Akses Cepat Akun Demo:
          </span>
          <span className="text-[10px] text-slate-400 font-mono">1-Klik Langsung</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-left">
          <button
            type="button"
            onClick={() => handleQuickDemo('a0000000-0000-0000-0000-000000000001')}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition group active:scale-[0.97]"
          >
            <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 block uppercase font-semibold">Mahasiswa</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">Rian Pratama</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('a0000000-0000-0000-0000-000000000002')}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition group active:scale-[0.97]"
          >
            <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 block uppercase font-semibold">Sipen Matkul</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300">Sarah Amalia</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('a0000000-0000-0000-0000-000000000003')}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 transition group active:scale-[0.97]"
          >
            <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 block uppercase font-semibold">Ketua KM</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate group-hover:text-purple-600 dark:group-hover:text-purple-300">Budi Santoso</span>
          </button>
        </div>
      </div>

    </div>
  );
};
