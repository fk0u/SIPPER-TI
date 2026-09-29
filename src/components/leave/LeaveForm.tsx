'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import type { Course, LeaveType } from '@/types/database';
import { diffDaysInclusive, parseISODate, todayLocalISO, toLocalISODate } from '@/lib/date';
import { formatFileSize, validateAttachmentFiles } from '@/lib/attachments';
import { canUseProxy as canUseProxyFor, isSipenOf } from '@/lib/permissions';
import { LEAVE_TYPES, LEAVE_TYPE_META } from '@/lib/leaveTypes';
import { MAX_LEAVE_DAYS, affectedCourses, lectureDays, type HourRange } from '@/lib/leavePlan';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Send,
  UploadCloud,
  User,
  Users,
  X,
} from 'lucide-react';

type StepKey = 'who' | 'when' | 'schedule' | 'detail' | 'review';
const STEP_META: Record<StepKey, { title: string; hint: string }> = {
  who: { title: 'Untuk siapa?', hint: 'Diri sendiri atau mewakili teman' },
  when: { title: 'Berapa lama?', hint: 'Dari tanggal berapa sampai kapan' },
  schedule: { title: 'Jadwal terdampak', hint: 'Sehari penuh / jam tertentu & matkul' },
  detail: { title: 'Alasan & bukti', hint: 'Kategori, keterangan, lampiran' },
  review: { title: 'Tinjau & kirim', hint: 'Periksa sebelum dikirim' },
};

const hm = (t: string | null) => (t ? t.slice(0, 5) : '--:--');
const fmtDay = (iso: string) =>
  parseISODate(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
const addDays = (iso: string, n: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
};
const courseLabel = (c: Course) => `${c.code} — ${c.name}`;

const choiceCls = (active: boolean) =>
  `w-full text-left p-4 rounded-xl border transition active:scale-[0.99] ${
    active
      ? 'bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/30'
      : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:border-blue-400/60'
  }`;
const fieldCls =
  'w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500';

export const LeaveForm: React.FC = () => {
  const router = useRouter();
  const { user, profiles } = useAuthStore();
  const { courses, courseSipen, holidays, submitLeave, isLoaded, loadError, load } = useLeaveStore();

  const canUseProxy = canUseProxyFor(user);
  const steps: StepKey[] = canUseProxy
    ? ['who', 'when', 'schedule', 'detail', 'review']
    : ['when', 'schedule', 'detail', 'review'];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  // 1. Untuk siapa
  const [isProxy, setIsProxy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  // 2. Tanggal
  const today = todayLocalISO();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  // 3. Jam & matkul
  const [partial, setPartial] = useState(false);
  const [hourStart, setHourStart] = useState('');
  const [hourEnd, setHourEnd] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [unscheduledPicked, setUnscheduledPicked] = useState<Set<string>>(new Set());
  // 4. Detail
  const [leaveType, setLeaveType] = useState<LeaveType>('sakit');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  // Kirim
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);


  // Mewakili: KM semua matkul, Sipen hanya matkul yang dikelolanya
  const availableStudents = profiles.filter((p) => p.id !== user?.id && p.status === 'active');
  const allowedCourses = isProxy && user?.role !== 'km'
    ? courses.filter((c) => isSipenOf(user, c.id, courseSipen))
    : courses;
  const scheduled = allowedCourses.filter((c) => c.day_of_week);
  const unscheduled = allowedCourses.filter((c) => !c.day_of_week);

  const singleDay = startDate === endDate;
  const rangeDays = diffDaysInclusive(startDate, endDate);
  const fullDays = lectureDays(scheduled, holidays, startDate, endDate);
  // Izin per jam hanya untuk satu hari yang memang ada kuliahnya
  const usePartial = partial && singleDay && fullDays.length > 0;
  const hours: HourRange | null =
    usePartial && hourStart && hourEnd && hourStart < hourEnd ? { start: hourStart, end: hourEnd } : null;
  const days = hours ? lectureDays(scheduled, holidays, startDate, endDate, hours) : fullDays;
  const affected = affectedCourses(days);
  const selectedIds = [
    ...affected.filter((a) => !excluded.has(a.course.id)).map((a) => a.course.id),
    ...unscheduled.filter((c) => unscheduledPicked.has(c.id)).map((c) => c.id),
  ];
  const selectedDays = new Set(
    affected.filter((a) => !excluded.has(a.course.id)).flatMap((a) => a.dates)
  ).size;
  const totalMeetings = affected
    .filter((a) => !excluded.has(a.course.id))
    .reduce((n, a) => n + a.dates.length, 0);
  const skippedHolidays = holidays.filter((h) => h >= startDate && h <= endDate).length;
  const student = isProxy ? availableStudents.find((p) => p.id === studentId) : user;

  const stepError = (key: StepKey): string | null => {
    switch (key) {
      case 'who':
        if (!isProxy) return null;
        if (availableStudents.length === 0) return 'Belum ada anggota aktif lain di kelas ini.';
        if (!availableStudents.some((p) => p.id === studentId)) return 'Pilih mahasiswa yang diwakili.';
        if (allowedCourses.length === 0) return 'Anda belum mengelola mata kuliah apa pun untuk mewakili izin.';
        return null;
      case 'when':
        if (!startDate || !endDate) return 'Isi tanggal mulai dan selesai.';
        if (endDate < startDate) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
        if (rangeDays > MAX_LEAVE_DAYS) return `Rentang izin maksimal ${MAX_LEAVE_DAYS} hari.`;
        if (fullDays.length === 0 && unscheduled.length === 0)
          return 'Tidak ada jadwal kuliah pada rentang ini (akhir pekan / libur tidak dihitung).';
        return null;
      case 'schedule':
        if (usePartial) {
          if (!hourStart || !hourEnd) return 'Isi jam mulai dan jam selesai izin.';
          if (hourStart >= hourEnd) return 'Jam selesai harus setelah jam mulai.';
          if (affected.length === 0 && unscheduledPicked.size === 0)
            return 'Jam tersebut tidak beririsan dengan jadwal kuliah mana pun.';
        }
        if (selectedIds.length === 0) return 'Pilih minimal satu mata kuliah yang terdampak.';
        return null;
      case 'detail':
        if (!reason.trim()) return 'Keterangan / alasan izin wajib diisi.';
        if (files.length === 0 && LEAVE_TYPE_META[leaveType].requiresAttachment)
          return LEAVE_TYPE_META[leaveType].attachmentHint;
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = stepError(step);
    setErrorMessage(err);
    if (!err) setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const goTo = (i: number) => {
    // Lompat maju hanya bila langkah sebelumnya valid
    const blocked = steps.slice(0, i).find((k) => stepError(k));
    if (i > stepIndex && blocked) {
      setErrorMessage(stepError(blocked));
      return;
    }
    setErrorMessage(null);
    setStepIndex(i);
  };

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    const { valid, errors } = validateAttachmentFiles(Array.from(picked));
    setFileErrors(errors);
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!user) return;
    const blocked = steps.find((k) => stepError(k));
    if (blocked) {
      setErrorMessage(stepError(blocked));
      setStepIndex(steps.indexOf(blocked));
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await submitLeave({
      student_id: isProxy ? studentId : user.id,
      course_ids: selectedIds,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      start_time: hours?.start ?? null,
      end_time: hours?.end ?? null,
      reason: reason.trim(),
      files,
      created_by: user.id,
    });
    setIsSubmitting(false);
    if (!result.success) {
      setErrorMessage(result.error || 'Terjadi kesalahan saat mengirim pengajuan.');
      toast.error(result.error || 'Terjadi kesalahan saat mengirim pengajuan.');
      return;
    }
    setIsSuccess(true);
    toast.success(`Pengajuan izin untuk ${selectedIds.length} mata kuliah terkirim!`);
    setTimeout(() => router.push('/'), 1000);
  };

  // Matkul pada hari izin (untuk pilihan jam cepat)
  const dayCourses = singleDay ? fullDays[0]?.courses ?? [] : [];

  // Hitung hari kuliah butuh jadwal & libur yang lengkap: jangan tampilkan wizard bila gagal dimuat
  if (!isLoaded || loadError) {
    return (
      <div role={loadError ? 'alert' : 'status'} className="max-w-md mx-auto p-5 rounded-2xl border border-slate-200 dark:border-white/10 text-center space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>{loadError ? 'Jadwal atau hari libur gagal dimuat, jadi hari izin belum bisa dihitung.' : 'Memuat jadwal & hari libur…'}</p>
        {loadError && (
          <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold">
            Coba lagi
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl mx-auto">
      {/* Stepper */}
      <div className="lg:col-span-4">
        <div className="doppelrand-shell lg:sticky lg:top-4">
          <div className="doppelrand-core p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400 font-semibold">
                Langkah {stepIndex + 1} dari {steps.length}
              </span>
            </div>
            <ol className="flex lg:flex-col gap-2 overflow-x-auto">
              {steps.map((key, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <li key={key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      className={`flex items-center gap-3 w-full text-left p-2 rounded-xl transition ${
                        active ? 'bg-blue-600/10' : 'hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          done
                            ? 'bg-emerald-500 text-white'
                            : active
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                        }`}
                      >
                        {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <span className="hidden sm:block">
                        <span className="block text-xs font-semibold text-slate-900 dark:text-white">{STEP_META[key].title}</span>
                        <span className="block text-[10px] text-slate-500">{STEP_META[key].hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Ringkasan berjalan */}
            <div className="hidden lg:block pt-3 border-t border-slate-200/80 dark:border-white/5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <p className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> {student ? `${student.full_name}` : '—'}</p>
              <p className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> {fullDays.length} hari kuliah · {totalMeetings} pertemuan
              </p>
              {hours && <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {hours.start}–{hours.end} WITA</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Isi langkah */}
      <div className="lg:col-span-8">
        <div className="doppelrand-shell">
          <div className="doppelrand-core p-5 sm:p-7 space-y-6">
            <div className="border-b border-slate-200/80 dark:border-white/5 pb-4">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {STEP_META[step].title}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{STEP_META[step].hint}</p>
            </div>

            {isSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <span>Pengajuan berhasil dikirim! Mengalihkan ke beranda...</span>
              </div>
            )}
            {errorMessage && (
              <div role="alert" className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {step === 'who' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" className={choiceCls(!isProxy)} onClick={() => { setIsProxy(false); setExcluded(new Set()); }}>
                    <User className="w-5 h-5 text-blue-600 mb-2" />
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">Untuk diri sendiri</span>
                    <span className="block text-[11px] text-slate-500">Saya yang berhalangan hadir</span>
                  </button>
                  <button type="button" className={choiceCls(isProxy)} onClick={() => { setIsProxy(true); setExcluded(new Set()); }}>
                    <Users className="w-5 h-5 text-purple-600 mb-2" />
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">Mewakili teman</span>
                    <span className="block text-[11px] text-slate-500">
                      {user?.role === 'km' ? 'Semua mata kuliah kelas' : 'Hanya mata kuliah yang Anda kelola'}
                    </span>
                  </button>
                </div>
                {isProxy && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        value={studentQuery}
                        onChange={(e) => setStudentQuery(e.target.value)}
                        placeholder="Cari nama / NIM"
                        className={`${fieldCls} pl-8`}
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {availableStudents
                        .filter((p) => {
                          const q = studentQuery.trim().toLowerCase();
                          return !q || p.full_name.toLowerCase().includes(q) || p.nim.includes(q);
                        })
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setStudentId(p.id)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                              studentId === p.id
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-slate-200/80 dark:border-white/10 hover:border-purple-400/60'
                            }`}
                          >
                            <span className="text-slate-900 dark:text-white font-medium">{p.full_name}</span>
                            <span className="font-mono text-[10px] text-slate-500">{p.nim}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'when' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Hari ini', today, today],
                    ['Besok', addDays(today, 1), addDays(today, 1)],
                    ['3 hari', today, addDays(today, 2)],
                    ['Seminggu', today, addDays(today, 6)],
                  ].map(([label, s, e]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setStartDate(s); setEndDate(e); setExcluded(new Set()); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        startDate === s && endDate === e
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'border-slate-300/80 dark:border-white/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-semibold">Dari tanggal</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (e.target.value > endDate) setEndDate(e.target.value);
                        setExcluded(new Set());
                      }}
                      className={`${fieldCls} font-mono`}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-semibold">Sampai tanggal</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => { setEndDate(e.target.value); setExcluded(new Set()); }}
                      className={`${fieldCls} font-mono`}
                    />
                  </label>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold">{fullDays.length} hari kuliah</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      dari {Math.max(rangeDays, 0)} hari kalender
                      {skippedHolidays > 0 && ` · ${skippedHolidays} hari libur dilewati`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hanya hari yang ada jadwal kuliah yang dihitung — Sabtu/Minggu atau hari tanpa matkul tidak masuk hitungan.
                  </p>
                  {fullDays.length > 0 && (
                    <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                      {fullDays.map((d) => (
                        <li key={d.date} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white w-36 shrink-0">{fmtDay(d.date)}</span>
                          {d.courses.map((c) => (
                            <span key={c.id} className="px-2 py-0.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-600 dark:text-slate-300">
                              {c.code} {hm(c.start_time)}–{hm(c.end_time)}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {step === 'schedule' && (
              <div className="space-y-5">
                {singleDay && fullDays.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Izin {fmtDay(startDate)} — sehari penuh atau jam tertentu?
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button type="button" className={choiceCls(!partial)} onClick={() => setPartial(false)}>
                        <CalendarDays className="w-5 h-5 text-blue-600 mb-2" />
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">Sehari penuh</span>
                        <span className="block text-[11px] text-slate-500">Semua matkul hari itu</span>
                      </button>
                      <button type="button" className={choiceCls(partial)} onClick={() => setPartial(true)}>
                        <Clock className="w-5 h-5 text-amber-600 mb-2" />
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">Jam tertentu</span>
                        <span className="block text-[11px] text-slate-500">Mis. kuliah 10:00–13:00, izin 10:00–11:00</span>
                      </button>
                    </div>
                    {partial && (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <span className="text-[11px] text-slate-500 font-semibold">Jam mulai</span>
                            <input type="time" value={hourStart} onChange={(e) => setHourStart(e.target.value)} className={`${fieldCls} font-mono`} />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] text-slate-500 font-semibold">Jam selesai</span>
                            <input type="time" value={hourEnd} onChange={(e) => setHourEnd(e.target.value)} className={`${fieldCls} font-mono`} />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dayCourses.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setHourStart(hm(c.start_time)); setHourEnd(hm(c.end_time)); }}
                              className="px-2.5 py-1 rounded-lg text-[11px] border border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                            >
                              {c.code} {hm(c.start_time)}–{hm(c.end_time)}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500">Ketuk matkul untuk mengisi jamnya, lalu sesuaikan bila hanya sebagian.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mata kuliah yang terdampak ({selectedIds.length} dipilih · {totalMeetings} pertemuan)
                  </p>
                  {affected.length === 0 && (
                    <p className="text-xs text-slate-500">Tidak ada matkul terjadwal yang terkena rentang ini.</p>
                  )}
                  {affected.map(({ course, dates }) => {
                    const on = !excluded.has(course.id);
                    return (
                      <label
                        key={course.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                          on ? 'border-blue-500/60 bg-blue-500/5' : 'border-slate-200/80 dark:border-white/10 opacity-70'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => setExcluded((s) => toggle(s, course.id))} className="mt-0.5" />
                        <span className="flex-1">
                          <span className="block text-xs font-semibold text-slate-900 dark:text-white">{courseLabel(course)}</span>
                          <span className="block text-[11px] text-slate-500">
                            {course.day_of_week} {hm(course.start_time)}–{hm(course.end_time)}
                            {(course.lecturer?.full_name || course.lecturer_name) && ` · ${course.lecturer?.full_name ?? course.lecturer_name}`}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {dates.length}× pertemuan
                        </span>
                      </label>
                    );
                  })}
                  {unscheduled.length > 0 && (
                    <details className="pt-2">
                      <summary className="text-[11px] text-slate-500 cursor-pointer">Matkul belum terjadwal ({unscheduled.length})</summary>
                      <div className="space-y-1.5 mt-2">
                        {unscheduled.map((c) => (
                          <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs cursor-pointer">
                            <input type="checkbox" checked={unscheduledPicked.has(c.id)} onChange={() => setUnscheduledPicked((s) => toggle(s, c.id))} />
                            <span className="text-slate-900 dark:text-white">{courseLabel(c)}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}

            {step === 'detail' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Kategori izin</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {LEAVE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLeaveType(type)}
                        className={`py-3 px-3 rounded-xl text-xs font-medium transition-all active:scale-95 flex flex-col items-center gap-1 border ${
                          leaveType === type
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md font-semibold'
                            : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-white/5'
                        }`}
                      >
                        <span className="text-base">{LEAVE_TYPE_META[type].emoji}</span>
                        <span className="text-[11px]">{LEAVE_TYPE_META[type].label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="space-y-1.5 block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Keterangan / alasan</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Jelaskan alasan izin (mis. diagnosis dokter, agenda tugas)…"
                    className={`${fieldCls} leading-relaxed`}
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Lampiran bukti (surat dokter / surat tugas)</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {LEAVE_TYPE_META[leaveType].requiresAttachment ? 'Wajib' : 'Opsional'} · Maks. 5MB
                    </span>
                  </span>
                  <div className="relative border-2 border-dashed border-slate-300/80 dark:border-white/10 hover:border-blue-500/50 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-black/20 cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      multiple
                      onChange={handleFileUpload}
                      aria-label="Pilih lampiran"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-900 dark:text-white">Pilih foto surat atau seret berkas ke sini</p>
                    <p className="text-[10px] text-slate-500 font-mono">JPG, PNG, WebP, PDF</p>
                  </div>
                  {fileErrors.map((err, i) => (
                    <p key={`${i}-${err}`} className="text-[11px] text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {err}
                    </p>
                  ))}
                  {files.map((f, idx) => (
                    <div key={`${f.name}-${f.size}-${idx}`} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/90 dark:bg-white/[0.04] rounded-xl text-xs">
                      <span className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate text-slate-800 dark:text-slate-200">{f.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(f.size)}</span>
                      </span>
                      <button type="button" onClick={() => setFiles((p) => p.filter((_, i) => i !== idx))} aria-label={`Hapus ${f.name}`} className="p-1 text-slate-400 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'review' && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  ['Mahasiswa', student ? `${student.full_name} (${student.nim})` : '—'],
                  ['Diajukan', isProxy ? `Mewakili, oleh ${user?.full_name}` : 'Diri sendiri'],
                  ['Tanggal', singleDay ? fmtDay(startDate) : `${fmtDay(startDate)} s/d ${fmtDay(endDate)}`],
                  ['Waktu', hours ? `${hours.start}–${hours.end} WITA` : 'Sehari penuh'],
                  ['Hari kuliah', `${selectedDays} hari · ${totalMeetings} pertemuan`],
                  ['Kategori', `${LEAVE_TYPE_META[leaveType].emoji} ${LEAVE_TYPE_META[leaveType].label}`],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5">
                    <dt className="text-[10px] uppercase font-mono text-slate-500">{k}</dt>
                    <dd className="text-slate-900 dark:text-white font-medium mt-0.5">{v}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5">
                  <dt className="text-[10px] uppercase font-mono text-slate-500">Mata kuliah ({selectedIds.length})</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {allowedCourses.filter((c) => selectedIds.includes(c.id)).map((c) => (
                      <span key={c.id} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px]">{courseLabel(c)}</span>
                    ))}
                  </dd>
                </div>
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5">
                  <dt className="text-[10px] uppercase font-mono text-slate-500">Alasan · {files.length} lampiran</dt>
                  <dd className="text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{reason}</dd>
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500">
                  Setiap mata kuliah diverifikasi oleh Sipen matkulnya masing-masing (atau KM).
                </p>
              </dl>
            )}

            {/* Navigasi */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-white/5">
              <button
                type="button"
                onClick={() => { setErrorMessage(null); setStepIndex((i) => Math.max(i - 1, 0)); }}
                disabled={stepIndex === 0 || isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </button>
              {step === 'review' ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isSuccess}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" /> {isSubmitting ? 'Mengirim…' : 'Kirim Pengajuan'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95"
                >
                  Lanjut <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
