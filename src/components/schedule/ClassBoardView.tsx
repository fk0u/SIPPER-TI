'use client';

import React from 'react';
import { AlertTriangle, CalendarDays, CalendarOff, CalendarPlus, Clock, MapPin, Printer, User } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Badge, Card } from '@/components/ui/kit';
import { DAY_NAMES_MON_FIRST, dayIndexID, dayNameWITA, todayWITA } from '@/lib/date';
import type { BoardCourse } from '@/types/database';
import type { ClassBoardResult } from '@/types/database';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '--:--');
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Papan jadwal publik kelas (Portal Papan Jadwal SiPenDosa): tanpa login, tanpa data mahasiswa. */
export function ClassBoardView({ board, token }: { board: ClassBoardResult; token: string }) {
  if (board.status !== 'ok') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {board.status === 'not_found' ? 'Papan Jadwal Tidak Ditemukan' : 'Papan Jadwal Sementara Tidak Dapat Dimuat'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {board.status === 'not_found'
              ? 'Tautan ini sudah dinonaktifkan atau diganti oleh Sipen / KM kelas.'
              : 'Terjadi gangguan layanan. Muat ulang beberapa saat lagi.'}
          </p>
        </Card>
      </div>
    );
  }

  const { class: klass, courses, holidays } = board;
  const today = dayNameWITA();
  // Portal menerima libur 365 hari (untuk EXDATE kalender); tampilkan 4 bulan ke depan
  const soon = new Date(Date.parse(`${todayWITA()}T00:00:00Z`) + 120 * 86_400_000).toISOString().slice(0, 10);
  const holidaysSoon = holidays.filter((h) => h.date < soon);

  // Hari dicocokkan tanpa peduli huruf besar/kecil (seperti day_index() di database)
  const dayOf = (c: BoardCourse) => (dayIndexID(c.day_of_week) < 0 ? null : DAY_NAMES_MON_FIRST[(dayIndexID(c.day_of_week) + 6) % 7]);
  const unscheduled = courses.filter((c) => dayOf(c) === null);
  const renderCourse = (c: BoardCourse) => (
    <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1">
      <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{c.code}</p>
      <p className="text-xs font-semibold text-slate-900 dark:text-white">{c.name}</p>
      <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
        <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {hhmm(c.start_time)} – {hhmm(c.end_time)} WITA</p>
        {c.room && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {c.room}</p>}
        {c.lecturer_name && <p className="flex items-center gap-1.5"><User className="w-3 h-3" /> {c.lecturer_name}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shadow-inner print:hidden">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <Badge tone="blue">Papan Jadwal Kelas</Badge>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{klass.name}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">{klass.program}{klass.batch ? ` · Angkatan ${klass.batch}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ThemeToggle />
          <a href={`/kelas/${token}/calendar.ics`} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" /> Tambah ke Kalender
          </a>
          <button onClick={() => window.print()} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 active:scale-95">
            <Printer className="w-4 h-4" /> Cetak
          </button>
        </div>
      </Card>

      {courses.length === 0 ? (
        <Card><p className="text-xs text-slate-500 text-center py-6">Jadwal belum diisi.</p></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAY_NAMES_MON_FIRST.map((day) => {
            const list = courses.filter((c) => dayOf(c) === day);
            if (list.length === 0) return null;
            return (
              <Card key={day} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  {day} {day === today && <Badge tone="blue">Hari ini</Badge>}
                </h2>
                {list.map(renderCourse)}
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

      {holidaysSoon.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarOff className="w-4 h-4" /> Libur Mendatang</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {holidaysSoon.map((h) => (
              <li key={h.date} className="text-xs"><span className="font-mono text-slate-500 mr-2">{fmtDate(h.date)}</span>{h.description}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
