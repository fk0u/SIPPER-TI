// Akses data. Semua query berjalan dengan sesi pengguna sehingga RLS & RPC di
// supabase/migrations menjadi penegak hak akses utama.
import { createClient } from '@/lib/supabase/client';
import { ATTACHMENT_BUCKET, nimToEmail } from '@/lib/supabase/config';
import { sanitizeFileName } from '@/lib/attachments';
import type {
  AuditEntry,
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
  TemplateVersion,
  WaGroup,
  WaStats,
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

/** Anggota sekelas (termasuk pendaftar pending): hanya kolom publik. Difilter per kelas karena
 *  superadmin dapat membaca profil semua kelas. */
export async function fetchProfiles(classId: string): Promise<ProfileSummary[]> {
  return unwrap(
    await createClient().from('profiles').select(PROFILE_DIRECTORY_COLUMNS).eq('class_id', classId).order('full_name')
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

/** Samakan penugasan Sipen pada satu mata kuliah dalam satu transaksi (khusus KM). */
export const setCourseSipen = (courseId: string, userIds: string[]) =>
  rpc('set_course_sipen', { p_course: courseId, p_users: userIds });

/** Atur semua matkul yang dipegang seorang Sipen/KM sekaligus (KM kelas / superadmin). */
export const setMemberCourses = (userId: string, courseIds: string[]) =>
  rpc('set_member_courses', { p_user: userId, p_courses: courseIds });

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
export const updateReminderSettings = (windowStart: string, windowEnd: string, dryRun: boolean) =>
  rpc('update_reminder_settings', { p_window_start: windowStart, p_window_end: windowEnd, p_dry_run: dryRun });
export const retryWaMessage = (id: number) => rpc('retry_wa_message', { p_id: id });
export const waStats = () => rpc<WaStats>('wa_stats');
/** on = aktifkan papan jadwal publik, rotate = link baru, off = nonaktif. */
export const setClassBoard = (action: 'on' | 'rotate' | 'off') => rpc<string | null>('set_class_board', { p_action: action });

export async function fetchTemplateVersions(limit = 20): Promise<TemplateVersion[]> {
  return unwrap(
    await createClient()
      .from('reminder_template_versions')
      .select('id, content, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as TemplateVersion[];
}

export async function fetchWaGroups(): Promise<WaGroup[]> {
  return unwrap(
    await createClient().from('wa_groups').select('jid, name, participants, synced_at').order('name')
  ) as WaGroup[];
}

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
  course_ids: string[];
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  file_urls: LeaveAttachment[];
  created_by: string;
}

/** Satu pengajuan → satu baris per matkul (batch_id sama), dalam satu insert atomik. */
export async function insertLeaveBatch({ course_ids, ...payload }: InsertLeavePayload): Promise<LeaveRequestWithRelations[]> {
  // Simpan hanya metadata + path; signed URL dibuat saat ditampilkan.
  const file_urls = payload.file_urls.map(({ name, path, type, size }) => ({ name, path, type, size }));
  const batch_id = crypto.randomUUID();
  const rows = course_ids.map((course_id) => ({ ...payload, course_id, batch_id, file_urls, status: 'pending' }));
  return unwrap(
    await createClient().from('leave_requests').insert(rows).select(LEAVE_SELECT)
  ) as unknown as LeaveRequestWithRelations[];
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

/** Batalkan izin pending (RLS: hanya mahasiswanya / pengajunya). Mengembalikan jumlah baris terhapus. */
export async function deleteLeaveRequest(id: string): Promise<number> {
  const rows = unwrap(
    await createClient().from('leave_requests').delete().eq('id', id).eq('status', 'pending').select('id')
  ) as { id: string }[];
  return rows.length;
}

export async function fetchAuditLog(limit = 50): Promise<AuditEntry[]> {
  return unwrap(
    await createClient().from('audit_log').select('*').order('at', { ascending: false }).limit(limit)
  ) as AuditEntry[];
}

/** Reset kata sandi anggota ke NIM (route server; otorisasi KM kelas / superadmin di database). */
export async function resetMemberPassword(userId: string): Promise<void> {
  const res = await fetch('/api/members/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Gagal mereset kata sandi.');
  }
}

// ---------------------------------------------------------------------------
// 2FA (TOTP)
// ---------------------------------------------------------------------------
/** true bila akun punya 2FA tetapi sesi ini belum memasukkan kode (aal1 → butuh aal2). */
export async function mfaPending(): Promise<boolean> {
  const { data, error } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel();
  // Gagal tertutup: tanpa tingkat keamanan sesi, jangan anggap akun tanpa 2FA
  if (error || !data) throw new Error(error?.message ?? 'Status 2FA sesi tidak dapat dipastikan.');
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export async function listTotpFactors() {
  const { data, error } = await createClient().auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return data.all.filter((f) => f.factor_type === 'totp');
}

/** Mulai pendaftaran 2FA: mengembalikan QR (SVG data URI) & secret. Faktor lama yang belum diverifikasi dibersihkan. */
export async function enrollTotp() {
  const supabase = createClient();
  for (const f of await listTotpFactors()) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error) throw new Error(error.message);
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? 'Kode salah atau kedaluwarsa.' : error.message);
}

/** Verifikasi login dengan faktor TOTP terverifikasi pertama. */
export async function verifyLoginTotp(code: string): Promise<void> {
  const factor = (await listTotpFactors()).find((f) => f.status === 'verified');
  if (!factor) throw new Error('Faktor 2FA tidak ditemukan.');
  await verifyTotp(factor.id, code);
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await createClient().auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
}
