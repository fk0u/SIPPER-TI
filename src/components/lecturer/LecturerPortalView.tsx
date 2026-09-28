'use client';

import React, { useState } from 'react';
import { AlertTriangle, CalendarPlus, CalendarOff, Clock, GraduationCap, MapPin, Printer, Search, X } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CountUp } from '@/components/reactbits/CountUp';
import { Badge, Card } from '@/components/ui/kit';
import { DAY_NAMES_MON_FIRST, dayNameID, diffDaysInclusive, isDateInRange } from '@/lib/date';
import { LEAVE_TYPE_META } from '@/lib/leaveTypes';
import type { LecturerPortalResult } from '@/types/database';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '--:--');
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function LecturerPortalView({ portal, token }: { portal: LecturerPortalResult; token: string }) {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [courseId, setCourseId] = useState('');

  if (portal.status !== 'ok') {
    const notFound = portal.status === 'not_found';
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {notFound ? 'Tautan Dosen Tidak Valid' : 'Portal Sementara Tidak Dapat Dimuat'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {notFound
              ? 'Tautan ini tidak terdaftar atau sudah diganti. Minta tautan terbaru ke KM / Sipen kelas.'
              : 'Terjadi gangguan layanan. Tautan Anda kemungkinan masih berlaku — muat ulang beberapa saat lagi.'}
          </p>
        </Card>
      </div>
    );
  }

  const { lecturer, courses, leaves, holidays } = portal;
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const classCount = new Set(courses.map((c) => c.class_name)).size;
  const today = dayNameID();

  const shown = leaves.filter((l) => {
    if (courseId && l.course_id !== courseId) return false;
    if (date && !isDateInRange(date, l.start_date, l.end_date)) return false;
    const q = query.trim().toLowerCase();
    return !q || l.student_name.toLowerCase().includes(q) || l.student_nim.includes(q);
  });

  const calendarPath = `/dosen/${token}/calendar.ics`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center print:hidden shadow-inner">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <Badge tone="emerald">Portal Dosen · tanpa login</Badge>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{lecturer.full_name}</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">Jadwal mengajar di semua kelas & rekap izin mahasiswa</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <ThemeToggle />
            <a href={calendarPath} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" /> Tambah ke Kalender
            </a>
            <button onClick={() => window.print()} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 active:scale-95">
              <Printer className="w-4 h-4" /> Cetak
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Mata kuliah', courses.length],
            ['Kelas', classCount],
            ['Izin disetujui (180 hari)', leaves.length],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">{label}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums"><CountUp to={Number(value)} /></span>
            </div>
          ))}
        </div>
      </Card>

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
                    {day} {day === today && <Badge tone="blue">Hari ini</Badge>}
                  </p>
                  {list.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{c.code}</span>{c.name}
                        </p>
                        <p className="text-[11px] text-slate-500">{c.class_name}</p>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 text-right">
                        <p className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {hhmm(c.start_time)}–{hhmm(c.end_time)} WITA</p>
                        {c.room && <p className="flex items-center gap-1 justify-end"><MapPin className="w-3 h-3" /> {c.room}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Libur Mendatang</h2>
          {holidays.length === 0 ? (
            <p className="text-xs text-slate-500">Tidak ada hari libur dalam 4 bulan ke depan.</p>
          ) : (
            <ul className="space-y-2">
              {holidays.map((h) => (
                <li key={h.date} className="text-xs">
                  <span className="font-mono text-slate-500 block">{fmtDate(h.date)}</span>
                  <span className="text-slate-900 dark:text-white">{h.description}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Rekap Izin Mahasiswa (disetujui)</h2>
          <div className="flex flex-wrap gap-2 print:hidden">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
              className="bg-white/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
              <option value="">Semua mata kuliah</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.class_name}</option>)}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="bg-white/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white" />
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama / NIM"
                className="bg-white/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/5 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white w-40" />
              {(query || date || courseId) && (
                <button onClick={() => { setQuery(''); setDate(''); setCourseId(''); }} className="absolute right-2 top-2 text-slate-400" aria-label="Reset filter">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Tidak ada izin yang cocok.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-2 py-2">Mahasiswa</th><th className="px-2 py-2">Mata kuliah</th><th className="px-2 py-2">Jenis</th><th className="px-2 py-2">Tanggal</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                {shown.map((l) => {
                  const c = courseById.get(l.course_id);
                  const meta = LEAVE_TYPE_META[l.leave_type];
                  const days = diffDaysInclusive(l.start_date, l.end_date);
                  return (
                    <tr key={l.id}>
                      <td className="px-2 py-2 text-slate-900 dark:text-white">{l.student_name}<span className="block font-mono text-[10px] text-slate-500">{l.student_nim}</span></td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{c ? `${c.code} · ${c.class_name}` : '-'}</td>
                      <td className="px-2 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${meta.badge}`}>{meta.emoji} {meta.short}</span></td>
                      <td className="px-2 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {l.start_date}{l.end_date !== l.start_date ? ` → ${l.end_date}` : ''} <span className="text-slate-400">({days} hr)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
