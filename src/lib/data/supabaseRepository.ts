// Akses data mode live. Semua query berjalan dengan sesi pengguna sehingga
// RLS di supabase/migrations menjadi penegak hak akses utama.
import { createClient } from '@/lib/supabase/client';
import { ATTACHMENT_BUCKET } from '@/lib/supabase/config';
import { sanitizeFileName } from '@/lib/attachments';
import type {
  Course,
  CourseSipen,
  LeaveAttachment,
  LeaveRequestWithRelations,
  LeaveStatus,
  LeaveType,
  LecturerToken,
  Profile,
  ProfileSummary,
} from '@/types/database';
import { PROFILE_DIRECTORY_COLUMNS } from '@/types/database';

const LEAVE_SELECT = `
  *,
  student:profiles!leave_requests_student_id_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  creator:profiles!leave_requests_created_by_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  verifier:profiles!leave_requests_verified_by_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  course:courses(*)
`;

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export interface SessionInfo {
  profile: Profile | null;
  /** Provider login terakhir: 'email' (NIM + password) atau 'google'. */
  provider: string | null;
}

export async function fetchSession(): Promise<SessionInfo> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { profile: null, provider: null };
  const provider = (data.user.app_metadata?.provider as string | undefined) ?? null;
  return { profile: await fetchOwnProfile(), provider };
}

/** Profil lengkap milik sendiri (RPC SECURITY DEFINER; kolom privat tidak bisa dibaca langsung). */
export async function fetchOwnProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_my_profile').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

/** Direktori kelas: hanya kolom publik. */
export async function fetchProfiles(): Promise<ProfileSummary[]> {
  const supabase = createClient();
  return unwrap(
    await supabase.from('profiles').select(PROFILE_DIRECTORY_COLUMNS).order('full_name')
  ) as unknown as ProfileSummary[];
}

export async function fetchCourses(): Promise<Course[]> {
  const supabase = createClient();
  return unwrap(await supabase.from('courses').select('*').order('code')) as Course[];
}

export async function fetchCourseSipen(): Promise<CourseSipen[]> {
  const supabase = createClient();
  return unwrap(await supabase.from('course_sipen').select('*')) as CourseSipen[];
}

export async function fetchLeaveRequests(): Promise<LeaveRequestWithRelations[]> {
  const supabase = createClient();
  const rows = unwrap(
    await supabase.from('leave_requests').select(LEAVE_SELECT).order('created_at', { ascending: false })
  ) as unknown as LeaveRequestWithRelations[];
  return rows.map((r) => ({ ...r, file_urls: Array.isArray(r.file_urls) ? r.file_urls : [] }));
}

/** Unggah lampiran ke folder milik user: `{uid}/{uuid}-{nama}`. */
export async function uploadAttachment(userId: string, file: File): Promise<LeaveAttachment> {
  const supabase = createClient();
  const path = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Gagal mengunggah "${file.name}": ${error.message}`);
  return { name: file.name, path, url: '', type: file.type, size: file.size };
}

export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
}

/** Lengkapi lampiran dengan signed URL sementara untuk ditampilkan. */
export async function signAttachments(files: LeaveAttachment[]): Promise<LeaveAttachment[]> {
  const paths = files.map((f) => f.path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return files;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(error?.message ?? 'Gagal memuat lampiran.');
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return files.map((f) => (f.path ? { ...f, url: byPath.get(f.path) ?? '' } : f));
}

export interface InsertLeavePayload {
  student_id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  file_urls: LeaveAttachment[];
  created_by: string;
}

export async function insertLeaveRequest(payload: InsertLeavePayload): Promise<LeaveRequestWithRelations> {
  const supabase = createClient();
  // Simpan hanya metadata + path; signed URL dibuat saat ditampilkan.
  const file_urls = payload.file_urls.map(({ name, path, type, size }) => ({ name, path, type, size }));
  return unwrap(
    await supabase
      .from('leave_requests')
      .insert({ ...payload, file_urls, status: 'pending' })
      .select(LEAVE_SELECT)
      .single()
  ) as unknown as LeaveRequestWithRelations;
}

export async function updateLeaveStatus(
  ids: string[],
  status: Exclude<LeaveStatus, 'pending'>,
  verifierId: string,
  rejectionReason: string | null
): Promise<LeaveRequestWithRelations[]> {
  const supabase = createClient();
  return unwrap(
    await supabase
      .from('leave_requests')
      .update({
        status,
        verified_by: verifierId,
        rejection_reason: status === 'rejected' ? rejectionReason : null,
      })
      .in('id', ids)
      .eq('status', 'pending')
      .select(LEAVE_SELECT)
  ) as unknown as LeaveRequestWithRelations[];
}

export async function fetchLecturerTokens(): Promise<LecturerToken[]> {
  const supabase = createClient();
  return unwrap(
    await supabase
      .from('lecturer_tokens')
      .select('*, course:courses(*)')
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
  ) as LecturerToken[];
}

export async function insertLecturerToken(input: {
  course_id: string | null;
  label: string;
  expires_at: string;
  created_by: string;
}): Promise<LecturerToken> {
  const supabase = createClient();
  return unwrap(
    await supabase.from('lecturer_tokens').insert(input).select('*, course:courses(*)').single()
  ) as LecturerToken;
}

export async function revokeLecturerToken(id: string): Promise<void> {
  const supabase = createClient();
  const rows = unwrap(
    await supabase.from('lecturer_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id).select('id')
  ) as { id: string }[];
  // RLS yang menolak UPDATE tidak menghasilkan error, hanya 0 baris.
  if (rows.length === 0) throw new Error('Tautan tidak ditemukan atau Anda tidak berwenang mencabutnya.');
}

export async function signInWithNim(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function changePassword(newPassword: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  // profiles.is_password_changed diperbarui trigger DB saat password auth berubah.
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
