// Hitung mundur pengingat berikutnya (fitur dashboard SiPenDosa). Aturannya meniru
// penjadwal worker (worker/main.go scheduleSQL): zona WITA, jam operasional kelas,
// H-1/H-0, lewati hari libur, sekali per hari per mata kuliah.
import type { Course, Holiday } from '@/types/database';
import { dayIndexID } from './date';

const WITA_OFFSET_MS = 8 * 3600_000;
const DAY_MS = 86_400_000;

export interface NextReminder {
  course: Course;
  /** Waktu kirim (Date sebenarnya). */
  fireAt: Date;
  /** Tanggal kuliah yang diingatkan, YYYY-MM-DD. */
  lectureDate: string;
}

/** Menit sejak tengah malam, termasuk detik ("16:00:30" → 960.5) seperti tipe TIME di database. */
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + Number(t.slice(6, 8) || 0) / 60;
const isoOf = (witaMidnightMs: number) => new Date(witaMidnightMs).toISOString().slice(0, 10);

/** Waktu kirim paling awal untuk satu mata kuliah, atau null bila tidak akan pernah terkirim. */
function nextFor(
  c: Course,
  holidays: Set<string>,
  windowStart: number,
  windowEnd: number,
  now: Date
): NextReminder | null {
  const dow = dayIndexID(c.day_of_week);
  if (!c.reminder_enabled || dow < 0 || (!c.lecturer_id && !c.reminder_target)) return null;
  // Worker mengantrekan saat now >= reminder_time DAN now di dalam jam operasional
  const fireMin = Math.max(minutes(c.reminder_time), windowStart);
  if (fireMin > windowEnd) return null;

  const witaNow = now.getTime() + WITA_OFFSET_MS;
  const todayMidnight = witaNow - (witaNow % DAY_MS);
  // Presisi detik: worker berhenti mengantrekan tepat setelah jam selesai (TIME, bukan menit)
  const nowMin = (witaNow % DAY_MS) / 60_000;
  const todayISO = isoOf(todayMidnight);

  for (let d = 0; d <= 14; d++) {
    const fireDay = todayMidnight + d * DAY_MS;
    const lectureDay = fireDay + (c.reminder_mode === 'H-1' ? DAY_MS : 0);
    if (new Date(lectureDay).getUTCDay() !== dow) continue;
    const lectureISO = isoOf(lectureDay);
    if (holidays.has(lectureISO)) continue;
    if (d === 0) {
      if (c.last_reminded_on === todayISO || nowMin > windowEnd) continue; // sudah terkirim / terlewat
      const at = Math.max(fireMin, Math.ceil(nowMin)); // sudah lewat jamnya: dikirim pada tick berikutnya
      return { course: c, lectureDate: lectureISO, fireAt: new Date(fireDay + at * 60_000 - WITA_OFFSET_MS) };
    }
    return { course: c, lectureDate: lectureISO, fireAt: new Date(fireDay + fireMin * 60_000 - WITA_OFFSET_MS) };
  }
  return null;
}

export function nextReminder(
  courses: Course[],
  holidays: Holiday[],
  window: { start: string; end: string },
  now: Date = new Date()
): NextReminder | null {
  const hol = new Set(holidays.map((h) => h.date));
  const ws = minutes(window.start);
  const we = minutes(window.end);
  return courses
    .map((c) => nextFor(c, hol, ws, we, now))
    .filter((r): r is NextReminder => r !== null)
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())[0] ?? null;
}

/** Jam kirim relatif terhadap jam operasional: 'after' = tidak akan pernah terkirim,
 *  'before' = dikirim mulai awal jam operasional, null = di dalam jam operasional. */
export function windowPosition(reminderTime: string, window: { start: string; end: string }): 'before' | 'after' | null {
  if (minutes(reminderTime) > minutes(window.end)) return 'after';
  if (minutes(reminderTime) < minutes(window.start)) return 'before';
  return null;
}

export function formatCountdown(ms: number): string {
  if (ms <= 60_000) return 'sebentar lagi';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return [d && `${d} hari`, h && `${h} jam`, `${m % 60} menit`].filter(Boolean).join(' ');
}
