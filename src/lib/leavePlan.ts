// Perencanaan izin: hari kuliah mana saja yang terkena rentang tanggal (dan jam) izin.
// Hari tanpa matkul (mis. Sabtu/Minggu) dan hari libur tidak dihitung.
import type { Course } from '@/types/database';
import { dayIndexID, parseISODate, toLocalISODate } from './date';

export const MAX_LEAVE_DAYS = 180;

export interface HourRange {
  start: string; // HH:MM
  end: string;
}

export interface PlanDay {
  date: string;
  courses: Course[];
}

export interface AffectedCourse {
  course: Course;
  dates: string[];
}

const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Jam izin beririsan dengan jam kuliah (matkul tanpa jam dianggap beririsan). */
export function overlapsCourse(course: Course, hours: HourRange): boolean {
  const s = hm(course.start_time);
  const e = hm(course.end_time);
  if (!s || !e) return true;
  return hours.start < e && hours.end > s;
}

/** Hari kuliah dalam rentang inklusif start..end beserta matkul yang terkena. */
export function lectureDays(
  courses: Course[],
  holidays: string[],
  start: string,
  end: string,
  hours?: HourRange | null
): PlanDay[] {
  if (!start || !end || end < start) return [];
  const off = new Set(holidays);
  const days: PlanDay[] = [];
  const d = parseISODate(start);
  for (let i = 0; i <= MAX_LEAVE_DAYS; i++, d.setDate(d.getDate() + 1)) {
    const iso = toLocalISODate(d);
    if (iso > end) break;
    if (off.has(iso)) continue;
    const dow = d.getDay();
    const hit = courses.filter(
      (c) => dayIndexID(c.day_of_week) === dow && (!hours || overlapsCourse(c, hours))
    );
    if (hit.length > 0) days.push({ date: iso, courses: hit });
  }
  return days;
}

/** Ringkas per matkul: tanggal pertemuan yang terkena izin. */
export function affectedCourses(days: PlanDay[]): AffectedCourse[] {
  const byId = new Map<string, AffectedCourse>();
  for (const day of days) {
    for (const c of day.courses) {
      const entry = byId.get(c.id) ?? { course: c, dates: [] };
      entry.dates.push(day.date);
      byId.set(c.id, entry);
    }
  }
  return [...byId.values()];
}
