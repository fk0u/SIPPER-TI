import type {
  Course,
  LeaveRequestWithRelations,
  LecturerRecapResult,
  LecturerToken,
} from '@/types/database';
import { getTokenState } from './permissions';

/**
 * Versi klien dari RPC `get_lecturer_recap` untuk mode demo.
 * Hanya izin berstatus approved, tanpa alasan & lampiran (data medis tidak dibagikan ke tamu).
 */
export function buildLecturerRecap(
  tokenString: string,
  tokens: LecturerToken[],
  requests: LeaveRequestWithRelations[],
  courses: Course[],
  now: Date = new Date()
): LecturerRecapResult {
  const token = tokens.find((t) => t.token === tokenString);
  if (!token) return { status: 'not_found' };

  const state = getTokenState(token, now);
  if (state !== 'active') return { status: state };

  const inScope = (courseId: string) => !token.course_id || courseId === token.course_id;

  return {
    status: 'ok',
    token: { label: token.label, course_id: token.course_id, expires_at: token.expires_at },
    courses: courses.filter((c) => inScope(c.id)),
    leaves: requests
      .filter((r) => r.status === 'approved' && inScope(r.course_id))
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((r) => ({
        id: r.id,
        course_id: r.course_id,
        leave_type: r.leave_type,
        start_date: r.start_date,
        end_date: r.end_date,
        student_name: r.student.full_name,
        student_nim: r.student.nim,
      })),
  };
}
