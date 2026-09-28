'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ShinyText } from '@/components/reactbits/ShinyText';
import {
  Lock,
  AlertCircle,
  GraduationCap,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

interface LoginFormProps {
  nextPath?: string;
  initialError?: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ nextPath = '/', initialError = null }) => {
  const router = useRouter();
  const {
    loginWithGoogle,
    loginWithNIM,
    error,
    clearError,
    isLoading,
    isAuthenticated,
    isReady,
    mfaPending,
    verifyMfa,
    logout,
  } = useAuthStore();
  // Google SSO butuh OAuth client + domain; aktifkan dengan NEXT_PUBLIC_GOOGLE_SSO=true
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SSO === 'true';

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(initialError);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Sudah masuk (dan lolos 2FA bila aktif) → langsung ke tujuan
  useEffect(() => {
    if (isReady && isAuthenticated && !mfaPending) router.replace(nextPath);
  }, [isReady, isAuthenticated, mfaPending, nextPath, router]);

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setLocalError('Masukkan 6 digit kode dari aplikasi authenticator.');
      return;
    }
    setVerifying(true);
    const res = await verifyMfa(otp);
    setVerifying(false);
    if (res.success) {
      toast.success('Verifikasi 2FA berhasil.');
      router.push(nextPath);
    } else {
      setOtp('');
      setLocalError(res.error ?? 'Kode salah.');
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    const res = await loginWithGoogle(nextPath);
    if (!res.success) {
      toast.error('Gagal masuk dengan akun Google Kampus.');
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
    if (res.success && res.mfaRequired) {
      toast.info('Masukkan kode 2FA dari aplikasi authenticator.');
    } else if (res.success) {
      toast.success('Berhasil masuk dengan NIM!');
      router.push(nextPath);
    } else {
      toast.error('NIM atau kata sandi tidak cocok.');
    }
  };


  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      
      {/* Top Bar with Minimalist Theme Switcher */}
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 mb-1 shadow-inner">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          <ShinyText text="SIPPER-TI" />
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
          Perizinan, jadwal & pengingat kuliah untuk kelas-kelas di UMKT
        </p>
      </div>

      {/* Error Banner */}
      {(error || localError) && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{localError || error}</span>
        </div>
      )}

      {isAuthenticated && mfaPending ? (
      <div className="doppelrand-shell">
        <form onSubmit={handleOtp} className="doppelrand-core p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verifikasi 2 Langkah
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">Buka aplikasi authenticator (Google Authenticator, Authy, dsb.) lalu masukkan 6 digit kode SIPPER-TI.</p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            aria-label="Kode 2FA"
            className="w-full text-center tracking-[0.5em] font-mono text-lg bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
          <button type="submit" disabled={verifying} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
            <ShieldCheck className="w-3.5 h-3.5" /> Verifikasi
          </button>
          <button type="button" onClick={() => void logout()} className="w-full text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Batal & masuk dengan akun lain
          </button>
        </form>
      </div>
      ) : (<>
      {/* Main Login Card */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-6 sm:p-7 space-y-5">
          
          {googleEnabled && (<>
          {/* Option 1: Google SSO (@umkt.ac.id) */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs sm:text-sm rounded-xl shadow-md border border-slate-300/80 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 group"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              <span>Masuk dengan Akun Kampus</span>
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                <ArrowRight className="w-3 h-3 text-slate-600" />
              </div>
            </button>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-mono">
              Domain resmi: <strong className="text-blue-600 dark:text-blue-400">@umkt.ac.id</strong>
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200/80 dark:border-white/10 w-full" />
            <span className="bg-transparent px-3 text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
              atau gunakan NIM
            </span>
            <div className="border-t border-slate-200/80 dark:border-white/10 w-full" />
          </div>
          </>)}

          {/* NIM & Password */}
          <form onSubmit={handleNimLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Nomor Induk Mahasiswa (NIM)
              </label>
              <input
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                placeholder="Contoh: 2311102441101"
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kata Sandi
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Akun dari KM: default NIM</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-10"
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
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-900/20 transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 mt-1"
            >
              <Lock className="w-3.5 h-3.5" /> Masuk dengan NIM
            </button>
          </form>

        </div>
      </div>

      </>)}

      {/* Registrasi mandiri */}
      <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">Belum punya akun?</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Daftar dengan NIM, pilih kelas, lalu tunggu ACC Sipen / KM.</p>
        </div>
        <Link
          href="/register"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5" /> Daftar
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
