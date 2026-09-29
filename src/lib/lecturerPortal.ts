// Utilitas portal dosen yang dipakai tampilan (klien) dan export (server).
import type { Course, PortalCourse, PortalLeave } from '@/types/database';
import { lectureDays } from './leavePlan';

export interface PortalFilter {
  courseId?: string;
  from?: string; // YYYY-MM-DD, izin yang beririsan dengan rentang
  to?: string;
  query?: string; // nama / NIM
  type?: string;
}

export function filterPortalLeaves(leaves: PortalLeave[], f: PortalFilter): PortalLeave[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  return leaves.filter(
    (l) =>
      (!f.courseId || l.course_id === f.courseId) &&
      (!f.type || l.leave_type === f.type) &&
      (!f.from || l.end_date >= f.from) &&
      (!f.to || l.start_date <= f.to) &&
      (!q || l.student_name.toLowerCase().includes(q) || l.student_nim.includes(q))
  );
}

/** Jumlah pertemuan matkul yang terkena izin (hari libur tidak dihitung). */
export function leaveMeetings(leave: PortalLeave, course: PortalCourse | undefined, holidays: string[]): number {
  if (!course?.day_of_week) return 0;
  return lectureDays([course as unknown as Course], holidays, leave.start_date, leave.end_date).length;
}

export const leaveTimeLabel = (l: Pick<PortalLeave, 'start_time' | 'end_time'>) =>
  l.start_time && l.end_time ? `${l.start_time.slice(0, 5)}–${l.end_time.slice(0, 5)}` : 'Sehari penuh';

/** Query string filter yang sama untuk tautan export. */
export function filterQuery(f: PortalFilter): string {
  const p = new URLSearchParams();
  if (f.courseId) p.set('course', f.courseId);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.query?.trim()) p.set('q', f.query.trim());
  if (f.type) p.set('type', f.type);
  return p.toString();
}

export function parseFilterQuery(p: URLSearchParams): PortalFilter {
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    courseId: p.get('course') ?? undefined,
    from: date(p.get('from')),
    to: date(p.get('to')),
    query: p.get('q')?.slice(0, 100) ?? undefined,
    type: p.get('type') ?? undefined,
  };
}
