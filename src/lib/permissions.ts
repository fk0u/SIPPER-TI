// Aturan hak akses sisi klien (UX saja). RLS & RPC di supabase/migrations tetap sumber kebenaran.
// Data yang sampai ke klien sudah dibatasi ke kelas pengguna oleh RLS.
import type { CourseSipen, LeaveRequest, Profile } from '@/types/database';

type Actor = Pick<Profile, 'id' | 'role' | 'status'> | null | undefined;

export function isActive(user: Actor): boolean {
  return Boolean(user && user.status === 'active');
}

/** KM atau Sipen aktif: mengelola kelas (anggota, jadwal, dosen, WhatsApp). */
export function isSupervisor(user: Actor): boolean {
  return Boolean(isActive(user) && (user!.role === 'km' || user!.role === 'sipen'));
}

export function isKM(user: Actor): boolean {
  return Boolean(isActive(user) && user!.role === 'km');
}

export function isSipenOf(user: Actor, courseId: string, courseSipen: CourseSipen[]): boolean {
  return Boolean(
    isActive(user) &&
      user!.role === 'sipen' &&
      courseSipen.some((cs) => cs.user_id === user!.id && cs.course_id === courseId)
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
    isKM(user) ||
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
  return isKM(user) || isSipenOf(user, req.course_id, courseSipen);
}

/** Boleh mengajukan izin atas nama `studentId` untuk `courseId`. */
export function canSubmitFor(
  user: Actor,
  studentId: string,
  courseId: string,
  courseSipen: CourseSipen[]
): boolean {
  if (!isActive(user)) return false;
  if (studentId === user!.id) return true;
  return isKM(user) || isSipenOf(user, courseId, courseSipen);
}

export function canUseProxy(user: Actor): boolean {
  return isSupervisor(user);
}
