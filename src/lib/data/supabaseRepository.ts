// Akses data. Semua query berjalan dengan sesi pengguna sehingga RLS & RPC di
// supabase/migrations menjadi penegak hak akses utama.
import { createClient } from '@/lib/supabase/client';
import { ATTACHMENT_BUCKET, nimToEmail } from '@/lib/supabase/config';
import { sanitizeFileName } from '@/lib/attachments';
import type {
  ClassInfo,
  Course,
  CourseSipen,
  Holiday,
  LeaveAttachment,
  LeaveRequestWithRelations,
  LeaveStatus,
  LeaveType,
  Lecturer,
  OpenClass,
  PendingClass,
  Profile,
  ProfileSummary,
  UserRole,
  WaMessage,
  WaSession,
} from '@/types/database';
import { PROFILE_DIRECTORY_COLUMNS } from '@/types/database';

const LEAVE_SELECT = `
  *,
  student:profiles!leave_requests_student_id_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  creator:profiles!leave_requests_created_by_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  verifier:profiles!leave_requests_verified_by_fkey(${PROFILE_DIRECTORY_COLUMNS}),
  course:courses(*)
`;
const COURSE_SELECT = '*, lecturer:lecturers(id, full_name)';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

async function rpc<T = void>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return unwrap(await createClient().rpc(fn, args)) as T;
}

// ---------------------------------------------------------------------------
// Sesi & profil
// ---------------------------------------------------------------------------
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
  const { data, error } = await createClient().rpc('get_my_profile').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

/** Anggota sekelas (termasuk pendaftar pending): hanya kolom publik. */
export async function fetchProfiles(): Promise<ProfileSummary[]> {
  return unwrap(
    await createClient().from('profiles').select(PROFILE_DIRECTORY_COLUMNS).order('full_name')
  ) as unknown as ProfileSummary[];
}

export async function fetchClass(classId: string): Promise<ClassInfo | null> {
  return unwrap(
    await createClient().from('classes').select('*').eq('id', classId).maybeSingle()
  ) as ClassInfo | null;
}

export async function signInWithNim(email: string, password: string) {
  const { data, error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export type ClassChoice =
  | { kind: 'join'; classId: string }
  | { kind: 'new'; name: string; program: string; batch: string };

/** Registrasi mandiri. Akun langsung login tetapi berstatus pending sampai di-ACC. */
export async function signUpWithNim(input: {
  nim: string;
  fullName: string;
  password: string;
  choice: ClassChoice;
}): Promise<void> {
  const data: Record<string, unknown> = { full_name: input.fullName.trim(), self_registered: true };
  if (input.choice.kind === 'join') {
    data.class_id = input.choice.classId;
  } else {
    data.new_class_name = input.choice.name.trim();
    data.new_class_program = input.choice.program.trim();
    data.new_class_batch = input.choice.batch.trim();
  }
  const { error } = await createClient().auth.signUp({
    email: nimToEmail(input.nim),
    password: input.password,
    options: { data },
  });
  if (error) throw new Error(error.message);
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await createClient().auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  // profiles.is_password_changed diperbarui trigger DB saat password auth berubah.
}

export async function signOut(): Promise<void> {
  await createClient().auth.signOut();
}

// ---------------------------------------------------------------------------
// Kelas & keanggotaan
// ---------------------------------------------------------------------------
export const listOpenClasses = () => rpc<OpenClass[]>('list_open_classes');
export const chooseClass = (classId: string) => rpc('choose_class', { p_class: classId });
export const approveMember = (userId: string) => rpc('approve_member', { p_user: userId });
export const removeMember = (userId: string) => rpc('remove_member', { p_user: userId });
export const setMemberRole = (userId: string, role: UserRole) =>
  rpc('set_member_role', { p_user: userId, p_role: role });

// Superadmin
export const listPendingClasses = () => rpc<PendingClass[]>('list_pending_classes');
export const approveClass = (classId: string) => rpc('approve_class', { p_class: classId });
export const rejectClass = (classId: string) => rpc('reject_class', { p_class: classId });

/** Anggota aktif sebuah kelas (superadmin melihat semua kelas; lainnya dibatasi RLS). */
export async function fetchClassMembers(classId: string): Promise<ProfileSummary[]> {
  return unwrap(
    await createClient()
      .from('profiles')
      .select(PROFILE_DIRECTORY_COLUMNS)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('full_name')
  ) as unknown as ProfileSummary[];
}

/** KM aktif seluruh kelas (superadmin). */
export async function fetchClassLeaders(): Promise<ProfileSummary[]> {
  return unwrap(
    await createClient().from('profiles').select(PROFILE_DIRECTORY_COLUMNS).eq('role', 'km').eq('status', 'active')
  ) as unknown as ProfileSummary[];
}

export async function fetchAllClasses(): Promise<ClassInfo[]> {
  return unwrap(await createClient().from('classes').select('*').order('name')) as ClassInfo[];
}

export async function fetchHolidays(): Promise<Holiday[]> {
  return unwrap(await createClient().from('holidays').select('date, description').order('date')) as Holiday[];
}

export async function addHoliday(date: string, description: string): Promise<void> {
  unwrap(await createClient().from('holidays').insert({ date, description: description.trim() }));
}

export async function deleteHoliday(date: string): Promise<void> {
  unwrap(await createClient().from('holidays').delete().eq('date', date));
}

// ---------------------------------------------------------------------------
// Jadwal (mata kuliah) & dosen
// ---------------------------------------------------------------------------
export async function fetchCourses(): Promise<Course[]> {
  return unwrap(await createClient().from('courses').select(COURSE_SELECT).order('code')) as Course[];
}

export async function fetchCourseSipen(): Promise<CourseSipen[]> {
  return unwrap(await createClient().from('course_sipen').select('*')) as CourseSipen[];
}

export type CourseInput = Pick<
  Course,
  | 'code'
  | 'name'
  | 'day_of_week'
  | 'start_time'
  | 'end_time'
  | 'room'
  | 'semester'
  | 'lecturer_id'
  | 'reminder_enabled'
  | 'reminder_mode'
  | 'reminder_time'
  | 'reminder_target'
  | 'link_group'
>;

export async function saveCourse(classId: string, id: string | null, input: CourseInput): Promise<Course> {
  const supabase = createClient();
  const query = id
    ? supabase.from('courses').update(input).eq('id', id)
    : supabase.from('courses').insert({ ...input, class_id: classId });
  return unwrap(await query.select(COURSE_SELECT).single()) as Course;
}

export async function deleteCourse(id: string): Promise<void> {
  unwrap(await createClient().from('courses').delete().eq('id', id));
}

/** Samakan penugasan Sipen pada satu mata kuliah (khusus KM). */
export async function setCourseSipen(courseId: string, userIds: string[], current: string[]): Promise<void> {
  const supabase = createClient();
  const toRemove = current.filter((u) => !userIds.includes(u));
  const toAdd = userIds.filter((u) => !current.includes(u));
  if (toRemove.length) {
    unwrap(await supabase.from('course_sipen').delete().eq('course_id', courseId).in('user_id', toRemove));
  }
  if (toAdd.length) {
    unwrap(await supabase.from('course_sipen').insert(toAdd.map((user_id) => ({ user_id, course_id: courseId }))));
  }
}

export const getClassLecturers = () => rpc<Lecturer[]>('get_class_lecturers');
export const saveLecturer = (id: string | null, name: string, phone: string, email: string) =>
  rpc<string>('save_lecturer', { p_id: id, p_name: name.trim(), p_phone: phone, p_email: email.trim() || null });
export const regenerateLecturerToken = (id: string) => rpc<string>('regenerate_lecturer_token', { p_id: id });

// ---------------------------------------------------------------------------
// WhatsApp & pengingat
// ---------------------------------------------------------------------------
export async function fetchWaSession(): Promise<WaSession | null> {
  return unwrap(await createClient().from('wa_sessions').select('*').maybeSingle()) as WaSession | null;
}

export const waRequest = (action: 'on' | 'off' | 'logout', phone?: string) =>
  rpc('wa_request', { p_action: action, p_phone: phone || null });

export async function fetchWaMessages(limit = 50): Promise<WaMessage[]> {
  return unwrap(
    await createClient()
      .from('wa_messages')
      .select('*, course:courses(code, name)')
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as WaMessage[];
}

export const queueReminderNow = (courseId: string) => rpc<number>('queue_reminder_now', { p_course: courseId });
export const queueTestMessage = (recipient: string, body: string) =>
  rpc<number>('queue_test_message', { p_recipient: recipient, p_body: body });
export const cancelWaMessage = (id: number) => rpc('cancel_wa_message', { p_id: id });
export const setReminderTemplate = (template: string) => rpc('set_reminder_template', { p_template: template });

// ---------------------------------------------------------------------------
// Perizinan
// ---------------------------------------------------------------------------
export async function fetchLeaveRequests(): Promise<LeaveRequestWithRelations[]> {
  const rows = unwrap(
    await createClient().from('leave_requests').select(LEAVE_SELECT).order('created_at', { ascending: false })
  ) as unknown as LeaveRequestWithRelations[];
  return rows.map((r) => ({ ...r, file_urls: Array.isArray(r.file_urls) ? r.file_urls : [] }));
}

/** Unggah lampiran ke folder milik user: `{uid}/{uuid}-{nama}`. */
export async function uploadAttachment(userId: string, file: File): Promise<LeaveAttachment> {
  const path = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await createClient()
    .storage.from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Gagal mengunggah "${file.name}": ${error.message}`);
  return { name: file.name, path, url: '', type: file.type, size: file.size };
}

export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await createClient().storage.from(ATTACHMENT_BUCKET).remove(paths);
}

/** Lengkapi lampiran dengan signed URL sementara untuk ditampilkan. */
export async function signAttachments(files: LeaveAttachment[]): Promise<LeaveAttachment[]> {
  const paths = files.map((f) => f.path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return files;
  const { data, error } = await createClient()
    .storage.from(ATTACHMENT_BUCKET)
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
  // Simpan hanya metadata + path; signed URL dibuat saat ditampilkan.
  const file_urls = payload.file_urls.map(({ name, path, type, size }) => ({ name, path, type, size }));
  return unwrap(
    await createClient()
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
  return unwrap(
    await createClient()
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
