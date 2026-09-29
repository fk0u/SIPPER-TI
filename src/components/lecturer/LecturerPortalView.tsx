'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  Clock,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  ListChecks,
  MapPin,
  Paperclip,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CountUp } from '@/components/reactbits/CountUp';
import { Badge, Card } from '@/components/ui/kit';
import { DAY_NAMES_MON_FIRST, dayNameWITA, nowTimeWITA, todayWITA } from '@/lib/date';
import { LEAVE_TYPES, LEAVE_TYPE_META } from '@/lib/leaveTypes';
import { lectureDays } from '@/lib/leavePlan';
import { filterPortalLeaves, filterQuery, leaveMeetings, leaveTimeLabel, type PortalFilter } from '@/lib/lecturerPortal';
import { formatFileSize } from '@/lib/attachments';
import type { Course, LecturerPortalResult, PortalCourse, PortalLeave } from '@/types/database';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '--:--');
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' });
const selectCls =
  'bg-white/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white';

type Tab = 'jadwal' | 'izin' | 'statistik';

function LeaveDetail({ leave, course, meetings, token, onClose }: {
  leave: PortalLeave;
  course: PortalCourse | undefined;
  meetings: number;
  token: string;
  onClose: () => void;
}) {
  const meta = LEAVE_TYPE_META[leave.leave_type];
  const base = `/dosen/${token}/lampiran/${leave.id}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detail izin">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{leave.student_name}</p>
            <p className="text-xs font-mono text-slate-500">NIM {leave.student_nim}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <dl className="grid grid-cols-2 gap-2.5 text-xs">
          {[
            ['Mata kuliah', course ? `${course.code} — ${course.name}` : '-'],
            ['Kelas', course?.class_name ?? '-'],
            ['Jenis', `${meta.emoji} ${meta.label}`],
            ['Tanggal', leave.start_date === leave.end_date ? fmtDate(leave.start_date) : `${fmtDate(leave.start_date)} – ${fmtDate(leave.end_date)}`],
            ['Waktu', leaveTimeLabel(leave) + (leave.start_time ? ' WITA' : '')],
            ['Pertemuan terdampak', `${meetings}×`],
            ['Diverifikasi', leave.verifier_name ? `${leave.verifier_name}${leave.verified_at ? ` · ${fmtDateTime(leave.verified_at)}` : ''}` : '-'],
            ['Diajukan', fmtDateTime(leave.created_at)],
          ].map(([k, v]) => (
            <div key={k} className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04]">
              <dt className="text-[10px] uppercase font-mono text-slate-500">{k}</dt>
              <dd className="text-slate-900 dark:text-white mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Alasan</p>
          <p className="text-xs text-slate-900 dark:text-white whitespace-pre-wrap p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04]">{leave.reason}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-mono text-slate-500">Lampiran ({leave.files.length})</p>
          {leave.files.length === 0 && <p className="text-xs text-slate-500">Tidak ada lampiran.</p>}
          {leave.files.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              {f.type.startsWith('image/') && (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL storage, bukan aset statis
                <img src={`${base}/${i}`} alt={f.name} className="w-full max-h-96 object-contain bg-slate-50 dark:bg-black/30" loading="lazy" />
              )}
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="flex items-center gap-2 truncate text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" /> <span className="truncate">{f.name}</span>
                  {f.size ? <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(f.size)}</span> : null}
                </span>
                <span className="flex gap-1.5 shrink-0">
                  <a href={`${base}/${i}`} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 text-[11px]">Buka</a>
                  <a href={`${base}/${i}?download=1`} className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] flex items-center gap-1"><Download className="w-3 h-3" /> Unduh</a>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LecturerPortalView({ portal, token }: { portal: LecturerPortalResult; token: string }) {
  const [tab, setTab] = useState<Tab>('izin');
  const [filter, setFilter] = useState<PortalFilter>({});
  const [openId, setOpenId] = useState<string | null>(null);

  if (portal.status !== 'ok') {
    const notFound = portal.status === 'not_found';
    const expired = portal.status === 'expired';
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {expired ? 'Tautan Dosen Sudah Kedaluwarsa' : notFound ? 'Tautan Dosen Tidak Valid' : 'Portal Sementara Tidak Dapat Dimuat'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {expired
              ? 'Tautan berlaku per semester. Minta tautan semester ini ke KM / Sipen kelas.'
              : notFound
              ? 'Tautan ini tidak terdaftar atau sudah diganti. Minta tautan terbaru ke KM / Sipen kelas.'
              : 'Terjadi gangguan layanan. Tautan Anda kemungkinan masih berlaku — muat ulang beberapa saat lagi.'}
          </p>
        </Card>
      </div>
    );
  }

  const { lecturer, courses, leaves, holidays } = portal;
  const holidayDates = holidays.map((h) => h.date);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const meetingsOf = (l: PortalLeave) => leaveMeetings(l, courseById.get(l.course_id), holidayDates);
  const classCount = new Set(courses.map((c) => c.class_name)).size;
  const todayName = dayNameWITA();
  const today = todayWITA();
  const holidaysSoon = holidays.filter((h) => h.date >= today && h.date < addDays(today, 120));

  const shown = filterPortalLeaves(leaves, filter);
  const opened = openId ? leaves.find((l) => l.id === openId) : undefined;
  const filtered = Object.values(filter).some(Boolean);
  const qs = filterQuery(filter);
  const exportBase = `/dosen/${token}/export`;
  const totalMeetings = leaves.reduce((n, l) => n + meetingsOf(l), 0);
  const studentsWithLeave = new Set(leaves.map((l) => l.student_nim)).size;

  // Pertemuan berikutnya per matkul + siapa yang sudah izin di tanggal itu
  const nextMeeting = (c: PortalCourse) => {
    // Pertemuan hari ini yang sudah selesai (jam WITA) bukan lagi "berikutnya"
    const nowWITA = nowTimeWITA();
    const date = lectureDays([c as unknown as Course], holidayDates, today, addDays(today, 27))
      .map((d) => d.date)
      .find((d) => d !== today || !c.end_time || c.end_time.slice(0, 5) > nowWITA);
    if (!date) return null;
    const absent = leaves.filter((l) => l.course_id === c.id && l.start_date <= date && l.end_date >= date);
    return { date, absent };
  };

  const set = (patch: Partial<PortalFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center print:hidden shadow-inner">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <Badge tone="emerald">Portal Dosen · tanpa login</Badge>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{lecturer.full_name}</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">Jadwal mengajar, rekap izin mahasiswa & surat lampiran</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ThemeToggle />
            <a href={`/dosen/${token}/calendar.ics`} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" /> Kalender
            </a>
            <button onClick={() => window.print()} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Printer className="w-4 h-4" /> Cetak
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ['Mata kuliah', courses.length],
            ['Kelas', classCount],
            ['Izin disetujui', leaves.length],
            ['Pertemuan izin', totalMeetings],
            ['Mahasiswa izin', studentsWithLeave],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">{label}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums"><CountUp to={Number(value)} /></span>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] w-fit print:hidden" role="tablist">
          {([
            ['izin', 'Rekap Izin', ListChecks],
            ['jadwal', 'Jadwal', CalendarDays],
            ['statistik', 'Statistik', BarChart3],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                tab === key ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'jadwal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Jadwal Mengajar Mingguan</h2>
            {courses.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada mata kuliah yang terhubung dengan nama Anda.</p>
            ) : (
              DAY_NAMES_MON_FIRST.map((day) => {
                const list = courses.filter((c) => c.day_of_week === day);
                if (list.length === 0) return null;
                return (
                  <div key={day} className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      {day} {day === todayName && <Badge tone="blue">Hari ini</Badge>}
                    </p>
                    {list.map((c) => {
                      const next = nextMeeting(c);
                      return (
                        <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{c.code}</span>{c.name}
                              </p>
                              <p className="text-[11px] text-slate-500">{c.class_name}{c.student_count ? ` · ${c.student_count} mahasiswa` : ''}</p>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 text-right">
                              <p className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {hhmm(c.start_time)}–{hhmm(c.end_time)} WITA</p>
                              {c.room && <p className="flex items-center gap-1 justify-end"><MapPin className="w-3 h-3" /> {c.room}</p>}
                            </div>
                          </div>
                          {next && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200/70 dark:border-white/5 pt-2">
                              Pertemuan berikutnya <strong className="text-slate-900 dark:text-white">{fmtDate(next.date)}</strong>
                              {next.absent.length === 0 ? (
                                ' · belum ada izin'
                              ) : (
                                <span className="flex flex-wrap gap-1.5 mt-1.5">
                                  {next.absent.map((l) => (
                                    <button key={l.id} onClick={() => setOpenId(l.id)} className={`px-2 py-0.5 rounded-md border text-[10px] ${LEAVE_TYPE_META[l.leave_type].badge}`}>
                                      {LEAVE_TYPE_META[l.leave_type].emoji} {l.student_name}{l.start_time ? ` (${leaveTimeLabel(l)})` : ''}
                                    </button>
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Libur Mendatang</h2>
            {holidaysSoon.length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada hari libur dalam 4 bulan ke depan.</p>
            ) : (
              <ul className="space-y-2">
                {holidaysSoon.map((h) => (
                  <li key={h.date} className="text-xs">
                    <span className="font-mono text-slate-500 block">{fmtDate(h.date)}</span>
                    <span className="text-slate-900 dark:text-white">{h.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'izin' && (
        <Card className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Rekap Izin Mahasiswa <span className="text-slate-400 font-normal">({shown.length}{filtered ? ` dari ${leaves.length}` : ''})</span>
            </h2>
            <div className="flex flex-wrap gap-2 print:hidden">
              <a href={`${exportBase}?${qs}${qs ? '&' : ''}format=xlsx`} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </a>
              <a href={`${exportBase}${qs ? `?${qs}` : ''}`} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1.5">
                <FileArchive className="w-3.5 h-3.5" /> Excel + Lampiran (ZIP)
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <select value={filter.courseId ?? ''} onChange={(e) => set({ courseId: e.target.value || undefined })} className={selectCls} aria-label="Filter mata kuliah">
              <option value="">Semua mata kuliah</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.class_name}</option>)}
            </select>
            <select value={filter.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })} className={selectCls} aria-label="Filter jenis izin">
              <option value="">Semua jenis</option>
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_META[t].label}</option>)}
            </select>
            <input type="date" aria-label="Dari tanggal" value={filter.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className={selectCls} />
            <input type="date" aria-label="Sampai tanggal" value={filter.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className={selectCls} />
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input value={filter.query ?? ''} onChange={(e) => set({ query: e.target.value || undefined })} placeholder="Nama / NIM" className={`${selectCls} pl-8 w-40`} />
            </div>
            {filtered && (
              <button onClick={() => setFilter({})} className="px-2.5 py-1.5 text-xs text-slate-500 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Reset</button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Tidak ada izin yang cocok.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Mahasiswa</th><th className="px-2 py-2">Mata kuliah</th><th className="px-2 py-2">Jenis</th>
                    <th className="px-2 py-2">Tanggal & waktu</th><th className="px-2 py-2">Alasan</th><th className="px-2 py-2 text-center">Lampiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                  {shown.map((l) => {
                    const c = courseById.get(l.course_id);
                    const meta = LEAVE_TYPE_META[l.leave_type];
                    return (
                      <tr key={l.id} onClick={() => setOpenId(l.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                        <td className="px-2 py-2 text-slate-900 dark:text-white">
                          {/* Tombol agar detail bisa dibuka dengan keyboard; klik baris tetap berfungsi */}
                          <button type="button" onClick={(e) => { e.stopPropagation(); setOpenId(l.id); }} className="text-left hover:underline focus-visible:underline">
                            {l.student_name}
                          </button>
                          <span className="block font-mono text-[10px] text-slate-500">{l.student_nim}</span>
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{c ? `${c.code} · ${c.class_name}` : '-'}</td>
                        <td className="px-2 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${meta.badge}`}>{meta.emoji} {meta.short}</span></td>
                        <td className="px-2 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {l.start_date}{l.end_date !== l.start_date ? ` → ${l.end_date}` : ''}
                          <span className="block text-slate-400">{leaveTimeLabel(l)} · {meetingsOf(l)}× pertemuan</span>
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400 max-w-[220px] truncate" title={l.reason}>{l.reason}</td>
                        <td className="px-2 py-2 text-center">
                          {l.files.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><Paperclip className="w-3.5 h-3.5" />{l.files.length}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'statistik' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {courses.map((c) => {
            const list = leaves.filter((l) => l.course_id === c.id);
            const byStudent = new Map<string, { name: string; nim: string; meetings: number; count: number }>();
            for (const l of list) {
              const s = byStudent.get(l.student_nim) ?? { name: l.student_name, nim: l.student_nim, meetings: 0, count: 0 };
              s.meetings += meetingsOf(l);
              s.count += 1;
              byStudent.set(l.student_nim, s);
            }
            const top = [...byStudent.values()].sort((a, b) => b.meetings - a.meetings);
            const max = Math.max(1, ...top.map((s) => s.meetings));
            return (
              <Card key={c.id} className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white"><span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{c.code}</span>{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.class_name} · {list.length} izin · {byStudent.size} mahasiswa</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LEAVE_TYPES.map((t) => {
                    const n = list.filter((l) => l.leave_type === t).length;
                    return n > 0 ? <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${LEAVE_TYPE_META[t].badge}`}>{LEAVE_TYPE_META[t].emoji} {LEAVE_TYPE_META[t].short} {n}</span> : null;
                  })}
                </div>
                {top.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada izin.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {top.slice(0, 10).map((s) => (
                      <li key={s.nim} className="text-[11px]">
                        <button onClick={() => { setFilter({ courseId: c.id, query: s.nim }); setTab('izin'); }} className="w-full text-left">
                          <span className="flex justify-between text-slate-700 dark:text-slate-300">
                            <span>{s.name} <span className="font-mono text-slate-400">{s.nim}</span></span>
                            <span className="font-mono">{s.meetings}× pertemuan</span>
                          </span>
                          <span className="block h-1.5 mt-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                            <span className="block h-full bg-amber-500" style={{ width: `${(s.meetings / max) * 100}%` }} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {opened && (
        <LeaveDetail
          leave={opened}
          course={courseById.get(opened.course_id)}
          meetings={meetingsOf(opened)}
          token={token}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
