'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { Badge, Card, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';

type Factor = Awaited<ReturnType<typeof repo.listTotpFactors>>[number];

function SecuritySettings() {
  const { user, refresh } = useAuthStore();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      repo.listTotpFactors().then(
        (f) => {
          setFactors(f);
          setLoadError(null);
        },
        // Gagal memuat ≠ tidak ada faktor: jangan tampilkan "Tidak aktif"
        (err) => setLoadError(errorText(err, 'Status 2FA gagal dimuat.'))
      ),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="max-w-md mx-auto py-10">
        <Card className="text-center space-y-3">
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{loadError}</p>
          <button onClick={() => { setLoadError(null); load(); }} className={btnPrimary}>Coba lagi</button>
        </Card>
      </div>
    );
  }
  if (!factors) return <PageLoader />;
  const active = factors.find((f) => f.status === 'verified');

  const start = async () => {
    setBusy(true);
    try {
      setEnroll(await repo.enrollTotp());
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    try {
      await repo.verifyTotp(enroll.factorId, code);
      setEnroll(null);
      setCode('');
      await Promise.all([load(), refresh()]);
      toast.success('2FA aktif. Login berikutnya akan meminta kode dari aplikasi authenticator.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!active || !window.confirm('Nonaktifkan 2FA? Akun hanya dilindungi password.')) return;
    setBusy(true);
    try {
      await repo.unenrollFactor(active.id);
      await Promise.all([load(), refresh()]);
      toast.info('2FA dinonaktifkan.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-16">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Keamanan Akun"
        title="Verifikasi 2 Langkah (2FA)"
        description={`Lindungi akun ${user?.is_admin ? 'superadmin' : 'KM / Sipen'} kamu: selain password, login meminta kode 6 digit dari aplikasi authenticator di HP.`}
      />

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900 dark:text-white">Status</span>
          <Badge tone={active ? 'emerald' : 'slate'}>{active ? 'Aktif' : 'Tidak aktif'}</Badge>
        </div>

        {active ? (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Aktif sejak {new Date(active.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
              Kalau HP hilang, minta superadmin menghapus faktor 2FA lewat Supabase Studio.
            </p>
            <button disabled={busy} onClick={disable} className={btnDanger}><ShieldOff className="w-3.5 h-3.5" /> Nonaktifkan 2FA</button>
          </>
        ) : enroll ? (
          <form onSubmit={confirm} className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              1. Scan QR ini dengan Google Authenticator / Authy / Microsoft Authenticator.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR 2FA" className="w-48 h-48 mx-auto rounded-xl bg-white p-2" />
            <div className="flex gap-2">
              <input readOnly value={enroll.secret} aria-label="Kode rahasia 2FA" className={`${inputCls} font-mono text-[11px]`} />
              <button type="button" onClick={() => navigator.clipboard.writeText(enroll.secret).then(() => toast.success('Kode rahasia disalin.'), () => toast.error('Gagal menyalin. Salin manual dari kolom di sebelahnya.'))} className={btnGhost} aria-label="Salin kode rahasia">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <label className="block">
              <span className={labelCls}>2. Masukkan 6 digit kode dari aplikasi</span>
              <input aria-label="Kode 2FA 6 digit" className={`${inputCls} text-center tracking-[0.5em] font-mono text-base`} inputMode="numeric" autoComplete="one-time-code"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            </label>
            <div className="flex gap-2">
              <button disabled={busy || code.length !== 6} className={btnPrimary}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Aktifkan
              </button>
              <button type="button" disabled={busy} onClick={() => setEnroll(null)} className={btnGhost}>Batal</button>
            </div>
          </form>
        ) : (
          <button disabled={busy} onClick={start} className={btnPrimary}><ShieldCheck className="w-3.5 h-3.5" /> Aktifkan 2FA</button>
        )}
      </Card>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole>
        <SecuritySettings />
      </RequireRole>
    </div>
  );
}
