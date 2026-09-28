'use client';

import React, { useEffect, useId, useState } from 'react';
import { BellRing, Loader2, Plus, Save, X } from 'lucide-react';
import * as repo from '@/lib/data/supabaseRepository';
import { toast } from '@/store/useToastStore';
import { DAY_NAMES_MON_FIRST, currentSemester } from '@/lib/date';
import { Card, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { Course, Lecturer, ProfileSummary, WaGroup } from '@/types/database';

interface CourseFormProps {
  classId: string;
  course: Course | null; // null = baru
  lecturers: Lecturer[];
  sipenMembers: ProfileSummary[];
  assignedSipen: string[];
  canAssignSipen: boolean;
  /** Jam operasional kirim kelas (SiPenDosa). */
  sendWindow: { start: string; end: string };
  onLecturersChanged: () => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export function CourseForm({
  classId,
  course,
  lecturers,
  sipenMembers,
  assignedSipen,
  canAssignSipen,
  sendWindow,
  onLecturersChanged,
  onSaved,
  onCancel,
}: CourseFormProps) {
  const [form, setForm] = useState({
    code: course?.code ?? '',
    name: course?.name ?? '',
    day_of_week: course?.day_of_week ?? 'Senin',
    start_time: hhmm(course?.start_time) || '08:00',
    end_time: hhmm(course?.end_time) || '09:40',
    room: course?.room ?? '',
    semester: course?.semester ?? currentSemester(),
    lecturer_id: course?.lecturer_id ?? '',
    reminder_enabled: course?.reminder_enabled ?? false,
    reminder_mode: course?.reminder_mode ?? 'H-1',
    reminder_time: hhmm(course?.reminder_time) || '08:00',
    reminder_target: course?.reminder_target ?? '',
    link_group: course?.link_group ?? '',
  });
  const [sipen, setSipen] = useState<string[]>(assignedSipen);
  const [newLecturer, setNewLecturer] = useState<{ name: string; phone: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const uid = useId();

  // Grup yang diikuti nomor WA kelas (disinkron worker) untuk dipilih sebagai tujuan
  useEffect(() => {
    repo.fetchWaGroups().then(setGroups, () => setGroups([]));
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const addLecturer = async () => {
    if (!newLecturer) return;
    try {
      const id = await repo.saveLecturer(null, newLecturer.name, newLecturer.phone, '');
      await onLecturersChanged();
      set('lecturer_id', id);
      setNewLecturer(null);
      toast.success('Dosen tersimpan. Bila nomornya sudah terdaftar, data dosen yang ada dipakai.');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.semester.trim()) {
      toast.error('Kode, nama mata kuliah, dan semester wajib diisi.');
      return;
    }
    if (!form.start_time || !form.end_time) {
      toast.error('Jam mulai dan jam selesai wajib diisi.');
      return;
    }
    if (form.reminder_enabled && !form.reminder_time) {
      toast.error('Jam kirim pengingat wajib diisi.');
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error('Jam selesai harus setelah jam mulai.');
      return;
    }
    if (form.reminder_enabled && !form.lecturer_id && !form.reminder_target.trim()) {
      toast.error('Pengingat aktif butuh dosen (nomor WA) atau nomor/grup tujuan.');
      return;
    }
    setSaving(true);
    try {
      const saved = await repo.saveCourse(classId, course?.id ?? null, {
        code: form.code.trim(),
        name: form.name.trim(),
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
        semester: form.semester.trim(),
        lecturer_id: form.lecturer_id || null,
        reminder_enabled: form.reminder_enabled,
        reminder_mode: form.reminder_mode,
        reminder_time: form.reminder_time,
        reminder_target: form.reminder_target.trim() || null,
        link_group: form.link_group.trim() || null,
      });
      if (canAssignSipen && sipen.join() !== assignedSipen.join()) await repo.setCourseSipen(saved.id, sipen);
      toast.success(course ? 'Mata kuliah diperbarui.' : 'Mata kuliah ditambahkan.');
      onSaved();
    } catch (err) {
      const msg = errorText(err);
      toast.error(/courses_class_code_key|duplicate/.test(msg) ? 'Kode mata kuliah sudah dipakai di kelas ini.' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {course ? `Ubah ${course.code}` : 'Tambah Mata Kuliah'}
          </h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <label className="sm:col-span-2 block">
            <span className={labelCls}>Kode</span>
            <input className={`${inputCls} font-mono`} value={form.code} maxLength={20} onChange={(e) => set('code', e.target.value)} placeholder="TI-401" />
          </label>
          <label className="sm:col-span-4 block">
            <span className={labelCls}>Nama Mata Kuliah</span>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Cloud Computing" />
          </label>
          <label className="sm:col-span-2 block">
            <span className={labelCls}>Hari</span>
            <select className={inputCls} value={form.day_of_week} onChange={(e) => set('day_of_week', e.target.value)}>
              {DAY_NAMES_MON_FIRST.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Mulai</span>
            <input type="time" className={inputCls} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Selesai</span>
            <input type="time" className={inputCls} value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
          </label>
          <label className="sm:col-span-2 block">
            <span className={labelCls}>Ruang</span>
            <input className={inputCls} value={form.room} maxLength={50} onChange={(e) => set('room', e.target.value)} placeholder="Lab Komputer 3" />
          </label>
          <label className="sm:col-span-2 block">
            <span className={labelCls}>Semester</span>
            <input className={`${inputCls} font-mono`} value={form.semester} maxLength={20} onChange={(e) => set('semester', e.target.value)} placeholder={currentSemester()} />
          </label>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-dosen`} className={labelCls}>Dosen Pengampu</label>
            <select id={`${uid}-dosen`} className={inputCls} value={form.lecturer_id} onChange={(e) => set('lecturer_id', e.target.value)}>
              <option value="">— Belum dipilih —</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
            {course?.lecturer_name && !course.lecturer_id && (
              <p className="text-[11px] text-slate-500 mt-1">Data lama: {course.lecturer_name}</p>
            )}
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button type="button" onClick={() => setNewLecturer({ name: '', phone: '' })} className={`${btnGhost} w-full`}>
              <Plus className="w-3.5 h-3.5" /> Dosen baru
            </button>
          </div>
        </div>

        {newLecturer && (
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
            <div className="sm:col-span-3">
              <label htmlFor={`${uid}-ndosen`} className={labelCls}>Nama & gelar dosen</label>
              <input id={`${uid}-ndosen`} className={inputCls} value={newLecturer.name} onChange={(e) => setNewLecturer({ ...newLecturer, name: e.target.value })} placeholder="Dr. Hendra Gunawan, M.T." />
            </div>
            <label className="sm:col-span-2 block">
              <span className={labelCls}>No. WhatsApp</span>
              <input className={`${inputCls} font-mono`} inputMode="tel" value={newLecturer.phone} onChange={(e) => setNewLecturer({ ...newLecturer, phone: e.target.value })} placeholder="0812..." />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={addLecturer} className={`${btnPrimary} flex-1`}>Simpan</button>
              <button type="button" onClick={() => setNewLecturer(null)} className={btnGhost} aria-label="Batal"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        <div className="space-y-3 p-4 rounded-xl border border-slate-200/80 dark:border-white/10">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer">
            <input type="checkbox" checked={form.reminder_enabled} onChange={(e) => set('reminder_enabled', e.target.checked)} className="accent-blue-600" />
            <BellRing className="w-3.5 h-3.5 text-amber-500" /> Pengingat WhatsApp otomatis ke dosen
          </label>
          {form.reminder_enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <label className="sm:col-span-2 block">
                <span className={labelCls}>Kapan</span>
                <select className={inputCls} value={form.reminder_mode} onChange={(e) => set('reminder_mode', e.target.value as 'H-1' | 'H-0')}>
                  <option value="H-1">H-1 (sehari sebelum)</option>
                  <option value="H-0">H-0 (hari kuliah)</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Jam kirim</span>
                <input type="time" className={inputCls} value={form.reminder_time} onChange={(e) => set('reminder_time', e.target.value)} />
              </label>
              <div className="sm:col-span-3">
                <label htmlFor={`${uid}-target`} className={labelCls}>Tujuan lain (opsional)</label>
                <input id={`${uid}-target`} className={`${inputCls} font-mono`} list="wa-groups" value={form.reminder_target} onChange={(e) => set('reminder_target', e.target.value)}
                  placeholder={groups.length ? 'Kosong = WA dosen · pilih grup / 08xx' : 'Kosong = WA dosen · atau 08xx / ID grup'} />
                <datalist id="wa-groups">
                  {groups.map((g) => <option key={g.jid} value={g.jid} label={`👥 ${g.name} (${g.participants})`} />)}
                </datalist>
              </div>
              {(hhmm(form.reminder_time) < hhmm(sendWindow.start) || hhmm(form.reminder_time) > hhmm(sendWindow.end)) && (
                <p className="sm:col-span-6 text-[11px] text-amber-700 dark:text-amber-400">
                  {hhmm(form.reminder_time) > hhmm(sendWindow.end)
                    ? `Jam kirim di luar jam operasional kelas (${hhmm(sendWindow.start)}–${hhmm(sendWindow.end)}): pengingat tidak akan terkirim. Ubah di menu WhatsApp.`
                    : `Dikirim mulai ${hhmm(sendWindow.start)} (awal jam operasional kelas).`}
                </p>
              )}
              <div className="sm:col-span-6">
                <label htmlFor={`${uid}-link`} className={labelCls}>Tautan grup / kelas online (opsional)</label>
                <input id={`${uid}-link`} className={inputCls} value={form.link_group} onChange={(e) => set('link_group', e.target.value)} placeholder="https://chat.whatsapp.com/... atau Zoom" />
              </div>
            </div>
          )}
        </div>

        {canAssignSipen && sipenMembers.length > 0 && (
          <div>
            <span id={`${uid}-sipen`} className={labelCls}>Sipen pengelola (verifikasi izin mata kuliah ini)</span>
            <div role="group" aria-labelledby={`${uid}-sipen`} className="flex flex-wrap gap-2">
              {sipenMembers.map((s) => (
                <label key={s.id} className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                  sipen.includes(s.id) ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'border-slate-300/80 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                  <input type="checkbox" className="sr-only" checked={sipen.includes(s.id)}
                    onChange={(e) => setSipen((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                  {s.full_name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
          </button>
        </div>
      </form>
    </Card>
  );
}
