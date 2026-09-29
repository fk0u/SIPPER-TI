// ============================================================================
// SIPPER-TI Database & Domain Types (platform multi-kelas)
// Sumber kebenaran skema: supabase/migrations/
// ============================================================================

export type UserRole = 'mahasiswa' | 'sipen' | 'km';
export type MemberStatus = 'pending' | 'active';
export type ClassStatus = 'pending' | 'active';
export type LeaveType = 'sakit' | 'izin_biasa' | 'keluar_kampus' | 'acara_kampus';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type ReminderMode = 'H-1' | 'H-0';

export interface Profile {
  id: string;
  nim: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  is_password_changed: boolean;
  class_id: string | null;
  status: MemberStatus;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Kolom profil yang boleh dilihat sesama anggota kelas.
 * Email, telepon, dan status password hanya untuk pemilik akun.
 */
export const PROFILE_DIRECTORY_COLUMNS = 'id,nim,full_name,role,avatar_url,class_id,status,created_at' as const;
export type ProfileSummary = Pick<
  Profile,
  'id' | 'nim' | 'full_name' | 'role' | 'avatar_url' | 'class_id' | 'status' | 'created_at'
>;

export interface ClassInfo {
  id: string;
  name: string;
  program: string;
  batch: string | null;
  status: ClassStatus;
  created_by: string | null;
  reminder_template: string;
  /** Jam operasional kirim pengingat (WITA), mis. "08:00:00". */
  send_window_start: string;
  send_window_end: string;
  /** Mode uji: pengingat dirender & dicatat tanpa dikirim. */
  reminder_dry_run: boolean;
  /** Token papan jadwal publik; null = nonaktif. */
  public_token: string | null;
  created_at: string;
}

/** Kelas aktif untuk halaman registrasi (RPC `list_open_classes`). */
export type OpenClass = Pick<ClassInfo, 'id' | 'name' | 'program' | 'batch'>;

export interface PendingClass {
  id: string;
  name: string;
  program: string;
  batch: string | null;
  created_at: string;
  applicant_id: string | null;
  applicant_name: string | null;
  applicant_nim: string | null;
}

export interface Course {
  id: string;
  class_id: string;
  code: string;
  name: string;
  /** Nama dosen bebas (data lama); dosen terdaftar memakai `lecturer_id`. */
  lecturer_name: string | null;
  lecturer_id: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  semester: string;
  room: string | null;
  reminder_enabled: boolean;
  reminder_mode: ReminderMode;
  reminder_time: string;
  reminder_target: string | null;
  link_group: string | null;
  last_reminded_on: string | null;
  created_at: string;
  updated_at?: string;
  lecturer?: Pick<Lecturer, 'id' | 'full_name'> | null;
}

export interface CourseSipen {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
}

/** Dosen lintas kelas. Nomor, email & token hanya untuk staf (RPC `get_class_lecturers`). */
export interface Lecturer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  access_token: string;
  course_count: number;
  can_edit: boolean;
}

export interface LeaveAttachment {
  name: string;
  /** URL tampilan: signed URL sementara (tidak disimpan di DB). */
  url: string;
  /** Path objek di bucket `permit-proofs`. */
  path?: string;
  type: string;
  size?: number;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  /** Izin sebagian jam (hanya izin satu hari); null = sehari penuh. */
  start_time?: string | null;
  end_time?: string | null;
  /** Satu pengajuan wizard dapat menghasilkan beberapa baris (per matkul). */
  batch_id?: string | null;
  reason: string;
  file_urls: LeaveAttachment[];
  status: LeaveStatus;
  rejection_reason?: string | null;
  created_by: string;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestWithRelations extends LeaveRequest {
  student: ProfileSummary;
  course: Course;
  creator: ProfileSummary;
  verifier?: ProfileSummary | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  target_user: string | null;
  class_id: string | null;
  details: {
    actor_nim?: string | null;
    target_nim?: string | null;
    target_name?: string | null;
    course?: string | null;
    from?: string;
    to?: string;
    start_date?: string;
    end_date?: string;
    rejection_reason?: string | null;
  };
}

export interface Holiday {
  date: string;
  description: string;
}

export type WaState = 'disconnected' | 'connecting' | 'need_qr' | 'connected' | 'logged_out' | 'error';

export interface WaSession {
  class_id: string;
  desired: 'on' | 'off' | 'logout';
  state: WaState;
  qr_code: string | null;
  pair_phone: string | null;
  pair_code: string | null;
  device_jid: string | null;
  push_name: string | null;
  last_error: string | null;
  worker_seen_at: string | null;
  updated_at: string;
}

export type WaMessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'dry_run';

export interface WaMessage {
  id: number;
  class_id: string;
  course_id: string | null;
  lecture_date: string | null;
  recipient: string | null;
  recipient_name: string | null;
  body: string | null;
  status: WaMessageStatus;
  attempts: number;
  last_error: string | null;
  send_after: string;
  sent_at: string | null;
  created_at: string;
  course?: Pick<Course, 'code' | 'name'> | null;
}

export interface WaGroup {
  jid: string;
  name: string;
  participants: number;
  synced_at: string;
}

export interface TemplateVersion {
  id: number;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface WaStats {
  sent_today: number;
  sent_total: number;
  failed_total: number;
  pending: number;
  dry_run_total: number;
}

// ---------------------------------------------------------------------------
// Portal dosen (RPC `get_lecturer_portal`, tanpa login)
// ---------------------------------------------------------------------------
export interface PortalCourse {
  id: string;
  code: string;
  name: string;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  semester: string;
  class_name: string;
  link_group: string | null;
  /** Hanya di portal dosen: jumlah mahasiswa aktif kelas tsb. */
  student_count?: number;
}

/** Izin approved untuk portal dosen; lampiran dibuka lewat route server (tanpa path). */
export interface PortalLeave {
  id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  batch_id: string | null;
  created_at: string;
  verified_at: string | null;
  verifier_name: string | null;
  student_name: string;
  student_nim: string;
  files: { name: string; type: string; size: number | null }[];
}

export type LecturerPortalResult =
  | { status: 'not_found' | 'unavailable' }
  | {
      status: 'ok';
      lecturer: { full_name: string };
      courses: PortalCourse[];
      leaves: PortalLeave[];
      holidays: Holiday[];
    };

// ---------------------------------------------------------------------------
// Papan jadwal publik kelas (RPC `get_class_board`, tanpa login)
// ---------------------------------------------------------------------------
export type BoardCourse = PortalCourse & { lecturer_name: string | null };

export type ClassBoardResult =
  | { status: 'not_found' | 'unavailable' }
  | {
      status: 'ok';
      class: Pick<ClassInfo, 'name' | 'program' | 'batch'>;
      courses: BoardCourse[];
      holidays: Holiday[];
    };
