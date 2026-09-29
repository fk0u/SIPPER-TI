'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hourglass, LogOut, RefreshCw, School } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { PageLoader } from '@/components/auth/RequireRole';
import { Card, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { OpenClass } from '@/types/database';

export default function PendingPage() {
  const router = useRouter();
  const { user, klass, isReady, refresh, logout } = useAuthStore();
  const [classes, setClasses] = useState<OpenClass[]>([]);
  const [classesError, setClassesError] = useState(false);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  const isApplicant = Boolean(klass && klass.status === 'pending' && klass.created_by === user?.id);

  const loadClasses = useCallback(
    () =>
      repo.listOpenClasses().then(
        (list) => {
          setClasses(list);
          setClassesError(false);
        },
        () => setClassesError(true)
      ),
    []
  );

  useEffect(() => {
    if (!isApplicant) loadClasses();
  }, [isApplicant, loadClasses]);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  if (!isReady || !user) return <PageLoader />;

  const checkStatus = async () => {
    setBusy(true);
    await Promise.all([refresh(), isApplicant ? undefined : loadClasses()]);
    setBusy(false);
    if (useAuthStore.getState().user?.status === 'active') {
      toast.success('Akunmu sudah disetujui!');
      router.replace('/');
    } else {
      toast.info('Masih menunggu persetujuan.');
    }
  };

  const changeClass = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await repo.chooseClass(choice);
      await refresh();
      toast.success('Kelas tujuan diperbarui.');
      setChoice('');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 sm:py-12 space-y-4">
      <Card className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center mx-auto">
          <Hourglass className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Menunggu Persetujuan</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {isApplicant ? (
              <>Pengajuan kelas <strong>{klass!.name}</strong> sedang ditinjau admin platform. Setelah disetujui, kamu otomatis menjadi Ketua Kelas (KM).</>
            ) : klass ? (
              <>Pendaftaranmu di kelas <strong>{klass.name}</strong> menunggu ACC dari Sipen atau KM kelas tersebut. Hubungi mereka agar lebih cepat diproses.</>
            ) : (
              <>Akunmu belum terhubung ke kelas mana pun. Pilih kelasmu di bawah.</>
            )}
          </p>
          <p className="text-[11px] font-mono text-slate-500">
            {user.full_name} · NIM {user.nim}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={checkStatus} disabled={busy} className={btnPrimary}>
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Cek Status
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className={btnGhost}
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </Card>

      {!isApplicant && classesError && (
        <Card>
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            Daftar kelas gagal dimuat.{' '}
            <button onClick={() => loadClasses()} className="underline font-semibold">Coba lagi</button>
          </p>
        </Card>
      )}

      {!isApplicant && classes.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <School className="w-4 h-4 text-blue-500" /> {klass ? 'Salah pilih kelas?' : 'Pilih kelas'}
          </div>
          <label className="block">
            <span className={labelCls}>Kelas tujuan</span>
            <select className={inputCls} value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">— Pilih kelas —</option>
              {classes.filter((c) => c.id !== klass?.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.program}{c.batch ? ` ${c.batch}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button onClick={changeClass} disabled={!choice || busy} className={`${btnGhost} w-full`}>
            Ajukan ke kelas ini
          </button>
        </Card>
      )}
    </div>
  );
}
