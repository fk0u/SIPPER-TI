'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CalendarDays, Clock, MapPin, Pencil, Plus, Send, Trash2, User } from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { CourseForm } from '@/components/schedule/CourseForm';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { DAY_NAMES_MON_FIRST, dayNameID } from '@/lib/date';
import { isKM, isSupervisor } from '@/lib/permissions';
import { Badge, Card, Empty, PageHeader, btnGhost, btnPrimary, errorText } from '@/components/ui/kit';
import type { Course, Lecturer } from '@/types/database';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '--:--');

function Schedule() {
  const { user, klass, profiles } = useAuthStore();
  const { courses, courseSipen, isLoaded, load } = useLeaveStore();
  const staff = isSupervisor(user);
  const km = isKM(user);

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadLecturers = useCallback(
    async () =>
      staff
        ? repo.getClassLecturers().then(setLecturers, (err) => toast.error(errorText(err, 'Gagal memuat daftar dosen.')))
        : undefined,
    [staff]
  );

  useEffect(() => {
    loadLecturers();
  }, [loadLecturers]);

  if (!isLoaded || !klass) return <PageLoader label="Memuat jadwal..." />;

  const today = dayNameID();
  const sipenMembers = profiles.filter((p) => p.status === 'active' && p.role === 'sipen');
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const sipenOf = (courseId: string) => courseSipen.filter((cs) => cs.course_id === courseId).map((cs) => cs.user_id);
  const unscheduled = courses.filter((c) => !c.day_of_week || !DAY_NAMES_MON_FIRST.includes(c.day_of_week as never));

  const remove = async (c: Course) => {
    if (!window.confirm(`Hapus ${c.code} — ${c.name}? Semua izin pada mata kuliah ini ikut terhapus.`)) return;
    setBusyId(c.id);
    try {
      await repo.deleteCourse(c.id);
      await load();
      toast.success('Mata kuliah dihapus.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const remindNow = async (c: Course) => {
    setBusyId(c.id);
    try {
      await repo.queueReminderNow(c.id);
      toast.success(`Pengingat ${c.code} masuk antrean WhatsApp.`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const renderCourse = (c: Course) => {
    const sipenNames = sipenOf(c.id).map((id) => nameById.get(id)).filter(Boolean);
    return (
      <div key={c.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{c.code}</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">{c.name}</p>
          </div>
          {c.reminder_enabled && (
            <Badge tone="amber"><BellRing className="w-3 h-3" />{c.reminder_mode} {hhmm(c.reminder_time)}</Badge>
          )}
        </div>
        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {hhmm(c.start_time)} – {hhmm(c.end_time)} WITA</p>
          {c.room && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {c.room}</p>}
          <p className="flex items-center gap-1.5"><User className="w-3 h-3" /> {c.lecturer?.full_name ?? c.lecturer_name ?? 'Dosen belum diisi'}</p>
          {sipenNames.length > 0 && <p className="text-[10px]">Sipen: {sipenNames.join(', ')}</p>}
        </div>
        {staff && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={() => setEditing(c)} className={`${btnGhost} !px-2.5 !py-1.5`}><Pencil className="w-3 h-3" /> Ubah</button>
            <button disabled={busyId === c.id} onClick={() => remindNow(c)} className={`${btnGhost} !px-2.5 !py-1.5`} title="Kirim pengingat pertemuan berikutnya sekarang">
              <Send className="w-3 h-3" /> Ingatkan
            </button>
            <button disabled={busyId === c.id} onClick={() => remove(c)} className={`${btnGhost} !px-2.5 !py-1.5 !text-rose-600`} aria-label={`Hapus ${c.code}`}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        icon={CalendarDays}
        eyebrow={klass.name}
        title="Jadwal Kuliah"
        description={
          staff
            ? 'Kelola mata kuliah, dosen, dan pengingat WhatsApp. Pengingat otomatis dikirim dari nomor WhatsApp kelas (menu WhatsApp).'
            : 'Jadwal perkuliahan kelasmu minggu ini.'
        }
        actions={staff && editing === null ? (
          <button onClick={() => setEditing('new')} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Mata Kuliah</button>
        ) : undefined}
      />

      {editing !== null && (
        <CourseForm
          key={editing === 'new' ? 'new' : editing.id}
          classId={klass.id}
          course={editing === 'new' ? null : editing}
          lecturers={lecturers}
          sipenMembers={sipenMembers}
          assignedSipen={editing === 'new' ? [] : sipenOf(editing.id)}
          canAssignSipen={km}
          onLecturersChanged={loadLecturers}
          onSaved={() => {
            setEditing(null);
            void load();
            void loadLecturers();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {courses.length === 0 ? (
        <Card><Empty>{staff ? 'Belum ada mata kuliah. Tambahkan jadwal pertama kelasmu.' : 'Jadwal belum diisi Sipen / KM.'}</Empty></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAY_NAMES_MON_FIRST.map((day) => {
            const list = courses
              .filter((c) => c.day_of_week === day)
              .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
            if (list.length === 0 && (day === 'Sabtu' || day === 'Minggu')) return null;
            return (
              <Card key={day} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  {day} {day === today && <Badge tone="blue">Hari ini</Badge>}
                </h2>
                {list.length === 0 ? <p className="text-[11px] text-slate-400">Tidak ada kuliah.</p> : list.map(renderCourse)}
              </Card>
            );
          })}
          {unscheduled.length > 0 && (
            <Card className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Belum dijadwalkan</h2>
              {unscheduled.map(renderCourse)}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole>
        <Schedule />
      </RequireRole>
    </div>
  );
}
