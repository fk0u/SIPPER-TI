'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, GraduationCap, Loader2, School, UserPlus, Users } from 'lucide-react';
import * as repo from '@/lib/data/supabaseRepository';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { OpenClass } from '@/types/database';

type Mode = 'join' | 'new';

/** Pesan GoTrue → bahasa pengguna. Pesan dari trigger DB sudah berbahasa Indonesia. */
function friendlySignupError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return 'NIM ini sudah terdaftar. Silakan masuk, atau hubungi KM kelasmu bila bukan kamu yang mendaftar.';
  }
  if (/classes_name_key|duplicate key/i.test(message)) {
    return 'Nama kelas sudah dipakai. Pilih kelas tersebut di tab "Gabung Kelas" atau gunakan nama lain.';
  }
  if (/password/i.test(message) && /(short|characters|weak)/i.test(message)) {
    return 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter.';
  }
  return message;
}

export function RegisterForm() {
  const router = useRouter();
  const refresh = useAuthStore((s) => s.refresh);

  const [classes, setClasses] = useState<OpenClass[] | null>(null);
  const [mode, setMode] = useState<Mode>('join');
  const [nim, setNim] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [classId, setClassId] = useState('');
  const [newClass, setNewClass] = useState({ name: '', program: 'Teknik Informatika', batch: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    repo
      .listOpenClasses()
      .then((list) => {
        setClasses(list);
        if (list.length === 0) setMode('new');
      })
      .catch(() => setClasses([]));
  }, []);

  const validate = (): string | null => {
    if (!/^[0-9]{8,20}$/.test(nim.trim())) return 'NIM harus berupa 8–20 digit angka.';
    if (fullName.trim().length < 3) return 'Nama lengkap minimal 3 karakter.';
    if (password.length < 8) return 'Kata sandi minimal 8 karakter.';
    if (password === nim.trim()) return 'Kata sandi tidak boleh sama dengan NIM.';
    if (password !== confirm) return 'Konfirmasi kata sandi tidak sama.';
    if (mode === 'join' && !classId) return 'Pilih kelasmu.';
    if (mode === 'new' && newClass.name.trim().length < 3) return 'Nama kelas minimal 3 karakter.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    setError(invalid);
    if (invalid) return;

    setSubmitting(true);
    try {
      await repo.signUpWithNim({
        nim: nim.trim(),
        fullName,
        password,
        choice: mode === 'join' ? { kind: 'join', classId } : { kind: 'new', ...newClass },
      });
      await refresh();
      toast.success('Akun dibuat! Tunggu persetujuan untuk mulai memakai SIPPER-TI.');
      router.replace('/menunggu');
    } catch (err) {
      setError(friendlySignupError(errorText(err, 'Pendaftaran gagal. Coba lagi.')));
    } finally {
      setSubmitting(false);
    }
  };

  const tab = (value: Mode, label: string, Icon: typeof Users) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
        mode === value
          ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 mb-1 shadow-inner">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          <ShinyText text="Daftar Akun" />
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
          Pilih kelasmu. Akun aktif setelah di-ACC Sipen atau Ketua Kelas (KM).
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <div className="doppelrand-shell">
        <form onSubmit={handleSubmit} className="doppelrand-core p-6 sm:p-7 space-y-4">
          <div>
            <label className={labelCls}>Nomor Induk Mahasiswa (NIM)</label>
            <input className={`${inputCls} font-mono`} inputMode="numeric" autoComplete="username"
              value={nim} onChange={(e) => setNim(e.target.value)} placeholder="Contoh: 2611102441026" />
          </div>
          <div>
            <label className={labelCls}>Nama Lengkap</label>
            <input className={inputCls} autoComplete="name" value={fullName}
              onChange={(e) => setFullName(e.target.value)} placeholder="Sesuai data kampus" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kata Sandi</label>
              <div className="relative">
                <input className={`${inputCls} pr-9`} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 karakter" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Ulangi Sandi</label>
              <input className={inputCls} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>

          <div className="pt-1 space-y-3">
            <div className="flex gap-1 bg-slate-100/80 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/5">
              {tab('join', 'Gabung Kelas', Users)}
              {tab('new', 'Ajukan Kelas Baru', School)}
            </div>

            {mode === 'join' ? (
              classes === null ? (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat daftar kelas...</div>
              ) : classes.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada kelas aktif. Ajukan kelas baru.</p>
              ) : (
                <div>
                  <label className={labelCls}>Kelas</label>
                  <select className={inputCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
                    <option value="">— Pilih kelas —</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.program}{c.batch ? ` ${c.batch}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    Sipen / KM kelas ini akan memverifikasi pendaftaranmu.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nama Kelas</label>
                  <input className={inputCls} value={newClass.name} maxLength={80}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} placeholder="Contoh: TI Internasional 2026" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Program Studi</label>
                    <input className={inputCls} value={newClass.program} maxLength={80}
                      onChange={(e) => setNewClass({ ...newClass, program: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Angkatan</label>
                    <input className={inputCls} value={newClass.batch} maxLength={20} inputMode="numeric"
                      onChange={(e) => setNewClass({ ...newClass, batch: e.target.value })} placeholder="2026" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kamu menjadi <strong>Ketua Kelas (KM)</strong> setelah pengajuan di-ACC admin platform.
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Daftar
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Masuk</Link>
      </p>
    </div>
  );
}
