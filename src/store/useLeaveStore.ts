'use client';

import { create } from 'zustand';
import type {
  Course,
  CourseSipen,
  LeaveAttachment,
  LeaveRequestWithRelations,
  LeaveType,
  Profile,
} from '@/types/database';
import { canSubmitFor, canVerifyRequest } from '@/lib/permissions';
import * as repo from '@/lib/data/supabaseRepository';
import { useAuthStore } from './useAuthStore';

export interface SubmitLeavePayload {
  student_id: string;
  course_ids: string[];
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  /** Izin sebagian jam (HH:MM), hanya untuk izin satu hari. */
  start_time: string | null;
  end_time: string | null;
  reason: string;
  /** Berkas mentah dari form; diunggah di store. */
  files: File[];
  created_by: string;
}

type Result<T = undefined> = { success: boolean; error?: string; data?: T };

interface LeaveState {
  requests: LeaveRequestWithRelations[];
  courses: Course[];
  courseSipen: CourseSipen[];
  /** Tanggal libur (YYYY-MM-DD) — hari kuliah yang libur tidak dihitung. */
  holidays: string[];
  isLoaded: boolean;
  loadError: string | null;

  load: () => Promise<void>;
  clear: () => void;
  submitLeave: (payload: SubmitLeavePayload) => Promise<Result<LeaveRequestWithRelations[]>>;
  approveLeave: (requestId: string, verifier: Profile) => Promise<Result>;
  cancelLeave: (request: LeaveRequestWithRelations) => Promise<Result>;
  rejectLeave: (requestId: string, reason: string, verifier: Profile) => Promise<Result>;
  batchApproveLeaves: (requestIds: string[], verifier: Profile) => Promise<{ success: boolean; count: number; error?: string }>;
  batchRejectLeaves: (requestIds: string[], reason: string, verifier: Profile) => Promise<{ success: boolean; count: number; error?: string }>;
  resolveAttachments: (files: LeaveAttachment[]) => Promise<LeaveAttachment[]>;
}

/** Nomor urut pemuatan data: respons lama dibuang. */
let loadGeneration = 0;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export const useLeaveStore = create<LeaveState>()((set, get) => {
  const decide = async (
    ids: string[],
    status: 'approved' | 'rejected',
    verifier: Profile,
    rejectionReason: string | null
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    const idSet = new Set(ids);
    const allowedIds = get()
      .requests.filter((r) => idSet.has(r.id) && canVerifyRequest(verifier, r, get().courseSipen))
      .map((r) => r.id);
    if (allowedIds.length === 0) {
      return {
        success: false,
        count: 0,
        error: 'Anda tidak berwenang memverifikasi pengajuan ini (izin sendiri atau di luar mata kuliah Anda).',
      };
    }

    try {
      const updated = await repo.updateLeaveStatus(allowedIds, status, verifier.id, rejectionReason);
      const byId = new Map(updated.map((r) => [r.id, r]));
      set((state) => ({ requests: state.requests.map((r) => byId.get(r.id) ?? r) }));
      if (updated.length === 0) {
        // Sudah diputuskan verifikator lain (atau tidak berwenang): muat ulang agar status terbaru tampil
        void get().load();
        return {
          success: false,
          count: 0,
          error: 'Pengajuan sudah diverifikasi pihak lain atau tidak lagi dapat diubah. Data dimuat ulang.',
        };
      }
      return { success: true, count: updated.length };
    } catch (err) {
      return { success: false, count: 0, error: errorMessage(err, 'Gagal menyimpan keputusan verifikasi.') };
    }
  };

  return {
    requests: [],
    courses: [],
    courseSipen: [],
    holidays: [],
    isLoaded: false,
    loadError: null,

    load: async () => {
      // Kosongkan data pengguna sebelumnya agar tidak tampil saat berganti akun / gagal muat.
      set({ requests: [], courses: [], courseSipen: [], holidays: [], isLoaded: false, loadError: null });
      const generation = ++loadGeneration;
      try {
        const [requests, courses, courseSipen, holidays] = await Promise.all([
          repo.fetchLeaveRequests(),
          repo.fetchCourses(),
          repo.fetchCourseSipen(),
          // Gagal memuat libur = gagal memuat (jangan hitung hari libur sebagai kuliah)
          repo.fetchHolidays().then((list) => list.map((h) => h.date)),
        ]);
        if (generation !== loadGeneration) return; // pengguna sudah berganti
        set({ requests, courses, courseSipen, holidays, isLoaded: true, loadError: null });
      } catch (err) {
        if (generation !== loadGeneration) return;
        // Detail error (PostgREST/RLS) hanya ke console, bukan ke UI
        console.error('[leave-store] gagal memuat data:', err);
        set({ isLoaded: true, loadError: errorMessage(err, 'Gagal memuat data perizinan.') });
      }
    },

    clear: () => {
      ++loadGeneration;
      set({ requests: [], courses: [], courseSipen: [], holidays: [], isLoaded: false, loadError: null });
    },

    submitLeave: async (payload) => {
      if (payload.end_date < payload.start_date) {
        return { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai perizinan.' };
      }
      const actor = useAuthStore.getState().user;
      if (!actor || actor.id !== payload.created_by) {
        return { success: false, error: 'Sesi tidak valid, silakan masuk kembali.' };
      }
      if (payload.course_ids.length === 0) {
        return { success: false, error: 'Pilih minimal satu mata kuliah yang terdampak.' };
      }
      if (payload.course_ids.some((id) => !canSubmitFor(actor, payload.student_id, id, get().courseSipen))) {
        return {
          success: false,
          error: 'Anda hanya dapat mengajukan izin proxy untuk mata kuliah yang Anda kelola.',
        };
      }

      const uploaded: LeaveAttachment[] = [];
      try {
        for (const file of payload.files) {
          uploaded.push(await repo.uploadAttachment(actor.id, file));
        }
        const records = await repo.insertLeaveBatch({
          student_id: payload.student_id,
          course_ids: payload.course_ids,
          leave_type: payload.leave_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          reason: payload.reason,
          file_urls: uploaded,
          created_by: payload.created_by,
        });
        set((state) => ({ requests: [...records, ...state.requests] }));
        return { success: true, data: records };
      } catch (err) {
        await repo.removeAttachments(uploaded.map((u) => u.path!).filter(Boolean)).catch(() => {});
        return { success: false, error: errorMessage(err, 'Terjadi kesalahan saat mengirim pengajuan.') };
      }
    },

    cancelLeave: async (request) => {
      try {
        const res = await repo.cancelLeaveRequest(request.id);
        if (!res.ok) {
          if (res.conflict) void get().load();
          return { success: false, error: res.error };
        }
        set((state) => ({ requests: state.requests.filter((r) => r.id !== request.id) }));
        return { success: true };
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Gagal membatalkan pengajuan.') };
      }
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

    resolveAttachments: (files) => repo.signAttachments(files),
  };
});
