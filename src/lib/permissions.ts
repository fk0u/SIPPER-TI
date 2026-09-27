// Aturan hak akses sisi klien. Harus selaras dengan RLS di
// supabase/migrations/20260927_security_hardening.sql — RLS tetap sumber kebenaran.
import type { CourseSipen, LeaveRequest, LecturerToken, Profile } from '@/types/database';

type Actor = Pick<Profile, 'id' | 'role'> | null | undefined;

export function isSupervisor(user: Actor): boolean {
  return Boolean(user && (user.role === 'km' || user.role === 'sipen'));
}

export function isSipenOf(user: Actor, courseId: string, courseSipen: CourseSipen[]): boolean {
  return Boolean(
    user &&
      user.role === 'sipen' &&
      courseSipen.some((cs) => cs.user_id === user.id && cs.course_id === courseId)
  );
}

export function canViewRequest(
  user: Actor,
  req: Pick<LeaveRequest, 'student_id' | 'created_by' | 'course_id'>,
  courseSipen: CourseSipen[]
): boolean {
  if (!user) return false;
  return (
    req.student_id === user.id ||
    req.created_by === user.id ||
    user.role === 'km' ||
    isSipenOf(user, req.course_id, courseSipen)
  );
}

export function canVerifyRequest(
  user: Actor,
  req: Pick<LeaveRequest, 'student_id' | 'course_id' | 'status'>,
  courseSipen: CourseSipen[]
): boolean {
  if (!user || req.status !== 'pending') return false;
  if (req.student_id === user.id) return false; // tidak boleh memverifikasi izin sendiri
  return user.role === 'km' || isSipenOf(user, req.course_id, courseSipen);
}

/** Boleh mengajukan izin atas nama `studentId` untuk `courseId`. */
export function canSubmitFor(
  user: Actor,
  studentId: string,
  courseId: string,
  courseSipen: CourseSipen[]
): boolean {
  if (!user) return false;
  if (studentId === user.id) return true;
  return user.role === 'km' || isSipenOf(user, courseId, courseSipen);
}

export function canUseProxy(user: Actor): boolean {
  return isSupervisor(user);
}

export function canManageTokens(user: Actor): boolean {
  return Boolean(user && user.role === 'km');
}

export type TokenState = 'active' | 'expired' | 'revoked';

export function getTokenState(
  token: Pick<LecturerToken, 'expires_at' | 'revoked_at'>,
  now: Date = new Date()
): TokenState {
  if (token.revoked_at) return 'revoked';
  if (token.expires_at && new Date(token.expires_at) < now) return 'expired';
  return 'active';
}
