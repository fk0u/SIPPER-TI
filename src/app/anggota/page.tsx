'use client';

import React, { useState } from 'react';
import { Check, Crown, Search, ShieldCheck, UserMinus, Users, X } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { isKM } from '@/lib/permissions';
import { Badge, Card, Empty, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls } from '@/components/ui/kit';
import type { ProfileSummary, UserRole } from '@/types/database';

const ROLE_TONE: Record<UserRole, 'blue' | 'emerald' | 'purple'> = { mahasiswa: 'blue', sipen: 'emerald', km: 'purple' };
const ROLE_LABEL: Record<UserRole, string> = { mahasiswa: 'Mahasiswa', sipen: 'Sipen', km: 'KM' };

function MembersManager() {
  const { user, klass, profiles, refresh } = useAuthStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const km = isKM(user);
  // Superadmin tetap bisa mengatur peran walau sudah menyerahkan jabatan KM
  const canManageRoles = km || Boolean(user?.is_admin);

  const pending = profiles.filter((p) => p.status === 'pending');
  const q = query.trim().toLowerCase();
  const active = profiles
    .filter((p) => p.status === 'active')
    .filter((p) => !q || p.full_name.toLowerCase().includes(q) || p.nim.includes(q));

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const reject = (p: ProfileSummary) => {
    if (!window.confirm(`Tolak pendaftaran ${p.full_name} (${p.nim})? Akun ini dihapus dan NIM bisa didaftarkan ulang oleh pemiliknya.`)) return;
    void run(p.id, () => repo.removeMember(p.id), 'Pendaftaran ditolak.');
  };

  const remove = (p: ProfileSummary) => {
    if (!window.confirm(`Keluarkan ${p.full_name} dari kelas? Akun & riwayat izinnya ikut terhapus.`)) return;
    void run(p.id, () => repo.removeMember(p.id), 'Anggota dikeluarkan.');
  };

  const setRole = (p: ProfileSummary, role: UserRole) => {
    if (role === 'km') {
      const note = km
        ? `Kamu akan menjadi Sipen${user?.is_admin ? ' (status superadmin tetap)' : ''}.`
        : 'KM saat ini akan menjadi Sipen.';
      if (!window.confirm(`Jadikan ${p.full_name} KM kelas ini? ${note}`)) return;
    }
    void run(p.id, () => repo.setMemberRole(p.id, role), `${p.full_name} kini ${ROLE_LABEL[role]}.`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <PageHeader
        icon={Users}
        eyebrow={klass?.name ?? 'Kelas'}
        title="Anggota Kelas"
        description="Setujui pendaftar baru dari kelasmu. KM dapat menunjuk Sipen, menyerahkan jabatan KM (migrasi KM), dan mengeluarkan anggota."
      />

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          Menunggu Persetujuan <Badge tone="amber">{pending.length}</Badge>
        </h2>
        {pending.length === 0 ? (
          <Empty>Tidak ada pendaftar baru.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {pending.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{p.full_name}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    NIM {p.nim} · daftar {new Date(p.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button disabled={busyId === p.id} onClick={() => run(p.id, () => repo.approveMember(p.id), `${p.full_name} disetujui.`)} className={btnPrimary}>
                    <Check className="w-3.5 h-3.5" /> ACC
                  </button>
                  <button disabled={busyId === p.id} onClick={() => reject(p)} className={btnDanger}>
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Anggota Aktif <Badge>{profiles.filter((p) => p.status === 'active').length}</Badge>
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input className={`${inputCls} pl-8`} placeholder="Cari nama / NIM" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {active.length === 0 ? (
          <Empty>Tidak ada anggota yang cocok.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {active.map((p) => {
              const self = p.id === user?.id;
              return (
                <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 flex items-center justify-center text-xs font-bold font-mono">
                      {p.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        {p.full_name} {self && <span className="text-[10px] text-slate-400">(kamu)</span>}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">NIM {p.nim}</p>
                    </div>
                    <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                  </div>
                  {canManageRoles && !self && p.role !== 'km' && (
                    <div className="flex flex-wrap gap-2">
                      {p.role === 'mahasiswa' ? (
                        <button disabled={busyId === p.id} onClick={() => setRole(p, 'sipen')} className={btnGhost}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Jadikan Sipen
                        </button>
                      ) : (
                        <button disabled={busyId === p.id} onClick={() => setRole(p, 'mahasiswa')} className={btnGhost}>
                          Cabut Sipen
                        </button>
                      )}
                      <button disabled={busyId === p.id} onClick={() => setRole(p, 'km')} className={btnGhost}>
                        <Crown className="w-3.5 h-3.5" /> {km ? 'Serahkan KM' : 'Jadikan KM'}
                      </button>
                      {km && (
                        <button disabled={busyId === p.id} onClick={() => remove(p)} className={btnDanger} aria-label={`Keluarkan ${p.full_name}`}>
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function MembersPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole roles={['km', 'sipen']}>
        <MembersManager />
      </RequireRole>
    </div>
  );
}
