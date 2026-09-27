'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AlertCircle, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';

export const ChangePasswordForm: React.FC = () => {
  const router = useRouter();
  const { changePassword, mustChangePassword, usesPassword } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSaving(true);
    const res = await changePassword(password);
    setIsSaving(false);

    if (!res.success) {
      setError(res.error || 'Gagal memperbarui kata sandi.');
      return;
    }
    toast.success('Kata sandi berhasil diperbarui.');
    router.replace('/');
  };

  if (!usesPassword) {
    return (
      <div className="w-full max-w-md mx-auto doppelrand-shell">
        <div className="doppelrand-core p-6 sm:p-7 space-y-2 text-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Kata Sandi Tidak Digunakan</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Anda masuk dengan akun Google kampus. Kata sandi dikelola oleh Google, bukan SIPPER-TI.
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="w-full max-w-md mx-auto doppelrand-shell">
      <form onSubmit={handleSubmit} className="doppelrand-core p-6 sm:p-7 space-y-5">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Ganti Kata Sandi</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {mustChangePassword
              ? 'Anda masih menggunakan kata sandi default (NIM). Demi keamanan, wajib diganti sebelum melanjutkan.'
              : 'Perbarui kata sandi akun login NIM Anda.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="new-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Kata Sandi Baru
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Konfirmasi Kata Sandi
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
        >
          <Lock className="w-3.5 h-3.5" /> {isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
        </button>
      </form>
    </div>
  );
};
