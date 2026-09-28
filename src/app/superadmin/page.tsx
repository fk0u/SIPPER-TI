'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Check, Crown, Plus, Trash2, UserCog, X } from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { todayLocalISO } from '@/lib/date';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge, Card, Empty, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls } from '@/components/ui/kit';
import type { ClassInfo, Holiday, PendingClass, ProfileSummary } from '@/types/database';

/** Satu kelas aktif: KM saat ini + ganti KM (serah terima; KM lama menjadi Sipen). */
function ClassLeaderRow({ klass, leader, onChanged }: { klass: ClassInfo; leader?: ProfileSummary; onChanged: () => Promise<unknown> }) {
  const me = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refresh);
  const [members, setMembers] = useState<ProfileSummary[] | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  const open = () => repo.fetchClassMembers(klass.id).then(setMembers, (err) => toast.error(errorText(err)));

  const save = async () => {
    const target = members?.find((m) => m.id === choice);
    if (!target) return;
    if (!window.confirm(`Jadikan ${target.full_name} KM ${klass.name}?${leader ? ` ${leader.full_name} akan menjadi Sipen.` : ''}`)) return;
    setBusy(true);
    try {
      await repo.setMemberRole(target.id, 'km');
      toast.success(`${target.full_name} kini KM ${klass.name}.`);
      setMembers(null);
      setChoice('');
      await onChanged();
      if (target.id === me?.id || leader?.id === me?.id) await refreshMe(); // peran sendiri berubah
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{klass.name}</p>
          <p className="text-[11px] text-slate-500">
            {klass.program}{klass.batch ? ` ${klass.batch}` : ''} · KM:{' '}
            {leader ? <span className="text-slate-700 dark:text-slate-300">{leader.full_name} <span className="font-mono">({leader.nim})</span></span> : <span className="text-rose-500">belum ada</span>}
          </p>
        </div>
        {!members && (
          <button onClick={open} className={btnGhost}><UserCog className="w-3.5 h-3.5" /> Ganti KM</button>
        )}
      </div>
      {members && (
        <div className="flex flex-wrap gap-2">
          <select className={`${inputCls} flex-1 min-w-[12rem]`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">— Pilih KM baru —</option>
            {members.filter((m) => m.id !== leader?.id).map((m) => (
              <option key={m.id} value={m.id}>{m.full_name} ({m.nim}) · {m.role}{m.id === me?.id ? ' · kamu' : ''}</option>
            ))}
          </select>
          <button disabled={!choice || busy} onClick={save} className={btnPrimary}><Crown className="w-3.5 h-3.5" /> Jadikan KM</button>
          <button onClick={() => { setMembers(null); setChoice(''); }} className={btnGhost} aria-label="Batal"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </li>
  );
}

function AdminConsole() {
  const [pending, setPending] = useState<PendingClass[] | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaders, setLeaders] = useState<Map<string, ProfileSummary>>(new Map());
  const [newHoliday, setNewHoliday] = useState({ date: todayLocalISO(), description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([repo.listPendingClasses(), repo.fetchAllClasses(), repo.fetchHolidays(), repo.fetchClassLeaders()]).then(
        ([p, c, h, l]) => {
          setPending(p);
          setClasses(c.filter((x) => x.status === 'active'));
          setHolidays(h);
          setLeaders(new Map(l.map((x) => [x.class_id!, x])));
        },
        (err) => {
          toast.error(errorText(err));
          setPending([]);
        }
      ),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!pending) return <PageLoader />;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const today = todayLocalISO();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <PageHeader icon={Crown} eyebrow="Superadmin" title="Admin Platform" description="Setujui kelas baru, atur KM tiap kelas, dan kelola hari libur (pengingat otomatis dilewati pada hari libur)." />

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">Pengajuan Kelas <Badge tone="amber">{pending.length}</Badge></h2>
        {pending.length === 0 ? (
          <Empty>Tidak ada pengajuan kelas.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {pending.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.program}{c.batch ? ` · ${c.batch}` : ''} · calon KM: {c.applicant_name ?? '—'} <span className="font-mono">({c.applicant_nim ?? '-'})</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => act(() => repo.approveClass(c.id), `Kelas ${c.name} aktif.`)} className={btnPrimary}>
                    <Check className="w-3.5 h-3.5" /> ACC
                  </button>
                  <button disabled={busy} onClick={() => window.confirm(`Tolak kelas ${c.name}? Akun pengaju ikut dihapus.`) && act(() => repo.rejectClass(c.id), 'Pengajuan ditolak.')} className={btnDanger}>
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">Kelas Aktif <Badge>{classes.length}</Badge></h2>
        <p className="text-[11px] text-slate-500">Ganti KM bila KM lulus / berhalangan. KM lama otomatis menjadi Sipen; status superadmin tidak ikut berubah.</p>
        <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
          {classes.map((c) => <ClassLeaderRow key={c.id} klass={c} leader={leaders.get(c.id)} onChanged={load} />)}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Hari Libur</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => repo.addHoliday(newHoliday.date, newHoliday.description), 'Hari libur ditambahkan.').then(() =>
              setNewHoliday((h) => ({ ...h, description: '' }))
            );
          }}
        >
          <input type="date" className={`${inputCls} !w-40`} value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} required />
          <input className={`${inputCls} flex-1 min-w-[12rem]`} placeholder="Keterangan, mis. Maulid Nabi" value={newHoliday.description}
            onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })} required minLength={2} />
          <button disabled={busy} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Tambah</button>
        </form>
        {holidays.length === 0 ? (
          <Empty>Belum ada hari libur.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {holidays.map((h) => (
              <li key={h.date} className={`py-2 flex items-center justify-between gap-3 ${h.date < today ? 'opacity-50' : ''}`}>
                <span className="text-xs text-slate-900 dark:text-white"><span className="font-mono text-slate-500 mr-2">{h.date}</span>{h.description}</span>
                <button disabled={busy} onClick={() => act(() => repo.deleteHoliday(h.date), 'Hari libur dihapus.')} className={`${btnGhost} !px-2 !py-1`} aria-label={`Hapus libur ${h.date}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function SuperadminPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole roles={['admin']}>
        <AdminConsole />
      </RequireRole>
    </div>
  );
}
