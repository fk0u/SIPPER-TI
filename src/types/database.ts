// ============================================================================
// SIPPER-TI Database & Domain Types
// ============================================================================

export type UserRole = 'mahasiswa' | 'sipen' | 'km';
export type LeaveType = 'sakit' | 'izin' | 'acara';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  nim: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  is_password_changed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  lecturer_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  semester: string;
  room: string;
  created_at: string;
}

export interface CourseSipen {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
}

export interface LeaveAttachment {
  name: string;
  /** URL tampilan. Pada mode live berupa signed URL sementara (tidak disimpan di DB). */
  url: string;
  /** Path objek di bucket `leave-attachments` (mode live). */
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
  student: Profile;
  course: Course;
  creator: Profile;
  verifier?: Profile | null;
}

export interface LecturerToken {
  id: string;
  token: string;
  course_id: string | null; // null = access to all courses
  label: string;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  revoked_at?: string | null;
  course?: Course | null;
}

/** Baris izin minimum yang dikembalikan RPC `get_lecturer_recap` (tanpa alasan & lampiran). */
export interface LecturerRecapLeave {
  id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  student_name: string;
  student_nim: string;
}

export type LecturerRecapResult =
  | { status: 'not_found' | 'expired' | 'revoked' }
  | {
      status: 'ok';
      token: Pick<LecturerToken, 'label' | 'course_id' | 'expires_at'>;
      courses: Course[];
      leaves: LecturerRecapLeave[];
    };
