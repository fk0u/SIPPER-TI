'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Course,
  CourseSipen,
  LeaveAttachment,
  LeaveRequestWithRelations,
  LeaveType,
  LecturerToken,
  Profile,
} from '@/types/database';
import {
  INITIAL_COURSES,
  INITIAL_COURSE_SIPEN,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_LECTURER_TOKENS,
} from '@/lib/mockData';
import { canManageTokens, canSubmitFor, canVerifyRequest } from '@/lib/permissions';
import * as repo from '@/lib/data/supabaseRepository';
import { useAuthStore, isDemoMode } from './useAuthStore';

export interface SubmitLeavePayload {
  student_id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  /** Berkas mentah dari form; diunggah (live) atau dikonversi (demo) di store. */
  files: File[];
  created_by: string;
}

type Result<T = undefined> = { success: boolean; error?: string; data?: T };

interface LeaveState {
  requests: LeaveRequestWithRelations[];
  courses: Course[];
  courseSipen: CourseSipen[];
  lecturerTokens: LecturerToken[];
  isLoaded: boolean;
  loadError: string | null;

  // Actions
  load: () => Promise<void>;
  submitLeave: (payload: SubmitLeavePayload) => Promise<Result<LeaveRequestWithRelations>>;
  approveLeave: (requestId: string, verifier: Profile) => Promise<Result>;
  rejectLeave: (requestId: string, reason: string, verifier: Profile) => Promise<Result>;
  batchApproveLeaves: (requestIds: string[], verifier: Profile) => Promise<{ success: boolean; count: number; error?: string }>;
  batchRejectLeaves: (requestIds: string[], reason: string, verifier: Profile) => Promise<{ success: boolean; count: number; error?: string }>;
  resolveAttachments: (files: LeaveAttachment[]) => Promise<LeaveAttachment[]>;

  generateLecturerToken: (courseId: string | null, label: string, creator: Profile) => Promise<Result<LecturerToken>>;
  deleteLecturerToken: (tokenId: string, actor: Profile) => Promise<Result>;
  resetToInitial: () => void;
}

const TOKEN_VALIDITY_DAYS = 180;
/**
 * Mode demo menyimpan lampiran kecil sebagai data URL di localStorage (kuota ±5MB).
 * Batas per pengajuan (bukan per berkas) agar unggahan multi-berkas tidak melampaui kuota.
 */
const DEMO_INLINE_BUDGET_BYTES = 750 * 1024;
/** Nomor urut pemuatan data live: respons lama dibuang. */
let loadGeneration = 0;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Mode demo: berkas disimpan inline selama anggaran cukup, sisanya hanya metadata (tanpa pratinjau). */
async function toDemoAttachments(files: File[]): Promise<LeaveAttachment[]> {
  let budget = DEMO_INLINE_BUDGET_BYTES;
  const result: LeaveAttachment[] = [];
  for (const file of files) {
    // Data URL base64 ±4/3 ukuran asli
    const encodedSize = Math.ceil(file.size * 4 / 3);
    const inline = encodedSize <= budget;
    if (inline) budget -= encodedSize;
    result.push({
      name: file.name,
      type: file.type,
      size: file.size,
      url: inline ? await readAsDataURL(file) : '',
    });
  }
  return result;
}

function verifyAll(
  requests: LeaveRequestWithRelations[],
  ids: string[],
  verifier: Profile,
  courseSipen: CourseSipen[]
) {
  const idSet = new Set(ids);
  const allowed = requests.filter(
    (r) => idSet.has(r.id) && canVerifyRequest(verifier, r, courseSipen)
  );
  return { allowedIds: allowed.map((r) => r.id), skipped: idSet.size - allowed.length };
}

export const useLeaveStore = create<LeaveState>()(
  persist(
    (set, get) => {
      const applyDecisionLocally = (
        ids: string[],
        status: 'approved' | 'rejected',
        verifier: Profile,
        rejectionReason: string | null
      ) => {
        const idSet = new Set(ids);
        const now = new Date().toISOString();
        set((state) => ({
          requests: state.requests.map((req) =>
            idSet.has(req.id)
              ? {
                  ...req,
                  status,
                  rejection_reason: status === 'rejected' ? rejectionReason : null,
                  verified_by: verifier.id,
                  verified_at: now,
                  updated_at: now,
                  verifier,
                }
              : req
          ),
        }));
      };

      const decide = async (
        ids: string[],
        status: 'approved' | 'rejected',
        verifier: Profile,
        rejectionReason: string | null
      ): Promise<{ success: boolean; count: number; error?: string }> => {
        const { allowedIds } = verifyAll(get().requests, ids, verifier, get().courseSipen);
        if (allowedIds.length === 0) {
          return {
            success: false,
            count: 0,
            error: 'Anda tidak berwenang memverifikasi pengajuan ini (izin sendiri atau di luar mata kuliah Anda).',
          };
        }

        if (isDemoMode()) {
          applyDecisionLocally(allowedIds, status, verifier, rejectionReason);
          return { success: true, count: allowedIds.length };
        }

        try {
          const updated = await repo.updateLeaveStatus(allowedIds, status, verifier.id, rejectionReason);
          const byId = new Map(updated.map((r) => [r.id, r]));
          set((state) => ({ requests: state.requests.map((r) => byId.get(r.id) ?? r) }));
          return { success: true, count: updated.length };
        } catch (err) {
          return { success: false, count: 0, error: errorMessage(err, 'Gagal menyimpan keputusan verifikasi.') };
        }
      };

      return {
        requests: isDemoMode() ? INITIAL_LEAVE_REQUESTS : [],
        courses: isDemoMode() ? INITIAL_COURSES : [],
        courseSipen: isDemoMode() ? INITIAL_COURSE_SIPEN : [],
        lecturerTokens: isDemoMode() ? INITIAL_LECTURER_TOKENS : [],
        isLoaded: isDemoMode(),
        loadError: null,

        load: async () => {
          if (isDemoMode()) {
            set({ isLoaded: true });
            return;
          }
          // Kosongkan data pengguna sebelumnya agar tidak tampil saat berganti akun / gagal muat.
          set({ requests: [], courses: [], courseSipen: [], lecturerTokens: [], isLoaded: false, loadError: null });
          const generation = ++loadGeneration;
          try {
            const user = useAuthStore.getState().user;
            const [requests, courses, courseSipen, lecturerTokens] = await Promise.all([
              repo.fetchLeaveRequests(),
              repo.fetchCourses(),
              repo.fetchCourseSipen(),
              user && (user.role === 'km' || user.role === 'sipen')
                ? repo.fetchLecturerTokens()
                : Promise.resolve([] as LecturerToken[]),
            ]);
            if (generation !== loadGeneration) return; // pengguna sudah berganti
            set({ requests, courses, courseSipen, lecturerTokens, isLoaded: true, loadError: null });
          } catch (err) {
            if (generation !== loadGeneration) return;
            set({ isLoaded: true, loadError: errorMessage(err, 'Gagal memuat data perizinan.') });
          }
        },

        submitLeave: async (payload) => {
          if (payload.end_date < payload.start_date) {
            return { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai perizinan.' };
          }

          const actor = useAuthStore.getState().user;
          if (!actor || actor.id !== payload.created_by) {
            return { success: false, error: 'Sesi tidak valid, silakan masuk kembali.' };
          }
          if (!canSubmitFor(actor, payload.student_id, payload.course_id, get().courseSipen)) {
            return {
              success: false,
              error: 'Anda hanya dapat mengajukan izin proxy untuk mata kuliah yang Anda kelola.',
            };
          }

          if (!isDemoMode()) {
            const uploaded: LeaveAttachment[] = [];
            try {
              for (const file of payload.files) {
                uploaded.push(await repo.uploadAttachment(actor.id, file));
              }
              const record = await repo.insertLeaveRequest({
                student_id: payload.student_id,
                course_id: payload.course_id,
                leave_type: payload.leave_type,
                start_date: payload.start_date,
                end_date: payload.end_date,
                reason: payload.reason,
                file_urls: uploaded,
                created_by: payload.created_by,
              });
              set((state) => ({ requests: [record, ...state.requests] }));
              return { success: true, data: record };
            } catch (err) {
              await repo.removeAttachments(uploaded.map((u) => u.path!).filter(Boolean)).catch(() => {});
              return { success: false, error: errorMessage(err, 'Terjadi kesalahan saat mengirim pengajuan.') };
            }
          }

          const profiles = useAuthStore.getState().profiles;
          const student = profiles.find((p) => p.id === payload.student_id);
          const course = get().courses.find((c) => c.id === payload.course_id);
          if (!student || !course) {
            return { success: false, error: 'Data referensi mahasiswa atau mata kuliah tidak valid.' };
          }

          const now = new Date().toISOString();
          const newRecord: LeaveRequestWithRelations = {
            id: `leave-${Date.now()}`,
            student_id: payload.student_id,
            course_id: payload.course_id,
            leave_type: payload.leave_type,
            start_date: payload.start_date,
            end_date: payload.end_date,
            reason: payload.reason,
            file_urls: await toDemoAttachments(payload.files),
            status: 'pending',
            rejection_reason: null,
            created_by: payload.created_by,
            verified_by: null,
            verified_at: null,
            created_at: now,
            updated_at: now,
            student,
            creator: actor,
            course,
            verifier: null,
          };

          set((state) => ({ requests: [newRecord, ...state.requests] }));
          return { success: true, data: newRecord };
        },

        approveLeave: async (requestId, verifier) => {
          const res = await decide([requestId], 'approved', verifier, null);
          return { success: res.success, error: res.error };
        },

        rejectLeave: async (requestId, reason, verifier) => {
          if (!reason.trim()) {
            return { success: false, error: 'Alasan penolakan wajib diisi untuk transparansi mahasiswa.' };
          }
          const res = await decide([requestId], 'rejected', verifier, reason.trim());
          return { success: res.success, error: res.error };
        },

        batchApproveLeaves: (requestIds, verifier) => decide(requestIds, 'approved', verifier, null),

        batchRejectLeaves: (requestIds, reason, verifier) =>
          decide(requestIds, 'rejected', verifier, reason.trim() || 'Ditolak secara massal oleh verifikator.'),

        resolveAttachments: async (files) => {
          if (isDemoMode()) return files;
          return repo.signAttachments(files);
        },

        generateLecturerToken: async (courseId, label, creator) => {
          if (!canManageTokens(creator)) {
            return { success: false, error: 'Hanya Ketua Kelas yang dapat membuat tautan akses dosen.' };
          }

          const expiry = new Date();
          expiry.setDate(expiry.getDate() + TOKEN_VALIDITY_DAYS);
          const cleanLabel = label.trim() || 'Link Akses Rekap Dosen';

          if (!isDemoMode()) {
            try {
              const token = await repo.insertLecturerToken({
                course_id: courseId,
                label: cleanLabel,
                expires_at: expiry.toISOString(),
                created_by: creator.id,
              });
              set((state) => ({ lecturerTokens: [token, ...state.lecturerTokens] }));
              return { success: true, data: token };
            } catch (err) {
              return { success: false, error: errorMessage(err, 'Gagal membuat tautan akses dosen.') };
            }
          }

          const course = courseId ? get().courses.find((c) => c.id === courseId) || null : null;
          const newToken: LecturerToken = {
            id: `token-${Date.now()}`,
            token: randomHex(24),
            course_id: courseId,
            label: cleanLabel,
            expires_at: expiry.toISOString(),
            created_by: creator.id,
            created_at: new Date().toISOString(),
            revoked_at: null,
            course,
          };

          set((state) => ({ lecturerTokens: [newToken, ...state.lecturerTokens] }));
          return { success: true, data: newToken };
        },

        deleteLecturerToken: async (tokenId, actor) => {
          if (!canManageTokens(actor)) {
            return { success: false, error: 'Hanya Ketua Kelas yang dapat mencabut tautan akses dosen.' };
          }
          if (!isDemoMode()) {
            try {
              await repo.revokeLecturerToken(tokenId);
            } catch (err) {
              return { success: false, error: errorMessage(err, 'Gagal mencabut tautan.') };
            }
          }
          // Token dicabut, bukan dihapus: tautan lama menampilkan status "dicabut".
          set((state) => ({
            lecturerTokens: isDemoMode()
              ? state.lecturerTokens.map((t) => (t.id === tokenId ? { ...t, revoked_at: new Date().toISOString() } : t))
              : state.lecturerTokens.filter((t) => t.id !== tokenId),
          }));
          return { success: true };
        },

        resetToInitial: () => {
          if (!isDemoMode()) return;
          set({
            requests: INITIAL_LEAVE_REQUESTS,
            courses: INITIAL_COURSES,
            courseSipen: INITIAL_COURSE_SIPEN,
            lecturerTokens: INITIAL_LECTURER_TOKENS,
          });
        },
      };
    },
    {
      name: 'sipper-ti-leave-store',
      version: 2,
      // Mode live: data selalu dari Supabase, tidak disimpan di browser.
      partialize: (state) =>
        isDemoMode() ? { requests: state.requests, lecturerTokens: state.lecturerTokens } : {},
      // Versi 1 menyimpan blob: URL yang rusak & lampiran palsu — reset ke data awal.
      migrate: () => ({}),
    }
  )
);
