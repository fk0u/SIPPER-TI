'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Crown, History, KeyRound, Search, ShieldCheck, UserMinus, Users, X } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { isKM, isSupervisor } from '@/lib/permissions';
import { Badge, Card, Empty, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls } from '@/components/ui/kit';
import type { AuditEntry, ProfileSummary, UserRole } from '@/types/database';

const ROLE_TONE: Record<UserRole, 'blue' | 'emerald' | 'purple'> = { mahasiswa: 'blue', sipen: 'emerald', km: 'purple' };
const ROLE_LABEL: Record<UserRole, string> = { mahasiswa: 'Mahasiswa', sipen: 'Sipen', km: 'KM' };

function MembersManager() {
  const { user, klass, profiles, refresh } = useAuthStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Dinaikkan setiap aksi berhasil agar Riwayat Aktivitas dimuat ulang
  const [auditVersion, setAuditVersion] = useState(0);
  const km = isKM(user);
  // Superadmin tetap bisa mengatur peran walau sudah menyerahkan jabatan KM
  const canManageRoles = km || Boolean(user?.is_admin);

  const staff = isSupervisor(user);
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
      setAuditVersion((v) => v + 1);
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

  const resetPassword = (p: ProfileSummary) => {
    if (!window.confirm(`Reset kata sandi ${p.full_name} menjadi NIM-nya (${p.nim})? Ia wajib menggantinya saat login berikutnya.`)) return;
    void run(p.id, () => repo.resetMemberPassword(p.id), `Kata sandi ${p.full_name} direset ke NIM.`);
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

      {staff && (
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
      )}

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
                  <div className="flex flex-wrap gap-2">
                  {canManageRoles && !self && (
                    <button disabled={busyId === p.id} onClick={() => resetPassword(p)} className={btnGhost} title="Reset kata sandi ke NIM">
                      <KeyRound className="w-3.5 h-3.5" /> Reset Sandi
                    </button>
                  )}
                  {canManageRoles && !self && p.role !== 'km' && (
                    <>
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
                    </>
                  )}
                  </div>
                  {(p.role === 'sipen' || p.role === 'km') && <CourseAssigner member={p} canEdit={canManageRoles} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {canManageRoles && <AuditPanel version={auditVersion} nameById={new Map(profiles.map((p) => [p.id, p.full_name]))} />}
    </div>
  );
}

/** Matkul yang dipegang seorang Sipen/KM: tampil sebagai chip; KM/superadmin bisa mengubahnya. */
function CourseAssigner({ member, canEdit }: { member: ProfileSummary; canEdit: boolean }) {
  const { courses, courseSipen, load, isLoaded, loadError } = useLeaveStore();
  const assigned = courseSipen.filter((cs) => cs.user_id === member.id).map((cs) => cs.course_id);
  const [editing, setEditing] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await repo.setMemberCourses(member.id, [...editing]);
      await load();
      setEditing(null);
      toast.success(`Matkul ${member.full_name} disimpan.`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full pl-11 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
        {assigned.length === 0 ? (
          <span className="text-[11px] text-slate-400">Belum memegang mata kuliah</span>
        ) : (
          courses
            .filter((c) => assigned.includes(c.id))
            .map((c) => (
              <span key={c.id} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]" title={c.name}>
                {c.code} {c.name}
              </span>
            ))
        )}
        {canEdit && editing === null && loadError && (
          <button onClick={() => void load()} className="text-[11px] text-rose-600 hover:underline ml-1">
            Data matkul gagal dimuat — coba lagi
          </button>
        )}
        {/* Edit hanya setelah jadwal & penugasan termuat: pilihan kosong tak boleh menghapus penugasan */}
        {canEdit && editing === null && isLoaded && !loadError && (
          <button onClick={() => setEditing(new Set(assigned))} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline ml-1">
            Atur matkul
          </button>
        )}
      </div>
      {editing && isLoaded && !loadError && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.has(c.id)}
                  onChange={() =>
                    setEditing((s) => {
                      const next = new Set(s);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                />
                <span><span className="font-mono text-blue-600 dark:text-blue-400">{c.code}</span> {c.name}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className={btnGhost}>Batal</button>
            <button disabled={saving} onClick={save} className={btnPrimary}><Check className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  'member.approved': 'menyetujui pendaftaran',
  'member.rejected': 'menolak pendaftaran',
  'member.removed': 'mengeluarkan anggota',
  'member.role': 'mengubah peran',
  'password.reset': 'mereset kata sandi',
  'leave.approved': 'menyetujui izin',
  'leave.rejected': 'menolak izin',
  'leave.cancelled': 'membatalkan izin',
};

/** Riwayat aksi sensitif kelas (RLS: KM kelas & superadmin). */
function AuditPanel({ nameById, version }: { nameById: Map<string, string>; version: number }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    repo.fetchAuditLog(50).then(
      (list) => { setEntries(list); setError(null); },
      (err) => setError(errorText(err, 'Gagal memuat riwayat.'))
    );
  }, [version]);
  const who = (id: string | null, nim?: string | null) => (id && nameById.get(id)) || nim || 'sistem';
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <History className="w-4 h-4" /> Riwayat Aktivitas
      </h2>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {entries === null && !error && <p className="text-xs text-slate-500">Memuat…</p>}
      {entries?.length === 0 && <Empty>Belum ada aktivitas tercatat.</Empty>}
      <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
        {entries?.map((e) => {
          const d = e.details;
          const extra = [
            d.course,
            d.from && d.to ? `${d.from} → ${d.to}` : null,
            d.start_date ? `${d.start_date}${d.end_date && d.end_date !== d.start_date ? ` s/d ${d.end_date}` : ''}` : null,
            d.rejection_reason ? `alasan: ${d.rejection_reason}` : null,
          ].filter(Boolean).join(' · ');
          return (
            <li key={e.id} className="py-2 text-xs">
              <span className="text-slate-900 dark:text-white font-medium">{who(e.actor, d.actor_nim)}</span>{' '}
              <span className="text-slate-600 dark:text-slate-400">{AUDIT_LABEL[e.action] ?? e.action}</span>{' '}
              <span className="text-slate-900 dark:text-white">{d.target_name ?? d.target_nim ?? ''}</span>
              {extra && <span className="block text-[11px] text-slate-500">{extra}</span>}
              <span className="block text-[10px] font-mono text-slate-400">
                {new Date(e.at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' })} WITA
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function MembersPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole roles={['km', 'sipen', 'admin']}>
        <MembersManager />
      </RequireRole>
    </div>
  );
}
